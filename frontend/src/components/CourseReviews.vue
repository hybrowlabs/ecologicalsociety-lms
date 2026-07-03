<template>
	<div v-if="reviews.data?.length || membership" class="mt-12">
		<!-- Only show the ratings count when there's at least one review; a bare
		     "0 user ratings" on a course with no reviews looked like an error. -->
		<div
			v-if="reviews.data?.length"
			class="flex items-center justify-between gap-3 mb-8"
		>
			<div class="flex items-center gap-2">
				<span class="text-lg text-ink-gray-7">
					{{ reviews.data.length }}
					{{ reviews.data.length === 1 ? __('user rating') : __('user ratings') }}
				</span>
			</div>
		</div>

		<div
			v-if="visibleReviews.length"
			class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8"
		>
			<article
				v-for="review in visibleReviews"
				:key="review.name"
				class="flex gap-4"
			>
				<router-link
					:to="{
						name: 'Profile',
						params: { username: review.owner_details.username },
					}"
					class="shrink-0"
				>
					<UserAvatar :user="review.owner_details" size="2xl" />
				</router-link>
				<div class="min-w-0 flex-1">
					<div class="flex items-center justify-between gap-3">
						<router-link
							:to="{
								name: 'Profile',
								params: { username: review.owner_details.username },
							}"
							class="text-lg font-medium text-ink-gray-9 truncate"
						>
							{{ review.owner_details.full_name }}
						</router-link>
						<div class="flex items-center gap-x-3 shrink-0">
							<span class="text-ink-gray-5">
								{{ formatReviewDate(review.creation) }}
							</span>
							<!-- Staff / course instructors can remove a review. -->
							<button
								v-if="canModerate"
								type="button"
								:title="__('Delete review')"
								class="text-ink-gray-5 hover:text-ink-red-3 transition-colors"
								@click="confirmDeleteReview(review)"
							>
								<Trash2 class="size-4 stroke-1.5" />
							</button>
						</div>
					</div>
					<div class="flex gap-1 mt-2">
						<Star
							v-for="i in 5"
							:key="i"
							class="size-4 text-transparent"
							:class="
								i <= Math.ceil(review.rating)
									? 'fill-yellow-500'
									: 'fill-surface-gray-3'
							"
						/>
					</div>
					<p
						v-if="review.review"
						class="text-ink-gray-7 mt-3 leading-6"
						:class="{ 'line-clamp-5': !expanded[review.name] }"
					>
						{{ review.review }}
					</p>
					<button
						v-if="review.review && isClampable(review.review)"
						class="font-medium text-ink-gray-9 hover:underline mt-1"
						@click="toggleExpand(review.name)"
					>
						{{ expanded[review.name] ? __('See less') : __('See more') }}
					</button>
				</div>
			</article>
		</div>

		<div v-if="canShowMore" class="mt-8">
			<Button class="w-full" size="md" @click="showAll = true">
				{{ __('View all reviews') }}
			</Button>
		</div>
	</div>
	<ReviewModal
		v-model="showReviewModal"
		v-model:reloadReviews="reviews"
		v-model:hasReviewed="hasReviewed"
		:courseName="courseName"
	/>
</template>

<script setup lang="ts">
import { Star, Trash2 } from 'lucide-vue-next'
import { createResource, Button, call, toast } from 'frappe-ui'
import {
	computed,
	getCurrentInstance,
	inject,
	reactive,
	ref,
	watch,
} from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { formatRating } from '@/utils'
import ReviewModal from '@/components/Modals/ReviewModal.vue'
import type dayjsType from 'dayjs'
import type {
	CourseReviewInfo,
	Membership,
	Resource,
	SessionUser,
} from '@/types/api'

const user = inject<SessionUser>('$user')!
const dayjs = inject<typeof dayjsType>('$dayjs')!

type DialogFn = (opts: {
	title: string
	message: string
	actions: {
		label: string
		theme?: string
		variant?: string
		onClick: (close: () => void) => void
	}[]
}) => void
const { $dialog } = getCurrentInstance()!.appContext.config
	.globalProperties as unknown as { $dialog: DialogFn }

// Only moderators / admins get the delete affordance in the UI; the backend
// re-checks (staff or the course's own instructors) before deleting.
const canModerate = computed<boolean>(() => Boolean(user.data?.is_moderator))

const PREVIEW_LIMIT = 4
const CLAMP_THRESHOLD = 220

const props = defineProps<{
	courseName: string
	avg_rating?: string
	membership?: Membership | null
}>()

const hasReviewed = createResource({
	url: 'frappe.client.get_count',
	cache: ['eligible_to_review', props.courseName, props.membership?.member],
	params: {
		doctype: 'LMS Course Review',
		filters: {
			course: props.courseName,
			owner: props.membership?.member,
		},
	},
	auto: user.data?.name ? true : false,
}) as Resource<number | null>

const reviews = createResource({
	url: 'lms.lms.utils.get_reviews',
	cache: ['course_reviews', props.courseName],
	makeParams() {
		return { course: props.courseName }
	},
	auto: true,
}) as Resource<CourseReviewInfo[] | null>

watch(
	() => props.courseName,
	() => reviews.reload()
)

const showReviewModal = ref(false)
const showAll = ref(false)
const expanded = reactive<Record<string, boolean>>({})

const visibleReviews = computed(() => {
	// Drop reviews whose author record is missing — owner_details can come
	// back null for guest-authored or deleted-user reviews, and the row
	// markup dereferences it for the avatar / profile link.
	const all = (reviews.data || []).filter((r) => r.owner_details)
	return showAll.value ? all : all.slice(0, PREVIEW_LIMIT)
})

const canShowMore = computed(
	() => !showAll.value && (reviews.data?.length || 0) > PREVIEW_LIMIT
)

function isClampable(text: string) {
	return text.length > CLAMP_THRESHOLD
}

function toggleExpand(name: string) {
	expanded[name] = !expanded[name]
}

function formatReviewDate(date: string) {
	if (!date) return ''
	const d = dayjs(date)
	const months = dayjs().diff(d, 'month')
	if (months >= 1) {
		return `${months} ${months === 1 ? __('month ago') : __('months ago')}`
	}
	const days = dayjs().diff(d, 'day')
	if (days >= 1) {
		return `${days} ${days === 1 ? __('day ago') : __('days ago')}`
	}
	return __('Today')
}

function openReviewModal() {
	showReviewModal.value = true
}

function confirmDeleteReview(review: CourseReviewInfo) {
	const author = review.owner_details?.full_name || __('this user')
	$dialog({
		title: __('Delete this review?'),
		message: __(
			"This permanently removes {0}'s rating and review from the course. This can't be undone."
		).format(author),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					call('ecological_society.overrides.delete_course_review', {
						review: review.name,
					})
						.then(() => {
							toast.success(__('Review deleted'))
							reviews.reload()
							hasReviewed.reload()
						})
						.catch((e: { messages?: string[] }) => {
							toast.error(e?.messages?.[0] || __('Could not delete review'))
						})
					close()
				},
			},
		],
	})
}
</script>
