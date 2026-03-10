import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
} from "@/lib/spriteMatrix";
import {
  composePrompt,
  getEnhanceSystemPrompt,
  UNIVERSAL_NEGATIVE,
  ART_STYLE_LABELS,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import { IMAGE_MODELS, ENTITY_DIMENSIONS } from "@/types/assets";
import type { AssetEntry, GeneratedImage, SyncProgress } from "@/types/assets";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";

interface SpriteImportResult {
  imported: number;
  retagged: number;
  skipped: number;
  errors: string[];
}

/** Build a rich description string for a sprite slot to feed to the LLM enhancer. */
function buildSpriteContext(
  race: string,
  genderLabel: string,
  cls: string,
  tier: number,
  allTiers: number[],
  staffTier: number,
  config: ReturnType<typeof useConfigStore.getState>["config"],
): string {
  const raceDef = config?.races[race.toUpperCase()];
  const classDef = config?.classes[cls.toUpperCase()];
  const range = tierRange(tier, allTiers, staffTier);
  const isStaff = tier === staffTier;

  const parts = [
    `Race: ${raceDef?.displayName ?? race}`,
    raceDef?.description ? `Race description: ${raceDef.description}` : null,
    `Gender: ${genderLabel}`,
    `Class: ${classDef?.displayName ?? cls}`,
    classDef?.description ? `Class description: ${classDef.description}` : null,
    isStaff
      ? `Power tier: Staff (high-level game moderator/administrator)`
      : `Power tier: Level ${range} (${tierPowerWord(tier, allTiers, staffTier)})`,
    `Equipment and ornamentation should reflect a ${isStaff ? "powerful staff member" : tierPowerWord(tier, allTiers, staffTier) + " adventurer"} of the ${classDef?.displayName ?? cls} class.`,
  ];

  return parts.filter(Boolean).join("\n");
}

function tierPowerWord(tier: number, allTiers: number[], staffTier: number): string {
  const sorted = allTiers.filter((t) => t !== staffTier).sort((a, b) => a - b);
  const idx = sorted.indexOf(tier);
  const total = sorted.length;
  if (idx < 0) return "adventurer";
  const ratio = idx / Math.max(total - 1, 1);
  if (ratio <= 0.2) return "novice";
  if (ratio <= 0.4) return "experienced";
  if (ratio <= 0.6) return "veteran";
  if (ratio <= 0.8) return "elite";
  return "legendary";
}

function SpriteThumbnail({ fileName }: { fileName: string | undefined }) {
  const src = useImageSrc(fileName);
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg-tertiary text-[10px] text-text-muted">
        --
      </div>
    );
  }
  return (
    <img src={src} alt="" className="h-full w-full object-cover" />
  );
}

export function PlayerSpriteManager() {
  const config = useConfigStore((s) => s.config);
  const assets = useAssetStore((s) => s.assets);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const settings = useAssetStore((s) => s.settings);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const artStyle = useAssetStore((s) => s.artStyle);
  const setArtStyle = useAssetStore((s) => s.setArtStyle);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SpriteImportResult | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<SyncProgress | null>(null);
  const [filterRace, setFilterRace] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");

  // Generation state
  const [generating, setGenerating] = useState<string | null>(null); // spriteKey being generated
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const abortRef = useRef(false);

  if (!config) return null;

  const { races, genders, classes, tiers } = getSpriteAxes(config);
  const allTiers = getAllTiers(config);
  const staffTier = config.images.staffSpriteTier;
  const total = totalSprites(config);

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

  const coveredCount = spriteMap.size;

  // Apply filters
  const filteredRaces = filterRace === "all" ? races : [filterRace];
  const filteredGenders = filterGender === "all" ? genders : genders.filter((g) => g.id === filterGender);
  const filteredClasses = filterClass === "all" ? classes : [filterClass];

  /** Generate a single sprite, accept it, and optionally remove background. */
  const generateSprite = useCallback(async (
    race: string,
    genderId: string,
    genderLabel: string,
    cls: string,
    tier: number,
  ): Promise<boolean> => {
    const key = spriteKey(race, genderId, cls, tier);
    const context = buildSpriteContext(race, genderLabel, cls, tier, allTiers, staffTier, config);
    const basePrompt = composePrompt("player_sprite", artStyle);

    // Enhance via LLM if keys available
    let finalPrompt = basePrompt;
    const hasLlmKey = settings && (
      settings.deepinfra_api_key.length > 0 ||
      settings.anthropic_api_key.length > 0 ||
      settings.openrouter_api_key.length > 0
    );
    if (hasLlmKey) {
      try {
        const systemPrompt = getEnhanceSystemPrompt(artStyle);
        const userPrompt = [
          `Generate an image prompt for this player character sprite:\n${context}`,
          `\nReference style template (adapt but prioritize the character description above):\n${basePrompt}`,
        ].join("\n");
        finalPrompt = await invoke<string>("llm_complete", { systemPrompt, userPrompt });
      } catch {
        // Fall back to composed prompt with context appended
        finalPrompt = composePrompt("player_sprite", artStyle, context);
      }
    } else {
      finalPrompt = composePrompt("player_sprite", artStyle, context);
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

    // Auto-remove background if enabled
    if (settings?.auto_remove_bg && shouldRemoveBg("player_sprite") && image.data_url) {
      removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {});
    }

    return true;
  }, [config, artStyle, settings, imageProvider, defaultModel, allTiers, staffTier, acceptAsset]);

  /** Generate a single sprite cell on click. */
  const handleGenerateOne = useCallback(async (
    race: string,
    genderId: string,
    genderLabel: string,
    cls: string,
    tier: number,
  ) => {
    const key = spriteKey(race, genderId, cls, tier);
    setGenerating(key);
    try {
      await generateSprite(race, genderId, genderLabel, cls, tier);
      await loadAssets();
    } catch (e) {
      console.error(`Failed to generate sprite ${key}:`, e);
    } finally {
      setGenerating(null);
    }
  }, [generateSprite, loadAssets]);

  /** Batch generate all missing sprites (respects current filters). */
  const handleBatchGenerate = useCallback(async () => {
    // Collect missing sprite slots
    const missing: Array<{ race: string; genderId: string; genderLabel: string; cls: string; tier: number }> = [];
    for (const race of filteredRaces) {
      for (const gender of filteredGenders) {
        for (const cls of filteredClasses) {
          for (const tier of tiers) {
            const key = spriteKey(race, gender.id, cls, tier);
            if (!spriteMap.has(key)) {
              missing.push({ race, genderId: gender.id, genderLabel: gender.label, cls, tier });
            }
          }
        }
      }
    }

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

        const key = spriteKey(slot.race, slot.genderId, slot.cls, slot.tier);
        setGenerating(key);

        try {
          await generateSprite(slot.race, slot.genderId, slot.genderLabel, slot.cls, slot.tier);
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
  }, [filteredRaces, filteredGenders, filteredClasses, tiers, spriteMap, settings, generateSprite, loadAssets]);

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

  const missingInView = useMemo(() => {
    let count = 0;
    for (const race of filteredRaces) {
      for (const gender of filteredGenders) {
        for (const cls of filteredClasses) {
          for (const tier of tiers) {
            if (!spriteMap.has(spriteKey(race, gender.id, cls, tier))) count++;
          }
        }
      }
    }
    return count;
  }, [filteredRaces, filteredGenders, filteredClasses, tiers, spriteMap]);

  if (races.length === 0 || genders.length === 0 || classes.length === 0) {
    return (
      <div className="p-6 text-sm text-text-muted">
        <p>
          Player sprites require races, classes, and genders with sprite codes
          to be configured. Set these up in the Config tab first.
        </p>
        <p className="mt-2 text-[10px]">
          Genders need a <code className="font-mono">spriteCode</code> field
          (e.g. "male", "female", "enby") to be included in the sprite matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border-default bg-bg-secondary px-4 py-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">
          Player Sprites
        </h2>
        <span className="text-[10px] text-text-muted">
          {coveredCount} / {total} sprites
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Art style */}
          <select
            value={artStyle}
            onChange={(e) => setArtStyle(e.target.value as ArtStyle)}
            className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-[10px] text-text-primary outline-none"
          >
            {Object.entries(ART_STYLE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>

          {/* Generate missing */}
          {batchRunning ? (
            <button
              onClick={handleAbortBatch}
              className="rounded border border-status-error/40 px-3 py-1 text-xs text-status-error transition-colors hover:bg-status-error/10"
            >
              Abort
            </button>
          ) : (
            <button
              onClick={handleBatchGenerate}
              disabled={!hasApiKey || missingInView === 0 || !!generating}
              title={!hasApiKey ? "Configure an API key in Settings first" : `Generate ${missingInView} missing sprite${missingInView !== 1 ? "s" : ""}`}
              className="rounded border border-accent/40 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              Generate Missing ({missingInView})
            </button>
          )}

          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded border border-border-default px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import from Folder..."}
          </button>
          <button
            onClick={handleDeploy}
            disabled={deploying || coveredCount === 0}
            className="rounded border border-accent/40 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
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
            <div className="mt-1 max-h-20 overflow-y-auto text-[10px] text-status-error">
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
            <div className="mt-1 max-h-20 overflow-y-auto text-[10px] text-status-error">
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
          Gender:
          <select
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
            className="rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none"
          >
            <option value="all">All</option>
            {genders.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
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
        <p className="mb-3 text-[10px] text-text-muted">
          Filename format:{" "}
          <code className="font-mono">
            player_sprites/&#123;race&#125;_&#123;spriteCode&#125;_&#123;class&#125;_l&#123;tier&#125;.png
          </code>
          {" | "}Tiers: {allTiers.map((t) => `l${t}`).join(", ")}
          {" | "}Click an empty cell to generate a single sprite.
        </p>

        {filteredRaces.map((race) => (
          <div key={race} className="mb-6">
            <h3 className="mb-2 font-display text-xs uppercase tracking-widest text-accent">
              {config.races[race.toUpperCase()]?.displayName ?? race}
            </h3>

            {filteredGenders.map((gender) => (
              <div key={gender.id} className="mb-4">
                <h4 className="mb-1.5 text-[10px] uppercase tracking-wider text-text-muted">
                  {gender.label}
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-border-default bg-bg-tertiary px-2 py-1 text-left text-[10px] font-normal text-text-muted">
                          Class
                        </th>
                        {tiers.map((tier) => (
                          <th
                            key={tier}
                            className="border border-border-default bg-bg-tertiary px-1 py-1 text-center text-[10px] font-normal text-text-muted"
                          >
                            <div>{tierLabel(tier, staffTier)}</div>
                            <div className="text-[9px] opacity-60">
                              {tierRange(tier, allTiers, staffTier)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClasses.map((cls) => (
                        <tr key={cls}>
                          <td className="border border-border-default bg-bg-secondary px-2 py-1 text-xs text-text-secondary">
                            {config.classes[cls.toUpperCase()]?.displayName ?? cls}
                          </td>
                          {tiers.map((tier) => {
                            const key = spriteKey(race, gender.id, cls, tier);
                            const asset = spriteMap.get(key);
                            const isGenerating = generating === key;
                            const isEmpty = !asset;
                            const canGenerate = isEmpty && hasApiKey && !batchRunning && !generating;

                            return (
                              <td
                                key={tier}
                                className="border border-border-default p-0.5"
                                title={`player_sprites/${key}.png`}
                              >
                                <div
                                  className={`group relative mx-auto h-12 w-12 overflow-hidden rounded ${canGenerate ? "cursor-pointer" : ""}`}
                                  onClick={canGenerate ? () => handleGenerateOne(race, gender.id, gender.label, cls, tier) : undefined}
                                >
                                  {isGenerating ? (
                                    <div className="flex h-full w-full items-center justify-center bg-bg-tertiary">
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                                    </div>
                                  ) : (
                                    <>
                                      <SpriteThumbnail fileName={asset?.file_name} />
                                      {canGenerate && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-accent/10 opacity-0 transition-opacity group-hover:opacity-100">
                                          <span className="text-[10px] font-medium text-accent">Gen</span>
                                        </div>
                                      )}
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
        ))}
      </div>
    </div>
  );
}
