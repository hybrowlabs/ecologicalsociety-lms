<template>
	<div class="p-3 h-full">
		<div
			v-if="!hideHeader && title && (outline.data?.length || allowEdit)"
			class="flex items-center justify-between gap-x-2 mb-4 px-2"
			:class="{
				'sticky top-0 z-10 bg-surface-white border-b px-3 py-2.5 sm:px-5':
					allowEdit,
			}"
		>
			<div
				class="font-semibold text-lg leading-5 text-ink-gray-9"
				:class="{ 'font-medium text-p-base': allowEdit }"
			>
				{{ __(title) }}
			</div>
			<Button size="sm" v-if="allowEdit" @click="openChapterModal()">
				<template #prefix>
					<Plus class="size-4 stroke-1.5" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
		<div
			v-if="allowEdit && outline.data && !outline.data.length"
			class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-ink-gray-5 h-full"
		>
			<BookOpen class="size-8 stroke-1.5" />
			<div class="text-sm">{{ __('No sessions yet') }}</div>
			<Button @click="openChapterModal()">
				<template #prefix>
					<Plus class="size-4 stroke-1.5" />
				</template>
				{{ __('Create session') }}
			</Button>
		</div>
		<div
			v-else
			:class="{
				'border-2 rounded-md py-2 px-2': showOutline && outline.data?.length,
				'pb-48': allowEdit,
			}"
		>
			<!-- Grouped view: modules first, their sessions inside. A course with no
			     modules falls through to the flat list below and renders exactly as
			     it always has, so nothing about an existing course changes until
			     someone organizes it. -->
			<Draggable
				v-if="hasModules"
				:list="groups"
				:disabled="!allowEdit"
				:item-key="groupKey"
				handle=".module-drag-handle"
				group="modules"
				@end="updateModuleOrder"
			>
				<template #item="{ element: group }">
					<ModuleRow
						:group="group"
						:isOpen="openModules.has(group.name)"
						:allowEdit="allowEdit"
						:isUngrouped="!group.name"
						:isCurrent="isCurrentModule(group)"
						:showProgress="getProgress"
						@toggle="onToggleModule(group)"
						@edit="openModuleModal(group)"
						@delete="trashModule(group)"
					>
						<ChapterList
							v-bind="chapterProps"
							v-on="chapterHandlers"
							:chapters="group.chapters"
							:moduleName="group.name"
							@reorder="updateChapterPlacement"
						/>
						<div v-if="allowEdit && !group.chapters.length" class="px-3 py-4 text-sm text-ink-gray-5">
							{{ __('Drag sessions here to add them to this module.') }}
						</div>
					</ModuleRow>
				</template>
			</Draggable>
			<ChapterList
				v-else
				v-bind="chapterProps"
				v-on="chapterHandlers"
				:chapters="outline.data || []"
				:moduleName="null"
				@reorder="updateChapterOrder"
			/>
		</div>
	</div>
	<ModuleModal
		v-if="user.data"
		v-model="showModuleModal"
		:course="courseName"
		:moduleDetail="currentModule"
		@saved="onModuleSaved"
	/>
	<OrganizeModulesModal
		v-if="user.data"
		v-model="showOrganizeModal"
		:course="courseName"
		:ungroupedCount="ungroupedChapterCount"
		:totalCount="outline.data?.length || 0"
		:hasModules="hasModules"
		@organized="reloadOutline"
	/>
	<ChapterModal
		v-if="user.data"
		v-model="showChapterModal"
		v-model:outline="outline"
		:course="courseName"
		:chapterDetail="currentChapter"
	/>
	<LessonModal
		v-if="user.data && lessonContext"
		v-model:show="showLessonModal"
		:course="courseName"
		:chapterName="lessonContext.chapterName"
		:lessonIdx="lessonContext.lessonIdx"
		:lessonDetail="lessonContext.lessonDetail"
		@created="onLessonCreated"
		@updated="onLessonUpdated"
	/>
</template>

<script setup lang="ts">
import { Button, createResource, toast } from 'frappe-ui'
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Draggable from 'vuedraggable'
import { BookOpen, Plus } from 'lucide-vue-next'
import ChapterModal from '@/components/Modals/ChapterModal.vue'
import LessonModal from '@/components/Modals/LessonModal.vue'
import ModuleModal from '@/components/Modals/ModuleModal.vue'
import OrganizeModulesModal from '@/components/Modals/OrganizeModulesModal.vue'
import ChapterList from '@/components/ChapterList.vue'
import ModuleRow from '@/components/ModuleRow.vue'
import {
	groupChaptersByModule,
	groupOfChapterIdx,
	groupOfLesson,
} from '@/utils/courseModules'
import {
	recallOpenSession,
	reloadCourseOutlines,
	rememberOpenSession,
} from '@/utils/courseOutline'
import type {
	ChapterStatus,
	CourseModule,
	OutlineChapter,
	OutlineGroup,
	OutlineLesson,
	Resource,
	SessionUser,
} from '@/types/api'

interface DraggableEvent {
	item: {
		__draggable_context: { element: OutlineChapter | OutlineLesson | OutlineGroup }
	}
	from: { dataset: { chapter: string; module: string } }
	to: { dataset: { chapter: string; module: string } }
	newIndex: number
}

interface DialogAction {
	label: string
	theme?: string
	variant?: string
	onClick: (close: () => void) => void
}
type DialogFn = (opts: {
	title: string
	message: string
	actions: DialogAction[]
}) => void

import { getCurrentInstance } from 'vue'
const user = inject<SessionUser>('$user')!
const router = useRouter()
const route = useRoute()
const showChapterModal = ref<boolean>(false)
const currentChapter = ref<OutlineChapter | null>(null)
const { $dialog } = getCurrentInstance()!.appContext.config
	.globalProperties as unknown as {
	$dialog: DialogFn
}

const emit = defineEmits<{
	'select-lesson': [{ chapterNumber: string; lessonNumber: string }]
	'lesson-deleted': [string]
}>()

interface LessonModalContext {
	chapterName: string
	chapterIdx: number
	lessonIdx: number
	lessonDetail: {
		name?: string
		title?: string
		include_in_preview?: boolean | 0 | 1
	} | null
}

const showLessonModal = ref<boolean>(false)
const lessonContext = ref<LessonModalContext | null>(null)

function openLessonModalForAdd(payload: {
	chapter: OutlineChapter
	lessonIdx: number
}) {
	lessonContext.value = {
		chapterName: payload.chapter.name,
		chapterIdx: payload.chapter.idx,
		lessonIdx: payload.lessonIdx,
		lessonDetail: null,
	}
	showLessonModal.value = true
}

function openLessonModalForEdit(payload: {
	chapter: OutlineChapter
	lesson: OutlineLesson
}) {
	lessonContext.value = {
		chapterName: payload.chapter.name,
		chapterIdx: payload.chapter.idx,
		lessonIdx: Number(payload.lesson.number.split('-')[1]) || 1,
		lessonDetail: {
			name: payload.lesson.name,
			title: payload.lesson.title,
			include_in_preview: payload.lesson.include_in_preview,
		},
	}
	showLessonModal.value = true
}

function onLessonCreated(created: { name: string; number: string }) {
	reloadOutline()
	const ctx = lessonContext.value
	if (!ctx) return
	const chapterNumber = String(ctx.chapterIdx)
	const lessonNumber = created.number
	if (props.inlineSelect) {
		emit('select-lesson', { chapterNumber, lessonNumber })
		return
	}
	if (props.editorLinks) {
		router.push({
			name: 'CourseDetail',
			params: { courseName: props.courseName },
			hash: '#course editor',
			query: {
				editLesson: `${chapterNumber}-${lessonNumber}`,
				lessonMode: 'edit',
			},
		})
	}
}

function onLessonUpdated(_payload: { name: string }) {
	reloadOutline()
}

const props = withDefaults(
	defineProps<{
		courseName: string
		showOutline?: boolean
		title?: string
		allowEdit?: boolean
		getProgress?: boolean
		completedLesson?: string | null
		inlineSelect?: boolean
		editorLinks?: boolean
		selectedLessonNumber?: string
		hideHeader?: boolean
		isEnrolled?: boolean
		chaptersOnly?: boolean
		relabelChapters?: boolean
	}>(),
	{
		showOutline: false,
		title: '',
		allowEdit: false,
		getProgress: false,
		inlineSelect: false,
		editorLinks: false,
		selectedLessonNumber: '',
		completedLesson: null,
		hideHeader: false,
		isEnrolled: true,
		chaptersOnly: false,
		relabelChapters: false,
	}
)

defineExpose({ openChapterModal, openModuleModal, openOrganizeModal })

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline', props.courseName],
	makeParams() {
		return { course: props.courseName, progress: props.getProgress }
	},
	auto: true,
}) as Resource<OutlineChapter[] | null>

const modules = createResource({
	url: 'lms.lms.utils.get_course_modules',
	cache: ['course_modules', props.courseName],
	makeParams() {
		return { course: props.courseName }
	},
	auto: true,
}) as Resource<CourseModule[] | null>

watch(
	() => props.courseName,
	() => {
		outline.reload()
		modules.reload()
	}
)

function reloadOutline() {
	reloadCourseOutlines(props.courseName)
}

// The outline stays a flat list of sessions on the wire; the module grouping is
// folded in here. Held in a ref rather than a computed because vuedraggable
// mutates these arrays as you drag — the next reload rebuilds them from the
// server, which is the authoritative order.
const groups = ref<OutlineGroup[]>([])
watch(
	[() => outline.data, () => modules.data, () => props.allowEdit],
	() => {
		groups.value = groupChaptersByModule(
			outline.data,
			modules.data,
			__('Other Sessions'),
			props.allowEdit
		)
	},
	{ immediate: true, deep: true }
)

const hasModules = computed<boolean>(() => groups.value.length > 0)

// The ungrouped bucket has no module name, so it needs a stable stand-in key.
function groupKey(group: OutlineGroup): string {
	return group.name ?? '__ungrouped__'
}

const ungroupedChapterCount = computed<number>(
	() => (outline.data || []).filter((c) => !c.module).length
)

// Session expand/collapse is controlled here so an outline reload can never
// silently re-expand a session the user collapsed (the old per-row
// `defaultOpen` kept snapping Session 1 back open). Strict accordion — one
// session open at a time, in the editor as well as the read-only outline.
const openChapters = ref<Set<string>>(new Set())

// Survives a remount (switching the editor between edit and preview tears this
// component down), so a collapsed outline stays collapsed instead of falling
// back to the Session 1 default.
const sessionStateKey = computed<string>(
	() => `${props.courseName}::${props.allowEdit ? 'edit' : 'view'}`
)

function setOpenChapter(name: string | null) {
	openChapters.value = new Set(name ? [name] : [])
	rememberOpenSession(sessionStateKey.value, name)
}

function onToggleChapter(chapter: OutlineChapter) {
	const isOpen = openChapters.value.has(chapter.name)
	setOpenChapter(isOpen ? null : chapter.name)
}

// Seed the open session once, when the outline first loads: what the user last
// had open, else the session named in the route, else the first session. With
// modules there is no first-session default — the point of grouping is to open
// on a short list of module headings, not on a session's lessons.
let outlineInitialized = false
watch(
	[() => outline.data, () => modules.data],
	([data, moduleList]) => {
		if (!data || !moduleList || outlineInitialized) return
		outlineInitialized = true
		const remembered = recallOpenSession(sessionStateKey.value)
		if (remembered !== undefined) {
			openChapters.value = new Set(remembered ? [remembered] : [])
			return
		}
		const activeIdx = Number(route.params.chapterNumber) || null
		const active =
			(activeIdx && data.find((c) => c.idx === activeIdx)) ||
			(moduleList.length ? null : data[0])
		setOpenChapter(active ? active.name : null)
	},
	{ immediate: true }
)

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

// Which modules are expanded. Read-only outlines are an accordion (one at a
// time, so the list of modules stays scannable); the editor lets several stay
// open at once because dragging a session between two modules needs both of
// their lists on screen.
const openModules = ref<Set<string | null>>(new Set())

// `null` is a real module key (the ungrouped bucket), so "no current module" is
// `undefined` rather than null.
const currentModuleName = computed<string | null | undefined>(() => {
	const byLesson = groupOfLesson(groups.value, props.selectedLessonNumber)
	if (byLesson) return byLesson.name
	const byChapter = groupOfChapterIdx(
		groups.value,
		Number(route.params.chapterNumber) || null
	)
	return byChapter ? byChapter.name : undefined
})

function isCurrentModule(group: OutlineGroup): boolean {
	return currentModuleName.value !== undefined && currentModuleName.value === group.name
}

function onToggleModule(group: OutlineGroup) {
	const next = new Set(openModules.value)
	const isOpen = next.has(group.name)
	if (!props.allowEdit) next.clear()
	if (!isOpen) next.add(group.name)
	else next.delete(group.name)
	openModules.value = next
}

// Seed once: open the module holding the current lesson so the learner can see
// where they are. Otherwise everything stays collapsed for a learner (that is
// the whole feature) while the editor opens the first module to work in.
let modulesInitialized = false
watch(
	groups,
	(list) => {
		if (!list.length || modulesInitialized) return
		modulesInitialized = true
		const current = currentModuleName.value
		if (current !== undefined) openModules.value = new Set([current])
		else if (props.allowEdit) openModules.value = new Set([list[0].name])
	},
	{ immediate: true }
)

// Following a lesson link into another module expands it, so the outline always
// shows the learner where they now are.
watch(
	() => currentModuleName.value,
	(name) => {
		if (name === undefined) return
		const next = props.allowEdit ? new Set(openModules.value) : new Set<string | null>()
		next.add(name)
		openModules.value = next
	}
)

// Bundled once and spread at both ChapterList call sites (grouped and flat) so
// the two can never drift apart.
const chapterProps = computed(() => ({
	courseName: props.courseName,
	openChapters: openChapters.value,
	allowEdit: props.allowEdit,
	inlineSelect: props.inlineSelect,
	editorLinks: props.editorLinks,
	selectedLessonNumber: props.selectedLessonNumber,
	isEnrolled: props.isEnrolled,
	chaptersOnly: props.chaptersOnly,
	relabelChapters: props.relabelChapters,
}))

const chapterHandlers = {
	toggle: onToggleChapter,
	'select-lesson': (payload: { chapterNumber: string; lessonNumber: string }) =>
		emit('select-lesson', payload),
	'edit-chapter': (chapter: OutlineChapter) => openChapterModal(chapter),
	'delete-chapter': (chapterName: string) => trashChapter(chapterName),
	'set-chapter-status': (payload: { chapter: string; status: ChapterStatus }) =>
		setChapterStatus(payload),
	'delete-lesson': ({ lesson, chapter }: { lesson: string; chapter: string }) =>
		trashLesson(lesson, chapter),
	'move-lesson': (e: DraggableEvent) => updateOutline(e),
	'add-lesson': (payload: { chapter: OutlineChapter; lessonIdx: number }) =>
		openLessonModalForAdd(payload),
	'edit-lesson': (payload: { chapter: OutlineChapter; lesson: OutlineLesson }) =>
		openLessonModalForEdit(payload),
}

const showModuleModal = ref<boolean>(false)
const showOrganizeModal = ref<boolean>(false)
const currentModule = ref<CourseModule | null>(null)

function openModuleModal(group: OutlineGroup | CourseModule | null = null) {
	// The ungrouped bucket is not a real module, so it has nothing to rename.
	const name = group && 'name' in group ? group.name : null
	currentModule.value = name
		? ({
				name,
				title: group!.title,
				description: (group as OutlineGroup).description,
				idx: 0,
		  } as CourseModule)
		: null
	showModuleModal.value = true
}

function openOrganizeModal() {
	showOrganizeModal.value = true
}

// Expand a freshly created module: it is empty, and an author's next move is to
// drag sessions into it — which needs its (collapsed) body on screen.
function onModuleSaved(saved: { name: string }) {
	openModules.value = new Set([...openModules.value, saved.name])
	reloadOutline()
}

const deleteModule = createResource({
	url: 'lms.lms.api.delete_module',
	makeParams(values: { module: string }) {
		return values
	},
})

function trashModule(group: OutlineGroup) {
	if (!group.name) return
	$dialog({
		title: __('Delete this module?'),
		message: __(
			'The sessions inside it are kept — they simply stop being grouped and move to the end of the outline. This cannot be undone.'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					deleteModule.submit(
						{ module: group.name as string },
						{
							onSuccess() {
								reloadOutline()
								toast.success(__('Module deleted successfully'))
							},
							onError(err: { messages?: string[] } | string) {
								toast.error(
									typeof err === 'string'
										? err
										: err.messages?.[0] ?? __('Could not delete the module')
								)
							},
						}
					)
					close()
				},
			},
		],
	})
}

const updateModuleIndex = createResource({
	url: 'lms.lms.api.update_module_index',
	makeParams(values: { module: string; course: string; idx: number }) {
		return values
	},
})

function updateModuleOrder(e: DraggableEvent) {
	const group = e.item.__draggable_context.element as OutlineGroup
	// The ungrouped bucket is a rendering device, not a module — it has nothing
	// to reorder and always sits last.
	if (!group.name) {
		reloadOutline()
		return
	}
	updateModuleIndex.submit(
		{
			module: group.name,
			course: props.courseName,
			idx: e.newIndex,
		},
		{
			onSuccess() {
				// Sessions are renumbered to follow their module, so the outline has
				// to come back from the server rather than be patched locally.
				reloadOutline()
				toast.success(__('Module moved successfully'))
			},
		}
	)
}

const chapterPlacement = createResource({
	url: 'lms.lms.api.update_chapter_placement',
	makeParams(values: {
		course: string
		chapter: string
		module: string | null
		idx: number
	}) {
		return values
	},
})

function updateChapterPlacement(e: DraggableEvent) {
	chapterPlacement.submit(
		{
			course: props.courseName,
			chapter: e.item.__draggable_context.element.name,
			module: e.to.dataset.module || null,
			idx: e.newIndex,
		},
		{
			onSuccess() {
				reloadOutline()
				toast.success(__('Session moved successfully'))
			},
			onError(err: { messages?: string[] } | string) {
				reloadOutline()
				toast.error(
					typeof err === 'string'
						? err
						: err.messages?.[0] ?? __('Could not move the session')
				)
			},
		}
	)
}

watch(
	() => props.completedLesson,
	(lessonName) => {
		if (!lessonName || !outline.data) return
		for (const chapter of outline.data) {
			const found = chapter.lessons?.find((l) => l.name === lessonName)
			if (found) {
				found.is_complete = true
				break
			}
		}
		// `is_locked` on the next lesson is computed server-side, so re-fetch the
		// outline to unlock it without a manual refresh. The optimistic flip above
		// keeps the just-completed lesson's tick instant while the reload lands.
		outline.reload()
	}
)

const deleteLesson = createResource({
	url: 'lms.lms.api.delete_lesson',
	makeParams(values: { lesson: string; chapter: string }) {
		return values
	},
	onSuccess() {
		reloadOutline()
		toast.success(__('Lesson deleted successfully'))
	},
})

const updateLessonIndex = createResource({
	url: 'lms.lms.api.update_lesson_index',
	makeParams(values: {
		lesson: string
		sourceChapter: string
		targetChapter: string
		idx: number
	}) {
		return values
	},
	onSuccess() {
		toast.success(__('Lesson moved successfully'))
	},
})

const updateChapterIndex = createResource({
	url: 'lms.lms.api.update_chapter_index',
	makeParams(values: { chapter: string; course: string; idx: number }) {
		return values
	},
	onSuccess() {
		toast.success(__('Chapter moved successfully'))
	},
})

const deleteChapter = createResource({
	url: 'lms.lms.api.delete_chapter',
	makeParams(values: { chapter: string }) {
		return values
	},
	onSuccess() {
		reloadOutline()
		toast.success(__('Chapter deleted successfully'))
	},
})

const chapterStatus = createResource({
	url: 'lms.lms.api.set_chapter_status',
	makeParams(values: { chapter: string; status: ChapterStatus }) {
		return values
	},
})

function setChapterStatus(payload: { chapter: string; status: ChapterStatus }) {
	const publishing = payload.status === 'Published'
	$dialog({
		title: publishing
			? __('Publish this session?')
			: __('Move this session to draft?'),
		message: publishing
			? __(
					'Publishing will make this session visible to enrolled students. Do you want to continue?'
			  )
			: __(
					'Moving this session to draft will hide it from students. Do you want to continue?'
			  ),
		actions: [
			{
				label: __('Yes'),
				theme: publishing ? 'gray' : 'red',
				variant: 'solid',
				onClick(close) {
					submitChapterStatus(payload)
					close()
				},
			},
			{
				label: __('No'),
				variant: 'subtle',
				onClick(close) {
					close()
				},
			},
		],
	})
}

function submitChapterStatus(payload: {
	chapter: string
	status: ChapterStatus
}) {
	chapterStatus.submit(payload, {
		onSuccess() {
			reloadOutline()
			toast.success(
				payload.status === 'Published'
					? __('Session published. It is now visible to enrolled students.')
					: __('Session moved to draft. It is now hidden from students.')
			)
		},
		onError(err: { messages?: string[] } | string) {
			toast.error(
				typeof err === 'string'
					? err
					: err.messages?.[0] ?? __('Could not update the session status')
			)
		},
	})
}

const findLessonNumberByName = (lessonName: string) => {
	if (!outline.data) return null
	for (const chapter of outline.data) {
		const lesson = chapter.lessons?.find((l) => l.name === lessonName)
		if (lesson) {
			return lesson.number
		}
	}
	return null
}

function trashLesson(lessonName: string, chapterName: string) {
	$dialog({
		title: __('Delete this lesson?'),
		message: __(
			'Deleting this lesson will permanently remove it from the course. This action cannot be undone. Are you sure you want to continue?'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					const lessonNumber = findLessonNumberByName(lessonName)
					deleteLesson.submit(
						{ lesson: lessonName, chapter: chapterName },
						{
							onSuccess() {
								reloadOutline()
								toast.success(__('Lesson deleted successfully'))
								if (lessonNumber) {
									emit('lesson-deleted', lessonNumber)
								}
							},
						}
					)
					close()
				},
			},
		],
	})
}

function trashChapter(chapterName: string) {
	$dialog({
		title: __('Delete this chapter?'),
		message: __(
			'Deleting this chapter will also delete all its lessons and permanently remove it from the course. This action cannot be undone. Are you sure you want to continue?'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					deleteChapter.submit({ chapter: chapterName })
					close()
				},
			},
		],
	})
}

function openChapterModal(chapter: OutlineChapter | null = null) {
	currentChapter.value = chapter
	showChapterModal.value = true
}

function updateOutline(e: DraggableEvent) {
	updateLessonIndex.submit({
		lesson: e.item.__draggable_context.element.name,
		sourceChapter: e.from.dataset.chapter,
		targetChapter: e.to.dataset.chapter,
		idx: e.newIndex,
	})
}

function updateChapterOrder(e: DraggableEvent) {
	updateChapterIndex.submit({
		chapter: e.item.__draggable_context.element.name,
		course: props.courseName,
		idx: e.newIndex,
	})
}
</script>
