<template>
	<div
		class="mb-2 rounded-md border last:mb-0"
		:class="isCurrent ? 'border-outline-gray-3 bg-surface-gray-1' : ''"
	>
		<button
			type="button"
			class="group flex w-full items-center gap-2 p-2 text-start"
			@click="emit('toggle')"
		>
			<GripVertical
				v-if="canReorder"
				class="module-drag-handle size-4 shrink-0 cursor-grab stroke-1.5 text-ink-gray-4"
				@click.stop.prevent
			/>
			<ChevronRight
				class="size-4 shrink-0 transform stroke-1.5 text-ink-gray-9 duration-200"
				:class="{ 'rotate-90': isOpen, 'rtl:rotate-180': !isOpen }"
			/>
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<span
						class="truncate text-base font-semibold leading-5 text-ink-gray-9"
						:title="group.title"
					>
						{{ group.title }}
					</span>
					<!-- The learner's "you are here" marker: with every module
					     collapsed by default, this is what says which one holds the
					     lesson they are on. -->
					<Badge v-if="isCurrent" theme="blue" size="sm" class="shrink-0">
						{{ __('Current') }}
					</Badge>
				</div>
				<div class="mt-1 text-xs text-ink-gray-5">{{ summary }}</div>
			</div>

			<div v-if="canReorder" class="ms-auto flex shrink-0 gap-x-4">
				<Tooltip :text="__('Rename Module')" placement="bottom">
					<span
						@click.stop.prevent="emit('edit')"
						class="lucide-file-pen-line invisible size-4 text-ink-gray-9 group-hover:visible"
					/>
				</Tooltip>
				<Tooltip :text="__('Delete Module')" placement="bottom">
					<span
						@click.stop.prevent="emit('delete')"
						class="lucide-trash-2 invisible size-4 text-ink-red-3 group-hover:visible"
					/>
				</Tooltip>
			</div>
			<div
				v-else-if="showProgress && group.lessonCount"
				class="ms-auto h-1 w-12 shrink-0 overflow-hidden rounded-full bg-surface-gray-3"
			>
				<div
					class="h-full bg-surface-green-3 transition-all"
					:style="{ width: `${progressPercent}%` }"
				/>
			</div>
		</button>

		<div v-show="isOpen" class="border-t px-1 pb-1 pt-1">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import { Badge, Tooltip } from 'frappe-ui'
import { computed } from 'vue'
import { ChevronRight, GripVertical } from 'lucide-vue-next'
import type { OutlineGroup } from '@/types/api'

const props = withDefaults(
	defineProps<{
		group: OutlineGroup
		isOpen?: boolean
		allowEdit?: boolean
		// The trailing catch-all group of sessions that are in no module. It is a
		// rendering device rather than a real module, so it can't be renamed,
		// deleted or reordered — but sessions can still be dropped into it, which
		// is how a session is taken out of a module.
		isUngrouped?: boolean
		// True when this module holds the session/lesson currently being viewed.
		isCurrent?: boolean
		showProgress?: boolean
	}>(),
	{
		isOpen: false,
		allowEdit: false,
		isUngrouped: false,
		isCurrent: false,
		showProgress: false,
	}
)

const canReorder = computed<boolean>(() => props.allowEdit && !props.isUngrouped)

const emit = defineEmits<{
	toggle: []
	edit: []
	delete: []
}>()

const progressPercent = computed<number>(() =>
	props.group.lessonCount
		? Math.round((props.group.completedCount / props.group.lessonCount) * 100)
		: 0
)

// The whole point of collapsing modules is that the header alone tells you
// enough to choose one, so it carries the session count and — once enrolled —
// how much of it is done.
const summary = computed<string>(() => {
	const sessions = props.group.chapters.length
	const parts = [
		`${sessions} ${sessions === 1 ? __('session') : __('sessions')}`,
	]
	if (props.group.lessonCount) {
		parts.push(
			props.showProgress
				? `${props.group.completedCount}/${props.group.lessonCount} ${__(
						'lessons complete'
				  )}`
				: `${props.group.lessonCount} ${
						props.group.lessonCount === 1 ? __('lesson') : __('lessons')
				  }`
		)
	}
	return parts.join(' · ')
})
</script>
