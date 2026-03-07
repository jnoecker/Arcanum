import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import {
  ASSET_TEMPLATES,
  ARCANUM_PREAMBLE,
  ENHANCE_SYSTEM_PROMPT,
  composePrompt,
} from "@/lib/arcanumPrompts";
import { IMAGE_MODELS } from "@/types/assets";
import type { AssetType, GeneratedImage } from "@/types/assets";

type Stage = "compose" | "generating" | "preview";

export function AssetGenerator() {
  const settings = useAssetStore((s) => s.settings);
  const closeGenerator = useAssetStore((s) => s.closeGenerator);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const [stage, setStage] = useState<Stage>("compose");
  const [assetType, setAssetType] = useState<AssetType>("background");
  const [modelId, setModelId] = useState<string>(IMAGE_MODELS[0].id);
  const [customization, setCustomization] = useState("");
  const [prompt, setPrompt] = useState(() => composePrompt("background"));
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const hasApiKey = settings && settings.deepinfra_api_key.length > 0;

  const handleTypeChange = (type: AssetType) => {
    setAssetType(type);
    setPrompt(composePrompt(type, customization || undefined));
    setEnhancedPrompt("");
    setUseEnhanced(false);
  };

  const handleCustomizationChange = (value: string) => {
    setCustomization(value);
    setPrompt(composePrompt(assetType, value || undefined));
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const result = await invoke<string>("enhance_prompt", {
        prompt: `${ARCANUM_PREAMBLE}\n\n${prompt}`,
        systemPrompt: ENHANCE_SYSTEM_PROMPT,
      });
      setEnhancedPrompt(result);
      setUseEnhanced(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    setStage("generating");
    setError(null);
    try {
      const finalPrompt = useEnhanced && enhancedPrompt
        ? enhancedPrompt
        : `${ARCANUM_PREAMBLE}\n\n${prompt}`;

      const model = IMAGE_MODELS.find((m) => m.id === modelId);
      const guidance = model && "defaultGuidance" in model
        ? (model as { defaultGuidance: number }).defaultGuidance
        : null;

      const image = await invoke<GeneratedImage>("generate_image", {
        prompt: finalPrompt,
        model: modelId,
        width: 1024,
        height: 1024,
        steps: model?.defaultSteps ?? null,
        guidance,
      });
      setResult(image);
      setStage("preview");
    } catch (e) {
      setError(String(e));
      setStage("compose");
    }
  };

  const handleAccept = async () => {
    if (!result) return;
    setAccepting(true);
    try {
      await acceptAsset(
        result,
        assetType,
        useEnhanced ? enhancedPrompt : undefined,
      );
      closeGenerator();
    } catch (e) {
      setError(String(e));
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = () => {
    setResult(null);
    setStage("compose");
  };

  if (!hasApiKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl">
          <div className="border-b border-border-default px-5 py-3">
            <h2 className="font-display text-sm tracking-wide text-text-primary">
              API Key Required
            </h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-text-secondary">
              Set your DeepInfra API key in Config &rarr; API Settings before generating assets.
            </p>
          </div>
          <div className="flex justify-end border-t border-border-default px-5 py-3">
            <button
              onClick={closeGenerator}
              className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="font-display text-sm tracking-wide text-text-primary">
            Generate Arcanum Art
          </h2>
          <button
            onClick={closeGenerator}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {stage === "compose" && (
            <div className="flex flex-col gap-4">
              {/* Asset type */}
              <div>
                <label className="mb-1 block font-display text-[10px] uppercase tracking-widest text-text-muted">
                  Asset Type
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(ASSET_TEMPLATES) as [AssetType, { label: string }][]).map(
                    ([key, { label }]) => (
                      <button
                        key={key}
                        onClick={() => handleTypeChange(key)}
                        className={`rounded px-2.5 py-1 text-xs transition-colors ${
                          assetType === key
                            ? "bg-accent/20 text-accent"
                            : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="mb-1 block font-display text-[10px] uppercase tracking-widest text-text-muted">
                  Model
                </label>
                <div className="flex gap-2">
                  {IMAGE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setModelId(model.id)}
                      className={`flex-1 rounded px-3 py-1.5 text-left text-xs transition-colors ${
                        modelId === model.id
                          ? "bg-accent/20 text-accent"
                          : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <div className="font-medium">{model.label}</div>
                      <div className="text-[10px] opacity-70">{model.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customization */}
              <div>
                <label className="mb-1 block font-display text-[10px] uppercase tracking-widest text-text-muted">
                  Customization (optional)
                </label>
                <input
                  type="text"
                  value={customization}
                  onChange={(e) => handleCustomizationChange(e.target.value)}
                  placeholder="Add specific details, e.g. 'forest clearing with ancient ruins'"
                  className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
                />
              </div>

              {/* Prompt preview */}
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <label className="font-display text-[10px] uppercase tracking-widest text-text-muted">
                    Prompt
                  </label>
                  <button
                    onClick={handleEnhance}
                    disabled={enhancing}
                    className="ml-auto rounded px-2 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                  >
                    {enhancing ? "Enhancing..." : "Enhance with AI"}
                  </button>
                </div>
                <textarea
                  value={useEnhanced && enhancedPrompt ? enhancedPrompt : prompt}
                  onChange={(e) => {
                    if (useEnhanced) {
                      setEnhancedPrompt(e.target.value);
                    } else {
                      setPrompt(e.target.value);
                    }
                  }}
                  rows={5}
                  className="w-full resize-y rounded border border-border-default bg-bg-primary px-3 py-2 font-mono text-xs leading-relaxed text-text-secondary outline-none focus:border-accent/50"
                />
                {enhancedPrompt && (
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => setUseEnhanced(true)}
                      className={`text-[10px] ${useEnhanced ? "text-accent" : "text-text-muted hover:text-text-secondary"}`}
                    >
                      Enhanced
                    </button>
                    <button
                      onClick={() => setUseEnhanced(false)}
                      className={`text-[10px] ${!useEnhanced ? "text-accent" : "text-text-muted hover:text-text-secondary"}`}
                    >
                      Original
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs italic text-status-error">{error}</p>
              )}
            </div>
          )}

          {stage === "generating" && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="font-display text-sm tracking-wide text-text-secondary">
                Generating...
              </p>
              <p className="text-xs text-text-muted">
                This may take a few seconds
              </p>
            </div>
          )}

          {stage === "preview" && result && (
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-lg border border-border-default">
                <img
                  src={result.data_url}
                  alt="Generated art"
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>{result.width}x{result.height}</span>
                <span>&middot;</span>
                <span>{result.model.split("/").pop()}</span>
              </div>
              {error && (
                <p className="text-xs italic text-status-error">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          {stage === "compose" && (
            <>
              <button
                onClick={closeGenerator}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110"
              >
                Generate
              </button>
            </>
          )}
          {stage === "preview" && (
            <>
              <button
                onClick={handleReject}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Reject &amp; Retry
              </button>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:opacity-50"
              >
                {accepting ? "Saving..." : "Accept"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
