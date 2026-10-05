<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Mark Lessons Complete'),
			size: 'xl',
			actions: [
				{
					label: __('Save'),
					variant: 'solid',
					loading: saving,
					onClick: ({ close }) => save(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="text-base text-ink-gray-9 space-y-4">
				<div class="text-ink-gray-7">
					{{
						__(
							'Tick the lessons {0} has already covered in {1}, e.g. lectures attended in the live classroom.'
						).format(memberName || member, courseTitle || course)
					}}
				</div>
				<div
					v-if="lessons.loading && !lessons.data"
					class="flex justify-center py-8"
				>
					<LoadingIndicator class="size-4" />
				</div>
				<div
					v-else-if="lessons.data?.length"
					class="border border-outline-gray-modals rounded-lg px-3 max-h-[55vh] overflow-y-auto"
				>
					<div
						class="sticky top-0 z-10 bg-surface-white py-3 flex justify-between text-sm text-ink-gray-5"
					>
						<span>
							{{ __('{0} of {1} selected').format(selected.size, lessons.data.length) }}
						</span>
						<button class="hover:text-ink-gray-9" @click="toggleAll">
							{{ allSelected ? __('Select none') : __('Select all') }}
						</button>
					</div>
					<div
						v-for="lesson in lessons.data"
						:key="lesson.lesson"
						class="flex items-center justify-between text-sm py-2"
					>
						<Checkbox
							:modelValue="selected.has(lesson.lesson)"
							@update:modelValue="(value: boolean) => toggle(lesson.lesson, value)"
							:label="`${lesson.chapter_idx}.${lesson.idx}  ${lesson.title}`"
						/>
						<Badge
							v-if="lesson.status === 'Complete'"
							theme="green"
							size="sm"
						>
							{{ __('Complete') }}
						</Badge>
					</div>
				</div>
				<div v-else class="text-ink-gray-5 text-sm">
					{{ __('This course has no lessons.') }}
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Badge,
	call,
	Checkbox,
	createResource,
	Dialog,
	LoadingIndicator,
	toast,
} from 'frappe-ui'
import { computed, ref } from 'vue'

const show = defineModel()
const emit = defineEmits(['updated'])
const props = defineProps<{
	course: string
	courseTitle?: string
	member: string
	memberName?: string
}>()

const selected = ref<Set<string>>(new Set())
const saving = ref(false)

const lessons = createResource({
	url: 'lms.lms.api.get_member_lesson_progress',
	params: {
		course: props.course,
		member: props.member,
	},
	auto: true,
	onSuccess(data: any[]) {
		selected.value = new Set(
			data.filter((l) => l.status === 'Complete').map((l) => l.lesson)
		)
	},
})

const allSelected = computed(
	() => !!lessons.data?.length && selected.value.size === lessons.data.length
)

const toggle = (lesson: string, value: boolean) => {
	const next = new Set(selected.value)
	value ? next.add(lesson) : next.delete(lesson)
	selected.value = next
}

const toggleAll = () => {
	selected.value = allSelected.value
		? new Set()
		: new Set(lessons.data.map((l: any) => l.lesson))
}

const save = async (close: () => void) => {
	const rows = lessons.data || []
	const toComplete = rows
		.filter((l: any) => l.status !== 'Complete' && selected.value.has(l.lesson))
		.map((l: any) => l.lesson)
	const toClear = rows
		.filter((l: any) => l.status === 'Complete' && !selected.value.has(l.lesson))
		.map((l: any) => l.lesson)

	if (!toComplete.length && !toClear.length) {
		close()
		return
	}

	saving.value = true
	try {
		const update = (lessonList: string[], complete: boolean) =>
			call('lms.lms.api.set_member_lesson_progress', {
				course: props.course,
				member: props.member,
				lessons: lessonList,
				complete,
			})
		if (toComplete.length) await update(toComplete, true)
		if (toClear.length) await update(toClear, false)
		toast.success(__('Lesson progress updated'))
		emit('updated')
		close()
	} catch (err: any) {
		toast.error(err.messages?.[0] || err)
	} finally {
		saving.value = false
	}
}
</script>
