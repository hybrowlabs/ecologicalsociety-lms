<template>
	<div>
		<div v-if="quizzes.length && !showQuiz && readOnly" class="leading-6">
			{{
				__('This video contains {0} {1}:').format(
					quizzes.length,
					quizzes.length == 1 ? 'quiz' : 'quizzes'
				)
			}}

			<div v-for="(quiz, index) in quizzes" class="ps-3 mt-1">
				<span>
					{{ index + 1 }}. <span class="font-semibold"> {{ quiz.quiz }} </span>
				</span>
				{{ __('at {0} minutes').format(formatTimestamp(quiz.time)) }}
			</div>
		</div>
		<div
			v-if="!showQuiz"
			ref="videoContainer"
			class="video-block relative group"
		>
			<video
				@timeupdate="updateTime"
				@ended="videoEnded"
				@click="togglePlay"
				@play="playing = true"
				@pause="playing = false"
				@volumechange="onVolumeChange"
				oncontextmenu="return false"
				class="rounded-md border border-gray-100 cursor-pointer"
				ref="videoRef"
				:src="fileURL"
				:type="type"
			></video>
			<!-- #31: single centre overlay that stays in sync with the player
			     state - shows Play when paused (always) and Pause when playing
			     (on hover); clicking it toggles playback. -->
			<div
				class="absolute inset-0 flex items-center justify-center cursor-pointer"
				:class="{
					'opacity-0 group-hover:opacity-100 transition-opacity': playing,
				}"
				@click="togglePlay"
			>
				<div
					class="rounded-full p-4 ps-4.5"
					style="
						background: radial-gradient(
							circle,
							rgba(0, 0, 0, 0.3) 0%,
							rgba(0, 0, 0, 0.4) 50%
						);
					"
				>
					<Play v-if="!playing" />
					<Pause v-else class="size-6 text-ink-white" />
				</div>
			</div>
			<div
				class="flex items-center gap-x-2 py-2 px-1 text-ink-white bg-gradient-to-b from-transparent to-black/75 absolute bottom-0 start-0 end-0 mx-auto rounded-md"
				:class="{
					'invisible group-hover:visible': playing,
				}"
			>
				<Button variant="ghost" class="hover:bg-transparent">
					<template #icon>
						<Play
							v-if="!playing"
							@click="playVideo"
							class="size-4 text-ink-gray-9"
						/>
						<Pause v-else @click="pauseVideo" class="size-5 text-ink-white" />
					</template>
				</Button>

				<div class="relative flex items-center w-full flex-1">
					<input
						type="range"
						min="0"
						:max="duration"
						step="0.1"
						v-model="currentTime"
						@input="changeCurrentTime"
						class="duration-slider h-1"
					/>
					<!-- QUIZ MARKERS -->
					<div class="absolute top-0 start-0 w-full h-full pointer-events-none">
						<div
							v-for="(quiz, index) in quizzes"
							:key="index"
							:style="getQuizMarkerStyle(quiz.time)"
							class="absolute top-0 h-full w-2 bg-surface-amber-3"
						></div>
					</div>
				</div>

				<span class="text-sm font-medium">
					{{ formatSeconds(currentTime) }} / {{ formatSeconds(duration) }}
				</span>

				<Dropdown :options="dropdownOptions">
					<Button>{{ playbackSpeedLabel }}</Button>
				</Dropdown>

				<!-- #1 / #30: volume slider + smart mute (mute keeps last level and
				     restores it on unmute, preventing accidental permanent mute). -->
				<div class="flex items-center gap-x-1">
					<Button
						variant="ghost"
						@click="toggleMute"
						class="hover:bg-transparent"
					>
						<template #icon>
							<Volume2 v-if="!muted" class="size-5 text-ink-white" />
							<VolumeX v-else class="size-5 text-ink-white" />
						</template>
					</Button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						v-model.number="volume"
						@input="changeVolume"
						class="volume-slider h-1 w-16"
						:aria-label="__('Volume')"
					/>
				</div>
				<Button
					variant="ghost"
					@click="toggleFullscreen"
					class="hover:bg-transparent"
				>
					<template #icon>
						<Maximize class="size-5 text-ink-white" />
					</template>
				</Button>
			</div>
		</div>
		<Quiz
			v-if="showQuiz"
			:quizName="currentQuiz"
			:inVideo="true"
			:backToVideo="resumeVideo"
		/>
		<div v-if="!readOnly" @click="showQuizModal = true">
			<Button>
				{{ __('Add Quiz to Video') }}
			</Button>
		</div>
	</div>
	<QuizInVideo
		v-model="showQuizModal"
		:quizzes="quizzes"
		:saveQuizzes="saveQuizzes"
		:duration="duration"
	/>
	<Dialog
		v-model="showQuizLoader"
		:options="{
			size: 'sm',
		}"
	>
		<template #body>
			<div class="flex flex-col space-y-2 p-5 text-base leading-5">
				<span class="font-semibold">
					{{ __('Time for a Quiz') }}
				</span>
				<span>
					{{
						__(
							'Complete the upcoming quiz to continue watching the video. The quiz will open in {0} {1}.'
						).format(quizLoadTimer, quizLoadTimer === 1 ? 'second' : 'seconds')
					}}
				</span>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { Pause, Maximize, Volume2, VolumeX } from 'lucide-vue-next'
import { Button, Dialog, Dropdown, call } from 'frappe-ui'
import { formatSeconds, formatTimestamp } from '@/utils'
import { useSettings } from '@/stores/settings'
import Play from '@/components/Icons/Play.vue'
import QuizInVideo from '@/components/Modals/QuizInVideo.vue'

const videoRef = ref(null)
const videoContainer = ref(null)
let playing = ref(false)
let currentTime = ref(0)
let duration = ref(0)
let muted = ref(false)
let volume = ref(1)
const previousVolume = ref(1)
const showQuizModal = ref(false)
const showQuiz = ref(false)
const showQuizLoader = ref(false)
const quizLoadTimer = ref(0)
const currentQuiz = ref(null)
const nextQuiz = ref({})
const { settings } = useSettings()

// Speed control states
const playbackSpeed = ref(1)
const playbackSpeedLabel = ref('1x')
const playbackSpeeds = [
	{ label: '0.5x', value: 0.5 },
	{ label: '1x', value: 1 },
	{ label: '1.5x', value: 1.5 },
	{ label: '2x', value: 2 },
]

const props = defineProps({
	file: {
		type: String,
		required: true,
	},
	type: {
		type: String,
		default: 'video/mp4',
	},
	readOnly: {
		type: Boolean,
		default: true,
	},
	quizzes: {
		type: Array,
		default: () => [],
	},
	saveQuizzes: {
		type: Function,
		default: () => {},
	},
})

// #2: resume playback position for the native player. Lesson context is set on
// the window by Lesson.vue since this component is rendered inside EditorJS
// content without props.
const lessonContext = () =>
	(typeof window !== 'undefined' && window.__esLessonContext) || null

const restorePosition = async () => {
	const ctx = lessonContext()
	if (!ctx || !ctx.lesson || !props.readOnly) return
	try {
		const pos = await call(
			'ecological_society.video_progress.get_video_position',
			{ lesson: ctx.lesson, source: props.file }
		)
		if (
			pos &&
			pos > 3 &&
			videoRef.value &&
			(!videoRef.value.duration || pos < videoRef.value.duration - 5)
		) {
			videoRef.value.currentTime = pos
			currentTime.value = pos
			updateNextQuiz()
		}
	} catch (e) {
		/* no saved position */
	}
}

let lastSavedPosition = 0
const savePosition = () => {
	const ctx = lessonContext()
	if (!ctx || !ctx.lesson || !props.readOnly || !videoRef.value) return
	const t = videoRef.value.currentTime || 0
	if (t <= 0) return
	call('ecological_society.video_progress.save_video_position', {
		lesson: ctx.lesson,
		source: props.file,
		position: t,
		course: ctx.course,
	}).catch(() => {})
}

onMounted(() => {
	updateCurrentTime()
	updateNextQuiz()
	if (videoRef.value) {
		videoRef.value.playbackRate = 1
		videoRef.value.addEventListener('loadedmetadata', restorePosition, {
			once: true,
		})
		videoRef.value.addEventListener('timeupdate', () => {
			const t = videoRef.value?.currentTime || 0
			if (t - lastSavedPosition >= 5) {
				lastSavedPosition = t
				savePosition()
			}
		})
		videoRef.value.addEventListener('pause', savePosition)
	}
	window.addEventListener('pagehide', savePosition)
	window.addEventListener('beforeunload', savePosition)
})

onBeforeUnmount(() => {
	savePosition()
	window.removeEventListener('pagehide', savePosition)
	window.removeEventListener('beforeunload', savePosition)
})

const updateCurrentTime = () => {
	setTimeout(() => {
		videoRef.value.onloadedmetadata = () => {
			duration.value = videoRef.value.duration
		}
		videoRef.value.ontimeupdate = () => {
			currentTime.value = videoRef.value?.currentTime || currentTime.value
			if (currentTime.value >= nextQuiz.value.time) {
				videoRef.value.pause()
				playing.value = false
				videoRef.value.onTimeupdate = null
				currentQuiz.value = nextQuiz.value.quiz
				quizLoadTimer.value = 7
			}
		}
	}, 0)
}

watch(quizLoadTimer, () => {
	if (quizLoadTimer.value > 0) {
		showQuizLoader.value = true
		setTimeout(() => {
			quizLoadTimer.value -= 1
		}, 1000)
	} else {
		showQuizLoader.value = false
		showQuiz.value = true
	}
})

const resumeVideo = (restart = false) => {
	showQuiz.value = false
	currentQuiz.value = null
	updateCurrentTime()
	setTimeout(() => {
		videoRef.value.currentTime = restart ? 0 : currentTime.value
		videoRef.value.play()
		playing.value = true
		updateNextQuiz()
	}, 0)
}

const updateNextQuiz = () => {
	if (!props.quizzes.length) return

	props.quizzes.forEach((quiz) => {
		if (typeof quiz.time == 'string' && quiz.time.includes(':')) {
			let time = quiz.time.split(':')
			let timeInSeconds = parseInt(time[0]) * 60 + parseInt(time[1])
			quiz.time = timeInSeconds
		}
	})

	props.quizzes.sort((a, b) => a.time - b.time)

	const nextQuizIndex = props.quizzes.findIndex(
		(quiz) => quiz.time > currentTime.value
	)
	if (nextQuizIndex !== -1) {
		nextQuiz.value = props.quizzes[nextQuizIndex]
	} else {
		nextQuiz.value = {}
	}
}

const fileURL = computed(() => {
	return props.file
})

const playVideo = () => {
	videoRef.value.play()
	playing.value = true
}

const pauseVideo = () => {
	videoRef.value.pause()
	playing.value = false
}

const togglePlay = () => {
	if (playing.value) {
		pauseVideo()
	} else {
		playVideo()
	}
}

const videoEnded = () => {
	playing.value = false
}

const toggleMute = () => {
	if (!videoRef.value) return
	if (videoRef.value.muted || videoRef.value.volume === 0) {
		// Unmute and restore the previous audible level (#30: no accidental
		// permanent mute).
		const restore = previousVolume.value > 0 ? previousVolume.value : 1
		videoRef.value.muted = false
		videoRef.value.volume = restore
		volume.value = restore
	} else {
		previousVolume.value = videoRef.value.volume
		videoRef.value.muted = true
	}
	muted.value = videoRef.value.muted
}

const changeVolume = () => {
	if (!videoRef.value) return
	videoRef.value.volume = volume.value
	// Dragging the slider to a non-zero level implicitly unmutes.
	videoRef.value.muted = volume.value === 0
	if (volume.value > 0) previousVolume.value = volume.value
}

// Keep the UI in sync when volume/mute changes for any reason (#30/#31).
const onVolumeChange = () => {
	if (!videoRef.value) return
	muted.value = videoRef.value.muted || videoRef.value.volume === 0
	volume.value = videoRef.value.muted ? 0 : videoRef.value.volume
}

const changeCurrentTime = () => {
	if (
		settings.data?.prevent_skipping_videos &&
		currentTime.value > videoRef.value.currentTime
	)
		return
	videoRef.value.currentTime = currentTime.value
	updateNextQuiz()
}

const toggleFullscreen = () => {
	if (document.fullscreenElement) {
		document.exitFullscreen()
	} else {
		videoContainer.value.requestFullscreen()
	}
}

const getQuizMarkerStyle = (time) => {
	const percentage = ((time - 5) / Math.ceil(duration.value)) * 100
	return {
		insetInlineStart: `${percentage}%`,
	}
}

const setPlaybackSpeed = (speed, label) => {
	playbackSpeed.value = speed
	playbackSpeedLabel.value = label
	if (videoRef.value) {
		videoRef.value.playbackRate = speed
	}
}

const dropdownOptions = computed(() =>
	playbackSpeeds.map((speed) => ({
		label: speed.label,
		active: playbackSpeed.value === speed.value,
		onClick: () => setPlaybackSpeed(speed.value, speed.label),
	}))
)
</script>

<style scoped>
.video-block {
	width: 100%;
	margin: 0 auto;
}

.video-block video {
	width: 100%;
	height: auto;
}

iframe {
	width: 100%;
	min-height: 500px;
}

.duration-slider {
	-webkit-appearance: none;
	appearance: none;
	border-radius: 10px;
	background-color: theme('colors.gray.600');
	cursor: pointer;
}

.volume-slider {
	-webkit-appearance: none;
	appearance: none;
	border-radius: 10px;
	background-color: theme('colors.gray.400');
	cursor: pointer;
	accent-color: theme('colors.white');
}

.volume-slider::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background-color: theme('colors.white');
	cursor: pointer;
}

.volume-slider::-moz-range-thumb {
	width: 10px;
	height: 10px;
	border: none;
	border-radius: 50%;
	background-color: theme('colors.white');
	cursor: pointer;
}

.duration-slider::-webkit-slider-thumb {
	width: 2px;
	border-radius: 50%;
	-webkit-appearance: none;
	background-color: theme('colors.white');
}

@media screen and (-webkit-min-device-pixel-ratio: 0) {
	input[type='range'] {
		overflow: hidden;
		width: 100%;
		-webkit-appearance: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		cursor: pointer;
		box-shadow: -500px 0 0 500px theme('colors.white');
	}
}
</style>
