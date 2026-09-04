<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Student Progress'),
			size: hasAssessmentData ? '4xl' : 'xl',
		}"
	>
		<template #body-content>
			<div class="text-base text-ink-gray-9 max-h-[70vh] overflow-y-auto">
				<div class="flex justify-between mb-5 px-2">
					<div class="flex items-center gap-x-2">
						<Avatar
							:image="student?.member_image"
							:label="student?.member_name"
							size="xl"
						/>
						<div class="space-y-1">
							<div class="font-semibold">
								{{ student?.member_name }}
							</div>
							<div class="text-ink-gray-5">
								{{ student.member }}
							</div>
						</div>
					</div>
					<div class="w-25 space-y-2">
						<div class="text-ink-gray-5 text-sm">
							{{ Math.round(student.progress) }}% {{ __('completed') }}
						</div>
						<ProgressBar
							:label="__('Course Progress')"
							:progress="student.progress"
						/>
					</div>
				</div>

				<div class="grid gap-5" :class="hasAssessmentData ? 'grid-cols-2' : ''">
					<div
						v-if="orderedLessons.length"
						class="border border-outline-gray-modals rounded-lg px-3 pt-3 max-h-[60vh] overflow-y-auto"
					>
						<div>
							<div class="text-ink-gray-5 mb-5">
								{{ __('Lesson Progress') }}
							</div>
						</div>
						<div
							v-for="progress in orderedLessons"
							class="flex justify-between text-sm py-2 my-1"
						>
							<div class="">
								<span class="me-3 text-xs">
									{{ progress.chapter_idx }}.{{ progress.idx }}
								</span>
								<span>
									{{ progress.title }}
								</span>
							</div>
							<Tooltip
								v-if="getLessonStatus(progress) == 'Complete'"
								:text="__('Complete')"
							>
								<Check class="text-ink-green-3 size-4" />
							</Tooltip>
							<Tooltip v-else :text="__('Pending')">
								<Minus class="text-ink-amber-2 size-4" />
							</Tooltip>
							<!-- <Badge :theme="getLessonStatusTheme(progress)">
								{{ getLessonStatus(progress) }}
							</Badge> -->
						</div>
					</div>

					<div class="space-y-3">
						<div
							v-if="orderedQuizzes.length"
							class="border border-outline-gray-modals rounded-lg px-3 pt-3 h-fit"
						>
							<div class="grid grid-cols-4 gap-5 text-ink-gray-5 mb-5">
								<div class="col-span-2">
									{{ __('Quiz Progress') }}
								</div>
								<div>
									{{ __('Score') }}
								</div>
								<div>
									{{ __('Percentage') }}
								</div>
							</div>
							<div
								v-for="quiz in orderedQuizzes"
								class="grid grid-cols-4 gap-15 text-sm py-1 my-1"
							>
								<div class="col-span-2 leading-5">
									<span v-if="sequenceLabel(quiz)" class="me-3 text-xs">
										{{ sequenceLabel(quiz) }}
									</span>
									<span>
										{{ quiz.quiz_title }}
									</span>
								</div>
								<div>
									{{ quiz.score }}
								</div>
								<div>{{ quiz.percentage }}%</div>
							</div>
						</div>

						<div
							v-if="orderedAssignments.length"
							class="border border-outline-gray-modals rounded-lg px-3 pt-3 h-fit"
						>
							<div>
								<div class="text-ink-gray-5 mb-5">
									{{ __('Assignment Progress') }}
								</div>
							</div>
							<div
								v-for="assignment in orderedAssignments"
								class="flex justify-between text-sm py-2 my-1"
							>
								<div>
									<span v-if="sequenceLabel(assignment)" class="me-3 text-xs">
										{{ sequenceLabel(assignment) }}
									</span>
									<span>
										{{ assignment.assignment_title }}
									</span>
								</div>
								<Badge :theme="getAssessmentStatusTheme(assignment.status)">
									{{ assignment.status }}
								</Badge>
							</div>
						</div>

						<div
							v-if="orderedExercises.length"
							class="border border-outline-gray-modals rounded-lg px-3 pt-3 h-fit"
						>
							<div>
								<div class="text-ink-gray-5 mb-5">
									{{ __('Programming Exercise Progress') }}
								</div>
							</div>
							<div
								v-for="exercise in orderedExercises"
								class="flex justify-between text-sm py-2 my-1"
							>
								<div>
									<span v-if="sequenceLabel(exercise)" class="me-3 text-xs">
										{{ sequenceLabel(exercise) }}
									</span>
									<span>
										{{ exercise.exercise_title }}
									</span>
								</div>
								<Badge :theme="getAssessmentStatusTheme(exercise.status)">
									{{ exercise.status }}
								</Badge>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Avatar,
	Badge,
	createListResource,
	createResource,
	Dialog,
	Tooltip,
} from 'frappe-ui'
import ProgressBar from '@/components/ProgressBar.vue'
import { computed } from 'vue'
import { Check, Minus } from 'lucide-vue-next'

const show = defineModel<boolean>({ required: true, default: false })

const props = defineProps<{
	course: any
	student: any
	lessons: any
}>()

// pageLength is explicit because frappe-ui defaults list resources to 20 rows.
// The dialog renders every lesson of the course and looks each one up in this
// list, so on a course with more than 20 completed lessons the older ones fell
// off the page and rendered as Pending even though the learner had finished
// them. There is no paging UI here - fetch the whole set in one go.
const lessonProgress = createListResource({
	doctype: 'LMS Course Progress',
	filters: {
		course: ['=', props.course.data?.name],
		member: ['=', props.student?.member],
	},
	fields: ['name', 'lesson', 'status'],
	pageLength: 500,
	auto: true,
})

const assessmentProgress = createResource({
	url: 'lms.lms.api.get_course_assessment_progress',
	params: {
		course: props.course.data?.name,
		member: props.student?.member,
	},
	auto: true,
})

// Every panel in this dialog reads in course order: chapter position, then
// lesson position. The lists are sorted here rather than trusted as received --
// `lessons` is the dashboard's own resource, and its "Sort by" control reorders
// that array in place, which used to leak into this dialog and show a student's
// lessons by completion rate instead of by sequence.
const bySequence = <T extends Record<string, any>>(rows: T[] | undefined): T[] =>
	[...(rows || [])].sort(
		(a, b) => (a.chapter_idx || 0) - (b.chapter_idx || 0) || (a.idx || 0) - (b.idx || 0)
	)

const orderedLessons = computed(() => bySequence(props.lessons?.data))
const orderedQuizzes = computed(() =>
	bySequence(assessmentProgress.data?.quizzes)
)
const orderedAssignments = computed(() =>
	bySequence(assessmentProgress.data?.assignments)
)
const orderedExercises = computed(() =>
	bySequence(assessmentProgress.data?.exercises)
)

// "2.1" -- the same chapter.lesson label the Lesson Progress list uses, so a
// quiz or assignment can be traced back to where it sits in the outline.
const sequenceLabel = (row: any): string =>
	row?.chapter_idx && row?.idx ? `${row.chapter_idx}.${row.idx}` : ''

const getLessonStatus = (lesson: any) => {
	// Match on lesson_name, not lesson: the rows come from
	// get_lesson_completion_stats, where `lesson` is a left-joined progress
	// column and is null for any lesson nobody in the course has finished yet.
	return (
		lessonProgress.data?.find((lp: any) => lp.lesson === lesson.lesson_name)
			?.status || __('Pending')
	)
}

const getLessonStatusTheme = (lesson: any) => {
	const status = getLessonStatus(lesson)
	if (status === 'Complete') {
		return 'green'
	} else {
		return 'orange'
	}
}

const getAssessmentStatusTheme = (status: string) => {
	if (status.includes('Pass')) return 'green'
	else if (status.includes('Fail')) return 'red'
	else return 'orange'
}

const hasAssessmentData = computed(() => {
	return Boolean(
		orderedQuizzes.value.length ||
			orderedAssignments.value.length ||
			orderedExercises.value.length
	)
})
</script>
