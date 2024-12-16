import { ApiConfiguration } from "../api"
import { GlobalState } from "../providers/claude-coder/state/global-state-manager"

export type Resource =
	| { id: string; type: "file" | "folder"; name: string }
	| { id: string; type: "url"; description: string; name: string }

export type AmplitudeWebviewMessage = {
	type: "amplitude"
	event_type:
		| "AuthStart"
		| "ReferralProgram"
		| "ExtensionCreditAddOpen"
		| "TrialOfferView"
		| "TrialOfferStart"
		| "TrialUpsellView"
		| "TrialUpsellStart"
		| "ExtensionCreditAddSelect"
		| "OfferwallView"
	key?: string
}

type RenameTask =
	| {
			type: "renameTask"
			taskId: string
			isCurentTask?: undefined
	  }
	| {
			type: "renameTask"
			taskId?: undefined
			isCurentTask: boolean
	  }

type OpenExternalLink = {
	type: "openExternalLink"
	url: string
}

type ApiConfigurationMessage = {
	type: "apiConfiguration"
	apiConfiguration: NonNullable<ApiConfiguration>
}

type DebugMessage = {
	type: "debug"
}

export type updateGlobalStateMessage = {
	type: "updateGlobalState"
	state: Partial<GlobalState>
}

export type autoCloseTerminalMessage = {
	type: "autoCloseTerminal"
	bool: boolean
}

export type customInstructionsMessage = {
	type: "customInstructions"
	text: string
}

export type autoSummarizeMessage = {
	type: "autoSummarize"
	bool: boolean
}

export type pauseNextMessage = {
	type: "pauseNext"
}

export type setApiKeyDialogMessage = {
	type: "setApiKeyDialog"
}

export type switchAutomaticModeMessage = {
	type: "switchAutomaticMode"
	bool: boolean
}

export type terminalCompressionThresholdMessage = {
	type: "terminalCompressionThreshold"
	value?: number
}

export type pauseTemporayAutoModeMessage = {
	type: "pauseTemporayAutoMode"
	mode: boolean
}

export type setInlineEditModeMessage = {
	type: "setInlineEditMode"
	inlineEditOutputType?: "full" | "diff"
}

export type setCommandTimeoutMessage = {
	type: "commandTimeout"
	commandTimeout: number
}

export type toggleGitHandlerMessage = {
	type: "toggleGitHandler"
	enabled: boolean
}

export type viewFileMessage = {
	type: "viewFile"
	path: string
	version: string
}

export type rollbackToCheckpointMessage = {
	type: "rollbackToCheckpoint"
	version: string
	path: string
	ts: number
}

export type WebviewMessage =
	| rollbackToCheckpointMessage
	| viewFileMessage
	| setCommandTimeoutMessage
	| toggleGitHandlerMessage
	| setInlineEditModeMessage
	| pauseTemporayAutoModeMessage
	| terminalCompressionThresholdMessage
	| switchAutomaticModeMessage
	| setApiKeyDialogMessage
	| pauseNextMessage
	| autoSummarizeMessage
	| updateGlobalStateMessage
	| AmplitudeWebviewMessage
	| OpenExternalLink
	| autoCloseTerminalMessage
	| ApiConfigurationMessage
	| RenameTask
	| DebugMessage
	| customInstructionsMessage
	| {
			type:
				| "skipWriteAnimation"
				| "cancelCurrentRequest"
				| "maxRequestsPerTask"
				| "alwaysAllowReadOnly"
				| "webviewDidLaunch"
				| "newTask"
				| "askResponse"
				| "retryTask"
				| "alwaysAllowWriteOnly"
				| "clearTask"
				| "didCloseAnnouncement"
				| "selectImages"
				| "exportCurrentTask"
				| "showTaskWithId"
				| "deleteTaskWithId"
				| "exportTaskWithId"
				| "didClickKoduSignOut"
				| "fetchKoduCredits"
				| "resetState"
				| "fileTree"
				| "clearHistory"
			text?: string
			askResponse?: ClaudeAskResponse
			images?: string[]
			attachements?: Resource[]
			bool?: boolean
	  }

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
