import React, { useCallback, useEffect, useMemo, useState } from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useEvent } from "react-use"
import { koduModels } from "../../../../src/shared/api"
import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { getKoduHomepageUrl } from "../../../../src/shared/kodu"
import { vscode } from "../../utils/vscode"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { ApiConfiguration } from "../../../../src/api"
import UserInfo from "./UserInfo"
import ModelDropdown from "./ModelDropdown"
import ModelInfoView from "./ModelInfoView"
import { normalizeApiConfiguration } from "./utils"

interface ApiOptionsProps {
	showModelOptions: boolean
	setDidAuthKodu?: React.Dispatch<React.SetStateAction<boolean>>
}

const ApiOptions: React.FC<ApiOptionsProps> = ({ showModelOptions, setDidAuthKodu }) => {
	const { apiConfiguration, setApiConfiguration, user, uriScheme } = useExtensionState()
	const [, setDidFetchKoduCredits] = useState(false)

	const handleInputChange = (field: keyof ApiConfiguration) => (event: any) => {
		setApiConfiguration({ ...apiConfiguration, [field]: event.target.value })
	}

	const { selectedProvider, selectedModelId, selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	useEffect(() => {
		console.log(`user`, user)
		if (user === undefined) {
			setDidFetchKoduCredits(false)
			vscode.postMessage({ type: "fetchKoduCredits" })
		}
	}, [selectedProvider, user])

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "action":
				switch (message.action) {
					case "koduCreditsFetched":
						setDidFetchKoduCredits(true)
						break
				}
				break
		}
	}, [])
	useEvent("message", handleMessage)

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
			<UserInfo user={user} uriScheme={uriScheme} setDidAuthKodu={setDidAuthKodu} />
			<div
				style={{
					fontSize: 12,
					marginTop: 0,
					color: "var(--vscode-descriptionForeground)",
				}}>
				Kodu is recommended for its high rate limits and access to the latest features like prompt caching.
				<VSCodeLink href={getKoduHomepageUrl()} style={{ display: "inline", fontSize: "12px" }}>
					Learn more about Kodu here.
				</VSCodeLink>
			</div>

			{showModelOptions && (
				<>
					<div className="dropdown-container">
						<label htmlFor="model-id">
							<span style={{ fontWeight: 500 }}>Model</span>
						</label>
						{selectedProvider === "kodu" && (
							<ModelDropdown
								selectedModelId={selectedModelId}
								models={koduModels}
								onChange={handleInputChange("apiModelId")}
							/>
						)}
					</div>

					<ModelInfoView modelInfo={selectedModelInfo} />
				</>
			)}
		</div>
	)
}

export default ApiOptions
