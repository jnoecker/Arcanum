import { useState, useMemo, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useConfigStore } from "@/stores/configStore";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";
import { ENTITY_DIMENSIONS, imageGenerateCommand, resolveImageModel, requestsTransparentBackground } from "@/types/assets";
import {
  buildSpritePrompt,
  enhanceSpritePrompt,
  generateSpriteTemplate,
  getTierDefinitions,
  type SpritePromptTemplate,
} from "@/lib/spritePromptGen";
import {
  computeGaps,
  scaffoldDefinitions,
  type GapSummary,
} from "@/lib/tierSpriteScaffold";
import type { GeneratedImage, AssetContext } from "@/types/assets";
import { ActionButton } from "./ui/FormWidgets";

const SPRITE_TEMPLATE_VIBE =
  "Dreamy character creation sprites for a magical fantasy world, cohesive with a softly enchanted storybook aesthetic.";

interface TierSpriteScaffoldProps {
  onClose: () => void;
  onComplete: () => void;
}

type Phase = "select" | "running" | "done";

export function TierSpriteScaffold({ onClose, onComplete }: TierSpriteScaffoldProps) {
  const config = useConfigStore((s) => s.config);
  const definitions = useSpriteDefinitionStore((s) => s.definitions);
  const setDefinition = useSpriteDefinitionStore((s) => s.setDefinition);
  const saveDefinitions = useSpriteDefinitionStore((s) => s.saveDefinitions);
  const project = useProjectStore((s) => s.project);
  const settings = useAssetStore((s) => s.settings);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const loadAssets = useAssetStore((s) => s.loadAssets);

  const [phase, setPhase] = useState<Phase>("select");
  const [tierFilter, setTierFilter] = useState<Set<string>>(new Set());
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

  // Compute gaps
  const gaps: GapSummary | null = useMemo(() => {
    if (!config) return null;
    return computeGaps(config, definitions);
  }, [config, definitions]);

  // Available filter values
  const races = useMemo(() => {
    if (!config) return [];
    return Object.keys(config.races);
  }, [config]);

  const classes = useMemo(() => {
    if (!config) return [];
    return ["base", ...Object.keys(config.classes).filter((c) => c !== "base")];
  }, [config]);

  // Filtered missing slots
  const filteredMissing = useMemo(() => {
    if (!gaps) return [];
    return gaps.missing.filter((slot) => {
      if (tierFilter.size > 0 && !tierFilter.has(slot.tier)) return false;
      if (raceFilter.size > 0 && !raceFilter.has(slot.race)) return false;
      if (classFilter.size > 0 && !classFilter.has(slot.playerClass)) return false;
      return true;
    });
  }, [gaps, tierFilter, raceFilter, classFilter]);

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

    // Create all definitions first
    const pairs = scaffoldDefinitions(slots, config, Object.keys(definitions).length);
    for (const [id, def] of pairs) {
      setDefinition(id, def);
    }
    await saveDefinitions(project);

    // Generate sprite template
    let template: SpritePromptTemplate | null = null;
    if (hasLlmKey) {
      try {
        template = await generateSpriteTemplate(
          Object.keys(config.races),
          Object.keys(config.classes),
          Object.keys(config.playerTiers ?? getTierDefinitions()),
          SPRITE_TEMPLATE_VIBE,
        );
      } catch {
        // Fall back to default template composition
      }
    }

    // Batch generate with concurrency
    const concurrency = settings.batch_concurrency ?? 3;
    const queue = [...slots.keys()];
    let done = 0;
    let failed = 0;

    // Collect bg removal promises so we can await them
    const pendingBgRemovals: Promise<unknown>[] = [];

    const worker = async () => {
      while (queue.length > 0 && !abortRef.current) {
        const idx = queue.shift();
        if (idx === undefined) break;
        const slot = slots[idx]!;

        setCurrentLabel(slot.id.replace(/_/g, " "));

        try {
          const dimensions = { race: slot.race, playerClass: slot.playerClass, tier: slot.tier };
          const prompt = hasLlmKey
            ? await enhanceSpritePrompt(buildSpritePrompt(dimensions, template))
            : buildSpritePrompt(dimensions, template);

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

          if (settings.auto_remove_bg && shouldRemoveBg("player_sprite") && image.data_url) {
            pendingBgRemovals.push(
              removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {}),
            );
          }

          done++;
        } catch (err) {
          console.error(`[tier-scaffold] Failed ${slot.id}:`, err);
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

    // Await background removals before finishing — ensures the bg-free variants
    // are registered in the asset manifest before we report completion.
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="rounded-lg border border-border-default bg-bg-secondary p-6 text-sm text-text-secondary">
          No config loaded.
        </div>
      </div>
    );
  }

  const totalExpected = gaps.expected.length;
  const totalExisting = gaps.existing.length;
  const totalMissing = gaps.missing.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
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
              Fill Tier Sprite Gaps
            </h2>
            <p className="mt-0.5 text-2xs text-text-muted">
              {totalExisting} of {totalExpected} tier sprites defined
              {totalMissing > 0 && <> — <span className="text-accent">{totalMissing} missing</span></>}
            </p>
          </div>
        </div>

        {phase === "select" && (
          <>
            {/* Per-tier breakdown */}
            <div className="border-b border-border-default px-5 py-3">
              <div className="flex flex-wrap gap-2">
                {Object.entries(gaps.byTier).map(([tier, counts]) => (
                  <button
                    key={tier}
                    onClick={() => toggleFilter(setTierFilter, tier)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      tierFilter.size === 0 || tierFilter.has(tier)
                        ? counts.missing > 0
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-status-success/40 bg-status-success/10 text-status-success"
                        : "border-border-default bg-bg-primary text-text-muted opacity-50"
                    }`}
                  >
                    {tier}
                    <span className="ml-1.5 text-2xs">
                      {counts.existing}/{counts.total}
                    </span>
                  </button>
                ))}
              </div>
              {tierFilter.size > 0 && (
                <button
                  onClick={() => setTierFilter(new Set())}
                  className="mt-1.5 text-2xs text-text-muted hover:text-text-secondary"
                >
                  Clear tier filter
                </button>
              )}
            </div>

            {/* Race/class filters */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto border-r border-border-default px-4 py-3">
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
                {raceFilter.size > 0 && (
                  <button
                    onClick={() => setRaceFilter(new Set())}
                    className="mt-1.5 text-2xs text-text-muted hover:text-text-secondary"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
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
                      {cls === "base" ? "Base (race only)" : (config.classes[cls]?.displayName ?? cls)}
                    </button>
                  ))}
                </div>
                {classFilter.size > 0 && (
                  <button
                    onClick={() => setClassFilter(new Set())}
                    className="mt-1.5 text-2xs text-text-muted hover:text-text-secondary"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Selection summary + actions */}
            <div className="flex items-center justify-between border-t border-border-default px-5 py-3">
              <span className="text-xs text-text-secondary">
                {filteredMissing.length} sprite{filteredMissing.length !== 1 ? "s" : ""} to create
                {(tierFilter.size > 0 || raceFilter.size > 0 || classFilter.size > 0) && (
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
