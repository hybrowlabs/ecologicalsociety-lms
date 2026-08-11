import { describe, it, expect } from 'vitest'
import {
	extractYouTubeId,
	extractVimeoId,
	iframeSrc,
	videoFromIframe,
	replaceVideoIframes,
	splitVideoIframes,
	hasVideoIframe,
} from '@/utils/youtube'

const ATTRS = `width="560" height="315" src="https://www.youtube.com/embed/v6lcahOt_II?si=rdGCxpxe3bA8YVhN" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen`

const REPORTED_IFRAME = `<iframe ${ATTRS}></iframe>`

// What the lessons on the site actually hold: the opening "<" is gone and the
// rest of the snippet survived as text.
const HEADLESS_IFRAME = `iframe ${ATTRS}></iframe>`

// The same snippet as a contenteditable serialises it after a plain-text paste.
const ESCAPED_IFRAME = `&lt;iframe ${ATTRS}&gt;&lt;/iframe&gt;`

const HEADLESS_ESCAPED_IFRAME = `iframe ${ATTRS}&gt;&lt;/iframe&gt;`

describe('extractYouTubeId', () => {
	it('handles ids that start with "v"', () => {
		expect(
			extractYouTubeId(
				'https://www.youtube.com/embed/v6lcahOt_II?si=rdGCxpxe3bA8YVhN'
			)
		).toBe('v6lcahOt_II')
		expect(extractYouTubeId('https://youtu.be/v6lcahOt_II')).toBe(
			'v6lcahOt_II'
		)
		expect(
			extractYouTubeId('https://www.youtube.com/watch?v=v6lcahOt_II')
		).toBe('v6lcahOt_II')
	})

	it('handles every url shape', () => {
		const cases = {
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ': 'dQw4w9WgXcQ',
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s': 'dQw4w9WgXcQ',
			'https://www.youtube.com/embed/dQw4w9WgXcQ': 'dQw4w9WgXcQ',
			'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10': 'dQw4w9WgXcQ',
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ': 'dQw4w9WgXcQ',
			'https://youtu.be/dQw4w9WgXcQ?si=abc': 'dQw4w9WgXcQ',
			'https://www.youtube.com/shorts/dQw4w9WgXcQ': 'dQw4w9WgXcQ',
			'https://www.youtube.com/live/dQw4w9WgXcQ': 'dQw4w9WgXcQ',
			'https://www.youtube.com/v/dQw4w9WgXcQ': 'dQw4w9WgXcQ',
			'https://www.youtube.com/u/1/dQw4w9WgXcQ': 'dQw4w9WgXcQ',
			'//www.youtube.com/embed/dQw4w9WgXcQ': 'dQw4w9WgXcQ',
			dQw4w9WgXcQ: 'dQw4w9WgXcQ',
		}

		for (const [url, id] of Object.entries(cases)) {
			expect(extractYouTubeId(url), url).toBe(id)
		}
	})

	it('rejects anything that is not a youtube video', () => {
		const rejected = [
			'https://player.vimeo.com/video/76979871',
			'https://example.com/embed/dQw4w9WgXcQ',
			'https://www.youtube.com/@somechannel',
			'https://www.youtube.com/embed/tooshort',
			'',
			null,
			undefined,
			42,
		]

		for (const value of rejected) {
			expect(extractYouTubeId(value), String(value)).toBe(false)
		}
	})
})

describe('extractVimeoId', () => {
	it('reads plain and private urls', () => {
		expect(extractVimeoId('https://player.vimeo.com/video/76979871')).toBe(
			'76979871'
		)
		expect(extractVimeoId('https://vimeo.com/76979871')).toBe('76979871')
		expect(
			extractVimeoId(
				'https://player.vimeo.com/video/76979871?h=8272103f6e'
			)
		).toBe('76979871?h=8272103f6e')
		expect(extractVimeoId('https://example.com/video/1')).toBe(false)
	})
})

describe('iframeSrc', () => {
	it('reads double, single and unquoted srcs', () => {
		expect(iframeSrc(REPORTED_IFRAME)).toBe(
			'https://www.youtube.com/embed/v6lcahOt_II?si=rdGCxpxe3bA8YVhN'
		)
		expect(
			iframeSrc(`<iframe src='https://youtu.be/dQw4w9WgXcQ'></iframe>`)
		).toBe('https://youtu.be/dQw4w9WgXcQ')
		expect(
			iframeSrc('<iframe src=https://youtu.be/dQw4w9WgXcQ></iframe>')
		).toBe('https://youtu.be/dQw4w9WgXcQ')
		expect(iframeSrc('no iframe here')).toBe(null)
	})

	it('undoes entity-encoded query separators', () => {
		expect(
			iframeSrc(
				'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?start=1&amp;end=9"></iframe>'
			)
		).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=1&end=9')
	})
})

describe('videoFromIframe', () => {
	it('identifies the reported iframe', () => {
		expect(videoFromIframe(REPORTED_IFRAME)).toMatchObject({
			provider: 'youtube',
			id: 'v6lcahOt_II',
		})
	})

	it('identifies vimeo', () => {
		expect(
			videoFromIframe(
				'<iframe src="https://player.vimeo.com/video/76979871">'
			)
		).toMatchObject({ provider: 'vimeo', id: '76979871' })
	})

	it('leaves unrelated iframes alone', () => {
		expect(videoFromIframe('<iframe src="https://example.com/app">')).toBe(
			null
		)
	})
})

describe('replaceVideoIframes', () => {
	it('swaps the iframe for a plyr container', () => {
		const html = replaceVideoIframes(REPORTED_IFRAME)
		expect(html).toContain('data-plyr-provider="youtube"')
		expect(html).toContain('data-plyr-embed-id="v6lcahOt_II"')
		expect(html).not.toContain('<iframe')
	})

	it('keeps the surrounding copy', () => {
		const html = replaceVideoIframes(
			`<p>Watch this</p>${REPORTED_IFRAME}<p>then answer.</p>`
		)
		expect(html).toContain('<p>Watch this</p>')
		expect(html).toContain('<p>then answer.</p>')
		expect(html).toContain('data-plyr-embed-id="v6lcahOt_II"')
	})

	it('leaves non-video iframes untouched', () => {
		const html = '<iframe src="https://example.com/form"></iframe>'
		expect(replaceVideoIframes(html)).toBe(html)
	})

	it('leaves prose that merely mentions iframes alone', () => {
		const html = '<p>An iframe is how you embed a video &gt; a link.</p>'
		expect(replaceVideoIframes(html)).toBe(html)
	})
})

describe('mangled snippets', () => {
	const shapes = {
		'opening bracket eaten': HEADLESS_IFRAME,
		escaped: ESCAPED_IFRAME,
		'escaped with the opening bracket eaten': HEADLESS_ESCAPED_IFRAME,
	}

	for (const [name, snippet] of Object.entries(shapes)) {
		it(`reads the src out of a snippet that is ${name}`, () => {
			expect(iframeSrc(snippet)).toBe(
				'https://www.youtube.com/embed/v6lcahOt_II?si=rdGCxpxe3bA8YVhN'
			)
			expect(videoFromIframe(snippet)).toMatchObject({
				provider: 'youtube',
				id: 'v6lcahOt_II',
			})
		})

		it(`renders a player for a snippet that is ${name}`, () => {
			const html = replaceVideoIframes(snippet)
			expect(html).toContain('data-plyr-embed-id="v6lcahOt_II"')
			expect(html).not.toContain('iframe')
		})
	}
})

describe('splitVideoIframes', () => {
	it('keeps the copy on either side of the embed', () => {
		const parts = splitVideoIframes(
			`Watch this: ${HEADLESS_IFRAME} then answer.`
		)

		expect(parts.map((p) => p.type)).toEqual(['text', 'video', 'text'])
		expect(parts[0].value).toBe('Watch this: ')
		expect(parts[1].video).toMatchObject({ id: 'v6lcahOt_II' })
		expect(parts[2].value).toBe(' then answer.')
	})

	it('finds every embed in a block', () => {
		const parts = splitVideoIframes(
			`${REPORTED_IFRAME}${ESCAPED_IFRAME}`
		).filter((p) => p.type === 'video')

		expect(parts).toHaveLength(2)
	})

	it('reports blocks with no embed', () => {
		expect(hasVideoIframe('<p>just words</p>')).toBe(false)
		expect(hasVideoIframe('<iframe src="https://example.com"></iframe>')).toBe(
			false
		)
		expect(hasVideoIframe(HEADLESS_IFRAME)).toBe(true)
	})
})
