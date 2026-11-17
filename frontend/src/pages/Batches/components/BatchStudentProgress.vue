<template>
	<Dialog
		v-model="show"
		:options="{
			size: '3xl',
			title: studentDetails.data?.full_name || __('Student Details'),
		}"
	>
		<template #body>
			<div
				v-if="studentDetails.loading && !studentDetails.data"
				class="flex items-center justify-center py-12"
			>
				<LoadingIndicator class="size-4" />
			</div>
			<div v-else-if="studentDetails.data" class="p-5 space-y-10 text-sm">
				<div class="flex items-center gap-x-2">
					<Avatar :image="studentDetails.data.user_image" size="3xl" />
					<div class="space-y-1">
						<div class="flex items-center gap-x-2">
							<div class="text-xl font-semibold text-ink-gray-9">
								{{ studentDetails.data.full_name }}
							</div>
							<Badge
								v-if="
									Object.keys(studentDetails.data.assessments).length ||
									Object.keys(studentDetails.data.courses).length
								"
								:theme="studentDetails.data.progress === 100 ? 'green' : 'red'"
							>
								{{ studentDetails.data.progress }}% {{ __('Complete') }}
							</Badge>
						</div>
						<div class="text-sm text-ink-gray-7">
							{{ studentDetails.data.email }}
						</div>
					</div>
				</div>

				<div class="space-y-8">
					<!-- Assessments -->
					<ListView
						:columns="assessmentColumns"
						:rows="studentDetails.data.assessments"
						row-key="title"
						class="border border-outline-gray-modals rounded-lg"
						:options="{
							selectable: false,
							showTooltip: false,
							onRowClick: (row: any) => {
								redirectToAssessment(row)
							}
						}"
					>
						<ListHeader
							class="mb-2 grid items-center gap-x-4 rounded-none rounded-t bg-surface-gray-2 p-2"
						>
						</ListHeader>
						<ListRows v-for="row in studentDetails.data.assessments">
							<ListRow :row="row" class="!rounded-none">
								<template #default="{ column, item }">
									<ListRowItem
										:item="row[column.key]"
										:align="column.align"
										class="w-full"
									>
										<div
											v-if="column.key == 'details'"
											class="text-xs text-ink-gray-5"
											data-testid="assessment-details"
										>
											{{ assessmentDetail(row) }}
										</div>
										<div
											v-else-if="column.key == 'status' && isAssignment(row.status)"
										>
											<Badge :theme="getStatusTheme(row[column.key])">
												{{ row[column.key] }}
											</Badge>
										</div>
										<div v-else>
											{{ row[column.key] }}
										</div>
									</ListRowItem>
								</template>
							</ListRow>
						</ListRows>
					</ListView>

					<!-- Courses -->
					<ListView
						:columns="courseColumns"
						:rows="studentDetails.data.courses"
						row-key="title"
						class="border border-outline-gray-modals rounded-lg"
						:options="{
							selectable: false,
							showTooltip: false,
							onRowClick: (row: any) => {
								redirectToCourse(row)
							}
						}"
					>
						<ListHeader
							class="mb-2 grid items-center gap-x-4 rounded-none rounded-t bg-surface-gray-2 p-2"
						>
						</ListHeader>
						<ListRows v-for="row in studentDetails.data.courses">
							<ListRow :row="row" class="!rounded-none">
								<template #default="{ column, item }">
									<ListRowItem
										:item="row[column.key]"
										:align="column.align"
										class="w-full"
									>
										<template #prefix>
											<ProgressBar
												v-if="column.key == 'progress'"
												:progress="Math.ceil(row[column.key])"
												class="!mx-0 !me-4 max-w-32"
											/>
										</template>
										<div
											v-if="column.key == 'progress'"
											class="text-xs !ms-0 !me-3 w-5"
										>
											{{ Math.ceil(row[column.key]) }}%
										</div>
										<Button
											v-else-if="column.key == 'actions'"
											size="sm"
											@click.stop="openLessonProgress(row)"
										>
											{{ __('Mark complete') }}
										</Button>
										<div v-else>
											{{ row[column.key] }}
										</div>
									</ListRowItem>
								</template>
							</ListRow>
						</ListRows>
					</ListView>

					<!-- Quiz attempts per question and assignment upload dates -->
					<div
						v-if="detailGroups.length"
						class="space-y-2"
						data-testid="assessment-detail-groups"
					>
						<div class="text-base font-medium text-ink-gray-9">
							{{ __('Quiz & assignment details') }}
						</div>
						<div
							v-for="group in detailGroups"
							:key="group.key"
							class="border border-outline-gray-modals rounded-lg"
						>
							<button
								type="button"
								class="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-ink-gray-8 hover:bg-surface-gray-1 rounded-lg"
								:aria-expanded="Boolean(openGroups[group.key])"
								data-testid="assessment-group-toggle"
								@click="toggleGroup(group)"
							>
								<span>{{ group.title }}</span>
								<ChevronDown
									class="size-4 transition-transform"
									:class="{ 'rotate-180': openGroups[group.key] }"
								/>
							</button>
							<div v-if="openGroups[group.key]" class="px-3 pb-3">
								<div
									v-if="group.course && courseAssessments[group.course]?.loading"
									class="flex justify-center py-4"
								>
									<LoadingIndicator class="size-4" />
								</div>
								<template v-else>
									<StudentAssessmentPanels
										:quizzes="groupQuizzes(group)"
										:assignments="groupAssignments(group)"
									/>
									<div
										v-if="
											!groupQuizzes(group).length &&
											!groupAssignments(group).length
										"
										class="text-sm text-ink-gray-5 py-2"
									>
										{{ __('No quizzes or assignments.') }}
									</div>
								</template>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
	<MemberLessonProgressModal
		v-if="lessonProgressCourse"
		v-model="showLessonProgress"
		:course="lessonProgressCourse.course"
		:courseTitle="lessonProgressCourse.title"
		:member="student"
		:memberName="studentDetails.data?.full_name"
		@updated="studentDetails.reload()"
	/>
</template>
<script setup lang="ts">
import {
	Avatar,
	Badge,
	Button,
	createResource,
	Dialog,
	ListView,
	ListHeader,
	ListRows,
	ListRow,
	ListRowItem,
	LoadingIndicator,
} from 'frappe-ui'
import { computed, inject, reactive, ref } from 'vue'
import type dayjsType from 'dayjs'
import { ChevronDown } from 'lucide-vue-next'
import StudentAssessmentPanels from '@/components/StudentAssessmentPanels.vue'
import { useRouter } from 'vue-router'
import ProgressBar from '@/components/ProgressBar.vue'
import MemberLessonProgressModal from '@/components/Modals/MemberLessonProgressModal.vue'

const show = defineModel()
const router = useRouter()
const user = inject<any>('$user')
const showLessonProgress = ref(false)
const lessonProgressCourse = ref<any>(null)
const props = defineProps<{
	student: string
	batch: string
}>()

const studentDetails = createResource({
	url: 'lms.lms.utils.get_batch_student_progress',
	makeParams() {
		return {
			member: props.student,
			batch: props.batch,
		}
	},
	auto: true,
})

const redirectToAssessment = (row: any) => {
	console.log(row)
	if (!row.submission) return
	if (row.type == 'LMS Assignment') {
		router.push({
			name: 'AssignmentSubmission',
			params: {
				assignmentID: row.assessment,
				submissionName: row.submission,
			},
		})
	} else if (row.type == 'LMS Programming Exercise') {
		router.push({
			name: 'ProgrammingExerciseSubmission',
			params: {
				exerciseID: row.assessment,
				submissionID: row.submission,
			},
		})
	} else if (row.type == 'LMS Quiz') {
		router.push({
			name: 'QuizSubmission',
			params: {
				submission: row.submission,
			},
		})
	}
}

const redirectToCourse = (row: any) => {
	router.push({
		name: 'CourseDetail',
		params: {
			courseName: row.course,
		},
	})
}

const assessmentColumns = [
	{ key: 'title', label: 'Assessment', align: 'left', width: '45%' },
	{ key: 'details', label: 'Attempts / Submitted', align: 'left' },
	{ key: 'status', label: 'Percentage/Status', align: 'right' },
]

const dayjs = inject<typeof dayjsType>('$dayjs')!

const assessmentDetail = (row: any) => {
	if (row.type === 'LMS Quiz') {
		const n = row.total_attempts || 0
		return n === 1 ? __('1 attempt') : __('{0} attempts').format(String(n))
	}
	if (row.type === 'LMS Assignment') {
		return row.submitted_on
			? __('Submitted {0}').format(dayjs(row.submitted_on).format('DD MMM YYYY'))
			: '-'
	}
	return ''
}

// One expandable group per batch course (loaded on first open), plus one for
// quizzes/assignments attached to the batch itself.
type DetailGroup = { key: string; title: string; course?: string }

const batchAssessments = computed(() =>
	(studentDetails.data?.assessments || []).filter((a: any) =>
		['LMS Quiz', 'LMS Assignment'].includes(a.type)
	)
)

const detailGroups = computed<DetailGroup[]>(() => {
	const groups: DetailGroup[] = (studentDetails.data?.courses || []).map(
		(c: any) => ({ key: `course:${c.course}`, title: c.title, course: c.course })
	)
	if (batchAssessments.value.length) {
		groups.push({ key: 'batch', title: __('Batch assessments') })
	}
	return groups
})

const openGroups = reactive<Record<string, boolean>>({})
const courseAssessments = reactive<Record<string, any>>({})

const toggleGroup = (group: DetailGroup) => {
	openGroups[group.key] = !openGroups[group.key]
	if (openGroups[group.key] && group.course && !courseAssessments[group.course]) {
		courseAssessments[group.course] = createResource({
			url: 'lms.lms.api.get_course_assessment_progress',
			params: { course: group.course, member: props.student, batch: props.batch },
			auto: true,
		})
	}
}

const bySequence = (rows: any[] = []) =>
	[...rows].sort(
		(a, b) => (a.chapter_idx || 0) - (b.chapter_idx || 0) || (a.idx || 0) - (b.idx || 0)
	)

const groupQuizzes = (group: DetailGroup) => {
	if (group.course) return bySequence(courseAssessments[group.course]?.data?.quizzes)
	return batchAssessments.value
		.filter((a: any) => a.type === 'LMS Quiz')
		.map((a: any) => ({
			quiz: a.assessment,
			quiz_title: a.title,
			total_attempts: a.total_attempts,
			questions: a.questions,
			score: '-',
			percentage: a.status,
		}))
}

const groupAssignments = (group: DetailGroup) => {
	if (group.course) return bySequence(courseAssessments[group.course]?.data?.assignments)
	return batchAssessments.value
		.filter((a: any) => a.type === 'LMS Assignment')
		.map((a: any) => ({
			assignment: a.assessment,
			assignment_title: a.title,
			status: a.status,
			submitted_on: a.submitted_on,
			last_uploaded_on: a.last_uploaded_on,
		}))
}

const canManageProgress = computed(
	() => user?.data?.is_moderator || user?.data?.is_evaluator
)

const courseColumns = computed(() => {
	if (!canManageProgress.value) {
		return [
			{ key: 'title', label: 'Course', align: 'left', width: '70%' },
			{ key: 'progress', label: 'Progress', align: 'right' },
		]
	}
	// The action button sizes to its label; title and progress share the rest.
	return [
		{ key: 'title', label: 'Course', align: 'left', width: 3 },
		{ key: 'progress', label: 'Progress', align: 'right', width: 2 },
		{ key: 'actions', label: '', align: 'right', width: 'max-content' },
	]
})

const openLessonProgress = (row: any) => {
	lessonProgressCourse.value = row
	showLessonProgress.value = true
}

const isAssignment = (value: any) => {
	return isNaN(value)
}

const getStatusTheme = (status: string) => {
	if (status === 'Pass') {
		return 'green'
	} else if (status == 'Not Graded') {
		return 'orange'
	} else {
		return 'red'
	}
}
</script>
