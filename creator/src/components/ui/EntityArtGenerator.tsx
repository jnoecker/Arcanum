import "./EntityArtGenerator.css";
import { useState, useEffect, useRef, useMemo } from "react";
import { AI_ENABLED } from "@/lib/featureFlags";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useLoreStore } from "@/stores/loreStore";
import { useImageSrc, isLegacyImagePath, isR2HashPath } from "@/lib/useImageSrc";
import { getEnhanceSystemPrompt, ART_STYLE_LABELS, getNegativePrompt, getStyleSuffix, type ArtStyle } from "@/lib/arcanumPrompts";
import type { ArtStyleSurface } from "@/lib/loreGeneration";
import { IMAGE_MODELS, ENTITY_DIMENSIONS, DIMENSION_PRESETS, resolveImageModel, modelNativelyTransparent } from "@/types/assets";
import type { AssetContext, AssetEntry, GeneratedImage } from "@/types/assets";
import { generateAssetImageWithRetry } from "@/lib/imageGen";
import { useReferenceStore } from "@/stores/referenceStore";
import { ReferenceMentionField } from "@/components/ui/ReferenceMentionField";
import { applyReferences, buildReferenceBlock, buildResolver, expandReferences } from "@/lib/referenceTokens";
import { contentHash } from "@/lib/contentHash";
import type { ReferenceSubject } from "@/types/reference";
import { AssetPickerModal } from "./AssetPickerModal";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";
import { InlineError } from "./FormWidgets";
import { SketchDialog } from "./SketchDialog";
import { ImageLightbox } from "./ImageLightbox";

type Stage = "idle" | "generating" | "preview";

interface EntityArtGeneratorProps {
  /** Returns the fallback prompt template for the given art style (used when no LLM available) */
  getPrompt: (style: ArtStyle) => string;
  /** Rich entity context description for the LLM to craft an image prompt from */
  entityContext?: string;
  /**
   * Minimal framing hint (format/aspect only) sent to the LLM as the reference
   * template. When provided alongside entityContext, this replaces the full
   * basePrompt as the LLM reference, avoiding duplication of the visualStyle
   * (already in the system prompt) and the surface override's example framings
   * (which can overwhelm the actual entity description).
   */
  framingHint?: string;
  /** Current image value (path or URL) */
  currentImage?: string;
  /** Called when user accepts a generated image */
  onAccept: (filePath: string) => void;
  /** Asset type for manifest (e.g. "entity_portrait", "background") */
  assetType?: string;
  /** For ability/status-effect icons: the entity's class, so prompt enhancement
   *  includes only that class's color palette rather than all of them. */
  iconClass?: string;
  /** Context tags for the asset manifest */
  context?: AssetContext;
  /** @deprecated Vibe no longer influences generation; field kept for callers pending cleanup. */
  vibe?: string;
  /** Which art-style surface to apply — "worldbuilding" for zone/entity/game art, "lore" for lore article illustrations */
  surface?: ArtStyleSurface;
  /**
   * Explicit variant-group key, overriding the `entity_type:zone:entity_id`
   * derivation from `context`. Required for callers (e.g. player sprites) whose
   * downstream contract expects a specific group format.
   */
  variantGroupOverride?: string;
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
  variantGroup: string,
  sourceHash: string | undefined,
) {
  const fileName = img.file_path.split(/[\\/]/).pop() ?? img.hash;
  onAccept(fileName);
  if (assetType) {
    useAssetStore.getState().acceptAsset(
      img, assetType, prompt ?? undefined, context, variantGroup, true, true, sourceHash,
    ).catch(() => {});
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatioStyle(width: number, height: number): string {
  const g = gcd(width, height) || 1;
  return `${width / g} / ${height / g}`;
}

function aspectLabel(width: number, height: number): string {
  const g = gcd(width, height) || 1;
  return `${width / g}:${height / g}`;
}

function humanizeKey(s?: string): string {
  if (!s) return "";
  return s.replace(/^lore_/, "").replace(/_/g, " ");
}

export function EntityArtGenerator({
  getPrompt,
  entityContext,
  framingHint,
  currentImage,
  onAccept,
  assetType,
  iconClass,
  context,
  vibe: _vibe,
  surface,
  variantGroupOverride,
}: EntityArtGeneratorProps) {
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const setArtStyle = useAssetStore((s) => s.setArtStyle);
  const importAsset = useAssetStore((s) => s.importAsset);
  const listVariants = useAssetStore((s) => s.listVariants);
  const setActiveVariant = useAssetStore((s) => s.setActiveVariant);
  const assetCount = useAssetStore((s) => s.assets.length);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const worldArtStyles = useLoreStore((s) => s.lore?.artStyles);
  const activeArtStyleId = useLoreStore((s) => s.lore?.activeArtStyleId);
  const setActiveArtStyle = useLoreStore((s) => s.setActiveArtStyle);
  const project = useProjectStore((s) => s.project);
  const refSubjects = useReferenceStore((s) => s.subjects);
  const mudDir = project?.mudDir;
  const projectName = project?.name;
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
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
  const [flipping, setFlipping] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [showSketch, setShowSketch] = useState(false);
  const [variants, setVariants] = useState<AssetEntry[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Refs to track pending results across unmount — auto-accept if user navigates away
  const pendingResultRef = useRef<GeneratedImage | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;
  const assetTypeRef = useRef(assetType);
  assetTypeRef.current = assetType;
  const contextRef = useRef(context);
  contextRef.current = context;
  const variantGroupRef = useRef("");

  // Mirror context-shaping props in refs so handleGenerate/handleEnhance can read
  // the latest values *after* yielding a tick — necessary because commit-on-blur
  // textareas (e.g. an Appearance field above the panel) commit synchronously
  // when the user clicks Conjure, but React batches the resulting state update,
  // leaving these props stale in the click handler's closure.
  const entityContextRef = useRef(entityContext);
  entityContextRef.current = entityContext;
  // Fingerprint the render context so batch art can later detect description
  // changes against this asset's last render. Empty context → no fingerprint.
  const sourceHashRef = useRef<string | undefined>(undefined);
  sourceHashRef.current = entityContext ? contentHash(entityContext) : undefined;
  const framingHintRef = useRef(framingHint);
  framingHintRef.current = framingHint;
  const getPromptRef = useRef(getPrompt);
  getPromptRef.current = getPrompt;

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const img = pendingResultRef.current;
      if (!img) return;
      autoAcceptImage(img, pendingPromptRef.current, onAcceptRef.current, assetTypeRef.current, contextRef.current, variantGroupRef.current, sourceHashRef.current);
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

  // Surface which `@reference` tokens the current prompt/entity resolve to.
  const refStatus = useMemo(() => {
    if (refSubjects.length === 0) return { used: [] as string[], unknown: [] as string[] };
    const resolver = buildResolver(refSubjects);
    const a = expandReferences(`${entityContext ?? ""}\n${activePrompt}`, resolver);
    const used = Array.from(new Set(a.used.map((s) => s.name)));
    const unknown = Array.from(new Set(a.unknown));
    return { used, unknown };
  }, [refSubjects, entityContext, activePrompt]);
  const variantGroup = variantGroupOverride ?? computeVariantGroup(context);
  variantGroupRef.current = variantGroup;

  const entityType = context?.entity_type ?? "";
  const defaultDims = ENTITY_DIMENSIONS[entityType] ?? { width: 1024, height: 1024, label: "1024×1024" };
  const activeDims = dimOverride ?? defaultDims;
  const heroAspect = aspectRatioStyle(activeDims.width, activeDims.height);
  const heroAspectLabel = aspectLabel(activeDims.width, activeDims.height);

  const availableModels = useMemo(
    () => IMAGE_MODELS.filter((m) => m.provider === imageProvider),
    [imageProvider],
  );

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

  // Load variant entries for the active group
  useEffect(() => {
    if (!variantGroup) {
      setVariants([]);
      return;
    }
    listVariants(variantGroup).then(setVariants).catch(() => {});
  }, [variantGroup, listVariants, assetCount]);

  const nativeTransparency = modelNativelyTransparent(imageProvider, resolveImageModel(imageProvider, settings?.image_model)?.id);

  const enhancePromptWith = async (
    prompt: string,
    ec: string | undefined,
    fh: string | undefined,
  ): Promise<string> => {
    const systemPrompt = getEnhanceSystemPrompt(artStyle, assetType, surface, nativeTransparency, iconClass);
    const resolver = useReferenceStore.getState().resolver();
    const used: ReferenceSubject[] = [];
    const collect = (subs: ReferenceSubject[]) => {
      for (const s of subs) if (!used.some((u) => u.id === s.id)) used.push(s);
    };
    const parts: string[] = [];

    if (ec) {
      const ecExpanded = expandReferences(ec, resolver);
      collect(ecExpanded.used);
      parts.push(`Generate an image prompt for this entity:\n${ecExpanded.text}`);
      const reference = expandReferences(fh ?? prompt, resolver);
      collect(reference.used);
      parts.push(`\nReference framing (format and composition guidance — the entity above defines the subject):\n${reference.text}`);
    } else {
      const expanded = expandReferences(prompt, resolver);
      collect(expanded.used);
      parts.push(expanded.text);
    }

    const block = buildReferenceBlock(used);
    if (block) parts.push(`\n${block}`);

    const userPrompt = parts.join("\n");
    return invoke<string>("llm_complete", { systemPrompt, userPrompt });
  };

  /** Yield one macrotask so any commit-on-blur edits flush into the store
   *  before we read context props. */
  const flushPendingCommits = () => new Promise<void>((r) => setTimeout(r, 0));

  const runConjure = async (presetPrompt: string | null, presetEnhanced: boolean) => {
    setStage("generating");
    setError(null);
    try {
      // Let any pending commit-on-blur edits (Appearance, Description, etc.)
      // flush into the store *before* we read context off our props.
      await flushPendingCommits();
      const ec = entityContextRef.current;
      const fh = framingHintRef.current;
      const freshBase = getPromptRef.current(artStyle);
      const promptToUse = presetPrompt ?? editedPrompt ?? freshBase;

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

      // Expand any `@reference` tokens (strip the sigil, append the canonical
      // appearance block) so generation stays consistent across appearances.
      const expandLocal = (text: string) =>
        applyReferences(text, useReferenceStore.getState().resolver()).prompt;

      let finalPrompt = promptToUse;
      if (presetEnhanced || enhanced) {
        finalPrompt = expandLocal(promptToUse);
        setLastEnhancedPrompt(finalPrompt);
      } else if (hasLlmKey) {
        try {
          finalPrompt = await enhancePromptWith(promptToUse, ec, fh);
          setLastEnhancedPrompt(finalPrompt);
        } catch {
          // Fall back to the (reference-expanded) base prompt if the LLM fails.
          finalPrompt = expandLocal(promptToUse);
        }
      } else {
        finalPrompt = expandLocal(promptToUse);
      }

      const styleSuffix = getStyleSuffix(surface);
      if (!finalPrompt.includes(styleSuffix.slice(0, 40))) {
        finalPrompt = `${finalPrompt}\n\n${styleSuffix}`;
      }

      const image = await generateAssetImageWithRetry({
        provider: imageProvider,
        model: model ?? modelId,
        prompt: finalPrompt,
        width: activeDims.width,
        height: activeDims.height,
        assetType,
        steps: model?.defaultSteps ?? 28,
        negativePrompt: getNegativePrompt(assetType),
      });
      if (!mountedRef.current) {
        autoAcceptImage(image, finalPrompt, onAcceptRef.current, assetTypeRef.current, contextRef.current, variantGroupRef.current, sourceHashRef.current);
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

  const handleGenerate = () => {
    void runConjure(null, false);
  };

  const runEnhance = async (): Promise<string | null> => {
    setEnhancing(true);
    setError(null);
    try {
      await flushPendingCommits();
      const ec = entityContextRef.current;
      const fh = framingHintRef.current;
      const freshBase = getPromptRef.current(artStyle);
      const promptToEnhance = editedPrompt ?? freshBase;
      const enhancedText = await enhancePromptWith(promptToEnhance, ec, fh);
      setEditedPrompt(enhancedText);
      setEnhanced(true);
      return enhancedText;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setEnhancing(false);
    }
  };

  const handleEnhance = () => {
    void runEnhance();
  };

  const handleEnhanceAndConjure = async () => {
    const enhancedText = await runEnhance();
    if (enhancedText === null) return;
    await runConjure(enhancedText, true);
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
      await acceptAsset(result, assetType, lastEnhancedPrompt ?? undefined, context, variantGroup, true, true, sourceHashRef.current).catch(() => {});
    }
    setStage("idle");
    setResult(null);
    setLastEnhancedPrompt(null);
    setEnhanced(false);

    if (needsBgRemoval && savedDataUrl && assetType) {
      setRemovingBg(true);
      try {
        const entry = await removeBgAndSave(savedDataUrl, assetType, context, variantGroup).catch(() => null);
        if (entry) {
          onAccept(entry.file_name);
          await useAssetStore.getState().loadAssets();
        }
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

  const handleFlip = async () => {
    if (!currentImage || !isR2HashPath(currentImage)) return;
    setFlipping(true);
    try {
      const newFileName = await invoke<string>("flip_image", { imageRef: currentImage });
      onAccept(newFileName);
      // flip_image already registers the flipped asset under the source's
      // variant group and marks it active; refresh so grouped consumers
      // (e.g. player sprites, whose onAccept is a no-op) reflect it.
      if (variantGroup) await useAssetStore.getState().loadAssets();
    } catch (e) {
      console.error("Flip failed:", e);
    } finally {
      setFlipping(false);
    }
  };

  const handleSelectVariant = async (entry: AssetEntry) => {
    if (!variantGroup) return;
    await setActiveVariant(variantGroup, entry.id);
    onAccept(entry.file_name);
  };

  const savedImageSrc = useImageSrc(currentImage);

  const previewSrc = stage === "preview" && result
    ? result.data_url
    : savedImageSrc;

  const promptKeyHandler = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (AI_ENABLED && hasApiKey && stage === "idle" && !removingBg) {
        handleGenerate();
      }
    }
  };

  // Auto-injected context chips (informational — read-only)
  const injectedChips: { k: string; v: string }[] = [];
  if (projectName) injectedChips.push({ k: "world", v: projectName });
  if (surface === "lore") injectedChips.push({ k: "surface", v: "lore" });
  const ent = humanizeKey(context?.entity_type);
  if (ent) injectedChips.push({ k: "entity", v: ent });

  const showStudio = AI_ENABLED && (hasApiKey || hasLlmKey);

  return (
    <section className="art-panel">
      <div className="art-panel__body">
        {/* ─── Hero column ─── */}
        <div className="art-panel__hero-col">
          <HeroCanvas
            stage={stage}
            previewSrc={previewSrc ?? undefined}
            heroAspect={heroAspect}
            heroAspectLabel={heroAspectLabel}
            isPrimary={!!currentImage && stage !== "preview"}
            modelLabel={resolveImageModel(imageProvider, settings?.image_model)?.label}
            canFlip={!!currentImage && isR2HashPath(currentImage) && stage === "idle"}
            flipping={flipping}
            onFlip={handleFlip}
            onZoom={(src) => setLightbox(src)}
          />

          {variantGroup && variants.length > 0 && stage === "idle" && (
            <VariantsRail
              variants={variants}
              currentImage={currentImage}
              assetsDir={assetsDir}
              onSelect={handleSelectVariant}
              onReroll={AI_ENABLED && hasApiKey ? handleGenerate : undefined}
              rerollDisabled={removingBg}
            />
          )}
        </div>

        {/* ─── Studio column ─── */}
        <div className="art-panel__studio">
          {showStudio && (
            <div className="art-block">
              <div className="art-block__label">
                <span>Prompt</span>
                <button
                  className={`art-block__minor${enhanced ? " art-block__minor--active" : ""}`}
                  onClick={handleEnhance}
                  disabled={enhancing || !hasLlmKey}
                  title={!hasLlmKey ? "Configure an LLM provider to enable prompt enhancement" : undefined}
                >
                  {enhancing ? "Enhancing…" : enhanced ? "Re-enhance" : "Enhance"}
                </button>
              </div>
              <div className="art-prompter">
                <ReferenceMentionField
                  multiline
                  unstyled
                  className="art-prompter__field"
                  value={activePrompt}
                  onChange={(v) => setEditedPrompt(v)}
                  onKeyDown={promptKeyHandler}
                  rows={4}
                  placeholder="Describe the form you wish to summon… Type @ to reference a canonical subject."
                />
                <div className="art-prompter__footer">
                  {refStatus.used.length > 0 ? (
                    <span className="art-prompter__hint" title="Canonical appearance injected on generate">
                      ✦ {refStatus.used.join(", ")}
                    </span>
                  ) : refStatus.unknown.length > 0 ? (
                    <span className="art-prompter__hint" title="No reference subject matches these tokens">
                      ⚠ unknown: @{refStatus.unknown.join(", @")}
                    </span>
                  ) : entityContext && !enhanced && hasLlmKey ? (
                    <span className="art-prompter__hint">Entity auto-injected on generate</span>
                  ) : <span />}
                  <span className="art-prompter__count">{activePrompt.length} chars</span>
                </div>
              </div>
              <div className="art-prompt-toolbar">
                {injectedChips.length > 0 && (
                  <div className="art-injected art-injected--popover">
                    <span
                      className="art-injected__pill"
                      aria-label="Auto-injected context"
                      tabIndex={0}
                    >
                      ⓘ Auto-injected
                    </span>
                    <div className="art-injected__popover" role="tooltip">
                      <span className="art-injected__popover-title">Auto-injected</span>
                      <div className="art-injected__chips">
                        {injectedChips.map((c) => (
                          <span key={c.k} className="art-ichip">
                            <span className="art-ichip__k">{c.k}</span>
                            <span className="art-ichip__v">{c.v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {editedPrompt && (
                  <button
                    onClick={() => { setEditedPrompt(null); setEnhanced(false); }}
                    className="art-block__minor"
                  >
                    ↺ Reset prompt
                  </button>
                )}
                {AI_ENABLED && hasApiKey && (
                  <details className="art-forge-gear">
                    <summary
                      className="art-forge-gear__btn"
                      title="Forge settings"
                      aria-label="Forge settings"
                    >
                      ⚙
                    </summary>
                    <div className="art-forge-gear__popover" role="dialog" aria-label="Forge settings">
                      <div className="art-forge-gear__title">Forge settings</div>
                      <div className="art-settings">
                <div className="art-setting art-setting--wide">
                  <span className="art-setting__k">Style</span>
                  {worldArtStyles && worldArtStyles.length > 0 ? (
                    <select
                      className="art-setting__v"
                      value={activeArtStyleId ?? ""}
                      onChange={(e) => setActiveArtStyle(e.target.value || null)}
                    >
                      {worldArtStyles.map((style) => (
                        <option key={style.id} value={style.id}>{style.name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="art-setting__v"
                      value={artStyle}
                      onChange={(e) => setArtStyle(e.target.value as ArtStyle)}
                    >
                      {(Object.keys(ART_STYLE_LABELS) as ArtStyle[]).map((style) => (
                        <option key={style} value={style}>{ART_STYLE_LABELS[style]}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="art-setting">
                  <span className="art-setting__k">Ratio</span>
                  <select
                    className="art-setting__v"
                    value={dimOverride ? `${dimOverride.width}x${dimOverride.height}` : ""}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setDimOverride(null);
                      } else {
                        const parts = e.target.value.split("x").map(Number);
                        setDimOverride({ width: parts[0]!, height: parts[1]! });
                      }
                    }}
                  >
                    <option value="">Default · {defaultDims.width}×{defaultDims.height}</option>
                    {DIMENSION_PRESETS.map((p) => (
                      <option key={p.label} value={`${p.width}x${p.height}`}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {availableModels.length > 0 && (
                  <div className="art-setting">
                    <span className="art-setting__k">Model</span>
                    <select
                      className="art-setting__v"
                      value={modelOverride ?? ""}
                      onChange={(e) => setModelOverride(e.target.value || null)}
                    >
                      <option value="">{resolveImageModel(imageProvider, settings?.image_model)?.label ?? "Default"}</option>
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                      <option value="__custom__">Custom…</option>
                    </select>
                  </div>
                )}

                        {modelOverride === "__custom__" && (
                          <input
                            type="text"
                            className="art-setting__custom art-setting--wide"
                            value={customModel}
                            onChange={(e) => setCustomModel(e.target.value)}
                            placeholder="e.g. runware:400@2"
                          />
                        )}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}

          <div className="art-actions">
            {AI_ENABLED && hasApiKey && stage === "idle" && (
              <button
                className="art-btn art-btn--ember art-btn--big"
                onClick={handleGenerate}
                disabled={removingBg || enhancing}
              >
                <span className="art-btn__rune">⚒</span>
                <span>Conjure</span>
                <span className="art-btn__sub">⌘↵</span>
              </button>
            )}

            {AI_ENABLED && hasApiKey && hasLlmKey && stage === "idle" && (
              <button
                className="art-btn art-btn--ghost art-btn--big"
                onClick={handleEnhanceAndConjure}
                disabled={removingBg || enhancing}
                title="Refine the prompt with AI, then conjure in one step"
              >
                <span className="art-btn__rune">✶</span>
                <span>{enhancing ? "Enhancing…" : "Enhance & Conjure"}</span>
              </button>
            )}

            {AI_ENABLED && stage === "generating" && (
              <button className="art-btn art-btn--ember art-btn--big" disabled>
                <span className="art-inline-status__spinner" />
                <span>{hasLlmKey && !enhanced ? "Crafting prompt…" : "Conjuring…"}</span>
              </button>
            )}

            {AI_ENABLED && stage === "preview" && (
              <div className="art-preview-actions">
                <span className="art-preview-actions__label">Vision summoned · accept?</span>
                <button className="art-btn art-btn--ember art-btn--small" onClick={handleAccept}>
                  ✓ Keep
                </button>
                <button className="art-btn art-btn--ghost art-btn--small" onClick={handleReject}>
                  ✕ Reject
                </button>
              </div>
            )}

            {stage === "idle" && (
              <div className="art-actions__row">
                <button
                  className="art-btn art-btn--ghost art-btn--small"
                  onClick={handlePickImage}
                  disabled={importing || removingBg}
                >
                  {importing ? "Importing…" : "↑ Pick file"}
                </button>
                <button
                  className="art-btn art-btn--ghost art-btn--small"
                  onClick={() => setShowSketch(true)}
                  disabled={removingBg}
                  title="Draw a sketch (mouse or tablet)"
                >
                  ✎ Sketch
                </button>
                <button
                  className="art-btn art-btn--ghost art-btn--small"
                  onClick={() => setShowGalleryPicker(true)}
                  disabled={removingBg}
                >
                  ⊞ Gallery
                </button>
              </div>
            )}
          </div>

          {removingBg && (
            <div className="art-inline-status">
              <span className="art-inline-status__spinner" />
              <span>Removing background…</span>
            </div>
          )}

          {error && (
            <InlineError error={error} onDismiss={() => setError(null)} onRetry={handleGenerate} />
          )}
        </div>
      </div>

      {showGalleryPicker && (
        <AssetPickerModal
          mediaKind="image"
          initialFilter={assetType}
          onSelect={(fileName) => onAccept(fileName)}
          onClose={() => setShowGalleryPicker(false)}
        />
      )}

      <SketchDialog
        open={showSketch}
        title="Sketch image"
        width={1024}
        height={1024}
        initialDataUrl={savedImageSrc || null}
        assetType={assetType ?? "background"}
        context={context}
        variantGroup={variantGroup}
        onClose={() => setShowSketch(false)}
        onSave={(entry) => {
          onAccept(entry.file_name);
          // For grouped callers (e.g. player sprites) the path field isn't the
          // source of truth — the asset's variant group is. Promote the sketch
          // to the active entry so it shows and deploys; setActiveVariant
          // refreshes the asset list.
          if (variantGroup) void setActiveVariant(variantGroup, entry.id);
        }}
      />

      {lightbox && (
        <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}
    </section>
  );
}

/* ─── Hero canvas — own component for state isolation ───────────────── */

function HeroCanvas({
  stage,
  previewSrc,
  heroAspect,
  heroAspectLabel,
  isPrimary,
  modelLabel,
  canFlip,
  flipping,
  onFlip,
  onZoom,
}: {
  stage: Stage;
  previewSrc?: string;
  heroAspect: string;
  heroAspectLabel: string;
  isPrimary: boolean;
  modelLabel?: string;
  canFlip: boolean;
  flipping: boolean;
  onFlip: () => void;
  onZoom?: (src: string) => void;
}) {
  if (stage === "generating") {
    return (
      <div
        className="art-hero art-hero--gen"
        style={{ "--art-hero-aspect": heroAspect } as React.CSSProperties}
      >
        <div className="art-hero__gen-pane">
          <div className="art-hero__gen-shimmer" />
        </div>
        <div className="art-hero__gen-readout">
          <span className="art-hero__gen-orb" />
          <div>
            <p className="art-hero__gen-eyebrow">The Forge is shaping your vision</p>
            <p className="art-hero__gen-progress">{modelLabel ?? "Generating"} · {heroAspectLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!previewSrc) {
    return (
      <div
        className="art-hero art-hero--empty"
        style={{ "--art-hero-aspect": heroAspect } as React.CSSProperties}
      >
        <div className="art-hero__empty-mark">
          <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
            <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
            <circle cx="32" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7" />
            <circle cx="32" cy="32" r="3" fill="currentColor" />
          </svg>
        </div>
        <p className="art-hero__empty-eyebrow">Awaiting your command</p>
        <p className="art-hero__empty-line">No image has yet been summoned.</p>
        <p className="art-hero__empty-line art-hero__empty-line--soft">
          Describe what you wish to see, then strike <em>Conjure</em>.
        </p>
      </div>
    );
  }

  const clickable = !!onZoom;
  return (
    <div
      className={`art-hero${clickable ? " art-hero--clickable" : ""}`}
      style={{ "--art-hero-aspect": heroAspect } as React.CSSProperties}
      onClick={clickable ? () => onZoom?.(previewSrc) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onZoom?.(previewSrc);
        }
      } : undefined}
      title={clickable ? "Click to zoom" : undefined}
    >
      <img
        src={previewSrc}
        alt="Entity art"
        className="art-hero__img"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="art-hero__scrim" />
      <div className="art-hero__meta">
        {isPrimary && (
          <span className="art-chip art-chip--primary">
            <span className="art-chip__star">✦</span> Primary
          </span>
        )}
        {stage === "preview" && (
          <span className="art-chip art-chip--primary">
            <span className="art-chip__star">✦</span> Preview
          </span>
        )}
        <span className="art-chip">{heroAspectLabel}</span>
        {modelLabel && <span className="art-chip art-chip--muted">{modelLabel}</span>}
      </div>
      <div className="art-hero__actions">
        {canFlip && (
          <button
            className="art-hero-action"
            onClick={(e) => { e.stopPropagation(); onFlip(); }}
            disabled={flipping}
            title="Flip horizontally"
          >
            ⇄
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Variants rail — filmstrip ─────────────────────────────────────── */

function VariantsRail({
  variants,
  currentImage,
  assetsDir,
  onSelect,
  onReroll,
  rerollDisabled,
}: {
  variants: AssetEntry[];
  currentImage?: string;
  assetsDir: string;
  onSelect: (entry: AssetEntry) => void;
  onReroll?: () => void;
  rerollDisabled?: boolean;
}) {
  return (
    <div className="art-rail">
      <div className="art-rail__label">
        <span className="art-rail__title">Variants</span>
        <span className="art-rail__count">{variants.length}</span>
      </div>
      <div className="art-rail__strip">
        {variants.map((v) => (
          <VariantThumb
            key={v.id}
            entry={v}
            assetsDir={assetsDir}
            isPrimary={v.is_active || v.file_name === currentImage}
            onClick={() => onSelect(v)}
          />
        ))}
        {onReroll && (
          <button
            className="art-thumb art-thumb--add"
            onClick={onReroll}
            disabled={rerollDisabled}
            title="Generate another variant with the current prompt"
          >
            <span className="art-thumb__plus">↻</span>
            <span className="art-thumb__addlabel">Reroll</span>
          </button>
        )}
      </div>
    </div>
  );
}

function VariantThumb({
  entry,
  assetsDir,
  isPrimary,
  onClick,
}: {
  entry: AssetEntry;
  assetsDir: string;
  isPrimary: boolean;
  onClick: () => void;
}) {
  const imagePath = `${assetsDir}\\images\\${entry.file_name}`;
  const src = useImageSrc(imagePath);
  return (
    <button
      type="button"
      className="art-thumb"
      data-primary={isPrimary}
      onClick={onClick}
      title={isPrimary ? "Primary" : "Set as primary"}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "rgb(var(--bg-rgb) / 0.6)" }} />
      )}
      {isPrimary && <span className="art-thumb__star">✦</span>}
      {!isPrimary && (
        <div className="art-thumb__hover">Set primary</div>
      )}
    </button>
  );
}
