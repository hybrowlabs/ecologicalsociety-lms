<template>
	<div class="flex flex-wrap items-center gap-x-1 text-sm text-ink-gray-7">
		<template v-for="(instructor, index) in instructors" :key="instructor.name">
			<router-link
				v-if="instructor.username"
				:to="{ name: 'Profile', params: { username: instructor.username } }"
				class="hover:text-ink-gray-9 hover:underline transition-colors"
			>
				{{ instructor.full_name || instructor.name }}
			</router-link>
			<span v-else>{{ instructor.full_name || instructor.name }}</span>
			<span v-if="index < (instructors?.length ?? 0) - 1" class="text-ink-gray-4">,</span>
		</template>
	</div>
</template>
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { CourseInstructorInfo } from '@/types/api'

defineProps<{
	instructors?: CourseInstructorInfo[]
}>()
</script>
