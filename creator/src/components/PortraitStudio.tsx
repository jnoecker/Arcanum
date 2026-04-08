import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useVibeStore } from "@/stores/vibeStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { composePrompt, UNIVERSAL_NEGATIVE, type ArtStyle } from "@/lib/arcanumPrompts";
import { fillPortraitTemplate, generatePortraitTemplate, type PortraitPromptTemplate } from "@/lib/portraitPromptGen";
import { imageGenerateCommand, resolveImageModel, type AssetEntry, type GeneratedImage } from "@/types/assets";
import { InlineError, Spinner } from "@/components/ui/FormWidgets";

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

function dimensionsForPortrait(_kind: PortraitKind): { width: number; height: number } {
  return { width: 512, height: 768 };
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
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 transition ${
        entry.is_active ? "border-accent shadow-[0_0_0_1px_var(--border-accent-ring)]" : "border-[var(--chrome-stroke-strong)] hover:border-[var(--border-glow)]"
      }`}
    >
      {thumbSrc ? <img src={thumbSrc} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-[var(--chrome-highlight)]" />}
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

  const persistPortrait = useCallback((target: PortraitTarget, fileName: string) => {
    const latest = useConfigStore.getState().config;
    if (!latest) return;
    if (target.kind === "race") {
      const existing = latest.races[target.id];
      if (!existing) return;
      updateConfig({
        ...latest,
        races: {
          ...latest.races,
          [target.id]: { ...existing, image: fileName },
        },
      });
      return;
    }
    const existing = latest.classes[target.id];
    if (!existing) return;
    updateConfig({
      ...latest,
      classes: {
        ...latest.classes,
        [target.id]: { ...existing, image: fileName },
      },
    });
  }, [updateConfig]);

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

  const handleGeneratePrompt = () => {
    if (!selectedTarget) return;
    setError(null);
    try {
      if (template) {
        setPromptDraft(fillPortraitTemplate(template, { portraitType: selectedTarget.kind, key: selectedTarget.id }));
      } else {
        setPromptDraft(composePrompt(selectedTarget.kind === "race" ? "race_portrait" : "class_portrait", artStyle as ArtStyle, `${selectedTarget.kind}: ${selectedTarget.label}`));
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const runGeneration = useCallback(async (target: PortraitTarget, prompt: string, activate: boolean) => {
    if (!defaultModel) throw new Error(`No image model configured for provider ${imageProvider}.`);
    const assetType = portraitAssetType(target);

    const image = await invoke<GeneratedImage>(imageGenerateCommand(imageProvider), {
      prompt,
      negativePrompt: UNIVERSAL_NEGATIVE,
      model: defaultModel.id,
      width: dimensionsForPortrait(target.kind).width,
      height: dimensionsForPortrait(target.kind).height,
      steps: defaultModel.defaultSteps ?? 4,
      guidance: "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
      assetType,
    });

    await acceptAsset(
      image,
      assetType,
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
      const pending = groupedTargets[kind];
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
    try {
      await setActiveVariant(selectedVariantGroup, entry.id);
      setPreviewEntry(entry);
      persistPortrait(selectedTarget, entry.file_name);
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    }
  };

  if (!config) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel p-5 shadow-section">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-text-primary">Portrait studio</h2>
          <p className="mt-1 text-sm text-text-secondary">Race and class portraits.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateTemplateAction}
            disabled={!hasLlmKey || generatingTemplate}
            className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
          >
            {generatingTemplate ? <span className="flex items-center gap-1.5"><Spinner />Generating template</span> : template ? "Regenerate template" : "Generate template"}
          </button>
          <button
            onClick={() => handleBatchGenerate("race")}
            disabled={!hasImageKey || batchGenerating !== null}
            className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
          >
            {batchGenerating === "race" ? <span className="flex items-center gap-1.5"><Spinner />Generating races</span> : "Generate all races"}
          </button>
          <button
            onClick={() => handleBatchGenerate("class")}
            disabled={!hasImageKey || batchGenerating !== null}
            className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
          >
            {batchGenerating === "class" ? <span className="flex items-center gap-1.5"><Spinner />Generating classes</span> : "Generate all classes"}
          </button>
        </div>
      </div>

      {!selectedTarget ? (
        <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill)] px-4 py-8 text-sm text-text-muted">
          Define races or classes in config to start generating portraits.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.62fr_1.38fr]">
          <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
            <div className="max-h-[44rem] overflow-y-auto pr-1">
              {(["race", "class"] as PortraitKind[]).map((kind) => (
                <div key={kind} className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-2xs uppercase tracking-ui text-text-muted">{kind === "race" ? "Races" : "Classes"}</div>
                    <div className="text-2xs text-text-muted">{groupedTargets[kind].length}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {groupedTargets[kind].map((target) => {
                      const key: PortraitKey = `${target.kind}:${target.id}`;
                      const selected = selectedKey === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedKey(key)}
                          className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                            selected ? "border-border-active bg-gradient-active" : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] hover:bg-[var(--chrome-highlight-strong)]"
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${target.image ? "bg-status-success" : "bg-text-muted/50"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-text-primary">{target.label}</div>
                            <div className="truncate text-2xs text-text-muted">{target.id}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {/* Preview row — wide horizontal card */}
            <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
              <div className="flex gap-5">
                <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--chrome-stroke)] bg-[linear-gradient(180deg,rgba(34,41,60,0.8),rgba(28,34,52,0.88))] p-3" style={{ width: "12rem", height: "16rem" }}>
                  {selectedSrc ? <img src={selectedSrc} alt={selectedTarget.label} className="max-h-full max-w-full rounded-xl object-contain shadow-section" /> : <div className="text-center text-xs text-text-muted">No portrait yet</div>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xs uppercase tracking-ui text-text-muted">{selectedTarget.kind}</div>
                      <h3 className="mt-0.5 font-display text-xl text-text-primary">{selectedTarget.label}</h3>
                      <div className="mt-0.5 text-xs text-text-secondary">{selectedTarget.id}</div>
                    </div>
                    <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-2xs uppercase tracking-label text-text-muted">{variants.length} variants</span>
                  </div>

                  {variants.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1.5 text-2xs uppercase tracking-ui text-text-muted">Variants</div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {variants.map((entry) => (
                          <VariantCard key={entry.id} entry={entry} assetsDir={assetsDir} onClick={() => handleVariantSelect(entry)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Prompt engineering — full width */}
            <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
              <div className="mb-3 text-2xs uppercase tracking-ui text-text-muted">Prompt engineering</div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <textarea
                  value={promptDraft}
                  onChange={(event) => setPromptDraft(event.target.value)}
                  rows={8}
                  className="w-full resize-y rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-3 font-mono text-xs leading-6 text-text-secondary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
                  placeholder="Generate a portrait prompt..."
                />

                <div className="flex flex-col gap-3">
                  {vibe && (
                    <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim-light px-4 py-3">
                      <div className="text-2xs uppercase tracking-ui text-text-muted">Portrait vibe context</div>
                      <div className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-text-secondary">{vibe}</div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim-light px-4 py-3">
                    <div className="text-2xs uppercase tracking-ui text-text-muted">Portrait context</div>
                    <div className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-text-secondary">{selectedTarget.context}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleGeneratePrompt}
                  className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Generate prompt
                </button>
                <button
                  onClick={handleGenerateImage}
                  disabled={!hasImageKey || !promptDraft.trim() || generatingImage}
                  className="rounded-full border border-[var(--border-accent-subtle)] bg-gradient-active-strong px-4 py-2 text-xs font-medium text-text-primary transition hover:brightness-110 disabled:opacity-50"
                >
                  {generatingImage ? <span className="flex items-center gap-1.5"><Spinner />Generating image</span> : "Generate image"}
                </button>
              </div>

              {error && (
                <div className="mt-4">
                  <InlineError error={error} onDismiss={() => setError(null)} onRetry={handleGenerateImage} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
