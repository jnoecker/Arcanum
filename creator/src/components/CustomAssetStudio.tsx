import { useCallback, useEffect, useMemo, useState } from "react";
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
import { IMAGE_MODELS, type AssetEntry, type AssetType, type GeneratedImage } from "@/types/assets";

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
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] border-2 transition ${
        entry.is_active
          ? "border-accent shadow-[0_0_0_1px_rgba(168,151,210,0.45)]"
          : "border-white/12 hover:border-[rgba(184,216,232,0.25)]"
      }`}
    >
      {thumbSrc ? (
        <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-white/6" />
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
  const availableModels = IMAGE_MODELS.filter((model) => model.provider === imageProvider);
  const defaultModel = availableModels[0];
  const hasImageKey = !!(
    (imageProvider === "deepinfra" && settings?.deepinfra_api_key) ||
    (imageProvider === "runware" && settings?.runware_api_key)
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
      return;
    }
    setPromptDraft(buildCustomAssetPrompt(assetType, description, zoneVibe, artStyle));
  }, [artStyle, assetType, description, variants, zoneVibe]);

  useEffect(() => {
    if (!globalAssetKey.trim()) return;
    setTitle((current) => current || globalAssetKey.trim());
  }, [globalAssetKey]);

  const persistGlobalAsset = useCallback((fileName: string) => {
    if (!config || !globalAssetKey.trim()) return;
    const key = slugify(globalAssetKey);
    updateConfig({
      ...config,
      globalAssets: {
        ...config.globalAssets,
        [key]: fileName,
      },
    });
  }, [config, globalAssetKey, updateConfig]);

  const generatePrompt = useCallback(async () => {
    if (!description.trim()) return "";
    const systemPrompt = getCustomAssetSystemPrompt(artStyle);
    const userPrompt = [
      `Format: ${getFormatForAssetType(assetType)}`,
      title.trim() ? `Asset title: ${title.trim()}` : "",
      `User description: ${description.trim()}`,
      zoneVibe ? `Zone atmosphere: ${zoneVibe}` : "",
      `Required style suffix (adapt and preserve the aesthetic):\n${buildCustomAssetPrompt(assetType, description, zoneVibe, artStyle)}`,
    ].filter(Boolean).join("\n\n");

    return invoke<string>("llm_complete", { systemPrompt, userPrompt });
  }, [artStyle, assetType, description, title, zoneVibe]);

  const runGeneration = useCallback(async (prompt: string, activate: boolean) => {
    if (!defaultModel) throw new Error(`No image model configured for provider ${imageProvider}.`);

    const image = await invoke<GeneratedImage>(imageProvider === "runware" ? "runware_generate_image" : "generate_image", {
      prompt,
      negativePrompt: UNIVERSAL_NEGATIVE,
      model: defaultModel.id,
      width: dimensionsForAssetType(assetType).width,
      height: dimensionsForAssetType(assetType).height,
      steps: defaultModel.defaultSteps ?? 4,
      guidance: "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
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
  }, [acceptAsset, assetType, context, defaultModel, imageProvider, persistGlobalAsset, variantGroup]);

  const handleGeneratePrompt = async () => {
    if (!hasLlmKey || !description.trim()) return;
    setGeneratingPrompt(true);
    setError(null);
    try {
      setPromptDraft(await generatePrompt());
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
    await setActiveVariant(variantGroup, entry.id);
    setPreviewEntry(entry);
    persistGlobalAsset(entry.file_name);
    await refreshVariants();
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
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
              <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-text-muted">Asset title</div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Moonwell loading vignette"
                className="w-full rounded-[16px] border border-white/10 bg-[rgba(24,30,45,0.72)] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-[rgba(184,216,232,0.3)]"
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-text-muted">Global asset key</div>
              <input
                value={globalAssetKey}
                onChange={(event) => setGlobalAssetKey(event.target.value)}
                placeholder="loading_moonwell"
                className="w-full rounded-[16px] border border-white/10 bg-[rgba(24,30,45,0.72)] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-[rgba(184,216,232,0.3)]"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-text-muted">Asset type</div>
              <select
                value={assetType}
                onChange={(event) => setAssetType(event.target.value as AssetType)}
                className="w-full rounded-[16px] border border-white/10 bg-[rgba(24,30,45,0.72)] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-[rgba(184,216,232,0.3)]"
              >
                {CUSTOM_ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ASSET_TEMPLATES[type]?.label ?? type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-text-muted">Zone vibe context</div>
              <select
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                className="w-full rounded-[16px] border border-white/10 bg-[rgba(24,30,45,0.72)] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-[rgba(184,216,232,0.3)]"
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
            <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-text-muted">Creative brief</div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder="Describe the asset you want. The generator will translate it into Surreal Gentle Magic art direction."
              className="w-full resize-y rounded-[20px] border border-white/10 bg-[rgba(24,30,45,0.72)] px-4 py-3 text-sm leading-6 text-text-secondary outline-none transition focus:border-[rgba(184,216,232,0.3)]"
            />
          </div>

          {zoneVibe && (
            <div className="rounded-[18px] border border-white/8 bg-[rgba(24,30,45,0.46)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Selected zone vibe</div>
              <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-text-secondary">{zoneVibe}</div>
            </div>
          )}

          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-text-muted">Prompt draft</div>
            <textarea
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              rows={10}
              className="w-full resize-y rounded-[20px] border border-white/10 bg-[rgba(24,30,45,0.72)] px-4 py-3 font-mono text-[12px] leading-6 text-text-secondary outline-none transition focus:border-[rgba(184,216,232,0.3)]"
              placeholder="Generate a prompt from your brief..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleGeneratePrompt}
              disabled={!hasLlmKey || !description.trim() || generatingPrompt || generatingImage || batchGenerating}
              className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
            >
              {generatingPrompt ? "Generating prompt..." : "Generate prompt"}
            </button>
            <button
              onClick={handleGenerateImage}
              disabled={!hasImageKey || !promptDraft.trim() || generatingPrompt || generatingImage || batchGenerating}
              className="rounded-full border border-[rgba(168,151,210,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.22),rgba(140,174,201,0.14))] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:-translate-y-0.5 disabled:opacity-50"
            >
              {generatingImage ? "Generating image..." : "Generate image"}
            </button>
            <button
              onClick={handleGenerateFour}
              disabled={!hasImageKey || !promptDraft.trim() || generatingPrompt || generatingImage || batchGenerating}
              className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
            >
              {batchGenerating ? "Generating 4..." : "Generate 4"}
            </button>
            <button
              onClick={handleImport}
              disabled={importing || generatingPrompt || generatingImage || batchGenerating}
              className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import image"}
            </button>
          </div>

          {error && (
            <div className="rounded-[16px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-xs text-status-error">
              {error}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Preview</div>
              <h3 className="mt-1 font-display text-2xl text-text-primary">{title.trim() || "Custom asset"}</h3>
              <div className="mt-1 text-xs text-text-secondary">
                {globalAssetKey.trim() ? `images.globalAssets.${slugify(globalAssetKey)}` : "Library-only asset"}
              </div>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-muted">
              {variants.length} variants
            </span>
          </div>

          <div className="flex min-h-[22rem] items-center justify-center overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(34,41,60,0.8),rgba(28,34,52,0.88))] p-4">
            {previewSrc ? (
              <img src={previewSrc} alt={title || "Custom asset"} className="max-h-[30rem] max-w-full rounded-[18px] object-contain shadow-[0_18px_44px_rgba(8,10,18,0.26)]" />
            ) : (
              <div className="text-center text-sm text-text-muted">Generate or import an asset to review it here.</div>
            )}
          </div>

          <div className="mt-3 rounded-[18px] border border-white/8 bg-[rgba(24,30,45,0.46)] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Registration</div>
            <div className="mt-2 text-xs leading-6 text-text-secondary">
              {globalAssetKey.trim()
                ? `Active variant is written into application config under images.globalAssets.${slugify(globalAssetKey)}.`
                : "Leave the global asset key blank to keep this as a library-only custom asset."}
            </div>
          </div>

          {variants.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-text-muted">Variant strip</div>
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
