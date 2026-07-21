
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
			
			if (doc?.body && 'ResizeObserver' in window) {
				const ro = new ResizeObserver(resize)
				ro.observe(doc.body)
				if (doc.documentElement) ro.observe(doc.documentElement)
			}
			if (doc?.body && 'MutationObserver' in window) {
				new MutationObserver(resize).observe(doc.body, {
					childList: true,
					subtree: true,
					attributes: true,
				})
			}
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
