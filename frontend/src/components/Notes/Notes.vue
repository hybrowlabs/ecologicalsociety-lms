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
			<Dropdown :options="downloadOptions" placement="right">
				<Button variant="subtle" :label="__('Download')">
					<template #prefix>
						<Download class="size-4 stroke-1.5" />
					</template>
				</Button>
			</Dropdown>
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
import { TextEditor, Button, Dropdown, toast } from 'frappe-ui'
import { Download } from 'lucide-vue-next'
import { inject, ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import type { Note, Notes } from '@/components/Notes/types'
import { blockQuotesClick } from '@/utils/'

const SAVE_DELAY_MS = 2000

const note = ref<string | null>(null)
const saveStatus = ref<string>('')
// Guards so a note-list reload (highlight insert, post-save refetch, navigation)
// can't overwrite text the user is still typing.
const isDirty = ref<boolean>(false)
// Server-side note name per lesson. Keyed by lesson (not a single ref) so a save
// that is still in flight for the previous lesson after navigation resolves
// against the right note instead of the new lesson's.
const noteNames = ref<Record<string, string>>({})
// Last text persisted per lesson, so flushes don't re-send unchanged content.
const lastSaved: Record<string, string | null> = {}
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
	lessonTitle?: string
	courseName?: string
	courseTitle?: string
}>()

const currentNoteName = computed(() => noteNames.value[props.lesson] || null)

onMounted(() => {
	updateCurrentNote()
	window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
	window.removeEventListener('beforeunload', onBeforeUnload)
	// Leaving the lesson page within the autosave delay used to drop the last
	// edits. Persist them now.
	flush(props.lesson)
})

watch(
	() => notes.value?.data,
	() => {
		updateCurrentNote()
		blockQuotesClick()
	}
)

// Switching lessons reuses this component instance. Save whatever was typed on
// the previous lesson first (this used to be silently discarded if the switch
// happened inside the autosave delay), then reset the editor for the new one.
watch(
	() => props.lesson,
	(_newLesson, oldLesson) => {
		if (oldLesson) flush(oldLesson)
		isDirty.value = false
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

const lessonRows = () =>
	(notes.value?.data || []).filter(
		(row: Note) => !row.lesson || row.lesson === props.lesson
	)

const updateCurrentNote = () => {
	// Don't clobber unsaved edits with a server refetch mid-typing — but an
	// *empty* editor must never win over a note that came back from the server.
	// The page load races the notes fetch (it lands a few hundred ms after the
	// lesson renders), so anything that marks the component dirty in that window
	// used to suppress the saved note for the rest of the session.
	if (isDirty.value && !isBlank(note.value)) return
	const currentNote = lessonRows().filter((row: Note) => {
		return !row.highlighted_text && row.note !== ''
	})
	if (!currentNote?.length) {
		note.value = null
		return
	}
	// A lesson can carry more than one plain note (older builds could autosave a
	// blank one). Prefer a note that actually has text so an empty stray can't
	// mask what the learner wrote.
	const current = currentNote.find((row: Note) => !isBlank(row.note)) ?? currentNote[0]
	noteNames.value[props.lesson] = current.name
	note.value = current.note || null
	lastSaved[props.lesson] = note.value
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
	scheduleSave()
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

const cancelScheduledSave = () => {
	if (saveTimer) clearTimeout(saveTimer)
	saveTimer = null
}

const scheduleSave = () => {
	cancelScheduledSave()
	const lesson = props.lesson
	saveTimer = setTimeout(() => {
		saveTimer = null
		flush(lesson)
	}, SAVE_DELAY_MS)
}

const saveNow = () => {
	if (isBlank(note.value) && !currentNoteName.value) return
	saveStatus.value = __('Saving…')
	flush(props.lesson, true)
}

// Snapshot the editor for `lesson` and queue it. Must be called while
// `note.value` still holds that lesson's text (i.e. before the lesson-switch
// reset), which every caller above guarantees.
const flush = (lesson: string, force = false) => {
	cancelScheduledSave()
	if (!lesson) return
	if (!force && !isDirty.value) return
	const text = note.value
	if (!force && text === lastSaved[lesson]) return
	enqueueSave(lesson, text)
}

// Saves run strictly one after another. That prevents two concurrent creates
// (which would orphan a duplicate note) and lets a create's returned name be
// used by the next save for the same lesson.
let queue: Promise<void> = Promise.resolve()

const enqueueSave = (lesson: string, text: string | null) => {
	queue = queue.then(() => persist(lesson, text)).catch(() => {})
}

const submit = (resource: any, values: Record<string, any>) =>
	new Promise<Note>((resolve, reject) => {
		resource.submit(values, { onSuccess: resolve, onError: reject })
	})

const persist = async (lesson: string, text: string | null) => {
	const name = noteNames.value[lesson]
	// Never bring a blank note into existence.
	if (!name && isBlank(text)) {
		if (lesson === props.lesson) saveStatus.value = ''
		return
	}
	try {
		if (name) {
			await submit(notes.value?.setValue, {
				name,
				lesson,
				member: user?.data?.name,
				note: text,
			})
		} else {
			const data = await submit(notes.value?.insert, {
				lesson,
				member: user?.data?.name,
				note: text,
				color: 'Yellow',
				name: '',
			})
			if (data?.name) noteNames.value[lesson] = data.name
		}
		lastSaved[lesson] = text
		if (lesson === props.lesson) {
			// Only clear dirty if the editor hasn't changed since we sent this
			// value; otherwise a refetch would revert the newer keystrokes.
			if (note.value === text) isDirty.value = false
			saveStatus.value = __('Saved')
		}
		emit('updateNotes')
	} catch (err) {
		if (lesson === props.lesson) saveStatus.value = __('Not saved')
		console.error('Error saving note:', err)
		throw err
	}
}

// Best effort for tab close / reload: kick off the save and ask the browser to
// confirm leaving while it is unsaved.
const onBeforeUnload = (e: BeforeUnloadEvent) => {
	if (!isDirty.value || note.value === lastSaved[props.lesson]) return
	flush(props.lesson)
	e.preventDefault()
	e.returnValue = ''
}

/* ---------- Download ---------- */

const escapeHtml = (s: string) =>
	s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')

const slugify = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'lesson'

const downloadLessonNotes = () => {
	const title = props.lessonTitle || props.lesson
	const highlights = lessonRows().filter((row: Note) => row.highlighted_text)
	// Use the editor's live text so unsaved edits are included too.
	const body = !isBlank(note.value) ? note.value : ''
	if (!body && !highlights.length) {
		toast.warning(__('There are no notes in this lesson to download yet.'))
		return
	}
	const parts = [
		'<!doctype html><html><head><meta charset="utf-8">',
		`<title>${escapeHtml(title)} - ${escapeHtml(__('My Notes'))}</title>`,
		'<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#222;line-height:1.5}',
		'blockquote{border-left:3px solid #f5c542;margin:8px 0;padding:2px 12px;color:#444}',
		'.muted{color:#888;font-size:13px}</style></head><body>',
		`<h1>${escapeHtml(title)}</h1>`,
	]
	if (props.courseTitle) {
		parts.push(`<div class="muted">${escapeHtml(props.courseTitle)}</div>`)
	}
	if (body) parts.push(`<h2>${escapeHtml(__('Notes'))}</h2><div>${body}</div>`)
	if (highlights.length) {
		parts.push(`<h2>${escapeHtml(__('Highlights'))}</h2>`)
		highlights.forEach((h: Note) => {
			parts.push(`<blockquote>${escapeHtml(h.highlighted_text || '')}</blockquote>`)
			if (!isBlank(h.note)) parts.push(`<div>${h.note}</div>`)
		})
	}
	parts.push('</body></html>')

	const blob = new Blob([parts.join('')], { type: 'text/html' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `${slugify(title)}-notes.html`
	document.body.appendChild(a)
	a.click()
	a.remove()
	URL.revokeObjectURL(url)
}

const downloadCourseNotes = async () => {
	// Make sure what's on screen is included in the PDF.
	flush(props.lesson)
	await queue
	window.location.href =
		'/api/method/lms.lms.api.download_my_course_notes?course=' +
		encodeURIComponent(props.courseName || '')
}

const downloadOptions = computed(() => {
	const options = [
		{
			label: __('This lesson (HTML)'),
			onClick: downloadLessonNotes,
		},
	]
	if (props.courseName) {
		options.push({
			label: __('All notes in this course (PDF)'),
			onClick: downloadCourseNotes,
		})
	}
	return options
})
</script>
