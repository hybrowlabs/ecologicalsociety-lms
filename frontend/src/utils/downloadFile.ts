/**
 * Fetch a file from a whitelisted method and trigger a browser download with
 * the server-supplied filename. Throws if the request fails.
 */
export async function downloadFile(
	url: string,
	fallbackFilename: string
): Promise<void> {
	const response = await fetch(url, { method: 'GET', credentials: 'include' })
	if (!response.ok) throw new Error('Download failed')
	const blob = await response.blob()
	const disposition = response.headers.get('Content-Disposition')
	let filename = fallbackFilename
	if (disposition && disposition.includes('filename=')) {
		filename = disposition.split('filename=')[1].replace(/"/g, '')
	}
	const objectUrl = window.URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = objectUrl
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	window.URL.revokeObjectURL(objectUrl)
}
