<template>
	<div class="flex h-full flex-col">
		<LayoutHeader :isLoading="!course.data">
			<template #left-header>
				<Breadcrumbs class="h-7" :items="breadcrumbs" />
				<Badge v-if="course.data?.published" theme="green">
					{{ __('Published') }}
				</Badge>
			</template>
			<template #right-header>
				<template v-if="tabIndex === 3 && courseFormRef">
					<Badge v-if="courseFormRef.isDirty" theme="orange">
						{{ __('Not Saved') }}
					</Badge>
					<Dropdown
						:options="courseFormRef.courseMenu"
						:button="{ icon: 'lucide-ellipsis', variant: 'ghost' }"
						side="bottom"
						align="end"
					/>
					<Tooltip
						:text="courseFormRef.isDirty ? '' : __('No changes to save')"
						:hoverDelay="0.1"
					>
						<Button
							variant="solid"
							:disabled="!courseFormRef.isDirty"
							@click="courseFormRef.submitCourse()"
						>
							{{ __('Save') }}
						</Button>
					</Tooltip>
				</template>
				<template v-if="tabIndex === 2 && editorSelected">
					<template v-if="editorMode === 'edit'">
						<Badge v-if="courseEditorRef?.isDirty" theme="orange">
							{{ __('Not Saved') }}
						</Badge>
						<Tooltip
							:text="courseEditorRef?.isDirty ? '' : __('No changes to save')"
							:hoverDelay="0.1"
						>
							<Button
								variant="solid"
								:disabled="!courseEditorRef?.isDirty"
								@click="courseEditorRef?.saveSelectedLesson()"
							>
								{{ __('Save') }}
							</Button>
						</Tooltip>
					</template>
					<template v-else-if="editorMode === 'preview'">
						<Tooltip v-if="courseEditorRef?.canGoZen" :text="__('Zen Mode')">
							<Button @click="courseEditorRef?.previewZen()">
								<template #icon>
									<Focus class="size-4 stroke-2" />
								</template>
							</Button>
						</Tooltip>
						<Button
							v-if="courseEditorRef?.hasPrev"
							@click="courseEditorRef?.previewPrev()"
						>
							<template #prefix>
								<ChevronLeft class="size-4 stroke-1.5" />
							</template>
							{{ __('Previous') }}
						</Button>
						<Button
							v-if="courseEditorRef?.hasNext"
							@click="courseEditorRef?.previewNext()"
						>
							<template #suffix>
								<ChevronRight class="size-4 stroke-1.5" />
							</template>
							{{ __('Next') }}
						</Button>
					</template>
					<Button
						variant="outline"
						@click="editorMode = editorMode === 'preview' ? 'edit' : 'preview'"
					>
						<template #prefix>
							<X v-if="editorMode === 'preview'" class="size-4 stroke-1.5" />
							<Eye v-else class="size-4 stroke-1.5" />
						</template>
						{{ editorMode === 'preview' ? __('Close preview') : __('Preview') }}
					</Button>
				</template>
				<Button
					v-if="user.data?.is_moderator"
					:variant="course.data?.published ? 'subtle' : 'solid'"
					:theme="course.data?.published ? 'red' : 'gray'"
					:loading="publishToggle.loading"
					@click="togglePublishCourse"
				>
					{{ course.data?.published ? __('Unpublish') : __('Publish') }}
				</Button>
			</template>
		</LayoutHeader>

		<div v-if="!isAdmin" class="flex-1 min-h-0">
			<CourseOverview :course="course" />
		</div>
		<div v-else class="relative flex flex-1 min-h-0 flex-col">
			<Tabs :tabs="asFrappeUITabs(tabs)" v-model="tabIndex">
				<template #tab-panel="{ tab }">
					<template v-if="course.data">
						<CourseEditor
							v-if="asTabDef(tab).component === CourseEditor"
							ref="courseEditorRef"
							:course="course"
							v-model:selected="editorSelected"
							v-model:mode="editorMode"
						/>
						<CourseForm
							v-else-if="asTabDef(tab).component === CourseForm"
							ref="courseFormRef"
							:course="course"
						/>
						<component
							v-else
							:is="asTabDef(tab).component"
							:course="course"
						/>
					</template>
				</template>
			</Tabs>
			<div
				v-if="tabIndex === 2 && course.data && editorMode === 'edit'"
				class="pointer-events-none absolute inset-x-0 top-0 z-10 hidden md:flex"
			>
				<div class="w-[70%]" />
				<div
					class="pointer-events-auto flex w-[30%] items-center justify-between gap-x-2 border-s border-b bg-surface-white p-1 px-5"
				>
					<div class="py-2.5 font-medium text-base text-ink-gray-9">
						{{ __('Sessions') }}
					</div>
					<Dropdown :options="outlineActions" side="bottom" align="end">
						<Button size="sm">
							<template #prefix>
								<Plus class="size-4 stroke-1.5" />
							</template>
							{{ __('Add') }}
						</Button>
					</Dropdown>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	computed,
	getCurrentInstance,
	inject,
	markRaw,
	onMounted,
	ref,
	watch,
} from 'vue'
import type { Component, ComputedRef, Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { RouteLocationNormalizedLoadedGeneric, Router } from 'vue-router'
import {
	Badge,
	Breadcrumbs,
	Button,
	createResource,
	Dropdown,
	Tabs,
	Tooltip,
	toast,
	usePageMeta,
} from 'frappe-ui'
import {
	BookOpen,
	ChevronLeft,
	ChevronRight,
	Eye,
	Focus,
	List,
	Plus,
	Settings2,
	TrendingUp,
	X,
} from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import CourseDashboard from '@/pages/Courses/CourseDashboard.vue'
import CourseEditor from '@/pages/Courses/CourseEditor.vue'
import CourseForm from '@/pages/Courses/CourseForm.vue'
import type {
	CourseDetails,
	CourseInstructorInfo,
	Resource,
	SessionUser,
} from '@/types/api'

type Brand = { name?: string; logo?: string; favicon?: string }
interface TabDef {
	label: string
	component: ReturnType<typeof markRaw>
	icon: Component
}
type FrappeUITab = { label: string; icon?: string; route?: string }
const asFrappeUITabs = (defs: TabDef[]): FrappeUITab[] =>
	defs as unknown as FrappeUITab[]
const asTabDef = (tab: FrappeUITab): TabDef => tab as unknown as TabDef
type DialogAction = {
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

const { brand } = sessionStore() as { brand: Brand }
const { $dialog } = getCurrentInstance()!.appContext.config
	.globalProperties as unknown as { $dialog: DialogFn }
const router: Router = useRouter()
const route: RouteLocationNormalizedLoadedGeneric = useRoute()
const user = inject<SessionUser>('$user')!
const tabIndex: Ref<number> = ref(0)

interface EditorSelection {
	chapterNumber: string
	lessonNumber: string
	number: string
	title?: string
}

const editorSelected = ref<EditorSelection | null>(null)
const editorMode = ref<'edit' | 'preview'>('edit')

type CourseMenuItem = {
	label: string
	icon: string
	theme?: 'gray' | 'red'
	onClick: () => void
}
type CourseFormApi = {
	isDirty: Ref<boolean>
	submitCourse: () => void
	trashCourse: () => void
	courseMenu: ComputedRef<CourseMenuItem[]>
}
const courseFormRef = ref<CourseFormApi | null>(null)

type CourseEditorApi = {
	saveSelectedLesson: () => void
	isDirty: ComputedRef<boolean>
	hasPrev: ComputedRef<boolean>
	hasNext: ComputedRef<boolean>
	canGoZen: ComputedRef<boolean>
	previewPrev: () => void
	previewNext: () => void
	previewZen: () => void
	openAddChapter: () => void
	openAddModule: () => void
	openOrganizeModules: () => void
}
const courseEditorRef = ref<CourseEditorApi | null>(null)

const outlineActions = computed(() => [
	{
		label: __('Add Session'),
		icon: 'file-plus',
		onClick: () => courseEditorRef.value?.openAddChapter(),
	},
	{
		label: __('Add Module'),
		icon: 'folder-plus',
		onClick: () => courseEditorRef.value?.openAddModule(),
	},
	{
		label: __('Organize into Modules'),
		icon: 'layers',
		onClick: () => courseEditorRef.value?.openOrganizeModules(),
	},
])

const publishToggle = createResource({
	url: 'frappe.client.set_value',
	makeParams() {
		return {
			doctype: 'LMS Course',
			name: course.data?.name,
			fieldname: 'published',
			value: course.data?.published ? 0 : 1,
		}
	},
	onSuccess() {
		toast.success(
			course.data?.published ? __('Course unpublished') : __('Course published')
		)
		course.reload()
	},
	onError(err: { messages?: string[] } | string) {
		const msg =
			typeof err === 'string'
				? err
				: err.messages?.[0] ?? __('Could not update publish status')
		toast.error(msg)
	},
}) as Resource<unknown>

function togglePublishCourse() {
	const isPublished = Boolean(course.data?.published)
	$dialog({
		title: isPublished ? __('Unpublish this course?') : __('Publish this course?'),
		message: isPublished
			? __(
					'Unpublishing will hide this course from learners and stop new enrollments. You can publish it again at any time.'
			  )
			: __(
					'Publishing will make this course visible to learners and open it for enrollment. Make sure its content is ready.'
			  ),
		actions: [
			{
				label: isPublished ? __('Unpublish') : __('Publish'),
				theme: isPublished ? 'red' : 'gray',
				variant: 'solid',
				onClick(close: () => void) {
					publishToggle.submit()
					close()
				},
			},
		],
	})
}

const props = defineProps<{
	courseName: string
}>()

onMounted(() => {
	updateTabIndex()
})

const updateTabIndex = () => {
	const hash = route.hash
	if (hash) {
		tabs.value.forEach((tab, index) => {
			if (tab.label?.toLowerCase() === hash.replace('#', '')) {
				tabIndex.value = index
			}
		})
	}
}

watch(tabIndex, () => {
	const tab = tabs.value[tabIndex.value]
	if (tab.label != route.hash.replace('#', '')) {
		router.push({ ...route, hash: `#${tab.label.toLowerCase()}` })
	}
})

watch(() => route.hash, updateTabIndex)

const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	cache: ['course', props.courseName],
	makeParams() {
		return {
			course: props.courseName,
		}
	},
	auto: true,
}) as Resource<CourseDetails | null>

const tabs = ref<TabDef[]>([
	{
		label: __('Overview'),
		component: markRaw(CourseOverview),
		icon: markRaw(List),
	},
	{
		label: __('Dashboard'),
		component: markRaw(CourseDashboard),
		icon: markRaw(TrendingUp),
	},
	{
		label: __('Course editor'),
		component: markRaw(CourseEditor),
		icon: markRaw(BookOpen),
	},
	{
		label: __('Settings'),
		component: markRaw(CourseForm),
		icon: markRaw(Settings2),
	},
])

watch(
	() => props.courseName,
	() => {
		course.reload()
	}
)

watch(course, () => {
	if (!isAdmin.value && !course.data?.published && !course.data?.upcoming) {
		router.push({
			name: 'Courses',
		})
	}
})

const isInstructor = (): boolean => {
	let user_is_instructor = false
	course.data?.instructors.forEach((instructor: CourseInstructorInfo) => {
		if (!user_is_instructor && instructor.name == user.data?.name) {
			user_is_instructor = true
		}
	})
	return user_is_instructor
}

const isAdmin = computed<boolean>(() => {
	return Boolean(user.data?.is_moderator) || isInstructor()
})

const breadcrumbs = computed(() => {
	const crumbs: {
		label: string
		route: { name: string; params?: Record<string, string> }
	}[] = [{ label: __('Courses'), route: { name: 'Courses' } }]
	if (course.data) {
		crumbs.push({
			label: course.data.title,
			route: { name: 'CourseDetail', params: { courseName: course.data.name } },
		})
	}
	return crumbs
})

usePageMeta(() => {
	return {
		title: course.data?.title,
		icon: brand.favicon,
	}
})
</script>

<style scoped>

:deep([role='tablist']) {
	flex-shrink: 0;
}


:deep([role='tabpanel'][data-state='active']) {
	flex: 1 1 0%;
	min-height: 0;
}
</style>
