<template>
	<div class="mt-6">
		<div v-if="!singleThread" class="flex items-center mb-5">
			<Button variant="outline" @click="showTopics = true">
				<template #icon>
					<ChevronLeft class="w-5 h-5 stroke-1.5 text-ink-gray-7" />
				</template>
			</Button>
			<span class="text-lg font-semibold ms-2 text-ink-gray-9">
				{{ topic.title }}
			</span>
		</div>

		<div v-for="(reply, index) in replies.data">
			<div
				class="py-3"
				:class="{ 'border-b': index + 1 != replies.data.length }"
			>
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center text-ink-gray-5">
						<UserAvatar :user="reply.user" class="me-2" />
						<span>
							{{ reply.user.full_name }}
						</span>
						<span class="text-sm ms-2">
							{{ timeAgo(reply.creation) }}
						</span>
					</div>
					<!-- The author can edit or delete their own reply (explicit,
					     obvious controls). -->
					<div
						v-if="
							user.data.name == reply.owner && !reply.editable && !readOnlyMode
						"
						class="flex items-center gap-x-1"
					>
						<Button
							variant="ghost"
							:label="__('Edit')"
							@click="reply.editable = true"
						>
							<template #icon>
								<Pencil class="w-4 h-4" />
							</template>
						</Button>
						<Button
							variant="ghost"
							:label="__('Delete')"
							@click="deleteReply(reply)"
						>
							<template #icon>
								<Trash2 class="w-4 h-4 text-ink-red-3" />
							</template>
						</Button>
					</div>
					<!-- #8: moderators can remove someone else's reply. -->
					<Button
						v-else-if="canModerate && user.data.name != reply.owner && !readOnlyMode"
						variant="ghost"
						:label="__('Remove')"
						@click="moderatorDeleteReply(reply)"
					>
						<template #icon>
							<Trash2 class="w-4 h-4 text-ink-red-3" />
						</template>
					</Button>
					<div v-if="reply.editable">
						<Button variant="ghost" @click="postEdited(reply)">
							{{ __('Post') }}
						</Button>
						<Button variant="ghost" @click="reply.editable = false">
							{{ __('Discard') }}
						</Button>
					</div>
				</div>
				<TextEditor
					:content="reply.reply"
					@change="(val) => (reply.reply = val)"
					:editable="reply.editable || false"
					:fixedMenu="reply.editable || false"
					:editorClass="
						reply.editable
							? 'ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none'
							: 'prose-sm'
					"
				/>
			</div>
		</div>

		<TextEditor
			v-if="renderEditor && !readOnlyMode"
			class="mt-5"
			:content="newReply"
			:mentions="mentionUsers"
			@change="(val) => (newReply = val)"
			placeholder="Type your reply here..."
			:fixedMenu="true"
			editorClass="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none border border-outline-gray-2 rounded-b-md min-h-[7rem] py-1 px-2"
		/>
		<div v-if="!readOnlyMode" class="flex justify-between mt-2">
			<!-- #25: emoji support -->
			<div class="relative">
				<Button variant="ghost" @click="showEmoji = !showEmoji">
					<template #icon>
						<Smile class="size-4" />
					</template>
				</Button>
				<div
					v-if="showEmoji"
					class="absolute z-10 bottom-full mb-2 start-0 bg-surface-white border rounded-md shadow-lg p-2 grid grid-cols-8 gap-1 w-64"
				>
					<button
						v-for="e in emojis"
						:key="e"
						type="button"
						class="text-lg leading-none p-1 hover:bg-surface-gray-2 rounded"
						@click="insertEmoji(e)"
					>
						{{ e }}
					</button>
				</div>
			</div>
			<Button @click="postReply()">
				<span>
					{{ __('Post') }}
				</span>
			</Button>
		</div>
	</div>
</template>
<script setup>
import {
	call,
	createResource,
	TextEditor,
	Button,
	toast,
} from 'frappe-ui'
import { timeAgo } from '@/utils'
import UserAvatar from '@/components/UserAvatar.vue'
import { ChevronLeft, Pencil, Trash2, Smile } from 'lucide-vue-next'
import { ref, inject, onMounted, onUnmounted } from 'vue'
import { useTelemetry } from 'frappe-ui/frappe'

const showTopics = defineModel('showTopics')
const newReply = ref('')
// #25: emoji picker
const showEmoji = ref(false)
const emojis = [
	'😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤔',
	'👍', '👏', '🙌', '🙏', '💪', '🔥', '✨', '🎉',
	'✅', '❌', '❤️', '💡', '📚', '📝', '⭐', '🚀',
]
const insertEmoji = (emoji) => {
	newReply.value = (newReply.value || '') + emoji
	showEmoji.value = false
}
const socket = inject('$socket')
const user = inject('$user')
const allUsers = inject('$allUsers')
const mentionUsers = ref([])
const renderEditor = ref(false)
const readOnlyMode = window.read_only_mode
const canModerate = ref(false)
const { capture } = useTelemetry()

const props = defineProps({
	topic: {
		type: Object,
		required: true,
	},
	singleThread: {
		type: Boolean,
		default: false,
	},
})

onMounted(() => {
	socket.on('publish_message', (data) => {
		replies.reload()
	})
	socket.on('update_message', (data) => {
		replies.reload()
	})
	socket.on('delete_message', (data) => {
		replies.reload()
	})
	fetchMentionUsers()
	call('ecological_society.discussions.can_moderate_discussions')
		.then((v) => (canModerate.value = !!v))
		.catch(() => {})
})

const replies = createResource({
	url: 'lms.lms.utils.get_discussion_replies',
	cache: ['replies', props.topic],
	makeParams(values) {
		return {
			topic: props.topic.name,
		}
	},
	auto: true,
})

const fetchMentionUsers = () => {
	if (user.data?.is_student) {
		call('lms.lms.api.get_faculty_users')
			.then((data) => {
				mentionUsers.value = Object.values(data).map((user) => {
					return {
						value: user.name,
						label: user.full_name,
					}
				})
				renderEditor.value = true
			})
			.catch((err) => {
				console.error(err)
				renderEditor.value = true
			})
	} else {
		allUsers.reload(
			{},
			{
				onSuccess(data) {
					mentionUsers.value = Object.values(data).map((user) => {
						return {
							value: user.name,
							label: user.full_name,
						}
					})
					renderEditor.value = true
				},
			}
		)
	}
}

const postReply = () => {
	if (!newReply.value) {
		toast.error(__('Reply cannot be empty.'))
		return
	}
	call('frappe.client.insert', {
		doc: {
			doctype: 'Discussion Reply',
			reply: newReply.value,
			topic: props.topic.name,
		},
	})
		.then((data) => {
			newReply.value = ''
			replies.reload()
			capture('discussion_reply_created')
		})
		.catch((err) => {
			toast.error(err.messages?.[0] || err)
			console.error(err)
		})
}

const postEdited = (reply) => {
	if (!reply.reply) {
		toast.error(__('Reply cannot be empty.'))
		return
	}
	call('frappe.client.set_value', {
		doctype: 'Discussion Reply',
		name: reply.name,
		fieldname: 'reply',
		value: reply.reply,
	})
		.then(() => {
			reply.editable = false
			replies.reload()
		})
		.catch((err) => {
			toast.error(err.messages?.[0] || err)
			console.error(err)
		})
}

const deleteReply = (reply) => {
	call('frappe.client.delete', {
		doctype: 'Discussion Reply',
		name: reply.name,
	})
		.then(() => {
			replies.reload()
		})
		.catch((err) => {
			toast.error(err.messages?.[0] || err)
			console.error(err)
		})
}

// #8: moderator removal of another user's reply (server enforces permission).
const moderatorDeleteReply = (reply) => {
	call('ecological_society.discussions.delete_discussion_reply', {
		reply: reply.name,
	})
		.then(() => {
			toast.success(__('Reply removed'))
			replies.reload()
		})
		.catch((err) =>
			toast.error(err.messages?.[0] || __('Could not remove the reply'))
		)
}

onUnmounted(() => {
	socket.off('publish_message')
	socket.off('update_message')
	socket.off('delete_message')
})
</script>
