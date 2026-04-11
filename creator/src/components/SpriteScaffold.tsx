import { useState, useMemo, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useConfigStore } from "@/stores/configStore";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";
import { ENTITY_DIMENSIONS, imageGenerateCommand, resolveImageModel, requestsTransparentBackground, modelNativelyTransparent } from "@/types/assets";
import {
  buildSpritePrompt,
  generateArtDirection,
  generateSpriteTemplate,
  type SpritePromptTemplate,
} from "@/lib/spritePromptGen";
import {
  computeGaps,
  scaffoldDefinitions,
  type GapSummary,
  type ScaffoldMode,
} from "@/lib/spriteScaffold";
import type { GeneratedImage, AssetContext } from "@/types/assets";
import { ActionButton } from "./ui/FormWidgets";

const SPRITE_TEMPLATE_VIBE =
  "Character creation sprites for a fantasy world — each one should be a compelling standalone portrait.";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "nonbinary", label: "Nonbinary" },
];

const MODE_OPTIONS: { value: ScaffoldMode; label: string; description: string }[] = [
  { value: "race_class", label: "Race \u00D7 Class", description: "One sprite per race and class combination" },
  { value: "race_only", label: "Race only", description: "One sprite per race, no class gear" },
  { value: "class_only", label: "Class only", description: "One sprite per class, no race specified" },
];

interface SpriteScaffoldProps {
  onClose: () => void;
  onComplete: () => void;
}

type Phase = "select" | "running" | "done";

export function SpriteScaffold({ onClose, onComplete }: SpriteScaffoldProps) {
  const config = useConfigStore((s) => s.config);
  const definitions = useSpriteDefinitionStore((s) => s.definitions);
  const setDefinition = useSpriteDefinitionStore((s) => s.setDefinition);
  const saveDefinitions = useSpriteDefinitionStore((s) => s.saveDefinitions);
  const project = useProjectStore((s) => s.project);
  const settings = useAssetStore((s) => s.settings);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const loadAssets = useAssetStore((s) => s.loadAssets);

  const [phase, setPhase] = useState<Phase>("select");
  const [mode, setMode] = useState<ScaffoldMode>("race_class");
  const [selectedGenders, setSelectedGenders] = useState<Set<string>>(new Set());
  const [raceFilter, setRaceFilter] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [currentLabel, setCurrentLabel] = useState("");
  const abortRef = useRef(false);
  const trapRef = useFocusTrap<HTMLDivElement>(phase === "running" ? undefined : onClose);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = !!(settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0) ||
    (imageProvider === "openai" && settings.openai_api_key.length > 0)
  ));
  const hasLlmKey = !!(
    settings?.deepinfra_api_key ||
    settings?.anthropic_api_key ||
    settings?.openrouter_api_key
  );

  const genders = useMemo(() => [...selectedGenders], [selectedGenders]);

  const gaps: GapSummary | null = useMemo(() => {
    if (!config) return null;
    return computeGaps(config, definitions, genders, mode);
  }, [config, definitions, genders, mode]);

  const races = useMemo(() => {
    if (!config) return [];
    return Object.keys(config.races);
  }, [config]);

  const classes = useMemo(() => {
    if (!config) return [];
    return Object.keys(config.classes).filter((c) => c !== "base");
  }, [config]);

  const filteredMissing = useMemo(() => {
    if (!gaps) return [];
    return gaps.missing.filter((slot) => {
      if (slot.race && raceFilter.size > 0 && !raceFilter.has(slot.race)) return false;
      if (slot.playerClass && classFilter.size > 0 && !classFilter.has(slot.playerClass)) return false;
      return true;
    });
  }, [gaps, raceFilter, classFilter]);

  const toggleFilter = useCallback(
    (setFn: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
      setFn((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
    },
    [],
  );

  // ─── Scaffold only (no generation) ─────────────────────────────────

  const handleScaffold = useCallback(async () => {
    if (!config || !project) return;
    const pairs = scaffoldDefinitions(filteredMissing, config, Object.keys(definitions).length);
    for (const [id, def] of pairs) {
      setDefinition(id, def);
    }
    await saveDefinitions(project);
    onComplete();
  }, [config, project, filteredMissing, definitions, setDefinition, saveDefinitions, onComplete]);

  // ─── Scaffold + generate ───────────────────────────────────────────

  const handleScaffoldAndGenerate = useCallback(async () => {
    if (!config || !project || !settings) return;

    setPhase("running");
    abortRef.current = false;
    const slots = [...filteredMissing];
    setProgress({ done: 0, failed: 0, total: slots.length });

    const pairs = scaffoldDefinitions(slots, config, Object.keys(definitions).length);
    for (const [id, def] of pairs) {
      setDefinition(id, def);
    }
    await saveDefinitions(project);

    let template: SpritePromptTemplate | null = null;
    if (hasLlmKey) {
      try {
        template = await generateSpriteTemplate(
          Object.keys(config.races),
          Object.keys(config.classes),
          SPRITE_TEMPLATE_VIBE,
        );
      } catch {
        // Fall back to default template composition
      }
    }

    const concurrency = settings.batch_concurrency ?? 3;
    const queue = [...slots.keys()];
    let done = 0;
    let failed = 0;

    const pendingBgRemovals: Promise<unknown>[] = [];

    const worker = async () => {
      while (queue.length > 0 && !abortRef.current) {
        const idx = queue.shift();
        if (idx === undefined) break;
        const slot = slots[idx]!;

        setCurrentLabel(slot.id.replace(/_/g, " "));

        try {
          const dimensions = { race: slot.race, playerClass: slot.playerClass, gender: slot.gender };

          let artDirection: string | undefined;
          if (hasLlmKey) {
            try {
              const defForSlot = pairs.find(([id]) => id === slot.id)?.[1];
              artDirection = await generateArtDirection(
                defForSlot?.displayName ?? slot.id,
                slot.race,
                slot.playerClass,
                slot.gender,
              );
              if (artDirection) {
                setDefinition(slot.id, { ...defForSlot!, artDirection });
              }
            } catch {
              // Art direction is best-effort; proceed without it
            }
          }

          const prompt = buildSpritePrompt(dimensions, template, artDirection);

          const model = resolveImageModel(imageProvider, settings?.image_model);
          if (!model) throw new Error("No image model available");

          const dims = ENTITY_DIMENSIONS.player_sprite ?? { width: 512, height: 512 };

          const image = await invoke<GeneratedImage>(imageGenerateCommand(imageProvider), {
            prompt,
            negativePrompt: UNIVERSAL_NEGATIVE,
            model: model.id,
            width: dims.width,
            height: dims.height,
            steps: model.defaultSteps,
            guidance: "defaultGuidance" in model ? model.defaultGuidance : null,
            assetType: "player_sprite",
            autoEnhance: false,
            transparentBackground: imageProvider === "openai" && requestsTransparentBackground("player_sprite"),
          });

          const imageId = slot.id;
          const assetContext: AssetContext = { zone: "sprites", entity_type: "player_sprite", entity_id: imageId };
          const variantGroup = `player_sprite:${imageId}`;

          await acceptAsset(image, "player_sprite", prompt, assetContext, variantGroup, true);

          const skipBgRemoval = modelNativelyTransparent(imageProvider, model.id) && requestsTransparentBackground("player_sprite");
          if (settings.auto_remove_bg && shouldRemoveBg("player_sprite") && image.data_url && !skipBgRemoval) {
            pendingBgRemovals.push(
              removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {}),
            );
          }

          done++;
        } catch (err) {
          console.error(`[sprite-scaffold] Failed ${slot.id}:`, err);
          failed++;
        }

        setProgress({ done, failed, total: slots.length });
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, slots.length) },
      () => worker(),
    );
    await Promise.all(workers);

    if (pendingBgRemovals.length > 0) {
      setCurrentLabel(`Removing backgrounds (${pendingBgRemovals.length})...`);
      await Promise.all(pendingBgRemovals);
    }

    await loadAssets();
    setProgress({ done, failed, total: slots.length });
    setCurrentLabel("");
    setPhase("done");
  }, [
    config, project, settings, filteredMissing, definitions, hasLlmKey,
    imageProvider, setDefinition, saveDefinitions,
    acceptAsset, loadAssets,
  ]);

  if (!config || !gaps) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--chrome-fill-soft)]">
        <div className="rounded-lg border border-border-default bg-bg-secondary p-6 text-sm text-text-secondary">
          No config loaded.
        </div>
      </div>
    );
  }

  const totalExpected = gaps.expected.length;
  const totalExisting = gaps.existing.length;
  const totalMissing = gaps.missing.length;
  const showRaceFilter = mode !== "class_only";
  const showClassFilter = mode !== "race_only";

  const genderHint = selectedGenders.size === 0
    ? "No gender specified — LLM picks freely"
    : mode === "race_class"
      ? `Each race\u00D7class generates ${selectedGenders.size} sprite${selectedGenders.size > 1 ? "s" : ""}`
      : `Each entry generates ${selectedGenders.size} sprite${selectedGenders.size > 1 ? "s" : ""}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--chrome-fill-soft)]"
      onClick={phase === "running" ? undefined : onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scaffold-title"
        className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <div>
            <h2 id="scaffold-title" className="font-display text-sm tracking-wide text-text-primary">
              Fill Sprite Gaps
            </h2>
            <p className="mt-0.5 text-2xs text-text-muted">
              {totalExisting} of {totalExpected} sprites defined
              {totalMissing > 0 && <> — <span className="text-accent">{totalMissing} missing</span></>}
            </p>
          </div>
        </div>

        {phase === "select" && (
          <>
            {/* Mode selector */}
            <div className="border-b border-border-default px-5 py-3">
              <h3 className="mb-2 text-2xs font-medium uppercase tracking-label text-text-muted">
                Mode
              </h3>
              <div className="flex flex-wrap gap-2">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setMode(opt.value); setRaceFilter(new Set()); setClassFilter(new Set()); }}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      mode === opt.value
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border-default bg-bg-primary text-text-muted"
                    }`}
                    title={opt.description}
                  >
                    {opt.label}
                  </button>
                ))}
                <span className="ml-2 self-center text-2xs text-text-muted">
                  {MODE_OPTIONS.find((o) => o.value === mode)?.description}
                </span>
              </div>
            </div>

            {/* Gender selection */}
            <div className="border-b border-border-default px-5 py-3">
              <h3 className="mb-2 text-2xs font-medium uppercase tracking-label text-text-muted">
                Gender
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleFilter(setSelectedGenders, opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      selectedGenders.has(opt.value)
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border-default bg-bg-primary text-text-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <span className="ml-2 text-2xs text-text-muted">
                  {genderHint}
                </span>
              </div>
            </div>

            {/* Per-group breakdown pills */}
            {Object.keys(gaps.byGroup).length > 0 && (
              <div className="border-b border-border-default px-5 py-3">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(gaps.byGroup).map(([key, counts]) => {
                    const displayName = mode === "class_only"
                      ? (config.classes[key]?.displayName ?? key)
                      : (config.races[key]?.displayName ?? key);
                    const isFiltered = mode === "class_only" ? classFilter : raceFilter;
                    const setFiltered = mode === "class_only" ? setClassFilter : setRaceFilter;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleFilter(setFiltered, key)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          isFiltered.size === 0 || isFiltered.has(key)
                            ? counts.missing > 0
                              ? "border-accent/40 bg-accent/10 text-accent"
                              : "border-status-success/40 bg-status-success/10 text-status-success"
                            : "border-border-default bg-bg-primary text-text-muted opacity-50"
                        }`}
                      >
                        {displayName}
                        <span className="ml-1.5 text-2xs">
                          {counts.existing}/{counts.total}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {(raceFilter.size > 0 || classFilter.size > 0) && (
                  <button
                    onClick={() => { setRaceFilter(new Set()); setClassFilter(new Set()); }}
                    className="mt-1.5 text-2xs text-text-muted hover:text-text-secondary"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

            {/* Secondary axis filter (only for race×class mode) */}
            {mode === "race_class" && (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                <div className="flex gap-6">
                  {showRaceFilter && (
                    <div className="flex-1">
                      <h3 className="mb-2 text-2xs font-medium uppercase tracking-label text-text-muted">
                        Races
                      </h3>
                      <div className="flex flex-wrap gap-1">
                        {races.map((race) => (
                          <button
                            key={race}
                            onClick={() => toggleFilter(setRaceFilter, race)}
                            className={`rounded-full border px-2 py-0.5 text-2xs transition-colors ${
                              raceFilter.size === 0 || raceFilter.has(race)
                                ? "border-accent/30 text-text-secondary"
                                : "border-border-default text-text-muted opacity-50"
                            }`}
                          >
                            {config.races[race]?.displayName ?? race}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {showClassFilter && (
                    <div className="flex-1">
                      <h3 className="mb-2 text-2xs font-medium uppercase tracking-label text-text-muted">
                        Classes
                      </h3>
                      <div className="flex flex-wrap gap-1">
                        {classes.map((cls) => (
                          <button
                            key={cls}
                            onClick={() => toggleFilter(setClassFilter, cls)}
                            className={`rounded-full border px-2 py-0.5 text-2xs transition-colors ${
                              classFilter.size === 0 || classFilter.has(cls)
                                ? "border-accent/30 text-text-secondary"
                                : "border-border-default text-text-muted opacity-50"
                            }`}
                          >
                            {config.classes[cls]?.displayName ?? cls}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selection summary + actions */}
            <div className="flex items-center justify-between border-t border-border-default px-5 py-3">
              <span className="text-xs text-text-secondary">
                {filteredMissing.length} sprite{filteredMissing.length !== 1 ? "s" : ""} to create
                {(raceFilter.size > 0 || classFilter.size > 0) && (
                  <span className="text-text-muted"> (filtered)</span>
                )}
              </span>
              <div className="flex gap-2">
                <ActionButton onClick={onClose} variant="secondary" size="sm">
                  Cancel
                </ActionButton>
                <ActionButton
                  onClick={handleScaffold}
                  disabled={filteredMissing.length === 0}
                  variant="secondary"
                  size="sm"
                >
                  Create Definitions
                </ActionButton>
                <ActionButton
                  onClick={handleScaffoldAndGenerate}
                  disabled={filteredMissing.length === 0 || !hasApiKey}
                  variant="primary"
                  size="sm"
                  title={!hasApiKey ? "No image API key configured" : undefined}
                >
                  Create &amp; Generate ({filteredMissing.length})
                </ActionButton>
              </div>
            </div>
          </>
        )}

        {phase === "running" && (
          <div className="px-5 py-6">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                {progress.done + progress.failed} of {progress.total}
                {progress.failed > 0 && (
                  <span className="ml-2 text-status-error">{progress.failed} failed</span>
                )}
              </span>
              <span className="max-w-[50%] truncate text-text-muted">{currentLabel}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-primary">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${((progress.done + progress.failed) / progress.total) * 100}%` }}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <ActionButton
                onClick={() => { abortRef.current = true; }}
                variant="danger"
                size="sm"
              >
                Abort
              </ActionButton>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="px-5 py-6">
            <div className="mb-4 text-sm text-text-secondary">
              {progress.done > 0 && (
                <p className="text-status-success">
                  {progress.done} sprite{progress.done !== 1 ? "s" : ""} generated successfully.
                </p>
              )}
              {progress.failed > 0 && (
                <p className="mt-1 text-status-error">
                  {progress.failed} failed — definitions were still created; you can regenerate individually.
                </p>
              )}
              {abortRef.current && (
                <p className="mt-1 text-text-muted">
                  Generation was aborted. Completed sprites and definitions are preserved.
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <ActionButton
                onClick={() => { onComplete(); onClose(); }}
                variant="primary"
                size="sm"
              >
                Done
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
