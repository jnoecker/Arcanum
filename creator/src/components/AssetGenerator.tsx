import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useFocusTrap } from "@/lib/useFocusTrap";

const GENERATION_MESSAGES = [
  "The Arcanum renders your vision...",
  "Weaving light from the void...",
  "Shaping form from the aether...",
  "Distilling essence into image...",
  "The cosmos aligns to your intent...",
  "Drawing pigment from starlight...",
  "Illuminating the unseen...",
];
import {
  ASSET_TEMPLATES,
  getPreamble,
  getEnhanceSystemPrompt,
  composePrompt,
  ART_STYLE_LABELS,
  UNIVERSAL_NEGATIVE,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import { IMAGE_MODELS } from "@/types/assets";
import type { AssetType, GeneratedImage } from "@/types/assets";
import loadingVignette from "@/assets/loading-vignette.jpg";

type Stage = "compose" | "generating" | "preview";

export function AssetGenerator() {
  const settings = useAssetStore((s) => s.settings);
  const closeGenerator = useAssetStore((s) => s.closeGenerator);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const updateConfig = useConfigStore((s) => s.updateConfig);

  const [stage, setStage] = useState<Stage>("compose");
  const [artStyle] = useState<ArtStyle>("gentle_magic");
  const [assetType, setAssetType] = useState<AssetType>("background");
  const [modelId, setModelId] = useState<string>(() => {
    const provider = settings?.image_provider ?? "deepinfra";
    return IMAGE_MODELS.find((m) => m.provider === provider)?.id ?? IMAGE_MODELS[0].id;
  });
  const [customization, setCustomization] = useState("");
  const [prompt, setPrompt] = useState(() => composePrompt("background", "gentle_magic"));
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(closeGenerator);

  // Rotate through atmospheric messages during generation
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    if (stage !== "generating") { setMsgIndex(0); return; }
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % GENERATION_MESSAGES.length), 3500);
    return () => clearInterval(id);
  }, [stage]);
  const [accepting, setAccepting] = useState(false);

  // Global asset key (if user wants to save as a config global asset)
  const [globalAssetKey, setGlobalAssetKey] = useState("");

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0)
  );

  const handleTypeChange = (type: AssetType) => {
    setAssetType(type);
    setPrompt(composePrompt(type, artStyle, customization || undefined));
    setEnhancedPrompt("");
    setUseEnhanced(false);
  };

  const handleCustomizationChange = (value: string) => {
    setCustomization(value);
    setPrompt(composePrompt(assetType, artStyle, value || undefined));
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const preamble = getPreamble(artStyle);
      const systemPrompt = getEnhanceSystemPrompt(artStyle);
      const result = await invoke<string>("enhance_prompt", {
        prompt: `${preamble}\n\n${prompt}`,
        systemPrompt,
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
      const preamble = getPreamble(artStyle);
      const finalPrompt = useEnhanced && enhancedPrompt
        ? enhancedPrompt
        : `${preamble}\n\n${prompt}`;

      const model = IMAGE_MODELS.find((m) => m.id === modelId);
      const guidance = model && "defaultGuidance" in model
        ? (model as { defaultGuidance: number }).defaultGuidance
        : null;

      const command = imageProvider === "runware" ? "runware_generate_image" : "generate_image";
      const image = await invoke<GeneratedImage>(command, {
        prompt: finalPrompt,
        negativePrompt: UNIVERSAL_NEGATIVE,
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

      // Save as global asset in config if key is provided
      if (globalAssetKey.trim()) {
        const latestConfig = useConfigStore.getState().config;
        if (latestConfig) {
          const key = globalAssetKey.trim().toLowerCase().replace(/\s+/g, "_");
          const fileName = result.file_path.split(/[\\/]/).pop() ?? result.hash;
          updateConfig({
            ...latestConfig,
            globalAssets: { ...latestConfig.globalAssets, [key]: fileName },
          });
        }
      }

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
        <div ref={trapRef} role="alertdialog" aria-modal="true" className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl">
          <div className="border-b border-border-default px-5 py-3">
            <h2 className="font-display text-sm tracking-wide text-text-primary">
              API Key Required
            </h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-text-secondary">
              Set an image provider API key in Config &rarr; API Settings before generating assets.
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
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="asset-gen-title" className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 id="asset-gen-title" className="font-display text-sm tracking-wide text-text-primary">
            Generate Art
          </h2>
          <button
            aria-label="Close"
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
              <div className="rounded-lg border border-border-default/60 bg-bg-primary/60 px-3 py-2">
                <div className="font-display text-2xs uppercase tracking-widest text-text-muted">
                  Style System
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {ART_STYLE_LABELS[artStyle]}
                </div>
              </div>

              {/* Asset type */}
              <div>
                <label className="mb-1 block font-display text-2xs uppercase tracking-widest text-text-muted">
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
                <label className="mb-1 block font-display text-2xs uppercase tracking-widest text-text-muted">
                  Model
                </label>
                <div className="flex gap-2">
                  {IMAGE_MODELS.filter((m) => m.provider === imageProvider).map((model) => (
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
                      <div className="text-2xs opacity-70">{model.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customization */}
              <div>
                <label className="mb-1 block font-display text-2xs uppercase tracking-widest text-text-muted">
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
                  <label className="font-display text-2xs uppercase tracking-widest text-text-muted">
                    Prompt
                  </label>
                  <button
                    onClick={handleEnhance}
                    disabled={enhancing}
                    className="ml-auto rounded px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
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
                      className={`text-2xs ${useEnhanced ? "text-accent" : "text-text-muted hover:text-text-secondary"}`}
                    >
                      Enhanced
                    </button>
                    <button
                      onClick={() => setUseEnhanced(false)}
                      className={`text-2xs ${!useEnhanced ? "text-accent" : "text-text-muted hover:text-text-secondary"}`}
                    >
                      Original
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs italic text-status-error">Generation failed: {error}</p>
              )}
            </div>
          )}

          {stage === "generating" && (
            <div className="relative flex flex-col items-center justify-center gap-4 py-12 overflow-hidden rounded-lg">
              <img
                src={loadingVignette}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-secondary via-bg-secondary/70 to-bg-secondary/50" />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-slow-rotate rounded-full border-2 border-accent/60 border-t-accent" />
                <p className="font-display text-sm tracking-wide text-text-secondary transition-opacity duration-700">
                  {GENERATION_MESSAGES[msgIndex]}
                </p>
              </div>
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

              {/* Save as global asset option */}
              <div>
                <label className="mb-1 block font-display text-2xs uppercase tracking-widest text-text-muted">
                  Save as Global Asset (optional)
                </label>
                <input
                  type="text"
                  value={globalAssetKey}
                  onChange={(e) => setGlobalAssetKey(e.target.value)}
                  placeholder="e.g. compass_rose, login_splash, world_map"
                  className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
                />
                <p className="mt-0.5 text-2xs text-text-muted">
                  Enter a key name to register this asset in application.yaml under images.globalAssets
                </p>
              </div>

              {error && (
                <p className="text-xs italic text-status-error">Generation failed: {error}</p>
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
