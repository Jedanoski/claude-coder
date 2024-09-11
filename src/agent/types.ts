import { Anthropic } from "@anthropic-ai/sdk"
import { ResultPromise } from "execa"
import { ApiConfiguration } from "../api"
import { ClaudeDevProvider } from "../providers/ClaudeDevProvider"
import { ClaudeAskResponse } from "../shared/WebviewMessage"
import { HistoryItem } from "../shared/HistoryItem"
import { ClaudeMessage } from "../shared/ExtensionMessage"

export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
export type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

export interface KoduDevOptions {
	provider: ClaudeDevProvider
	apiConfiguration: ApiConfiguration
	maxRequestsPerTask?: number
	customInstructions?: string
	alwaysAllowReadOnly?: boolean
	alwaysAllowWriteOnly?: boolean
	creativeMode?: "creative" | "normal" | "deterministic"
	task?: string
	images?: string[]
	historyItem?: HistoryItem
}

export interface KoduDevState {
	taskId: string
	requestCount: number
	apiConversationHistory: Anthropic.MessageParam[]
	claudeMessages: ClaudeMessage[]
	askResponse?: ClaudeAskResponse
	askResponseText?: string
	isHistoryItem?: boolean
	isHistoryItemResumed?: boolean
	askResponseImages?: string[]
	lastMessageTs?: number
	executeCommandRunningProcess?: ResultPromise
	abort: boolean
}

export interface ClaudeRequestResult {
	didEndLoop: boolean
	inputTokens: number
	outputTokens: number
}

// Re-export types from other files to centralize type definitions
export type { ClaudeMessage } from "../shared/ExtensionMessage"
export type { ToolName } from "../shared/Tool"
