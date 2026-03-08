import { useState, useMemo, useCallback, useEffect } from "react";
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
import type { AssetEntry, SyncProgress } from "@/types/assets";

interface SpriteImportResult {
  imported: number;
  retagged: number;
  skipped: number;
  errors: string[];
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

  if (!config) return null;

  const { races, genders, classes, tiers } = getSpriteAxes(config);
  const allTiers = getAllTiers(config);
  const staffTier = config.images.staffSpriteTier;
  const total = totalSprites(config);

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
      <div className="flex shrink-0 items-center gap-3 border-b border-border-default bg-bg-secondary px-4 py-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">
          Player Sprites
        </h2>
        <span className="text-[10px] text-text-muted">
          {coveredCount} / {total} sprites
        </span>

        <div className="ml-auto flex items-center gap-2">
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
                            return (
                              <td
                                key={tier}
                                className="border border-border-default p-0.5"
                                title={`player_sprites/${key}.png`}
                              >
                                <div className="mx-auto h-12 w-12 overflow-hidden rounded">
                                  <SpriteThumbnail
                                    fileName={asset?.file_name}
                                  />
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
