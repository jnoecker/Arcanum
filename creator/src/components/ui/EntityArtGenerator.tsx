import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useImageSrc, isLegacyImagePath } from "@/lib/useImageSrc";
import { getEnhanceSystemPrompt, ART_STYLE_LABELS, getNegativePrompt, getStyleSuffix, type ArtStyle } from "@/lib/arcanumPrompts";
import type { ArtStyleSurface } from "@/lib/loreGeneration";
import { IMAGE_MODELS, ENTITY_DIMENSIONS, DIMENSION_PRESETS, imageGenerateCommand, resolveImageModel, requestsTransparentBackground, modelNativelyTransparent } from "@/types/assets";
import type { AssetContext, GeneratedImage } from "@/types/assets";
import { VariantStrip } from "./VariantStrip";
import { AssetPickerModal } from "./AssetPickerModal";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";
import { InlineError } from "./FormWidgets";

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
  /** Which art-style surface to apply — "worldbuilding" for zone/entity/game art, "lore" for lore article illustrations */
  surface?: ArtStyleSurface;
}

function computeVariantGroup(context?: AssetContext): string {
  if (!context) return "";
  const { entity_type, zone, entity_id } = context;
  if (!entity_type || !entity_id) return "";
  return `${entity_type}:${zone}:${entity_id}`;
}

/** Auto-persist a generated image when the component unmounts before the user can accept. */
function autoAcceptImage(
  img: GeneratedImage,
  prompt: string | null,
  onAccept: (filePath: string) => void,
  assetType: string | undefined,
  context: AssetContext | undefined,
) {
  const fileName = img.file_path.split(/[\\/]/).pop() ?? img.hash;
  onAccept(fileName);
  if (assetType) {
    const vg = computeVariantGroup(context);
    useAssetStore.getState().acceptAsset(
      img, assetType, prompt ?? undefined, context, vg, true,
    ).catch(() => {});
  }
}

export function EntityArtGenerator({
  getPrompt,
  entityContext,
  currentImage,
  onAccept,
  assetType,
  context,
  vibe,
  surface,
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
  // Whether the current prompt has been LLM-enhanced (skip re-enhancement during generation)
  const [enhanced, setEnhanced] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);

  // Refs to track pending results across unmount — auto-accept if user navigates away
  const pendingResultRef = useRef<GeneratedImage | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;
  const assetTypeRef = useRef(assetType);
  assetTypeRef.current = assetType;
  const contextRef = useRef(context);
  contextRef.current = context;

  // Track whether the component is currently mounted so handleGenerate can
  // auto-accept results that arrive after the user navigated away. The setup
  // body must reset this to true so StrictMode's mount→cleanup→mount cycle
  // doesn't leave it stuck at false on a still-mounted component.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const img = pendingResultRef.current;
      if (!img) return;
      // Component is unmounting with an unaccepted generated image — auto-accept it
      autoAcceptImage(img, pendingPromptRef.current, onAcceptRef.current, assetTypeRef.current, contextRef.current);
    };
  }, []);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0) ||
    (imageProvider === "openai" && settings.openai_api_key.length > 0)
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
  }, [currentImage, mudDir, assetType, context, importAsset, variantGroup]);

  const nativeTransparency = modelNativelyTransparent(imageProvider, resolveImageModel(imageProvider, settings?.image_model)?.id);

  /** Enhance a prompt via LLM, injecting entity context, style guide, and zone vibe. */
  const enhancePrompt = async (prompt: string): Promise<string> => {
    const systemPrompt = getEnhanceSystemPrompt(artStyle, assetType, surface, nativeTransparency);
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
        : resolveImageModel(imageProvider, settings?.image_model);
      const modelId = selectedModel || model?.id;
      if (!modelId) {
        throw new Error(`No models available for provider: ${imageProvider}`);
      }

      // If the prompt was already enhanced via the Enhance button, send it as-is.
      // Otherwise auto-enhance via LLM when available — the LLM gets the entity
      // description, style guide, and zone vibe and crafts a proper image prompt.
      let finalPrompt = activePrompt;
      if (enhanced) {
        setLastEnhancedPrompt(activePrompt);
      } else if (hasLlmKey) {
        try {
          finalPrompt = await enhancePrompt(activePrompt);
          setLastEnhancedPrompt(finalPrompt);
        } catch {
          // Fall back to base prompt if LLM fails
        }
      }

      // Append style suffix to ensure consistent aesthetic
      const styleSuffix = getStyleSuffix(surface);
      if (!finalPrompt.includes(styleSuffix.slice(0, 40))) {
        finalPrompt = `${finalPrompt}\n\n${styleSuffix}`;
      }

      const command = imageGenerateCommand(imageProvider);

      const params = {
        prompt: finalPrompt,
        negativePrompt: getNegativePrompt(assetType),
        model: modelId,
        width: activeDims.width,
        height: activeDims.height,
        steps: model?.defaultSteps ?? 28,
        guidance: model && "defaultGuidance" in model ? model.defaultGuidance : null,
        assetType,
        autoEnhance: false,
        transparentBackground: imageProvider === "openai" && requestsTransparentBackground(assetType),
      };

      let image: GeneratedImage;
      try {
        image = await invoke<GeneratedImage>(command, params);
      } catch (firstErr) {
        // Retry once after a brief pause
        await new Promise((r) => setTimeout(r, 1000));
        image = await invoke<GeneratedImage>(command, params);
      }
      if (!mountedRef.current) {
        // Component unmounted during generation — auto-accept the result
        autoAcceptImage(image, finalPrompt, onAcceptRef.current, assetTypeRef.current, contextRef.current);
        return;
      }
      pendingResultRef.current = image;
      pendingPromptRef.current = finalPrompt;
      setResult(image);
      setStage("preview");
    } catch (e) {
      if (!mountedRef.current) return;
      setError(String(e));
      setStage("idle");
    }
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const enhancedText = await enhancePrompt(activePrompt);
      setEditedPrompt(enhancedText);
      setEnhanced(true);
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
    pendingResultRef.current = null;
    pendingPromptRef.current = null;
    const fileName = result.file_path.split(/[\\/]/).pop() ?? result.hash;
    const needsBgRemoval = !!(settings?.auto_remove_bg && assetType && shouldRemoveBg(assetType) && result.data_url);
    const savedDataUrl = result.data_url;
    onAccept(fileName);
    if (assetType) {
      await acceptAsset(result, assetType, lastEnhancedPrompt ?? undefined, context, variantGroup, true).catch(() => {});
    }
    setStage("idle");
    setResult(null);
    setLastEnhancedPrompt(null);
    setEnhanced(false);

    // Run BG removal after returning to idle so the user can keep working,
    // but show an inline spinner so they know the operation isn't actually done.
    if (needsBgRemoval && savedDataUrl && assetType) {
      setRemovingBg(true);
      try {
        const entry = await removeBgAndSave(savedDataUrl, assetType, context, variantGroup).catch(() => null);
        if (entry) await useAssetStore.getState().loadAssets();
      } finally {
        setRemovingBg(false);
      }
    }
  };

  const handleReject = () => {
    pendingResultRef.current = null;
    pendingPromptRef.current = null;
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
            <div className="rounded border border-border-default/60 bg-bg-primary/60 px-2 py-1 text-2xs text-text-secondary">
              Style system: {ART_STYLE_LABELS[artStyle]}
            </div>
          )}

          {/* Dimension override */}
          {hasApiKey && (
            <div className="flex items-center gap-1">
              <span className="text-2xs text-text-muted">{activeDims.width}×{activeDims.height}</span>
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
                className="rounded border border-border-default bg-bg-primary px-1 py-0.5 text-2xs text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
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
                  className="rounded border border-border-default bg-bg-primary px-1 py-0.5 text-2xs text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                >
                  <option value="">Default ({resolveImageModel(imageProvider, settings?.image_model)?.label ?? "first available"})</option>
                  {availableModels.map((m) => (
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
                  className="rounded border border-border-default bg-bg-primary px-1.5 py-0.5 font-mono text-2xs text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                />
              )}
            </div>
          )}

          <div className="flex gap-1">
            {hasApiKey && (
              <button
                onClick={handleGenerate}
                disabled={removingBg}
                className="flex-1 rounded bg-accent/15 px-2 py-1 text-2xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
              >
                Generate Art
              </button>
            )}
            <button
              onClick={handlePickImage}
              disabled={importing || removingBg}
              className="flex-1 rounded bg-bg-elevated px-2 py-1 text-2xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
            >
              {importing ? "Importing..." : "Pick Image"}
            </button>
            <button
              onClick={() => setShowGalleryPicker(true)}
              disabled={removingBg}
              className="flex-1 rounded bg-bg-elevated px-2 py-1 text-2xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
            >
              Gallery
            </button>
            {(hasApiKey || hasLlmKey) && (
              <button
                onClick={() => setShowPrompt((v) => !v)}
                aria-expanded={showPrompt}
                className="rounded px-1.5 py-1 text-2xs text-text-muted transition-colors hover:text-text-secondary"
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
                className="w-full resize-y rounded border border-border-default bg-bg-primary px-2 py-1 font-mono text-2xs leading-relaxed text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={handleEnhance}
                  disabled={enhancing}
                  className="rounded px-1.5 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                >
                  {enhancing ? "..." : enhanced ? "Re-enhance" : "Enhance"}
                </button>
                {enhanced && (
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-2xs font-medium text-accent">
                    Enhanced
                  </span>
                )}
                {editedPrompt && (
                  <button
                    onClick={() => {
                      setEditedPrompt(null);
                      setEnhanced(false);
                    }}
                    className="rounded px-1.5 py-0.5 text-2xs text-text-muted transition-colors hover:text-text-secondary"
                  >
                    Reset
                  </button>
                )}
              </div>
              {(entityContext || vibe) && (
                <p className="text-2xs italic text-text-muted">
                  {!hasLlmKey
                    ? "Configure an LLM provider to enable auto-enhanced prompts"
                    : enhanced
                      ? "Prompt already enhanced — will be sent as-is during generation"
                      : "Entity details + zone vibe auto-injected during generation"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {stage === "generating" && (
        <div className="flex items-center gap-2 py-2">
          <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-2xs text-text-secondary">
            {hasLlmKey && !enhanced ? "Crafting prompt & generating..." : "Generating..."}
          </span>
        </div>
      )}

      {removingBg && stage === "idle" && (
        <div className="flex items-center gap-2 py-1">
          <div className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-2xs text-text-secondary">Removing background...</span>
        </div>
      )}

      {stage === "preview" && (
        <div className="flex gap-1">
          <button
            onClick={handleAccept}
            className="flex-1 rounded bg-accent/15 px-2 py-1 text-2xs font-medium text-accent transition-colors hover:bg-accent/25"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="flex-1 rounded px-2 py-1 text-2xs text-text-muted transition-colors hover:text-text-secondary"
          >
            Reject
          </button>
        </div>
      )}

      {error && (
        <InlineError error={error} onDismiss={() => setError(null)} onRetry={handleGenerate} />
      )}

      {showGalleryPicker && (
        <AssetPickerModal
          mediaKind="image"
          initialFilter={assetType}
          onSelect={(fileName) => onAccept(fileName)}
          onClose={() => setShowGalleryPicker(false)}
        />
      )}
    </div>
  );
}
