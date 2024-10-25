import { koduModels, KoduModels } from "../../../../src/shared/api"
import { Badge } from "../ui/badge"
import { ExperimentalFeature } from "./types"

export const models: Record<
	keyof KoduModels,
	KoduModels[keyof KoduModels] & {
		label: string | React.ReactNode
		disabled?: boolean
		comingSoon?: boolean
		isRecommended?: boolean
		isHardWorker?: boolean
	}
> = {
	"claude-3-5-sonnet-20240620": {
		...koduModels["claude-3-5-sonnet-20240620"],
		label: "Claude 3.5 Sonnet",
		isRecommended: true,
		isHardWorker: true,
	},
	"claude-3-opus-20240229": {
		...koduModels["claude-3-opus-20240229"],
		label: "Claude 3 Opus",
	},
	"claude-3-haiku-20240307": {
		...koduModels["claude-3-haiku-20240307"],
		label: "Claude 3 Haiku",
	},
}

export const experimentalFeatures: ExperimentalFeature[] = [
	{
		id: "alwaysAllowWriteOnly",
		label: "Automatic Mode",
		description: "Claude will automatically try to solve tasks without asking for permission",
	},
	{
		id: "apiModelId",
		label: "One Click Deployment",
		description: "Deploy your projects with a single click",
		disabled: true,
		comingSoon: true,
	},
	{
		id: "lastShownAnnouncementId",
		label: "AutoSummarize Chat",
		description: "Automatically generate summaries of your chat conversations",
		disabled: true,
		comingSoon: true,
	},
]
