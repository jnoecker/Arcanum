import type { Settings } from "@/types/assets";

export function getPromptLlmConfigurationError(settings: Settings | null | undefined): string | null {
  if (!settings) return null;

  switch (settings.prompt_llm_provider) {
    case "anthropic":
      return settings.anthropic_api_key.trim()
        ? null
        : "Anthropic API key not configured. Set it in Settings.";
    case "openrouter":
      return settings.openrouter_api_key.trim()
        ? null
        : "OpenRouter API key not configured. Set it in Settings.";
    case "deepinfra":
    default:
      return settings.deepinfra_api_key.trim()
        ? null
        : "DeepInfra API key not configured. Set it in Settings.";
  }
}

export function hasPromptLlmConfigured(settings: Settings | null | undefined): boolean {
  return getPromptLlmConfigurationError(settings) === null;
}
