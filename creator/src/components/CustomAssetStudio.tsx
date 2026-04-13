import { useCallback, useEffect, useMemo, useState } from "react";
import { AI_ENABLED } from "@/lib/featureFlags";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useVibeStore } from "@/stores/vibeStore";
import { useImageSrc } from "@/lib/useImageSrc";
import {
  ASSET_TEMPLATES,
  buildCustomAssetPrompt,
  getCustomAssetSystemPrompt,
  getFormatForAssetType,
  UNIVERSAL_NEGATIVE,
} from "@/lib/arcanumPrompts";
import { imageGenerateCommand, resolveImageModel, requestsTransparentBackground, type AssetEntry, type AssetType, type GeneratedImage } from "@/types/assets";
import { InlineError, Spinner } from "@/components/ui/FormWidgets";

const CUSTOM_ASSET_TYPES: AssetType[] = [
  "background",
  "mob",
  "item",
  "ability_icon",
  "zone_map",
  "splash_hero",
  "loading_vignette",
  "panel_header",
  "ornament",
  "status_art",
  "empty_state",
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dimensionsForAssetType(assetType: AssetType): { width: number; height: number } {
  switch (assetType) {
    case "background":
    case "status_art":
    case "empty_state":
    case "zone_map":
      return { width: 1920, height: 1080 };
    case "splash_hero":
      return { width: 1920, height: 960 };
    case "panel_header":
      return { width: 1600, height: 400 };
    case "ornament":
      return { width: 1400, height: 320 };
    case "mob":
      return { width: 512, height: 512 };
    case "item":
    case "ability_icon":
    case "loading_vignette":
      return { width: 512, height: 512 };
    default:
      return { width: 1024, height: 1024 };
  }
}

function VariantCard({
  entry,
  assetsDir,
  onClick,
}: {
  entry: AssetEntry;
  assetsDir: string;
  onClick: () => void;
}) {
  const thumbSrc = useImageSrc(`${assetsDir}\\images\\${entry.file_name}`);

  return (
    <button
      onClick={onClick}
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 transition ${
        entry.is_active
          ? "border-accent shadow-[0_0_0_1px_var(--border-accent-ring)]"
          : "border-[var(--chrome-stroke-strong)] hover:border-[var(--border-glow)]"
      }`}
    >
      {thumbSrc ? (
        <img src={thumbSrc} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-[var(--chrome-highlight)]" />
      )}
    </button>
  );
}

export function CustomAssetStudio({ selectedZoneId }: { selectedZoneId: string | null }) {
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const importAsset = useAssetStore((s) => s.importAsset);
  const listVariants = useAssetStore((s) => s.listVariants);
  const setActiveVariant = useAssetStore((s) => s.setActiveVariant);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const zones = useZoneStore((s) => s.zones);
  const loadVibe = useVibeStore((s) => s.loadVibe);
  const vibeMap = useVibeStore((s) => s.vibes);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("background");
  const [zoneId, setZoneId] = useState<string>(selectedZoneId ?? "");
  const [globalAssetKey, setGlobalAssetKey] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [variants, setVariants] = useState<AssetEntry[]>([]);
  const [previewEntry, setPreviewEntry] = useState<AssetEntry | null>(null);
  const [promptGeneratedByLlm, setPromptGeneratedByLlm] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zoneId && selectedZoneId) setZoneId(selectedZoneId);
  }, [selectedZoneId, zoneId]);

  useEffect(() => {
    if (!zoneId) return;
    loadVibe(zoneId).catch(() => {});
  }, [loadVibe, zoneId]);

  const zoneOptions = useMemo(
    () => [...zones.entries()].map(([id, zone]) => ({ id, label: zone.data.zone || id })).sort((a, b) => a.label.localeCompare(b.label)),
    [zones],
  );
  const zoneVibe = zoneId ? vibeMap.get(zoneId) ?? "" : "";
  const generatedKey = slugify(globalAssetKey || title || description.slice(0, 40) || assetType);
  const variantGroup = generatedKey ? `custom:${zoneId || "global"}:${generatedKey}` : "";
  const context = zoneId && generatedKey
    ? { zone: zoneId, entity_type: "custom", entity_id: generatedKey }
    : undefined;
  const activeGlobalFile = globalAssetKey.trim() && config?.globalAssets?.[slugify(globalAssetKey)];
  const previewSrc = useImageSrc(previewEntry?.file_name || activeGlobalFile);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const defaultModel = resolveImageModel(imageProvider, settings?.image_model);
  const hasImageKey = !!(
    (imageProvider === "deepinfra" && settings?.deepinfra_api_key) ||
    (imageProvider === "runware" && settings?.runware_api_key) ||
    (imageProvider === "openai" && settings?.openai_api_key)
  );
  const hasLlmKey = !!(
    settings?.deepinfra_api_key ||
    settings?.anthropic_api_key ||
    settings?.openrouter_api_key
  );

  const refreshVariants = useCallback(async () => {
    if (!variantGroup) {
      setVariants([]);
      setPreviewEntry(null);
      return;
    }
    try {
      const next = await listVariants(variantGroup);
      setVariants(next);
      setPreviewEntry(next.find((entry) => entry.is_active) ?? next[0] ?? null);
    } catch {
      setVariants([]);
      setPreviewEntry(null);
    }
  }, [listVariants, variantGroup]);

  useEffect(() => {
    refreshVariants();
  }, [refreshVariants]);

  useEffect(() => {
    if (!description.trim()) {
      setPromptDraft("");
      return;
    }
    const activeVariant = variants.find((entry) => entry.is_active);
    if (activeVariant?.enhanced_prompt || activeVariant?.prompt) {
      setPromptDraft(activeVariant.enhanced_prompt || activeVariant.prompt);
      setPromptGeneratedByLlm(Boolean(activeVariant.enhanced_prompt));
      return;
    }
    setPromptDraft(buildCustomAssetPrompt(assetType, description, zoneVibe, artStyle, "worldbuilding"));
    setPromptGeneratedByLlm(false);
  }, [artStyle, assetType, description, variants, zoneVibe]);

  useEffect(() => {
    if (!globalAssetKey.trim()) return;
    setTitle((current) => current || globalAssetKey.trim());
  }, [globalAssetKey]);

  const persistGlobalAsset = useCallback((fileName: string) => {
    if (!globalAssetKey.trim()) return;
    const latest = useConfigStore.getState().config;
    if (!latest) return;
    const key = slugify(globalAssetKey);
    updateConfig({
      ...latest,
      globalAssets: {
        ...latest.globalAssets,
        [key]: fileName,
      },
    });
  }, [globalAssetKey, updateConfig]);

  const generatePrompt = useCallback(async () => {
    if (!description.trim()) return "";
    const systemPrompt = getCustomAssetSystemPrompt(artStyle, "worldbuilding");
    const userPrompt = [
      `Format: ${getFormatForAssetType(assetType)}`,
      title.trim() ? `Asset title: ${title.trim()}` : "",
      `User description: ${description.trim()}`,
      zoneVibe ? `Zone atmosphere: ${zoneVibe}` : "",
      `Required style suffix (adapt and preserve the aesthetic):\n${buildCustomAssetPrompt(assetType, description, zoneVibe, artStyle, "worldbuilding")}`,
    ].filter(Boolean).join("\n\n");

    return invoke<string>("llm_complete", { systemPrompt, userPrompt });
  }, [artStyle, assetType, description, title, zoneVibe]);

  const runGeneration = useCallback(async (prompt: string, activate: boolean) => {
    if (!defaultModel) throw new Error(`No image model configured for provider ${imageProvider}.`);

    const image = await invoke<GeneratedImage>(imageGenerateCommand(imageProvider), {
      prompt,
      negativePrompt: UNIVERSAL_NEGATIVE,
      model: defaultModel.id,
      width: dimensionsForAssetType(assetType).width,
      height: dimensionsForAssetType(assetType).height,
      steps: defaultModel.defaultSteps ?? 4,
      guidance: "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
      assetType,
      autoEnhance: !promptGeneratedByLlm,
      transparentBackground: imageProvider === "openai" && requestsTransparentBackground(assetType),
    });

    await acceptAsset(
      image,
      assetType,
      prompt,
      context,
      variantGroup || undefined,
      activate,
    );
    const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
    if (activate) persistGlobalAsset(fileName);
    return fileName;
  }, [acceptAsset, assetType, context, defaultModel, imageProvider, persistGlobalAsset, promptGeneratedByLlm, variantGroup]);

  const handleGeneratePrompt = async () => {
    if (!hasLlmKey || !description.trim()) return;
    setGeneratingPrompt(true);
    setError(null);
    try {
      setPromptDraft(await generatePrompt());
      setPromptGeneratedByLlm(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!hasImageKey || !promptDraft.trim()) return;
    setGeneratingImage(true);
    setError(null);
    try {
      await runGeneration(promptDraft, true);
      await loadAssets();
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateFour = async () => {
    if (!hasImageKey || !promptDraft.trim()) return;
    setBatchGenerating(true);
    setError(null);
    try {
      for (let i = 0; i < 4; i += 1) {
        await runGeneration(promptDraft, i === 0);
      }
      await loadAssets();
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleImport = async () => {
    const selected = await open({
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      multiple: false,
    });
    if (!selected) return;

    setImporting(true);
    setError(null);
    try {
      const entry = await importAsset(
        selected as string,
        assetType,
        context,
        variantGroup || undefined,
        Boolean(variantGroup),
      );
      if (variantGroup) {
        await setActiveVariant(variantGroup, entry.id).catch(() => {});
      }
      persistGlobalAsset(entry.file_name);
      await loadAssets();
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleVariantSelect = async (entry: AssetEntry) => {
    if (!variantGroup) return;
    try {
      await setActiveVariant(variantGroup, entry.id);
      setPreviewEntry(entry);
      persistGlobalAsset(entry.file_name);
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    }
  };

  if (!AI_ENABLED) return null;

  return (
    <section className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel p-5 shadow-section">
      <div className="mb-4">
        <h2 className="font-display text-xl text-text-primary">Custom asset studio</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Generate free-form worldbuilding assets, optionally grounded in a zone vibe and registered into global assets.
        </p>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-2xs uppercase tracking-ui text-text-muted">Asset title</div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Moonwell loading vignette"
                className="w-full rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-3 text-sm text-text-primary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
              />
            </div>
            <div>
              <div className="mb-1 text-2xs uppercase tracking-ui text-text-muted">Global asset key</div>
              <input
                value={globalAssetKey}
                onChange={(event) => setGlobalAssetKey(event.target.value)}
                placeholder="loading_moonwell"
                className="w-full rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-3 text-sm text-text-primary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-2xs uppercase tracking-ui text-text-muted">Asset type</div>
              <select
                value={assetType}
                onChange={(event) => setAssetType(event.target.value as AssetType)}
                className="w-full rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-3 text-sm text-text-primary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
              >
                {CUSTOM_ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ASSET_TEMPLATES[type]?.label ?? type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-2xs uppercase tracking-ui text-text-muted">Zone vibe context</div>
              <select
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                className="w-full rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-3 text-sm text-text-primary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
              >
                <option value="">No zone context</option>
                {zoneOptions.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1 text-2xs uppercase tracking-ui text-text-muted">Creative brief</div>
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setPromptGeneratedByLlm(false);
              }}
              rows={5}
              placeholder="Describe the asset you want. The generator will translate it into your world's visual style."
              className="w-full resize-y rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-3 text-sm leading-6 text-text-secondary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>

          {zoneVibe && (
            <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim-light px-4 py-3">
              <div className="text-2xs uppercase tracking-ui text-text-muted">Selected zone vibe</div>
              <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-text-secondary">{zoneVibe}</div>
            </div>
          )}

          <div>
            <div className="mb-1 text-2xs uppercase tracking-ui text-text-muted">Prompt draft</div>
            <textarea
              value={promptDraft}
              onChange={(event) => {
                setPromptDraft(event.target.value);
                setPromptGeneratedByLlm(false);
              }}
              rows={10}
              className="w-full resize-y rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-3 font-mono text-xs leading-6 text-text-secondary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
              placeholder="Generate a prompt from your brief..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleGeneratePrompt}
              disabled={!hasLlmKey || !description.trim() || generatingPrompt || generatingImage || batchGenerating}
              className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
            >
              {generatingPrompt ? <span className="flex items-center gap-1.5"><Spinner />Generating prompt</span> : "Generate prompt"}
            </button>
            <button
              onClick={handleGenerateImage}
              disabled={!hasImageKey || !promptDraft.trim() || generatingPrompt || generatingImage || batchGenerating}
              className="rounded-full border border-[var(--border-accent-subtle)] bg-gradient-active-strong px-4 py-2 text-xs font-medium text-text-primary transition hover:brightness-110 disabled:opacity-50"
            >
              {generatingImage ? <span className="flex items-center gap-1.5"><Spinner />Generating image</span> : "Generate image"}
            </button>
            <button
              onClick={handleGenerateFour}
              disabled={!hasImageKey || !promptDraft.trim() || generatingPrompt || generatingImage || batchGenerating}
              className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
            >
              {batchGenerating ? <span className="flex items-center gap-1.5"><Spinner />Generating 4</span> : "Generate 4"}
            </button>
            <button
              onClick={handleImport}
              disabled={importing || generatingPrompt || generatingImage || batchGenerating}
              className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
            >
              {importing ? <span className="flex items-center gap-1.5"><Spinner />Importing</span> : "Import image"}
            </button>
          </div>

          {error && (
            <InlineError error={error} onDismiss={() => setError(null)} onRetry={handleGenerateImage} />
          )}
        </div>

        <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-2xs uppercase tracking-ui text-text-muted">Preview</div>
              <h3 className="mt-1 font-display text-2xl text-text-primary">{title.trim() || "Custom asset"}</h3>
              <div className="mt-1 text-xs text-text-secondary">
                {globalAssetKey.trim() ? `images.globalAssets.${slugify(globalAssetKey)}` : "Library-only asset"}
              </div>
            </div>
            <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-2xs uppercase tracking-label text-text-muted">
              {variants.length} variants
            </span>
          </div>

          <div className="flex min-h-[22rem] items-center justify-center overflow-hidden rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--bg-preview)] p-4">
            {previewSrc ? (
              <img src={previewSrc} alt={title || "Custom asset"} loading="lazy" className="max-h-[30rem] max-w-full rounded-2xl object-contain shadow-section" />
            ) : (
              <div className="text-center text-sm text-text-muted">Generate or import an asset to review it here.</div>
            )}
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim-light px-4 py-3">
            <div className="text-2xs uppercase tracking-ui text-text-muted">Registration</div>
            <div className="mt-2 text-xs leading-6 text-text-secondary">
              {globalAssetKey.trim()
                ? `Active variant is written into application config under images.globalAssets.${slugify(globalAssetKey)}.`
                : "Leave the global asset key blank to keep this as a library-only custom asset."}
            </div>
          </div>

          {variants.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-2xs uppercase tracking-ui text-text-muted">Variant strip</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {variants.map((entry) => (
                  <VariantCard key={entry.id} entry={entry} assetsDir={assetsDir} onClick={() => handleVariantSelect(entry)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
