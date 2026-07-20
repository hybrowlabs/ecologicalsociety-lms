// Preview (readOnly) lessons embed the quiz and assignment pages in an iframe.
// These used to be given a fixed height (h-[700px] / h-[950px]), which left a
// tall blank gap below short content — most visibly between a quiz's "Start"
// block and the assignment that follows it. Since the iframe is same-origin we
// can measure its content and size the frame to fit, so blocks sit flush and
// the outer page does the scrolling.
export function makeAutoResizeIframe(src, { minHeight = 200 } = {}) {
	const iframe = document.createElement('iframe')
	iframe.src = src
	iframe.className = 'w-full'
	iframe.style.height = `${minHeight}px`
	iframe.style.border = 'none'
	iframe.setAttribute('scrolling', 'no')

	const resize = () => {
		try {
			const doc = iframe.contentDocument || iframe.contentWindow?.document
			if (!doc?.body) return
			const height = Math.max(
				doc.body.scrollHeight,
				doc.documentElement?.scrollHeight || 0
			)
			if (height) iframe.style.height = `${height}px`
		} catch (e) {
			// Cross-origin frame — keep the initial height, nothing we can do.
		}
	}

	iframe.addEventListener('load', () => {
		resize()
		try {
			const doc = iframe.contentDocument || iframe.contentWindow?.document
			// The embedded quiz/assignment fetches its data after mount and can
			// grow (e.g. when the learner clicks "Start"), so keep tracking.
			if (doc?.body && 'ResizeObserver' in window) {
				new ResizeObserver(resize).observe(doc.body)
			}
			// Fallback for late layout shifts the observer may miss (images,
			// fonts, async renders) — poll briefly, then stop.
			let ticks = 0
			const timer = setInterval(() => {
				resize()
				if (++ticks > 20) clearInterval(timer)
			}, 300)
		} catch (e) {
			// Cross-origin — ignore.
		}
	})

	return iframe
}
