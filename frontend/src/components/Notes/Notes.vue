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
// Guards so a note-list reload (highlight insert, post-save refetch, navigation)
// can't overwrite text the user is still typing, and so fast typing can't fire
// two concurrent creates and orphan a duplicate note.
const isDirty = ref<boolean>(false)
const saving = ref<boolean>(false)
const pendingSave = ref<boolean>(false)
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

// Switching lessons reuses this component instance; reset editor state so the
// new lesson's note loads cleanly and stale dirty/name state can't leak across.
watch(
	() => props.lesson,
	() => {
		isDirty.value = false
		currentNoteName.value = null
		note.value = null
		saveStatus.value = ''
	}
)

// The editor reports an empty document as `<p></p>` (and can carry stray
// `<br>`/`&nbsp;` markup), so "is there actually any text here?" needs more than
// a falsy check.
const isBlank = (html?: string | null) =>
	!html ||
	html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.trim() === ''

const updateCurrentNote = () => {
	// Don't clobber unsaved edits with a server refetch mid-typing — but an
	// *empty* editor must never win over a note that came back from the server.
	// The page load races the notes fetch (it lands a few hundred ms after the
	// lesson renders), so anything that marks the component dirty in that window
	// used to suppress the saved note for the rest of the session.
	if (isDirty.value && !isBlank(note.value)) return
	const currentNote = notes.value?.data?.filter((row: Note) => {
		return !row.highlighted_text && row.note !== ''
	})
	if (!currentNote?.length) {
		note.value = null
		currentNoteName.value = null
		return
	}
	// A lesson can carry more than one plain note (older builds could autosave a
	// blank one). Prefer a note that actually has text so an empty stray can't
	// mask what the learner wrote.
	const current = currentNote.find((row: Note) => !isBlank(row.note)) ?? currentNote[0]
	currentNoteName.value = current.name
	note.value = current.note || null
	isDirty.value = false
	saveStatus.value = ''
}

const updateNoteText = (val: string) => {
	// TextEditor re-emits `change` when we load content into it, so the echo of
	// our own `setContent` arrives back here. Treating that as a user edit
	// marked the note dirty and autosaved it straight back to the server.
	if (val === note.value) return
	// Before the fetch resolves the editor is legitimately empty. Autosaving
	// that would create a blank note which then masks the real one on the next
	// page load — exactly the "my notes vanished" report.
	if (isBlank(val) && !currentNoteName.value) {
		note.value = val
		return
	}
	note.value = val
	isDirty.value = true
	saveStatus.value = __('Saving…')
	debouncedSave()
}

const saveNow = () => {
	if (isBlank(note.value) && !currentNoteName.value) return
	saveStatus.value = __('Saving…')
	saveNotes()
}

const debouncedSave = useDebounceFn(() => {
	saveNotes()
}, 2000)

// Serialize saves: while one create/update is in flight, queue a single
// follow-up instead of firing a second request. This prevents two concurrent
// creates (which would orphan a duplicate note) and guarantees the latest text
// is persisted once the in-flight request resolves.
const saveNotes = () => {
	if (saving.value) {
		pendingSave.value = true
		return
	}
	saving.value = true
	const finish = () => {
		saving.value = false
		if (pendingSave.value) {
			pendingSave.value = false
			saveNotes()
		}
	}
	if (currentNoteName.value) {
		updateNote(finish)
	} else {
		createNote(finish)
	}
}

const createNote = (done?: () => void) => {
	// Never bring a blank note into existence; it would outrank nothing and
	// only add another row for updateCurrentNote() to pick between.
	if (isBlank(note.value)) {
		saveStatus.value = ''
		done?.()
		return
	}
	const saved = note.value
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
				// Only clear dirty if the editor hasn't changed since we sent this
				// value; otherwise a refetch would revert the newer keystrokes.
				if (note.value === saved) isDirty.value = false
				saveStatus.value = __('Saved')
				emit('updateNotes')
				done?.()
			},
			onError(err: any) {
				saveStatus.value = __('Not saved')
				console.error('Error creating note:', err)
				done?.()
			},
		}
	)
}

const updateNote = (done?: () => void) => {
	if (!currentNoteName.value) {
		done?.()
		return
	}
	const saved = note.value
	notes.value?.setValue.submit(
		{
			name: currentNoteName.value,
			lesson: props.lesson,
			member: user?.data?.name,
			note: note.value,
		},
		{
			onSuccess(_data: Note) {
				if (note.value === saved) isDirty.value = false
				saveStatus.value = __('Saved')
				emit('updateNotes')
				done?.()
			},
			onError(err: any) {
				saveStatus.value = __('Not saved')
				console.error('Error updating note:', err)
				done?.()
			},
		}
	)
}
</script>
