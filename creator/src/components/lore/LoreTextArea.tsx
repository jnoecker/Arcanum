import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitTextarea, InlineError } from "@/components/ui/FormWidgets";
import { getLoreEnhancePrompt } from "@/lib/lorePrompts";
import { getPromptLlmConfigurationError } from "@/lib/promptLlm";
import { useAssetStore } from "@/stores/assetStore";
import { AI_ENABLED } from "@/lib/featureFlags";

interface LoreTextAreaProps {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  rows?: number;
  /** System prompt for generating text from scratch. */
  generateSystemPrompt?: string;
  /** User prompt builder for generation - receives current world context. */
  generateUserPrompt?: string;
  /** System prompt for enhancing existing text. Defaults to getLoreEnhancePrompt(). */
  enhanceSystemPrompt?: string;
  /** Extra context appended to the user prompt. */
  context?: string;
}

/**
 * Multi-line text area with optional Generate and Enhance LLM buttons.
 * Used throughout the Lore panels for long-form writing.
 */
export function LoreTextArea({
  label,
  value,
  onCommit,
  placeholder,
  rows = 6,
  generateSystemPrompt,
  generateUserPrompt,
  enhanceSystemPrompt,
  context,
}: LoreTextAreaProps) {
  const [loading, setLoading] = useState<"generate" | "enhance" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settings = useAssetStore((s) => s.settings);
  const llmConfigurationError = getPromptLlmConfigurationError(settings);

  const handleGenerate = useCallback(async () => {
    if (!generateSystemPrompt || !generateUserPrompt) return;
    if (llmConfigurationError) {
      setError(llmConfigurationError);
      return;
    }

    setLoading("generate");
    setError(null);
    try {
      const parts = [generateUserPrompt];
      if (context) parts.push(`\nWorld context: ${context}`);
      const result = await invoke<string>("llm_complete", {
        systemPrompt: generateSystemPrompt,
        userPrompt: parts.join("\n"),
      });
      const trimmed = result.trim();
      if (!trimmed) {
        throw new Error("AI returned no content.");
      }
      onCommit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }, [context, generateSystemPrompt, generateUserPrompt, llmConfigurationError, onCommit]);

  const handleEnhance = useCallback(async () => {
    if (!value) return;
    if (llmConfigurationError) {
      setError(llmConfigurationError);
      return;
    }

    setLoading("enhance");
    setError(null);
    try {
      const parts = [value];
      if (context) parts.push(`\nWorld context: ${context}`);
      const result = await invoke<string>("llm_complete", {
        systemPrompt: enhanceSystemPrompt ?? getLoreEnhancePrompt(),
        userPrompt: parts.join("\n"),
      });
      const trimmed = result.trim();
      if (!trimmed) {
        throw new Error("AI returned no content.");
      }
      onCommit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }, [context, enhanceSystemPrompt, llmConfigurationError, onCommit, value]);

  const showGenerate = generateSystemPrompt && generateUserPrompt && !value;
  const showEnhance = !!value;

  return (
    <div>
      <CommitTextarea
        label={label}
        value={value}
        onCommit={onCommit}
        placeholder={placeholder}
        rows={rows}
      />
      {AI_ENABLED && (showGenerate || showEnhance) && (
        <div className="mt-1 flex gap-2">
          {showGenerate && (
            <button
              onClick={handleGenerate}
              disabled={loading !== null || !!llmConfigurationError}
              className="rounded px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
              title={llmConfigurationError ?? "Use AI to generate initial content"}
            >
              {loading === "generate" ? "Generating..." : "Generate"}
            </button>
          )}
          {showEnhance && (
            <button
              onClick={handleEnhance}
              disabled={loading !== null || !!llmConfigurationError}
              className="rounded px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
              title={llmConfigurationError ?? "Use AI to expand and enrich this text"}
            >
              {loading === "enhance" ? "Enhancing..." : "Enhance"}
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="mt-2">
          <InlineError error={error} onDismiss={() => setError(null)} />
        </div>
      )}
    </div>
  );
}
