import * as path from "path"
import fs from "fs/promises"
import { ToolStatus } from "../../../../shared/ExtensionMessage"
import { BaseAgentTool } from "../base-agent.tool"
import type { AgentToolOptions, AgentToolParams, AskConfirmationResponse } from "../types"
import { computerUseActions } from "../../../../shared/new-tools"
import { BrowserManager } from "../../browser-manager"
import screenshotDesktop from "screenshot-desktop"
import { exec } from "child_process"
// import * as puppeteer from 'puppeteer';

export class ComputerUseTool extends BaseAgentTool {
	protected params: AgentToolParams
	private abortController: AbortController
	private isAborting: boolean = false

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.abortController = new AbortController()
	}

	override async abortToolExecution(): Promise<void> {
		this.isAborting = true
		this.abortController.abort()
	}

	async execute() {
		if (this.isBadActionInput()) {
			return await this.onBadInputReceived()
		}

		try {
			const confirmation = await this.askToolExecConfirmation()
			this.checkIfAborted()

			if (confirmation.response !== "yesButtonTapped") {
				await this.updateAsk("rejected")
				return await this.onExecDenied(confirmation)
			}
			await this.updateAsk("loading")

			this.checkIfAborted()
			// const browserManager = this.koduDev.browserManager
			// await browserManager.launchBrowser()
			// await this.checkIfAborted(browserManager.closeBrowser)

			const result = await this.processComputerUse()
			await this.updateAsk("approved", result.screenshot)

			return this.toolResponse("success", "", result.screenshot ? [result.screenshot] : undefined)
		} catch (err) {
			if (this.isAborting) {
				await this.cleanup()
				return this.toolResponse("error", "The tool execution was aborted.")
			}
			throw err
		}
	}

	private isBadActionInput() {
		const { action, url, coordinate, text } = this.params.input

		return (
			!action ||
			!computerUseActions.includes(action) ||
			(action === "launch" && !url) ||
			(action === "click" && !coordinate) ||
			(action === "type" && !text)
		)
	}

	private async onBadInputReceived() {
		const { action } = this.params.input

		const actionMissingMsg = "Claude tried to use `computer_use` without required parameter `action`. Retrying..."
		const badCordinateMsg =
			"Claude tried to use `computer_use` tool's `click` action without specifying `coordinate` parameter. Retrying..."
		const badLaunchMsg =
			"Claude tried to use `computer_use` tool's `launch` action without specifying a `url` parameter. Retrying..."
		const badTypeMsg =
			"Claude tried to use `computer_use` tool's `type` action without specifying a `text` parameter. Retrying..."

		const errorMessage =
			!action || !computerUseActions.includes(action)
				? actionMissingMsg
				: action === "click" && !this.params.input.coordinate
				? badCordinateMsg
				: action === "launch" && !this.params.input.url
				? badLaunchMsg
				: badTypeMsg

		if (!action || !computerUseActions.includes(action)) {
			await this.params.say("error", errorMessage)
		}

		const errMsg = `Error: Missing value for required parameter(s) 'action', 'url', 'coordinate', or 'text'. Please retry with complete response.
            Some good examples of a 'computer_use' tool call is:
            {
                "tool": "computer_use",
                "action": "system_screenshot"
            }
						{
                "tool": "computer_use",
                "action": "launch",
                "url": "producthunt.com"
            }
            {
                "tool": "computer_use",
                "action": "click",
                "coordinate": "100,100"
            }
            {
                "tool": "computer_use",
                "action": "type",
                "text": "Hello, world!"
            }
            Please try again with the correct parameters.`
		return this.toolResponse("error", errMsg)
	}

	private async askToolExecConfirmation(): Promise<AskConfirmationResponse> {
		if (this.abortController.signal.aborted) {
			throw new Error("Tool execution was aborted")
		}

		return await this.params.ask!(
			"tool",
			{
				tool: {
					tool: "computer_use",
					action: this.params.input.action!,
					url: this.params.input.url!,
					coordinate: this.params.input.coordinate!,
					text: this.params.input.text!,
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts
		)
	}

	private async onExecDenied(confirmation: AskConfirmationResponse) {
		const { response, text, images } = confirmation

		if (response === "messageResponse") {
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "computer_use",
						action: this.params.input.action!,
						url: this.params.input.url!,
						coordinate: this.params.input.coordinate!,
						text: this.params.input.text!,
						approvalState: "rejected",
						ts: this.ts,
						userFeedback: text,
					},
				},
				this.ts
			)
			await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
			return this.toolResponse("feedback", text ?? "The user denied this operation.", images)
		}

		return this.toolResponse("rejected", "The user denied this operation.")
	}

	private async checkIfAborted(beforeThrowAction: () => Promise<void> = async () => {}) {
		if (this.abortController.signal.aborted) {
			await beforeThrowAction()
			throw new Error("Tool execution was aborted")
		}
	}

	private async updateAsk(approvalState: ToolStatus, base64Image?: string) {
		const { action, url, coordinate, text } = this.params.input

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "computer_use",
					action: action!,
					url,
					coordinate,
					text,
					base64Image,
					approvalState,
					ts: this.ts,
				},
			},
			this.ts
		)
	}

	// private async processComputerUse(browserManager: BrowserManager) {
	private async processComputerUse() {
		switch (this.params.input.action) {
			case "system_screenshot":
				return await this.takeSystemScreenshot()
			// case "launch":
			// 	return await browserManager.navigateToUrl(this.params.input.url!)
			// case "click":
			// 	return await browserManager.click(this.params.input.coordinate!)
			// case "type":
			// 	return await browserManager.type(this.params.input.text!)
			// case "scroll_down":
			// 	return await browserManager.scrollDown()
			// case "scroll_up":
			// 	return await browserManager.scrollUp()
			default:
				throw new Error(`Unknown action: ${this.params.input.action}`)
		}
	}

	private async takeSystemScreenshot() {
		const outputDir = "/tmp"
		const filename = "my_screenshot.png"
		const fullPath = path.join(outputDir, filename)

		try {
			await new Promise((resolve, reject) => {
				exec(`scrot -d 1 ${fullPath}`, (error, stdout, stderr) => {
					if (error) {
						console.error(">> scrot screenshot failed:", error)
						reject(error)
					} else {
						console.log(">> scrot screenshot success")
						resolve(stdout)
					}
				})
			})

			const imageBuffer = await fs.readFile(fullPath)
			const screenshotBase64 = imageBuffer.toString("base64")

			return { screenshot: `data:image/webp;base64,${screenshotBase64}` }
		} catch (err) {
			console.error("Error taking screenshot:", err)
			throw err
		}
	}

	private async cleanup() {
		try {
			await this.koduDev.browserManager.closeBrowser()
		} catch (err) {
			console.error("Error during cleanup:", err)
		}
	}
}
