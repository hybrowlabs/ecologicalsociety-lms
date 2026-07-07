import { call, toast } from 'frappe-ui'
import { useTimeAgo } from '@vueuse/core'
import colorsJSON from '@/utils/frappe-ui-colors.json'
import { Quiz } from '@/utils/quiz'
import { Program } from '@/utils/program'
import { Assignment } from '@/utils/assignment'
import { Upload } from '@/utils/upload'
import { Markdown } from '@/utils/markdownParser'
import { useSettings } from '@/stores/settings'
import { usersStore } from '@/stores/user'
import Header from '@editorjs/header'
import Paragraph from '@editorjs/paragraph'
import { CodeBox } from '@/utils/code'
import NestedList from '@editorjs/nested-list'
import InlineCode from '@editorjs/inline-code'
import dayjs from '@/utils/dayjs'
import Embed from '@editorjs/embed'
import SimpleImage from '@editorjs/simple-image'
import Table from '@editorjs/table'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import DOMPurify from 'dompurify'

const readOnlyMode = window.read_only_mode

export function timeAgo(date) {
	return useTimeAgo(date).value
}

export function formatTime(timeString) {
	if (!timeString) return ''
	const [hour, minute] = timeString.split(':').map(Number)
	const dummyDate = new Date(0, 0, 0, hour, minute)
	const formattedTime = new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: 'numeric',
		hour12: true,
	}).format(dummyDate)
	return formattedTime
}

export const formatSeconds = (time) => {
	const minutes = Math.floor(time / 60)
	const seconds = Math.floor(time % 60)
	return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

export function formatNumber(number) {
	return number.toLocaleString('en-IN', {
		maximumFractionDigits: 0,
	})
}

export function formatNumberIntoCurrency(number, currency) {
	if (number) {
		return number.toLocaleString('en-IN', {
			maximumFractionDigits: 0,
			style: 'currency',
			currency: currency,
		})
	}
	return ''
}

// create a function that formats numbers in thousands to k

export function formatAmount(amount) {
	if (amount > 999) {
		return (amount / 1000).toFixed(1) + 'k'
	}
	return amount
}

export function formatRating(value) {
	const n = Number(value)
	if (!isFinite(n)) return ''
	return (Math.round(n * 10) / 10).toString()
}

export function convertToTitleCase(str) {
	if (!str) {
		return ''
	}

	return str
		.toLowerCase()
		.split(' ')
		.map(function (word) {
			return word.charAt(0).toUpperCase().concat(word.substr(1))
		})
		.join(' ')
}
export function getFileSize(file_size) {
	let value = parseInt(file_size)
	if (value > 1048576) {
		return (value / 1048576).toFixed(2) + 'M'
	} else if (value > 1024) {
		return (value / 1024).toFixed(2) + 'K'
	}
	return value
}

export function getImgDimensions(imgSrc) {
	return new Promise((resolve) => {
		let img = new Image()
		img.onload = function () {
			let { width, height } = img
			resolve({ width, height, ratio: width / height })
		}
		img.src = imgSrc
	})
}

export function htmlToText(html) {
	const div = document.createElement('div')
	div.innerHTML = html
	return div.textContent || div.innerText || ''
}

// Plain video URLs (e.g. https://www.youtube.com/watch?v=...) must NOT be
// auto-embedded on paste - they should stay as plain, clickable links for
// "further viewing" material. Videos are embedded only via an explicit <iframe>
// tag (converted to an embed block by the ecological_society content
// normalizer). Returning `false` from pasteConfig is EditorJS's supported way
// to disable a tool's paste substitution; render() still works for existing /
// iframe-normalized embed blocks because prepare() still populates the services.
class LinkFirstEmbed extends Embed {
	static get pasteConfig() {
		return false
	}
}

export function getEditorTools() {
	return {
		header: {
			class: Header,
			config: {
				placeholder: 'Header',
			},
		},
		list: {
			class: NestedList,
			inlineToolbar: true,
			config: {
				defaultStyle: 'ordered',
			},
		},
		upload: Upload,
		table: {
			class: Table,
			inlineToolbar: true,
		},
		quiz: Quiz,
		assignment: Assignment,
		program: Program,
		markdown: {
			class: Markdown,
			inlineToolbar: true,
		},
		image: SimpleImage,
		paragraph: {
			class: Paragraph,
			inlineToolbar: true,
			config: {
				preserveBlank: true,
			},
		},
		codeBox: {
			class: CodeBox,
			config: {
				useDefaultTheme: 'dark',
			},
		},
		inlineCode: {
			class: InlineCode,
			shortcut: 'CMD+SHIFT+M',
		},
		embed: {
			class: LinkFirstEmbed,
			inlineToolbar: false,
			config: {
				services: {
					youtube: {
						regex: /^(?:https?:\/\/)?(?:www\.)?(?:(?:youtu\.be\/)|(?:youtube\.com)\/(?:v\/|u\/\w\/|embed\/|watch))(?:(?:\?v=)?([^#&?=]*))?((?:[?&]\w*=\w*)*)$/,
						embedUrl: '<%= remote_id %>',
						html: `<div class="video-player rounded-md overflow-hidden border border-gray-100" data-plyr-provider="youtube" data-plyr-embed-id="<%= remote_id %>" oncontextmenu="return false"></div>`,
						id: ([id]) => id,
					},
					vimeo: {
						regex: /^(?:http[s]?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?(?:\?[^\s]*)?$/,
						embedUrl: '<%= remote_id %>',
						html: `<div class="video-player rounded-md overflow-hidden border border-gray-100" data-plyr-provider="vimeo" data-plyr-embed-id="<%= remote_id %>" oncontextmenu="return false"></div>`,
						id: ([id, hash]) => (hash ? `${id}?h=${hash}` : id),
					},
					cloudflareStream: {
						regex: /^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\/([a-f0-9]{32})\/watch$/,
						embedUrl:
							'https://iframe.videodelivery.net/<%= remote_id %>',
						html: `<iframe style="width:100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						};" frameborder="0" allowfullscreen></iframe>`,
					},
					bunnyStream: {
						regex: /^https:\/\/(?:iframe\.mediadelivery\.net|video\.bunnycdn\.com|player\.mediadelivery\.net)\/play\/([a-zA-Z0-9]+\/[a-zA-Z0-9-]+)$/,
						embedUrl:
							'https://player.mediadelivery.net/embed/<%= remote_id %>',
						html: `<iframe style="width:100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						};" frameborder="0" allowfullscreen></iframe>`,
					},
					codepen: true,
					aparat: {
						regex: /^(?:http[s]?:\/\/)?(?:www.)?aparat\.com\/v\/([^\/\?\&]+)\/?$/,
						embedUrl:
							'https://www.aparat.com/video/video/embed/videohash/<%= remote_id %>/vt/frame',
						html: `<iframe style="margin: 0 auto; width: 100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						};" frameborder="0" scrolling="no" allowtransparency="true"></iframe>`,
					},
					github: true,
					slides: {
						regex: /^https:\/\/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]+)\/pub$/,
						embedUrl:
							'https://docs.google.com/presentation/d/<%= remote_id %>/embed',
						html: `<iframe style='width: 100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						}; border: 1px solid #D3D3D3; border-radius: 12px; margin: 1rem 0' frameborder='0' allowfullscreen='true'></iframe>`,
					},
					drive: {
						regex: /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view(\?.+)?$/,
						embedUrl:
							'https://drive.google.com/file/d/<%= remote_id %>/preview',
						html: `<iframe style='width: 100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						}; border: 1px solid #D3D3D3; border-radius: 12px;' frameborder='0' allowfullscreen='true'></iframe>`,
					},
					docsPublic: {
						regex: /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)\/edit(\?.+)?$/,
						embedUrl:
							'https://docs.google.com/document/d/<%= remote_id %>/preview',
						html: "<iframe style='width: 100%; height: 40rem; border: 1px solid #D3D3D3; border-radius: 12px;' frameborder='0' allowfullscreen='true'></iframe>",
					},
					sheetsPublic: {
						regex: /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/edit(\?.+)?$/,
						embedUrl:
							'https://docs.google.com/spreadsheets/d/<%= remote_id %>/preview',
						html: "<iframe style='width: 100%; height: 40rem; border: 1px solid #D3D3D3; border-radius: 12px;' frameborder='0' allowfullscreen='true'></iframe>",
					},
					slidesPublic: {
						regex: /^https:\/\/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]+)\/edit(\?.+)?$/,
						embedUrl:
							'https://docs.google.com/presentation/d/<%= remote_id %>/embed',
						html: "<iframe style='width: 100%; height: 30rem; border: 1px solid #D3D3D3; border-radius: 12px; margin: 1rem 0;' frameborder='0' allowfullscreen='true'></iframe>",
					},
					codesandbox: {
						regex: /^https:\/\/codesandbox\.io\/(?:(?:p\/(?:sandbox|devbox)\/)|(?:embed\/)|(?:s\/))?([A-Za-z0-9_-]+)(?:[\/\?].*)?$/,
						embedUrl:
							'https://codesandbox.io/embed/<%= remote_id %>?view=editor+%2B+preview&module=%2Findex.html',
						html: "<iframe style='width: 100%; height: 500px; border: 0; border-radius: 4px; overflow: hidden;' sandbox='allow-modals allow-forms allow-popups allow-scripts allow-same-origin' frameborder='0' allowfullscreen='true'></iframe>",
					},
				},
			},
		},
	}
}

export function getTimezones() {
	return [
		'Pacific/Midway',
		'Pacific/Pago_Pago',
		'Pacific/Honolulu',
		'America/Anchorage',
		'America/Vancouver',
		'America/Los_Angeles',
		'America/Tijuana',
		'America/Edmonton',
		'America/Denver',
		'America/Phoenix',
		'America/Mazatlan',
		'America/Winnipeg',
		'America/Regina',
		'America/Chicago',
		'America/Mexico_City',
		'America/Guatemala',
		'America/El_Salvador',
		'America/Managua',
		'America/Costa_Rica',
		'America/Montreal',
		'America/New_York',
		'America/Indianapolis',
		'America/Panama',
		'America/Bogota',
		'America/Lima',
		'America/Halifax',
		'America/Puerto_Rico',
		'America/Caracas',
		'America/Santiago',
		'America/St_Johns',
		'America/Montevideo',
		'America/Araguaina',
		'America/Argentina/Buenos_Aires',
		'America/Godthab',
		'America/Sao_Paulo',
		'Atlantic/Azores',
		'Canada/Atlantic',
		'Atlantic/Cape_Verde',
		'UTC',
		'Etc/Greenwich',
		'Europe/Belgrade',
		'CET',
		'Atlantic/Reykjavik',
		'Europe/Dublin',
		'Europe/London',
		'Europe/Lisbon',
		'Africa/Casablanca',
		'Africa/Nouakchott',
		'Europe/Oslo',
		'Europe/Copenhagen',
		'Europe/Brussels',
		'Europe/Berlin',
		'Europe/Helsinki',
		'Europe/Amsterdam',
		'Europe/Rome',
		'Europe/Stockholm',
		'Europe/Vienna',
		'Europe/Luxembourg',
		'Europe/Paris',
		'Europe/Zurich',
		'Europe/Madrid',
		'Africa/Bangui',
		'Africa/Algiers',
		'Africa/Tunis',
		'Africa/Harare',
		'Africa/Nairobi',
		'Europe/Warsaw',
		'Europe/Prague',
		'Europe/Budapest',
		'Europe/Sofia',
		'Europe/Istanbul',
		'Europe/Athens',
		'Europe/Bucharest',
		'Asia/Nicosia',
		'Asia/Beirut',
		'Asia/Damascus',
		'Asia/Jerusalem',
		'Asia/Amman',
		'Africa/Tripoli',
		'Africa/Cairo',
		'Africa/Johannesburg',
		'Europe/Moscow',
		'Asia/Baghdad',
		'Asia/Kuwait',
		'Asia/Riyadh',
		'Asia/Bahrain',
		'Asia/Qatar',
		'Asia/Aden',
		'Asia/Tehran',
		'Africa/Khartoum',
		'Africa/Djibouti',
		'Africa/Mogadishu',
		'Asia/Dubai',
		'Asia/Muscat',
		'Asia/Baku',
		'Asia/Kabul',
		'Asia/Yekaterinburg',
		'Asia/Tashkent',
		'Asia/Calcutta',
		'Asia/Kathmandu',
		'Asia/Novosibirsk',
		'Asia/Almaty',
		'Asia/Dacca',
		'Asia/Krasnoyarsk',
		'Asia/Dhaka',
		'Asia/Bangkok',
		'Asia/Saigon',
		'Asia/Jakarta',
		'Asia/Irkutsk',
		'Asia/Shanghai',
		'Asia/Hong_Kong',
		'Asia/Taipei',
		'Asia/Kuala_Lumpur',
		'Asia/Singapore',
		'Australia/Perth',
		'Asia/Yakutsk',
		'Asia/Seoul',
		'Asia/Tokyo',
		'Australia/Darwin',
		'Australia/Adelaide',
		'Asia/Vladivostok',
		'Pacific/Port_Moresby',
		'Australia/Brisbane',
		'Australia/Sydney',
		'Australia/Hobart',
		'Asia/Magadan',
		'SST',
		'Pacific/Noumea',
		'Asia/Kamchatka',
		'Pacific/Fiji',
		'Pacific/Auckland',
		'Asia/Kolkata',
		'Europe/Kiev',
		'America/Tegucigalpa',
		'Pacific/Apia',
	]
}

export function getUserTimezone() {
	try {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const supportedTimezones = getTimezones()

		if (supportedTimezones.includes(timezone)) {
			return timezone // e.g., 'Asia/Calcutta', 'America/New_York', etc.
		} else {
			throw Error('unsupported timezone')
		}
	} catch (error) {
		console.error('Error getting timezone:', error)
		return null
	}
}

export function getSidebarLinks(forMobile = false) {
	let links = getSidebarItems(forMobile)

	links.forEach((link) => {
		link.items = link.items.filter((item) => {
			return item.condition ? item.condition() : true
		})
	})

	links = links.filter((link) => {
		return link.items.length > 0
	})

	return links
}

const getSidebarItems = (forMobile = false) => {
	const { userResource } = usersStore()
	const { settings } = useSettings()

	return [
		{
			label: 'General',
			hideLabel: true,
			items: [
				{
					label: 'Home',
					icon: 'Home',
					to: 'Home',
					condition: () => {
						return userResource?.data
					},
				},
				{
					label: 'Search',
					icon: 'Search',
					to: 'Search',
					condition: () => {
						return !forMobile && userResource?.data
					},
				},
				{
					label: 'Notifications',
					icon: 'Bell',
					to: 'Notifications',
					condition: () => {
						return !forMobile && userResource?.data
					},
				},
			],
		},
		{
			label: 'Learning',
			hideLabel: true,
			items: [
				{
					label: 'Courses',
					icon: 'BookOpen',
					to: 'Courses',
					activeFor: ['Courses', 'CourseDetail', 'Lesson'],
				},
				{
					label: 'Programs',
					icon: 'Route',
					to: 'Programs',
					activeFor: ['Programs', 'ProgramDetail'],
					await: true,
					condition: () => {
						return checkIfCanAddProgram(forMobile)
					},
				},
				{
					label: 'Batches',
					icon: 'Users',
					to: 'Batches',
					activeFor: ['Batches', 'BatchDetail', 'Batch', 'BatchForm'],
				},
				{
					label: 'Certifications',
					icon: 'GraduationCap',
					to: 'CertifiedParticipants',
					activeFor: ['CertifiedParticipants'],
					condition: () => {
						return userResource?.data
					},
				},
				{
					label: 'Jobs',
					icon: 'Briefcase',
					to: 'Jobs',
					activeFor: ['Jobs', 'JobDetail'],
				},
				{
					label: 'Statistics',
					icon: 'TrendingUp',
					to: 'Statistics',
					activeFor: ['Statistics'],
					condition: () => {
						return isAdmin()
					},
				},
				{
					label: 'Contact Us',
					icon: settings.data?.contact_us_url ? 'Headset' : 'Mail',
					to: settings.data?.contact_us_url
						? settings.data?.contact_us_url
						: settings.data?.contact_us_email,
					condition: () => {
						return (
							(!forMobile &&
								settings?.data?.contact_us_email &&
								userResource?.data) ||
							settings?.data?.contact_us_url
						)
					},
				},
			],
		},
		{
			label: 'Assessments',
			hideLabel: true,
			items: [
				{
					label: 'Quizzes',
					icon: 'CircleHelp',
					to: 'Quizzes',
					condition: () => {
						return !forMobile && isAdmin()
					},
					activeFor: [
						'Quizzes',
						'QuizForm',
						'QuizPage',
						'QuizSubmissionList',
						'QuizSubmission',
					],
				},
				{
					label: 'Assignments',
					icon: 'Pencil',
					to: 'Assignments',
					condition: () => {
						return !forMobile && isAdmin()
					},
					activeFor: [
						'Assignments',
						'AssignmentSubmissionList',
						'AssignmentSubmission',
					],
				},
				{
					label: 'Programming Exercises',
					icon: 'Code',
					to: 'ProgrammingExercises',
					condition: () => {
						return !forMobile && isAdmin()
					},
					activeFor: [
						'ProgrammingExercises',
						'ProgrammingExerciseSubmissions',
						'ProgrammingExerciseSubmission',
					],
				},
			],
		},
	]
}

const isAdmin = () => {
	const { userResource } = usersStore()
	return (
		userResource?.data?.is_instructor ||
		userResource?.data?.is_moderator ||
		userResource.data?.is_evaluator
	)
}

const checkIfCanAddProgram = (forMobile = false) => {
	const { userResource } = usersStore()
	const { programs } = useSettings()
	if (!userResource.data) return false
	if (forMobile) return false
	if (userResource?.data?.is_moderator || userResource?.data?.is_instructor) {
		return true
	}
	return (
		programs.data?.enrolled.length > 0 ||
		programs.data?.published.length > 0
	)
}

export function getFormattedDateRange(
	startDate,
	endDate,
	format = 'DD MMM YYYY'
) {
	if (startDate === endDate) {
		return dayjs(startDate).format(format)
	}
	return `${dayjs(startDate).format(format)} - ${dayjs(endDate).format(
		format
	)}`
}

export function getLineStartPosition(string, position) {
	const charLength = 1
	let char = ''

	while (char !== '\n' && position > 0) {
		position = position - charLength
		char = string.substr(position, charLength)
	}

	if (char === '\n') {
		position += 1
	}

	return position
}

export function singularize(word) {
	const endings = {
		ves: 'fe',
		ies: 'y',
		i: 'us',
		zes: 'ze',
		ses: 's',
		es: 'e',
		s: '',
	}
	return word.replace(
		new RegExp(`(${Object.keys(endings).join('|')})$`),
		(r) => endings[r]
	)
}

export const validateFile = async (
	file,
	showToast = true,
	fileType = 'image'
) => {
	const extension = file.name.split('.').pop().toLowerCase()
	const error = (msg) => {
		if (showToast) toast.error(msg)
		console.error(msg)
		return msg
	}

	if (fileType == 'pdf' && extension != 'pdf') {
		return error(__('Only PDF files are allowed.'))
	} else if (fileType == 'document' && !['doc', 'docx'].includes(extension)) {
		return error(
			__('Only document file of type .doc or .docx are allowed.')
		)
	} else if (fileType == 'zip' && extension != 'zip') {
		return error(__('Only ZIP files are allowed.'))
	} else if (
		['image', 'video'].includes(fileType) &&
		!file.type.startsWith(`${fileType}/`)
	) {
		return error(__('Only {0} file is allowed.').format(fileType))
	} else if (file.type === 'image/svg+xml') {
		const text = await file.text()

		const blacklist = [
			/<script[\s>]/i,
			/on\w+=["']?/i,
			/javascript:/i,
			/data:/i,
			/<iframe[\s>]/i,
			/<object[\s>]/i,
			/<embed[\s>]/i,
			/<link[\s>]/i,
		]

		for (const pattern of blacklist) {
			if (pattern.test(text)) {
				return error(__('SVG contains potentially unsafe content.'))
			}
		}
	}

	return null
}

export const escapeHTML = (text) => {
	if (!text) return ''
	let escape_html_mapping = {
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
		'`': '&#x60;',
	}

	return String(text).replace(
		/[&<>"'`=]/g,
		(char) => escape_html_mapping[char] || char
	)
}

const sanitizeJSON = (node) => {
	if (Array.isArray(node)) return node.map(sanitizeJSON)
	if (node && typeof node === 'object') {
		const temp = {}
		for (const n in node) {
			temp[n] = sanitizeJSON(node[n])
		}
		return temp
	}
	if (
		typeof node === 'string' &&
		(node.includes('<') ||
			node.includes('>') ||
			node.includes('&lt;') ||
			node.includes('&gt;'))
	) {
		let decoded = node
		if (node.includes('&lt;') || node.includes('&gt;')) {
			decoded = decodeEntities(node)
		}
		decoded = decoded.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')

		if (decoded.includes('youtube.com/embed/')) {
			const match = decoded.match(/src="([^"]+youtube\.com\/embed\/[^"]+)"/i)
			if (match) {
				const videoID = extractYouTubeId(match[1])
				if (videoID) {
					decoded = `<div class="video-player rounded-md overflow-hidden border border-gray-100" data-plyr-provider="youtube" data-plyr-embed-id="${videoID}" oncontextmenu="return false"></div>`
				}
			}
		}

		return DOMPurify.sanitize(decoded, {
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
			],
		})
	}
	return node
}

export const sanitizeEditorJs = (data) => {
	if (!data || !Array.isArray(data.blocks)) return data
	for (let i = 0; i < data.blocks.length; i++) {
		const node = data.blocks[i]
		if (!node) continue

		// Convert EditorJS embed blocks (YouTube/Vimeo) into paragraph blocks
		// containing a Plyr div, so the read-only renderer shows the Plyr player.
		if (node.type === 'embed' && node.data) {
			const service = node.data.service
			if (service === 'youtube') {
				const embedUrl = node.data.embed || ''
				const videoID = extractYouTubeId(embedUrl) || embedUrl
				if (videoID) {
					data.blocks[i] = {
						type: 'paragraph',
						data: {
							text: `<div class="video-player rounded-md overflow-hidden border border-gray-100" data-plyr-provider="youtube" data-plyr-embed-id="${videoID}" oncontextmenu="return false"></div>`,
						},
					}
					continue
				}
			}
			if (service === 'vimeo') {
				const embedUrl = node.data.embed || ''
				const vimeoMatch = embedUrl.match(/vimeo\.com\/video\/(\d+)/)
				const vimeoId = vimeoMatch ? vimeoMatch[1] : embedUrl
				if (vimeoId) {
					data.blocks[i] = {
						type: 'paragraph',
						data: {
							text: `<div class="video-player rounded-md overflow-hidden border border-gray-100" data-plyr-provider="vimeo" data-plyr-embed-id="${vimeoId}" oncontextmenu="return false"></div>`,
						},
					}
					continue
				}
			}
		}

		if (node.type !== 'code') {
			node.data = sanitizeJSON(node.data)
		}
	}
	return data
}

export const sanitizeHTML = (text) => {
	text = DOMPurify.sanitize(decodeEntities(text), {
		ALLOWED_TAGS: [
			'b',
			'br',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
			'i',
			'em',
			'strong',
			'a',
			'p',
			'br',
			'ul',
			'ol',
			'li',
			'img',
			'blockquote',
		],
		ALLOWED_ATTR: ['href', 'target', 'src'],
	})
	return text
}

export const canCreateCourse = () => {
	const { userResource } = usersStore()
	return (
		!readOnlyMode &&
		(userResource.data?.is_instructor || userResource.data?.is_moderator)
	)
}

export const enablePlyr = async (context = {}) => {
	await wait(500)

	const players = []
	const videoElements = document.getElementsByClassName('video-player')

	if (videoElements.length === 0) return players

	Array.from(videoElements).forEach((video) => {
		setupPlyrForVideo(video, players, context)
	})

	return players
}

// #2: persist/restore playback position for embedded (Plyr) videos.
const attachResume = (player, source, context) => {
	if (!source || !context || !context.lesson) return
	let lastSaved = 0
	let restored = false

	const save = () => {
		const t = player.currentTime || 0
		if (t <= 0) return
		call('ecological_society.video_progress.save_video_position', {
			lesson: context.lesson,
			source,
			position: t,
			course: context.course,
		}).catch(() => {})
	}

	player.on('ready', async () => {
		if (restored) return
		restored = true
		try {
			const pos = await call(
				'ecological_society.video_progress.get_video_position',
				{ lesson: context.lesson, source }
			)
			// Resume only if meaningfully into the video and not basically at the end.
			if (pos && pos > 3 && (!player.duration || pos < player.duration - 5)) {
				player.currentTime = pos
			}
		} catch (e) {
			/* no saved position */
		}
	})

	player.on('timeupdate', () => {
		const t = player.currentTime || 0
		if (t - lastSaved >= 5) {
			lastSaved = t
			save()
		}
	})
	player.on('pause', save)
	player.on('ended', save)
	window.addEventListener('pagehide', save)
	window.addEventListener('beforeunload', save)
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const setupPlyrForVideo = (video, players, context = {}) => {
	// Skip if Plyr is already initialized on this element
	if (video._plyrInitialized) return

	const src = video.getAttribute('src')

	if (src) {
		const videoID = extractYouTubeId(src)
		video.setAttribute('data-plyr-embed-id', videoID)
	}

	// If this is a YouTube provider but has no embed-id, try to find it
	// from a sibling/parent EditorJS embed block's iframe, or from the
	// embed-tool container's data.
	const provider = video.getAttribute('data-plyr-provider')
	if (provider === 'youtube' && !video.getAttribute('data-plyr-embed-id')) {
		// Look for an iframe with a YouTube src in the same embed-tool block
		const embedBlock = video.closest('.embed-tool__content') || video.closest('.cdx-block')
		if (embedBlock) {
			const iframe = embedBlock.querySelector('iframe[src*="youtube"]')
			if (iframe) {
				const videoID = extractYouTubeId(iframe.getAttribute('src'))
				if (videoID) video.setAttribute('data-plyr-embed-id', videoID)
			}
		}
	}

	// Do NOT initialize Plyr without a video ID for YouTube/Vimeo.
	// Without an ID, Plyr creates empty controls whose text content
	// ("PausePlay% buffered...") is visible as plain text.
	if (
		(provider === 'youtube' || provider === 'vimeo') &&
		!video.getAttribute('data-plyr-embed-id')
	) {
		return
	}

	let controls = [
		'play-large',
		'play',
		'progress',
		'current-time',
		'mute',
		'volume',
		'fullscreen',
	]

	const player = new Plyr(video, {
		youtube: { noCookie: true },
		controls: controls,
		// #1 / #30: keep a real volume control, start audible (not muted), and
		// persist the chosen level across lessons so a mute doesn't silently
		// carry over. NOTE: on mobile browsers (esp. iOS) programmatic volume is
		// ignored by the YouTube iframe - only mute/unmute + hardware volume
		// work there; this is documented in the student guide.
		volume: 1,
		muted: false,
		tooltips: { controls: true, seek: true },
		storage: { enabled: true, key: 'plyr' },
		listeners: {
			seek: function customSeekBehavior(e) {
				const current_time = player.currentTime
				const newTime = getTargetTime(player, e)
				if (
					useSettings().settings.data?.prevent_skipping_videos &&
					parseFloat(newTime) > current_time
				) {
					e.preventDefault()
					player.currentTime = current_time
					return false
				}
			},
		},
	})

	video._plyrInitialized = true
	// #2: resume from last position (source = the embed/YouTube id for this video).
	attachResume(player, video.getAttribute('data-plyr-embed-id') || src, context)
	// #1: block forward seeking. `attachSeekKeyGuard` cancels forward-seek keys
	// before Plyr acts on them (no visible jump), but for a YouTube/Vimeo embed
	// the keypress is handled inside the cross-origin iframe and never reaches
	// us - so `attachForwardSeekClamp` enforces the limit at the player level by
	// reverting any forward jump past the furthest point already watched.
	attachSeekKeyGuard(player)
	attachForwardSeekClamp(player)
	players.push(player)
}

// #1: allow only sequential playback. Playback advances `currentTime` in small
// steps between timeupdates; any jump forward past the furthest-watched point
// (from an arrow key, media key, digit key or the YouTube iframe's own keyboard
// shortcuts) exceeds this threshold and is reverted. Backward seeks (rewatching)
// and volume changes are unaffected.
const FORWARD_JUMP_THRESHOLD = 3
const attachForwardSeekClamp = (player) => {
	player._esMaxTime = player._esMaxTime || 0
	player.on('timeupdate', () => {
		const t = player.currentTime || 0
		if (!useSettings().settings.data?.prevent_skipping_videos) {
			player._esMaxTime = t
			return
		}
		if (t > player._esMaxTime + FORWARD_JUMP_THRESHOLD) {
			player.currentTime = player._esMaxTime
			return
		}
		player._esMaxTime = Math.max(player._esMaxTime, t)
	})
}

const getTargetTime = (plyr, input) => {
	if (
		typeof input === 'object' &&
		(input.type === 'input' || input.type === 'change')
	) {
		return (input.target.value / input.target.max) * plyr.duration
	} else {
		return Number(input)
	}
}

// #1: keys that move a video forward. Left/rewind, volume (ArrowUp/ArrowDown),
// play/pause, mute, fullscreen and captions are intentionally NOT listed so
// accessibility and volume controls keep working when skipping is prevented.
const FORWARD_SEEK_KEYS = [
	'ArrowRight',
	'MediaFastForward',
	'FastForward',
	'MediaTrackNext',
]

export const isForwardSeekKey = (event, currentTime = 0, duration = 0) => {
	if (FORWARD_SEEK_KEYS.includes(event.key)) return true
	// Plyr maps digit keys 0-9 to "seek to N*10%"; block only forward jumps.
	if (/^[0-9]$/.test(event.key) && duration) {
		return (Number(event.key) / 10) * duration > currentTime
	}
	return false
}

// Intercept forward-seek keys in the capture phase on an ancestor of Plyr's
// container, so they are cancelled before Plyr's own (bubble-phase) keyboard
// handler runs — only when "Prevent Skipping Videos" is enabled.
const attachSeekKeyGuard = (player) => {
	player.on('ready', () => {
		const container = player.elements?.container
		const anchor = container?.parentElement || container
		if (!anchor || anchor._seekKeyGuardAttached) return
		anchor._seekKeyGuardAttached = true
		anchor.addEventListener(
			'keydown',
			(event) => {
				if (!useSettings().settings.data?.prevent_skipping_videos) return
				if (isForwardSeekKey(event, player.currentTime, player.duration)) {
					event.preventDefault()
					event.stopPropagation()
				}
			},
			true
		)
	})
}

const extractYouTubeId = (url) => {
	try {
		const parsedUrl = new URL(url)
		return (
			parsedUrl.searchParams.get('v') ||
			parsedUrl.pathname.split('/').pop()
		)
	} catch {
		return url.split('/').pop()
	}
}

export const createLMSCategory = (name) => {
	return call('frappe.client.insert', {
		doc: {
			doctype: 'LMS Category',
			category: name,
		},
	})
		.then((data) => {
			toast.success(__('Category created successfully'))
			return data.name
		})
		.catch((err) => {
			toast.error(
				cleanError(err.messages?.[0]) || __('Unable to create category')
			)
		})
}

export const openSettings = (category, close = null) => {
	const settingsStore = useSettings()
	if (close) {
		close()
	}
	settingsStore.activeTab = category
	settingsStore.isSettingsOpen = true
}

export const cleanError = (message) => {
	const cleanMessage = message.replace(/<[^>]+>/g, (match) => {
		return match.replace(/<\/?[^>]+(>|$)/g, '')
	})
	return cleanMessage
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&#x60;/g, '`')
		.replace(/&#x3D;/g, '=')
		.replace(/&#x2F;/g, '/')
		.replace(/&#x2C;/g, ',')
		.replace(/&#x3B;/g, ';')
		.replace(/&#x3A;/g, ':')
}

export const getMetaInfo = (type, route, meta) => {
	call('lms.lms.api.get_meta_info', {
		type: type,
		route: route,
	}).then((data) => {
		if (data.length) {
			data.forEach((row) => {
				if (row.key == 'description') {
					meta.description = row.value
				} else if (row.key == 'keywords') {
					meta.keywords = row.value
				}
			})
		}
	})
}

export const updateMetaInfo = (type, route, meta) => {
	call('lms.lms.api.update_meta_info', {
		meta_type: type,
		route: route,
		meta_tags: [
			{ key: 'description', value: meta.description },
			{ key: 'keywords', value: meta.keywords },
		],
	}).catch((error) => {
		toast.error(__('Failed to update meta tags {0}').format(error))
		console.error(error)
	})
}

export const formatTimestamp = (seconds) => {
	const date = new Date(seconds * 1000)
	const hours = String(date.getUTCHours()).padStart(2, '0')
	const minutes = String(date.getUTCMinutes()).padStart(2, '0')
	const secs = String(date.getUTCSeconds()).padStart(2, '0')
	return hours > 0 ? `${hours}:${minutes}:${secs}` : `${minutes}:${secs}`
}

const getRootNode = (selector = '#editor') => {
	const root = document.querySelector(selector)
	if (!root) {
		console.warn(`Root node not found for selector: ${selector}`)
	}
	return root
}

// Collect every text node under `root` in document order, along with the offset
// at which each node's text starts inside the concatenated content. This lets a
// selection that spans multiple elements (headings, lists, links, bold text) be
// located and highlighted, which the previous single-node matcher could not do.
const getTextNodeMap = (root) => {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			return node.nodeValue
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT
		},
	})
	const nodeMap = []
	let raw = ''
	let node
	while ((node = walker.nextNode())) {
		nodeMap.push({ node, start: raw.length })
		raw += node.nodeValue
	}
	return { nodeMap, raw }
}

// Collapse runs of whitespace to a single space, keeping a map from each
// normalised character back to its index in the raw text. Selections that cross
// block boundaries collapse whitespace differently from the DOM, so matching is
// done whitespace-insensitively and then mapped back to real offsets.
const collapseWhitespace = (raw) => {
	let norm = ''
	const charMap = []
	let prevSpace = false
	for (let i = 0; i < raw.length; i++) {
		if (/\s/.test(raw[i])) {
			if (prevSpace) continue
			norm += ' '
			charMap.push(i)
			prevSpace = true
		} else {
			norm += raw[i]
			charMap.push(i)
			prevSpace = false
		}
	}
	return { norm, charMap }
}

// Return the [start, end) offsets of `phrase` inside the raw concatenated text
// (whitespace-insensitive, case-insensitive), or null when it is not present.
const locatePhrase = (raw, phrase) => {
	const { norm, charMap } = collapseWhitespace(raw)
	const { norm: normPhrase } = collapseWhitespace(phrase)
	const needle = normPhrase.trim().toLowerCase()
	if (!needle) return null

	const at = norm.toLowerCase().indexOf(needle)
	if (at === -1) return null

	return { start: charMap[at], end: charMap[at + needle.length - 1] + 1 }
}

const createHighlightSpan = (color, name, scrollIntoView) => {
	const span = document.createElement('span')
	span.className = 'highlighted-text'
	if (scrollIntoView) {
		span.style.border = `2px solid ${getColor(color, 400)}`
		span.style.borderRadius = '4px'
	} else {
		span.style.backgroundColor = getColor(color, 200)
	}
	span.dataset.name = name
	return span
}

// Wrap the phrase wherever it occurs, one text node at a time. Each range is
// contained within a single text node, so `surroundContents` is always valid
// (it never throws the "partially selected a non-Text node" InvalidStateError
// that a multi-node range would). Returns the first highlight span created.
const wrapPhraseAcrossNodes = (root, phrase, color, name, scrollIntoView) => {
	const { nodeMap, raw } = getTextNodeMap(root)
	if (!raw) return null

	const found = locatePhrase(raw, phrase)
	if (!found) return null

	let firstSpan = null
	for (const { node, start } of nodeMap) {
		const nodeEnd = start + node.nodeValue.length
		const from = Math.max(found.start, start)
		const to = Math.min(found.end, nodeEnd)
		if (from >= to) continue

		const range = document.createRange()
		range.setStart(node, from - start)
		range.setEnd(node, to - start)

		const span = createHighlightSpan(color, name, scrollIntoView)
		range.surroundContents(span)
		if (!firstSpan) firstSpan = span
	}
	return firstSpan
}

export const highlightText = (note, scrollIntoView = false) => {
	if (!note?.highlighted_text) return

	const root = getRootNode()
	if (!root) return

	const color = note.color.toLowerCase()
	const span = wrapPhraseAcrossNodes(
		root,
		note.highlighted_text,
		color,
		note.name,
		scrollIntoView
	)
	if (!span) return

	if (scrollIntoView) {
		span.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
		})
		setTimeout(() => {
			document.querySelectorAll('.highlighted-text').forEach((el) => {
				if (el.dataset.name === note.name) {
					el.style.border = 'none'
					el.style.borderRadius = '0px'
				}
			})
		}, 3000)
	}
}

export const scrollToReference = (text) => {
	highlightText({ highlighted_text: text, color: 'yellow', name: '' }, true)
}

export const blockQuotesClick = () => {
	document.querySelectorAll('blockquote').forEach((el) => {
		el.addEventListener('click', (e) => {
			const text = e.target.textContent || ''
			if (text) {
				scrollToReference(text)
			}
		})
	})
}

export const decodeEntities = (encodedString) => {
	const textarea = document.createElement('textarea')
	textarea.innerHTML = encodedString
	return textarea.value
}

export const getColor = (color, shade) => {
	let theme =
		localStorage.getItem('theme') == 'light' ? 'lightMode' : 'darkMode'
	return colorsJSON[theme][color][shade]
}
