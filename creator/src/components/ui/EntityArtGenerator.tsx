import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useImageSrc, isLegacyImagePath } from "@/lib/useImageSrc";
import { getEnhanceSystemPrompt, ART_STYLE_LABELS, UNIVERSAL_NEGATIVE, type ArtStyle } from "@/lib/arcanumPrompts";
import { IMAGE_MODELS, ENTITY_DIMENSIONS, DIMENSION_PRESETS } from "@/types/assets";
import type { AssetContext, GeneratedImage } from "@/types/assets";
import { VariantStrip } from "./VariantStrip";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";

type Stage = "idle" | "generating" | "preview";

interface EntityArtGeneratorProps {
  /** Returns the fallback prompt template for the given art style (used when no LLM available) */
  getPrompt: (style: ArtStyle) => string;
  /** Rich entity context description for the LLM to craft an image prompt from */
  entityContext?: string;
  /** Current image value (path or URL) */
  currentImage?: string;
  /** Called when user accepts a generated image */
  onAccept: (filePath: string) => void;
  /** Asset type for manifest (e.g. "entity_portrait", "background") */
  assetType?: string;
  /** Context tags for the asset manifest */
  context?: AssetContext;
  /** Zone vibe text to inject into LLM prompt generation */
  vibe?: string;
}

function computeVariantGroup(context?: AssetContext): string {
  if (!context) return "";
  const { entity_type, zone, entity_id } = context;
  if (!entity_type || !entity_id) return "";
  return `${entity_type}:${zone}:${entity_id}`;
}

export function EntityArtGenerator({
  getPrompt,
  entityContext,
  currentImage,
  onAccept,
  assetType,
  context,
  vibe,
}: EntityArtGeneratorProps) {
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const importAsset = useAssetStore((s) => s.importAsset);
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dimOverride, setDimOverride] = useState<{ width: number; height: number } | null>(null);
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState("");
  // Track the final prompt that was actually sent to the image model
  const [lastEnhancedPrompt, setLastEnhancedPrompt] = useState<string | null>(null);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0)
  );
  const hasLlmKey = settings && (
    settings.deepinfra_api_key.length > 0 ||
    settings.anthropic_api_key.length > 0 ||
    settings.openrouter_api_key.length > 0
  );
  const basePrompt = getPrompt(artStyle);
  const activePrompt = editedPrompt ?? basePrompt;
  const variantGroup = computeVariantGroup(context);

  // Determine dimensions from entity type
  const entityType = context?.entity_type ?? "";
  const defaultDims = ENTITY_DIMENSIONS[entityType] ?? { width: 1024, height: 1024, label: "1024×1024" };
  const activeDims = dimOverride ?? defaultDims;

  // Filter models by configured provider
  const availableModels = useMemo(
    () => IMAGE_MODELS.filter((m) => m.provider === imageProvider),
    [imageProvider],
  );

  // Auto-import legacy images
  const importedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentImage || !mudDir || !isLegacyImagePath(currentImage)) return;
    if (importedRef.current.has(currentImage)) return;
    importedRef.current.add(currentImage);

    const candidates = [
      `${mudDir}/src/main/resources/world/images/${currentImage}`,
      `${mudDir}/src/main/resources/images/${currentImage}`,
    ];
    (async () => {
      for (const sourcePath of candidates) {
        try {
          await importAsset(
            sourcePath,
            assetType ?? "background",
            context,
            variantGroup || undefined,
            Boolean(variantGroup),
          );
          return;
        } catch {
          // Try next candidate
        }
      }
    })();
  }, [currentImage, mudDir, assetType, context, importAsset]);

  /** Enhance a prompt via LLM, injecting entity context, style guide, and zone vibe. */
  const enhancePrompt = async (prompt: string): Promise<string> => {
    const systemPrompt = getEnhanceSystemPrompt(artStyle);
    const parts: string[] = [];

    // When we have rich entity context, lead with that so the LLM
    // prioritizes the actual entity description over the style template
    if (entityContext) {
      parts.push(`Generate an image prompt for this entity:\n${entityContext}`);
      if (vibe) {
        parts.push(`\nZone atmosphere/vibe:\n${vibe}`);
      }
      parts.push(`\nReference style template (adapt but prioritize the entity description above):\n${prompt}`);
    } else {
      parts.push(prompt);
      if (vibe) {
        parts.push(`\nZone atmosphere/vibe to weave into the image prompt:\n${vibe}`);
      }
    }

    const userPrompt = parts.join("\n");
    return invoke<string>("llm_complete", { systemPrompt, userPrompt });
  };

  const handleGenerate = async () => {
    setStage("generating");
    setError(null);
    try {
      const selectedModel = modelOverride === "__custom__"
        ? customModel.trim()
        : modelOverride;
      const model = selectedModel
        ? availableModels.find((m) => m.id === selectedModel)
        : availableModels[0];
      const modelId = selectedModel || model?.id;
      if (!modelId) {
        throw new Error(`No models available for provider: ${imageProvider}`);
      }

      // Auto-enhance via LLM if available — this is the key change.
      // The LLM gets the entity description, style guide, and zone vibe
      // and crafts a proper image prompt from all three.
      let finalPrompt = activePrompt;
      if (hasLlmKey) {
        try {
          finalPrompt = await enhancePrompt(activePrompt);
          setLastEnhancedPrompt(finalPrompt);
        } catch {
          // Fall back to base prompt if LLM fails
        }
      }

      const command = imageProvider === "runware"
        ? "runware_generate_image"
        : "generate_image";

      const image = await invoke<GeneratedImage>(command, {
        prompt: finalPrompt,
        negativePrompt: UNIVERSAL_NEGATIVE,
        model: modelId,
        width: activeDims.width,
        height: activeDims.height,
        steps: model?.defaultSteps ?? 28,
        guidance: model && "defaultGuidance" in model ? model.defaultGuidance : null,
      });
      setResult(image);
      setStage("preview");
    } catch (e) {
      setError(String(e));
      setStage("idle");
    }
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const enhanced = await enhancePrompt(activePrompt);
      setEditedPrompt(enhanced);
    } catch (e) {
      setError(String(e));
    } finally {
      setEnhancing(false);
    }
  };

  const handlePickImage = async () => {
    const path = await open({
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      multiple: false,
    });
    if (!path) return;

    setImporting(true);
    setError(null);
    try {
      const entry = await importAsset(
        path,
        assetType ?? "background",
        context,
        variantGroup || undefined,
        Boolean(variantGroup),
      );
      onAccept(entry.file_name);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  };

  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const handleAccept = async () => {
    if (!result) return;
    const fileName = result.file_path.split(/[\\/]/).pop() ?? result.hash;
    onAccept(fileName);
    if (assetType) {
      await acceptAsset(result, assetType, lastEnhancedPrompt ?? undefined, context, variantGroup, true).catch(() => {});

      // Auto-remove background for sprite asset types
      if (settings?.auto_remove_bg && shouldRemoveBg(assetType) && result.data_url) {
        removeBgAndSave(result.data_url, assetType, context, variantGroup).then(async (entry) => {
          if (entry) await useAssetStore.getState().loadAssets();
        });
      }
    }
    setStage("idle");
    setResult(null);
    setLastEnhancedPrompt(null);
  };

  const handleReject = () => {
    setResult(null);
    setStage("idle");
    setLastEnhancedPrompt(null);
  };

  const savedImageSrc = useImageSrc(currentImage);

  const previewSrc = stage === "preview" && result
    ? result.data_url
    : savedImageSrc;

  return (
    <div className="flex flex-col gap-2">
      {previewSrc && (
        <div className="overflow-hidden rounded border border-border-default">
          <img
            src={previewSrc}
            alt="Entity art"
            className="w-full"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Variant history strip */}
      {variantGroup && stage === "idle" && (
        <VariantStrip
          variantGroup={variantGroup}
          onSelect={(entry) => {
            onAccept(entry.file_name);
          }}
        />
      )}

      {stage === "idle" && (
        <div className="flex flex-col gap-1">
          {(hasApiKey || hasLlmKey) && (
            <div className="rounded border border-border-default/60 bg-bg-primary/60 px-2 py-1 text-[10px] text-text-secondary">
              Style system: {ART_STYLE_LABELS[artStyle]}
            </div>
          )}

          {/* Dimension override */}
          {hasApiKey && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text-muted">{activeDims.width}×{activeDims.height}</span>
              <select
                value={dimOverride ? `${dimOverride.width}x${dimOverride.height}` : ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    setDimOverride(null);
                  } else {
                    const parts = e.target.value.split("x").map(Number);
                    setDimOverride({ width: parts[0]!, height: parts[1]! });
                  }
                }}
                className="rounded border border-border-default bg-bg-primary px-1 py-0.5 text-[10px] text-text-secondary outline-none"
              >
                <option value="">Default</option>
                {DIMENSION_PRESETS.map((p) => (
                  <option key={p.label} value={`${p.width}x${p.height}`}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Model selector */}
          {hasApiKey && availableModels.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <select
                  value={modelOverride ?? ""}
                  onChange={(e) => setModelOverride(e.target.value || null)}
                  className="rounded border border-border-default bg-bg-primary px-1 py-0.5 text-[10px] text-text-secondary outline-none"
                >
                  <option value="">{availableModels[0]?.label ?? "Default"}</option>
                  {availableModels.slice(1).map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                  <option value="__custom__">Custom...</option>
                </select>
              </div>
              {modelOverride === "__custom__" && (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g. runware:400@2"
                  className="rounded border border-border-default bg-bg-primary px-1.5 py-0.5 font-mono text-[10px] text-text-secondary outline-none focus:border-accent/50"
                />
              )}
            </div>
          )}

          <div className="flex gap-1">
            {hasApiKey && (
              <button
                onClick={handleGenerate}
                className="flex-1 rounded bg-accent/15 px-2 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
              >
                Generate Art
              </button>
            )}
            <button
              onClick={handlePickImage}
              disabled={importing}
              className="flex-1 rounded bg-bg-elevated px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
            >
              {importing ? "Importing..." : "Pick Image"}
            </button>
            {(hasApiKey || hasLlmKey) && (
              <button
                onClick={() => setShowPrompt((v) => !v)}
                className="rounded px-1.5 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
              >
                {showPrompt ? "Hide" : "Prompt"}
              </button>
            )}
          </div>

          {showPrompt && (hasApiKey || hasLlmKey) && (
            <div className="flex flex-col gap-1">
              <textarea
                value={activePrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={4}
                className="w-full resize-y rounded border border-border-default bg-bg-primary px-2 py-1 font-mono text-[10px] leading-relaxed text-text-secondary outline-none focus:border-accent/50"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleEnhance}
                  disabled={enhancing}
                  className="rounded px-1.5 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                >
                  {enhancing ? "..." : "Enhance"}
                </button>
                {editedPrompt && (
                  <button
                    onClick={() => setEditedPrompt(null)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
                  >
                    Reset
                  </button>
                )}
              </div>
              {(entityContext || vibe) && (
                <p className="text-[10px] italic text-text-muted">
                  {hasLlmKey
                    ? "Entity details + zone vibe auto-injected during generation"
                    : "Configure an LLM provider to enable auto-enhanced prompts"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {stage === "generating" && (
        <div className="flex items-center gap-2 py-2">
          <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-[10px] text-text-secondary">
            {hasLlmKey ? "Crafting prompt & generating..." : "Generating..."}
          </span>
        </div>
      )}

      {stage === "preview" && (
        <div className="flex gap-1">
          <button
            onClick={handleAccept}
            className="flex-1 rounded bg-accent/15 px-2 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="flex-1 rounded px-2 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
          >
            Reject
          </button>
        </div>
      )}

      {error && (
        <p className="text-[10px] italic text-status-error">{error}</p>
      )}
    </div>
  );
}
