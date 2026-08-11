const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const ID_BEARING_SEGMENTS = ['embed', 'v', 'e', 'shorts', 'live']
const YOUTUBE_HOST = /(^|\.)youtube(-nocookie)?\.com$/
const YOUTU_BE_HOST = /(^|\.)youtu\.be$/

// An embed snippet reaches us in more shapes than a well-formed tag.
//
//   1. `<iframe src="…"></iframe>`          - pasted and stored intact
//   2. `&lt;iframe src="…"&gt;…`            - stored escaped, as a contenteditable
//                                             serialises a pasted plain-text snippet
//   3. `iframe src="…"></iframe>`           - stored with the opening "<" already
//                                             eaten, which is what the lessons on the
//                                             ecosoc site actually contain
//
// Shape 3 is why matching on `<iframe` alone left those lessons showing raw markup
// after the fix shipped: there is no `<` left to match, in the editor or the viewer.
// So anchor on the word `iframe` instead, allow the opener and the closing angle
// bracket to be literal or entity-encoded, and rely on `videoFromIframe` refusing
// anything without a real video `src` to keep prose that merely says "iframe" intact.
const IFRAME_BLOB_SOURCE =
	'(?<![\\w-])(?:(?:<|&lt;)\\s*)?iframe\\b[^<>]*?(?:>|&gt;)' +
	'(?:[\\s\\S]*?(?:<|&lt;)\\s*/\\s*iframe\\s*(?:>|&gt;))?'
const IFRAME_BLOB = new RegExp(IFRAME_BLOB_SOURCE, 'i')
const IFRAME_BLOB_ALL = new RegExp(IFRAME_BLOB_SOURCE, 'gi')

const SRC_ATTR = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))/i

const ENTITIES = {
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	amp: '&',
	'#39': "'",
	'#039': "'",
}

// Single pass, so `&amp;lt;` correctly yields `&lt;` rather than `<`.
const decodeBasicEntities = (text) =>
	text.replace(
		/&(lt|gt|quot|apos|amp|#0?39);/gi,
		(match, name) => ENTITIES[name.toLowerCase()] ?? match
	)

export const isYouTubeId = (value) =>
	typeof value === 'string' && YOUTUBE_ID.test(value)

export const extractYouTubeId = (url) => {
	if (typeof url !== 'string') return false

	const value = url.trim()
	if (!value) return false

	if (isYouTubeId(value)) return value

	let parsed
	try {
		parsed = new URL(value, 'https://www.youtube.com')
	} catch {
		return false
	}

	const host = parsed.hostname

	if (YOUTU_BE_HOST.test(host)) {
		const [id] = parsed.pathname.split('/').filter(Boolean)
		return isYouTubeId(id) ? id : false
	}

	if (!YOUTUBE_HOST.test(host)) return false

	const queryId = parsed.searchParams.get('v')
	if (isYouTubeId(queryId)) return queryId

	const segments = parsed.pathname.split('/').filter(Boolean)

	const marker = segments.findIndex((s) => ID_BEARING_SEGMENTS.includes(s))
	if (marker !== -1 && isYouTubeId(segments[marker + 1]))
		return segments[marker + 1]

	const last = segments[segments.length - 1]
	return isYouTubeId(last) ? last : false
}

export const extractVimeoId = (url) => {
	if (typeof url !== 'string') return false

	const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)
	if (!match) return false

	const hash = url.match(/[?&]h=([A-Za-z0-9]+)/)
	return hash ? `${match[1]}?h=${hash[1]}` : match[1]
}

export const iframeSrc = (html) => {
	if (typeof html !== 'string') return null

	const blob = html.match(IFRAME_BLOB)
	if (!blob) return null

	const match = decodeBasicEntities(blob[0]).match(SRC_ATTR)
	if (!match) return null

	return (match[1] || match[2] || match[3]).replace(/&amp;/g, '&')
}

export const videoFromIframe = (html) => {
	const src = iframeSrc(html)
	if (!src) return null

	const youtubeId = extractYouTubeId(src)
	if (youtubeId) return { provider: 'youtube', id: youtubeId, src }

	const vimeoId = extractVimeoId(src)
	if (vimeoId) return { provider: 'vimeo', id: vimeoId, src }

	return null
}

export const plyrPlayerHTML = (provider, id) =>
	`<div class="video-player rounded-md overflow-hidden border border-gray-100" data-plyr-provider="${provider}" data-plyr-embed-id="${id}" oncontextmenu="return false"></div>`

/**
 * Split html into the video embeds it contains and the copy around them, so a
 * caller can keep that copy instead of throwing the whole block away.
 * Iframes that aren't a supported video stay in the text parts.
 */
export const splitVideoIframes = (html) => {
	if (typeof html !== 'string' || !html) return []

	const parts = []
	let cursor = 0
	let match

	IFRAME_BLOB_ALL.lastIndex = 0
	while ((match = IFRAME_BLOB_ALL.exec(html)) !== null) {
		const video = videoFromIframe(match[0])
		if (!video) continue

		if (match.index > cursor)
			parts.push({ type: 'text', value: html.slice(cursor, match.index) })

		parts.push({ type: 'video', video })
		cursor = match.index + match[0].length
	}

	if (cursor < html.length)
		parts.push({ type: 'text', value: html.slice(cursor) })

	return parts
}

export const hasVideoIframe = (html) =>
	splitVideoIframes(html).some((part) => part.type === 'video')

export const replaceVideoIframes = (html) => {
	if (typeof html !== 'string') return html

	return html.replace(IFRAME_BLOB_ALL, (blob) => {
		const video = videoFromIframe(blob)
		return video ? plyrPlayerHTML(video.provider, video.id) : blob
	})
}
