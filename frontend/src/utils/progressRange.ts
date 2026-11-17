// Progress range + sort options shared by the course and batch dashboards.
// The bands mirror get_progress_distribution() / PROGRESS_BANDS in lms/lms/api.py
// so a chart bucket and its filter always count the same students.

const __ = ((window as any).__ as (text: string) => string) || ((text: string) => text)

export type ProgressBand =
	| ''
	| 'just_started'
	| 'in_progress'
	| 'advanced'
	| 'completed'
	| 'custom'

export type StudentSort =
	| 'progress_desc'
	| 'progress_asc'
	| 'name_asc'
	| 'creation_desc'
	| 'creation_asc'

// [low, high, highInclusive]
export const PROGRESS_BANDS: Record<
	Exclude<ProgressBand, '' | 'custom'>,
	[number, number, boolean]
> = {
	just_started: [0, 30, false],
	in_progress: [30, 60, false],
	advanced: [60, 100, false],
	completed: [100, 100, true],
}

// Same order as the distribution chart's slices.
export const BAND_ORDER: ProgressBand[] = [
	'just_started',
	'in_progress',
	'advanced',
	'completed',
]

export const progressBandOptions = () => [
	{ label: __('All progress'), value: '' },
	{ label: __('Just Started (0-30%)'), value: 'just_started' },
	{ label: __('In Progress (30-60%)'), value: 'in_progress' },
	{ label: __('Advanced (60-99%)'), value: 'advanced' },
	{ label: __('Completed (100%)'), value: 'completed' },
	{ label: __('Custom range'), value: 'custom' },
]

export const studentSortOptions = () => [
	{ label: __('Enrolled (newest)'), value: 'creation_desc' },
	{ label: __('Enrolled (oldest)'), value: 'creation_asc' },
	{ label: __('Progress (high to low)'), value: 'progress_desc' },
	{ label: __('Progress (low to high)'), value: 'progress_asc' },
	{ label: __('Name (A-Z)'), value: 'name_asc' },
]

const toNumber = (value: unknown, fallback: number) => {
	if (value === null || value === undefined || value === '') return fallback
	const n = Number(value)
	return Number.isFinite(n) ? n : fallback
}

export const getProgressBounds = (
	band: ProgressBand,
	min?: unknown,
	max?: unknown
): [number, number, boolean] | null => {
	if (!band) return null
	if (band === 'custom') {
		let low = toNumber(min, 0)
		let high = toNumber(max, 100)
		if (low > high) [low, high] = [high, low]
		return [low, high, true]
	}
	return PROGRESS_BANDS[band]
}

// frappe get_list filter conditions for the `progress` field.
export const progressFilterConditions = (
	band: ProgressBand,
	min?: unknown,
	max?: unknown
): [string, string, number][] => {
	const bounds = getProgressBounds(band, min, max)
	if (!bounds) return []
	const [low, high, inclusive] = bounds
	return [
		['progress', '>=', low],
		['progress', inclusive ? '<=' : '<', high],
	]
}

export const sortToOrderBy = (sort: StudentSort) =>
	({
		progress_desc: 'progress desc, member_name asc',
		progress_asc: 'progress asc, member_name asc',
		name_asc: 'member_name asc',
		creation_desc: 'creation desc',
		creation_asc: 'creation asc',
	})[sort] || 'creation desc'

export const describeRange = (band: ProgressBand, min?: unknown, max?: unknown) => {
	const bounds = getProgressBounds(band, min, max)
	if (!bounds) return ''
	if (band === 'completed') return '100%'
	if (band === 'advanced') return '60-99%'
	return `${bounds[0]}-${bounds[1]}%`
}

// Query-string params for the export endpoints.
export const exportParams = (opts: {
	search?: string | null
	band: ProgressBand
	min?: unknown
	max?: unknown
	sort: StudentSort
}) => {
	const params = new URLSearchParams()
	if (opts.search) params.set('search', opts.search)
	if (opts.band) {
		params.set('progress_band', opts.band)
		if (opts.band === 'custom') {
			if (opts.min !== '' && opts.min != null) params.set('min_progress', String(opts.min))
			if (opts.max !== '' && opts.max != null) params.set('max_progress', String(opts.max))
		}
	}
	params.set('sort', opts.sort)
	return params.toString()
}
