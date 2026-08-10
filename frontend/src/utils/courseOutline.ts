import { getCachedResource } from 'frappe-ui'

const outlineCacheKeys = (course: string): string[][] => [
	['course_outline', course],
	['course_outline_student', course, 'progress'],
	['course_outline_student', course, 'no-progress'],
	['course_modules', course],
]

const openSessions = new Map<string, string | null>()

export function rememberOpenSession(key: string, chapter: string | null): void {
	openSessions.set(key, chapter)
}

export function recallOpenSession(key: string): string | null | undefined {
	return openSessions.get(key)
}

export function reloadCourseOutlines(course?: string | null): void {
	if (!course) return
	for (const key of outlineCacheKeys(course)) {
		const resource = getCachedResource(key) as { reload?: () => void } | null
		resource?.reload?.()
	}
}
