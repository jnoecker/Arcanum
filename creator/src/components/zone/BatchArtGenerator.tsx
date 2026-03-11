import { useState, useCallback, useRef } from "react";
import type { WorldFile } from "@/types/world";
import { ART_STYLE_LABELS } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";
import { useVibeStore } from "@/stores/vibeStore";
import {
  collectTargets,
  runBatchArtGeneration,
} from "@/lib/batchArt";

interface BatchArtGeneratorProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onClose: () => void;
}

export function BatchArtGenerator({
  zoneId,
  world,
  onWorldChange,
  onClose,
}: BatchArtGeneratorProps) {
  const artStyle = useAssetStore((s) => s.artStyle);
  const settings = useAssetStore((s) => s.settings);
  const vibe = useVibeStore((s) => s.vibes.get(zoneId) ?? "");
  const [targets, setTargets] = useState(() => collectTargets(world));
  const [running, setRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(settings?.batch_concurrency ?? 5);
  const abortRef = useRef(false);

  const checkedTargets = targets.filter((t) => t.checked);
  const doneCount = targets.filter((t) => t.status === "done").length;
  const errorCount = targets.filter((t) => t.status === "error").length;
  const imageProvider = settings?.image_provider ?? "deepinfra";

  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const toggleTarget = (idx: number) => {
    setTargets((prev) => prev.map((t, i) => (i === idx ? { ...t, checked: !t.checked } : t)));
  };

  const handleRun = useCallback(async () => {
    setRunning(true);
    abortRef.current = false;

    await runBatchArtGeneration(
      targets,
      world,
      zoneId,
      artStyle,
      vibe,
      imageProvider,
      concurrency,
      abortRef,
      {
        onTargetUpdate: (idx, update) => {
          setTargets((prev) =>
            prev.map((t, i) => (i === idx ? { ...t, ...update } : t)),
          );
        },
        onWorldUpdate: onWorldChange,
        acceptAsset,
      },
      settings?.auto_remove_bg,
    );

    setRunning(false);
  }, [targets, world, onWorldChange, artStyle, vibe, imageProvider, concurrency, zoneId, acceptAsset]);

  if (targets.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl">
          <div className="border-b border-border-default px-5 py-3">
            <h2 className="font-display text-sm tracking-wide text-text-primary">
              Batch Art Generation
            </h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-text-secondary">
              All entities in this zone already have images.
            </p>
          </div>
          <div className="flex justify-end border-t border-border-default px-5 py-3">
            <button
              onClick={onClose}
              className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="font-display text-sm tracking-wide text-text-primary">
            Batch Art — {zoneId}
          </h2>
          <span className="text-xs text-text-muted">
            {checkedTargets.length} of {targets.length} selected
          </span>
        </div>

        {/* Style selector + concurrency */}
        {!running && doneCount === 0 && (
          <div className="border-b border-border-default px-5 py-2">
            <div className="rounded border border-border-default/60 bg-bg-primary/60 px-3 py-2 text-xs text-text-secondary">
              Style system: {ART_STYLE_LABELS[artStyle]}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[10px] text-text-muted">Concurrency:</label>
              <input
                type="range"
                min={1}
                max={10}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-24 accent-accent"
              />
              <span className="text-[10px] text-text-secondary">{concurrency}</span>
              {vibe && (
                <span className="ml-auto text-[10px] text-accent" title={vibe}>
                  vibe active
                </span>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {running && (
          <div className="border-b border-border-default px-5 py-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                {doneCount + errorCount} of {checkedTargets.length}
              </span>
              <span className="text-text-muted">
                {doneCount} done{errorCount > 0 ? `, ${errorCount} errors` : ""}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-primary">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${((doneCount + errorCount) / checkedTargets.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Target list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex flex-col gap-1">
            {targets.map((target, i) => (
              <label
                key={`${target.kind}:${target.id}`}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-bg-elevated"
              >
                {!running && doneCount === 0 && (
                  <input
                    type="checkbox"
                    checked={target.checked}
                    onChange={() => toggleTarget(i)}
                    className="accent-accent"
                  />
                )}
                <span className="w-4 shrink-0 text-center">
                  {target.status === "pending" && (
                    <span className="text-text-muted">&middot;</span>
                  )}
                  {target.status === "generating" && (
                    <span className="inline-block h-3 w-3 rounded-full border border-accent border-t-transparent animate-spin" />
                  )}
                  {target.status === "done" && (
                    <span className="text-status-success">&#x2713;</span>
                  )}
                  {target.status === "error" && (
                    <span className="text-status-error">&#x2717;</span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {target.label}
                </span>
                {target.error && (
                  <span className="truncate text-[10px] text-status-error" title={target.error}>
                    {target.error.slice(0, 40)}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          {running ? (
            <button
              onClick={() => { abortRef.current = true; }}
              className="rounded border border-status-danger/40 px-4 py-1.5 text-xs text-status-danger hover:bg-status-danger/10"
            >
              Abort
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                {doneCount > 0 ? "Done" : "Cancel"}
              </button>
              {doneCount === 0 && (
                <button
                  onClick={handleRun}
                  disabled={checkedTargets.length === 0}
                  className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:opacity-50"
                >
                  Generate {checkedTargets.length} Images
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
