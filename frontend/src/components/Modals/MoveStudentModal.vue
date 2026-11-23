<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Move {0} to another batch').format(
				student?.member_name || student?.member || ''
			),
			size: 'xl',
			actions: [
				{
					label: __('Move'),
					variant: 'solid',
					disabled: !canMove,
					loading: moving,
					onClick: ({ close }) => move(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<Link
					doctype="LMS Batch"
					v-model="targetBatch"
					:label="__('Move to batch')"
					:filters="{ name: ['!=', batch] }"
					:required="true"
				/>

				<div v-if="previewing" class="text-sm text-ink-gray-5">
					{{ __('Checking courses...') }}
				</div>
				<div v-else-if="preview" class="space-y-3 text-sm">
					<div
						v-if="!preview.seats_available"
						class="rounded-md bg-surface-red-2 p-2 text-ink-red-4"
					>
						{{ __('There are no seats available in the selected batch.') }}
					</div>

					<div v-for="group in groups" :key="group.key">
						<div class="font-medium text-ink-gray-8">{{ group.label }}</div>
						<div v-if="!preview[group.key].length" class="text-ink-gray-5">
							{{ __('None') }}
						</div>
						<div
							v-for="course in preview[group.key]"
							:key="course.course"
							class="flex justify-between text-ink-gray-7"
						>
							<span>{{ course.title || course.course }}</span>
							<span v-if="course.progress !== null">
								{{ Math.round(course.progress) }}%
							</span>
						</div>
					</div>

					<FormControl
						v-if="preview.only_in_old.length"
						type="checkbox"
						v-model="keepOldCourses"
						:label="__('Keep access to courses that are only in the old batch')"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { call, Dialog, FormControl, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import Link from '@/components/Controls/Link.vue'

const show = defineModel<boolean>()

const props = defineProps<{
	batch: string
	student: { member: string; member_name?: string } | null
}>()

const emit = defineEmits<{ (e: 'moved'): void }>()

const targetBatch = ref<string | null>(null)
const preview = ref<any>(null)
const previewing = ref(false)
const moving = ref(false)
const keepOldCourses = ref(true)

const groups = computed(() => [
	{ key: 'common', label: __('In both batches (progress carries over)') },
	{ key: 'only_in_old', label: __('Only in the current batch') },
	{ key: 'only_in_new', label: __('Only in the new batch (starts at 0%)') },
])

const canMove = computed(() => !!targetBatch.value && !!preview.value?.seats_available)

watch(targetBatch, async (value) => {
	preview.value = null
	if (!value || !props.student) return
	previewing.value = true
	try {
		preview.value = await call('ecological_society.batch.preview_batch_move', {
			from_batch: props.batch,
			to_batch: value,
			member: props.student.member,
		})
	} catch (err: any) {
		toast.error(err?.messages?.[0] || __('Could not check the selected batch'))
	} finally {
		previewing.value = false
	}
})

const move = async (close: () => void) => {
	if (!props.student || !targetBatch.value) return
	moving.value = true
	try {
		await call('ecological_society.batch.move_student_to_batch', {
			from_batch: props.batch,
			to_batch: targetBatch.value,
			member: props.student.member,
			keep_old_courses: keepOldCourses.value ? 1 : 0,
		})
		toast.success(__('Student moved'))
		emit('moved')
		close()
	} catch (err: any) {
		toast.error(err?.messages?.[0] || __('Could not move the student'))
	} finally {
		moving.value = false
	}
}
</script>
