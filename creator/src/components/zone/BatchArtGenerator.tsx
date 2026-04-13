import { useState, useCallback, useRef } from "react";
import { AI_ENABLED } from "@/lib/featureFlags";
import type { WorldFile } from "@/types/world";
import { ART_STYLE_LABELS } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";
import { useVibeStore } from "@/stores/vibeStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { ActionButton } from "@/components/ui/FormWidgets";
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
  const [bgRemoval, setBgRemoval] = useState<{ done: number; total: number } | null>(null);
  const [concurrency, setConcurrency] = useState(settings?.batch_concurrency ?? 5);
  const abortRef = useRef(false);
  const trapRef = useFocusTrap<HTMLDivElement>(running ? undefined : onClose);

  const checkedTargets = targets.filter((t) => t.checked);
  const missingTargets = targets.filter((t) => !t.hasExisting);
  const doneCount = targets.filter((t) => t.status === "done").length;
  const errorCount = targets.filter((t) => t.status === "error").length;
  const imageProvider = settings?.image_provider ?? "deepinfra";

  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const toggleTarget = (idx: number) => {
    setTargets((prev) => prev.map((t, i) => (i === idx ? { ...t, checked: !t.checked } : t)));
  };

  const selectAll = () => setTargets((prev) => prev.map((t) => ({ ...t, checked: true })));
  const selectNone = () => setTargets((prev) => prev.map((t) => ({ ...t, checked: false })));
  const selectMissing = () => setTargets((prev) => prev.map((t) => ({ ...t, checked: !t.hasExisting })));

  const handleRun = useCallback(async () => {
    setRunning(true);
    abortRef.current = false;

    setBgRemoval(null);
    await runBatchArtGeneration(
      targets,
      world,
      zoneId,
      artStyle,
      vibe,
      imageProvider,
      settings?.image_model,
      concurrency,
      abortRef,
      {
        onTargetUpdate: (idx, update) => {
          setTargets((prev) =>
            prev.map((t, i) => (i === idx ? { ...t, ...update } : t)),
          );
        },
        onWorldUpdate: onWorldChange,
        onBgRemovalProgress: (done, total) => setBgRemoval({ done, total }),
        acceptAsset,
      },
      settings?.auto_remove_bg,
    );

    setBgRemoval(null);
    setRunning(false);
  }, [targets, world, onWorldChange, artStyle, vibe, imageProvider, concurrency, zoneId, acceptAsset, settings]);

  if (!AI_ENABLED) return null;

  if (targets.length === 0) {
    return (
      <div className="dialog-overlay">
        <div className="dialog-shell w-full max-w-md">
          <div className="dialog-header">
            <h2 className="dialog-title">Batch Art Generation</h2>
          </div>
          <div className="dialog-body">
            <p className="text-sm text-text-secondary">
              This zone has no entities to generate art for.
            </p>
          </div>
          <div className="dialog-footer">
            <ActionButton onClick={onClose} variant="ghost" size="sm">
              Close
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-overlay" onClick={running ? undefined : onClose}>
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-art-title"
        className="dialog-shell flex max-h-[88vh] w-full max-w-3xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="min-w-0 flex-1">
            <h2 id="batch-art-title" className="dialog-title">
              Batch Art
            </h2>
            <p className="dialog-subtitle">
              Generate missing room and entity art for <span className="font-mono">{zoneId}</span>, then fold the accepted assets back into the zone data.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-right">
            <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1 text-2xs text-text-secondary">
              {checkedTargets.length} of {targets.length} selected
            </span>
            {!running && doneCount === 0 && (
              <div className="flex flex-wrap justify-end gap-2">
                <ActionButton onClick={selectAll} variant="ghost" size="sm" className="min-h-9 px-3">
                  All
                </ActionButton>
                <ActionButton onClick={selectNone} variant="ghost" size="sm" className="min-h-9 px-3">
                  None
                </ActionButton>
                {missingTargets.length < targets.length && (
                  <ActionButton onClick={selectMissing} variant="ghost" size="sm" className="min-h-9 px-3">
                    Missing only
                  </ActionButton>
                )}
              </div>
            )}
          </div>
        </div>

        {!running && doneCount === 0 && (
          <div className="border-b border-border-default px-5 py-3">
            <div className="rounded-2xl border border-border-default/60 bg-bg-primary/60 px-3 py-2 text-xs text-text-secondary">
              Style system: {ART_STYLE_LABELS[artStyle]}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="text-2xs text-text-muted">Concurrency:</label>
              <input
                type="range"
                min={1}
                max={10}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-24 accent-accent"
              />
              <span className="text-2xs text-text-secondary">{concurrency}</span>
              <span className="ml-auto text-2xs text-text-muted">{imageProvider}</span>
              {vibe && (
                <span className="text-2xs text-accent" title={vibe}>
                  vibe active
                </span>
              )}
            </div>
          </div>
        )}

        {running && (
          <div className="border-b border-border-default px-5 py-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                {bgRemoval
                  ? `Removing backgrounds: ${bgRemoval.done} of ${bgRemoval.total}`
                  : `${doneCount + errorCount} of ${checkedTargets.length}`}
              </span>
              <span className="text-text-muted">
                {bgRemoval
                  ? `${doneCount} images generated`
                  : `${doneCount} done${errorCount > 0 ? `, ${errorCount} errors` : ""}`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-primary">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${bgRemoval
                  ? (bgRemoval.total > 0 ? (bgRemoval.done / bgRemoval.total) * 100 : 0)
                  : ((doneCount + errorCount) / checkedTargets.length) * 100}%` }}
              />
            </div>
          </div>
        )}

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
                {target.hasExisting && target.status === "pending" && (
                  <span className="text-2xs text-status-success">has art</span>
                )}
                {target.error && (
                  <span className="truncate text-2xs text-status-error" title={target.error}>
                    {target.error.slice(0, 40)}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          {running ? (
            <ActionButton
              onClick={() => { abortRef.current = true; }}
              variant="danger"
              size="sm"
            >
              Abort
            </ActionButton>
          ) : (
            <>
              <ActionButton onClick={onClose} variant="ghost" size="sm">
                {doneCount > 0 ? "Done" : "Cancel"}
              </ActionButton>
              {doneCount === 0 && (
                <ActionButton
                  onClick={handleRun}
                  disabled={checkedTargets.length === 0}
                  variant="primary"
                  size="sm"
                >
                  Generate {checkedTargets.length} Images
                </ActionButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
