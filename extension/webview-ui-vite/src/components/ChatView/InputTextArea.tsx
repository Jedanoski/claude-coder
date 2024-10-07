import React, { forwardRef } from "react"
import DynamicTextArea from "react-textarea-autosize"

type InputTextAreaProps = {
	value: string
	disabled: boolean
	isRequestRunning: boolean
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
	onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
	onFocus: () => void
	onBlur: () => void
	onPaste: (e: React.ClipboardEvent) => void
	thumbnailsHeight: number
	setShowPopover: (show: boolean) => void
}

export const CHAT_BOX_INPUT_ID = "chat-box-input" as const

const InputTextArea = forwardRef<HTMLTextAreaElement, InputTextAreaProps>((props, ref) => {
	return (
		<DynamicTextArea
			tabIndex={0}
			ref={ref}
			id={CHAT_BOX_INPUT_ID}
			value={props.value}
			disabled={props.disabled || props.isRequestRunning}
			onChange={props.onChange}
			onKeyDown={props.onKeyDown}
			onFocus={props.onFocus}
			onBlur={props.onBlur}
			onPaste={props.onPaste}
			placeholder={`Type your task or use @ to mention files or folders or URLs`}
			maxRows={10}
			className="!overflow-y-auto !min-h-[64px]"
			autoFocus={true}
			style={{
				width: "100%",
				padding: "8px 16px",
				boxSizing: "border-box",
				backgroundColor: "var(--vscode-input-background)",
				color: "var(--vscode-input-foreground)",
				borderRadius: 2,
				fontFamily: "var(--vscode-font-family)",
				resize: "none",
				overflow: "hidden",
				cursor: props.disabled ? "not-allowed" : undefined,
				flex: 1,
			}}
		/>
	)
})

InputTextArea.displayName = "InputTextArea"

export default InputTextArea
