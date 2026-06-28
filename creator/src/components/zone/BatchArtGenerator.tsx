import { AI_ENABLED } from "@/lib/featureFlags";
import { ART_STYLE_LABELS } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";
import { useVibeStore } from "@/stores/vibeStore";
import { useBatchArtStore } from "@/stores/batchArtStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { ActionButton } from "@/components/ui/FormWidgets";

/**
 * Global host for the batch art generator. Renders the full dialog when the
 * panel is open, or a compact progress pill when a job runs in the background.
 * Mounted once at the app shell so the job survives closing the dialog and
 * navigating between zones.
 */
export function BatchArtOverlay() {
  const job = useBatchArtStore((s) => s.job);
  const panelOpen = useBatchArtStore((s) => s.panelOpen);

  if (!AI_ENABLED || !job) return null;
  if (panelOpen) return <BatchArtPanel />;
  if (job.running) return <BatchArtPill />;
  return null;
}

function BatchArtPill() {
  const job = useBatchArtStore((s) => s.job);
  const showPanel = useBatchArtStore((s) => s.showPanel);
  const abort = useBatchArtStore((s) => s.abort);
  if (!job) return null;

  const checked = job.targets.filter((t) => t.checked).length;
  const done = job.targets.filter((t) => t.status === "done").length;
  const errors = job.targets.filter((t) => t.status === "error").length;
  const pct = job.bgRemoval
    ? job.bgRemoval.total > 0
      ? (job.bgRemoval.done / job.bgRemoval.total) * 100
      : 0
    : checked > 0
      ? ((done + errors) / checked) * 100
      : 0;

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-40 flex justify-start">
      <div className="pointer-events-auto w-72 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-accent border-t-transparent animate-spin" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xs uppercase tracking-wide text-text-muted">
              Batch Art &middot; {job.zoneId}
            </p>
            <p className="truncate text-xs text-text-secondary">
              {job.bgRemoval
                ? `Removing backgrounds: ${job.bgRemoval.done} of ${job.bgRemoval.total}`
                : `${done + errors} of ${checked} generated`}
            </p>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-primary">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <ActionButton onClick={showPanel} variant="ghost" size="sm" className="min-h-8 px-3">
            View
          </ActionButton>
          <ActionButton onClick={abort} variant="danger" size="sm" className="min-h-8 px-3">
            Abort
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function BatchArtPanel() {
  const job = useBatchArtStore((s) => s.job)!;
  const artStyle = useAssetStore((s) => s.artStyle);
  const settings = useAssetStore((s) => s.settings);
  const vibe = useVibeStore((s) => s.vibes.get(job.zoneId) ?? "");

  const closePanel = useBatchArtStore((s) => s.closePanel);
  const dismiss = useBatchArtStore((s) => s.dismiss);
  const toggleTarget = useBatchArtStore((s) => s.toggleTarget);
  const selectAll = useBatchArtStore((s) => s.selectAll);
  const selectNone = useBatchArtStore((s) => s.selectNone);
  const selectMissing = useBatchArtStore((s) => s.selectMissing);
  const selectChanged = useBatchArtStore((s) => s.selectChanged);
  const setConcurrency = useBatchArtStore((s) => s.setConcurrency);
  const start = useBatchArtStore((s) => s.start);
  const abort = useBatchArtStore((s) => s.abort);

  const { targets, running, bgRemoval, concurrency, zoneId } = job;
  const checkedTargets = targets.filter((t) => t.checked);
  const missingTargets = targets.filter((t) => !t.hasExisting);
  const changedTargets = targets.filter((t) => t.descriptionChanged);
  const doneCount = targets.filter((t) => t.status === "done").length;
  const errorCount = targets.filter((t) => t.status === "error").length;
  const imageProvider = settings?.image_provider ?? "deepinfra";

  // Escape backgrounds a running job; otherwise it discards setup / closes results.
  const trapRef = useFocusTrap<HTMLDivElement>(running ? closePanel : dismiss);
  const onOverlayClick = running ? closePanel : dismiss;

  if (targets.length === 0) {
    return (
      <div className="dialog-overlay" onClick={dismiss}>
        <div className="dialog-shell w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">
            <h2 className="dialog-title">Batch Art Generation</h2>
          </div>
          <div className="dialog-body">
            <p className="text-sm text-text-secondary">
              This zone has no entities to generate art for.
            </p>
          </div>
          <div className="dialog-footer">
            <ActionButton onClick={dismiss} variant="ghost" size="sm">
              Close
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  const showSetup = !running && doneCount === 0;

  return (
    <div className="dialog-overlay" onClick={onOverlayClick}>
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
              Select targets and generate art for <span className="font-mono">{zoneId}</span>.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-right">
            <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1 text-2xs text-text-secondary">
              {checkedTargets.length} of {targets.length} selected
            </span>
            {showSetup && (
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
                {changedTargets.length > 0 && (
                  <ActionButton
                    onClick={selectChanged}
                    variant="ghost"
                    size="sm"
                    className="min-h-9 px-3"
                    title="Select entities whose description changed since their art was last generated"
                  >
                    Changed only ({changedTargets.length})
                  </ActionButton>
                )}
              </div>
            )}
          </div>
        </div>

        {showSetup && (
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
                  : checkedTargets.length > 0 ? ((doneCount + errorCount) / checkedTargets.length) * 100 : 0}%` }}
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
                {showSetup && (
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
                {target.descriptionChanged && target.status === "pending" ? (
                  <span className="text-2xs text-warm" title="Description changed since last render">
                    description changed
                  </span>
                ) : (
                  target.hasExisting && target.status === "pending" && (
                    <span className="text-2xs text-status-success">has art</span>
                  )
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
            <>
              <ActionButton onClick={closePanel} variant="ghost" size="sm">
                Run in background
              </ActionButton>
              <ActionButton onClick={abort} variant="danger" size="sm">
                Abort
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton onClick={dismiss} variant="ghost" size="sm">
                {doneCount > 0 ? "Done" : "Cancel"}
              </ActionButton>
              {doneCount === 0 && (
                <ActionButton
                  onClick={start}
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
