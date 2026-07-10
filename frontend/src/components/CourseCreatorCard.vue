<template>
	<div class="border-2 rounded-md p-5 bg-surface-cards border-outline-gray-2">
		<div
			class="uppercase text-ink-gray-5 text-xs font-semibold tracking-wider mb-4"
		>
			{{ __('Course creator') }}
		</div>

		<div class="flex items-center gap-3">
			<div class="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
				{{ brandInitials }}
			</div>
			<div class="min-w-0">
				<div class="font-medium text-ink-gray-9 truncate">
					{{ brandName }}
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { sessionStore } from '@/stores/session'
import type { CourseInstructorInfo } from '@/types/api'

defineProps<{
	instructors?: CourseInstructorInfo[]
}>()

const { branding } = sessionStore()

// Brand name comes from the Settings tab (Settings -> Branding -> Brand Name,
// saved to Website Settings.app_name). Fall back to a neutral default when the
// brand is unset ("Frappe" is the un-branded default value).
const brandName = computed(() => {
	const name = branding.data?.app_name
	return name && name !== 'Frappe' ? name : 'Ecological Society'
})

const brandInitials = computed(() =>
	brandName.value
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w: string) => w[0])
		.join('')
		.toUpperCase()
)
</script>
