<template>
	<div v-if="youtube">
		<div
			class="video-player rounded-md overflow-hidden border border-gray-100"
			data-plyr-provider="youtube"
			:data-plyr-embed-id="extractYouTubeId(youtube) || youtube.split('/').pop()"
			@contextmenu.prevent
		></div>
	</div>
	<div v-for="block in content?.split('\n\n')">
		<div v-if="block.includes('{{ YouTubeVideo')">
			<div
				class="video-player rounded-md overflow-hidden border border-gray-100"
				data-plyr-provider="youtube"
				:data-plyr-embed-id="getId(block)"
				@contextmenu.prevent
			></div>
		</div>
		<div v-else-if="block.includes('{{ Quiz')">
			<Quiz :quiz="getId(block)" />
		</div>
		<div v-else-if="block.includes('{{ Video')">
			<video
				controls
				width="100%"
				controlsList="nodownload"
				oncontextmenu="return false;"
			>
				<source :src="getId(block)" type="video/mp4" />
			</video>
		</div>
		<div v-else-if="block.includes('{{ PDF')">
			<PDFViewer :src="getId(block)" />
		</div>
		<div v-else-if="block.includes('{{ Audio')">
			<audio width="100%" controls controlsList="nodownload">
				<source :src="getId(block)" type="audio/mp3" />
			</audio>
		</div>
		<div v-else-if="block.includes('{{ Embed')">
			<iframe
				width="100%"
				height="400"
				:src="getId(block)"
				frameborder="0"
				allowfullscreen
			>
			</iframe>
		</div>
		<div v-else v-html="renderSafe(block)"></div>
	</div>
	<div v-if="quizId">
		<Quiz :quiz="quizId" />
	</div>
</template>
<script setup>
import Quiz from '@/components/QuizBlock.vue'
import PDFViewer from '@/components/PDFViewer.vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { useScreenSize } from '@/utils/composables'

const screenSize = useScreenSize()

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
})

// Open all links in a new tab
const defaultLinkOpen =
	markdown.renderer.rules.link_open ||
	((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	tokens[idx].attrSet('target', '_blank')
	tokens[idx].attrSet('rel', 'noopener noreferrer')
	return defaultLinkOpen(tokens, idx, options, env, self)
}

const extractYouTubeId = (url) => {
	try {
		var regExp =
			/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
		var match = url.match(regExp)
		return match && match[7].length == 11 ? match[7] : false
	} catch (error) {
		return false
	}
}

const cleanIframeHTML = (html) => {
	let decoded = html
	if (html.includes('&lt;') || html.includes('&gt;')) {
		const txt = document.createElement('textarea')
		txt.innerHTML = html
		decoded = txt.value
	}
	// Only unwrap anchors that WRAP an embed/iframe (some paste sources wrap the
	// player in a link). Do NOT strip ordinary text hyperlinks - those are valid
	// "further reading / viewing" links and must stay clickable.
	decoded = decoded.replace(
		/<a\b[^>]*>\s*(<iframe[\s\S]*?<\/iframe>)\s*<\/a>/gi,
		'$1'
	)

	if (decoded.includes('youtube.com/embed/')) {
		const match = decoded.match(/src="([^"]+youtube\.com\/embed\/[^"]+)"/i)
		if (match) {
			const videoID = extractYouTubeId(match[1])
			if (videoID) {
				return `<div class="video-player rounded-md overflow-hidden border border-gray-100" data-plyr-provider="youtube" data-plyr-embed-id="${videoID}" oncontextmenu="return false"></div>`
			}
		}
	}
	return decoded
}

const renderSafe = (block) => {
	const cleanedBlock = cleanIframeHTML(block)
	return DOMPurify.sanitize(markdown.render(cleanedBlock), {
		ADD_TAGS: ['iframe', 'div'],
		ADD_ATTR: [
			'class',
			'allow',
			'allowfullscreen',
			'frameborder',
			'scrolling',
			'src',
			'title',
			'referrerpolicy',
			'width',
			'height',
			'data-plyr-provider',
			'data-plyr-embed-id',
			'oncontextmenu',
			'target',
			'rel',
		],
	})
}

const props = defineProps({
	content: {
		type: String,
		required: true,
	},
	youtube: {
		type: String,
		required: false,
	},
	quizId: {
		type: String,
		required: false,
	},
})

const getYouTubeVideoSource = (block) => {
	if (block.includes('{{')) {
		block = getId(block)
	}
	return `https://www.youtube.com/embed/${block}`
}

const getId = (block) => {
	return block.match(/\(["']([^"']+?)["']\)/)[1]
}
</script>
