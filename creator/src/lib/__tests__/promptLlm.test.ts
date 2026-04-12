import { describe, expect, it } from "vitest";
import { getPromptLlmConfigurationError, hasPromptLlmConfigured } from "../promptLlm";
import type { Settings } from "@/types/assets";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    deepinfra_api_key: "",
    runware_api_key: "",
    anthropic_api_key: "",
    openrouter_api_key: "",
    openai_api_key: "",
    image_model: "black-forest-labs/FLUX-1-dev",
    enhance_model: "Qwen/Qwen2.5-7B-Instruct",
    prompt_llm_provider: "deepinfra",
    image_provider: "deepinfra",
    video_model: "pixverse:1@8",
    batch_concurrency: 12,
    auto_enhance_prompts: true,
    auto_remove_bg: false,
    r2_account_id: "",
    r2_access_key_id: "",
    r2_secret_access_key: "",
    r2_bucket: "",
    r2_custom_domain: "",
    github_pat: "",
    ...overrides,
  };
}

describe("promptLlm", () => {
  it("requires the configured DeepInfra key", () => {
    const settings = makeSettings({
      prompt_llm_provider: "deepinfra",
      anthropic_api_key: "anthropic-key",
    });

    expect(getPromptLlmConfigurationError(settings)).toBe("DeepInfra API key not configured. Set it in Settings.");
    expect(hasPromptLlmConfigured(settings)).toBe(false);
  });

  it("requires the configured Anthropic key", () => {
    const settings = makeSettings({
      prompt_llm_provider: "anthropic",
      deepinfra_api_key: "deepinfra-key",
    });

    expect(getPromptLlmConfigurationError(settings)).toBe("Anthropic API key not configured. Set it in Settings.");
    expect(hasPromptLlmConfigured(settings)).toBe(false);
  });

  it("accepts a configured OpenRouter key", () => {
    const settings = makeSettings({
      prompt_llm_provider: "openrouter",
      openrouter_api_key: "openrouter-key",
    });

    expect(getPromptLlmConfigurationError(settings)).toBeNull();
    expect(hasPromptLlmConfigured(settings)).toBe(true);
  });

  it("returns null before settings are loaded", () => {
    expect(getPromptLlmConfigurationError(null)).toBeNull();
    expect(hasPromptLlmConfigured(undefined)).toBe(true);
  });
});
