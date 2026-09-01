<template>
	<div v-if="chaptersOnly" class="flex items-center w-full p-2 border-b last:border-b-0">
		<div class="min-w-0 flex-1 text-start">
			<div
				class="truncate text-base font-medium leading-5 text-ink-gray-9"
				:title="displayTitle"
			>
				{{ displayTitle }}
			</div>
		</div>
	</div>
	<div v-else :key="chapter.name">
		<button
			type="button"
			class="flex items-center w-full p-2 group"
			@click="emit('toggle', chapter)"
		>
			<ChevronRight
				:class="{
					'rotate-90': isOpen,
					'rtl:rotate-180': !isOpen,
					hidden: chapter.is_scorm_package,
				}"
				class="size-4 text-ink-gray-9 stroke-1 transform duration-200"
			/>
			<div
				class="ms-2 min-w-0 flex-1 text-start"
				:class="inlineSelect ? '' : 'flex items-baseline justify-between gap-3'"
				@click="redirectToChapter"
			>
				<div class="flex items-center gap-2 min-w-0">
					<div
						class="truncate text-base font-medium leading-5 text-ink-gray-9"
						:title="displayTitle"
					>
						{{ displayTitle }}
					</div>
					<!-- Status is shown to editors only: a learner never receives a
					     draft session, so every session they can see is live and a
					     "Published" badge would be pure noise. -->
					<Badge
						v-if="allowEdit"
						:theme="isDraft ? 'orange' : 'green'"
						size="sm"
						class="shrink-0"
					>
						{{ isDraft ? __('Draft') : __('Published') }}
					</Badge>
				</div>
				<!-- Instructors under the session title. A session can have
				     several, so each name is its own click target: when we know
				     the username it opens that person's profile. @click.stop
				     keeps the click from toggling the chapter's disclosure. -->
				<div
					v-if="instructors.length"
					class="flex flex-wrap items-center gap-x-1 text-xs text-ink-gray-5 mt-0.5"
				>
					<template v-for="(instructor, i) in instructors" :key="instructor.name">
						<span v-if="i" aria-hidden="true">&middot;</span>
						<span
							class="truncate"
							:class="
								instructor.username
									? 'cursor-pointer hover:text-ink-gray-9 hover:underline'
									: ''
							"
							:title="
								instructor.username ? __('View instructor profile') : undefined
							"
							@click.stop="
								instructor.username && openInstructorProfile(instructor.username)
							"
						>
							{{ instructor.full_name || instructor.name }}
						</span>
					</template>
				</div>
			</div>
			<div class="flex ms-auto gap-x-4 shrink-0">
				<!-- Publishing is a one-click toggle rather than a modal field so a
				     new session can be released the moment it is ready. Unlike the
				     hover-only edit/delete icons this stays visible for drafts —
				     it is the action the editor is looking for. -->
				<Tooltip
					v-if="allowEdit"
					:text="isDraft ? __('Publish Session') : __('Move to Draft')"
					placement="bottom"
				>
					<component
						:is="isDraft ? Send : EyeOff"
						@click.stop.prevent="toggleStatus"
						class="size-4 stroke-1.5 cursor-pointer"
						:class="
							isDraft
								? 'text-ink-gray-9'
								: 'text-ink-gray-5 invisible group-hover:visible'
						"
					/>
				</Tooltip>
				<Tooltip :text="__('Edit Chapter')" placement="bottom">
					<span
						v-if="allowEdit"
						@click.prevent="emit('edit-chapter', chapter)"
						class="lucide-file-pen-line size-4 text-ink-gray-9 invisible group-hover:visible"
					/>
				</Tooltip>
				<Tooltip :text="__('Delete Chapter')" placement="bottom">
					<span
						v-if="allowEdit"
						@click.prevent="emit('delete-chapter', chapter.name)"
						class="lucide-trash-2 size-4 text-ink-red-3 invisible group-hover:visible"
					/>
				</Tooltip>
			</div>
			<span
				v-if="chapter.is_scorm_package && isScormChapterComplete"
				class="lucide-check size-4 text-green-700"
			/>
		</button>
		<div v-if="!chapter.is_scorm_package" v-show="isOpen">
			<Draggable
				:list="chapter.lessons"
				:disabled="!allowEdit"
				item-key="name"
				group="items"
				@end="(e: DraggableEvent) => emit('move-lesson', e)"
				:data-chapter="chapter.name"
			>
				<template #item="{ element: lesson }">
					<div
						class="outline-lesson ps-8 py-2 pe-4 text-ink-gray-9"
						:class="isActiveLesson(lesson.number) ? 'bg-surface-gray-3' : ''"
					>
						<component
							:is="inlineSelect || lesson.is_locked || isLessonLocked ? 'div' : 'router-link'"
							:to="
								inlineSelect || lesson.is_locked || isLessonLocked
									? undefined
									: lessonRoute(lesson)
							"
							:class="[
								inlineSelect ? 'cursor-pointer' : '',
								lesson.is_locked || isLessonLocked ? 'cursor-not-allowed opacity-60' : '',
							]"
							@click="onLessonClick(lesson)"
						>
							<div class="flex items-center text-sm leading-5 group">
								<MonitorPlay
									v-if="lesson.icon === 'icon-youtube'"
									class="h-4 w-4 stroke-1 me-2"
								/>
								<HelpCircle
									v-else-if="lesson.icon === 'icon-quiz'"
									class="h-4 w-4 stroke-1 me-2"
								/>
								<NotebookPen
									v-else-if="lesson.icon === 'icon-assignment'"
									class="h-4 w-4 stroke-1 me-2"
								/>
								<SquareCode
									v-else-if="lesson.icon === 'icon-code'"
									class="h-4 w-4 stroke-1 me-2"
								/>
								<FileText
									v-else-if="lesson.icon === 'icon-list'"
									class="h-4 w-4 text-ink-gray-9 stroke-1 me-2"
								/>
								{{ lesson.title }}
								<div v-if="allowEdit" class="ms-auto flex items-center gap-2">
									<Tooltip :text="__('Edit lesson')" placement="bottom">
										<FilePenLine
											@click.prevent="emit('edit-lesson', { chapter, lesson })"
											class="h-4 w-4 text-ink-gray-9 invisible group-hover:visible"
										/>
									</Tooltip>
									<Trash2
										@click.prevent="
											emit('delete-lesson', {
												lesson: lesson.name,
												chapter: chapter.name,
											})
										"
										class="h-4 w-4 text-ink-red-3 invisible group-hover:visible"
									/>
								</div>
								<LockKeyhole
									v-if="lesson.is_locked || isLessonLocked"
									class="h-4 w-4 text-ink-gray-5 ms-auto"
								/>
								<Check
									v-else-if="lesson.is_complete"
									class="h-4 w-4 text-green-700 ms-2"
								/>
							</div>
						</component>
					</div>
				</template>
			</Draggable>
			<div v-if="allowEdit" class="flex mt-2 mb-4 ps-8">
				<Button @click="addLesson">
					{{ __('Add Lesson') }}
				</Button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Badge, Button, Tooltip, toast } from 'frappe-ui'
import { computed, inject } from 'vue'
import Draggable from 'vuedraggable'
import {
	Check,
	ChevronRight,
	EyeOff,
	FilePenLine,
	FileText,
	HelpCircle,
	LockKeyhole,
	MonitorPlay,
	NotebookPen,
	Send,
	SquareCode,
	Trash2,
} from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import type {
	ChapterStatus,
	OutlineChapter,
	OutlineLesson,
	SessionInstructor,
	SessionUser,
} from '@/types/api'

interface DraggableEvent {
	item: { __draggable_context: { element: OutlineChapter | OutlineLesson } }
	from: { dataset: { chapter: string } }
	to: { dataset: { chapter: string } }
	newIndex: number
}

const props = withDefaults(
	defineProps<{
		chapter: OutlineChapter
		index: number
		courseName: string
		allowEdit?: boolean
		inlineSelect?: boolean
		editorLinks?: boolean
		selectedLessonNumber?: string
		chaptersOnly?: boolean
		isEnrolled?: boolean
		relabelChapters?: boolean
		// Whether this session is expanded. Controlled by the parent
		// (CourseOutline) so it can enforce single-open accordion behaviour and
		// so an outline reload never silently re-expands a collapsed session.
		isOpen?: boolean
	}>(),
	{
		allowEdit: false,
		inlineSelect: false,
		editorLinks: false,
		selectedLessonNumber: '',
		chaptersOnly: false,
		isEnrolled: true,
		relabelChapters: false,
		isOpen: false,
	}
)

// Ecological Society: on the Course Home outline, present chapters as
// "Session N" without renaming the stored data. Only a leading "Chapter"
// token is swapped, so author-named chapters (e.g. "Test Integration") are
// left untouched. Scoped via a prop so the in-lesson sidebar keeps "Chapter".
const displayTitle = computed<string>(() =>
	props.relabelChapters
		? props.chapter.title.replace(/^Chapter\b/i, 'Session')
		: props.chapter.title
)

// Sessions taught by more than one person list every instructor. An outline
// fetched before this feature (or a session with nobody assigned) simply has
// no names to show.
const instructors = computed<SessionInstructor[]>(
	() => props.chapter.instructors ?? []
)

// Lock all lessons for unenrolled non-editor users
const isLessonLocked = computed<boolean>(() => !props.isEnrolled && !props.allowEdit)

const emit = defineEmits<{
	'select-lesson': [{ chapterNumber: string; lessonNumber: string }]
	'edit-chapter': [OutlineChapter]
	'delete-chapter': [string]
	'set-chapter-status': [{ chapter: string; status: ChapterStatus }]
	'delete-lesson': [{ lesson: string; chapter: string }]
	'move-lesson': [DraggableEvent]
	'add-lesson': [{ chapter: OutlineChapter; lessonIdx: number }]
	'edit-lesson': [{ chapter: OutlineChapter; lesson: OutlineLesson }]
	toggle: [OutlineChapter]
}>()

const route = useRoute()
const router = useRouter()
const user = inject<SessionUser>('$user')!

// A chapter saved before the draft/publish feature has no status and is live,
// so only an explicit 'Draft' counts as held back — mirrors `is_draft_chapter`
// on the server.
const isDraft = computed<boolean>(() => props.chapter.status === 'Draft')

function toggleStatus() {
	emit('set-chapter-status', {
		chapter: props.chapter.name,
		status: isDraft.value ? 'Published' : 'Draft',
	})
}

const isScormChapterComplete = computed<boolean>(() =>
	Boolean(
		props.chapter.lessons?.length &&
			props.chapter.lessons.every((l) => l.is_complete)
	)
)

function isActiveLesson(lessonNumber: string): boolean {
	if (props.inlineSelect) return props.selectedLessonNumber === lessonNumber
	return (
		route.params.chapterNumber == lessonNumber.split('-')[0] &&
		route.params.lessonNumber == lessonNumber.split('-')[1]
	)
}

// Admins (editorLinks) deep-link into the in-page editor; everyone else
// opens the student view.
function lessonRoute(lesson: OutlineLesson): RouteLocationRaw {
	const [chapterNumber, lessonNumber] = lesson.number.split('-')
	if (props.editorLinks) {
		return {
			name: 'CourseDetail',
			params: { courseName: props.courseName },
			hash: '#course editor',
			query: { editLesson: lesson.number, lessonMode: 'edit' },
		}
	}
	return {
		name: 'Lesson',
		params: { courseName: props.courseName, chapterNumber, lessonNumber },
	}
}

function onLessonClick(lesson: OutlineLesson) {
	// Locked lessons render as a non-navigable div; tell the learner why it
	// can't be opened instead of silently swallowing the click.
	if (lesson.is_locked) {
		toast.warning(__('Please complete the previous lesson to unlock this one.'))
		return
	}
	if (isLessonLocked.value) {
		toast.warning(__('Please enroll for this course to view this lesson'))
		return
	}
	if (!props.inlineSelect) return
	emit('select-lesson', {
		chapterNumber: lesson.number.split('-')[0],
		lessonNumber: lesson.number.split('-')[1],
	})
}

function addLesson() {
	emit('add-lesson', {
		chapter: props.chapter,
		lessonIdx: (props.chapter.lessons?.length ?? 0) + 1,
	})
}

function openInstructorProfile(username: string) {
	router.push({ name: 'Profile', params: { username } })
}

function redirectToChapter() {
	if (!props.chapter.is_scorm_package) return
	;(event as Event | undefined)?.preventDefault()
	if (props.allowEdit) return
	if (!user.data) {
		toast.success(__('Please enroll for this course to view this lesson'))
		return
	}
	router.push({
		name: 'SCORMChapter',
		params: {
			courseName: props.courseName,
			chapterName: props.chapter.name,
		},
	})
}
</script>
