import { ToolStatus } from "./ExtensionMessage"

/**
 * This is the input and output for execute_command tool
 */
export type ExecuteCommandTool = {
	tool: "execute_command"
	/**
	 * the command to execute
	 */
	command: string
	/**
	 * the output of the command
	 */
	output?: string
}

export type ListFilesTool = {
	tool: "list_files"
	path: string
	recursive?: "true" | "false"
	content?: string
}

export type ListCodeDefinitionNamesTool = {
	tool: "list_code_definition_names"
	path: string
	content?: string
}

export type SearchFilesTool = {
	tool: "search_files"
	path: string
	regex: string
	filePattern?: string
	content?: string
}

export type ReadFileTool = {
	tool: "read_file"
	path: string
	content: string
}

export type WriteToFileTool = {
	tool: "write_to_file"
	path: string
	content: string
}

export type AskFollowupQuestionTool = {
	tool: "ask_followup_question"
	question: string
}

export type AttemptCompletionTool = {
	tool: "attempt_completion"
	command?: string
	result: string
}

export type WebSearchTool = {
	tool: "web_search"
	searchQuery: string
	baseLink?: string
}

export type UrlScreenshotTool = {
	tool: "url_screenshot"
	url: string
}

export type AskConsultantTool = {
	tool: "ask_consultant"
	query: string
	result?: string
}

export type UpsertMemoryTool = {
	tool: "upsert_memory"
	milestoneName?: string
	summary: string
	content: string
}

export type ChatTool = (
	| ExecuteCommandTool
	| ListFilesTool
	| ListCodeDefinitionNamesTool
	| SearchFilesTool
	| ReadFileTool
	| WriteToFileTool
	| AskFollowupQuestionTool
	| AttemptCompletionTool
	| WebSearchTool
	| UrlScreenshotTool
	| AskConsultantTool
	| UpsertMemoryTool
) & {
	ts: number
	approvalState?: ToolStatus
	error?: string
}
