import type { ModelProvider } from "../contracts/types.js";

export type CognitiveApiMode = "chat_completions" | "responses" | "anthropic_messages";

export type CognitiveProviderRuntime = {
  provider: ModelProvider;
  model: string;
  apiMode: CognitiveApiMode;
  credentialSource: "configured" | "environment" | "oauth" | "none";
  auxiliary: boolean;
  fallbackProviders: ModelProvider[];
};

const DEFAULT_MODELS: Record<ModelProvider, string> = {
  gpt: "gpt-5.4",
  claude: "claude-opus-4.1",
  gemini: "gemini-2.5-pro",
};

function apiModeForProvider(provider: ModelProvider): CognitiveApiMode {
  if (provider === "claude") {
    return "anthropic_messages";
  }
  if (provider === "gpt") {
    return "responses";
  }
  return "chat_completions";
}

export function resolveCognitiveProviderRuntime(input: {
  provider: ModelProvider;
  modelOverride?: string;
  auxiliary?: boolean;
  fallbackProviders?: ModelProvider[];
}): CognitiveProviderRuntime {
  return {
    provider: input.provider,
    model: input.modelOverride?.trim() || DEFAULT_MODELS[input.provider],
    apiMode: apiModeForProvider(input.provider),
    credentialSource: "configured",
    auxiliary: input.auxiliary === true,
    fallbackProviders: input.fallbackProviders ?? [],
  };
}

export function defaultModelForProvider(provider: ModelProvider): string {
  return DEFAULT_MODELS[provider];
}
