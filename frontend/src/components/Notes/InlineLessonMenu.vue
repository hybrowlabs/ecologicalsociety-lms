<template>
	<!-- Zen Mode puts the lesson into fullscreen, and the browser paints only the
	     fullscreen element's subtree: a menu left at the page root is simply not
	     rendered there. Teleport it inside whatever element is currently
	     fullscreen so the highlight actions stay reachable in Zen Mode. -->
	<Teleport :to="teleportTarget">
		<div
			v-show="visible"
			class="inline-lesson-menu text-sm bg-white border rounded-md shadow-md z-50 w-44"
			:class="isFullscreen ? 'fixed' : 'absolute'"
			:style="{
				top: top + 'px',
				insetInlineStart: left + 'px',
			}"
		>
			<div class="space-y-2 py-2">
				<div class="text-xs text-ink-gray-5 font-medium px-3">
					{{ __('Highlight') }}
				</div>
				<div class="">
					<div
						v-for="color in colors"
						class="flex items-center gap-x-2 px-3 py-2 cursor-pointer hover:bg-surface-gray-2"
						@click="saveHighLight(color)"
					>
						<span
							class="size-3 rounded-full"
							:style="{
								backgroundColor: getColor(color.toLowerCase(), 400),
							}"
						></span>
						<span>
							{{ __(color) }}
						</span>
					</div>
				</div>
			</div>
			<div class="border-t">
				<div
					@click="addToNotes()"
					class="flex items-center gap-x-2 hover:bg-surface-gray-2 cursor-pointer rounded-b-md py-2 px-3"
				>
					<NotepadText class="size-3 stroke-1.5" />
					<span>
						{{ __('Add to Notes') }}
					</span>
				</div>
				<div
					v-if="highlightExists()"
					@click="deleteHighlight"
					class="flex items-center gap-x-2 hover:bg-surface-gray-2 cursor-pointer rounded-b-md py-2 px-3"
				>
					<Trash2 class="size-3 stroke-1.5" />
					<span>
						{{ __('Remove Highlight') }}
					</span>
				</div>
			</div>
		</div>
	</Teleport>
</template>
<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NotepadText, Trash2 } from 'lucide-vue-next'
import type { Note, Notes } from '@/components/Notes/types'
import {
	blockQuotesClick,
	getColor,
	highlightText,
	removeHighlight,
	removeHighlightElement,
} from '@/utils'

const user = inject<any>('$user')
const show = defineModel()
const notes = defineModel<Notes>('notes')
const top = ref(0)
const left = ref(0)
const visible = ref(false)
// Where the menu is rendered: the fullscreen (Zen Mode) element when there is
// one, the page body otherwise.
const teleportTarget = ref<Element | string>('body')
const isFullscreen = computed(() => teleportTarget.value !== 'body')
const currentSelection = ref<Selection | null>(null)
const selectedText = ref('')
const emit = defineEmits<{
	(e: 'updateNotes'): void
}>()

const props = defineProps<{
	lesson: string
}>()

watch(show, () => {
	if (!show.value) {
		return resetMenuPosition()
	}

	currentSelection.value = window.getSelection()
	if (!currentSelection.value?.toString()) {
		return resetMenuPosition()
	}

	updateMenuPosition()
})

// Rough size of the card, used only to keep it inside the viewport.
const MENU_WIDTH = 176
const MENU_HEIGHT = 260
const EDGE_GAP = 8

const updateMenuPosition = () => {
	selectedText.value = currentSelection.value?.toString() || ''
	const range = currentSelection.value?.getRangeAt(0)
	const rect = range?.getBoundingClientRect()
	if (!rect) return resetMenuPosition()

	if (isFullscreen.value) {
		// In Zen Mode the lesson scrolls inside the fullscreen element, so page
		// scroll offsets say nothing about where the selection is on screen: the
		// menu is positioned `fixed` from the viewport rect instead, clamped so a
		// selection near an edge doesn't push it off screen.
		top.value = Math.floor(
			clamp(rect.top - 40, window.innerHeight - MENU_HEIGHT)
		)
		left.value = Math.floor(
			clamp(rect.right + 10, window.innerWidth - MENU_WIDTH)
		)
	} else {
		top.value = Math.floor(rect.top + window.scrollY - 40)
		left.value = Math.floor(rect.right + window.scrollX + 10)
	}
	visible.value = true
}

const clamp = (value: number, max: number) =>
	Math.max(EDGE_GAP, Math.min(value, Math.max(EDGE_GAP, max - EDGE_GAP)))

const resetMenuPosition = () => {
	visible.value = false
	top.value = 0
	left.value = 0
}

const syncTeleportTarget = () => {
	teleportTarget.value = document.fullscreenElement || 'body'
	// Entering or leaving fullscreen resizes the viewport and re-lays out the
	// lesson, so any open menu is now anchored to nothing: close it.
	resetStates()
}

// A menu pinned to the viewport would hang there while the lesson scrolls
// underneath it, so dismiss it on scroll -- but only in Zen Mode, where the
// menu is `fixed`; the normal, absolutely positioned menu scrolls with the
// text it belongs to and should stay put.
const dismissOnScroll = () => {
	if (isFullscreen.value && show.value) resetStates()
}

onMounted(() => {
	syncTeleportTarget()
	document.addEventListener('fullscreenchange', syncTeleportTarget)
	document.addEventListener('scroll', dismissOnScroll, true)
})

onBeforeUnmount(() => {
	document.removeEventListener('fullscreenchange', syncTeleportTarget)
	document.removeEventListener('scroll', dismissOnScroll, true)
})

const colors = computed(() => {
	return ['Red', 'Blue', 'Green', 'Yellow', 'Purple']
})

// The highlighted `<span class="highlighted-text" data-name="...">` the current
// selection sits inside (or overlaps), if any. Matching on the rendered element
// is far more reliable than comparing exact selected strings: partial
// selections, trailing whitespace or spanning nodes used to make the exact-text
// check fail, so "Remove Highlight" silently disappeared even on highlighted
// content.
const highlightedElAtSelection = (): HTMLElement | null => {
	const selection = currentSelection.value
	if (!selection || selection.rangeCount === 0) return null
	const candidates = [
		selection.anchorNode,
		selection.focusNode,
		selection.getRangeAt(0).commonAncestorContainer,
	]
	for (const node of candidates) {
		const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null)
		const hit = el?.closest?.('.highlighted-text') as HTMLElement | null
		if (hit) return hit
	}
	return null
}

const highlightExists = () => {
	// Prefer the rendered highlight under the cursor; fall back to an exact
	// text match so highlights created this session (before a reload) still show.
	if (highlightedElAtSelection()) return true
	return notes.value?.data?.some(
		(note: Note) => note.highlighted_text === selectedText.value
	)
}

const saveHighLight = (color: string) => {
	if (!selectedText.value) return

	notes.value?.insert.submit(
		{
			lesson: props.lesson,
			member: user?.data?.name,
			highlighted_text: selectedText.value,
			color: color,
			name: '',
		},
		{
			onSuccess(data: Note) {
				highlightText(data)
				resetStates()
				emit('updateNotes')
			},
			onError(err: any) {
				console.error('Error saving highlight:', err)
				resetStates()
			},
		}
	)
}

const deleteHighlight = () => {
	// Delete the highlight the selection actually sits in (by its data-name)
	// when we can resolve it; otherwise fall back to matching the selected text.
	const el = highlightedElAtSelection()
	const targetName = el?.dataset?.name
	const notesToDelete = targetName
		? notes.value?.data.find((note: Note) => note.name === targetName)
		: notes.value?.data.find(
				(note: Note) => note.highlighted_text === selectedText.value
		  )

	if (!notesToDelete) {
		// The span outlived the note behind it — the temporary scroll-to marker,
		// or a highlight whose note is already gone. Clear the leftover markup so
		// the menu stops offering to remove something that no longer exists,
		// instead of leaving the click doing nothing at all.
		if (el) removeHighlightElement(el)
		resetStates()
		return
	}

	notes.value?.delete.submit(notesToDelete.name, {
		onSuccess() {
			// Unwrap the spans rather than clearing their background: a span left
			// in place still counts as a highlight, so the menu would keep
			// offering to remove it and the phrase could not be highlighted
			// cleanly again.
			removeHighlight(notesToDelete.name)
			resetStates()
		},
		onError(err: any) {
			console.error('Error deleting highlight:', err)
			resetStates()
		},
	})
}

const addToNotes = () => {
	if (!selectedText.value) return
	let noteToUpdate = notes.value?.data.find((note: Note) => {
		return !note.highlighted_text && note.note !== ''
	})
	if (!noteToUpdate) {
		createNote()
	} else {
		updateNote(noteToUpdate)
	}
}

const createNote = () => {
	notes.value?.insert.submit(
		{
			lesson: props.lesson,
			member: user?.data?.name,
			note: `<blockquote><p>${selectedText.value}</p></blockquote><br>`,
			color: 'Yellow',
			name: '',
		},
		{
			onSuccess(data: Note) {
				emit('updateNotes')
				setTimeout(() => {
					scrollToText(selectedText.value)
					blockQuotesClick()
					resetStates()
				}, 100)
			},
			onError(err: any) {
				console.error('Error creating note:', err)
				resetStates()
			},
		}
	)
}

const updateNote = (noteToUpdate: Note) => {
	notes.value?.setValue.submit(
		{
			name: noteToUpdate.name,
			note: `${noteToUpdate.note}\n\n<blockquote><p>${selectedText.value}</p></blockquote><br>`,
		},
		{
			onSuccess(data: Note) {
				emit('updateNotes')
				setTimeout(() => {
					scrollToText(selectedText.value)
					blockQuotesClick()
					resetStates()
				}, 100)
			},
			onError(err: any) {
				console.error('Error updating note:', err)
				resetStates()
			},
		}
	)
}

const scrollToText = (text: string) => {
	const elements = document.querySelectorAll('blockquote p')
	Array.from(elements).forEach((el) => {
		const element = el as HTMLElement
		if (element.textContent?.toLowerCase().includes(text.toLowerCase())) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}
	})
}

const resetStates = () => {
	selectedText.value = ''
	show.value = false
	resetMenuPosition()
}
</script>

<style>
/* Zen Mode's dark theme repaints every descendant of the fullscreen container,
   and the menu is teleported inside it -- without its own palette the card
   would render light text on white. */
.zen-dark .inline-lesson-menu {
	background-color: #1e293b;
	border-color: #334155;
}
.zen-dark .inline-lesson-menu,
.zen-dark .inline-lesson-menu .text-ink-gray-5 {
	color: #e2e8f0 !important;
}
.zen-dark .inline-lesson-menu .border-t {
	border-color: #334155 !important;
}
.zen-dark .inline-lesson-menu .hover\:bg-surface-gray-2:hover {
	background-color: #334155 !important;
}
</style>
