<template>
	<div class="flex items-center justify-between mb-4">
		<div class="text-lg font-semibold text-ink-gray-9">
			{{ __('My Notes') }}
		</div>
		<div class="flex items-center gap-x-2">
			<span
				v-if="saveStatus"
				class="text-xs text-ink-gray-5"
			>
				{{ saveStatus }}
			</span>
			<Button
				v-if="currentNoteName || note"
				variant="subtle"
				:label="__('Save')"
				@click="saveNow"
			/>
		</div>
	</div>
	<!-- #27: richer editing - fixed formatting toolbar, bubble menu on select,
	     slash menu, bordered editor for better usability. -->
	<TextEditor
		:content="note"
		:placeholder="__('Make notes for quick revision. Press / for menu, or select text to format.')"
		@change="(val: string) => updateNoteText(val)"
		:editable="true"
		:fixedMenu="fixedMenuButtons"
		:bubbleMenu="true"
		:uploadArgs="{
			private: true,
		}"
		editorClass="prose prose-sm min-h-[200px] max-w-none border border-outline-gray-2 rounded-b-md px-3 py-2 focus:outline-none"
	/>
</template>
<script setup lang="ts">
import { TextEditor, Button } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { inject, ref, onMounted, watch } from 'vue'
import type { Note, Notes } from '@/components/Notes/types'
import { blockQuotesClick } from '@/utils/'

const note = ref<string | null>(null)
const currentNoteName = ref<string | null>(null)
const saveStatus = ref<string>('')
// #27: formatting toolbar shown above the notes editor.
const fixedMenuButtons = [
	'Paragraph',
	['Heading 2', 'Heading 3'],
	'Bold',
	'Italic',
	'Bullet List',
	'Numbered List',
	'Blockquote',
	'Code',
	'Link',
	'Horizontal Rule',
]
const user = inject<any>('$user')
const notes = defineModel<Notes>('notes')
const emit = defineEmits<{
	(e: 'updateNotes'): void
}>()

const props = defineProps<{
	lesson: string
}>()

onMounted(() => {
	updateCurrentNote()
})

watch(
	() => notes.value?.data,
	() => {
		updateCurrentNote()
		blockQuotesClick()
	}
)

const updateCurrentNote = () => {
	const currentNote = notes.value?.data?.filter((row: Note) => {
		return !row.highlighted_text && row.note !== ''
	})
	if (currentNote?.length === 0) {
		note.value = null
		currentNoteName.value = null
		return
	} else if (currentNote && currentNote.length > 0) {
		currentNoteName.value = currentNote[0].name
		note.value = currentNote[0].note || null
	}
}

const updateNoteText = (val: string) => {
	note.value = val
	saveStatus.value = __('Saving…')
	debouncedSave()
}

const saveNow = () => {
	saveStatus.value = __('Saving…')
	saveNotes()
}

const debouncedSave = useDebounceFn(() => {
	saveNotes()
}, 2000)

const saveNotes = () => {
	if (currentNoteName.value) {
		updateNote()
	} else {
		createNote()
	}
}

const createNote = () => {
	notes.value?.insert.submit(
		{
			lesson: props.lesson,
			member: user?.data?.name,
			note: note.value,
			color: 'Yellow',
			name: '',
		},
		{
			onSuccess(data: Note) {
				currentNoteName.value = data.name || null
				saveStatus.value = __('Saved')
				emit('updateNotes')
			},
			onError(err: any) {
				saveStatus.value = __('Not saved')
				console.error('Error creating note:', err)
			},
		}
	)
}

const updateNote = () => {
	if (!currentNoteName.value) return
	notes.value?.setValue.submit(
		{
			name: currentNoteName.value,
			lesson: props.lesson,
			member: user?.data?.name,
			note: note.value,
		},
		{
			onSuccess(data: Note) {
				saveStatus.value = __('Saved')
				emit('updateNotes')
			},
			onError(err: any) {
				saveStatus.value = __('Not saved')
				console.error('Error updating note:', err)
			},
		}
	)
}
</script>
