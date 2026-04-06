import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitTextarea } from "@/components/ui/FormWidgets";
import { getLoreEnhancePrompt } from "@/lib/lorePrompts";

interface LoreTextAreaProps {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  rows?: number;
  /** System prompt for generating text from scratch. */
  generateSystemPrompt?: string;
  /** User prompt builder for generation — receives current world context. */
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

  const handleGenerate = useCallback(async () => {
    if (!generateSystemPrompt || !generateUserPrompt) return;
    setLoading("generate");
    try {
      const parts = [generateUserPrompt];
      if (context) parts.push(`\nWorld context: ${context}`);
      const result = await invoke<string>("llm_complete", {
        systemPrompt: generateSystemPrompt,
        userPrompt: parts.join("\n"),
      });
      onCommit(result.trim());
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoading(null);
    }
  }, [generateSystemPrompt, generateUserPrompt, context, onCommit]);

  const handleEnhance = useCallback(async () => {
    if (!value) return;
    setLoading("enhance");
    try {
      const parts = [value];
      if (context) parts.push(`\nWorld context: ${context}`);
      const result = await invoke<string>("llm_complete", {
        systemPrompt: enhanceSystemPrompt ?? getLoreEnhancePrompt(),
        userPrompt: parts.join("\n"),
      });
      onCommit(result.trim());
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoading(null);
    }
  }, [value, enhanceSystemPrompt, context, onCommit]);

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
      {(showGenerate || showEnhance) && (
        <div className="mt-1 flex gap-2">
          {showGenerate && (
            <button
              onClick={handleGenerate}
              disabled={loading !== null}
              className="rounded px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
              title="Use AI to generate initial content"
            >
              {loading === "generate" ? "Generating..." : "Generate"}
            </button>
          )}
          {showEnhance && (
            <button
              onClick={handleEnhance}
              disabled={loading !== null}
              className="rounded px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
              title="Use AI to expand and enrich this text"
            >
              {loading === "enhance" ? "Enhancing..." : "Enhance"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
