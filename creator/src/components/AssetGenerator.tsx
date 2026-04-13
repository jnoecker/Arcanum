import { useState, useEffect, useMemo } from "react";
import { AI_ENABLED } from "@/lib/featureFlags";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  ASSET_TEMPLATES,
  getPreamble,
  getEnhanceSystemPrompt,
  composePrompt,
  UNIVERSAL_NEGATIVE,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import { IMAGE_MODELS, imageGenerateCommand, resolveImageModel, requestsTransparentBackground } from "@/types/assets";
import type { AssetType, GeneratedImage } from "@/types/assets";
import loadingVignette from "@/assets/loading-vignette.jpg";
import { ActionButton, DialogShell, Spinner } from "./ui/FormWidgets";

const GENERATION_MESSAGES = [
  "Generating image...",
  "Processing prompt...",
  "Rendering artwork...",
  "Almost there...",
];

interface AssetCategory {
  label: string;
  types: AssetType[];
}

const ASSET_CATEGORIES: AssetCategory[] = [
  { label: "World",      types: ["room", "zone_map", "gathering_node", "background"] },
  { label: "Characters",  types: ["mob", "pet", "player_sprite", "entity_portrait", "class_portrait", "race_portrait"] },
  { label: "Items",       types: ["item", "ability_icon", "ability_sprite", "status_effect_icon"] },
  { label: "Lore",        types: ["lore_character", "lore_location", "lore_organization", "lore_species", "lore_item", "lore_event", "lore_map"] },
  { label: "UI",          types: ["ornament", "panel_header", "splash_hero", "loading_vignette", "empty_state", "status_art"] },
  { label: "Audio/Video", types: ["music", "ambient", "audio", "video"] },
];

type Stage = "compose" | "generating" | "preview";

export function AssetGenerator() {
  const settings = useAssetStore((s) => s.settings);
  const closeGenerator = useAssetStore((s) => s.closeGenerator);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const updateConfig = useConfigStore((s) => s.updateConfig);

  const [stage, setStage] = useState<Stage>("compose");
  const [artStyle] = useState<ArtStyle>("gentle_magic");
  const [category, setCategory] = useState(ASSET_CATEGORIES[0]!.label);
  const [assetType, setAssetType] = useState<AssetType>("room");
  const [modelId, setModelId] = useState<string>(() => {
    const provider = settings?.image_provider ?? "deepinfra";
    return resolveImageModel(provider, settings?.image_model)?.id ?? IMAGE_MODELS[0]!.id;
  });
  const [customization, setCustomization] = useState("");
  const [prompt, setPrompt] = useState(() => composePrompt("room", "gentle_magic"));
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [globalAssetKey, setGlobalAssetKey] = useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(closeGenerator);

  useEffect(() => {
    if (stage !== "generating") {
      setMsgIndex(0);
      return;
    }
    const id = setInterval(() => setMsgIndex((index) => (index + 1) % GENERATION_MESSAGES.length), 3500);
    return () => clearInterval(id);
  }, [stage]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = !!(
    settings &&
    ((imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
      (imageProvider === "runware" && settings.runware_api_key.length > 0) ||
      (imageProvider === "openai" && settings.openai_api_key.length > 0))
  );

  const activeCategory = useMemo(
    () => ASSET_CATEGORIES.find((c) => c.label === category) ?? ASSET_CATEGORIES[0]!,
    [category],
  );

  const handleCategoryChange = (label: string) => {
    setCategory(label);
    const cat = ASSET_CATEGORIES.find((c) => c.label === label) ?? ASSET_CATEGORIES[0]!;
    const first = cat.types[0]!;
    setAssetType(first);
    setPrompt(composePrompt(first, artStyle, customization || undefined));
    setEnhancedPrompt("");
    setUseEnhanced(false);
  };

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
      const preamble = getPreamble(artStyle, "worldbuilding");
      const systemPrompt = getEnhanceSystemPrompt(artStyle, undefined, "worldbuilding");
      const response = await invoke<string>("enhance_prompt", {
        prompt: `${preamble}\n\n${prompt}`,
        systemPrompt,
      });
      setEnhancedPrompt(response);
      setUseEnhanced(true);
    } catch (invokeError) {
      setError(String(invokeError));
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    setStage("generating");
    setError(null);
    try {
      const preamble = getPreamble(artStyle, "worldbuilding");
      const finalPrompt = useEnhanced && enhancedPrompt ? enhancedPrompt : `${preamble}\n\n${prompt}`;
      const model = IMAGE_MODELS.find((entry) => entry.id === modelId);
      const guidance =
        model && "defaultGuidance" in model ? (model as { defaultGuidance: number }).defaultGuidance : null;

      const command = imageGenerateCommand(imageProvider);
      const image = await invoke<GeneratedImage>(command, {
        prompt: finalPrompt,
        negativePrompt: UNIVERSAL_NEGATIVE,
        model: modelId,
        width: 1024,
        height: 1024,
        steps: model?.defaultSteps ?? null,
        guidance,
        assetType,
        autoEnhance: !(useEnhanced && enhancedPrompt),
        transparentBackground: imageProvider === "openai" && requestsTransparentBackground(assetType),
      });
      setResult(image);
      setStage("preview");
    } catch (invokeError) {
      setError(String(invokeError));
      setStage("compose");
    }
  };

  const handleAccept = async () => {
    if (!result) return;
    setAccepting(true);
    try {
      await acceptAsset(result, assetType, useEnhanced ? enhancedPrompt : undefined);

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
    } catch (invokeError) {
      setError(String(invokeError));
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = () => {
    setResult(null);
    setStage("compose");
  };

  if (!AI_ENABLED) return null;

  if (!hasApiKey) {
    return (
      <DialogShell
        dialogRef={trapRef}
        titleId="asset-gen-api-key-title"
        title="Image Provider Required"
        subtitle="Set an image provider key in Config -> API Settings before invoking the generator."
        widthClassName="max-w-lg"
        onClose={closeGenerator}
        role="alertdialog"
        footer={
          <ActionButton onClick={closeGenerator} variant="primary">
            Close
          </ActionButton>
        }
      >
        <div className="panel-surface-light rounded-3xl p-5 text-sm leading-7 text-text-secondary">
          No active image provider credential found. Add one in API Settings first.
        </div>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="asset-gen-title"
      title="New Asset"
      widthClassName="max-w-3xl"
      onClose={closeGenerator}
      footer={
        <>
          {stage === "compose" && (
            <>
              <ActionButton onClick={closeGenerator} variant="ghost">
                Close
              </ActionButton>
              <ActionButton onClick={handleGenerate} variant="primary">
                Render Artwork
              </ActionButton>
            </>
          )}
          {stage === "preview" && (
            <>
              <ActionButton onClick={handleReject} variant="ghost">
                Reject And Retry
              </ActionButton>
              <ActionButton onClick={handleAccept} disabled={accepting} variant="primary">
                {accepting && <Spinner />}
                {accepting ? "Saving To Vault" : "Accept Artwork"}
              </ActionButton>
            </>
          )}
        </>
      }
    >
      {stage === "compose" && (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex gap-1">
              {ASSET_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => handleCategoryChange(cat.label)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-display transition",
                    category === cat.label
                      ? "bg-accent/20 text-accent border border-accent/40"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent",
                  ].join(" ")}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeCategory.types.map((key) => (
                <label
                  key={key}
                  className={[
                    "focus-ring action-button justify-start text-xs",
                    assetType === key ? "action-button-primary" : "action-button-secondary",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="asset-generator-type"
                    value={key}
                    checked={assetType === key}
                    onChange={() => handleTypeChange(key)}
                    className="sr-only"
                  />
                  {ASSET_TEMPLATES[key].label}
                </label>
              ))}
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 block text-2xs uppercase tracking-wide-ui text-text-muted">Model</legend>
            <div className="flex flex-wrap gap-2">
              {IMAGE_MODELS.filter((model) => model.provider === imageProvider).map((model) => (
                <label
                  key={model.id}
                  className={[
                    "focus-ring action-button justify-start",
                    modelId === model.id ? "action-button-primary" : "action-button-secondary",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="asset-generator-model"
                    value={model.id}
                    checked={modelId === model.id}
                    onChange={() => setModelId(model.id)}
                    className="sr-only"
                  />
                  {model.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="asset-gen-customization" className="mb-1.5 block text-2xs uppercase tracking-wide-ui text-text-muted">
              Customization
            </label>
            <input
              id="asset-gen-customization"
              type="text"
              value={customization}
              onChange={(e) => handleCustomizationChange(e.target.value)}
              placeholder="e.g. forest clearing with ancient ruins, storm-lit harbor..."
              className="ornate-input min-h-11 w-full rounded-2xl px-4 py-3 text-sm"
            />
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <label htmlFor="asset-gen-prompt" className="text-2xs uppercase tracking-wide-ui text-text-muted">Prompt</label>
              <div className="ml-auto flex flex-wrap gap-2">
                {enhancedPrompt && (
                  <>
                    <ActionButton
                      onClick={() => setUseEnhanced(true)}
                      variant={useEnhanced ? "primary" : "ghost"}
                      size="sm"
                    >
                      Enhanced
                    </ActionButton>
                    <ActionButton
                      onClick={() => setUseEnhanced(false)}
                      variant={!useEnhanced ? "primary" : "ghost"}
                      size="sm"
                    >
                      Original
                    </ActionButton>
                  </>
                )}
                <ActionButton onClick={handleEnhance} disabled={enhancing} variant="secondary" size="sm">
                  {enhancing && <Spinner />}
                  {enhancing ? "Enhancing..." : "Refine Prompt"}
                </ActionButton>
              </div>
            </div>
            <textarea
              id="asset-gen-prompt"
              value={useEnhanced && enhancedPrompt ? enhancedPrompt : prompt}
              onChange={(e) => {
                if (useEnhanced) {
                  setEnhancedPrompt(e.target.value);
                } else {
                  setPrompt(e.target.value);
                }
              }}
              rows={6}
              className="ornate-input min-h-[10rem] w-full resize-y rounded-2xl px-4 py-3 font-mono text-xs leading-7 text-text-secondary"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-2xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          )}
        </div>
      )}

      {stage === "generating" && (
        <div className="relative overflow-hidden rounded-3xl border border-[var(--chrome-stroke)]">
          <img src={loadingVignette} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-secondary via-bg-secondary/78 to-bg-secondary/55" />
          <div className="relative flex min-h-[24rem] flex-col items-center justify-center gap-5 px-6 py-12 text-center">
            <Spinner className="h-8 w-8 border-2" />
            <p className="font-display text-lg text-text-primary">{GENERATION_MESSAGES[msgIndex]}</p>
            <p className="max-w-xl text-sm leading-7 text-text-secondary">
              {ASSET_TEMPLATES[assetType].label} &middot; {IMAGE_MODELS.find((model) => model.id === modelId)?.label ?? "selected model"}
            </p>
          </div>
        </div>
      )}

      {stage === "preview" && result && (
        <div className="grid gap-4">
          <div className="overflow-hidden rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]">
            <img src={result.data_url} alt="Generated art" loading="lazy" className="w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1">
                {result.width}x{result.height}
              </span>
              <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1">
                {result.model.split("/").pop()}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="asset-gen-global-key" className="text-xs text-text-muted">
                Global asset key
              </label>
              <input
                id="asset-gen-global-key"
                type="text"
                value={globalAssetKey}
                onChange={(e) => setGlobalAssetKey(e.target.value)}
                placeholder="optional, e.g. compass_rose"
                className="ornate-input w-52 rounded-lg px-3 py-1.5 text-xs"
              />
            </div>
          </div>
          {error && (
            <div role="alert" className="rounded-2xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          )}
        </div>
      )}
    </DialogShell>
  );
}
