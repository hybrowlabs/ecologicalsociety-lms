import type { Ref } from 'vue'
import type { LMSCourse } from './lms/LMSCourse'

export interface Resource<T = unknown> {
	data: T
	loading: boolean
	error: unknown
	doc?: T
	hasNextPage?: boolean
	reload(): void
	fetch(): void
	next?(): void
	submit(params?: unknown, opts?: unknown): void
	update(opts: unknown): void
	setValue: { submit(values: unknown, opts?: unknown): void }
}

export interface UserInfo {
	name: string
	full_name?: string
	first_name?: string
	last_name?: string
	email?: string
	username?: string
	user_image?: string
	open_to?: 'Work' | 'Hiring' | string
}

export interface SessionUser {
	data?: UserInfo & {
		is_moderator?: boolean
		is_instructor?: boolean
		is_student?: boolean
		is_system_manager?: boolean
	}
}

export interface CourseInstructorInfo extends UserInfo {
	instructor?: string
	bio?: string | null
}

export interface Membership {
	name?: string
	member?: string
	progress?: number
	current_lesson?: string
	purchased_certificate?: 0 | 1 | boolean
	certificate?: string
}

export interface CourseDetails
	extends Omit<LMSCourse, 'instructors' | 'rating'> {
	price?: string
	current_lesson?: string
	first_unlocked_lesson?: string
	instructors: CourseInstructorInfo[]
	membership?: Membership | null
	rating?: string
	rating_count?: number
	quiz_count?: number
}

export interface CourseReviewInfo {
	name: string
	creation: string
	rating: number
	review?: string
	owner_details: UserInfo
}

export interface OutlineLesson {
	name: string
	title: string
	number: string
	icon?: string
	is_complete?: boolean
	include_in_preview?: boolean | 0 | 1
	is_locked?: boolean
}

export type ChapterStatus = 'Draft' | 'Published'

export interface OutlineChapter {
	name: string
	title: string
	idx: number
	// Only editors ever receive a 'Draft' chapter — the API filters them out
	// of a learner's outline entirely.
	status?: ChapterStatus
	// The module this session is grouped under. Null/absent on a course that
	// has never been organised into modules — the outline then stays flat.
	module?: string | null
	is_scorm_package?: 0 | 1
	scorm_package?: { file_name: string; file_size: number } | null
	lessons?: OutlineLesson[]
	// A session can be taught by several people; empty when none are assigned.
	instructors?: SessionInstructor[]
}

/** A user assigned to teach a session, as returned with the course outline. */
export interface SessionInstructor {
	name: string
	username?: string | null
	full_name?: string | null
	user_image?: string | null
}

export interface CourseModule {
	name: string
	title: string
	description?: string | null
	idx: number
}

/**
 * A module and the sessions inside it, as rendered in the outline. The trailing
 * group of sessions that belong to no module is represented with `name: null`.
 */
export interface OutlineGroup {
	name: string | null
	title: string
	description?: string | null
	chapters: OutlineChapter[]
	lessonCount: number
	completedCount: number
}

export interface CertificationInfo {
	certificate?: { name: string; template: string } | null
	membership?: {
		purchased_certificate?: 0 | 1
		certificate?: string
	} | null
	paid_certificate?: 0 | 1
}

export interface ChapterDetailInput {
	name?: string
	title?: string
	is_scorm_package?: 0 | 1
	scorm_package?: { file_name: string; file_size: number } | null
	instructors?: SessionInstructor[]
	status?: ChapterStatus
}

export interface CourseFormMeta {
	description: string
	keywords: string
}

export interface CourseFormContext {
	resource: Resource<LMSCourse | null>
	instructors: Ref<string[]>
	relatedCourses: Ref<string[]>
	meta: CourseFormMeta
	markDirty: () => void
}
