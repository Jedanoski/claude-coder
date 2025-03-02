import { teachingBotConfig } from "./teaching-bot"
import { deepseekConfig } from "./deepseek"
import { openaiConfig } from "./openai"
import { koduConfig } from "./kodu"
import { PROVIDER_IDS } from "../constants"
import { ProviderConfig } from "../types"
import { googleGenAIConfig } from "./google-genai"
import { openaiCompatible } from "./openai-compatible"
import { mistralConfig } from "./mistral"
import { anthropicConfig } from "./anthropic"

export const providerConfigs: Record<string, ProviderConfig> = {
	[PROVIDER_IDS.KODU]: koduConfig,
	[PROVIDER_IDS.DEEPSEEK]: deepseekConfig,
	[PROVIDER_IDS.OPENAI]: openaiConfig,
	[PROVIDER_IDS.GOOGLE_GENAI]: googleGenAIConfig,
	[PROVIDER_IDS.OPENAICOMPATIBLE]: openaiCompatible,
	[PROVIDER_IDS.MISTRAL]: mistralConfig,
	[PROVIDER_IDS.ANTHROPIC]: anthropicConfig,
	[PROVIDER_IDS.TEACHING_BOT]: teachingBotConfig,
	// Add other providers here as they're created
}

export const customProvidersConfigs: Record<string, ProviderConfig> = Object.fromEntries(
	Object.entries(providerConfigs).filter(([providerId]) => providerId !== PROVIDER_IDS.KODU)
)

export const models = Object.values(providerConfigs).flatMap((provider) => provider.models)

export type ProviderConfigs = typeof providerConfigs

// Helper function to get a specific provider config
export const getProviderConfig = (providerId: string): ProviderConfig | undefined => {
	return providerConfigs[providerId]
}

// Helper function to get a specific model from a provider
export const getModelConfig = (providerId: string, modelId: string) => {
	const provider = providerConfigs[providerId]
	if (!provider) {
		return undefined
	}
	return provider.models.find((model) => model.id === modelId)
}
