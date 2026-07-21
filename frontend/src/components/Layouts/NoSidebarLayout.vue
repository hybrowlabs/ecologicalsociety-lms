<template>
	<div class="relative flex flex-col" :class="fromLesson ? '' : 'h-full'">
		<div class="flex-1" :class="fromLesson ? '' : 'h-full'">
			<div
				class="text-base bg-surface-white"
				:class="fromLesson ? '' : 'flex h-screen'"
			>
				<div
					id="scrollContainer"
					class="w-full"
					:class="fromLesson ? '' : 'overflow-auto'"
				>
					<slot />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const fromLesson = computed(() => Boolean(route.query.fromLesson))
</script>
