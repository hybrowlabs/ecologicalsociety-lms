<template>
	<Dialog
		v-model="show"
		:options="{
			title: chapterDetail ? __('Edit Session') : __('Add Session'),
			size: 'lg',
			actions: [
				{
					label: chapterDetail ? __('Edit') : __('Create'),
					variant: 'solid',
					onClick: ({ close }) =>
						chapterDetail ? editChapter(close) : addChapter(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="space-y-4 text-base">
				<FormControl
					label="Title"
					v-model="chapter.title"
					:required="true"
					autocomplete="off"
				/>
				<!-- On create the status is fixed (the server always starts a new
				     session as a draft), so we explain it instead of offering a
				     control that only has one meaningful value. -->
				<FormControl
					v-if="chapterDetail"
					type="select"
					:label="__('Status')"
					:options="statusOptions"
					v-model="chapter.status"
					:description="
						chapter.status === 'Draft'
							? __('Hidden from students until you publish it.')
							: __('Visible to enrolled students.')
					"
				/>
				<div v-else class="text-p-sm text-ink-gray-5">
					{{
						__(
							'New sessions are saved as drafts. Students will not see this session until you publish it from the outline.'
						)
					}}
				</div>
				<div>
					<label class="block mb-1.5 text-xs text-ink-gray-5">
						{{ __('Session Instructors') }}
					</label>
					<Autocomplete
						:modelValue="chapter.instructors"
						:options="instructorOptions"
						:placeholder="__('Search users...')"
						variant="outline"
						multiple
						@update:modelValue="onInstructorSelect"
					/>
					<p class="mt-1.5 text-p-sm text-ink-gray-5">
						{{ __('Pick everyone who teaches this session.') }}
					</p>
				</div>
				<Switch
					size="sm"
					:label="__('SCORM Package')"
					:description="
						__(
							'Enable this only if you want to upload a SCORM package as a chapter.'
						)
					"
					v-model="chapter.is_scorm_package"
				/>
				<div v-if="chapter.is_scorm_package">
					<FileUploader
						v-if="!chapter.scorm_package"
						:fileTypes="['.zip']"
						:validateFile="validateFile"
						@success="(file) => (chapter.scorm_package = file)"
					>
						<template v-slot="{ file, progress, uploading, openFileSelector }">
							<div class="mb-4">
								<Button @click="openFileSelector" :loading="uploading">
									{{
										uploading ? `Uploading ${progress}%` : 'Upload an ZIP file'
									}}
								</Button>
							</div>
						</template>
					</FileUploader>
					<div v-else class="">
						<div class="flex items-center">
							<div class="border rounded-md p-2 me-2">
								<FileText class="h-5 w-5 stroke-1.5 text-ink-gray-7" />
							</div>
							<div class="flex flex-col">
								<span class="text-ink-gray-9">
									{{ chapter.scorm_package.file_name }}
								</span>
								<span class="text-sm text-ink-gray-4 mt-1">
									{{ getFileSize(chapter.scorm_package.file_size) }}
								</span>
							</div>
							<X
								@click="() => (chapter.scorm_package = null)"
								class="bg-surface-gray-3 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ms-4"
							/>
						</div>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Autocomplete,
	Button,
	createResource,
	Dialog,
	FileUploader,
	FormControl,
	toast,
} from 'frappe-ui'
import Switch from '@/components/Controls/Switch.vue'
import { reactive, watch, inject, computed } from 'vue'
import { getFileSize } from '@/utils/'
import { FileText, X } from 'lucide-vue-next'
import { useTelemetry } from 'frappe-ui/frappe'
import { useOnboarding } from '@/utils/onboarding'
import { reloadCourseOutlines } from '@/utils/courseOutline'
import type {
	ChapterDetailInput,
	ChapterStatus,
	Resource,
	SessionUser,
} from '@/types/api'

type ScormPackage = { file_name: string; file_size: number } | null

interface ChapterForm {
	title: string
	is_scorm_package: 0 | 1
	scorm_package: ScormPackage
	// Autocomplete in `multiple` mode works in option objects, so the form
	// holds them as such and only the user ids are sent on save.
	instructors: InstructorOption[]
	status: ChapterStatus
}

const statusOptions: { label: string; value: ChapterStatus }[] = [
	{ label: __('Draft'), value: 'Draft' },
	{ label: __('Published'), value: 'Published' },
]

const show = defineModel<boolean>()
const outline = defineModel<Resource<unknown> | undefined>('outline')
const user = inject<SessionUser>('$user')!
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')

const props = defineProps<{
	course: string
	chapterDetail?: ChapterDetailInput | null
}>()

const chapter = reactive<ChapterForm>({
	title: '',
	is_scorm_package: 0,
	scorm_package: null,
	instructors: [],
	status: 'Draft',
})

interface InstructorOption {
	value: string
	label: string
	description?: string
}

const instructorSearch = createResource({
	url: 'lms.lms.api.get_instructor_options',
	auto: true,
}) as Resource<InstructorOption[] | null>

const instructorOptions = computed<InstructorOption[]>(() => {
	const list = (instructorSearch.data || []) as InstructorOption[]
	// Anyone already assigned who isn't in the fetched list (their role changed,
	// or the search is paginated past them) is prepended, so editing a session
	// never silently drops an existing instructor.
	const missing = chapter.instructors.filter(
		(selected) => !list.some((o) => o.value === selected.value)
	)
	return missing.length ? [...missing, ...list] : list
})

// Autocomplete emits the selected option objects; keep them as-is for the
// control and unwrap to user ids only when saving.
function onInstructorSelect(options: InstructorOption[] | null) {
	chapter.instructors = options || []
}

const chapterResource = createResource({
	url: 'lms.lms.api.upsert_chapter',
	makeParams() {
		return {
			title: chapter.title,
			course: props.course,
			is_scorm_package: chapter.is_scorm_package,
			scorm_package: chapter.scorm_package,
			name: props.chapterDetail?.name,
			instructors: chapter.instructors.map((option) => option.value),
			// Creating: leave it to the server so a new session is always a
			// draft. Editing: send what the form shows so a status change sticks.
			status: props.chapterDetail ? chapter.status : null,
		}
	},
})

const errorMessage = (err: { messages?: string[] } | string): string =>
	typeof err === 'string' ? err : err.messages?.[0] ?? 'Error'

const addChapter = async (close: () => void) => {
	chapterResource.submit(
		{},
		{
			validate() {
				return validateChapter()
			},
			onSuccess: () => {
				try {
					if (user.data?.is_system_manager)
						updateOnboardingStep('create_first_chapter')
				} catch (e) {
					console.warn('Failed to update onboarding step:', e)
				}

				capture('chapter_created')
				cleanChapter()
				reloadCourseOutlines(props.course)
				outline.value?.reload()
				toast.success(__('Chapter added successfully'))
				close()
			},
			onError(err: { messages?: string[] } | string) {
				toast.error(errorMessage(err))
			},
		}
	)
}

const validateChapter = (): string | undefined => {
	if (!chapter.title) {
		return __('Title is required')
	}
	if (chapter.is_scorm_package && !chapter.scorm_package) {
		return __('Please upload a SCORM package')
	}
	return undefined
}

const cleanChapter = () => {
	chapter.title = ''
	chapter.is_scorm_package = 0
	chapter.scorm_package = null
	chapter.instructors = []
	chapter.status = 'Draft'
}

const editChapter = (close: () => void) => {
	chapterResource.submit(
		{},
		{
			validate() {
				if (!chapter.title) {
					return 'Title is required'
				}
			},
			onSuccess() {
				reloadCourseOutlines(props.course)
				outline.value?.reload()
				toast.success(__('Chapter updated successfully'))
				close()
			},
			onError(err: { messages?: string[] } | string) {
				toast.error(errorMessage(err))
			},
		}
	)
}

watch(
	() => props.chapterDetail,
	(newChapter) => {
		chapter.title = newChapter?.title ?? ''
		chapter.is_scorm_package = (newChapter?.is_scorm_package ?? 0) as 0 | 1
		chapter.scorm_package = (newChapter?.scorm_package ?? null) as ScormPackage
		chapter.instructors = (newChapter?.instructors ?? []).map((i) => ({
			value: i.name,
			label: i.full_name || i.name,
			description: i.name,
		}))
		// A chapter created before this feature has no status and is live.
		chapter.status = newChapter?.status ?? 'Published'
	}
)

const validateFile = (file: File): string | undefined => {
	const extension = file.name.split('.').pop()?.toLowerCase()
	if (extension !== 'zip') {
		return __('Only zip files are allowed')
	}
	return undefined
}
</script>
