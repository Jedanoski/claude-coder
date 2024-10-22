import { useState, useCallback } from "react"
import { useExtensionState } from "../context/ExtensionStateContext"
import { vscode } from "../utils/vscode"
import useDebounce from "./use-debounce"
import { GlobalState } from "../../../src/providers/claude-coder/state/GlobalStateManager"

export function useSettingsState() {
	const extensionState = useExtensionState()
	const [model, setModel] = useState(extensionState.apiConfiguration?.apiModelId || "claude-3-5-sonnet-20240620")
	const [technicalLevel, setTechnicalLevel] = useState(extensionState.technicalBackground)
	const [readOnly, setReadOnly] = useState(extensionState.alwaysAllowReadOnly || false)
	const [autoCloseTerminal, setAutoCloseTerminal] = useState(extensionState.autoCloseTerminal || false)
	const [experimentalFeatureStates, setExperimentalFeatureStates] = useState({
		alwaysAllowWriteOnly: extensionState.alwaysAllowWriteOnly || false,
		"one-click-deployment": false,
		"auto-summarize-chat": false,
	})
	const [customInstructions, setCustomInstructions] = useState(extensionState.customInstructions || "")
	const [autoSkipWrite, setAutoSkipWrite] = useState(extensionState.skipWriteAnimation || false)

	const handleAutoSkipWriteChange = useCallback((checked: boolean) => {
		setAutoSkipWrite(checked)
		vscode.postMessage({ type: "skipWriteAnimation", bool: checked })
	}, [])

	const handleExperimentalFeatureChange = useCallback(
		(featureId: keyof GlobalState, checked: boolean) => {
			setExperimentalFeatureStates((prev) => {
				const newState = { ...prev, [featureId]: checked }
				if (featureId === "alwaysAllowWriteOnly") {
					extensionState.setAlwaysAllowWriteOnly(checked)
					vscode.postMessage({ type: "alwaysAllowWriteOnly", bool: checked })
				}
				return newState
			})
		},
		[extensionState]
	)

	const handleTechnicalLevelChange = useCallback((setLevel: typeof technicalLevel) => {
		console.log(`Setting technical level to: ${setLevel}`)
		setTechnicalLevel(setLevel!)
		vscode.postMessage({ type: "technicalBackground", value: setLevel! })
	}, [])

	const handleModelChange = useCallback((newModel: typeof model) => {
		setModel(newModel!)
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration: { apiModelId: newModel } })
	}, [])

	const handleSetReadOnly = useCallback((checked: boolean) => {
		setReadOnly(checked)
		vscode.postMessage({ type: "alwaysAllowReadOnly", bool: checked })
	}, [])

	const handleSetAutoCloseTerminal = useCallback((checked: boolean) => {
		setAutoCloseTerminal(checked)
		vscode.postMessage({ type: "autoCloseTerminal", bool: checked })
	}, [])

	useDebounce(customInstructions, 250, (val) => {
		if (val === extensionState.customInstructions) return
		extensionState.setCustomInstructions(val)
		vscode.postMessage({ type: "customInstructions", text: val })
	})

	return {
		model,
		technicalLevel,
		readOnly,
		autoCloseTerminal,
		experimentalFeatureStates,
		customInstructions,
		autoSkipWrite,
		handleAutoSkipWriteChange,
		handleExperimentalFeatureChange,
		handleTechnicalLevelChange,
		handleModelChange,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		setCustomInstructions,
	}
}
