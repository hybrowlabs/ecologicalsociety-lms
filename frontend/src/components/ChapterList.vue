<template>
	<!-- `min-h-8` when empty: a module with no sessions still needs a body tall
	     enough to drop one into. -->
	<Draggable
		:list="chapters"
		:disabled="!allowEdit"
		item-key="name"
		group="chapters"
		:data-module="moduleName || ''"
		:class="!chapters.length ? 'min-h-8' : ''"
		@end="(e: DraggableEvent) => emit('reorder', e)"
	>
		<template #item="{ element: chapter, index }">
			<div class="chapter-item">
				<ChapterRow
					v-bind="$attrs"
					:chapter="chapter"
					:index="index"
					:courseName="courseName"
					:allowEdit="allowEdit"
					:inlineSelect="inlineSelect"
					:editorLinks="editorLinks"
					:selectedLessonNumber="selectedLessonNumber"
					:isEnrolled="isEnrolled"
					:chaptersOnly="chaptersOnly"
					:relabelChapters="relabelChapters"
					:isOpen="openChapters.has(chapter.name)"
				/>
			</div>
		</template>
	</Draggable>
</template>

<script setup lang="ts">
import Draggable from 'vuedraggable'
import ChapterRow from '@/components/ChapterRow.vue'
import type { OutlineChapter, OutlineLesson } from '@/types/api'

interface DraggableEvent {
	item: { __draggable_context: { element: OutlineChapter | OutlineLesson } }
	from: { dataset: { chapter: string; module: string } }
	to: { dataset: { chapter: string; module: string } }
	newIndex: number
}

// Every ChapterRow listener (@toggle, @edit-chapter, @move-lesson, …) is
// forwarded through `$attrs` rather than re-declared here, so this stays a thin
// list wrapper that the outline can drop either at the top level or inside a
// module without repeating the whole prop/handler block twice.
defineOptions({ inheritAttrs: false })

withDefaults(
	defineProps<{
		chapters: OutlineChapter[]
		// Which module these sessions belong to; null for the ungrouped list and
		// for a course with no modules at all. Read off the drop target's dataset
		// when a session is dragged, to know where it landed.
		moduleName?: string | null
		courseName: string
		openChapters: Set<string>
		allowEdit?: boolean
		inlineSelect?: boolean
		editorLinks?: boolean
		selectedLessonNumber?: string
		isEnrolled?: boolean
		chaptersOnly?: boolean
		relabelChapters?: boolean
	}>(),
	{
		moduleName: null,
		allowEdit: false,
		inlineSelect: false,
		editorLinks: false,
		selectedLessonNumber: '',
		isEnrolled: true,
		chaptersOnly: false,
		relabelChapters: false,
	}
)

const emit = defineEmits<{ reorder: [DraggableEvent] }>()
</script>
