import React, { useState, useEffect, useRef, useMemo, useCallback, KeyboardEvent } from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { VirtuosoHandle } from "react-virtuoso"
import { useEvent, useMount } from "react-use"
import vsDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus"
import { ClaudeAsk, ClaudeSayTool, ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { combineApiRequests } from "../../../../src/shared/combineApiRequests"
import { combineCommandSequences, COMMAND_STDIN_STRING } from "../../../../src/shared/combineCommandSequences"
import { getApiMetrics } from "../../../../src/shared/getApiMetrics"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { getSyntaxHighlighterStyleFromTheme } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import { vscode } from "../../utils/vscode"
import Announcement from "../Announcement/Announcement"
import HistoryPreview from "../HistoryPreview/HistoryPreview"
import TaskHeader from "../TaskHeader/TaskHeader"
import KoduPromo from "../KoduPromo/KoduPromo"
import ChatMessages from "./ChatMessages"
import InputArea from "./InputArea"
import ButtonSection from "./ButtonSection"

interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	selectedModelSupportsImages: boolean
	selectedModelSupportsPromptCache: boolean
	hideAnnouncement: () => void
	showHistoryView: () => void
}

const MAX_IMAGES_PER_MESSAGE = 20

const ChatView: React.FC<ChatViewProps> = ({
	isHidden,
	showAnnouncement,
	selectedModelSupportsImages,
	selectedModelSupportsPromptCache,
	hideAnnouncement,
	showHistoryView,
}) => {
	const {
		version,
		claudeMessages: messages,
		taskHistory,
		themeName: vscodeThemeName,
		uriScheme,
		shouldShowKoduPromo,
		user,
	} = useExtensionState()

	// Input-related state
	const [inputValue, setInputValue] = useState("")
	const [textAreaDisabled, setTextAreaDisabled] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])
	const [thumbnailsHeight, setThumbnailsHeight] = useState(0)

	// UI control state
	const [claudeAsk, setClaudeAsk] = useState<ClaudeAsk | undefined>(undefined)
	const [_, setIsAbortingRequest] = useState(false)
	const [enableButtons, setEnableButtons] = useState<boolean>(false)
	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
	const [syntaxHighlighterStyle, setSyntaxHighlighterStyle] = useState(vsDarkPlus)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})

	// Refs
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const virtuosoRef = useRef<VirtuosoHandle>(null)

	// Memoized values
	const task = useMemo(() => (messages.length > 0 ? messages[0] : undefined), [messages])
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])
	const selectImages = () => {
		vscode.postMessage({ type: "selectImages" })
	}
	// Update syntax highlighter style when theme changes
	useEffect(() => {
		if (!vscodeThemeName) return
		const theme = getSyntaxHighlighterStyleFromTheme(vscodeThemeName)
		if (theme) {
			setSyntaxHighlighterStyle(theme)
		}
	}, [vscodeThemeName])

	// handle keyDown
	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		const isComposing = event.nativeEvent?.isComposing ?? false
		if (event.key === "Enter" && !event.shiftKey && !isComposing) {
			event.preventDefault()
			handleSendMessage()
		}
	}

	// Handle changes in messages
	useEffect(() => {
		const lastMessage = messages.at(-1)
		if (lastMessage) {
			switch (lastMessage.type) {
				case "ask":
					handleAskMessage(lastMessage)
					break
				case "say":
					handleSayMessage(lastMessage)
					break
			}
		} else {
			setTextAreaDisabled(false)
			setClaudeAsk(undefined)
			setEnableButtons(false)
			setPrimaryButtonText(undefined)
			setSecondaryButtonText(undefined)
		}
	}, [messages])

	// Filter visible messages
	const visibleMessages = useMemo(() => {
		console.log(JSON.stringify(modifiedMessages))
		return modifiedMessages.filter((message) => {
			if (
				(message.ask === "completion_result" && message.text === "") ||
				["resume_task", "resume_completed_task"].includes(message.ask!)
			) {
				return false
			}
			if (["api_req_finished", "api_req_retried"].includes(message.say!)) {
				return false
			}
			if (message.say === "api_req_started") return true
			if (message.say === "text" && (message.text ?? "") === "" && (message.images?.length ?? 0) === 0) {
				return false
			}
			return true
		})
	}, [modifiedMessages])

	// Focus textarea when component becomes visible
	useEffect(() => {
		const timer = setTimeout(() => {
			if (!isHidden && !textAreaDisabled && !enableButtons) {
				textAreaRef.current?.focus()
			}
		}, 50)
		return () => clearTimeout(timer)
	}, [isHidden, textAreaDisabled, enableButtons])

	// Scroll to bottom when messages change
	useEffect(() => {
		const timer = setTimeout(() => {
			virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" })
		}, 50)
		return () => clearTimeout(timer)
	}, [visibleMessages])

	// Handle sending messages
	const handleSendMessage = useCallback(() => {
		const text = inputValue.trim()
		if (text || selectedImages.length > 0) {
			if (messages.length === 0) {
				vscode.postMessage({ type: "newTask", text, images: selectedImages })
			} else if (claudeAsk) {
				handleClaudeAskResponse(text)
			} else {
				vscode.postMessage({
					type: "askResponse",
					askResponse: "messageResponse",
					text,
					images: selectedImages,
				})
			}
			setInputValue("")
			setTextAreaDisabled(true)
			setSelectedImages([])
			setClaudeAsk(undefined)
			setEnableButtons(false)
		}
	}, [inputValue, selectedImages, messages.length, claudeAsk])

	// Handle Claude ask response
	const handleClaudeAskResponse = useCallback(
		(text: string) => {
			if (claudeAsk) {
				vscode.postMessage({
					type: "askResponse",
					askResponse: "messageResponse",
					text,
					images: selectedImages,
				})
			}
		},
		[claudeAsk, selectedImages]
	)

	// Handle paste

	const handlePaste = async (e: React.ClipboardEvent) => {
		if (shouldDisableImages) {
			e.preventDefault()
			return
		}

		const items = e.clipboardData.items
		const acceptedTypes = ["png", "jpeg", "webp"] // supported by anthropic and openrouter (jpg is just a file extension but the image will be recognized as jpeg)
		const imageItems = Array.from(items).filter((item) => {
			const [type, subtype] = item.type.split("/")
			return type === "image" && acceptedTypes.includes(subtype)
		})
		if (imageItems.length > 0) {
			e.preventDefault()
			const imagePromises = imageItems.map((item) => {
				return new Promise<string | null>((resolve) => {
					const blob = item.getAsFile()
					if (!blob) {
						resolve(null)
						return
					}
					const reader = new FileReader()
					reader.onloadend = () => {
						if (reader.error) {
							console.error("Error reading file:", reader.error)
							resolve(null)
						} else {
							const result = reader.result
							resolve(typeof result === "string" ? result : null)
						}
					}
					reader.readAsDataURL(blob)
				})
			})
			const imageDataArray = await Promise.all(imagePromises)
			const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
			//.map((dataUrl) => dataUrl.split(",")[1]) // strip the mime type prefix, sharp doesn't need it
			if (dataUrls.length > 0) {
				setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
			} else {
				console.warn("No valid images were processed")
			}
		}
	}

	// Handle primary button click
	const handlePrimaryButtonClick = useCallback(() => {
		switch (claudeAsk) {
			case "api_req_failed":
			case "request_limit_reached":
			case "command":
			case "command_output":
			case "tool":
			case "resume_task":
				vscode.postMessage({ type: "askResponse", askResponse: "yesButtonTapped" })
				break
			case "completion_result":
			case "resume_completed_task":
				vscode.postMessage({ type: "clearTask" })
				break
		}
		setTextAreaDisabled(true)
		setClaudeAsk(undefined)
		setEnableButtons(false)
	}, [claudeAsk])

	// Handle secondary button click
	const handleSecondaryButtonClick = useCallback(() => {
		switch (claudeAsk) {
			case "request_limit_reached":
			case "api_req_failed":
				vscode.postMessage({ type: "clearTask" })
				break
			case "command":
			case "tool":
				vscode.postMessage({ type: "askResponse", askResponse: "noButtonTapped" })
				break
		}
		setTextAreaDisabled(true)
		setClaudeAsk(undefined)
		setEnableButtons(false)
	}, [claudeAsk])

	// Handle incoming messages
	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			switch (message.type) {
				case "action":
					if (message.action === "didBecomeVisible") {
						if (!isHidden && !textAreaDisabled && !enableButtons) {
							textAreaRef.current?.focus()
						}
					}
					break
				case "selectedImages":
					const newImages = message.images ?? []
					if (newImages.length > 0) {
						setSelectedImages((prevImages) =>
							[...prevImages, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE)
						)
					}
					break
			}
		},
		[isHidden, textAreaDisabled, enableButtons]
	)

	useEvent("message", handleMessage)

	useMount(() => {
		textAreaRef.current?.focus()
	})

	// Handle ask messages
	const handleAskMessage = (message: any) => {
		// This function updates the component state based on the type of ask message received
		switch (message.ask) {
			case "request_limit_reached":
				setTextAreaDisabled(true)
				setClaudeAsk("request_limit_reached")
				setEnableButtons(true)
				setPrimaryButtonText("Proceed")
				setSecondaryButtonText("Start New Task")
				break
			case "api_req_failed":
				setTextAreaDisabled(true)
				setClaudeAsk("api_req_failed")
				setEnableButtons(true)
				setPrimaryButtonText("Retry")
				setSecondaryButtonText("Start New Task")
				break
			case "followup":
				setTextAreaDisabled(false)
				setClaudeAsk("followup")
				setEnableButtons(false)
				break
			case "tool":
				setTextAreaDisabled(false)
				setClaudeAsk("tool")
				setEnableButtons(true)
				const tool = JSON.parse(message.text || "{}") as ClaudeSayTool
				handleToolButtons(tool)
				break
			case "command":
				setTextAreaDisabled(false)
				setClaudeAsk("command")
				setEnableButtons(true)
				setPrimaryButtonText("Run Command")
				setSecondaryButtonText("Reject")
				break
			case "command_output":
				setTextAreaDisabled(false)
				setClaudeAsk("command_output")
				setEnableButtons(true)
				setPrimaryButtonText("Exit Command")
				setSecondaryButtonText(undefined)
				break
			case "completion_result":
			case "resume_completed_task":
				setTextAreaDisabled(false)
				setClaudeAsk(message.ask)
				setEnableButtons(true)
				setPrimaryButtonText("Start New Task")
				setSecondaryButtonText(undefined)
				break
			case "resume_task":
				setTextAreaDisabled(false)
				setClaudeAsk("resume_task")
				setEnableButtons(true)
				setPrimaryButtonText("Resume Task")
				setSecondaryButtonText(undefined)
				break
		}
	}

	// Handle say messages
	const handleSayMessage = (message: any) => {
		// This function updates the component state based on the type of say message received
		switch (message.say) {
			case "abort_automode":
				setTextAreaDisabled(false)
				setClaudeAsk(undefined)
				setEnableButtons(false)
				setPrimaryButtonText(undefined)
				setSecondaryButtonText(undefined)
				break
			case "api_req_started":
				if (messages.at(-2)?.ask === "command_output") {
					setInputValue("")
					setTextAreaDisabled(true)
					setSelectedImages([])
					setClaudeAsk(undefined)
					setEnableButtons(false)
				}
				break
			case "error":
				setIsAbortingRequest(false)
				setTextAreaDisabled(false)
				setClaudeAsk(undefined)
				setEnableButtons(false)
				setPrimaryButtonText(undefined)
				setSecondaryButtonText(undefined)
				break
		}
	}

	// Handle tool buttons
	const handleToolButtons = (tool: ClaudeSayTool) => {
		switch (tool.tool) {
			case "editedExistingFile":
				setPrimaryButtonText("Save")
				setSecondaryButtonText("Reject")
				break
			case "newFileCreated":
				setPrimaryButtonText("Create")
				setSecondaryButtonText("Reject")
				break
			default:
				setPrimaryButtonText("Approve")
				setSecondaryButtonText("Reject")
				break
		}
	}

	// Toggle row expansion
	const toggleRowExpansion = useCallback((ts: number) => {
		setExpandedRows((prev) => ({
			...prev,
			[ts]: !prev[ts],
		}))
	}, [])

	// Set placeholder text
	const placeholderText = useMemo(() => {
		return task ? "Type a message..." : "Type your task here..."
	}, [task])

	// Check if a request is running

	// Determine if abort automode should be shown

	// Determine if images should be disabled
	const shouldDisableImages =
		!selectedModelSupportsImages || textAreaDisabled || selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	// Thumbnail height change handler
	useEffect(() => {
		if (selectedImages.length === 0) {
			setThumbnailsHeight(0)
		}
	}, [selectedImages])

	const handleThumbnailsHeightChange = useCallback((height: number) => {
		setThumbnailsHeight(height)
	}, [])

	// Memoize the handleSendStdin function
	const handleSendStdin = useCallback(
		(text: string) => {
			if (claudeAsk === "command_output") {
				vscode.postMessage({
					type: "askResponse",
					askResponse: "messageResponse",
					text: COMMAND_STDIN_STRING + text,
				})
				setClaudeAsk(undefined)
			}
		},
		[claudeAsk]
	)

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: isHidden ? "none" : "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
			<div
				style={{
					borderTop: "1px solid var(--section-border)",
					flex: "1 1 0%",
					display: "flex",
					flexDirection: "column",
					overflowY: "auto",
				}}>
				{task ? (
					<TaskHeader
						task={task}
						tokensIn={apiMetrics.totalTokensIn}
						tokensOut={apiMetrics.totalTokensOut}
						doesModelSupportPromptCache={selectedModelSupportsPromptCache}
						cacheWrites={apiMetrics.totalCacheWrites}
						cacheReads={apiMetrics.totalCacheReads}
						totalCost={apiMetrics.totalCost}
						onClose={() => vscode.postMessage({ type: "clearTask" })}
						isHidden={isHidden}
						koduCredits={user?.credits ?? 0}
						vscodeUriScheme={uriScheme}
					/>
				) : (
					<>
						{showAnnouncement && (
							<Announcement
								version={version}
								hideAnnouncement={hideAnnouncement}
								vscodeUriScheme={uriScheme}
							/>
						)}
						{!showAnnouncement && shouldShowKoduPromo && (
							<KoduPromo style={{ margin: "10px 15px -10px 15px" }} />
						)}
						<section className="text-start">
							<h3 className="flex-line uppercase text-alt">What can I do for you?</h3>
							<div>
								Thanks to{" "}
								<VSCodeLink
									href="https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf"
									style={{ display: "inline" }}>
									Claude 3.5 Sonnet's agentic coding capabilities,
								</VSCodeLink>{" "}
								I can handle complex software development tasks step-by-step. With tools that let me
								create & edit files, explore complex projects, and execute terminal commands (after you
								grant permission), I can assist you in ways that go beyond simple code completion or
								tech support.
							</div>
						</section>
						{taskHistory.length > 0 && <HistoryPreview showHistoryView={showHistoryView} />}
					</>
				)}
				{task && (
					<>
						<ChatMessages
							visibleMessages={visibleMessages}
							syntaxHighlighterStyle={syntaxHighlighterStyle}
							expandedRows={expandedRows}
							toggleRowExpansion={toggleRowExpansion}
							handleSendStdin={handleSendStdin}
						/>
						<ButtonSection
							primaryButtonText={primaryButtonText}
							secondaryButtonText={secondaryButtonText}
							enableButtons={enableButtons}
							handlePrimaryButtonClick={handlePrimaryButtonClick}
							handleSecondaryButtonClick={handleSecondaryButtonClick}
						/>
					</>
				)}
			</div>
			<InputArea
				inputValue={inputValue}
				setInputValue={setInputValue}
				textAreaDisabled={textAreaDisabled}
				handleSendMessage={handleSendMessage}
				placeholderText={placeholderText}
				selectedImages={selectedImages}
				setSelectedImages={setSelectedImages}
				shouldDisableImages={shouldDisableImages}
				selectImages={selectImages}
				thumbnailsHeight={thumbnailsHeight}
				handleThumbnailsHeightChange={handleThumbnailsHeightChange}
				isRequestRunning={
					// if last message is api_req_started, then request is running
					messages.length > 0 && messages.at(-1)?.say === "api_req_started"
				}
				handleKeyDown={handleKeyDown}
				handlePaste={handlePaste}
			/>
		</div>
	)
}

export default React.memo(ChatView)
