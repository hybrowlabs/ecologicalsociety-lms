<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Organize into Modules'),
			size: 'md',
			actions: [
				{
					label: __('Organize'),
					variant: 'solid',
					onClick: ({ close }) => organize(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="space-y-4 text-base">
				<p class="text-p-sm text-ink-gray-6">
					{{
						__(
							'Split this course into modules so learners pick a module first instead of scrolling one long session list. Sessions keep their current order and numbering.'
						)
					}}
				</p>
				<FormControl
					type="number"
					:label="__('Sessions per module')"
					v-model="form.chaptersPerModule"
					min="1"
				/>
				<FormControl
					:label="__('Module name prefix')"
					v-model="form.titlePrefix"
					:placeholder="__('Module')"
					:description="
						__('Modules are named by adding a number, e.g. \'Module 1\'.')
					"
				/>
				<Switch
					size="sm"
					:label="__('Replace existing modules')"
					:description="
						__(
							'Delete the modules this course already has and start over. Sessions are never deleted.'
						)
					"
					v-model="form.replaceExisting"
				/>
				<div class="rounded-md bg-surface-gray-1 p-3 text-p-sm text-ink-gray-7">
					{{ preview }}
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { createResource, Dialog, FormControl, toast } from 'frappe-ui'
import { computed, reactive, watch } from 'vue'
import Switch from '@/components/Controls/Switch.vue'

const show = defineModel<boolean>()

const props = defineProps<{
	course: string
	// Sessions not yet in a module — the ones this will actually organize.
	ungroupedCount: number
	totalCount: number
	hasModules: boolean
}>()

const emit = defineEmits<{ organized: [] }>()

const form = reactive({
	chaptersPerModule: 15,
	titlePrefix: '',
	replaceExisting: false,
})

// `replace_existing` wipes the current grouping, so everything gets organized;
// otherwise only the sessions still sitting outside a module do.
const affectedCount = computed<number>(() =>
	form.replaceExisting ? props.totalCount : props.ungroupedCount
)

const preview = computed<string>(() => {
	const size = Number(form.chaptersPerModule) || 0
	if (size < 1) return __('Enter how many sessions each module should hold.')
	if (!affectedCount.value)
		return __('Every session is already in a module. Nothing to organize.')
	const modules = Math.ceil(affectedCount.value / size)
	return `${affectedCount.value} ${
		affectedCount.value === 1 ? __('session') : __('sessions')
	} → ${modules} ${modules === 1 ? __('module') : __('modules')}`
})

const organizeResource = createResource({
	url: 'lms.lms.api.auto_create_modules',
	makeParams() {
		return {
			course: props.course,
			chapters_per_module: Number(form.chaptersPerModule),
			title_prefix: form.titlePrefix || null,
			replace_existing: form.replaceExisting ? 1 : 0,
		}
	},
})

function organize(close: () => void) {
	organizeResource.submit(
		{},
		{
			validate() {
				if (!Number(form.chaptersPerModule) || Number(form.chaptersPerModule) < 1)
					return __('A module must hold at least one session.')
			},
			onSuccess(data: { modules: unknown[]; chapters_organised: number }) {
				if (!data.chapters_organised) {
					toast.info(__('Every session is already in a module.'))
				} else {
					toast.success(
						`${data.modules.length} ${
							data.modules.length === 1 ? __('module created') : __('modules created')
						}`
					)
				}
				emit('organized')
				close()
			},
			onError(err: { messages?: string[] } | string) {
				toast.error(
					typeof err === 'string' ? err : err.messages?.[0] ?? __('Error')
				)
			},
		}
	)
}

watch(show, (open) => {
	if (!open) return
	form.replaceExisting = false
	form.titlePrefix = ''
})
</script>
