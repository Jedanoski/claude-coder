import React from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "../../utils/vscode"
import VSCodeButtonLink from "../VSCodeButtonLink/VSCodeButtonLink"
import { formatPrice } from "./utils"
import { getKoduAddCreditsUrl, getKoduReferUrl, getKoduSignInUrl } from "../../../../src/shared/kodu"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface UserInfoProps {
	user: any
	uriScheme?: string
	setDidAuthKodu?: React.Dispatch<React.SetStateAction<boolean>>
}

const UserInfo: React.FC<UserInfoProps> = ({ user, uriScheme, setDidAuthKodu }) => {
	const { extensionName } = useExtensionState()
	if (user !== undefined) {
		return (
			<>
				<div style={{ marginBottom: 5, marginTop: 3 }}>
					<span style={{ color: "var(--vscode-descriptionForeground)" }}>
						Signed in as {user?.email || "Unknown"}
					</span>{" "}
					<VSCodeLink
						style={{ display: "inline" }}
						onClick={() => vscode.postMessage({ type: "didClickKoduSignOut" })}>
						(sign out?)
					</VSCodeLink>
				</div>
				<div style={{ marginBottom: 7 }}>
					Credits remaining:{" "}
					<span style={{ fontWeight: 500, opacity: user !== undefined ? 1 : 0.6 }}>
						{formatPrice(user?.credits || 0)}
					</span>
				</div>
				<div
					style={{
						display: "flex",
						flexWrap: "wrap",
						gap: 10,
						marginBottom: 5,
					}}>
					<VSCodeButtonLink
						onClick={() => {
							vscode.postMessage({ type: "amplitude", event_type: "Referral Program" })
						}}
						href={getKoduReferUrl(uriScheme)}
						style={{
							width: "fit-content",
							marginRight: 10,
						}}>
						Referral Program
					</VSCodeButtonLink>
					<VSCodeButtonLink
						onClick={() => {
							vscode.postMessage({ type: "amplitude", event_type: "Add Credits" })
						}}
						href={getKoduAddCreditsUrl(uriScheme)}
						style={{
							width: "fit-content",
						}}>
						Add Credits
					</VSCodeButtonLink>
				</div>
			</>
		)
	} else {
		return (
			<div style={{ margin: "4px 0px" }}>
				<VSCodeButtonLink
					href={getKoduSignInUrl(uriScheme, extensionName)}
					onClick={() => {
						vscode.postMessage({ type: "amplitude", event_type: "Auth Start" })
						setDidAuthKodu?.(true)
					}}>
					Sign in to Kodu
				</VSCodeButtonLink>
			</div>
		)
	}
}

export default UserInfo
