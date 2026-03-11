import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useVibeStore } from "@/stores/vibeStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { composePrompt, UNIVERSAL_NEGATIVE, type ArtStyle } from "@/lib/arcanumPrompts";
import { fillPortraitTemplate, generatePortraitTemplate, type PortraitPromptTemplate } from "@/lib/portraitPromptGen";
import { IMAGE_MODELS, type AssetEntry, type GeneratedImage } from "@/types/assets";

type PortraitKind = "race" | "class";
type PortraitKey = `${PortraitKind}:${string}`;

interface PortraitTarget {
  kind: PortraitKind;
  id: string;
  label: string;
  image?: string;
  context: string;
}

function portraitVariantGroup(target: PortraitTarget): string {
  return `${target.kind}::${target.id}`;
}

function portraitAssetType(target: PortraitTarget): "race_portrait" | "class_portrait" {
  return target.kind === "race" ? "race_portrait" : "class_portrait";
}

function dimensionsForPortrait(kind: PortraitKind): { width: number; height: number } {
  return kind === "race" ? { width: 512, height: 768 } : { width: 512, height: 768 };
}

function buildRaceContext(id: string, race: NonNullable<ReturnType<typeof useConfigStore.getState>["config"]>["races"][string]): string {
  const parts = [`Race: ${race.displayName || id}`];
  if (race.description) parts.push(`Description: ${race.description}`);
  if (race.backstory) parts.push(`Backstory: ${race.backstory}`);
  if (race.traits?.length) parts.push(`Traits: ${race.traits.join(", ")}`);
  if (race.bodyDescription) parts.push(`Body description: ${race.bodyDescription}`);
  return parts.join("\n");
}

function buildClassContext(id: string, cls: NonNullable<ReturnType<typeof useConfigStore.getState>["config"]>["classes"][string]): string {
  const parts = [`Class: ${cls.displayName || id}`];
  if (cls.description) parts.push(`Description: ${cls.description}`);
  if (cls.backstory) parts.push(`Backstory: ${cls.backstory}`);
  if (cls.primaryStat) parts.push(`Primary stat: ${cls.primaryStat}`);
  if (cls.outfitDescription) parts.push(`Outfit description: ${cls.outfitDescription}`);
  if (cls.showcaseRace) parts.push(`Showcase race: ${cls.showcaseRace}`);
  parts.push(`HP/level: ${cls.hpPerLevel}, Mana/level: ${cls.manaPerLevel}`);
  return parts.join("\n");
}

function VariantCard({ entry, assetsDir, onClick }: { entry: AssetEntry; assetsDir: string; onClick: () => void }) {
  const thumbSrc = useImageSrc(`${assetsDir}\\images\\${entry.file_name}`);

  return (
    <button
      onClick={onClick}
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] border-2 transition ${
        entry.is_active ? "border-accent shadow-[0_0_0_1px_rgba(168,151,210,0.45)]" : "border-white/12 hover:border-[rgba(184,216,232,0.25)]"
      }`}
    >
      {thumbSrc ? <img src={thumbSrc} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/6" />}
    </button>
  );
}

export function PortraitStudio({ selectedZoneId }: { selectedZoneId: string | null }) {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const listVariants = useAssetStore((s) => s.listVariants);
  const setActiveVariant = useAssetStore((s) => s.setActiveVariant);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const loadVibe = useVibeStore((s) => s.loadVibe);
  const vibe = useVibeStore((s) => selectedZoneId ? s.vibes.get(selectedZoneId) ?? "" : "");

  const [selectedKey, setSelectedKey] = useState<PortraitKey | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [template, setTemplate] = useState<PortraitPromptTemplate | null>(null);
  const [variants, setVariants] = useState<AssetEntry[]>([]);
  const [previewEntry, setPreviewEntry] = useState<AssetEntry | null>(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState<PortraitKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedZoneId) loadVibe(selectedZoneId).catch(() => {});
  }, [loadVibe, selectedZoneId]);

  const targets = useMemo<PortraitTarget[]>(() => {
    if (!config) return [];
    const races = Object.entries(config.races).map(([id, race]) => ({
      kind: "race" as const,
      id,
      label: race.displayName || id,
      image: race.image,
      context: buildRaceContext(id, race),
    }));
    const classes = Object.entries(config.classes).map(([id, cls]) => ({
      kind: "class" as const,
      id,
      label: cls.displayName || id,
      image: cls.image,
      context: buildClassContext(id, cls),
    }));
    return [...races, ...classes];
  }, [config]);

  const groupedTargets = useMemo(() => ({
    race: targets.filter((target) => target.kind === "race"),
    class: targets.filter((target) => target.kind === "class"),
  }), [targets]);

  useEffect(() => {
    if (selectedKey && targets.some((target) => `${target.kind}:${target.id}` === selectedKey)) return;
    const first = targets.find((target) => target.image) ?? targets[0];
    setSelectedKey(first ? `${first.kind}:${first.id}` : null);
  }, [selectedKey, targets]);

  const selectedTarget = useMemo(() => {
    if (!selectedKey) return null;
    return targets.find((target) => `${target.kind}:${target.id}` === selectedKey) ?? null;
  }, [selectedKey, targets]);

  const selectedVariantGroup = selectedTarget ? portraitVariantGroup(selectedTarget) : "";
  const currentImage = selectedTarget?.image;
  const selectedSrc = useImageSrc(previewEntry?.file_name || currentImage);

  const refreshVariants = useCallback(async () => {
    if (!selectedVariantGroup) {
      setVariants([]);
      setPreviewEntry(null);
      return;
    }
    try {
      const next = await listVariants(selectedVariantGroup);
      setVariants(next);
      setPreviewEntry(next.find((entry) => entry.is_active) ?? next[0] ?? null);
    } catch {
      setVariants([]);
      setPreviewEntry(null);
    }
  }, [listVariants, selectedVariantGroup]);

  useEffect(() => {
    refreshVariants();
  }, [refreshVariants]);

  useEffect(() => {
    if (!selectedTarget) {
      setPromptDraft("");
      return;
    }
    const activeVariant = variants.find((entry) => entry.is_active);
    if (activeVariant?.enhanced_prompt || activeVariant?.prompt) {
      setPromptDraft(activeVariant.enhanced_prompt || activeVariant.prompt);
      return;
    }
    if (template) {
      setPromptDraft(fillPortraitTemplate(template, { portraitType: selectedTarget.kind, key: selectedTarget.id }));
      return;
    }
    setPromptDraft(composePrompt(selectedTarget.kind === "race" ? "race_portrait" : "class_portrait", artStyle as ArtStyle, `${selectedTarget.kind}: ${selectedTarget.label}`));
  }, [artStyle, selectedTarget, template, variants]);

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

  const persistPortrait = useCallback((target: PortraitTarget, fileName: string) => {
    if (!config) return;
    if (target.kind === "race") {
      const existing = config.races[target.id]!;
      updateConfig({
        ...config,
        races: {
          ...config.races,
          [target.id]: { ...existing, image: fileName },
        },
      });
      return;
    }
    const existing = config.classes[target.id]!;
    updateConfig({
      ...config,
      classes: {
        ...config.classes,
        [target.id]: { ...existing, image: fileName },
      },
    });
  }, [config, updateConfig]);

  const generateTemplateAction = async () => {
    if (!config || !hasLlmKey) return;
    setGeneratingTemplate(true);
    setError(null);
    try {
      const next = await generatePortraitTemplate(Object.keys(config.races), Object.keys(config.classes), vibe || "Dreamy character creation portraits for a magical world.");
      setTemplate(next);
      if (selectedTarget) {
        setPromptDraft(fillPortraitTemplate(next, { portraitType: selectedTarget.kind, key: selectedTarget.id }));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!selectedTarget) return;
    setGeneratingPrompt(true);
    setError(null);
    try {
      if (template) {
        setPromptDraft(fillPortraitTemplate(template, { portraitType: selectedTarget.kind, key: selectedTarget.id }));
      } else {
        setPromptDraft(composePrompt(selectedTarget.kind === "race" ? "race_portrait" : "class_portrait", artStyle as ArtStyle, `${selectedTarget.kind}: ${selectedTarget.label}`));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const runGeneration = useCallback(async (target: PortraitTarget, prompt: string, activate: boolean) => {
    if (!defaultModel) throw new Error(`No image model configured for provider ${imageProvider}.`);

    const image = await invoke<GeneratedImage>(imageProvider === "runware" ? "runware_generate_image" : "generate_image", {
      prompt,
      negativePrompt: UNIVERSAL_NEGATIVE,
      model: defaultModel.id,
      width: dimensionsForPortrait(target.kind).width,
      height: dimensionsForPortrait(target.kind).height,
      steps: defaultModel.defaultSteps ?? 4,
      guidance: "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
    });

    await acceptAsset(
      image,
      portraitAssetType(target),
      prompt,
      { zone: "", entity_type: target.kind, entity_id: target.id },
      portraitVariantGroup(target),
      activate,
    );

    const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
    if (activate) persistPortrait(target, fileName);
  }, [acceptAsset, defaultModel, imageProvider, persistPortrait]);

  const handleGenerateImage = async () => {
    if (!selectedTarget || !hasImageKey || !promptDraft.trim()) return;
    setGeneratingImage(true);
    setError(null);
    try {
      await runGeneration(selectedTarget, promptDraft, true);
      await loadAssets();
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleBatchGenerate = async (kind: PortraitKind) => {
    if (!hasImageKey) return;
    setBatchGenerating(kind);
    setError(null);
    try {
      const pending = groupedTargets[kind].filter((target) => !target.image);
      for (const target of pending) {
        const prompt = template
          ? fillPortraitTemplate(template, { portraitType: target.kind, key: target.id })
          : composePrompt(target.kind === "race" ? "race_portrait" : "class_portrait", artStyle as ArtStyle, `${target.kind}: ${target.label}`);
        await runGeneration(target, prompt, true);
      }
      await loadAssets();
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    } finally {
      setBatchGenerating(null);
    }
  };

  const handleVariantSelect = async (entry: AssetEntry) => {
    if (!selectedTarget) return;
    await setActiveVariant(selectedVariantGroup, entry.id);
    setPreviewEntry(entry);
    persistPortrait(selectedTarget, entry.file_name);
    await refreshVariants();
  };

  if (!config) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-text-primary">Portrait studio</h2>
          <p className="mt-1 text-sm text-text-secondary">Batch and review race and class portraits with a shared portrait template workflow.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateTemplateAction}
            disabled={!hasLlmKey || generatingTemplate}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
          >
            {generatingTemplate ? "Generating template..." : template ? "Regenerate template" : "Generate template"}
          </button>
          <button
            onClick={() => handleBatchGenerate("race")}
            disabled={!hasImageKey || batchGenerating !== null}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
          >
            {batchGenerating === "race" ? "Generating races..." : "Generate missing races"}
          </button>
          <button
            onClick={() => handleBatchGenerate("class")}
            disabled={!hasImageKey || batchGenerating !== null}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
          >
            {batchGenerating === "class" ? "Generating classes..." : "Generate missing classes"}
          </button>
        </div>
      </div>

      {!selectedTarget ? (
        <div className="rounded-[20px] border border-dashed border-white/12 bg-black/12 px-4 py-8 text-sm text-text-muted">
          Define races or classes in config to start generating portraits.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.62fr_1.38fr]">
          <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
            <div className="max-h-[44rem] overflow-y-auto pr-1">
              {(["race", "class"] as PortraitKind[]).map((kind) => (
                <div key={kind} className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{kind === "race" ? "Races" : "Classes"}</div>
                    <div className="text-[11px] text-text-muted">{groupedTargets[kind].length}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {groupedTargets[kind].map((target) => {
                      const key: PortraitKey = `${target.kind}:${target.id}`;
                      const selected = selectedKey === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedKey(key)}
                          className={`flex items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                            selected ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.16),rgba(140,174,201,0.12))]" : "border-white/8 bg-black/10 hover:bg-white/8"
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${target.image ? "bg-status-success" : "bg-text-muted/50"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-text-primary">{target.label}</div>
                            <div className="truncate text-[11px] text-text-muted">{target.id}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{selectedTarget.kind}</div>
                  <h3 className="mt-1 font-display text-2xl text-text-primary">{selectedTarget.label}</h3>
                  <div className="mt-1 text-xs text-text-secondary">{selectedTarget.id}</div>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-muted">{variants.length} variants</span>
              </div>

              <div className="flex min-h-[22rem] items-center justify-center overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(34,41,60,0.8),rgba(28,34,52,0.88))] p-4">
                {selectedSrc ? <img src={selectedSrc} alt={selectedTarget.label} className="max-h-[30rem] max-w-full rounded-[18px] object-contain shadow-[0_18px_44px_rgba(8,10,18,0.26)]" /> : <div className="text-center text-sm text-text-muted">No portrait yet.</div>}
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

            <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
              <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-text-muted">Prompt engineering</div>
              {vibe && (
                <div className="mb-3 rounded-[18px] border border-white/8 bg-[rgba(24,30,45,0.46)] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Portrait vibe context</div>
                  <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-text-secondary">{vibe}</div>
                </div>
              )}
              <textarea
                value={promptDraft}
                onChange={(event) => setPromptDraft(event.target.value)}
                rows={14}
                className="w-full resize-y rounded-[20px] border border-white/10 bg-[rgba(24,30,45,0.72)] px-4 py-3 font-mono text-[12px] leading-6 text-text-secondary outline-none transition focus:border-[rgba(184,216,232,0.3)]"
                placeholder="Generate a portrait prompt..."
              />

              <div className="mt-3 rounded-[18px] border border-white/8 bg-[rgba(24,30,45,0.46)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Portrait context</div>
                <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-text-secondary">{selectedTarget.context}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleGeneratePrompt}
                  disabled={generatingPrompt}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                >
                  {generatingPrompt ? "Generating prompt..." : "Generate prompt"}
                </button>
                <button
                  onClick={handleGenerateImage}
                  disabled={!hasImageKey || !promptDraft.trim() || generatingImage}
                  className="rounded-full border border-[rgba(168,151,210,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.22),rgba(140,174,201,0.14))] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {generatingImage ? "Generating image..." : "Generate image"}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-[16px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-xs text-status-error">{error}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
