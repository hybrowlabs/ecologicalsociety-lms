<template>
	<div class="space-y-3">
		<div
			v-if="quizzes.length"
			class="border border-outline-gray-modals rounded-lg px-3 pt-3 pb-1"
			data-testid="quiz-panel"
		>
			<div
				class="grid grid-cols-12 gap-3 bg-surface-white pb-3 text-ink-gray-5"
			>
				<div class="col-span-6">{{ __('Quiz Progress') }}</div>
				<div class="col-span-2">{{ __('Attempts') }}</div>
				<div class="col-span-2">{{ __('Score') }}</div>
				<div class="col-span-2">{{ __('Percentage') }}</div>
			</div>
			<div
				v-for="quiz in quizzes"
				:key="quiz.quiz"
				class="border-t border-outline-gray-modals first:border-t-0"
				data-testid="quiz-row"
			>
				<button
					type="button"
					class="grid grid-cols-12 gap-3 w-full text-start text-sm py-2 hover:bg-surface-gray-1 rounded"
					:aria-expanded="isOpen(quiz.quiz)"
					@click="toggle(quiz.quiz)"
				>
					<div class="col-span-6 flex items-start gap-x-1 leading-5">
						<ChevronRight
							class="size-4 mt-0.5 shrink-0 text-ink-gray-5 transition-transform"
							:class="{ 'rotate-90': isOpen(quiz.quiz) }"
						/>
						<span v-if="sequenceLabel(quiz)" class="me-2 text-xs mt-0.5">
							{{ sequenceLabel(quiz) }}
						</span>
						<span>{{ quiz.quiz_title }}</span>
					</div>
					<div class="col-span-2" data-testid="quiz-attempts">
						{{ quiz.total_attempts || 0 }}
					</div>
					<div class="col-span-2">{{ quiz.score }}</div>
					<div class="col-span-2">{{ quiz.percentage }}%</div>
				</button>
				<ol
					v-if="isOpen(quiz.quiz)"
					class="ms-6 mb-2 space-y-1.5 text-sm"
					data-testid="quiz-questions"
				>
					<li
						v-for="question in quiz.questions || []"
						:key="question.question"
						class="flex items-start justify-between gap-x-3"
						data-testid="quiz-question"
					>
						<span class="text-ink-gray-7 leading-5">
							<span class="text-xs text-ink-gray-5 me-1">Q{{ question.number }}</span>
							{{ question.text }}
						</span>
						<Tooltip
							:text="
								question.first_correct_on
									? __('First correct on {0}').format(
											formatDate(question.first_correct_on)
									  )
									: ''
							"
						>
							<Badge
								:theme="questionTheme(question)"
								class="shrink-0 whitespace-nowrap"
							>
								{{ question.label }}
							</Badge>
						</Tooltip>
					</li>
					<li
						v-if="!(quiz.questions || []).length"
						class="text-ink-gray-5"
					>
						{{ __('This quiz has no questions.') }}
					</li>
				</ol>
			</div>
		</div>

		<div
			v-if="assignments.length"
			class="border border-outline-gray-modals rounded-lg px-3 pt-3 h-fit"
			data-testid="assignment-panel"
		>
			<div class="text-ink-gray-5 mb-3">
				{{ __('Assignment Progress') }}
			</div>
			<div
				v-for="assignment in assignments"
				:key="assignment.assignment"
				class="flex justify-between gap-x-3 text-sm py-2 my-1"
				data-testid="assignment-row"
			>
				<div>
					<div>
						<span v-if="sequenceLabel(assignment)" class="me-3 text-xs">
							{{ sequenceLabel(assignment) }}
						</span>
						<span>{{ assignment.assignment_title }}</span>
					</div>
					<div
						class="text-xs text-ink-gray-5 mt-0.5"
						data-testid="assignment-dates"
					>
						<template v-if="submittedOn(assignment)">
							{{ __('Submitted {0}').format(formatDate(submittedOn(assignment))) }}
							<template v-if="wasReuploaded(assignment)">
								·
								{{
									__('Re-uploaded {0}').format(
										formatDate(assignment.last_uploaded_on)
									)
								}}
							</template>
						</template>
						<template v-else>{{ __('Not submitted yet') }}</template>
					</div>
				</div>
				<Badge :theme="statusTheme(assignment.status)" class="shrink-0 h-fit">
					{{ assignment.status }}
				</Badge>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { inject, ref } from 'vue'
import { Badge, Tooltip } from 'frappe-ui'
import { ChevronRight } from 'lucide-vue-next'
import type dayjsType from 'dayjs'

const dayjs = inject<typeof dayjsType>('$dayjs')!

withDefaults(
	defineProps<{
		quizzes?: any[]
		assignments?: any[]
	}>(),
	{ quizzes: () => [], assignments: () => [] }
)

const open = ref<Record<string, boolean>>({})
const isOpen = (quiz: string) => Boolean(open.value[quiz])
const toggle = (quiz: string) => {
	open.value[quiz] = !open.value[quiz]
}

// "2.1" - the chapter.lesson position, when the row carries one.
const sequenceLabel = (row: any): string =>
	row?.chapter_idx && row?.idx ? `${row.chapter_idx}.${row.idx}` : ''

const formatDate = (value: string) => dayjs(value).format('DD MMM YYYY, hh:mm a')

// Course rows carry `creation`; batch-level rows carry `submitted_on`.
const submittedOn = (row: any) => row.submitted_on || row.creation || null

// Only call it a re-upload when it's clearly later than the first submission.
const wasReuploaded = (row: any) => {
	const first = submittedOn(row)
	if (!first || !row.last_uploaded_on) return false
	return dayjs(row.last_uploaded_on).diff(dayjs(first), 'second') > 60
}

const questionTheme = (question: any) => {
	if (question.state === 'correct')
		return question.attempts_to_correct === 1 ? 'green' : 'blue'
	if (question.state === 'not_correct') return 'red'
	return 'gray'
}

const statusTheme = (status: string = '') => {
	if (status.includes('Pass')) return 'green'
	if (status.includes('Fail')) return 'red'
	return 'orange'
}
</script>
