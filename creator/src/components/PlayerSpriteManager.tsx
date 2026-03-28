import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "@/stores/configStore";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import {
  getSpriteAxes,
  spriteKey,
  tierLabel,
  tierRange,
  getAllTiers,
  totalSprites,
  isRaceOnlyTier,
  type SpriteTier,
} from "@/lib/spriteMatrix";
import {
  composePrompt,
  getEnhanceSystemPrompt,
  UNIVERSAL_NEGATIVE,
  ART_STYLE_LABELS,
} from "@/lib/arcanumPrompts";
import {
  generateSpriteTemplate,
  fillSpriteTemplate,
  type SpritePromptTemplate,
} from "@/lib/spritePromptGen";
import { TIER_ORDER } from "@/lib/defaultSpriteData";
import { IMAGE_MODELS, ENTITY_DIMENSIONS } from "@/types/assets";
import type { AssetEntry, GeneratedImage, SyncProgress } from "@/types/assets";
import type { AppConfig } from "@/types/config";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
import { AchievementSpriteEditor } from "@/components/AchievementSpriteEditor";

type SpriteTab = "tiers" | "achievements";

interface SpriteImportResult {
  imported: number;
  retagged: number;
  skipped: number;
  errors: string[];
}

/** Convert spriteMatrix tier format to spritePromptGen format ("t1", "tstaff"). */
function tierToPromptKey(tier: SpriteTier): string {
  return `t${tier}`;
}

function displayClassLabel(
  cls: string,
  config: AppConfig | null,
) {
  return cls === "base"
    ? "Shared race form"
    : (config?.classes[cls.toUpperCase()]?.displayName ?? cls);
}

const SpriteThumbnail = memo(function SpriteThumbnail({ fileName }: { fileName: string | undefined }) {
  const src = useImageSrc(fileName);
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg-tertiary text-2xs text-text-muted">
        --
      </div>
    );
  }
  return (
    <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
  );
});

function SpriteLightbox({
  spriteKey: key,
  fileName,
  variantGroup,
  canRegenerate,
  canDelete,
  onRegenerate,
  onDelete,
  onRemoveBg,
  onClose,
}: {
  spriteKey: string;
  fileName: string;
  variantGroup: string;
  canRegenerate: boolean;
  canDelete: boolean;
  onRegenerate: () => void;
  onDelete: () => void;
  onRemoveBg: () => void;
  onClose: () => void;
}) {
  const src = useImageSrc(fileName);
  const [removingBg, setRemovingBg] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleRemoveBg = async () => {
    if (!src) return;
    setRemovingBg(true);
    try {
      const context = { zone: "sprites", entity_type: "player_sprite", entity_id: key };
      const entry = await removeBgAndSave(src, "player_sprite", context, variantGroup);
      if (entry) onRemoveBg();
    } finally {
      setRemovingBg(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {src ? (
          <img
            src={src}
            alt={key}
            className="max-h-[80vh] max-w-[80vw] rounded border border-border-default object-contain"
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded border border-border-default bg-bg-tertiary text-text-muted">
            Loading...
          </div>
        )}
        <span className="font-mono text-xs text-text-secondary">{key}</span>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            disabled={!canRegenerate}
            className="rounded-full border border-accent/40 px-4 py-2 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
          >
            Regenerate
          </button>
          <button
            onClick={handleRemoveBg}
            disabled={removingBg || !src}
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-text-primary transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {removingBg ? "Removing BG..." : "Remove BG"}
          </button>
          <button
            onClick={onDelete}
            disabled={!canDelete}
            className="rounded-full border border-status-error/40 px-4 py-2 text-xs text-status-error transition-colors hover:bg-status-error/10 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-bg-elevated text-text-primary shadow hover:bg-bg-hover"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

export function PlayerSpriteManager() {
  const [spriteTab, setSpriteTab] = useState<SpriteTab>("tiers");
  const config = useConfigStore((s) => s.config);
  const assets = useAssetStore((s) => s.assets);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const settings = useAssetStore((s) => s.settings);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);
  const artStyle = useAssetStore((s) => s.artStyle);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SpriteImportResult | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<SyncProgress | null>(null);
  const [filterRace, setFilterRace] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [viewSprite, setViewSprite] = useState<{ key: string; fileName: string; assetId: string; race: string; cls: string; tier: SpriteTier } | null>(null);

  // Generation state
  const [generating, setGenerating] = useState<string | null>(null); // spriteKey being generated
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const abortRef = useRef(false);

  // Template-based generation — one LLM call, then pure string substitution
  const [spriteTemplate, setSpriteTemplate] = useState<SpritePromptTemplate | null>(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  const { races, classes, tiers } = useMemo(
    () => config ? getSpriteAxes(config) : { races: [] as string[], classes: [] as string[], tiers: [] as SpriteTier[] },
    [config],
  );
  const allTiers = useMemo(() => config ? getAllTiers(config) : [] as SpriteTier[], [config]);
  const total = useMemo(() => config ? totalSprites(config) : 0, [config]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0)
  );
  const availableModels = IMAGE_MODELS.filter((m) => m.provider === imageProvider);
  const defaultModel = availableModels[0];

  // Build lookup of existing sprite assets by variant_group
  const spriteMap = useMemo(() => {
    const map = new Map<string, AssetEntry>();
    for (const a of assets) {
      if (a.asset_type === "player_sprite" && a.variant_group) {
        const key = a.variant_group.replace("player_sprite:", "");
        // Prefer active variant
        if (!map.has(key) || a.is_active) {
          map.set(key, a);
        }
      }
    }
    return map;
  }, [assets]);

  // Apply filters
  const filteredRaces = filterRace === "all" ? races : [filterRace];
  const filteredClasses = filterClass === "all" ? classes : [filterClass];
  const sharedTiers = useMemo(() => tiers.filter(isRaceOnlyTier), [tiers]);
  const classTiers = useMemo(() => tiers.filter((tier) => !isRaceOnlyTier(tier)), [tiers]);

  const spriteSlots = useMemo(() => {
    const slots: Array<{ race: string; cls: string; tier: SpriteTier }> = [];
    for (const race of races) {
      for (const tier of sharedTiers) {
        slots.push({ race, cls: "base", tier });
      }
      for (const cls of classes) {
        for (const tier of classTiers) {
          slots.push({ race, cls, tier });
        }
      }
    }
    return slots;
  }, [classTiers, classes, races, sharedTiers]);

  const visibleSpriteSlots = useMemo(() => {
    const slots: Array<{ race: string; cls: string; tier: SpriteTier }> = [];
    for (const race of filteredRaces) {
      for (const tier of sharedTiers) {
        slots.push({ race, cls: "base", tier });
      }
      for (const cls of filteredClasses) {
        for (const tier of classTiers) {
          slots.push({ race, cls, tier });
        }
      }
    }
    return slots;
  }, [classTiers, filteredClasses, filteredRaces, sharedTiers]);

  const coveredCount = useMemo(
    () => spriteSlots.filter((slot) => spriteMap.has(spriteKey(slot.race, slot.cls, slot.tier))).length,
    [spriteMap, spriteSlots],
  );

  /** Generate a sprite template (one LLM call, reusable for all sprites). */
  const handleGenerateTemplate = useCallback(async () => {
    if (!config) return;
    setGeneratingTemplate(true);
    try {
      const raceKeys = Object.keys(config.races).map((r) => r.toUpperCase());
      const classKeys = ["base", ...Object.keys(config.classes).map((c) => c.toUpperCase())];
      const tierKeys = TIER_ORDER;
      const vibe = "Fantasy RPG character sprites for a MUD game world";
      const template = await generateSpriteTemplate(raceKeys, classKeys, tierKeys, vibe);
      setSpriteTemplate(template);
    } catch (e) {
      console.error("Failed to generate sprite template:", e);
    } finally {
      setGeneratingTemplate(false);
    }
  }, [config]);

  /** Generate a single sprite, accept it, and remove background. */
  const generateSprite = useCallback(async (
    race: string,
    cls: string,
    tier: SpriteTier,
  ): Promise<boolean> => {
    const key = spriteKey(race, cls, tier);
    const tierKey = tierToPromptKey(tier);
    const promptClass = isRaceOnlyTier(tier) ? "base" : cls;

    let finalPrompt: string;

    // If we have a template, use pure string substitution (no LLM call per sprite)
    if (spriteTemplate) {
      finalPrompt = fillSpriteTemplate(spriteTemplate, {
        race: race.toUpperCase(),
        playerClass: promptClass.toUpperCase(),
        tier: tierKey,
      });
    } else {
      // Fallback: LLM enhance or static compose
      const basePrompt = composePrompt("player_sprite", artStyle);
      const hasLlmKey = settings && (
        settings.deepinfra_api_key.length > 0 ||
        settings.anthropic_api_key.length > 0 ||
        settings.openrouter_api_key.length > 0
      );
      if (hasLlmKey) {
        try {
          const systemPrompt = getEnhanceSystemPrompt(artStyle);
          const raceDef = config?.races[race.toUpperCase()];
          const classDef = promptClass === "base" ? undefined : config?.classes[promptClass.toUpperCase()];
          const context = [
            `Race: ${raceDef?.displayName ?? race}`,
            raceDef?.description ? `Race description: ${raceDef.description}` : null,
            `Class: ${promptClass === "base" ? "Base" : (classDef?.displayName ?? promptClass)}`,
            classDef?.description ? `Class description: ${classDef.description}` : null,
            `Tier: ${tierKey}`,
          ].filter(Boolean).join("\n");
          const userPrompt = [
            `Generate an image prompt for this player character sprite:\n${context}`,
            `\nReference style template (adapt but prioritize the character description above):\n${basePrompt}`,
          ].join("\n");
          finalPrompt = await invoke<string>("llm_complete", { systemPrompt, userPrompt });
        } catch {
          finalPrompt = composePrompt("player_sprite", artStyle);
        }
      } else {
        finalPrompt = composePrompt("player_sprite", artStyle);
      }
    }

    const dims = ENTITY_DIMENSIONS.player_sprite ?? { width: 512, height: 512 };
    const command = imageProvider === "runware" ? "runware_generate_image" : "generate_image";
    const modelId = defaultModel?.id;
    if (!modelId) throw new Error(`No models available for provider: ${imageProvider}`);

    const image = await invoke<GeneratedImage>(command, {
      prompt: finalPrompt,
      negativePrompt: UNIVERSAL_NEGATIVE,
      model: modelId,
      width: dims.width,
      height: dims.height,
      steps: defaultModel?.defaultSteps ?? 4,
      guidance: defaultModel && "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
    });

    const assetContext = { zone: "sprites", entity_type: "player_sprite", entity_id: key };
    const variantGroup = `player_sprite:${key}`;

    await acceptAsset(image, "player_sprite", finalPrompt, assetContext, variantGroup, true);

    // Always remove background for player sprites — they need transparency
    if (image.data_url) {
      removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {});
    }

    return true;
  }, [config, artStyle, settings, imageProvider, defaultModel, spriteTemplate, acceptAsset]);

  /** Generate a single sprite cell on click. */
  const handleGenerateOne = useCallback(async (
    race: string,
    cls: string,
    tier: SpriteTier,
  ) => {
    const key = spriteKey(race, cls, tier);
    setGenerating(key);
    try {
      await generateSprite(race, cls, tier);
      await loadAssets();
    } catch (e) {
      console.error(`Failed to generate sprite ${key}:`, e);
    } finally {
      setGenerating(null);
    }
  }, [generateSprite, loadAssets]);

  /** Batch generate all missing sprites (respects current filters). */
  const handleBatchGenerate = useCallback(async () => {
    const missing = visibleSpriteSlots.filter((slot) => !spriteMap.has(spriteKey(slot.race, slot.cls, slot.tier)));

    if (missing.length === 0) return;

    abortRef.current = false;
    setBatchRunning(true);
    setBatchProgress({ done: 0, total: missing.length, failed: 0 });

    const concurrency = settings?.batch_concurrency ?? 2;
    const queue = [...missing];
    let done = 0;
    let failed = 0;

    const worker = async () => {
      while (queue.length > 0 && !abortRef.current) {
        const slot = queue.shift();
        if (!slot) break;

        const key = spriteKey(slot.race, slot.cls, slot.tier);
        setGenerating(key);

        try {
          await generateSprite(slot.race, slot.cls, slot.tier);
          done++;
        } catch (e) {
          console.error(`Batch: failed ${key}:`, e);
          failed++;
        }
        setBatchProgress({ done: done + failed, total: missing.length, failed });
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => worker(),
    );
    await Promise.all(workers);

    setGenerating(null);
    setBatchRunning(false);
    await loadAssets();
  }, [visibleSpriteSlots, spriteMap, settings, generateSprite, loadAssets]);

  const handleAbortBatch = useCallback(() => {
    abortRef.current = true;
  }, []);

  const handleImport = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;

    setImporting(true);
    setImportResult(null);
    try {
      const result = await invoke<SpriteImportResult>("import_player_sprites", {
        sourceDir: selected as string,
      });
      setImportResult(result);
      await loadAssets();
    } catch (e) {
      setImportResult({ imported: 0, retagged: 0, skipped: 0, errors: [String(e)] });
    } finally {
      setImporting(false);
    }
  }, [loadAssets]);

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const result = await invoke<SyncProgress>("deploy_sprites_to_r2");
      setDeployResult(result);
    } catch (e) {
      setDeployResult({ total: 0, uploaded: 0, skipped: 0, failed: 1, errors: [String(e)] });
    } finally {
      setDeploying(false);
    }
  }, []);

  const missingInView = useMemo(
    () => visibleSpriteSlots.filter((slot) => !spriteMap.has(spriteKey(slot.race, slot.cls, slot.tier))).length,
    [spriteMap, visibleSpriteSlots],
  );
  const tableRows = useMemo(
    () => [
      { cls: "base", label: "Shared race form", shared: true },
      ...filteredClasses.map((cls) => ({
        cls,
        label: displayClassLabel(cls, config),
        shared: false,
      })),
    ],
    [config, filteredClasses],
  );

  if (!config || races.length === 0 || classes.length === 0) {
    return (
      <div className="p-6 text-sm text-text-muted">
        <p>
          Player sprites require races and classes to be configured.
          Set these up in the Config tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border-default bg-bg-secondary px-4 py-1.5">
        {(["tiers", "achievements"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSpriteTab(tab)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              spriteTab === tab
                ? "border-[var(--border-glow-strong)] bg-[linear-gradient(135deg,rgba(168,151,210,0.25),rgba(140,174,201,0.15))] text-text-primary shadow-glow-sm"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab === "tiers" ? "Tier & Staff" : "Achievement Sprites"}
          </button>
        ))}
      </div>

      {spriteTab === "achievements" ? (
        <AchievementSpriteEditor />
      ) : (
      <>
      {/* Header bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border-default bg-bg-secondary px-4 py-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">
          Player Sprites
        </h2>
        <span className="text-2xs text-text-muted">
          {coveredCount} / {total} sprites
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="rounded border border-border-default bg-bg-primary px-2 py-1 text-2xs text-text-secondary">
            {ART_STYLE_LABELS[artStyle]}
          </div>

          {/* Generate template */}
          <button
            onClick={handleGenerateTemplate}
            disabled={generatingTemplate || !hasApiKey}
            title={spriteTemplate ? `Template generated ${spriteTemplate.generatedAt}` : "Generate a reusable prompt template (one LLM call)"}
            className={`rounded border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
              spriteTemplate
                ? "border-status-success/40 text-status-success hover:bg-status-success/10"
                : "border-border-default text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            }`}
          >
            {generatingTemplate ? "Generating Template..." : spriteTemplate ? "Template Ready" : "Gen Template"}
          </button>

          {/* Generate missing */}
          {batchRunning ? (
            <button
              onClick={handleAbortBatch}
              className="rounded border border-status-error/40 px-3 py-1.5 text-xs text-status-error transition-colors hover:bg-status-error/10"
            >
              Abort
            </button>
          ) : (
            <button
              onClick={handleBatchGenerate}
              disabled={!hasApiKey || missingInView === 0 || !!generating}
              title={!hasApiKey ? "Configure an API key in Settings first" : `Generate ${missingInView} missing sprite${missingInView !== 1 ? "s" : ""}`}
              className="rounded border border-accent/40 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              Generate Missing ({missingInView})
            </button>
          )}

          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import from Folder..."}
          </button>
          <button
            onClick={handleDeploy}
            disabled={deploying || coveredCount === 0}
            className="rounded border border-accent/40 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {deploying ? "Deploying..." : "Deploy to R2"}
          </button>
        </div>
      </div>

      {/* Batch progress banner */}
      {batchProgress && (
        <div className="shrink-0 border-b border-border-default bg-bg-elevated px-4 py-2">
          <div className="flex items-center gap-3 text-xs">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${(batchProgress.done / Math.max(batchProgress.total, 1)) * 100}%` }}
              />
            </div>
            <span className="text-text-secondary">
              {batchProgress.done} / {batchProgress.total}
            </span>
            {batchProgress.failed > 0 && (
              <span className="text-status-error">{batchProgress.failed} failed</span>
            )}
            {!batchRunning && (
              <button
                onClick={() => setBatchProgress(null)}
                className="text-text-muted hover:text-text-primary"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Import result banner */}
      {importResult && (
        <div className="shrink-0 border-b border-border-default bg-bg-elevated px-4 py-2">
          <div className="flex items-center gap-3 text-xs">
            {importResult.imported > 0 && (
              <span className="text-status-success">
                {importResult.imported} imported
              </span>
            )}
            {importResult.retagged > 0 && (
              <span className="text-status-success">
                {importResult.retagged} retagged
              </span>
            )}
            {importResult.skipped > 0 && (
              <span className="text-text-muted">
                {importResult.skipped} already tagged
              </span>
            )}
            {importResult.errors.length > 0 && (
              <span className="text-status-error">
                {importResult.errors.length} errors
              </span>
            )}
            <button
              onClick={() => setImportResult(null)}
              className="ml-auto text-text-muted hover:text-text-primary"
            >
              &times;
            </button>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-1 max-h-20 overflow-y-auto text-2xs text-status-error">
              {importResult.errors.slice(0, 10).map((e, i) => (
                <div key={i}>{e}</div>
              ))}
              {importResult.errors.length > 10 && (
                <div>...and {importResult.errors.length - 10} more</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Deploy result banner */}
      {deployResult && (
        <div className="shrink-0 border-b border-border-default bg-bg-elevated px-4 py-2">
          <div className="flex items-center gap-3 text-xs">
            {deployResult.uploaded > 0 && (
              <span className="text-status-success">
                {deployResult.uploaded} uploaded
              </span>
            )}
            {deployResult.skipped > 0 && (
              <span className="text-text-muted">
                {deployResult.skipped} already synced
              </span>
            )}
            {deployResult.failed > 0 && (
              <span className="text-status-error">
                {deployResult.failed} failed
              </span>
            )}
            <button
              onClick={() => setDeployResult(null)}
              className="ml-auto text-text-muted hover:text-text-primary"
            >
              &times;
            </button>
          </div>
          {deployResult.errors.length > 0 && (
            <div className="mt-1 max-h-20 overflow-y-auto text-2xs text-status-error">
              {deployResult.errors.slice(0, 10).map((e, i) => (
                <div key={i}>{e}</div>
              ))}
              {deployResult.errors.length > 10 && (
                <div>...and {deployResult.errors.length - 10} more</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border-default px-4 py-2">
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Race:
          <select
            value={filterRace}
            onChange={(e) => setFilterRace(e.target.value)}
            className="rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none"
          >
            <option value="all">All</option>
            {races.map((r) => (
              <option key={r} value={r}>
                {config.races[r.toUpperCase()]?.displayName ?? r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Class:
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none"
          >
            <option value="all">All</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {config.classes[c.toUpperCase()]?.displayName ?? c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Sprite grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-2xs text-text-muted">
          Filename format:{" "}
          <code className="font-mono">
            player_sprites/&#123;race&#125;_&#123;class-or-base&#125;_t&#123;tier&#125;.png
          </code>
          {" | "}Base and staff sprites use <code className="font-mono">base</code> instead of a class key.
          {" | "}Tiers: {allTiers.map((t) => `t${t}`).join(", ")}
          {" | "}Click a sprite to open the larger view.
        </p>

        {filteredRaces.map((race) => (
          <div key={race} className="mb-6">
            <h3 className="mb-2 font-display text-xs uppercase tracking-widest text-accent">
              {config.races[race.toUpperCase()]?.displayName ?? race}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className="border border-border-default bg-bg-tertiary px-2 py-1 text-left text-2xs font-normal text-text-muted">
                      Class
                    </th>
                    {tiers.map((tier) => (
                      <th
                        key={tier}
                        scope="col"
                        className="border border-border-default bg-bg-tertiary px-1 py-1 text-center text-2xs font-normal text-text-muted"
                      >
                        <div>{tierLabel(tier)}</div>
                        <div className="text-3xs opacity-60">
                          {tierRange(tier, allTiers)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.cls}>
                      <td className="border border-border-default bg-bg-secondary px-2 py-1 text-xs text-text-secondary">
                        {row.label}
                      </td>
                      {tiers.map((tier) => {
                        const slotClass = isRaceOnlyTier(tier) ? "base" : row.cls;
                        const isUnavailable = row.shared ? !isRaceOnlyTier(tier) : isRaceOnlyTier(tier);
                        if (isUnavailable) {
                          return (
                            <td key={tier} className="border border-border-default bg-bg-primary/40 p-0.5">
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded text-3xs text-text-muted/60">
                                --
                              </div>
                            </td>
                          );
                        }

                        const key = spriteKey(race, slotClass, tier);
                        const asset = spriteMap.get(key);
                        const isGenerating = generating === key;
                        const isEmpty = !asset;
                        const canGenerate = hasApiKey && !batchRunning && !generating;

                        return (
                          <td
                            key={tier}
                            className="border border-border-default p-0.5"
                            title={`player_sprites/${key}.png`}
                          >
                            <div
                              className="group relative mx-auto h-12 w-12 overflow-hidden rounded"
                            >
                              {isGenerating ? (
                                <div className="flex h-full w-full items-center justify-center bg-bg-tertiary">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                                </div>
                              ) : (
                                <>
                                  <button
                                    disabled={isEmpty}
                                    onClick={() => {
                                      if (asset) {
                                        setViewSprite({ key, fileName: asset.file_name, assetId: asset.id, race, cls: slotClass, tier });
                                      }
                                    }}
                                    className="h-full w-full disabled:cursor-default"
                                  >
                                    <SpriteThumbnail fileName={asset?.file_name} />
                                  </button>
                                  {/* Hover overlay with actions */}
                                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                    {isEmpty ? (
                                      canGenerate && (
                                        <button
                                          onClick={() => handleGenerateOne(race, slotClass, tier)}
                                          className="pointer-events-auto rounded px-1.5 py-0.5 text-3xs font-medium text-accent hover:bg-accent/20"
                                          title="Generate"
                                        >
                                          Generate
                                        </button>
                                      )
                                    ) : (
                                      <div className="rounded px-1.5 py-0.5 text-3xs font-medium text-text-primary">
                                        View
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Sprite lightbox */}
      {viewSprite && (
        <SpriteLightbox
          spriteKey={viewSprite.key}
          fileName={viewSprite.fileName}
          variantGroup={`player_sprite:${viewSprite.key}`}
          canRegenerate={!batchRunning && !generating}
          canDelete={!batchRunning && !generating}
          onRegenerate={() => {
            setViewSprite(null);
            void handleGenerateOne(viewSprite.race, viewSprite.cls, viewSprite.tier);
          }}
          onDelete={() => {
            const assetId = viewSprite.assetId;
            setViewSprite(null);
            void deleteAsset(assetId);
          }}
          onRemoveBg={() => {
            setViewSprite(null);
            void loadAssets();
          }}
          onClose={() => setViewSprite(null)}
        />
      )}
      </>
      )}
    </div>
  );
}
