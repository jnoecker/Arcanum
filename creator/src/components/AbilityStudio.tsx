import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { Spinner, InlineError } from "@/components/ui/FormWidgets";
import { useConfigStore } from "@/stores/configStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { composePrompt, UNIVERSAL_NEGATIVE, type ArtStyle } from "@/lib/arcanumPrompts";
import {
  generateAbilityPrompt,
  generateStatusEffectPrompt,
  generateAbilityTemplate,
  fillAbilityTemplate,
  fillStatusEffectTemplate,
  enhanceAbilityPrompt,
  type AbilityPromptTemplate,
} from "@/lib/abilityPromptGen";
import { imageGenerateCommand, resolveImageModel, requestsTransparentBackground, type AssetEntry, type GeneratedImage } from "@/types/assets";
import type { AbilityDefinitionConfig, StatusEffectDefinitionConfig } from "@/types/config";

type AbilityStudioTab = string;
type StudioTargetKind = "ability" | "status_effect";
type TargetKey = `${StudioTargetKind}:${string}`;

interface StudioTarget {
  kind: StudioTargetKind;
  id: string;
  label: string;
  subtitle: string;
  image?: string;
  ability?: AbilityDefinitionConfig;
  statusEffect?: StatusEffectDefinitionConfig;
}

const STATUS_TAB = "__status_effects__";
const GENERAL_TAB = "__general__";

function buildAbilityContext(id: string, ability: AbilityDefinitionConfig): string {
  const parts = [
    `Ability: ${ability.displayName} (${id})`,
    ability.description ? `Description: ${ability.description}` : null,
    ability.requiredClass ? `Class: ${ability.requiredClass}` : null,
    `Effect: ${ability.effect.type}`,
    `Target: ${ability.targetType}`,
    `Level required: ${ability.levelRequired}`,
    `Mana cost: ${ability.manaCost}`,
  ];
  return parts.filter(Boolean).join("\n");
}

function buildStatusEffectContext(id: string, effect: StatusEffectDefinitionConfig): string {
  const parts = [
    `Status effect: ${effect.displayName} (${id})`,
    `Effect type: ${effect.effectType}`,
    effect.durationMs ? `Duration: ${(effect.durationMs / 1000).toFixed(0)}s` : null,
    effect.tickMinValue != null || effect.tickValue != null
      ? `Ticking effect: ${effect.tickMinValue ?? effect.tickValue ?? 0}-${effect.tickMaxValue ?? effect.tickValue ?? 0}`
      : null,
    effect.stackBehavior ? `Stacking: ${effect.stackBehavior}` : null,
    effect.shieldAmount ? `Shield amount: ${effect.shieldAmount}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

function abilityVariantGroup(target: StudioTarget): string {
  return `${target.kind}:${target.id}`;
}

function assetTypeForTarget(target: StudioTarget): "ability_icon" | "status_effect_icon" {
  return target.kind === "ability" ? "ability_icon" : "status_effect_icon";
}

function fallbackPromptForTarget(target: StudioTarget, style: ArtStyle): string {
  if (target.kind === "ability") {
    return composePrompt("ability_icon", style, `Ability: ${target.label}`);
  }
  return composePrompt("status_effect_icon", style, `Status effect: ${target.label}`);
}

function dimensionsForTarget(): { width: number; height: number } {
  return { width: 256, height: 256 };
}

const VariantCard = memo(function VariantCard({
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
          ? "border-accent shadow-[0_0_0_1px_var(--border-accent-ring)]"
          : "border-white/12 hover:border-[var(--border-glow)]"
      }`}
    >
      {thumbSrc ? (
        <img src={thumbSrc} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-white/6" />
      )}
    </button>
  );
});

export function AbilityStudio() {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const importAsset = useAssetStore((s) => s.importAsset);
  const listVariants = useAssetStore((s) => s.listVariants);
  const setActiveVariant = useAssetStore((s) => s.setActiveVariant);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const assetsDir = useAssetStore((s) => s.assetsDir);

  const [activeTab, setActiveTab] = useState<AbilityStudioTab>("");
  const [selectedKey, setSelectedKey] = useState<TargetKey | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [variants, setVariants] = useState<AssetEntry[]>([]);
  const [previewEntry, setPreviewEntry] = useState<AssetEntry | null>(null);
  const [promptGeneratedByLlm, setPromptGeneratedByLlm] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template state
  const [template, setTemplate] = useState<AbilityPromptTemplate | null>(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  // Batch progress state
  const [batchProgress, setBatchProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [batchCurrentLabel, setBatchCurrentLabel] = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const abortRef = useRef(false);

  const tabs = useMemo(() => {
    if (!config) return [];
    const requiredClasses = new Set(
      Object.values(config.abilities)
        .map((ability) => ability.requiredClass || ability.classRestriction || "")
        .filter(Boolean),
    );
    const nextTabs = Object.keys(config.classes).filter((cls) => requiredClasses.has(cls));
    const hasGeneral = Object.values(config.abilities).some((ability) => !(ability.requiredClass || ability.classRestriction));
    const hasStatusEffects = Object.keys(config.statusEffects).length > 0;
    if (hasGeneral) nextTabs.push(GENERAL_TAB);
    if (hasStatusEffects) nextTabs.push(STATUS_TAB);
    return nextTabs;
  }, [config]);

  useEffect(() => {
    if (activeTab && tabs.includes(activeTab)) return;
    setActiveTab(tabs[0] ?? "");
  }, [activeTab, tabs]);

  const visibleTargets = useMemo<StudioTarget[]>(() => {
    if (!config || !activeTab) return [];

    if (activeTab === STATUS_TAB) {
      return Object.entries(config.statusEffects)
        .map(([id, effect]) => ({
          kind: "status_effect" as const,
          id,
          label: effect.displayName || id,
          subtitle: effect.effectType,
          image: effect.image,
          statusEffect: effect,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    return Object.entries(config.abilities)
      .filter(([, ability]) => {
        const classId = ability.requiredClass || ability.classRestriction;
        return activeTab === GENERAL_TAB ? !classId : classId === activeTab;
      })
      .map(([id, ability]) => ({
        kind: "ability" as const,
        id,
        label: ability.displayName || id,
        subtitle: `Lv ${ability.levelRequired} · ${ability.effect.type}`,
        image: ability.image,
        ability,
      }))
      .sort((a, b) => {
        const aLevel = a.ability?.levelRequired ?? 0;
        const bLevel = b.ability?.levelRequired ?? 0;
        if (aLevel !== bLevel) return aLevel - bLevel;
        return a.label.localeCompare(b.label);
      });
  }, [activeTab, config]);

  // Summary counts for current tab
  const tabCounts = useMemo(() => {
    const total = visibleTargets.length;
    const withImage = visibleTargets.filter((t) => t.image).length;
    return { total, withImage, missing: total - withImage };
  }, [visibleTargets]);

  useEffect(() => {
    if (selectedKey && visibleTargets.some((target) => `${target.kind}:${target.id}` === selectedKey)) return;
    const first = visibleTargets.find((target) => target.image) ?? visibleTargets[0];
    setSelectedKey(first ? `${first.kind}:${first.id}` : null);
  }, [selectedKey, visibleTargets]);

  const selectedTarget = useMemo(() => {
    if (!selectedKey) return null;
    return visibleTargets.find((target) => `${target.kind}:${target.id}` === selectedKey) ?? null;
  }, [selectedKey, visibleTargets]);

  const selectedVariantGroup = selectedTarget ? abilityVariantGroup(selectedTarget) : "";
  const selectedContext = selectedTarget
    ? { zone: "", entity_type: selectedTarget.kind, entity_id: selectedTarget.id }
    : undefined;
  const selectedSrc = useImageSrc(previewEntry?.file_name || selectedTarget?.image);

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
      setPromptGeneratedByLlm(Boolean(activeVariant.enhanced_prompt));
      return;
    }
    // Use template if available
    if (template) {
      if (selectedTarget.kind === "ability" && selectedTarget.ability) {
        setPromptDraft(fillAbilityTemplate(template, selectedTarget.ability));
      } else if (selectedTarget.kind === "status_effect" && selectedTarget.statusEffect) {
        setPromptDraft(fillStatusEffectTemplate(template, selectedTarget.statusEffect));
      }
      setPromptGeneratedByLlm(false);
      return;
    }
    setPromptDraft(fallbackPromptForTarget(selectedTarget, artStyle as ArtStyle));
    setPromptGeneratedByLlm(false);
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

  const persistImage = useCallback((target: StudioTarget, fileName: string) => {
    const latest = useConfigStore.getState().config;
    if (!latest) return;
    if (target.kind === "ability") {
      const ability = latest.abilities[target.id];
      if (!ability) return;
      updateConfig({
        ...latest,
        abilities: {
          ...latest.abilities,
          [target.id]: { ...ability, image: fileName },
        },
      });
      return;
    }
    const effect = latest.statusEffects[target.id];
    if (!effect) return;
    updateConfig({
      ...latest,
      statusEffects: {
        ...latest.statusEffects,
        [target.id]: { ...effect, image: fileName },
      },
    });
  }, [updateConfig]);

  const generatePromptForTarget = useCallback(async (target: StudioTarget) => {
    if (target.kind === "ability" && target.ability) {
      return generateAbilityPrompt(target.ability, target.id);
    }
    if (target.kind === "status_effect" && target.statusEffect) {
      return generateStatusEffectPrompt(target.statusEffect, target.id);
    }
    return fallbackPromptForTarget(target, artStyle as ArtStyle);
  }, [artStyle]);

  const getTemplatePromptForTarget = useCallback((target: StudioTarget): string | null => {
    if (!template) return null;
    if (target.kind === "ability" && target.ability) {
      return fillAbilityTemplate(template, target.ability);
    }
    if (target.kind === "status_effect" && target.statusEffect) {
      return fillStatusEffectTemplate(template, target.statusEffect);
    }
    return null;
  }, [template]);

  const runGeneration = useCallback(async (target: StudioTarget, prompt: string, activate: boolean, skipEnhancement?: boolean) => {
    if (!defaultModel) throw new Error(`No image model configured for provider ${imageProvider}.`);
    const assetType = assetTypeForTarget(target);

    const image = await invoke<GeneratedImage>(imageGenerateCommand(imageProvider), {
      prompt,
      negativePrompt: UNIVERSAL_NEGATIVE,
      model: defaultModel.id,
      width: dimensionsForTarget().width,
      height: dimensionsForTarget().height,
      steps: defaultModel.defaultSteps ?? 4,
      guidance: "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
      assetType,
      autoEnhance: skipEnhancement ? false : !promptGeneratedByLlm,
      transparentBackground: imageProvider === "openai" && requestsTransparentBackground(assetType),
    });

    await acceptAsset(
      image,
      assetType,
      prompt,
      { zone: "", entity_type: target.kind, entity_id: target.id },
      abilityVariantGroup(target),
      activate,
    );

    const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
    if (activate) persistImage(target, fileName);
  }, [acceptAsset, defaultModel, imageProvider, persistImage, promptGeneratedByLlm]);

  // ─── Template generation ──────────────────────────────────────────

  const handleGenerateTemplate = async () => {
    if (!config || !hasLlmKey) return;
    setGeneratingTemplate(true);
    setError(null);
    try {
      const effectTypes = new Set<string>();
      for (const ability of Object.values(config.abilities)) {
        effectTypes.add(ability.effect.type);
      }
      for (const effect of Object.values(config.statusEffects)) {
        effectTypes.add(effect.effectType);
      }

      const next = await generateAbilityTemplate(
        Object.keys(config.classes),
        [...effectTypes],
      );
      setTemplate(next);

      // Update the prompt draft for the currently selected target
      if (selectedTarget) {
        if (selectedTarget.kind === "ability" && selectedTarget.ability) {
          setPromptDraft(fillAbilityTemplate(next, selectedTarget.ability));
        } else if (selectedTarget.kind === "status_effect" && selectedTarget.statusEffect) {
          setPromptDraft(fillStatusEffectTemplate(next, selectedTarget.statusEffect));
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setGeneratingTemplate(false);
    }
  };

  // ─── Single-target actions ────────────────────────────────────────

  const handleGeneratePrompt = async () => {
    if (!selectedTarget || !hasLlmKey) return;
    setGeneratingPrompt(true);
    setError(null);
    try {
      setPromptDraft(await generatePromptForTarget(selectedTarget));
      setPromptGeneratedByLlm(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!promptDraft.trim() || !hasLlmKey) return;
    setGeneratingPrompt(true);
    setError(null);
    try {
      setPromptDraft(await enhanceAbilityPrompt(promptDraft));
      setPromptGeneratedByLlm(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleFillFromTemplate = () => {
    if (!selectedTarget || !template) return;
    const filled = getTemplatePromptForTarget(selectedTarget);
    if (filled) {
      setPromptDraft(filled);
      setPromptGeneratedByLlm(false);
    }
  };

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

  // ─── Batch generation with concurrency ────────────────────────────

  const handleGenerateAll = async () => {
    if (!hasImageKey || !visibleTargets.length) return;
    setBatchGenerating(true);
    abortRef.current = false;
    setError(null);

    const pending = skipExisting
      ? visibleTargets.filter((t) => !t.image)
      : [...visibleTargets];

    if (pending.length === 0) {
      setBatchGenerating(false);
      return;
    }

    setBatchProgress({ done: 0, failed: 0, total: pending.length });
    setBatchCurrentLabel("");

    const concurrency = settings?.batch_concurrency ?? 3;
    const queue = [...pending.keys()];
    let done = 0;
    let failed = 0;

    const worker = async () => {
      while (queue.length > 0 && !abortRef.current) {
        const idx = queue.shift();
        if (idx === undefined) break;
        const target = pending[idx]!;

        setBatchCurrentLabel(target.label);

        try {
          // Build prompt: template fill → LLM enhance, or direct LLM generate, or fallback
          let prompt: string;
          const templatePrompt = getTemplatePromptForTarget(target);
          if (templatePrompt && hasLlmKey) {
            prompt = await enhanceAbilityPrompt(templatePrompt);
          } else if (templatePrompt) {
            prompt = templatePrompt;
          } else if (hasLlmKey) {
            prompt = await generatePromptForTarget(target);
          } else {
            prompt = fallbackPromptForTarget(target, artStyle as ArtStyle);
          }

          await runGeneration(target, prompt, true, true);
          done++;
        } catch (err) {
          console.error(`[ability-studio] Failed ${target.id}:`, err);
          failed++;
        }

        setBatchProgress({ done, failed, total: pending.length });
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, pending.length) },
      () => worker(),
    );
    await Promise.all(workers);

    await loadAssets();
    await refreshVariants();
    setBatchCurrentLabel("");
    setBatchGenerating(false);
  };

  const handleAbortBatch = () => {
    abortRef.current = true;
  };

  // ─── Import ────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!selectedTarget) return;
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
        assetTypeForTarget(selectedTarget),
        selectedContext,
        selectedVariantGroup,
        true,
      );
      persistImage(selectedTarget, entry.file_name);
      await setActiveVariant(selectedVariantGroup, entry.id).catch(() => {});
      await loadAssets();
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleVariantSelect = async (entry: AssetEntry) => {
    if (!selectedTarget) return;
    try {
      await setActiveVariant(selectedVariantGroup, entry.id);
      setPreviewEntry(entry);
      persistImage(selectedTarget, entry.file_name);
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    }
  };

  if (!config) {
    return null;
  }

  const anyBusy = generatingPrompt || generatingImage || batchGenerating || importing || generatingTemplate;
  const batchCompleted = batchProgress.done + batchProgress.failed;

  return (
    <section className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-section">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-text-primary">Ability studio</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Ability and status-effect icons by class.
            {tabCounts.total > 0 && (
              <span className="ml-2 text-text-muted">
                {tabCounts.withImage}/{tabCounts.total} icons
                {tabCounts.missing > 0 && <> — <span className="text-accent">{tabCounts.missing} missing</span></>}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerateTemplate}
            disabled={!hasLlmKey || anyBusy}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
          >
            {generatingTemplate ? (
              <span className="flex items-center gap-1.5"><Spinner />Generating template</span>
            ) : template ? "Regenerate template" : "Generate template"}
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="accent-accent"
            />
            Skip existing
          </label>
          <button
            onClick={handleGenerateAll}
            disabled={!hasImageKey || anyBusy}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
          >
            {batchGenerating ? (
              <span className="flex items-center gap-1.5"><Spinner />Generating tab</span>
            ) : "Generate tab icons"}
          </button>
        </div>
      </div>

      {/* Batch progress bar */}
      {batchGenerating && batchProgress.total > 0 && (
        <div className="mb-5 rounded-[18px] border border-white/8 bg-black/12 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              {batchCompleted} of {batchProgress.total}
              {batchProgress.failed > 0 && (
                <span className="ml-2 text-status-error">{batchProgress.failed} failed</span>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className="max-w-[16rem] truncate text-text-muted">{batchCurrentLabel}</span>
              <button
                onClick={handleAbortBatch}
                className="rounded-full border border-status-error/40 bg-status-error/10 px-3 py-1 text-[11px] text-status-error transition hover:bg-status-error/20"
              >
                Abort
              </button>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bg-primary">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(batchCompleted / batchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {!selectedTarget ? (
        <div className="rounded-[20px] border border-dashed border-white/12 bg-black/12 px-4 py-8 text-sm text-text-muted">
          Add abilities or status effects in config to start generating icons.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.62fr_1.38fr]">
          <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {tabs.map((tab) => {
                // Compute per-tab counts for badge
                let tabMissing = 0;
                if (config) {
                  if (tab === STATUS_TAB) {
                    tabMissing = Object.values(config.statusEffects).filter((e) => !e.image).length;
                  } else {
                    tabMissing = Object.values(config.abilities).filter((a) => {
                      const classId = a.requiredClass || a.classRestriction;
                      const matches = tab === GENERAL_TAB ? !classId : classId === tab;
                      return matches && !a.image;
                    }).length;
                  }
                }
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-label transition ${
                      activeTab === tab
                        ? "border-border-active bg-[var(--bg-accent-subtle)] text-text-primary"
                        : tabMissing > 0
                          ? "border-accent/30 bg-accent/5 text-text-muted hover:bg-white/8"
                          : "border-white/8 bg-black/10 text-text-muted hover:bg-white/8"
                    }`}
                  >
                    {tab === STATUS_TAB ? "Status Effects" : tab === GENERAL_TAB ? "General" : config.classes[tab]?.displayName || tab}
                    {tabMissing > 0 && <span className="ml-1.5 text-accent">{tabMissing}</span>}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[42rem] overflow-y-auto pr-1">
              <div className="flex flex-col gap-2">
                {visibleTargets.map((target) => {
                  const key: TargetKey = `${target.kind}:${target.id}`;
                  const selected = selectedKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`flex items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                        selected
                          ? "border-border-active bg-gradient-active"
                          : "border-white/8 bg-black/10 hover:bg-white/8"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${target.image ? "bg-status-success" : "bg-text-muted/50"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-text-primary">{target.label}</div>
                        <div className="truncate text-[11px] text-text-muted">{target.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-ui text-text-muted">
                    {selectedTarget.kind === "ability" ? "Ability icon" : "Status effect icon"}
                  </div>
                  <h3 className="mt-1 font-display text-2xl text-text-primary">{selectedTarget.label}</h3>
                  <div className="mt-1 text-xs text-text-secondary">{selectedTarget.subtitle}</div>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] uppercase tracking-label text-text-muted">
                  {variants.length} variants
                </span>
              </div>

              <div className="flex min-h-[20rem] items-center justify-center overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(34,41,60,0.8),rgba(28,34,52,0.88))] p-4">
                {selectedSrc ? (
                  <img src={selectedSrc} alt={selectedTarget.label} className="max-h-[22rem] max-w-full rounded-[18px] object-contain shadow-image" />
                ) : (
                  <div className="text-center text-sm text-text-muted">No active icon yet.</div>
                )}
              </div>

              {variants.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] uppercase tracking-ui text-text-muted">Variant strip</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {variants.map((entry) => (
                      <VariantCard key={entry.id} entry={entry} assetsDir={assetsDir} onClick={() => handleVariantSelect(entry)} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-ui text-text-muted">Prompt engineering</div>
                {template && (
                  <span className="rounded-full bg-status-success/10 px-2.5 py-0.5 text-[10px] text-status-success">
                    Template active
                  </span>
                )}
              </div>
              <textarea
                value={promptDraft}
                onChange={(event) => {
                  setPromptDraft(event.target.value);
                  setPromptGeneratedByLlm(false);
                }}
                rows={14}
                className="w-full resize-y rounded-[20px] border border-white/10 bg-surface-scrim px-4 py-3 font-mono text-[12px] leading-6 text-text-secondary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
                placeholder="Generate an icon prompt..."
              />

              <div className="mt-3 rounded-[18px] border border-white/8 bg-surface-scrim-light px-4 py-3">
                <div className="text-[11px] uppercase tracking-ui text-text-muted">Definition context</div>
                <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-text-secondary">
                  {selectedTarget.kind === "ability" && selectedTarget.ability
                    ? buildAbilityContext(selectedTarget.id, selectedTarget.ability)
                    : selectedTarget.statusEffect
                      ? buildStatusEffectContext(selectedTarget.id, selectedTarget.statusEffect)
                      : ""}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleGeneratePrompt}
                  disabled={!hasLlmKey || anyBusy}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                >
                  {generatingPrompt ? <span className="flex items-center gap-1.5"><Spinner />Generating</span> : "Generate prompt"}
                </button>
                <button
                  onClick={handleEnhancePrompt}
                  disabled={!hasLlmKey || !promptDraft.trim() || anyBusy}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                >
                  Enhance prompt
                </button>
                {template && (
                  <button
                    onClick={handleFillFromTemplate}
                    disabled={anyBusy}
                    className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                  >
                    Fill from template
                  </button>
                )}
                <button
                  onClick={handleGenerateImage}
                  disabled={!hasImageKey || !promptDraft.trim() || anyBusy}
                  className="rounded-full border border-[var(--border-accent-subtle)] bg-gradient-active-strong px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {generatingImage ? <span className="flex items-center gap-1.5"><Spinner />Generating image</span> : "Generate image"}
                </button>
                <button
                  onClick={handleImport}
                  disabled={anyBusy}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                >
                  {importing ? <span className="flex items-center gap-1.5"><Spinner />Importing</span> : "Import image"}
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
