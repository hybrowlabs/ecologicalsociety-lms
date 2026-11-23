<template>
	<div v-if="batch?.data" class="p-5">
		<div class="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
			<NumberChartGraph
				:title="__('Enrolled')"
				:value="formatAmount(batch.data?.students?.length) || 0"
			/>

			<NumberChartGraph
				:title="__('Certified')"
				:value="certificationCount.data || 0"
			/>

			<NumberChartGraph
				class="border rounded-md"
				:title="__('Courses')"
				:value="batch?.data?.courses?.length || 0"
			/>

			<NumberChartGraph
				class="border rounded-md"
				:title="__('Assessments')"
				:value="batch?.data?.assessments?.length || 0"
			/>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start">
			<div class="border rounded-lg py-3 px-4 order-2 lg:order-1">
				<div class="flex items-center justify-between gap-x-2 mb-3">
					<div class="text-lg text-ink-gray-9 font-semibold">
						{{ __('Students') }}
					</div>
					<div class="flex items-center gap-x-2">
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search by name')"
							type="text"
						/>
						<Button :loading="loadingLagging" @click="selectLagging">
							{{ __('Select lagging') }}
						</Button>
						<Button
							variant="solid"
							:disabled="!selectedMembers.size"
							@click="showMessageModal = true"
						>
							<template #prefix>
								<Mail class="size-4 stroke-1.5" />
							</template>
							{{ __('Message') }}
							<span v-if="selectedMembers.size">({{ selectedMembers.size }})</span>
						</Button>
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
					:total="studentTotal"
				/>
				<div
					v-if="batchStudents.loading || studentRows.length"
					class="max-h-[63vh] overflow-y-auto"
				>
					<ListView
						:columns="studentColumns"
						:rows="studentRows"
						rowKey="name"
						:options="{
							selectable: false,
							showTooltip: false,
							onRowClick: (row: any) => {
								currentStudent = row.member
								showProgressModal = true
							},
						}"
					>
						<ListHeader
							class="mb-2 grid items-center gap-x-4 rounded bg-surface-white border-b rounded-none p-2"
						>
							<ListHeaderItem
								:item="item"
								v-for="item in studentColumns"
								:key="item.key"
							>
								<template v-if="item.key == 'select'" #default>
									<input
										type="checkbox"
										class="cursor-pointer"
										:checked="allLoadedSelected"
										@click.stop
										@change="toggleAllLoaded"
									/>
								</template>
							</ListHeaderItem>
						</ListHeader>
						<ListRows v-for="row in studentRows" class="max-h-[500px]">
							<ListRow :row="row">
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
										<div v-if="column.key == 'select'" @click.stop>
											<input
												type="checkbox"
												class="cursor-pointer"
												:checked="selectedMembers.has(row.member)"
												@change="toggleMember(row.member)"
											/>
										</div>
										<div v-else-if="column.key == 'creation'">
											{{ dayjs(row[column.key]).format('DD MMM YYYY') }}
										</div>
										<div
											v-else-if="column.key == 'progress'"
											class="text-xs !mx-0 w-9 shrink-0 text-right"
										>
											{{ Math.ceil(row[column.key]) }}%
										</div>
										<div
											v-else-if="column.key == 'remove'"
											class="flex justify-end"
										>
											<Button
												variant="ghost"
												:tooltip="__('Remove student from batch')"
												@click.stop="promptRemoveStudent(row)"
											>
												<template #icon>
													<Trash2 class="size-4 text-ink-red-3" />
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
						v-if="studentRows.length < (studentTotal || 0)"
						class="flex justify-center my-3"
					>
						<Button :loading="batchStudents.loading" @click="loadStudents(false)">
							{{ __('Load More') }}
						</Button>
					</div>
				</div>
				<div
					v-else-if="searchFilter || progressBand"
					class="text-center text-sm text-ink-gray-5 py-8"
					data-testid="no-students-match"
				>
					{{ __('No students match these filters.') }}
				</div>
			</div>

			<div class="order-1 lg:order-2">
				<AxisChart
					v-if="showProgressChart"
					class="border rounded-lg p-3 min-h-[300px]"
					:config="{
						data: filteredChartData,
						title: __('Batch Summary'),
						subtitle: __('Progress of students in courses and assessments'),
						xAxis: {
							key: 'task',
							title: 'Tasks',
							type: 'category',
						},
						yAxis: {
							title: __('Number of Students'),
							echartOptions: {
								minInterval: 1,
							},
						},
						series: [
							{
								name: 'value',
								type: 'bar',
							},
						],
					}"
				/>

				<div class="p-4 border rounded-lg mt-5">
					<BatchFeedback
						v-if="batch.data"
						:batch="batch.data.name"
						:feedbackAvailable="true"
					/>
				</div>
			</div>
		</div>
	</div>
	<StudentModal
		v-if="showEnrollmentModal"
		v-model="showEnrollmentModal"
		:batch="batch"
		:students="students"
	/>
	<BatchMessageModal
		v-if="showMessageModal"
		v-model="showMessageModal"
		:batch="batch?.data?.name"
		:recipients="selectedRecipients"
		@sent="selectedMembers = new Set()"
	/>
	<BatchStudentProgress
		v-if="showProgressModal"
		v-model="showProgressModal"
		:student="currentStudent"
		:batch="batch?.data?.name"
	/>
	<Dialog
		v-model="showRemoveDialog"
		:options="{
			title: __('Remove Student'),
			message: __(
				'Remove {0} from this batch? This also revokes the course access the batch granted them.'
			).format(studentToRemove?.member_name || studentToRemove?.member || ''),
			size: 'sm',
			actions: [
				{
					label: __('Remove'),
					variant: 'solid',
					theme: 'red',
					onClick: confirmRemoveStudent,
				},
				{
					label: __('Cancel'),
					onClick: closeRemoveDialog,
				},
			],
		}"
	/>
</template>
<script setup lang="ts">
import {
	AxisChart,
	call,
	createResource,
	createListResource,
	Dialog,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	Avatar,
	Button,
	toast,
} from 'frappe-ui'
import { computed, inject, ref, watch } from 'vue'
import type dayjsType from 'dayjs'
import { formatAmount } from '@/utils'
import { downloadFile } from '@/utils/downloadFile'
import { Download, Mail, Plus, Trash2 } from 'lucide-vue-next'
import BatchFeedback from '@/pages/Batches/components/BatchFeedback.vue'
import BatchStudentProgress from '@/pages/Batches/components/BatchStudentProgress.vue'
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import BatchMessageModal from '@/components/Modals/BatchMessageModal.vue'
import StudentModal from '@/components/Modals/StudentModal.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import ProgressRangeFilter from '@/components/ProgressRangeFilter.vue'
import { useDebounceFn } from '@vueuse/core'
import { exportParams } from '@/utils/progressRange'
import type { ProgressBand, StudentSort } from '@/utils/progressRange'

const dayjs = inject<typeof dayjsType>('$dayjs')!
const searchFilter = ref<string | null>(null)
const showEnrollmentModal = ref<boolean>(false)
const showProgressModal = ref<boolean>(false)
const currentStudent = ref<any>(null)

const props = defineProps<{
	batch: { [key: string]: any } | null
}>()

const chartData = createResource({
	url: 'lms.lms.utils.get_batch_chart_data',
	cache: ['batch_chart_data', props.batch?.data?.name],
	params: { batch: props.batch?.data?.name },
	auto: true,
})

const certificationCount = createResource({
	url: 'frappe.client.get_count',
	cache: ['batch_certificate_count', props.batch?.data?.name],
	params: {
		doctype: 'LMS Certificate',
		filters: { batch_name: props.batch?.data?.name },
	},
	auto: true,
})

// Kept for StudentModal, which enrolls through `students.insert`; the insert
// refetches this resource, and the watcher below then refreshes the list.
const students = createListResource({
	doctype: 'LMS Batch Enrollment',
	filters: {
		batch: props.batch?.data?.name,
	},
	fields: ['name'],
	pageLength: 1,
})

const PAGE_LENGTH = 50
const progressBand = ref<ProgressBand>('')
const minProgress = ref<number | string | null>(null)
const maxProgress = ref<number | string | null>(null)
const studentSort = ref<StudentSort>('creation_desc')
const studentRows = ref<any[]>([])
const studentTotal = ref<number | null>(null)

const filterParams = () => ({
	batch: props.batch?.data?.name,
	search: searchFilter.value || null,
	progress_band: progressBand.value || null,
	min_progress: progressBand.value === 'custom' ? minProgress.value : null,
	max_progress: progressBand.value === 'custom' ? maxProgress.value : null,
	sort: studentSort.value,
})

// Batch progress = average course progress across the batch's courses,
// computed server-side so filtering, sorting and paging stay consistent.
const batchStudents = createResource({
	url: 'lms.lms.api.get_batch_students_progress',
})

let requestId = 0
const loadStudents = (reset = true) => {
	const id = ++requestId
	const start = reset ? 0 : studentRows.value.length
	return batchStudents
		.submit({ ...filterParams(), start, page_length: PAGE_LENGTH })
		.then((data: { students: any[]; total: number }) => {
			// Ignore responses from a filter the user has already changed.
			if (id !== requestId) return
			studentRows.value = reset
				? data.students
				: [...studentRows.value, ...data.students]
			studentTotal.value = data.total
		})
		.catch((err: any) => {
			if (id !== requestId) return
			toast.error(err?.messages?.[0] || __('Could not load students'))
		})
}

loadStudents()

watch(
	() => students.data,
	(newData) => {
		// This resource is only ever fetched by a StudentModal insert, so any
		// data here means a student was just enrolled.
		if (newData) loadStudents()
	}
)

const filteredChartData = computed(() =>
	(chartData.data || []).filter((item: { value: number }) => item.value > 0)
)

const loadStudentsDebounced = useDebounceFn(() => loadStudents(), 300)
watch([searchFilter, minProgress, maxProgress], loadStudentsDebounced)
watch([progressBand, studentSort], () => loadStudents())

const showMessageModal = ref(false)
const selectedMembers = ref<Set<string>>(new Set())
const knownStudents = ref<Record<string, any>>({})
const loadingLagging = ref(false)

const selectedRecipients = computed(() =>
	[...selectedMembers.value].map(
		(member) => knownStudents.value[member] || { member }
	)
)

const allLoadedSelected = computed(
	() =>
		studentRows.value.length > 0 &&
		studentRows.value.every((r) => selectedMembers.value.has(r.member))
)

const toggleMember = (member: string) => {
	const next = new Set(selectedMembers.value)
	next.has(member) ? next.delete(member) : next.add(member)
	selectedMembers.value = next
}

const toggleAllLoaded = () => {
	const next = new Set(selectedMembers.value)
	const select = !allLoadedSelected.value
	studentRows.value.forEach((r) => (select ? next.add(r.member) : next.delete(r.member)))
	selectedMembers.value = next
}

watch(studentRows, (rows) => {
	rows.forEach((r) => (knownStudents.value[r.member] = r))
})

// Selects every student whose batch progress is below the lagging threshold,
// across all pages, not only the rows loaded so far.
const selectLagging = async () => {
	loadingLagging.value = true
	try {
		const lagging = await call('lms.lms.api.get_lagging_students', {
			batch: props.batch?.data?.name,
		})
		lagging.forEach((s: any) => (knownStudents.value[s.member] = s))
		selectedMembers.value = new Set(lagging.map((s: any) => s.member))
		if (!lagging.length) toast.info(__('No students are lagging behind.'))
	} catch (err: any) {
		toast.error(err?.messages?.[0] || __('Could not load lagging students'))
	} finally {
		loadingLagging.value = false
	}
}

const studentColumns = computed(() => {
	return [
		{
			label: '',
			key: 'select',
			width: '40px',
		},
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
			key: 'remove',
			align: 'right',
			width: '60px',
		},
	]
})

const showRemoveDialog = ref(false)
const studentToRemove = ref<any>(null)

function promptRemoveStudent(row: any) {
	studentToRemove.value = row
	showRemoveDialog.value = true
}

function closeRemoveDialog() {
	showRemoveDialog.value = false
}

function confirmRemoveStudent() {
	const row = studentToRemove.value
	if (!row) return
	return call('ecological_society.batch.remove_student_from_batch', {
		batch: props.batch?.data?.name,
		member: row.member,
	})
		.then(() => {
			toast.success(__('Student removed from batch'))
			showRemoveDialog.value = false
			loadStudents()
		})
		.catch((e: any) => {
			toast.error(e?.messages?.[0] || __('Could not remove student'))
		})
}

const downloading = ref(false)

async function downloadProgress() {
	downloading.value = true
	try {
		await downloadFile(
			'/api/method/lms.lms.api.export_batch_student_progress?batch=' +
				encodeURIComponent(props.batch?.data?.name) +
				'&' +
				exportParams({
					search: searchFilter.value,
					band: progressBand.value,
					min: minProgress.value,
					max: maxProgress.value,
					sort: studentSort.value,
				}),
			'batch_progress.xlsx'
		)
	} catch (err) {
		console.error(err)
		toast.error(__('Could not download student progress'))
	} finally {
		downloading.value = false
	}
}

const showProgressChart = computed(
	() =>
		props.batch?.data?.students?.length &&
		(props.batch?.data?.courses?.length ||
			props.batch?.data?.assessments?.length)
)
</script>
