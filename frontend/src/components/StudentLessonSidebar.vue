<template>
	<div class="flex flex-col h-full">
		<div class="bg-surface-gray-1 px-5 py-5 border-b">
			<div class="text-lg font-semibold text-ink-gray-9 leading-snug">
				{{ courseTitle }}
			</div>
			<div class="mt-4 flex items-center gap-2 text-sm text-ink-gray-7">
				<Cloud class="size-4 stroke-1.5" />
				<span>{{ displayedProgress >= 100 ? __('Completed') : __('In Progress') }}</span>
			</div>
			<div
				class="h-1 w-full rounded-full bg-surface-gray-2 overflow-hidden mt-2"
			>
				<div
					class="h-full bg-surface-green-3 transition-all"
					:style="{ width: `${displayedProgress}%` }"
				/>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto px-2 py-3">
			<template v-for="group in renderGroups" :key="group.key">
				<!-- Module header. Present only once a course has been organized into
				     modules; otherwise `renderGroups` is a single headerless group and
				     this sidebar looks exactly as it did before. -->
				<button
					v-if="group.isModule"
					type="button"
					class="w-full flex items-center gap-2 rounded px-3 py-2 mt-1 text-left hover:bg-surface-gray-2"
					:class="group.name === currentModule ? 'bg-surface-gray-2' : ''"
					@click="toggleModule(group.name)"
				>
					<ChevronDown
						class="size-4 stroke-1.5 shrink-0 transition-transform"
						:class="{ '-rotate-90': openModule !== group.name }"
					/>
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-semibold text-ink-gray-9">
							{{ group.title }}
						</div>
						<div class="text-xs text-ink-gray-5 mt-0.5">
							<template v-if="withProgress">
								{{ group.completedCount }}/{{ group.lessonCount }}
								{{ __('lessons complete') }}
							</template>
							<template v-else>
								{{ group.chapters.length }} {{ __('sessions') }}
							</template>
						</div>
					</div>
				</button>
				<div
					v-show="!group.isModule || openModule === group.name"
					:class="group.isModule ? 'ps-2' : ''"
				>
			<div v-for="chapter in group.chapters" :key="chapter.name">
				<!-- Accordion: exactly one session is expanded at a time. Clicking a
				     collapsed session opens it and closes the previous one; clicking
				     the open session collapses it and it stays collapsed (no session
				     silently re-expands on outline reloads). -->
				<button
					type="button"
					class="w-full flex items-center justify-between rounded px-3 py-2 hover:bg-surface-gray-2 text-left"
					@click="toggleChapter(chapter.name)"
				>
					<div
						class="flex items-center gap-2 text-sm font-medium text-ink-gray-9 min-w-0"
					>
						<ChevronDown
							class="size-4 stroke-1.5 shrink-0 transition-transform"
							:class="{ '-rotate-90': openChapter !== chapter.name }"
						/>
						<span class="truncate">{{ chapter.title }}</span>
					</div>
				</button>
				<div v-show="openChapter === chapter.name">
					<component
						:is="inlineSelect || lesson.is_locked ? 'div' : 'router-link'"
						v-for="lesson in chapter.lessons || []"
						:key="lesson.name"
						:to="
							inlineSelect || lesson.is_locked
								? undefined
								: {
										name: 'Lesson',
										params: {
											courseName,
											chapterNumber: lesson.number.split('-')[0],
											lessonNumber: lesson.number.split('-')[1],
										},
								  }
						"
						class="flex items-center gap-3 rounded ps-9 pe-3 py-2 text-sm text-ink-gray-8 hover:bg-surface-gray-2"
						:class="[
							inlineSelect ? 'cursor-pointer' : '',
							lesson.is_locked
								? 'opacity-60 cursor-not-allowed hover:bg-transparent'
								: '',
							isActive(lesson.number)
								? 'bg-surface-gray-2 text-ink-gray-9'
								: '',
						]"
						@click="onLessonClick(lesson)"
					>
						<component
							:is="iconFor(lesson.icon)"
							class="size-4 stroke-1.5 shrink-0 text-ink-gray-7"
						/>
						<span class="truncate flex-1">{{ lesson.title }}</span>
						<LockKeyhole
							v-if="lesson.is_locked"
							class="size-4 stroke-1.5 shrink-0 text-ink-gray-5"
						/>
						<CircleCheck
							v-else-if="lesson.is_complete"
							class="size-4 stroke-1.5 shrink-0 text-green-700 fill-none"
						/>
						<Circle v-else class="size-4 stroke-1.5 shrink-0 text-ink-gray-4" />
					</component>
				</div>
			</div>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, watch, watchEffect } from 'vue'
import { createResource, toast } from 'frappe-ui'
import {
	ChevronDown,
	Circle,
	CircleCheck,
	Cloud,
	FileText,
	HelpCircle,
	LockKeyhole,
	MonitorPlay,
	NotebookPen,
	SquareCode,
} from 'lucide-vue-next'
import { groupChaptersByModule, groupOfLesson } from '@/utils/courseModules'

const props = defineProps({
	courseName: { type: String, required: true },
	courseTitle: { type: String, default: '' },
	progress: { type: Number, default: 0 },
	selectedLessonNumber: { type: String, default: '' },
	completedLesson: { type: String, default: null },
	inlineSelect: { type: Boolean, default: false },
	withProgress: { type: Boolean, default: true },
	// Bumped by the parent (Lesson.vue) on a server-confirmed progress change —
	// e.g. a quiz result arriving over the `update_lesson_progress` socket event.
	// A quiz *pass* unlocks the next lesson, but `is_locked` is computed
	// server-side, so we must re-fetch rather than mutate locally. A quiz *fail*
	// fires the same event, so this only reloads (authoritative) and never marks.
	refreshSignal: { type: Number, default: 0 },
})

const emit = defineEmits(['select-lesson'])

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: [
		'course_outline_student',
		props.courseName,
		props.withProgress ? 'progress' : 'no-progress',
	],
	makeParams() {
		return {
			course: props.courseName,
			progress: props.withProgress,
		}
	},
	auto: true,
})

const modules = createResource({
	url: 'lms.lms.utils.get_course_modules',
	cache: ['course_modules', props.courseName],
	makeParams() {
		return { course: props.courseName }
	},
	auto: true,
})

watch(
	() => props.courseName,
	() => {
		outline.reload()
		modules.reload()
	}
)

const groups = computed(() =>
	groupChaptersByModule(outline.data, modules.data, __('Other Sessions'))
)

// One shape for the template whether or not this course uses modules: with no
// modules it is a single headerless group holding every session, which renders
// identically to how this sidebar looked before modules existed.
const renderGroups = computed(() => {
	if (!groups.value.length) {
		return [
			{
				key: '__flat__',
				isModule: false,
				name: null,
				title: '',
				chapters: outline.data || [],
				lessonCount: 0,
				completedCount: 0,
			},
		]
	}
	return groups.value.map((group) => ({
		...group,
		key: group.name ?? '__ungrouped__',
		isModule: true,
	}))
})

// The module holding the lesson being viewed — highlighted so a learner always
// knows where they are in a course with dozens of sessions.
const currentModule = computed(() => {
	const group = groupOfLesson(groups.value, props.selectedLessonNumber)
	return group ? group.name : undefined
})

// Only one module is expanded at a time; opening another collapses it.
const openModule = ref(null)
let moduleInitialized = false

function toggleModule(name) {
	openModule.value = openModule.value === name ? null : name
}

watch(
	[groups, currentModule],
	([list, current]) => {
		if (!list.length) return
		// Seed once on the module holding the current lesson, then follow the
		// learner as they navigate into a different module.
		if (!moduleInitialized) {
			moduleInitialized = true
			openModule.value = current !== undefined ? current : list[0].name
			return
		}
		if (current !== undefined && current !== openModule.value) {
			openModule.value = current
		}
	},
	{ immediate: true }
)

// Completing a lesson can unlock the next one, but `is_locked` is derived
// server-side (sequential prerequisite locking), so re-fetch the outline to
// pull the fresh lock state instead of relying on a manual page refresh. The
// optimistic `is_complete` flip below keeps the current lesson's tick instant
// while this reload is in flight.
watch(
	() => props.completedLesson,
	(lessonName) => {
		if (lessonName) outline.reload()
	}
)

// A server-confirmed progress change (e.g. a quiz result) may have unlocked the
// next lesson. Reload authoritatively — never optimistically mark — because a
// failed quiz raises the same signal.
watch(
	() => props.refreshSignal,
	() => outline.reload()
)

// Re-runs whenever either source updates so a completion event that
// lands before outline.data finishes loading still gets applied (and a
// late-arriving outline reload doesn't wipe an already-marked lesson).
watchEffect(() => {
	const lessonName = props.completedLesson
	if (!lessonName || !outline.data) return
	for (const chapter of outline.data) {
		const found = chapter.lessons?.find((l) => l.name === lessonName)
		if (found) {
			found.is_complete = true
			return
		}
	}
})

const displayedProgress = computed(() => Math.ceil(props.progress || 0))

// A locked lesson renders as a non-navigable div; clicking it used to do
// nothing silently. Surface *why* it can't be opened so the learner knows to
// finish the earlier lesson first (sequential prerequisite locking, feature 2).
function onLessonClick(lesson) {
	if (lesson.is_locked) {
		toast.warning(
			__('Please complete the previous lesson to unlock this one.')
		)
		return
	}
	if (props.inlineSelect) {
		emit('select-lesson', {
			chapterNumber: lesson.number.split('-')[0],
			lessonNumber: lesson.number.split('-')[1],
		})
	}
}

function iconFor(icon) {
	switch (icon) {
		case 'icon-youtube':
			return MonitorPlay
		case 'icon-quiz':
			return HelpCircle
		case 'icon-assignment':
			return NotebookPen
		case 'icon-code':
			return SquareCode
		case 'icon-lock':
			return LockKeyhole
		default:
			return FileText
	}
}

function isActive(number) {
	return props.selectedLessonNumber === number
}

// Accordion open-state: the name of the single expanded chapter (or null when
// every session is collapsed). Controlled here — rather than relying on an
// uncontrolled Disclosure `defaultOpen` — so an outline reload can never
// silently re-expand a session the user just collapsed.
const openChapter = ref(null)
let initialized = false

function chapterOf(lessonNumber) {
	if (!lessonNumber || !outline.data) return null
	return (
		outline.data.find((c) =>
			c.lessons?.some((l) => l.number === lessonNumber)
		) || null
	)
}

function toggleChapter(name) {
	// Clicking the open session collapses it (and it stays collapsed); clicking
	// any other session opens it and closes the previously expanded one.
	openChapter.value = openChapter.value === name ? null : name
}

// Seed the open session once, when the outline first loads: the session that
// holds the current lesson, otherwise the first session.
watch(
	() => outline.data,
	(data) => {
		if (!data || initialized) return
		initialized = true
		openChapter.value =
			chapterOf(props.selectedLessonNumber)?.name ?? data[0]?.name ?? null
	},
	{ immediate: true }
)

// Navigating to a lesson in a different session expands that session (so the
// learner sees where they are). Staying on the same lesson — e.g. a plain
// outline reload — does not fire this, so a manual collapse is preserved.
watch(
	() => props.selectedLessonNumber,
	(number) => {
		const chapter = chapterOf(number)
		if (chapter) openChapter.value = chapter.name
	}
)
</script>
