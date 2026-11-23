<template>
	<SettingsLayout :title="label" :description="__(description)">
		<template #header-actions>
			<Button variant="solid" @click="openForm(null)">
				<template #prefix>
					<Plus class="h-4 w-4 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</template>

		<div v-if="rules.data?.length">
			<ListView
				:columns="columns"
				:rows="rules.data"
				row-key="name"
				:options="{
					showTooltip: false,
					selectable: false,
					onRowClick: (row: any) => openForm(row),
				}"
			>
				<ListHeader
					class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem
						:item="item"
						v-for="item in columns"
						:key="item.key"
					/>
				</ListHeader>
				<ListRows>
					<ListRow :row="row" v-for="row in rules.data" :key="row.name">
						<template #default="{ column }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<Badge
									v-if="column.key == 'enabled'"
									:theme="row.enabled ? 'green' : 'gray'"
								>
									{{ row.enabled ? __('Enabled') : __('Disabled') }}
								</Badge>
								<div v-else-if="column.key == 'condition'" class="text-sm">
									{{ row.operator }} {{ row.progress_percent }}%
								</div>
								<div v-else-if="column.key == 'course'" class="text-sm truncate">
									{{ row.course || __('All courses') }}
								</div>
								<div v-else-if="column.key == 'day_of_month'" class="text-sm">
									{{ ordinal(row.day_of_month) }}
								</div>
								<div v-else class="text-sm truncate">
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
			</ListView>
		</div>
		<EmptyStateLayout
			v-else
			name="Auto Emails"
			:description="__('Add a rule to email students automatically based on their progress.')"
			:icon="MailCheck"
		/>
	</SettingsLayout>

	<Dialog
		v-model="showForm"
		:options="{
			title: form.name ? __('Edit Auto Email Rule') : __('New Auto Email Rule'),
			size: 'xl',
		}"
	>
		<template #body-content>
			<div class="space-y-4">
				<FormControl
					v-model="form.title"
					:label="__('Title')"
					type="text"
					:required="true"
					:placeholder="__('e.g. Month-end low progress reminder')"
				/>
				<Link
					v-model="form.course"
					doctype="LMS Course"
					:label="__('Course')"
					:description="__('Leave empty to apply to all published courses.')"
				/>
				<div class="grid grid-cols-2 gap-4">
					<FormControl
						v-model="form.operator"
						type="select"
						:label="__('When progress is')"
						:options="operatorOptions"
					/>
					<FormControl
						v-model.number="form.progress_percent"
						type="number"
						:label="__('Percent')"
						:required="true"
					/>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<FormControl
						v-model.number="form.day_of_month"
						type="select"
						:label="__('Send on day of month')"
						:options="dayOptions"
					/>
					<FormControl
						v-model="form.send_time"
						type="time"
						:label="__('Send time')"
					/>
				</div>
				<div class="text-xs text-ink-gray-5 -mt-2">
					{{ __('Days 29 to 31 use the last day of shorter months.') }}
				</div>
				<Link
					v-model="form.email_template"
					doctype="Email Template"
					:label="__('Email template')"
					:required="true"
					:description="
						__(
							'Draft the mail under Email Templates. You can use {{ student_name }}, {{ course }} and {{ progress }}.'
						)
					"
				/>
				<Switch
					size="sm"
					v-model="form.enabled"
					:label="__('Enabled')"
					:description="__('Disabled rules never send.')"
				/>

				<div v-if="form.name" class="rounded-md border p-3 space-y-2">
					<div class="flex items-center gap-2">
						<Button :loading="previewing" @click="previewRecipients">
							{{ __('Preview recipients') }}
						</Button>
						<Button :loading="testing" @click="sendTest">
							{{ __('Send test to me') }}
						</Button>
					</div>
					<div v-if="preview" class="text-sm text-ink-gray-7">
						<div class="font-medium">
							{{ __('{0} matching enrollment(s)').format(String(preview.count)) }}
						</div>
						<div v-for="row in preview.sample" :key="row.member + row.course">
							{{ row.member_name || row.member }} · {{ row.course }} ·
							{{ Math.round(row.progress) }}%
						</div>
					</div>
					<div v-if="form.last_run_on" class="text-xs text-ink-gray-5">
						{{
							__('Last run {0}, sent {1}').format(
								form.last_run_on,
								String(form.last_run_count || 0)
							)
						}}
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div class="flex justify-between w-full">
				<Button v-if="form.name" theme="red" variant="subtle" @click="remove">
					{{ __('Delete') }}
				</Button>
				<span v-else />
				<Button variant="solid" :loading="saving" @click="save">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Badge,
	Button,
	call,
	createListResource,
	Dialog,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	toast,
} from 'frappe-ui'
import { computed, reactive, ref } from 'vue'
import { MailCheck, Plus } from 'lucide-vue-next'
import { cleanError } from '@/utils'
import Link from '@/components/Controls/Link.vue'
import Switch from '@/components/Controls/Switch.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

defineProps<{ label: string; description: string }>()

const rules = createListResource({
	doctype: 'LMS Auto Mail Rule',
	fields: [
		'name',
		'title',
		'enabled',
		'course',
		'operator',
		'progress_percent',
		'day_of_month',
		'send_time',
		'email_template',
		'last_run_on',
		'last_run_count',
	],
	order_by: 'creation desc',
	pageLength: 100,
	auto: true,
})

const blank = () => ({
	name: '',
	title: '',
	enabled: true,
	course: '',
	operator: '<',
	progress_percent: 30,
	day_of_month: 1,
	send_time: '09:00',
	email_template: '',
	last_run_on: '',
	last_run_count: 0,
})

const form = reactive<any>(blank())
const showForm = ref(false)
const saving = ref(false)
const previewing = ref(false)
const testing = ref(false)
const preview = ref<any>(null)

// The API can return 9:00:00 or 09:00:00.000000; the time input needs HH:mm.
const toTimeInput = (value?: string | null) => {
	const match = /^(\d{1,2}):(\d{2})/.exec(value || '')
	return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '09:00'
}

const openForm = (row: any | null) => {
	Object.assign(form, blank(), row || {})
	form.send_time = toTimeInput(form.send_time)
	preview.value = null
	showForm.value = true
}

const save = async () => {
	saving.value = true
	try {
		const values = {
			title: form.title,
			enabled: form.enabled ? 1 : 0,
			course: form.course || null,
			operator: form.operator,
			progress_percent: form.progress_percent,
			day_of_month: form.day_of_month,
			send_time: form.send_time || '09:00',
			email_template: form.email_template,
		}
		if (form.name) {
			await call('frappe.client.set_value', {
				doctype: 'LMS Auto Mail Rule',
				name: form.name,
				fieldname: values,
			})
		} else {
			await call('frappe.client.insert', {
				doc: { doctype: 'LMS Auto Mail Rule', ...values },
			})
		}
		toast.success(__('Rule saved'))
		showForm.value = false
		rules.reload()
	} catch (err: any) {
		toast.error(cleanError(err?.messages?.[0]) || __('Could not save the rule'))
	} finally {
		saving.value = false
	}
}

const remove = async () => {
	try {
		await call('frappe.client.delete', {
			doctype: 'LMS Auto Mail Rule',
			name: form.name,
		})
		toast.success(__('Rule deleted'))
		showForm.value = false
		rules.reload()
	} catch (err: any) {
		toast.error(cleanError(err?.messages?.[0]) || __('Could not delete the rule'))
	}
}

const previewRecipients = async () => {
	previewing.value = true
	try {
		preview.value = await call('lms.lms.api.get_auto_mail_recipients', {
			rule: form.name,
		})
	} catch (err: any) {
		toast.error(cleanError(err?.messages?.[0]) || __('Could not load recipients'))
	} finally {
		previewing.value = false
	}
}

const sendTest = async () => {
	testing.value = true
	try {
		await call('lms.lms.api.send_auto_mail_test', { rule: form.name })
		toast.success(__('Test email sent to you'))
	} catch (err: any) {
		toast.error(cleanError(err?.messages?.[0]) || __('Could not send the test'))
	} finally {
		testing.value = false
	}
}

const operatorOptions = [
	{ label: __('less than (<)'), value: '<' },
	{ label: __('less than or equal (<=)'), value: '<=' },
	{ label: __('greater than (>)'), value: '>' },
	{ label: __('greater than or equal (>=)'), value: '>=' },
]

const dayOptions = Array.from({ length: 31 }, (_, i) => ({
	label: String(i + 1),
	value: i + 1,
}))

const ordinal = (n: number) => {
	const s = ['th', 'st', 'nd', 'rd']
	const v = n % 100
	return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const columns = computed(() => [
	{ label: __('Title'), key: 'title', width: '28%' },
	{ label: __('Course'), key: 'course', width: '22%' },
	{ label: __('Condition'), key: 'condition', width: '15%' },
	{ label: __('Day'), key: 'day_of_month', width: '10%' },
	{ label: __('Status'), key: 'enabled', width: '15%' },
])
</script>
