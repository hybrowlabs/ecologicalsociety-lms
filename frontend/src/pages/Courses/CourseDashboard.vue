<template>
	<div class="p-5">
		<div
			v-if="courseBatches.data?.length"
			class="flex items-center justify-between gap-3 mb-5"
			data-testid="batch-filter"
		>
			<div class="text-sm text-ink-gray-5">
				{{
					selectedBatch
						? __('Showing progress for {0}').format(selectedBatchLabel)
						: __('Showing progress for all students')
				}}
			</div>
			<Select
				:modelValue="selectedBatch"
				:options="batchOptions"
				:placeholder="__('All students')"
				class="!w-64"
				@update:modelValue="
					(value: SelectOptionValue | undefined) =>
						(selectedBatch = String(value || ''))
				"
			/>
		</div>
		<div class="grid grid-cols-4 gap-5 mb-5 text-ink-gray-9">
			<NumberChartGraph
				:title="selectedBatch ? __('Enrolled (batch)') : __('Enrolled')"
				:value="formatAmount(enrolledCount)"
			/>
			<NumberChartGraph
				:title="__('Average Completion Rate')"
				:value="averageCompletionRate"
			/>
			<NumberChartGraph
				:title="__('Average Rating')"
				:value="course.data?.rating || 0"
			>
				<template #prefix>
					<Star class="size-5 text-transparent fill-amber-500" />
				</template>
			</NumberChartGraph>
			<NumberChartGraph :title="__('Lessons')" :value="course.data?.lessons" />
		</div>
		<div class="grid grid-cols-[2fr_1fr] gap-5 items-start">
			<div class="border rounded-lg py-3 px-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-lg text-ink-gray-9 font-semibold">
						{{ __('Students') }}
					</div>
					<div class="flex items-center gap-x-2">
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search by name')"
							type="text"
						/>
						<Button :loading="downloading" @click="downloadProgress">
							<template #prefix>
								<Download class="size-4 stroke-1.5" />
							</template>
							{{ __('Download') }}
						</Button>
						<Button @click="showEnrollmentModal = true">
							<template #prefix>
								<Plus class="size-4 stroke-1.5" />
							</template>
							{{ __('Enroll') }}
						</Button>
					</div>
				</div>
				<ProgressRangeFilter
					v-model:band="progressBand"
					v-model:min="minProgress"
					v-model:max="maxProgress"
					v-model:sort="studentSort"
					:total="students.data?.total"
				/>
				<div
					v-if="students.loading || studentRows.length"
					class="max-h-[63vh] overflow-y-auto"
				>
					<ListView
						:columns="progressColumns"
						:rows="studentRows"
						rowKey="name"
						:options="{
							selectable: false,
							showTooltip: false,
						}"
					>
						<ListHeader
							class="mb-2 grid items-center gap-x-4 rounded bg-surface-white border-b rounded-none p-2"
						>
							<ListHeaderItem
								:item="item"
								v-for="item in progressColumns"
								:key="item.key"
							>
							</ListHeaderItem>
						</ListHeader>
						<ListRows v-for="row in studentRows" class="max-h-[500px]">
							<ListRow
								:row="row"
								@click="
									() => {
										showProgressModal = true
										currentStudent = row
									}
								"
								class="cursor-pointer"
							>
								<template #default="{ column, item }">
									<ListRowItem
										:item="row[column.key]"
										:align="column.align"
										class="w-full"
									>
										<template #prefix>
											<div v-if="column.key == 'member_name'">
												<Avatar
													class="flex items-center"
													:image="row['member_image']"
													:label="item"
													size="sm"
												/>
											</div>
											<ProgressBar
												v-else-if="column.key == 'progress'"
												:progress="Math.ceil(row[column.key])"
												class="!mx-0 !me-4"
											/>
										</template>
										<div v-if="column.key == 'creation'">
											{{ dayjs(row[column.key]).format('DD MMM YYYY') }}
										</div>
										<div
											v-else-if="column.key == 'progress'"
											class="text-xs !mx-0 w-9 shrink-0 text-right"
										>
											{{ Math.ceil(row[column.key]) }}%
										</div>
										<div
											v-else-if="column.key == 'actions'"
											class="flex justify-end w-full"
										>
											<Button
												theme="red"
												variant="ghost"
												:label="__('Remove')"
												@click.stop="confirmRemove(row)"
											>
												<template #prefix>
													<Trash2 class="size-4 stroke-1.5" />
												</template>
											</Button>
										</div>
										<div v-else>
											{{ row[column.key].toString() }}
										</div>
									</ListRowItem>
								</template>
							</ListRow>
						</ListRows>
					</ListView>
					<div
						v-if="studentRows.length < (students.data?.total || 0)"
						class="flex justify-center my-3"
					>
						<Button :loading="students.loading" @click="loadMoreStudents">
							{{ __('Load More') }}
						</Button>
					</div>
				</div>
				<div
					v-else-if="hasActiveFilters || selectedBatch"
					class="text-center text-sm text-ink-gray-5 py-8"
					data-testid="no-students-match"
				>
					{{ __('No students match these filters.') }}
				</div>
			</div>
			<div class="space-y-5">
				<div
					v-if="chartDetails.data?.average_progress > 0"
					class="border rounded-lg p-4"
				>
					<div class="text-ink-gray-5 mb-4">
						{{ __('Progress Summary') }}
					</div>
					<div
						class="grid grid-cols-[2fr_1fr] items-center justify-between text-ink-gray-9"
					>
						<div class="flex flex-col space-y-4 flex-1 text-sm">
							<div
								class="flex items-center text-ink-gray-7 cursor-pointer rounded px-1 -mx-1 hover:bg-surface-gray-2"
								:class="{
									'bg-surface-gray-3 font-medium':
										progressBand === BAND_ORDER[index],
								}"
								v-for="(row, index) in chartDetails.data?.progress_distribution"
								:key="row.name"
								:data-testid="'band-' + BAND_ORDER[index]"
								@click="toggleBand(BAND_ORDER[index])"
							>
								<div
									class="size-2 rounded"
									:style="{
										backgroundColor:
											colors[theme][
												row.name.startsWith('Just')
													? 'red'
													: row.name.startsWith('In')
														? 'amber'
														: row.name.startsWith('Adv')
															? 'blue'
															: 'green'
											][400],
									}"
								></div>
								<Tooltip :text="row.name.split('(')[1].replace(')', '')">
									<div class="ms-2">
										{{ row.name.split('(')[0] }}
									</div>
								</Tooltip>
								<Tooltip :text="String(row.value)">
									<div class="ms-auto">
										{{ Math.round((row.value / (enrolledCount || 1)) * 100) }}%
									</div>
								</Tooltip>
							</div>
						</div>
						<ECharts
							class="w-40 h-20 cursor-pointer"
							:events="{
								click: (params: any) =>
									toggleBand(BAND_ORDER[params.dataIndex]),
							}"
							:options="{
								color: progressColors,
								series: [
									{
										type: 'pie',
										radius: ['50%', '70%'],
										center: ['50%', '50%'],
										label: {
											show: false,
										},
										labelLine: {
											show: false,
										},
										emphasis: {
											label: {
												show: false,
											},
											scale: false,
										},
										data: chartDetails.data?.progress_distribution || [],
									},
								],
								showInlineLabels: false,
							}"
						/>
					</div>
				</div>
				<div
					v-if="lessonProgress.data?.length"
					class="border rounded-lg pt-4 px-4"
				>
					<div class="flex items-center justify-between mb-4">
						<div class="text-ink-gray-5">
							{{ __('Lesson Completion') }}
						</div>
						<Select
							:options="lessonProgressSortingOptions"
							@update:modelValue="
								(value: SelectOptionValue | undefined) =>
									updateLessonProgress(String(value))
							"
							:placeholder="__('Sort by')"
							class="!w-32"
						/>
					</div>
					<div
						class="divide-y max-h-[40vh] divide-outline-gray-modals text-ink-gray-7 overflow-y-auto"
					>
						<div
							v-for="progress in lessonProgress.data"
							class="flex justify-between text-sm py-2 my-1 text-ink-gray-9"
						>
							<div class="">
								<span class="me-3 text-xs">
									{{ progress.chapter_idx }}.{{ progress.idx }}
								</span>
								<span>
									{{ progress.title }}
								</span>
							</div>
							<Tooltip :text="String(progress.completion_count)">
								<div>
									{{
										Math.ceil(
											(progress.completion_count / (enrolledCount || 1)) * 100,
										)
									}}%
								</div>
							</Tooltip>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<CourseEnrollmentModal
		v-if="showEnrollmentModal"
		v-model="showEnrollmentModal"
		:course="course"
		:students="enrollmentRefresher"
	/>
	<StudentCourseProgress
		v-if="showProgressModal"
		v-model="showProgressModal"
		:course="course"
		:student="currentStudent"
		:lessons="lessonProgress"
	/>
</template>
<script setup lang="ts">
import {
	Avatar,
	Button,
	createResource,
	ECharts,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	Tooltip,
	call,
	toast,
} from 'frappe-ui'
import type { SelectOptionValue } from 'frappe-ui'
import Select from '@/components/Controls/Select.vue'
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type dayjsType from 'dayjs'
import { Download, Plus, Star, Trash2 } from 'lucide-vue-next'
import { createDialog } from '@/utils/dialogs'
import { formatAmount } from '@/utils'
import { downloadFile } from '@/utils/downloadFile'
import colors from '@/utils/frappe-ui-colors.json'
import CourseEnrollmentModal from '@/pages/Courses/CourseEnrollmentModal.vue'
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import StudentCourseProgress from '@/pages/Courses/StudentCourseProgress.vue'
import ProgressRangeFilter from '@/components/ProgressRangeFilter.vue'
import { useDebounceFn } from '@vueuse/core'
import { BAND_ORDER, exportParams } from '@/utils/progressRange'
import type { ProgressBand, StudentSort } from '@/utils/progressRange'

import type { CourseDetails, Resource } from '@/types/api'

const props = defineProps<{
	course: Resource<CourseDetails | null>
}>()

const __ =
	((window as any).__ as (text: string) => string) || ((text: string) => text)
const dayjs = inject<typeof dayjsType>('$dayjs')!
const showEnrollmentModal = ref<boolean>(false)
const searchFilter = ref<string | null>(null)
const showProgressModal = ref<boolean>(false)
const currentStudent = ref<Record<string, unknown> | null>(null)
const theme = ref<'darkMode' | 'lightMode'>(
	localStorage.getItem('theme') == 'dark' ? 'darkMode' : 'lightMode',
)
const progressBand = ref<ProgressBand>('')
const minProgress = ref<number | string | null>(null)
const maxProgress = ref<number | string | null>(null)
const studentSort = ref<StudentSort>('creation_desc')

const route = useRoute()
const router = useRouter()

// Batch filter: '' = all students, NO_BATCH = students in none of this
// course's batches, otherwise an LMS Batch name. Kept in the URL (?batch=).
const NO_BATCH = '__no_batch__'
const selectedBatch = ref<string>(String(route.query.batch || ''))

const courseBatches = createResource({
	url: 'lms.lms.api.get_course_batches',
	makeParams() {
		return { course: props.course.data?.name }
	},
	auto: true,
	onSuccess(data: any[]) {
		// Drop a stale ?batch= that no longer belongs to this course
		const valid = new Set([NO_BATCH, ...(data || []).map((b) => b.name)])
		if (selectedBatch.value && !valid.has(selectedBatch.value)) {
			selectedBatch.value = ''
		}
	},
})

const batchOptions = computed(() => [
	{ label: __('All students'), value: '' },
	...(courseBatches.data || []).map((b: any) => ({
		label: `${b.title} (${b.students})`,
		value: b.name,
	})),
	{ label: __('Not in any batch'), value: NO_BATCH },
])

const selectedBatchLabel = computed(() => {
	if (selectedBatch.value === NO_BATCH) return __('students not in any batch')
	const batch = (courseBatches.data || []).find(
		(b: any) => b.name === selectedBatch.value,
	)
	return batch?.title || selectedBatch.value
})

const hasActiveFilters = computed(() =>
	Boolean(searchFilter.value || progressBand.value),
)

const toggleBand = (band: ProgressBand | undefined) => {
	if (!band) return
	progressBand.value = progressBand.value === band ? '' : band
}

const chartDetails = createResource({
	url: 'lms.lms.api.get_course_progress_distribution',
	makeParams() {
		return {
			course: props.course.data?.name,
			batch: selectedBatch.value || undefined,
		}
	},
	auto: true,
})

// Students in the current filter (all students, or one batch's).
const enrolledCount = computed<number>(() =>
	chartDetails.data
		? chartDetails.data.enrolled
		: props.course.data?.enrollments || 0,
)

const PAGE_SIZE = 100
const pageLength = ref(PAGE_SIZE)

const students = createResource({
	url: 'lms.lms.api.get_course_students_progress',
	makeParams() {
		return {
			course: props.course.data?.name,
			batch: selectedBatch.value || undefined,
			search: searchFilter.value || undefined,
			progress_band: progressBand.value || undefined,
			min_progress: minProgress.value ?? undefined,
			max_progress: maxProgress.value ?? undefined,
			sort: studentSort.value,
			start: 0,
			page_length: pageLength.value,
		}
	},
	auto: true,
	onError(err: any) {
		toast.error(err?.messages?.[0] || __('Could not load students'))
	},
})

const studentRows = computed<any[]>(() => students.data?.students || [])

const loadMoreStudents = () => {
	pageLength.value += PAGE_SIZE
	students.reload()
}

const lessonProgress = createResource({
	url: 'lms.lms.api.get_lesson_completion_stats',
	makeParams() {
		return {
			course: props.course.data?.name,
			batch: selectedBatch.value || undefined,
		}
	},
	auto: true,
})

const updateLessonProgress = (value: string) => {
	if (value == 'completion_rate') {
		lessonProgress.data?.sort((a: any, b: any) => {
			const rateA = a.completion_count / (enrolledCount.value || 1)
			const rateB = b.completion_count / (enrolledCount.value || 1)
			return rateB - rateA
		})
	} else if (value == 'index') {
		lessonProgress.data?.sort((a: any, b: any) => {
			return a.chapter_idx - b.chapter_idx || a.idx - b.idx
		})
	}
}

const applyStudentFilters = () => {
	pageLength.value = PAGE_SIZE
	students.reload()
}
// Typing in search / min / max shouldn't fire a request per keystroke.
const applyStudentFiltersDebounced = useDebounceFn(applyStudentFilters, 300)

watch([searchFilter, minProgress, maxProgress], applyStudentFiltersDebounced)
watch([progressBand, studentSort], applyStudentFilters)

// Switching batch refreshes every widget and keeps the choice in the URL.
watch(selectedBatch, (batch) => {
	router.replace({
		query: { ...route.query, batch: batch || undefined },
		hash: route.hash,
	})
	pageLength.value = PAGE_SIZE
	students.reload()
	chartDetails.reload()
	lessonProgress.reload()
})

// After enrolling or removing a student, refresh everything on the page.
const refreshDashboard = () => {
	props.course.reload()
	students.reload()
	chartDetails.reload()
	lessonProgress.reload()
	courseBatches.reload()
}
const enrollmentRefresher = { reload: refreshDashboard }

const downloading = ref(false)

const downloadProgress = async () => {
	downloading.value = true
	try {
		await downloadFile(
			'/api/method/lms.lms.api.export_course_student_progress?course=' +
				encodeURIComponent(props.course.data?.name || '') +
				'&' +
				exportParams({
					search: searchFilter.value,
					band: progressBand.value,
					min: minProgress.value,
					max: maxProgress.value,
					sort: studentSort.value,
				}) +
				(selectedBatch.value
					? '&batch=' + encodeURIComponent(selectedBatch.value)
					: ''),
			'course_progress.xlsx',
		)
	} catch (err) {
		console.error(err)
		toast.error(__('Could not download student progress'))
	} finally {
		downloading.value = false
	}
}

const averageCompletionRate = computed(() => {
	let value = Math.ceil(chartDetails.data?.average_progress) || 0
	return value + '%'
})

const progressColors = computed(() => {
	let colorList = []
	colorList.push(colors[theme.value]['red'][400])
	colorList.push(colors[theme.value]['amber'][400])
	colorList.push(colors[theme.value]['blue'][400])
	colorList.push(colors[theme.value]['green'][400])
	return colorList
})

const progressColumns = computed(() => {
	return [
		{
			label: __('Name'),
			key: 'member_name',
			width: '40%',
		},
		{
			label: __('Progress'),
			key: 'progress',
			width: '30%',
		},
		{
			label: __('Enrolled On'),
			key: 'creation',
			align: 'right',
		},
		{
			label: '',
			key: 'actions',
			align: 'right',
			width: '10%',
		},
	]
})

// Remove a wrongly-enrolled learner from THIS course only (keeps their other
// courses and their user account). Backed by the moderator-only whitelisted
// method ecological_society.students.remove_member_from_course.
const confirmRemove = (row: Record<string, any>) => {
	createDialog({
		title: __('Remove Learner from Course'),
		message: __(
			'Remove {0} from this course? This deletes their enrollment, progress, quiz submissions and certificates for this course only. Other courses and their account are kept.',
		).format(row.member_name || row.member),
		actions: [
			{
				label: __('Remove'),
				theme: 'red',
				variant: 'solid',
				onClick(close: () => void) {
					call('ecological_society.students.remove_member_from_course', {
						course: props.course.data?.name,
						member: row.member,
					})
						.then(() => {
							refreshDashboard()
							toast.success(
								__('{0} removed from the course.').format(
									row.member_name || row.member,
								),
							)
						})
						.catch((err: any) => {
							toast.error(__(err.messages?.[0] || err))
							console.error(err)
						})
					close()
				},
			},
		],
	})
}

const lessonProgressSortingOptions = [
	{
		label: __('Lesson Index'),
		value: 'index',
		onClick() {
			updateLessonProgress('index')
		},
	},
	{
		label: __('Completion Rate'),
		value: 'completion_rate',
		onClick() {
			updateLessonProgress('completion_rate')
		},
	},
]
</script>
