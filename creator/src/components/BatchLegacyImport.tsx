import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { AssetEntry } from "@/types/assets";
import { ActionButton, DialogShell, Spinner } from "./ui/FormWidgets";

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

  const doneCount = targets?.filter((target) => target.status === "done").length ?? 0;
  const skippedCount = targets?.filter((target) => target.status === "skipped").length ?? 0;
  const errorCount = targets?.filter((target) => target.status === "error").length ?? 0;
  const importFinished = targets !== null && !running && (doneCount + skippedCount + errorCount) === targets.length;
  const hasLocalImages = targets !== null && targets.length > 0;
  const needsImport = hasLocalImages && !importFinished;
  const needsSync = importFinished && phase === "import";

  const handleScan = useCallback(async () => {
    if (!mudDir) return;
    setScanning(true);
    try {
      const media = await invoke<LegacyMedia[]>("list_legacy_media", { mudDir });
      setTargets(media.map((image) => ({ image, status: "pending" as const })));
      if (media.length === 0) {
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

    const knownHashes = new Set(assets.map((asset) => asset.hash));

    for (let index = 0; index < targets.length; index++) {
      setCurrentIndex(index);
      const target = targets[index]!;

      setTargets((previous) =>
        previous!.map((entry, entryIndex) => (entryIndex === index ? { ...entry, status: "importing" } : entry)),
      );

      try {
        const ext = target.image.relative_path.split(".").pop()?.toLowerCase() ?? "";
        const assetType = ["mp4", "webm"].includes(ext)
          ? "video"
          : ["mp3", "ogg", "flac", "wav"].includes(ext)
            ? "audio"
            : "background";

        const entry = await invoke<AssetEntry>("import_asset", {
          sourcePath: target.image.absolute_path,
          assetType,
          context: null,
        });

        const wasKnown = knownHashes.has(entry.hash);
        knownHashes.add(entry.hash);

        setTargets((previous) =>
          previous!.map((current, currentIndexValue) =>
            currentIndexValue === index ? { ...current, status: wasKnown ? "skipped" : "done" } : current,
          ),
        );
      } catch (invokeError) {
        setTargets((previous) =>
          previous!.map((current, currentIndexValue) =>
            currentIndexValue === index ? { ...current, status: "error", error: String(invokeError) } : current,
          ),
        );
      }
    }

    await loadAssets();
    setRunning(false);
  }, [targets, assets, loadAssets]);

  const handleSync = useCallback(async () => {
    setPhase("sync");
    setSyncStatus("Syncing imported media to R2...");
    try {
      const result = await syncToR2();
      setSyncStatus(
        `Synced ${result.uploaded} assets, skipped ${result.skipped}` +
          (result.failed > 0 ? `, failed ${result.failed}` : ""),
      );
      if (result.failed === 0) {
        setPhase("migrate");
      }
    } catch (invokeError) {
      setSyncStatus(`Sync failed: ${invokeError}`);
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
    } catch (invokeError) {
      setError(String(invokeError));
    } finally {
      setMigrating(false);
    }
  }, [mudDir]);

  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="batch-import-title"
      title="Restore Legacy Media"
      subtitle="Scan the project for local media, absorb it into the asset library, sync it to R2, then rewrite the old YAML references in place."
      widthClassName="max-w-4xl"
      onClose={running || migrating ? undefined : onClose}
      status={<StepPill phase={phase} />}
      footer={
        <>
          <ActionButton onClick={onClose} disabled={running || migrating} variant="ghost">
            {phase === "done" ? "Done" : "Close"}
          </ActionButton>
          {needsImport && !running && (
            <ActionButton onClick={handleImport} variant="primary">
              Import {targets!.length} Assets
            </ActionButton>
          )}
          {needsSync && (
            <ActionButton onClick={handleSync} variant="primary">
              Sync To R2
            </ActionButton>
          )}
          {phase === "migrate" && !migrating && (
            <ActionButton onClick={handleMigrate} variant="primary">
              Rewrite YAML References
            </ActionButton>
          )}
        </>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="instrument-panel rounded-3xl p-5">
          <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Sequence</p>
          <div className="mt-4 space-y-3">
            <StageCard title="1. Scan" active={phase === "scan"} done={targets !== null}>
              Inspect the legacy resources directory and gather media candidates.
            </StageCard>
            <StageCard title="2. Import" active={phase === "import"} done={importFinished && hasLocalImages}>
              Fold each discovered asset into Creator's asset library.
            </StageCard>
            <StageCard title="3. Sync" active={phase === "sync"} done={phase === "migrate" || phase === "done"}>
              Publish imported assets to R2 so future references stay stable.
            </StageCard>
            <StageCard title="4. Rewrite" active={phase === "migrate"} done={phase === "done"}>
              Replace old file references in YAML and retire local image paths.
            </StageCard>
          </div>
        </aside>

        <section className="flex min-h-[28rem] flex-col gap-4">
          {phase === "scan" && !targets && !scanning && (
            <div className="panel-surface-light rounded-3xl p-5">
              <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Scan source</p>
              <p className="mt-3 text-sm leading-7 text-text-secondary">
                The importer will inspect the local resources tree, collect images, video, and audio, then prepare them for migration.
              </p>
              <p className="mt-4 rounded-2xl border border-white/8 bg-black/12 px-4 py-3 font-mono text-xs text-text-muted">
                {mudDir ? `${mudDir}/src/main/resources/` : "No project directory is available."}
              </p>
              <div className="mt-5">
                <ActionButton onClick={handleScan} variant="primary" disabled={!mudDir}>
                  Scan For Legacy Media
                </ActionButton>
              </div>
            </div>
          )}

          {scanning && (
            <div className="panel-surface-light flex min-h-[16rem] items-center justify-center rounded-3xl px-6 py-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-5 w-5 border-2" />
                <p className="text-sm text-text-secondary">Scanning the resources tree for import candidates...</p>
              </div>
            </div>
          )}

          {hasLocalImages && (
            <div className="panel-surface-light rounded-3xl p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Asset queue</p>
                <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs text-text-secondary">
                  {targets!.length} candidate{targets!.length !== 1 ? "s" : ""}
                </span>
              </div>

              {(running || importFinished) && (
                <div className="mt-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-text-secondary">
                      {running ? `Importing ${currentIndex + 1} of ${targets!.length}` : "Import pass complete"}
                    </span>
                    <span className="text-text-muted">
                      {doneCount} new, {skippedCount} existing{errorCount > 0 ? `, ${errorCount} failed` : ""}
                    </span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full border border-white/8 bg-black/18"
                    role="progressbar"
                    aria-valuenow={doneCount + skippedCount + errorCount}
                    aria-valuemax={targets!.length}
                    aria-label="Import progress"
                  >
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(168,151,210,0.92),rgba(140,174,201,0.9))] transition-[width] duration-300"
                      style={{ width: `${((doneCount + skippedCount + errorCount) / targets!.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {!running && !importFinished && (
                <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {targets!.map((target, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/12 px-4 py-3 text-sm">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/4 text-2xs text-text-muted">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-text-secondary">
                        {target.image.relative_path}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {targets !== null && targets.length === 0 && phase !== "migrate" && phase !== "done" && (
            <div className="panel-surface-light rounded-3xl p-5 text-sm text-text-secondary">
              No local media were found. Creator can skip directly to rewriting any stale YAML references.
            </div>
          )}

          {syncStatus && (
            <div className="rounded-3xl border border-white/8 bg-black/12 px-4 py-3 text-sm text-text-secondary">
              {syncStatus}
            </div>
          )}

          {phase === "migrate" && !migrating && !migrationReport && (
            <div className="panel-surface-light rounded-3xl p-5">
              <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Rewrite preview</p>
              <p className="mt-3 text-sm leading-7 text-text-secondary">
                Creator is ready to replace local image references with their R2 filenames and remove obsolete local image files.
              </p>
              <p className="mt-4 rounded-2xl border border-status-warning/25 bg-status-warning/8 px-4 py-3 text-xs text-text-secondary">
                This operation edits zone YAML files and <span className="font-mono">application.yaml</span> in place.
              </p>
            </div>
          )}

          {migrating && (
            <div className="panel-surface-light flex min-h-[16rem] items-center justify-center rounded-3xl px-6 py-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-5 w-5 border-2" />
                <p className="text-sm text-text-secondary">Rewriting YAML references and retiring local files...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-3xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          )}

          {migrationReport && (
            <div className="grid gap-4 lg:grid-cols-3">
              <MetricCard label="Zone files updated" value={migrationReport.zone_files_updated} detail={`${migrationReport.zone_refs_rewritten} references rewritten`} />
              <MetricCard label="Config references" value={migrationReport.config_refs_rewritten} detail="application.yaml entries adjusted" />
              <MetricCard label="Local files removed" value={migrationReport.images_deleted} detail="Retired after successful migration" />
              {migrationReport.errors.length > 0 && (
                <div className="rounded-3xl border border-status-error/25 bg-status-error/8 p-4 lg:col-span-3">
                  <p className="font-display text-sm text-status-error">
                    {migrationReport.errors.length} warning{migrationReport.errors.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1 text-xs text-text-secondary">
                    {migrationReport.errors.map((entry, index) => (
                      <div key={index} className="rounded-2xl border border-status-error/18 bg-black/10 px-3 py-2">
                        {entry}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </DialogShell>
  );
}

function StepPill({ phase }: { phase: Phase }) {
  const label =
    phase === "scan"
      ? "Scanning"
      : phase === "import"
        ? "Importing"
        : phase === "sync"
          ? "Syncing"
          : phase === "migrate"
            ? "Rewriting"
            : "Complete";

  return (
    <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs text-text-secondary">
      {label}
    </span>
  );
}

function StageCard({
  title,
  active,
  done,
  children,
}: {
  title: string;
  active: boolean;
  done: boolean;
  children: string;
}) {
  return (
    <div
      className={`rounded-3xl border px-4 py-3 ${
        done
          ? "border-[var(--border-accent-subtle)] bg-[rgba(168,151,210,0.12)]"
          : active
            ? "border-[var(--border-glow-strong)] bg-[rgba(140,174,201,0.12)]"
            : "border-white/8 bg-black/12"
      }`}
    >
      <p className="font-display text-sm text-text-primary">{title}</p>
      <p className="mt-1 text-xs leading-6 text-text-secondary">{children}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="panel-surface-light rounded-3xl p-4">
      <p className="text-2xs uppercase tracking-wide-ui text-text-muted">{label}</p>
      <p className="mt-3 font-display text-[2rem] leading-none text-text-primary">{value}</p>
      <p className="mt-2 text-xs leading-6 text-text-secondary">{detail}</p>
    </div>
  );
}
