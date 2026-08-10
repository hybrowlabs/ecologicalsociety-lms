<template>
	<Dialog
		v-model="show"
		:options="{
			title: moduleDetail ? __('Rename Module') : __('Add Module'),
			size: 'sm',
			actions: [
				{
					label: moduleDetail ? __('Save') : __('Create'),
					variant: 'solid',
					onClick: ({ close }) => save(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="space-y-4 text-base">
				<FormControl
					:label="__('Title')"
					v-model="form.title"
					:required="true"
					autocomplete="off"
					:placeholder="__('Module 1')"
				/>
				<FormControl
					type="textarea"
					:label="__('Description')"
					v-model="form.description"
					:placeholder="__('What this module covers (optional)')"
				/>
				<div v-if="!moduleDetail" class="text-p-sm text-ink-gray-5">
					{{
						__(
							'A module groups sessions together. New modules start empty — drag sessions into it, or move them from the session menu.'
						)
					}}
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { createResource, Dialog, FormControl, toast } from 'frappe-ui'
import { reactive, watch } from 'vue'
import type { CourseModule } from '@/types/api'

const show = defineModel<boolean>()

const props = defineProps<{
	course: string
	moduleDetail?: CourseModule | null
}>()

const emit = defineEmits<{
	saved: [{ name: string; title: string }]
}>()

const form = reactive<{ title: string; description: string }>({
	title: '',
	description: '',
})

const moduleResource = createResource({
	url: 'lms.lms.api.upsert_module',
	makeParams() {
		return {
			course: props.course,
			title: form.title,
			description: form.description || null,
			name: props.moduleDetail?.name,
		}
	},
})

const errorMessage = (err: { messages?: string[] } | string): string =>
	typeof err === 'string' ? err : err.messages?.[0] ?? __('Error')

function save(close: () => void) {
	moduleResource.submit(
		{},
		{
			validate() {
				if (!form.title.trim()) return __('Title is required')
			},
			onSuccess(data: { name: string; title: string }) {
				toast.success(
					props.moduleDetail
						? __('Module updated successfully')
						: __('Module added successfully')
				)
				emit('saved', data)
				close()
			},
			onError(err: { messages?: string[] } | string) {
				toast.error(errorMessage(err))
			},
		}
	)
}

watch(
	[() => props.moduleDetail, show],
	() => {
		form.title = props.moduleDetail?.title ?? ''
		form.description = props.moduleDetail?.description ?? ''
	},
	{ immediate: true }
)
</script>
