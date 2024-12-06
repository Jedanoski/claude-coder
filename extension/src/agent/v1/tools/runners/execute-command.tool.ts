import Anthropic from "@anthropic-ai/sdk"
import delay from "delay"
import { serializeError } from "serialize-error"
import { AdvancedTerminalManager } from "../../../../integrations/terminal"
import { getCwd } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../types"
import { ExecaTerminalManager } from "../../../../integrations/terminal/execa-terminal-manager"
import { TerminalProcessResultPromise } from "../../../../integrations/terminal/terminal-manager"

import { GlobalStateManager } from "../../../../providers/claude-coder/state/GlobalStateManager"
import { ToolResponseV2 } from "../../types"
import { GitCommitResult } from "../../handlers"

export const COMMAND_TIMEOUT = 90 // 90 seconds
export const MAX_RETRIES = 3

export type EarlyExitState = "approved" | "rejected" | "pending"

export const shellIntegrationErrorOutput: string = `
<command_execution_response>
	<status>
		<result>error</result>
		<operation>command_execution</operation>
		<timestamp>${new Date().toISOString()}</timestamp>
		<error_type>shell_integration_unavailable</error_type>
	</status>
	<error_details>
		<message>Shell integration is not available. The command was executed but output cannot be captured.</message>
		<required_action>User must enable shell integration to capture command output</required_action>
		<limitations>
			<current>Can only run commands without capturing output</current>
			<resolution>Enable shell integration to capture command output</resolution>
		</limitations>
	</error_details>
</command_execution_response>
`

export class ExecuteCommandTool extends BaseAgentTool<"execute_command"> {
	protected params: AgentToolParams<"execute_command">
	private execaTerminalManager: ExecaTerminalManager
	private output: string = ""

	constructor(params: AgentToolParams<"execute_command">, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.execaTerminalManager = new ExecaTerminalManager()
	}

	override async execute() {
		const { input, say } = this.params
		const { command } = input as { command?: string }

		if (!command?.trim()) {
			await say(
				"error",
				"Claude tried to use execute_command without value for required parameter 'command'. Retrying..."
			)
			return this.toolResponse(
				"error",
				`Error: Missing or empty command parameter. Please provide a valid command.`
			)
		}

		return this.executeShellTerminal(command)
	}

	private isApprovedState(state: EarlyExitState): state is "approved" {
		return state === "approved"
	}

	private async executeShellTerminal(command: string): Promise<ToolResponseV2> {
		const { terminalManager } = this.koduDev
		if (!(terminalManager instanceof AdvancedTerminalManager)) {
			throw new Error("AdvancedTerminalManager is not available")
		}

		const { ask, updateAsk, say, returnEmptyStringOnSuccess } = this.params
		const cwd = getCwd()

		// Initial approval request
		const { response, text, images } = await ask(
			"tool",
			{
				tool: {
					tool: "execute_command",
					command,
					approvalState: "pending",
					ts: this.ts,
					isSubMsg: this.params.isSubMsg,
				},
			},
			this.ts
		)

		if (response !== "yesButtonTapped") {
			updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						approvalState: "rejected",
						ts: this.ts,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)

			if (response === "messageResponse") {
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "execute_command",
							command,
							approvalState: "rejected",
							ts: this.ts,
							userFeedback: text,
							isSubMsg: this.params.isSubMsg,
						},
					},
					this.ts
				)
				await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
				return this.toolResponse("feedback", this.formatToolDeniedFeedback(text), images)
			}
			return this.toolResponse("rejected", this.formatToolDenied())
		}

		// Set loading state
		updateAsk(
			"tool",
			{
				tool: {
					tool: "execute_command",
					command,
					approvalState: "loading",
					ts: this.ts,
					isSubMsg: this.params.isSubMsg,
				},
			},
			this.ts
		)

		let process: TerminalProcessResultPromise | null = null

		const terminalInfo = await terminalManager.getOrCreateTerminal(this.cwd)
		if (!terminalInfo?.terminal) {
			throw new Error("Failed to create or get terminal")
		}
		terminalInfo.terminal.show()

		let preCommandCommit = ""
		try {
			const commitResult = await this.koduDev.gitHandler.commitEverything(
				`State before executing command \`${command}\``
			)
			preCommandCommit = commitResult.commitHash
		} catch (error) {
			console.error("Failed to get pre-command commit:", error)
		}

		process = terminalManager.runCommand(terminalInfo, command, {
			autoClose: this.koduDev.getStateManager().autoCloseTerminal ?? false,
		})

		if (!process) {
			throw new Error("Failed to create terminal process after retries")
		}

		let userFeedback: { text?: string; images?: string[] } | undefined
		let didContinue = false
		let earlyExit: EarlyExitState = "pending"

		let completed = false
		let shellIntegrationWarningShown = false

		try {
			const completionPromise = new Promise<void>((resolve) => {
				if (!process) {
					throw new Error("Process is null")
				}
				process.once("completed", () => {
					earlyExit = "approved"
					completed = true
					resolve()
				})
				process.once("no_shell_integration", async () => {
					await say("shell_integration_warning")
					await updateAsk(
						"tool",
						{
							tool: {
								tool: "execute_command",
								command,
								output: this.output,
								approvalState: "error",
								ts: this.ts,
								error: "Shell integration is not available, cannot read output.",
								isSubMsg: this.params.isSubMsg,
							},
						},
						this.ts
					)
					shellIntegrationWarningShown = true
					completed = true
					earlyExit = "approved"
					resolve()
				})
			})
			process.on("line", async (line) => {
				const cleanedLine = line
				if (cleanedLine) {
					this.output += cleanedLine + "\n"
					if (!didContinue || this.isApprovedState(earlyExit)) {
						try {
							await updateAsk(
								"tool",
								{
									tool: {
										tool: "execute_command",
										command,
										output: this.output,
										approvalState: "loading",
										ts: this.ts,
										isSubMsg: this.params.isSubMsg,
									},
								},
								this.ts
							)
						} catch (error) {
							console.error("Failed to update output:", error)
						}
					}
				}
			})
			process.on("error", async (error) => {
				console.log(`Error in process: ${error}`)
			})

			const timeout = GlobalStateManager.getInstance().getGlobalState("commandTimeout")
			const commandTimeout = (timeout ?? COMMAND_TIMEOUT) * 1000
			// Wait for either completion or timeout
			await Promise.race([
				completionPromise,
				delay(commandTimeout).then(() => {
					if (!completed) {
						console.log("Command timed out after", commandTimeout, "ms")
					}
				}),
			])

			// Ensure all output is processed
			await delay(300)
			if (shellIntegrationWarningShown) {
				return this.toolResponse("error", shellIntegrationErrorOutput)
			}

			await updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						output: this.output,
						approvalState: "approved",
						ts: this.ts,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)

			let toolRes = "The command has been executed."
			if (completed) {
				toolRes = "Command execution completed successfully."
			}

			if ((userFeedback?.text && userFeedback.text.length) || userFeedback?.images?.length) {
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "execute_command",
							command,
							output: this.output,
							approvalState: "approved",
							ts: this.ts,
							userFeedback: userFeedback.text,
							isSubMsg: this.params.isSubMsg,
						},
					},
					this.ts
				)

				let commitResult: GitCommitResult | undefined
				try {
					commitResult = await this.koduDev.gitHandler.commitEverything(
						`State after executing command \`${command}\``
					)
				} catch (error) {
					console.error("Failed to get post-command commit:", error)
				}

				const toolRes = `
					<command_execution_response>
						<status>
							<result>success</result>
							<operation>command_execution</operation>
							<timestamp>${new Date().toISOString()}</timestamp>
						</status>
						<execution_details>
							<command_info>
								<executed_command>${command}</executed_command>
								<working_directory>${this.cwd}</working_directory>
							</command_info>
							<output>
								<content>${this.output}</content>
							</output>
							<version_control>
								<git_commit>${commitResult?.commitHash}</git_commit>
								<git_branch>${commitResult?.branch}</git_branch>
							</version_control>
							<user_feedback>
								<message>${userFeedback?.text || ""}</message>
							</user_feedback>
						</execution_details>
					</command_execution_response>`

				if (returnEmptyStringOnSuccess) {
					return this.toolResponse("success", "No output", undefined, commitResult)
				}

				return this.toolResponse("success", toolRes, userFeedback?.images, commitResult)
			} else {
				const toolRes = `
			<command_execution_response>
				<status>
					<result>partial</result>
					<operation>command_execution</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<execution_details>
					<command_info>
						<executed_command>${command}</executed_command>
						<working_directory>${this.cwd}</working_directory>
					</command_info>
					<output>
						<content>${this.output || "No output"}</content>
						<note>This is a partial output as the command is still running</note>
					</output>
				</execution_details>
			</command_execution_response>`

				return this.toolResponse("success", toolRes, userFeedback?.images)
			}
		} catch (error) {
			const errorMessage = (error as Error)?.message || JSON.stringify(serializeError(error), null, 2)
			updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						output: errorMessage,
						approvalState: "error",
						ts: this.ts,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)
			return this.toolResponse("error", this.formatToolError(`Error executing command:\n${errorMessage}`))
		}
	}
}
