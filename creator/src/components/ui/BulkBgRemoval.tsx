import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useAssetStore } from "@/stores/assetStore";
import { removeBgAndSave, bgRemovalConcurrency } from "@/lib/useBackgroundRemoval";
import type { AssetContext, AssetEntry } from "@/types/assets";

// ─── Types ─────────────────────────────────────────────────────────

export interface BulkBgTarget {
  id: string;
  label: string;
  /** Current image filename (hash path or legacy path) */
  imagePath: string;
  /** Resolved absolute path to the image file on disk */
  resolvedPath: string;
  assetType: string;
  variantGroup: string;
  context?: AssetContext;
}

interface TargetState extends BulkBgTarget {
  checked: boolean;
  status: "pending" | "checking" | "skipped" | "processing" | "done" | "error";
  error?: string;
}

type Phase = "checking" | "ready" | "running" | "done";

// ─── Component ─────────────────────────────────────────────────────

export function BulkBgRemoval({
  targets: initialTargets,
  onClose,
  onComplete,
}: {
  targets: BulkBgTarget[];
  onClose: () => void;
  /** Called once after the run with the bg-free result for each successfully
   *  processed target, so the caller can repoint the entity's `image` to the
   *  new variant. Without this the active variant flips server-side but the
   *  entity keeps referencing its original, background-bearing image. */
  onComplete?: (results: { target: BulkBgTarget; fileName: string }[]) => void;
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);
  const listVariants = useAssetStore((s) => s.listVariants);
  const loadAssets = useAssetStore((s) => s.loadAssets);

  const [items, setItems] = useState<TargetState[]>(() =>
    initialTargets.map((t) => ({ ...t, checked: true, status: "checking" as const })),
  );
  const [phase, setPhase] = useState<Phase>("checking");
  const abortRef = useRef(false);

  // Phase 1: Check which targets already have bg-removed variants
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const updates: TargetState[] = [...items];
      for (let i = 0; i < updates.length; i++) {
        if (cancelled) return;
        try {
          const variants = await listVariants(updates[i]!.variantGroup);
          const hasBgRemoved = variants.some((v: AssetEntry) => v.model === "bg-removal");
          if (hasBgRemoved) {
            updates[i] = { ...updates[i]!, checked: false, status: "skipped" };
          } else {
            updates[i] = { ...updates[i]!, status: "pending" };
          }
        } catch {
          updates[i] = { ...updates[i]!, status: "pending" };
        }
      }
      if (!cancelled) {
        setItems(updates);
        setPhase("ready");
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2: Process checked targets
  const handleRun = useCallback(async () => {
    setPhase("running");
    abortRef.current = false;

    const toProcess = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.checked && item.status !== "skipped");

    const processed: { target: BulkBgTarget; fileName: string }[] = [];

    // Worker pool sized to the provider's concurrency (1 for local, more
    // for Runware) so bulk runs overlap HTTP round trips instead of paying
    // full per-image latency serially. Abort stops workers between items;
    // in-flight removals finish and land normally.
    let nextJob = 0;
    const worker = async () => {
      while (!abortRef.current) {
        const job = toProcess[nextJob++];
        if (!job) return;
        const { item, idx } = job;

        setItems((prev) =>
          prev.map((t, i) => (i === idx ? { ...t, status: "processing" } : t)),
        );

        try {
          // Get data URL from the resolved path. This fails for newly
          // generated images when the DB path format has drifted — the
          // thrown error is surfaced into the row below.
          const dataUrl = await invoke<string>("read_image_data_url", {
            path: item.resolvedPath,
          });

          const entry = await removeBgAndSave(
            dataUrl,
            item.assetType,
            item.context,
            item.variantGroup,
          );

          // Record the bg-free result so the caller can repoint the entity's
          // image field. removeBgAndSave flips the active variant server-side,
          // but the entity keeps referencing its original background image until
          // we rewrite it via onComplete below.
          processed.push({ target: item, fileName: entry.file_name });
          setItems((prev) =>
            prev.map((t, i) => (i === idx ? { ...t, status: "done", error: undefined } : t)),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[bulk bg removal] ${item.label} failed:`, err);
          setItems((prev) =>
            prev.map((t, i) => (i === idx ? { ...t, status: "error", error: message } : t)),
          );
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(bgRemovalConcurrency(), toProcess.length) },
        () => worker(),
      ),
    );

    await loadAssets();
    if (processed.length > 0) onComplete?.(processed);
    setPhase("done");
  }, [items, loadAssets, onComplete]);

  const toggleItem = (idx: number) => {
    setItems((prev) =>
      prev.map((t, i) => (i === idx && t.status !== "skipped" ? { ...t, checked: !t.checked } : t)),
    );
  };

  // Computed state
  const checkedCount = items.filter((t) => t.checked && t.status !== "skipped").length;
  const skippedCount = items.filter((t) => t.status === "skipped").length;
  const doneCount = items.filter((t) => t.status === "done").length;
  const errorCount = items.filter((t) => t.status === "error").length;
  const processedCount = doneCount + errorCount;
  const isRunning = phase === "running";

  return (
    <DialogShell
      dialogRef={dialogRef}
      titleId="bulk-bg-removal-title"
      title="Bulk Background Removal"
      subtitle={`${items.length} images${skippedCount > 0 ? ` (${skippedCount} already processed)` : ""}`}
      widthClassName="max-w-lg"
      onClose={isRunning ? undefined : onClose}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-muted">
            {phase === "checking" && "Checking existing variants..."}
            {phase === "ready" && `${checkedCount} selected`}
            {phase === "running" && `${processedCount} / ${checkedCount} processed`}
            {phase === "done" && `${doneCount} done${errorCount > 0 ? `, ${errorCount} errors` : ""}`}
          </div>
          <div className="flex gap-2">
            {isRunning ? (
              <ActionButton variant="ghost" onClick={() => { abortRef.current = true; }}>
                Abort
              </ActionButton>
            ) : (
              <>
                <ActionButton variant="ghost" onClick={onClose}>
                  {phase === "done" ? "Close" : "Cancel"}
                </ActionButton>
                {phase === "ready" && (
                  <ActionButton
                    variant="primary"
                    onClick={handleRun}
                    disabled={checkedCount === 0}
                  >
                    Remove Backgrounds ({checkedCount})
                  </ActionButton>
                )}
              </>
            )}
          </div>
        </div>
      }
    >
      {/* Progress bar */}
      {isRunning && (
        <div className="mb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-primary">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${checkedCount > 0 ? (processedCount / checkedCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading state */}
      {phase === "checking" && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
          <Spinner /> Checking for existing background-removed variants...
        </div>
      )}

      {/* Target list */}
      {phase !== "checking" && (
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {items.map((item, idx) => (
            <label
              key={item.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition ${
                item.status === "skipped"
                  ? "opacity-40 cursor-default"
                  : "hover:bg-text-primary/3 cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(idx)}
                disabled={item.status === "skipped" || isRunning || phase === "done"}
                className="accent-accent"
              />
              <StatusDot status={item.status} />
              <span className="flex-1 truncate text-text-primary">{item.label}</span>
              {item.status === "skipped" && (
                <span className="text-2xs text-text-muted">already done</span>
              )}
              {item.status === "error" && (
                <span className="text-2xs text-status-error truncate max-w-[120px]" title={item.error}>
                  {item.error}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </DialogShell>
  );
}

function StatusDot({ status }: { status: TargetState["status"] }) {
  const cls =
    status === "done" ? "bg-status-success" :
    status === "error" ? "bg-status-error" :
    status === "processing" ? "bg-status-warning animate-warm-breathe" :
    status === "skipped" ? "bg-text-primary/20" :
    "bg-[var(--chrome-highlight-strong)]";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}
