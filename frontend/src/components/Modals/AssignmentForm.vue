<template>
	<Dialog
		v-model="show"
		:options="{
			size: 'lg',
		}"
	>
		<template #body>
			<div class="p-5 text-base">
				<div class="text-lg text-ink-gray-9 font-semibold mb-5">
					{{
						assignmentID === 'new'
							? __('Create an Assignment')
							: __('Edit Assignment')
					}}
				</div>
				<div class="space-y-4 max-h-[75vh] overflow-y-auto p-1">
					<FormControl
						v-model="assignment.title"
						:label="__('Title')"
						:required="true"
					/>
					<FormControl
						v-model="assignment.type"
						type="select"
						:options="assignmentOptions"
						:label="__('Submission Type')"
						:required="true"
					/>
					<Link
						v-model="assignment.course"
						:label="__('Course')"
						doctype="LMS Course"
						placeholder=" "
					/>
					<div>
						<div class="text-xs text-ink-gray-5 mb-2">
							{{ __('Question') }}
							<span class="text-ink-red-3">*</span>
						</div>
						<TextEditor
							:content="assignment.question"
							@change="(val) => (assignment.question = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x border-outline-gray-modals bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[10rem] max-h-[18rem] overflow-y-auto"
						/>
					</div>
					<div>
						<div class="text-sm font-medium text-ink-gray-9 mb-2">
							{{ __('Reference Attachments') }}
						</div>
						<div class="space-y-2">
							<div
								v-for="(file, index) in referenceFiles"
								:key="index"
								class="flex items-center justify-between border rounded-md p-2"
							>
								<span class="text-sm truncate">{{ file.file_name }}</span>
								<Button variant="ghost" @click="removeReferenceFile(index)">
									{{ __('Remove') }}
								</Button>
							</div>
							<div class="flex items-center gap-2">
								<FormControl
									v-model="newFileType"
									type="select"
									:options="referenceFileTypes"
									:label="__('File Type')"
									class="flex-1"
								/>
								<FileUploader
									:fileTypes="referenceAcceptTypes"
									:uploadArgs="{ private: false }"
									@success="(file) => addReferenceFile(file)"
								>
									<template #default="{ uploading, openFileSelector }">
										<Button
											@click="openFileSelector"
											:loading="uploading"
											variant="outline"
										>
											{{ __('Upload File') }}
										</Button>
									</template>
								</FileUploader>
							</div>
						</div>
					</div>
				</div>

				<div class="flex justify-end gap-x-2 mt-5">
					<router-link
						:to="{
							name: 'AssignmentSubmissionList',
							query: {
								assignmentID: assignmentID,
							},
						}"
					>
						<Button v-if="assignmentID !== 'new'" variant="subtle">
							{{ __('Check Submissions') }}
						</Button>
					</router-link>
					<Button variant="solid" @click="saveAssignment">
						{{ __('Save') }}
					</Button>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Button, Dialog, FileUploader, FormControl, TextEditor, toast } from 'frappe-ui'
import { computed, reactive, ref, watch } from 'vue'
import { sanitizeHTML } from '@/utils'
import Link from '@/components/Controls/Link.vue'

const show = defineModel()
const assignments = defineModel<Assignments>('assignments')

interface Assignment {
	title: string
	type: string
	question: string
	course?: string
}

interface Assignments {
	data: Assignment[]
	get: (params: { doctype: string; name: string }) => Promise<Assignment>
	insert: {
		submit: (params: Assignment, options: { onSuccess: () => void }) => void
	}
}

const assignment = reactive({
	title: '',
	type: '',
	question: '',
	course: '',
})

const referenceFiles = ref([])
const newFileType = ref('PDF')

const referenceFileTypes = [
	{ label: 'PDF', value: 'PDF' },
	{ label: 'Document', value: 'Document' },
	{ label: 'Image', value: 'Image' },
	{ label: 'Video', value: 'Video' },
]

const referenceAcceptTypes = computed(() => {
	if (newFileType.value === 'PDF') return ['.pdf']
	if (newFileType.value === 'Document') {
		return ['.doc', '.docx', 'application/msword']
	}
	if (newFileType.value === 'Image') return ['image/*']
	if (newFileType.value === 'Video') return ['video/*', '.mp4', '.webm']
	return []
})

const addReferenceFile = (file) => {
	referenceFiles.value.push({
		file_type: newFileType.value,
		file: file.file_url,
		file_name: file.file_name || file.file_url.split('/').pop(),
	})
}

const removeReferenceFile = (index) => {
	referenceFiles.value.splice(index, 1)
}

const props = defineProps({
	assignmentID: {
		type: String,
		default: 'new',
	},
})

watch(
	() => props.assignmentID,
	(val) => {
		if (val !== 'new') {
			assignments.value?.data.forEach((row) => {
				if (row.name === val) {
					assignment.title = row.title
					assignment.type = row.type
					assignment.question = row.question
					assignment.course = row.course || ''
				}
			})
		}
	},
	{ flush: 'post' }
)

watch(show, (newVal) => {
	if (newVal && props.assignmentID === 'new') {
		assignment.title = ''
		assignment.type = ''
		assignment.question = ''
		referenceFiles.value = []
	}
})

const validateFields = () => {
	assignment.title = sanitizeHTML(assignment.title.trim())
	assignment.question = sanitizeHTML(assignment.question)
}

const saveAssignment = () => {
	validateFields()
	if (props.assignmentID == 'new') {
		createAssignment()
	} else {
		updateAssignment()
	}
}

const createAssignment = () => {
	assignments.value.insert.submit(
		{
			...assignment,
			reference_files: referenceFiles.value,
		},
		{
			onSuccess() {
				show.value = false
				toast.success(__('Assignment created successfully'))
			},
		}
	)
}

const updateAssignment = () => {
	assignments.value.setValue.submit(
		{
			...assignment,
			name: props.assignmentID,
			reference_files: referenceFiles.value,
		},
		{
			onSuccess() {
				show.value = false
				toast.success(__('Assignment updated successfully'))
			},
		}
	)
}

const assignmentOptions = computed(() => {
	return [
		{ label: 'PDF', value: 'PDF' },
		{ label: 'Image', value: 'Image' },
		{ label: 'Document', value: 'Document' },
		{ label: 'Text', value: 'Text' },
		{ label: 'URL', value: 'URL' },
	]
})
</script>
