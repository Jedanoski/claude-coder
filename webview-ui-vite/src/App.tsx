import { useCallback, useMemo, useState } from "react"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../src/shared/ExtensionMessage"
import { ExtensionStateProvider, useExtensionState } from "./context/ExtensionStateContext"
import { vscode } from "./utils/vscode"
import { normalizeApiConfiguration } from "./components/ApiOptions/utils"
import ChatView from "./components/ChatView/ChatView"
import HistoryView from "./components/HistoryView/HistoryView"
import SettingsView from "./components/SettingsView/SettingsView"
import WelcomeView from "./WelcomeView"
import { DevTools } from "jotai-devtools"
import "jotai-devtools/styles.css"
import "./App.css"
import { Button } from "@/components/ui/button"
const AppContent = () => {
	const { apiConfiguration } = useExtensionState()
	const [showSettings, setShowSettings] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [showWelcome, setShowWelcome] = useState<boolean>(false)
	const [showAnnouncement, setShowAnnouncement] = useState(false)

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "state":
				const hasKey = !!message.state?.user
				console.log(`hasKey: ${hasKey}`)
				setShowWelcome(!hasKey)
				// don't update showAnnouncement to false if shouldShowAnnouncement is false
				if (message.state!.shouldShowAnnouncement) {
					setShowAnnouncement(true)
				}
				break
			case "action":
				switch (message.action!) {
					case "settingsButtonTapped":
						setShowSettings(true)
						setShowHistory(false)
						break
					case "historyButtonTapped":
						setShowSettings(false)
						setShowHistory(true)
						break
					case "chatButtonTapped":
						setShowSettings(false)
						setShowHistory(false)
						break
					case "koduAuthenticated":
						console.log(`koduAuthenticated`)
						setShowWelcome(false)
						break
				}
				break
		}
		// (react-use takes care of not registering the same listener multiple times even if this callback is updated.)
	}, [])

	useEvent("message", handleMessage)

	const { selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	return (
		<>
			{showWelcome ? (
				<WelcomeView />
			) : (
				<>
					{showSettings && <SettingsView onDone={() => setShowSettings(false)} />}
					{showHistory && <HistoryView onDone={() => setShowHistory(false)} />}
					{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose (user input, disableInput, askResponse promise, etc.) */}
					<ChatView
						showHistoryView={() => {
							setShowSettings(false)
							setShowHistory(true)
						}}
						isHidden={showSettings || showHistory}
						showAnnouncement={showAnnouncement}
						selectedModelSupportsImages={selectedModelInfo.supportsImages}
						selectedModelSupportsPromptCache={selectedModelInfo.supportsPromptCache}
						hideAnnouncement={() => {
							vscode.postMessage({ type: "didCloseAnnouncement" })
							setShowAnnouncement(false)
						}}
					/>
				</>
			)}
		</>
	)
}

const App = () => {
	return (
		<>
			{/* <DevTools /> */}

			<ExtensionStateProvider>
				<AppContent />
			</ExtensionStateProvider>
		</>
	)
}

export default App
