const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const ID_BEARING_SEGMENTS = ['embed', 'v', 'e', 'shorts', 'live']
const YOUTUBE_HOST = /(^|\.)youtube(-nocookie)?\.com$/
const YOUTU_BE_HOST = /(^|\.)youtu\.be$/
const IFRAME_SRC =
	/<iframe\b[^>]*?\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/i
const IFRAME_TAG = /<iframe\b[^>]*>(?:[\s\S]*?<\/iframe>)?/gi

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

	const match = html.match(IFRAME_SRC)
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

export const replaceVideoIframes = (html) => {
	if (typeof html !== 'string') return html

	return html.replace(IFRAME_TAG, (tag) => {
		const video = videoFromIframe(tag)
		return video ? plyrPlayerHTML(video.provider, video.id) : tag
	})
}
