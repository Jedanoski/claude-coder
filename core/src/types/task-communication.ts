import { ChatTool } from "./chat-tools"
import { Anthropic } from "@anthropic-ai/sdk";

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"

export interface AskResponse {
	response: ClaudeAskResponse
	text?: string
	images?: string[]
}

export type AskDetails = {
	question?: string
	tool?: ChatTool
}

export type AskForConfirmation = (type: ClaudeAsk, details?: AskDetails, askTs?: number) => Promise<AskResponse>

export type ClaudeAsk =
	| "request_limit_reached"
	| "followup"
	| "command"
	| "command_output"
	| "completion_result"
	| "api_req_failed"
	| "resume_task"
	| "resume_completed_task"
	| "tool"

export type ClaudeSay =
	| "task"
	| "error"
	| "api_req_started"
	| "api_req_finished"
	| "text"
	| "completion_result"
	| "user_feedback"
	| "user_feedback_diff"
	| "api_req_retried"
	| "command_output"
	| "tool"
	| "memory_updated"
	| "info"
	| "abort_automode"
	| "shell_integration_warning"
	| "show_terminal"


export interface ClaudeSayTool {
    tool: string;
    path: string;
    content: string;
}
export type UserContent = Array<
    Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>;
