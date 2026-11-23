<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Message Students'),
			size: 'xl',
			actions: [
				{
					label: __('Send'),
					variant: 'solid',
					onClick: ({ close }) => send(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<div>
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Recipients') }} ({{ recipients.length }})
					</div>
					<div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
						<Badge
							v-for="recipient in recipients"
							:key="recipient.member"
							theme="gray"
						>
							{{ recipient.member_name || recipient.member }}
						</Badge>
					</div>
				</div>
				<FormControl
					:label="__('Subject')"
					type="text"
					v-model="form.subject"
					:required="true"
				/>
				<div>
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Message') }}
						<span class="text-ink-red-3">*</span>
					</div>
					<TextEditor
						:fixedMenu="true"
						@change="(val: string) => (form.message = val)"
						editorClass="prose-sm py-2 px-2 min-h-[160px] border-outline-gray-2 hover:border-outline-gray-3 rounded-b-md bg-surface-gray-3"
					/>
					<div class="mt-1 text-xs text-ink-gray-5">
						{{ placeholderHint }}
					</div>
				</div>
				<div class="flex items-center gap-x-6">
					<FormControl
						type="checkbox"
						:label="__('Send email')"
						v-model="form.send_email"
					/>
					<FormControl
						type="checkbox"
						:label="__('Send in-app notification')"
						v-model="form.send_notification"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Badge, Dialog, FormControl, TextEditor, call, toast } from 'frappe-ui'
import { reactive } from 'vue'

const show = defineModel<boolean>()

const props = defineProps<{
	batch: string
	recipients: { member: string; member_name?: string }[]
}>()

const placeholderHint = __(
	'You can use {{ student_name }}, {{ batch }}, {{ progress }}, {{ courses }} and {{ pending_courses }}; they are filled in for each student.'
)

const emit = defineEmits<{ (e: 'sent'): void }>()

const form = reactive({
	subject: '',
	message: '',
	send_email: true,
	send_notification: true,
})

const send = async (close: () => void) => {
	if (!form.subject.trim() || !form.message.trim()) {
		toast.error(__('Subject and message are required.'))
		return
	}
	if (!form.send_email && !form.send_notification) {
		toast.error(__('Choose at least one of email or notification.'))
		return
	}
	try {
		await call('lms.lms.api.send_batch_student_message', {
			batch: props.batch,
			students: props.recipients.map((r) => r.member),
			subject: form.subject,
			message: form.message,
			send_email: form.send_email ? 1 : 0,
			send_notification: form.send_notification ? 1 : 0,
		})
		toast.success(__('Message sent to {0} student(s)').format(props.recipients.length))
		emit('sent')
		close()
	} catch (err: any) {
		toast.error(err?.messages?.[0] || __('Could not send the message'))
	}
}
</script>
