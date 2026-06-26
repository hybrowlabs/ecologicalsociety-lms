<template>
	<div class="w-[90%] lg:w-[75%] mx-auto mt-5">
		<div class="flex items-center justify-between mb-5">
			<div class="text-ink-gray-9 font-semibold text-lg">
				{{ __('Announcements') }}
			</div>
			<Badge v-if="unreadCount > 0" theme="red" size="sm">
				{{ unreadCount }} {{ __('Unread') }}
			</Badge>
		</div>
		<div v-if="communications.data?.length">
			<div v-for="comm in communications.data" :key="comm.name">
				<div
					class="mb-8 cursor-pointer"
					:class="{ 'opacity-70': comm.is_read }"
					@click="openAnnouncement(comm)"
				>
					<div class="flex items-center justify-between mb-2">
						<div class="flex items-center gap-2">
							<Avatar :label="comm.sender_full_name" size="lg" />
							<div class="ms-2 text-ink-gray-7">
								{{ comm.sender_full_name }}
							</div>
							<Badge v-if="!comm.is_read" theme="blue" size="sm">
								{{ __('New') }}
							</Badge>
						</div>
						<div class="text-sm">
							{{ timeAgo(comm.communication_date) }}
						</div>
					</div>
					<div class="font-medium text-ink-gray-9 mb-1">{{ comm.subject }}</div>
					<div
						class="prose prose-sm bg-surface-menu-bar !min-w-full px-4 py-2 rounded-md"
						v-html="comm.content"
					></div>
					<Button
						v-if="!comm.is_read"
						variant="subtle"
						size="sm"
						class="mt-2"
						@click.stop="markRead(comm)"
					>
						{{ __('Mark as Read') }}
					</Button>
				</div>
			</div>
		</div>
		<div v-else class="text-ink-gray-7 leading-5">
			{{ __('No announcements have been made yet for this batch') }}
		</div>
	</div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { Badge, Button, call, createResource, Avatar } from 'frappe-ui'
import { timeAgo } from '@/utils'

const props = defineProps({
	batch: {
		type: Object,
		required: true,
	},
})

const unreadCount = ref(0)

const communications = createResource({
	url: 'lms.lms.api.get_announcements',
	makeParams() {
		return {
			batch: props.batch.data?.name,
		}
	},
	auto: true,
	cache: ['announcement', props.batch.data?.name],
	onSuccess(data) {
		unreadCount.value = (data || []).filter((c) => !c.is_read).length
	},
})

watch(
	() => props.batch.data?.name,
	() => {
		if (props.batch.data?.name) {
			loadUnreadCount()
		}
	}
)

const loadUnreadCount = () => {
	call('ecological_society.announcements.get_unread_announcement_count', {
		batch: props.batch.data?.name,
	}).then((data) => {
		unreadCount.value = data?.count || 0
	})
}

const markRead = (comm) => {
	call('ecological_society.announcements.mark_announcement_read', {
		communication: comm.name,
		batch: props.batch.data?.name,
	}).then(() => {
		comm.is_read = true
		comm.read = true
		unreadCount.value = Math.max(0, unreadCount.value - 1)
	})
}

const openAnnouncement = (comm) => {
	if (!comm.is_read) {
		markRead(comm)
	}
}
</script>
<style>
.prose-sm p {
	margin: 0 0 0.5rem;
}
</style>
