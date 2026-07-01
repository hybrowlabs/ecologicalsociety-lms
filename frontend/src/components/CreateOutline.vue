<template>
	<div v-if="course">
		<div class="text-xl font-semibold">
			{{ course.title }}
		</div>
		<div v-if="course.chapters.length">
			{{ course.chapters }}
		</div>
		<div v-else class="border bg-surface-white rounded-md p-5 text-center mt-4">
			<div>
				{{
					__(
						'There are no sessions in this course. Create and manage sessions from here.'
					)
				}}
			</div>
			<Button class="mt-4">
				{{ __('Add Session') }}
			</Button>
		</div>
	</div>
</template>
<script setup>
const props = defineProps({
	course: {
		type: Object,
		default: {},
	},
})
</script>
