import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import type { AssetEntry } from "@/types/assets";

interface LegacyMedia {
  absolute_path: string;
  relative_path: string;
}

interface ImportTarget {
  image: LegacyMedia;
  status: "pending" | "importing" | "done" | "skipped" | "error";
  error?: string;
}

interface MigrationReport {
  zone_files_updated: number;
  zone_refs_rewritten: number;
  config_refs_rewritten: number;
  images_deleted: number;
  errors: string[];
}

type Phase = "scan" | "import" | "sync" | "migrate" | "done";

export function BatchLegacyImport({ onClose }: { onClose: () => void }) {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const assets = useAssetStore((s) => s.assets);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const syncToR2 = useAssetStore((s) => s.syncToR2);

  const [phase, setPhase] = useState<Phase>("scan");
  const [targets, setTargets] = useState<ImportTarget[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doneCount = targets?.filter((t) => t.status === "done").length ?? 0;
  const skippedCount = targets?.filter((t) => t.status === "skipped").length ?? 0;
  const errorCount = targets?.filter((t) => t.status === "error").length ?? 0;
  const importFinished = targets !== null && !running && (doneCount + skippedCount + errorCount) === targets.length;

  const handleScan = useCallback(async () => {
    if (!mudDir) return;
    setScanning(true);
    try {
      const media = await invoke<LegacyMedia[]>("list_legacy_media", { mudDir });
      setTargets(
        media.map((image) => ({ image, status: "pending" as const })),
      );
      if (media.length === 0) {
        // No local media — skip straight to migrate
        setPhase("migrate");
      }
    } catch {
      setTargets([]);
    } finally {
      setScanning(false);
    }
  }, [mudDir]);

  const handleImport = useCallback(async () => {
    if (!targets || targets.length === 0) return;
    setPhase("import");
    setRunning(true);

    const knownHashes = new Set(assets.map((a) => a.hash));

    for (let i = 0; i < targets.length; i++) {
      setCurrentIndex(i);
      const target = targets[i]!;

      setTargets((prev) =>
        prev!.map((t, j) => (j === i ? { ...t, status: "importing" } : t)),
      );

      try {
        const ext = target.image.relative_path.split(".").pop()?.toLowerCase() ?? "";
        const assetType = ["mp4", "webm"].includes(ext) ? "video"
          : ["mp3", "ogg", "flac", "wav"].includes(ext) ? "audio"
          : "background";

        const entry = await invoke<AssetEntry>("import_asset", {
          sourcePath: target.image.absolute_path,
          assetType,
          context: null,
        });

        const wasKnown = knownHashes.has(entry.hash);
        knownHashes.add(entry.hash);

        setTargets((prev) =>
          prev!.map((t, j) =>
            j === i ? { ...t, status: wasKnown ? "skipped" : "done" } : t,
          ),
        );
      } catch (e) {
        setTargets((prev) =>
          prev!.map((t, j) =>
            j === i ? { ...t, status: "error", error: String(e) } : t,
          ),
        );
      }
    }

    await loadAssets();
    setRunning(false);
  }, [targets, assets, loadAssets]);

  const handleSync = useCallback(async () => {
    setPhase("sync");
    setSyncStatus("Syncing to R2...");
    try {
      const result = await syncToR2();
      setSyncStatus(
        `Synced: ${result.uploaded} uploaded, ${result.skipped} already in R2` +
          (result.failed > 0 ? `, ${result.failed} failed` : ""),
      );
      if (result.failed === 0) {
        setPhase("migrate");
      }
    } catch (e) {
      setSyncStatus(`Sync failed: ${e}`);
    }
  }, [syncToR2]);

  const handleMigrate = useCallback(async () => {
    if (!mudDir) return;
    setMigrating(true);
    setError(null);
    try {
      const report = await invoke<MigrationReport>("migrate_images_to_r2", { mudDir });
      setMigrationReport(report);
      setPhase("done");
    } catch (e) {
      setError(String(e));
    } finally {
      setMigrating(false);
    }
  }, [mudDir]);

  const hasLocalImages = targets !== null && targets.length > 0;
  const needsImport = hasLocalImages && !importFinished;
  const needsSync = importFinished && phase === "import";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="font-display text-sm tracking-wide text-text-primary">
            Migrate Images to R2
          </h2>
          <button
            onClick={onClose}
            disabled={running || migrating}
            className="text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Step indicators */}
          <div className="mb-4 flex items-center gap-1 text-[10px]">
            <StepBadge label="1. Scan" active={phase === "scan"} done={targets !== null} />
            <span className="text-text-muted">&rarr;</span>
            <StepBadge label="2. Import" active={phase === "import"} done={importFinished && hasLocalImages} />
            <span className="text-text-muted">&rarr;</span>
            <StepBadge label="3. Sync" active={phase === "sync"} done={phase === "migrate" || phase === "done"} />
            <span className="text-text-muted">&rarr;</span>
            <StepBadge label="4. Migrate" active={phase === "migrate"} done={phase === "done"} />
          </div>

          {/* Scan phase */}
          {phase === "scan" && !targets && !scanning && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-text-secondary">
                Scan for local media (images, audio, video), import them, sync to R2, then rewrite all YAML references to use R2 filenames.
              </p>
              <p className="rounded bg-bg-primary px-3 py-1.5 font-mono text-[10px] text-text-muted">
                {mudDir}/src/main/resources/
              </p>
              <button
                onClick={handleScan}
                className="rounded bg-accent/15 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
              >
                Scan for Media
              </button>
            </div>
          )}

          {scanning && (
            <div className="flex items-center gap-2 py-6">
              <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-xs text-text-secondary">Scanning...</span>
            </div>
          )}

          {/* Import phase */}
          {hasLocalImages && (
            <>
              {(running || importFinished) && (
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-text-secondary">
                      {running
                        ? `Importing ${currentIndex + 1} of ${targets.length}...`
                        : "Import complete"}
                    </span>
                    <span className="text-text-muted">
                      {doneCount} new, {skippedCount} existing
                      {errorCount > 0 && `, ${errorCount} errors`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg-primary">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{
                        width: `${((doneCount + skippedCount + errorCount) / targets.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {!running && !importFinished && (
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                  {targets.map((target, i) => (
                    <div key={i} className="flex items-center gap-2 rounded px-2 py-0.5 text-xs">
                      <span className="text-text-muted">&middot;</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-text-secondary">
                        {target.image.relative_path}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* No local images — skip to migrate */}
          {targets !== null && targets.length === 0 && phase !== "migrate" && phase !== "done" && (
            <p className="py-2 text-center text-sm text-text-muted">
              No local images found. Proceeding to migrate YAML references.
            </p>
          )}

          {/* Sync phase */}
          {syncStatus && (
            <div className="mt-3 rounded bg-bg-primary px-3 py-2 text-xs text-text-secondary">
              {syncStatus}
            </div>
          )}

          {/* Migrate phase */}
          {phase === "migrate" && !migrating && !migrationReport && (
            <div className="mt-3 flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-text-secondary">
                Ready to rewrite all YAML image references to R2 hash filenames and delete local image files.
              </p>
              <p className="rounded bg-bg-primary px-3 py-2 text-[10px] text-text-muted">
                This will modify zone YAMLs and application.yaml in place.
              </p>
            </div>
          )}

          {migrating && (
            <div className="mt-3 flex items-center gap-2 py-4">
              <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-xs text-text-secondary">Migrating YAML references...</span>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded bg-status-error/10 px-3 py-2 text-xs text-status-error">
              {error}
            </div>
          )}

          {/* Done phase */}
          {migrationReport && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="rounded bg-bg-primary px-3 py-2 text-xs">
                <div className="mb-1 font-medium text-text-primary">Migration Complete</div>
                <div className="flex flex-col gap-0.5 text-text-secondary">
                  <span>{migrationReport.zone_files_updated} zone files updated ({migrationReport.zone_refs_rewritten} image references)</span>
                  <span>{migrationReport.config_refs_rewritten} config image references rewritten</span>
                  <span>{migrationReport.images_deleted} local image files deleted</span>
                </div>
              </div>
              {migrationReport.errors.length > 0 && (
                <div className="rounded bg-status-error/10 px-3 py-2 text-xs">
                  <div className="mb-1 font-medium text-status-error">
                    {migrationReport.errors.length} warnings
                  </div>
                  <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto text-text-muted">
                    {migrationReport.errors.map((err, i) => (
                      <span key={i}>{err}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            disabled={running || migrating}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50"
          >
            {phase === "done" ? "Done" : "Cancel"}
          </button>

          {/* Import button */}
          {needsImport && !running && (
            <button
              onClick={handleImport}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110"
            >
              Import {targets!.length} Images
            </button>
          )}

          {/* Sync button */}
          {needsSync && (
            <button
              onClick={handleSync}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110"
            >
              Sync to R2
            </button>
          )}

          {/* Migrate button */}
          {phase === "migrate" && !migrating && (
            <button
              onClick={handleMigrate}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110"
            >
              Migrate YAMLs
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 ${
        done
          ? "bg-status-success/15 text-status-success"
          : active
            ? "bg-accent/15 text-accent"
            : "bg-bg-primary text-text-muted"
      }`}
    >
      {label}
    </span>
  );
}
