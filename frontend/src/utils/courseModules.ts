import type { CourseModule, OutlineChapter, OutlineGroup } from '@/types/api'

/**
 * Fold a flat outline into module groups.
 *
 * The outline endpoint keeps returning a flat list of sessions (every existing
 * consumer depends on that shape); modules arrive separately and this is where
 * the two are joined. A course with no modules — or one whose sessions all
 * predate them — yields no groups at all, and callers then render the flat list
 * exactly as they always did.
 *
 * Sessions that belong to no module are collected into one trailing group so
 * a partly-organised course never hides content.
 */
export function groupChaptersByModule(
	chapters: OutlineChapter[] | null | undefined,
	modules: CourseModule[] | null | undefined,
	ungroupedTitle: string,
	keepEmpty = false
): OutlineGroup[] {
	if (!chapters?.length || !modules?.length) return []

	const groups = new Map<string | null, OutlineGroup>()
	for (const module of modules) {
		groups.set(module.name, {
			name: module.name,
			title: module.title,
			description: module.description,
			chapters: [],
			lessonCount: 0,
			completedCount: 0,
		})
	}

	const ungrouped: OutlineGroup = {
		name: null,
		title: ungroupedTitle,
		chapters: [],
		lessonCount: 0,
		completedCount: 0,
	}

	for (const chapter of chapters) {
		const group = (chapter.module && groups.get(chapter.module)) || ungrouped
		group.chapters.push(chapter)
		for (const lesson of chapter.lessons || []) {
			group.lessonCount += 1
			if (lesson.is_complete) group.completedCount += 1
		}
	}

	// An author needs an empty module to stay on screen — it is the drop target
	// for the sessions they are about to move into it. A learner would only see
	// noise, so for them empty groups are dropped.
	const ordered = keepEmpty
		? [...groups.values()]
		: [...groups.values()].filter((g) => g.chapters.length)
	if (ungrouped.chapters.length) ordered.push(ungrouped)
	return ordered
}

/** The module a lesson number (`chapter-lesson`) currently sits in. */
export function groupOfLesson(
	groups: OutlineGroup[],
	lessonNumber: string | null | undefined
): OutlineGroup | null {
	if (!lessonNumber) return null
	return (
		groups.find((group) =>
			group.chapters.some((chapter) =>
				chapter.lessons?.some((lesson) => lesson.number === lessonNumber)
			)
		) || null
	)
}

/** The module a session sits in, by session index (the `chapterNumber` in a URL). */
export function groupOfChapterIdx(
	groups: OutlineGroup[],
	chapterIdx: number | null | undefined
): OutlineGroup | null {
	if (!chapterIdx) return null
	return groups.find((g) => g.chapters.some((c) => c.idx === chapterIdx)) || null
}
