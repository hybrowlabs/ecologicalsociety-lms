<template>
	<LayoutHeader>
		<template #left-header>
			<Breadcrumbs :items="breadcrumbs" />
		</template>
		<template #right-header>
			<Button
				:disabled="!assignmentID || !submissions.data?.length"
				:loading="downloading"
				:title="
					assignmentID
						? __('Download all submissions as a ZIP')
						: __('Select an assignment to download its submissions')
				"
				@click="downloadAllSubmissions"
			>
				<template #prefix>
					<Download class="size-4 stroke-1.5" />
				</template>
				{{ __('Download All') }}
			</Button>
		</template>
	</LayoutHeader>
	<div class="md:w-3/4 md:mx-auto py-5 mx-5">
		<div class="grid grid-cols-3 gap-5 mb-5">
			<Link
				doctype="LMS Assignment"
				v-model="assignmentID"
				:placeholder="__('Assignment')"
			/>
			<Link doctype="User" v-model="member" :placeholder="__('Member')" />
			<FormControl
				v-model="status"
				type="select"
				:options="statusOptions"
				:placeholder="__('Status')"
			/>
		</div>
		<ListView
			v-if="submissions.loading || submissions.data?.length"
			:columns="submissionColumns"
			:rows="submissions.data"
			rowKey="name"
		>
			<ListHeader
				class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
			>
				<ListHeaderItem :item="item" v-for="item in submissionColumns" />
			</ListHeader>
			<ListRows>
				<router-link
					v-for="row in submissions.data"
					:to="{
						name: 'AssignmentSubmission',
						params: {
							assignmentID: row.assignment,
							submissionName: row.name,
						},
					}"
				>
					<ListRow :row="row">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div v-if="column.key == 'status'">
									<Badge :theme="getStatusTheme(row[column.key])">
										{{ row[column.key] }}
									</Badge>
								</div>
								<div v-else>
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</router-link>
			</ListRows>
		</ListView>
		<div
			v-else
			class="text-center p-5 text-ink-gray-5 mt-52 w-3/4 md:w-1/2 mx-auto space-y-2"
		>
			<Pencil class="size-8 mx-auto stroke-1 text-ink-gray-4" />
			<div class="text-xl font-medium">
				{{ __('No submissions') }}
			</div>
			<div class="leading-5">
				{{ __('There are no submissions for this assignment.') }}
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Badge,
	Breadcrumbs,
	Button,
	createListResource,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Pencil } from 'lucide-vue-next'
import { sessionStore } from '../stores/session'
import Link from '@/components/Controls/Link.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'

const user = inject('$user')
const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const router = useRouter()
const assignmentID = ref('')
const member = ref('')
const status = ref('')

onMounted(() => {
	if (!user.data?.is_instructor && !user.data?.is_moderator) {
		router.push({ name: 'Courses' })
	}
	assignmentID.value = router.currentRoute.value.query.assignmentID
	member.value = router.currentRoute.value.query.member
	status.value = router.currentRoute.value.query.status
	reloadSubmissions()
})

const getAssignmentFilters = () => {
	let filters = {}
	if (assignmentID.value) {
		filters.assignment = assignmentID.value
	}
	if (member.value) {
		filters.member = member.value
	}
	if (status.value) {
		filters.status = status.value
	}
	return filters
}

const submissions = createListResource({
	doctype: 'LMS Assignment Submission',
	fields: [
		'name',
		'assignment',
		'assignment_title',
		'member_name',
		'creation',
		'status',
	],
	orderBy: 'creation desc',
	transform(data) {
		return data.map((row) => {
			return {
				...row,
				creation: dayjs(row.creation).fromNow(),
			}
		})
	},
})

watch([assignmentID, member, status], () => {
	router.push({
		query: {
			assignmentID: assignmentID.value,
			member: member.value,
			status: status.value,
		},
	})
	reloadSubmissions()
})

const reloadSubmissions = () => {
	submissions.update({
		filters: getAssignmentFilters(),
	})
	submissions.reload()
}

const downloading = ref(false)

const downloadAllSubmissions = async () => {
	if (!assignmentID.value) return
	downloading.value = true
	try {
		const params = new URLSearchParams({ assignment: assignmentID.value })
		if (status.value) params.append('status', status.value)
		if (member.value) params.append('member', member.value)
		const response = await fetch(
			'/api/method/lms.lms.api.download_assignment_submissions?' +
				params.toString(),
			{ method: 'GET', credentials: 'include' },
		)
		if (!response.ok) {
			let message = __('Could not download submissions')
			try {
				const data = await response.json()
				const serverMessages = JSON.parse(data._server_messages || '[]')
				if (serverMessages.length) {
					message = JSON.parse(serverMessages[0]).message || message
				}
			} catch (e) {}
			throw new Error(message)
		}
		const blob = await response.blob()
		const disposition = response.headers.get('Content-Disposition')
		let filename = 'submissions.zip'
		if (disposition && disposition.includes('filename=')) {
			filename = disposition.split('filename=')[1].replace(/"/g, '').trim()
		}
		const url = window.URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		a.remove()
		window.URL.revokeObjectURL(url)
	} catch (err) {
		toast.error(err.message)
	} finally {
		downloading.value = false
	}
}

const submissionColumns = computed(() => {
	return [
		{
			label: 'Member',
			key: 'member_name',
			width: 1,
		},
		{
			label: 'Assignment',
			key: 'assignment_title',
			width: 2,
		},
		{
			label: 'Submitted',
			key: 'creation',
			width: 1,
			align: 'left',
		},
		{
			label: 'Status',
			key: 'status',
			width: 1,
			align: 'center',
		},
	]
})

const statusOptions = computed(() => {
	return [
		{ label: '', value: '' },
		{ label: 'Pass', value: 'Pass' },
		{ label: 'Fail', value: 'Fail' },
		{ label: 'Not Graded', value: 'Not Graded' },
	]
})

const getStatusTheme = (status) => {
	if (status === 'Pass') {
		return 'green'
	} else if (status === 'Not Graded') {
		return 'blue'
	} else {
		return 'red'
	}
}

const breadcrumbs = computed(() => {
	return [
		{
			label: 'Assignment Submissions',
		},
	]
})

usePageMeta(() => {
	return {
		title: __('Assignment Submissions'),
		icon: brand.favicon,
	}
})
</script>
