<template>
	<div class="flex flex-wrap items-center gap-2 mb-3">
		<FormControl
			v-model="band"
			type="select"
			:options="progressBandOptions()"
			class="w-48"
			data-testid="progress-band"
		/>
		<template v-if="band === 'custom'">
			<FormControl
				v-model="min"
				type="number"
				:placeholder="__('Min %')"
				class="w-20"
				data-testid="progress-min"
			/>
			<span class="text-ink-gray-5 text-sm">-</span>
			<FormControl
				v-model="max"
				type="number"
				:placeholder="__('Max %')"
				class="w-20"
				data-testid="progress-max"
			/>
		</template>
		<FormControl
			v-model="sort"
			type="select"
			:options="studentSortOptions()"
			class="w-48"
			data-testid="student-sort"
		/>
		<div
			v-if="total !== null && total !== undefined"
			class="flex items-center gap-x-1 text-sm text-ink-gray-5 ms-auto"
			data-testid="student-count"
		>
			<span>
				{{
					total === 1
						? __('1 student')
						: __('{0} students').format(String(total))
				}}
				<template v-if="rangeLabel"> · {{ rangeLabel }}</template>
			</span>
			<Button
				v-if="band"
				variant="ghost"
				size="sm"
				:tooltip="__('Clear progress filter')"
				@click="clearRange"
			>
				<template #icon>
					<X class="size-3.5" />
				</template>
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Button, FormControl } from 'frappe-ui'
import { X } from 'lucide-vue-next'
import {
	describeRange,
	progressBandOptions,
	studentSortOptions,
} from '@/utils/progressRange'
import type { ProgressBand, StudentSort } from '@/utils/progressRange'

defineProps<{
	total?: number | null
}>()

const band = defineModel<ProgressBand>('band', { default: '' })
const min = defineModel<number | string | null>('min', { default: null })
const max = defineModel<number | string | null>('max', { default: null })
const sort = defineModel<StudentSort>('sort', { default: 'creation_desc' })

const rangeLabel = computed(() => describeRange(band.value, min.value, max.value))

const clearRange = () => {
	band.value = ''
	min.value = null
	max.value = null
}
</script>
