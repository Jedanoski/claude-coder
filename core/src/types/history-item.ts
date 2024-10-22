export type HistoryItem = {
	id: string
	ts: number
	task: string
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	name?: string
	dirAbsolutePath?: string
	memory?: string
	isRepoInitialized?: boolean
}
