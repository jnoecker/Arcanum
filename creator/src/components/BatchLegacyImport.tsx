import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import type { AssetEntry } from "@/types/assets";

interface LegacyImage {
  absolute_path: string;
  relative_path: string;
}

interface ImportTarget {
  image: LegacyImage;
  status: "pending" | "importing" | "done" | "skipped" | "error";
  error?: string;
}

export function BatchLegacyImport({ onClose }: { onClose: () => void }) {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const assets = useAssetStore((s) => s.assets);
  const loadAssets = useAssetStore((s) => s.loadAssets);

  const [targets, setTargets] = useState<ImportTarget[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const doneCount = targets?.filter((t) => t.status === "done").length ?? 0;
  const skippedCount = targets?.filter((t) => t.status === "skipped").length ?? 0;
  const errorCount = targets?.filter((t) => t.status === "error").length ?? 0;
  const finished = targets !== null && !running && (doneCount + skippedCount + errorCount) === targets.length;

  const handleScan = useCallback(async () => {
    if (!mudDir) return;
    setScanning(true);
    try {
      const images = await invoke<LegacyImage[]>("list_legacy_images", { mudDir });
      setTargets(
        images.map((image) => ({ image, status: "pending" as const })),
      );
    } catch {
      setTargets([]);
    } finally {
      setScanning(false);
    }
  }, [mudDir]);

  const handleImport = useCallback(async () => {
    if (!targets || targets.length === 0) return;
    setRunning(true);

    // Build a set of known hashes to detect already-imported
    const knownHashes = new Set(assets.map((a) => a.hash));

    for (let i = 0; i < targets.length; i++) {
      setCurrentIndex(i);
      const target = targets[i]!;

      setTargets((prev) =>
        prev!.map((t, j) => (j === i ? { ...t, status: "importing" } : t)),
      );

      try {
        const entry = await invoke<AssetEntry>("import_asset", {
          sourcePath: target.image.absolute_path,
          assetType: "background",
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="font-display text-sm tracking-wide text-text-primary">
            Import Legacy Images
          </h2>
          <button
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!targets && !scanning && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-text-secondary">
                Scan the server&rsquo;s images directory and import all artwork into the asset library for R2 sync.
              </p>
              <p className="rounded bg-bg-primary px-3 py-1.5 font-mono text-[10px] text-text-muted">
                {mudDir}/src/main/resources/world/images/
              </p>
              <button
                onClick={handleScan}
                className="rounded bg-accent/15 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
              >
                Scan for Images
              </button>
            </div>
          )}

          {scanning && (
            <div className="flex items-center gap-2 py-6">
              <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-xs text-text-secondary">Scanning...</span>
            </div>
          )}

          {targets !== null && targets.length === 0 && (
            <p className="py-6 text-center text-sm text-text-muted">
              No images found in the server&rsquo;s images directory.
            </p>
          )}

          {targets !== null && targets.length > 0 && (
            <>
              {/* Progress bar */}
              {(running || finished) && (
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

              {/* File list */}
              <div className="flex flex-col gap-0.5">
                {targets.map((target, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded px-2 py-0.5 text-xs"
                  >
                    <span className="w-4 shrink-0 text-center">
                      {target.status === "pending" && (
                        <span className="text-text-muted">&middot;</span>
                      )}
                      {target.status === "importing" && (
                        <span className="inline-block h-3 w-3 rounded-full border border-accent border-t-transparent animate-spin" />
                      )}
                      {target.status === "done" && (
                        <span className="text-status-success">&#x2713;</span>
                      )}
                      {target.status === "skipped" && (
                        <span className="text-text-muted">&#x2013;</span>
                      )}
                      {target.status === "error" && (
                        <span className="text-status-error">&#x2717;</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-text-secondary">
                      {target.image.relative_path}
                    </span>
                    {target.status === "skipped" && (
                      <span className="shrink-0 text-[10px] text-text-muted">
                        already imported
                      </span>
                    )}
                    {target.error && (
                      <span
                        className="shrink-0 truncate text-[10px] text-status-error"
                        title={target.error}
                      >
                        {target.error.slice(0, 30)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            disabled={running}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50"
          >
            {finished ? "Done" : "Cancel"}
          </button>
          {targets !== null && targets.length > 0 && !running && !finished && (
            <button
              onClick={handleImport}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110"
            >
              Import {targets.length} Images
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
