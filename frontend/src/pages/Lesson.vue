<template>
	<div v-if="lesson.data" class="">
		<header
			v-if="!embedded"
			class="sticky top-0 z-10 flex flex-wrap items-center gap-y-2 justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
			<!-- #29: allow the control buttons to wrap instead of overflowing on mobile. -->
			<div class="flex flex-wrap items-center justify-end gap-2">
				<Tooltip v-if="canGoZen()" :text="__('Zen Mode')">
					<Button @click="goFullScreen()">
						<template #icon>
							<Focus class="w-4 h-4 stroke-2" />
						</template>
					</Button>
				</Tooltip>
				<Button v-if="isAdmin" @click="showVideoStats()">
					<template #icon>
						<TrendingUp class="size-4 stroke-1.5" />
					</template>
				</Button>
				<CertificationLinks :courseName="courseName" />
				<Button v-if="lesson.data.prev" @click="switchLesson('prev')">
					<template #prefix>
						<ChevronLeft class="w-4 h-4 stroke-1" />
					</template>
					<span>
						{{ __('Previous') }}
					</span>
				</Button>

				<Button v-if="lesson.data.next_unlocked || lesson.data.next" @click="switchLesson('next')">
					<template #suffix>
						<ChevronRight class="w-4 h-4 stroke-1" />
					</template>
					<span>
						{{ __('Next') }}
					</span>
				</Button>

				<router-link
					v-else
					:to="{
						name: 'CourseDetail',
						params: { courseName: courseName },
					}"
				>
					<Button>
						{{ __('Course Home Page') }}
					</Button>
				</router-link>
			</div>
		</header>
		<div
			:class="
				embedded
					? 'grid grid-cols-1 h-full'
					: 'grid md:grid-cols-[70%,30%] h-[94vh]'
			"
		>
			<div v-if="lesson.data.no_preview" class="border-e">
				<div class="shadow rounded-md w-3/4 mt-10 mx-auto text-center p-4">
					<div class="flex items-center justify-center mt-4 gap-x-2">
						<LockKeyholeIcon class="size-4 stroke-2 text-ink-gray-5" />
						<div class="text-lg font-semibold text-ink-gray-7">
							{{ __('This lesson is locked') }}
						</div>
					</div>
					<div class="mt-1 mb-4 text-ink-gray-7">
						{{
							__(
								'This lesson is not available for preview. Please enroll in the course to access it.'
							)
						}}
					</div>
					<Button
						v-if="user.data && !lesson.data.disable_self_learning"
						@click="enrollStudent()"
						variant="solid"
					>
						{{ __('Start Learning') }}
					</Button>
					<Badge
						theme="blue"
						size="lg"
						v-else-if="lesson.data.disable_self_learning"
						class="mt-2"
					>
						{{ __('Contact the Administrator to enroll for this course.') }}
					</Badge>
					<Button v-else @click="redirectToLogin()">
						<template #prefix>
							<LogIn class="w-4 h-4 stroke-1" />
						</template>
						{{ __('Login') }}
					</Button>
				</div>
			</div>
			<div
				v-else
				ref="lessonContainer"
				:class="{
					'overflow-y-auto': zenModeEnabled,
					'bg-surface-white': !(zenModeEnabled && zenDark),
					'zen-dark': zenModeEnabled && zenDark,
				}"
			>
				<div
					class="border-e pt-5 pb-10 h-full"
					:class="{
						'w-full md:w-3/5 mx-auto border-none !pt-10': zenModeEnabled,
					}"
				>
					<div class="px-5">
						<div
							class="flex flex-col space-y-3 md:space-y-0 md:flex-row md:items-center justify-between"
						>
							<div class="flex flex-col">
								<!-- #23: Zen Mode branding -->
								<span
									v-if="zenModeEnabled"
									class="mb-2 inline-flex items-center gap-x-1 w-fit rounded-full bg-ink-gray-9 text-ink-white px-2.5 py-0.5 text-xs font-semibold tracking-wide"
								>
									<Focus class="size-3" /> {{ __('Zen Mode') }}
								</span>
								<div class="text-3xl font-semibold text-ink-gray-9">
									{{ lesson.data.title }}
								</div>

								<div
									v-if="zenModeEnabled"
									class="relative flex items-center gap-x-2 text-sm mt-1 text-ink-gray-7 group w-fit mt-2"
								>
									<span>
										{{ lesson.data.chapter_title }} -
										{{ lesson.data.course_title }}
									</span>
									<Info class="size-3" />
									<div
										class="hidden group-hover:block rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-xl absolute start-0 top-full mt-2"
									>
										{{ Math.ceil(lesson.data.membership.progress) }}%
										{{ __('completed') }}
									</div>
								</div>
							</div>

							<div
								v-if="zenModeEnabled"
								class="flex items-center gap-x-2 mt-2 md:mt-0"
							>
								<!-- #23: optional full dark theme toggle -->
								<Tooltip :text="zenDark ? __('Light theme') : __('Dark theme')">
									<Button @click="zenDark = !zenDark">
										<template #icon>
											<Sun v-if="zenDark" class="w-4 h-4 stroke-1.5" />
											<Moon v-else class="w-4 h-4 stroke-1.5" />
										</template>
									</Button>
								</Tooltip>
								<Button @click="showDiscussionsInZenMode()">
									<template #icon>
										<MessageCircleQuestion class="w-4 h-4 stroke-1.5" />
									</template>
								</Button>
								<Button v-if="lesson.data.prev" @click="switchLesson('prev')">
									<template #prefix>
										<ChevronLeft class="w-4 h-4 stroke-1" />
									</template>
									<span>
										{{ __('Previous') }}
									</span>
								</Button>

				<Button
					v-if="lesson.data.next_unlocked || lesson.data.next"
					@click="switchLesson('next')"
				>
					<template #suffix>
						<ChevronRight class="w-4 h-4 stroke-1" />
					</template>
					<span>
						{{ __('Next') }}
					</span>
				</Button>

								<router-link
									v-else
									:to="{
										name: 'CourseDetail',
										params: { courseName: courseName },
									}"
								>
									<Button>
										{{ __('Back to Course') }}
									</Button>
								</router-link>
							</div>
						</div>

						<div v-if="!zenModeEnabled" class="flex items-center mt-4 md:mt-2">
							<CourseInstructors
								v-if="lesson.data?.instructors"
								:instructors="lesson.data.instructors"
							/>
						</div>

						<div
							v-if="
								lesson.data.instructor_content &&
								JSON.parse(lesson.data.instructor_content)?.blocks?.length >
									1 &&
								allowInstructorContent()
							"
							class="bg-surface-gray-2 p-3 rounded-md mt-6"
						>
							<div class="text-ink-gray-5 font-medium">
								{{ __('Instructor Notes') }}
							</div>
							<div
								id="instructor-content"
								class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal"
							></div>
						</div>
						<div
							v-else-if="lesson.data.instructor_notes"
							class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal mt-8"
						>
							<LessonContent :content="lesson.data.instructor_notes" />
						</div>
						<div
							v-if="lesson.data.content"
							@mouseup="toggleInlineMenu"
							class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal mt-8"
						>
							<div id="editor"></div>
						</div>
						<div
							v-else
							class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal mt-8"
						>
							<LessonContent
								v-if="lesson.data?.body"
								:content="lesson.data.body"
								:youtube="lesson.data.youtube"
								:quizId="lesson.data.quiz_id"
							/>
						</div>

						<!-- #28: Note-taking panel sits below the lesson content
						     (video + body), above the quiz/assignment and the
						     Questions panel. -->
						<div v-if="canTakeNotes" class="mt-8 border rounded-md">
							<button
								type="button"
								class="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-ink-gray-7"
								@click="notesPanelOpen = !notesPanelOpen"
							>
								<span class="flex items-center gap-x-2">
									<NotebookPen class="size-4" />
									{{ __('My Notes') }}
								</span>
								<ChevronDown
									class="size-4 transition-transform"
									:class="{ 'rotate-180': notesPanelOpen }"
								/>
							</button>
							<div v-show="notesPanelOpen" class="px-4 pb-4">
								<Notes
									:lesson="lesson.data?.name"
									v-model:notes="notes"
									@updateNotes="updateNotes"
								/>
							</div>
						</div>
					</div>
					<div
						v-if="lesson.data && (allowDiscussions || tabs.length > 1)"
						class="mt-10 pb-20 pt-5 border-t px-5"
						ref="discussionsContainer"
					>
						<TabButtons
							v-if="tabs.length > 1"
							:buttons="tabs"
							v-model="currentTab"
							class="w-fit mb-10"
						/>
						<!-- #26: Notes moved above the content; this panel is Questions only. -->
						<Discussions
							v-if="currentTab === 'Community' && allowDiscussions"
							:title="'Questions'"
							:doctype="'Course Lesson'"
							:docname="lesson.data.name"
							:lessonName="lesson.data.name"
							:allowPost="Boolean(lesson.data.membership && !embedded)"
							:openTopicName="deepLinkTopic"
							:key="lesson.data.name"
							:emptyStateText="
								__('Ask a question to get help from the community.')
							"
						/>
					</div>
				</div>
			</div>
			<div v-if="!embedded" class="sticky top-10 h-[94vh]">
				<StudentLessonSidebar
					:courseName="courseName"
					:courseTitle="lesson.data.course_title"
					:progress="lessonProgress"
					:selectedLessonNumber="`${chapterNumber}-${lessonNumber}`"
					:completedLesson="completedLesson"
					:refreshSignal="sidebarRefresh"
					:withProgress="lesson.data.membership ? true : false"
				/>
			</div>
		</div>
	</div>
	<InlineLessonMenu
		v-if="lesson.data?.name"
		v-model="showInlineMenu"
		:lesson="lesson.data?.name"
		v-model:notes="notes"
		@updateNotes="updateNotes"
	/>
	<VideoStatistics
		v-if="isAdmin"
		v-model="showStatsDialog"
		:lessonName="lesson.data?.name"
		:lessonTitle="lesson.data?.title"
	/>
</template>
<script setup>
import {
	Badge,
	Breadcrumbs,
	Button,
	call,
	createListResource,
	createResource,
	TabButtons,
	Tooltip,
	usePageMeta,
	toast,
} from 'frappe-ui'
import {
	computed,
	watch,
	inject,
	ref,
	onMounted,
	onBeforeUnmount,
	nextTick,
} from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	LockKeyholeIcon,
	LogIn,
	Focus,
	Info,
	MessageCircleQuestion,
	Moon,
	NotebookPen,
	Sun,
	TrendingUp,
} from 'lucide-vue-next'
import {
	getEditorTools,
	enablePlyr,
	highlightText,
	sanitizeEditorJs,
} from '@/utils'
import { sessionStore } from '@/stores/session'
import { useSidebar } from '@/stores/sidebar'
import { useSettings } from '@/stores/settings'
import {
	resolveDwellSeconds,
	isVideoComplete,
	shouldStartDwellTimer,
	shouldAttachVideoFallback,
} from '@/utils/lessonProgress'
import EditorJS from '@editorjs/editorjs'
import LessonContent from '@/components/LessonContent.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import Discussions from '@/components/Discussions.vue'
import CertificationLinks from '@/components/CertificationLinks.vue'
import VideoStatistics from '@/components/Modals/VideoStatistics.vue'
import StudentLessonSidebar from '@/components/StudentLessonSidebar.vue'
import Notes from '@/components/Notes/Notes.vue'
import InlineLessonMenu from '@/components/Notes/InlineLessonMenu.vue'
import { getLmsRoute } from '@/utils/basePath'

const user = inject('$user')
const socket = inject('$socket')
const router = useRouter()
const route = useRoute()
const allowDiscussions = ref(false)
const editor = ref(null)
const instructorEditor = ref(null)
const lessonProgress = ref(0)
const lessonContainer = ref(null)
const zenModeEnabled = ref(false)
// #23: optional full dark theme while in Zen Mode.
const zenDark = ref(false)
const showStatsDialog = ref(false)
const hasQuiz = ref(false)
const discussionsContainer = ref(null)
const timer = ref(0)
const { brand } = sessionStore()
const sidebarStore = useSidebar()
const plyrSources = ref([])
const showInlineMenu = ref(false)
const currentTab = ref(null)
const completedLesson = ref(null)
// Bumped on a server-confirmed progress change (the `update_lesson_progress`
// socket event) so the sidebar re-fetches the outline and its sequential locks —
// this is what actually unlocks the next lesson after a quiz passes without a
// manual page refresh.
const sidebarRefresh = ref(0)
// #12: topic to auto-open when arriving from a discussion notification deep-link.
const deepLinkTopic = ref('')
// #26: standalone notes panel (above the quiz) open state.
const notesPanelOpen = ref(true)
const settingsStore = useSettings()
let timerInterval = null

const tabs = ref([])

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
	chapterNumber: {
		type: String,
		required: true,
	},
	lessonNumber: {
		type: String,
		required: true,
	},
	embedded: {
		type: Boolean,
		default: false,
	},
})

const emit = defineEmits([
	'select-lesson',
	'lesson-completed',
	'progress-updated',
])

// Exposed for the parent so the CourseEditor preview can render the same
// Prev / Next / Zen-mode controls as the student header but place them in
// the page-level LayoutHeader instead of inside the lesson body.
defineExpose({
	switchLesson: (direction) => switchLesson(direction),
	goFullScreen: () => goFullScreen(),
	canGoZen: () => canGoZen(),
	hasPrev: computed(() => Boolean(lesson.data?.prev)),
	hasNext: computed(() => Boolean(lesson.data?.next)),
})

onMounted(() => {
	startTimer()
	// #12: a discussion notification links to ...?tab=Questions&discussion=<topic>.
	// Switch to the Questions tab and open that specific thread once loaded.
	if (route.query.tab === 'Questions') {
		deepLinkTopic.value = route.query.discussion || ''
		nextTick(() => {
			allowDiscussions.value = true
			currentTab.value = 'Community'
			scrollDiscussionsIntoView()
		})
	}
	if (!props.embedded) sidebarStore.isSidebarCollapsed = true
	document.addEventListener('fullscreenchange', attachFullscreenEvent)
	window.addEventListener('message', handleIframeMessage)
	socket.on('update_lesson_progress', (data) => {
		if (data.course === props.courseName) {
			lessonProgress.value = data.progress
			emit('progress-updated', data.progress)
			// Any server-confirmed progress change may have unlocked a lesson;
			// refresh the sidebar's outline so its lock icons reflect it. (A quiz
			// pass/fail both fire this event, so the sidebar reloads rather than
			// optimistically marking — the server decides completion/lock state.)
			sidebarRefresh.value++
			if (data.lesson === lesson.data?.name) {
				nextTarget.reload()
			}
		}
	})
})

const handleIframeMessage = (event) => {
	if (event.data && event.data.type === 'next-lesson') {
		switchLesson('next')
	}
}

const attachFullscreenEvent = () => {
	if (document.fullscreenElement) {
		zenModeEnabled.value = true
		allowDiscussions.value = false
	} else {
		zenModeEnabled.value = false
		zenDark.value = false
		// Ecological Society: keep Q&A discussions available on quiz lessons too
		allowDiscussions.value = true
	}
}

onBeforeUnmount(() => {
	document.removeEventListener('fullscreenchange', attachFullscreenEvent)
	window.removeEventListener('message', handleIframeMessage)
	if (!props.embedded) sidebarStore.isSidebarCollapsed = false
	trackVideoWatchDuration()
})

const lesson = createResource({
	url: 'lms.lms.utils.get_lesson',
	makeParams(values) {
		return {
			course: props.courseName,
			chapter: values ? values.chapter : props.chapterNumber,
			lesson: values ? values.lesson : props.lessonNumber,
		}
	},
	auto: true,
})

const setupLesson = (data) => {
	if (Object.keys(data).length === 0) {
		router.push({
			name: 'CourseDetail',
			params: { courseName: props.courseName },
		})
		return
	}
	if (data.is_scorm_package) {
		router.push({
			name: 'SCORMChapter',
			params: {
				courseName: props.courseName,
				chapterName: data.chapter_name,
			},
		})
	}
	lessonProgress.value = data.membership?.progress
	// #2: expose lesson context so the native VideoBlock (rendered inside the
	// EditorJS content, without props) can save/restore playback position.
	window.__esLessonContext = { lesson: data.name, course: props.courseName }
	if (data.content) editor.value = renderEditor('editor', data.content)
	if (
		data.instructor_content &&
		JSON.parse(data.instructor_content)?.blocks?.length > 1
	)
		instructorEditor.value = renderEditor(
			'instructor-content',
			data.instructor_content
		)
	editor.value?.isReady.then(() => {
		checkIfDiscussionsAllowed()
		makeLinksExternal()
	})
	checkQuiz()
}

const makeLinksExternal = () => {
	nextTick(() => {
		;['#editor', '#instructor-content'].forEach((sel) => {
			const root = document.querySelector(sel)
			if (!root) return
			// Make existing <a> tags open in a new tab
			root.querySelectorAll('a[href]').forEach((link) => {
				link.setAttribute('target', '_blank')
				link.setAttribute('rel', 'noopener noreferrer')
			})
			// Linkify bare URLs typed as plain text
			linkifyTextNodes(root)
		})
	})
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g

const linkifyTextNodes = (root) => {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			if (node.parentElement?.closest('a, code, pre'))
				return NodeFilter.FILTER_REJECT
			URL_PATTERN.lastIndex = 0
			return URL_PATTERN.test(node.textContent || '')
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP
		},
	})
	const nodes = []
	let n
	while ((n = walker.nextNode())) nodes.push(n)

	nodes.forEach((textNode) => {
		const text = textNode.textContent || ''
		const frag = document.createDocumentFragment()
		let last = 0
		URL_PATTERN.lastIndex = 0
		let m
		while ((m = URL_PATTERN.exec(text)) !== null) {
			if (m.index > last)
				frag.appendChild(document.createTextNode(text.slice(last, m.index)))
			const a = document.createElement('a')
			a.href = m[0]
			a.textContent = m[0]
			a.target = '_blank'
			a.rel = 'noopener noreferrer'
			a.className = 'underline'
			frag.appendChild(a)
			last = m.index + m[0].length
		}
		if (last < text.length)
			frag.appendChild(document.createTextNode(text.slice(last)))
		textNode.parentNode?.replaceChild(frag, textNode)
	})
}

const checkQuiz = () => {
	if (!editor.value && lesson.body) {
		const quizRegex = /\{\{ Quiz\(".*"\) \}\}/
		hasQuiz.value = quizRegex.test(lesson.body)
		// Ecological Society: keep Q&A discussions available on quiz lessons too
		allowDiscussions.value = !zenModeEnabled.value
	}
}

const renderEditor = (holder, content) => {
	if (document.getElementById(holder))
		document.getElementById(holder).innerHTML = ''
	return new EditorJS({
		holder: holder,
		tools: getEditorTools(),
		data: sanitizeEditorJs(JSON.parse(content)),
		readOnly: true,
		defaultBlock: 'embed',
		i18n: {
			direction: document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr',
		},
	})
}

// Video-ended fires markProgress + trackVideoWatchDuration in parallel,
// and trackVideoWatchDuration's getPlyrSourceDetails calls markProgress
// again. Without an in-flight guard the two save_progress requests race
// and the second one fails with TimestampMismatchError on LMS Enrollment.
let progressSubmitting = false
const markProgress = () => {
	if (progressSubmitting) return
	// Only enrolled students record progress; a moderator previewing has no
	// membership row so save_progress would no-op server-side but still
	// flip the in-memory `completedLesson` and show a green tick that
	// vanishes on refresh.
	if (
		!user.data ||
		!lesson.data ||
		!lesson.data.membership ||
		lesson.data.progress
	)
		return
	progressSubmitting = true
	progress.submit(
		{},
		{
			onSuccess() {
				progressSubmitting = false
			},
			onError(err) {
				progressSubmitting = false
				console.error(err)
			},
		}
	)
}

const progress = createResource({
	url: 'lms.lms.doctype.course_lesson.course_lesson.save_progress',
	makeParams() {
		return {
			lesson: lesson.data.name,
			course: props.courseName,
		}
	},
	onSuccess(data) {
		lessonProgress.value = data
		const name = lesson.data?.name
		completedLesson.value = name
		// Tell the parent (CourseEditor preview) so it can flip the
		// sidebar's green tick and update the percentage without waiting
		// for a refresh of the course resource.
		if (name) emit('lesson-completed', name)
		emit('progress-updated', data)
		// #3: the following lesson may have just unlocked (sequential locking).
		// Re-derive the next target so the "Next Lesson" button appears without
		// a page refresh. Only when it was previously unavailable.
		if (lesson.data && !lesson.data.next_unlocked && !lesson.data.next) {
			nextTarget.reload()
		}
	},
})

// #3: derive the next *unlocked* lesson from the outline without reloading the
// whole lesson (which would reset the just-shown quiz result). Sets the same
// dot-format target ("chapter.lesson") the header button and switchLesson use.
const nextTarget = createResource({
	url: 'lms.lms.utils.get_course_outline',
	makeParams() {
		return { course: props.courseName, progress: true }
	},
	onSuccess(outline) {
		const flat = []
		;(outline || []).forEach((ch) =>
			(ch.lessons || []).forEach((l) => flat.push(l))
		)
		const current = `${props.chapterNumber}-${props.lessonNumber}`
		const idx = flat.findIndex((l) => l.number === current)
		if (idx === -1) return
		for (let i = idx + 1; i < flat.length; i++) {
			if (!flat[i].is_locked) {
				const [c, n] = String(flat[i].number).split('-')
				lesson.data.next_unlocked = `${c}.${n}`
				if (!lesson.data.next) lesson.data.next = `${c}.${n}`
				break
			}
		}
	},
})

const notes = createListResource({
	doctype: 'LMS Lesson Note',
	filters: {
		lesson: lesson.data?.name,
		member: user.data?.name,
	},
	fields: ['name', 'color', 'highlighted_text', 'note'],
	// NOTE: intentionally no `cache` key. `lesson`/`user` are undefined at setup,
	// so a cache key here resolves to a constant (`["notes",null,null]`) and
	// frappe-ui persists the list to IndexedDB under it — which then re-hydrates
	// one user's notes into another user/session in the same browser (leakage),
	// and reuses one lesson's notes on another (vanish). Fetch fresh instead;
	// `updateNotes()` always sets the current lesson+member filters before reload.
	onSuccess(data) {
		data.forEach((note) => {
			setTimeout(() => {
				highlightText(note)
			}, 500)
		})
	},
})

const breadcrumbs = computed(() => {
	let crumbs = [{ label: __('Courses'), route: { name: 'Courses' } }]
	crumbs.push({
		label: lesson?.data?.course_title,
		route: { name: 'CourseDetail', params: { courseName: props.courseName } },
	})
	return crumbs
})

const switchLesson = (direction) => {
	trackVideoWatchDuration()
	let lessonIndex
	if (direction === 'prev') {
		lessonIndex = lesson.data.prev.split('.')
	} else {
		const nextTarget = lesson.data.next_unlocked || lesson.data.next
		if (!nextTarget) return
		lessonIndex = nextTarget.split('.')
	}

	const [chapterNumber, lessonNumber] = lessonIndex
	// In the embedded editor preview, navigate the parent's selection so the
	// pane swaps in place instead of routing away to /lesson/...
	if (props.embedded) {
		emit('select-lesson', { chapterNumber, lessonNumber })
		return
	}

	router.push({
		name: 'Lesson',
		params: {
			courseName: props.courseName,
			chapterNumber,
			lessonNumber,
		},
	})
}

watch(
	[() => route.params.chapterNumber, () => route.params.lessonNumber],
	async (
		[newChapterNumber, newLessonNumber],
		[_oldChapterNumber, _oldLessonNumber]
	) => {
		if (newChapterNumber || newLessonNumber) {
			plyrSources.value = []
			await nextTick()
			resetLessonState(newChapterNumber, newLessonNumber)
			updateNotes()
			checkIfDiscussionsAllowed()
			checkQuiz()
		}
	}
)

const resetLessonState = (newChapterNumber, newLessonNumber) => {
	editor.value = null
	instructorEditor.value = null
	allowDiscussions.value = false
	lesson.submit({
		chapter: newChapterNumber,
		lesson: newLessonNumber,
	})
	videoFallbackArmed = false
	fallbackGeneration++
	clearInterval(timerInterval)
	timer.value = 0
}

const trackVideoWatchDuration = () => {
	if (!lesson.data?.membership) return
	let videoDetails = getVideoDetails()
	videoDetails = videoDetails.concat(getPlyrSourceDetails())
	call('lms.lms.api.track_video_watch_duration', {
		lesson: lesson.data.name,
		videos: videoDetails,
	})
}

const getVideoDetails = () => {
	let details = []
	const videos = document.querySelectorAll('video')
	if (videos.length > 0) {
		videos.forEach((video) => {
			if (isVideoComplete(video.currentTime, video.duration)) markProgress()
			details.push({
				source: video.src,
				watch_time: video.currentTime,
			})
		})
	}
	return details
}

const getPlyrSourceDetails = () => {
	let details = []
	plyrSources.value.forEach((source) => {
		if (isVideoComplete(source.currentTime, source.duration)) markProgress()
		let src = cleanYouTubeUrl(source.source)
		details.push({
			source: src,
			watch_time: source.currentTime,
		})
	})
	return details
}

const cleanYouTubeUrl = (url) => {
	if (!url) return url
	const urlObj = new URL(url)
	urlObj.searchParams.delete('t')
	return urlObj.toString()
}

watch(
	() => lesson.data,
	async (data) => {
		setupLesson(data)
		// Settings drive dwell + enforcement; if they haven't resolved yet
		// the timer reads undefined and falls back to 30s. Await the
		// resource so the admin-configured dwell time wins from the first
		// lesson load.
		if (settingsStore.settings?.promise) {
			try {
				await settingsStore.settings.promise
			} catch {}
		}
		startTimer()
		await getPlyrSource()
		updateNotes()
		const hasVideoListener =
			plyrSources.value.length > 0 || !!document.querySelector('video')
		const enforceVideo = Number(
			settingsStore.settings?.data?.enforce_video_completion ?? 0
		)
		// When the lesson has video AND enforcement is on, suppress dwell so
		// completion is gated on play-to-end. When enforcement is off, dwell
		// runs for every lesson type — including YouTube/Plyr — so admins can
		// set a short dwell to mark video lessons complete without a full
		// playthrough.
		if (!shouldStartDwellTimer({ hasVideo: hasVideoListener, enforceVideo })) {
			clearInterval(timerInterval)
		}
		if (
			shouldAttachVideoFallback({ hasVideo: hasVideoListener, enforceVideo })
		) {
			document.querySelectorAll('video').forEach((video) => {
				if (video._lmsErrorAttached) return
				video._lmsErrorAttached = true
				const gen = fallbackGeneration
				video.addEventListener(
					'error',
					() => {
						if (gen !== fallbackGeneration) return
						fallbackToDwellTimer('html5-video-error')
					},
					{ once: true }
				)
			})
		}
	}
)

const getPlyrSource = async () => {
	await nextTick()
	if (plyrSources.value.length == 0) {
		plyrSources.value = await enablePlyr({
			lesson: lesson.data?.name,
			course: props.courseName,
		})
		const enforceVideo = Number(
			settingsStore.settings?.data?.enforce_video_completion ?? 0
		)
		if (
			shouldAttachVideoFallback({
				hasVideo: plyrSources.value.length > 0,
				enforceVideo,
			})
		) {
			plyrSources.value.forEach((player) => {
				let readyFired = false
				const gen = fallbackGeneration
				player.on('ready', () => {
					readyFired = true
				})
				player.on('error', (event) => {
					if (gen !== fallbackGeneration) return
					fallbackToDwellTimer(
						'plyr-error: ' + (event?.detail?.message || 'unknown')
					)
				})
				setTimeout(() => {
					if (!readyFired && gen === fallbackGeneration) {
						fallbackToDwellTimer('plyr-no-ready-15s')
					}
				}, 15000)
			})
		}
	}
	updateVideoWatchDuration()
}

const updateVideoWatchDuration = () => {
	if (lesson.data.videos && lesson.data.videos.length > 0) {
		lesson.data.videos.forEach((video) => {
			if (video.source.includes('youtube') || video.source.includes('vimeo')) {
				updatePlyrVideoTime(video)
			} else {
				updateVideoTime(video)
			}
		})
	}
	attachVideoEndedListeners()
}

const attachVideoEndedListeners = () => {
	const onVideoEnded = () => {
		markProgress()
		trackVideoWatchDuration()
	}

	document.querySelectorAll('video').forEach((video) => {
		if (!video._lmsEndedAttached) {
			video.addEventListener('ended', onVideoEnded)
			video._lmsEndedAttached = true
		}
	})

	plyrSources.value.forEach((plyrSource) => {
		if (!plyrSource._lmsEndedAttached) {
			plyrSource.on('ended', onVideoEnded)
			plyrSource.on('statechange', (event) => {
				if (event.detail?.code === 0) onVideoEnded()
			})
			plyrSource._lmsEndedAttached = true
		}
	})
}

const updatePlyrVideoTime = (video) => {
	plyrSources.value.forEach((plyrSource) => {
		plyrSource.on('ready', () => {
			if (plyrSource.source === video.source) {
				plyrSource.embed.seekTo(video.watch_time, true)
				plyrSource.play()
				plyrSource.pause()
			}
		})
	})
}

const updateVideoTime = (video) => {
	const videos = document.querySelectorAll('video')
	if (videos.length > 0) {
		videos.forEach((vid) => {
			if (vid.src === video.source) {
				let watch_time = video.watch_time < vid.duration ? video.watch_time : 0
				if (vid.readyState >= 1) {
					vid.currentTime = watch_time
				} else {
					vid.addEventListener('loadedmetadata', () => {
						vid.currentTime = watch_time
					})
				}
			}
		})
	}
}

let videoFallbackArmed = false
let fallbackGeneration = 0
const fallbackToDwellTimer = (reason) => {
	if (videoFallbackArmed) return
	videoFallbackArmed = true
	console.warn('[Lesson] video fallback engaged:', reason)
	toast.warning(
		__('Video failed to load — you can still mark this lesson as viewed.')
	)
	clearInterval(timerInterval)
	timer.value = 0
	startTimer()
}

const startTimer = () => {
	if (!lesson.data?.membership) return
	const dwell = resolveDwellSeconds(
		settingsStore.settings?.data?.lesson_dwell_time
	)
	if (dwell === null) return
	timerInterval = setInterval(() => {
		timer.value++
		if (timer.value >= dwell) {
			clearInterval(timerInterval)
			markProgress()
		}
	}, 1000)
}

onBeforeUnmount(() => {
	clearInterval(timerInterval)
})

const checkIfDiscussionsAllowed = () => {
	hasQuiz.value = false
	if (lesson.data?.content) {
		try {
			JSON.parse(lesson.data.content)?.blocks?.forEach((block) => {
				if (block.type === 'quiz') {
					hasQuiz.value = true
				}
			})
		} catch {
			// legacy markdown lessons
		}
	}

	// Ecological Society: keep Q&A discussions available on quiz lessons too
	// (membership / moderator / instructor still required; hidden in zen mode).
	if (
		!zenModeEnabled.value &&
		!props.embedded &&
		(lesson.data?.membership ||
			user.data?.is_moderator ||
			user.data?.is_instructor)
	) {
		allowDiscussions.value = true
	} else {
		allowDiscussions.value = false
	}
}

const isAdmin = computed(() => {
	let isInstructor = lesson.data?.instructors?.includes(user.data?.name)
	return user.data?.is_moderator || isInstructor
})

// #26: who sees the (moved) note-taking panel - enrolled learners, not admins.
const canTakeNotes = computed(
	() => !isAdmin.value && !props.embedded && !!lesson.data?.membership
)

const allowInstructorContent = () => {
	if (window.read_only_mode) return false
	return isAdmin.value
}

const enrollment = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'LMS Enrollment',
				course: props.courseName,
				member: user.data?.name,
			},
		}
	},
})

const enrollStudent = () => {
	enrollment.submit(
		{},
		{
			onSuccess() {
				window.location.reload()
			},
			onError(err) {
				toast.error(__(err.messages?.[0] || err))
				console.error(err)
			},
		}
	)
}

const toggleInlineMenu = async () => {
	showInlineMenu.value = false
	await nextTick()
	let selection = window.getSelection()
	if (selection.toString()) {
		showInlineMenu.value = true
	}
}

const showVideoStats = () => {
	showStatsDialog.value = true
}

const canGoZen = () => {
	if (
		user.data?.is_moderator ||
		user.data?.is_instructor ||
		user.data?.is_evaluator
	)
		return true
	if (lesson.data?.membership) return true
	return false
}

const goFullScreen = () => {
	if (lessonContainer.value.requestFullscreen) {
		lessonContainer.value.requestFullscreen()
	} else if (lessonContainer.value.mozRequestFullScreen) {
		lessonContainer.value.mozRequestFullScreen()
	} else if (lessonContainer.value.webkitRequestFullscreen) {
		lessonContainer.value.webkitRequestFullscreen()
	} else if (lessonContainer.value.msRequestFullscreen) {
		lessonContainer.value.msRequestFullscreen()
	}
}

const showDiscussionsInZenMode = () => {
	if (allowDiscussions.value) {
		allowDiscussions.value = false
	} else {
		allowDiscussions.value = true
		currentTab.value = 'Community'
		scrollDiscussionsIntoView()
	}
}

const scrollDiscussionsIntoView = () => {
	nextTick(() => {
		discussionsContainer.value?.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
			inline: 'nearest',
		})
	})
}

const updateNotes = () => {
	if (!user.data) return
	notes.update({
		filters: {
			lesson: lesson.data?.name,
			member: user.data?.name,
		},
	})
	notes.reload()
}

watch(
	allowDiscussions,
	() => {
		const newTabs = []
		if (allowDiscussions.value) {
			newTabs.push({
				label: __('Questions'),
				value: 'Community',
			})
		}
		// #26: Notes are no longer a bottom tab (moved above the content).
		tabs.value = newTabs

		if (allowDiscussions.value) {
			currentTab.value = 'Community'
		} else {
			currentTab.value = null
		}
	},
	{ immediate: true }
)

const redirectToLogin = () => {
	window.location.href = `/login?redirect-to=${getLmsRoute(
		`courses/${props.courseName}`
	)}`
}

usePageMeta(() => {
	return {
		title: lesson?.data?.title,
		icon: brand.favicon,
	}
})
</script>
<style>
.avatar-group {
	display: inline-flex;
	align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}

/* #23: Zen Mode full dark theme */
.zen-dark {
	background-color: #0f172a;
}
.zen-dark,
.zen-dark .text-ink-gray-9,
.zen-dark .text-ink-gray-8,
.zen-dark .text-ink-gray-7,
.zen-dark .text-ink-gray-5 {
	color: #e2e8f0 !important;
}
.zen-dark .prose,
.zen-dark .ProseMirror {
	color: #e2e8f0 !important;
}
.zen-dark .prose :where(h1, h2, h3, h4, h5, h6, strong) {
	color: #f8fafc !important;
}
.zen-dark .border,
.zen-dark .border-e,
.zen-dark .border-t,
.zen-dark .border-b {
	border-color: #334155 !important;
}
.zen-dark .bg-surface-gray-2 {
	background-color: #1e293b !important;
}

.lesson-content p {
	margin-bottom: 1rem;
	line-height: 1.7;
}

/* Collapse empty / line-break-only paragraphs that some lesson bodies (e.g.
   Jackpots, parts of Session 3) leave after the video or quiz. Left alone they
   open a large gap before "My Notes" so students never scroll to it. */
.ProseMirror p:empty,
.ProseMirror p:has(> br:only-child) {
	margin: 0;
	line-height: 0;
	min-height: 0;
}

.lesson-content li {
	line-height: 1.7;
}

.lesson-content ol {
	list-style: auto;
	margin: revert;
	padding: 1rem;
}

.lesson-content ul {
	list-style: auto;
	padding: 1rem;
	margin: revert;
}

.lesson-content img {
	border: 1px solid theme('colors.gray.200');
	border-radius: 0.5rem;
}

.lesson-content code {
	display: block;
	overflow-x: auto;
	padding: 1rem 1.25rem;
	background: #011627;
	color: #d6deeb;
	border-radius: 0.5rem;
	margin: 1rem 0;
}

.lesson-content a {
	color: theme('colors.gray.900');
	text-decoration: underline;
	font-weight: 500;
}

.embed-tool__caption,
.cdx-simple-image__caption {
	display: none;
}

.ce-block__content {
	max-width: unset;
}

.codex-editor__redactor {
	padding-bottom: 0px !important;
}

.codeBoxHolder {
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;
}

.codeBoxTextArea {
	width: 100%;
	min-height: 30px;
	padding: 10px;
	border-radius: 2px 2px 2px 0;
	border: none !important;
	outline: none !important;
	font: 14px monospace;
}

.codeBoxSelectDiv {
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;
	position: relative;
}

.codeBoxSelectInput {
	border-radius: 0 0 20px 2px;
	padding: 2px 26px;
	padding-top: 0;
	padding-inline-end: 0;
	text-align: start;
	cursor: pointer;
	border: none !important;
	outline: none !important;
}

.codeBoxSelectDropIcon {
	position: absolute !important;
	inset-inline-start: 10px !important;
	bottom: 0 !important;
	width: unset !important;
	height: unset !important;
	font-size: 16px !important;
}

.codeBoxSelectPreview {
	display: none;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;
	border-radius: 2px;
	box-shadow: 0 3px 15px -3px rgba(13, 20, 33, 0.13);
	position: absolute;
	top: 100%;
	margin: 5px 0;
	max-height: 30vh;
	overflow-x: hidden;
	overflow-y: auto;
	z-index: 10000;
}

.codeBoxSelectItem {
	width: 100%;
	padding: 5px 20px;
	margin: 0;
	cursor: pointer;
}

.codeBoxSelectItem:hover {
	opacity: 0.7;
}

.codeBoxSelectedItem {
	background-color: lightblue !important;
}

.codeBoxShow {
	display: flex !important;
}

.dark {
	color: #abb2bf;
	background-color: #282c34;
}

.light {
	color: #383a42;
	background-color: #fafafa;
}

.codeBoxTextArea {
	line-height: 1.7;
}

.tc-table {
	border-inline-start: 1px solid #e8e8eb;
}

.plyr__volume input[type='range'] {
	display: none;
}

.plyr__control--overlaid {
	background: radial-gradient(
		circle,
		rgba(0, 0, 0, 0.4) 0%,
		rgba(0, 0, 0, 0.5) 50%
	);
}

.plyr__control:hover {
	background: none;
}

.plyr--video {
	border: 1px solid theme('colors.gray.200');
	border-radius: 8px;
}

:root {
	--plyr-range-fill-background: white;
	--plyr-video-control-background-hover: transparent;
}
</style>
