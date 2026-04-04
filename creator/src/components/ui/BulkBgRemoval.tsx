import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useAssetStore } from "@/stores/assetStore";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
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
}: {
  targets: BulkBgTarget[];
  onClose: () => void;
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

    for (const { item, idx } of toProcess) {
      if (abortRef.current) break;

      setItems((prev) =>
        prev.map((t, i) => (i === idx ? { ...t, status: "processing" } : t)),
      );

      try {
        // Get data URL from the resolved path
        const dataUrl = await invoke<string>("read_image_data_url", {
          path: item.resolvedPath,
        });

        const entry = await removeBgAndSave(
          dataUrl,
          item.assetType,
          item.context,
          item.variantGroup,
        );

        setItems((prev) =>
          prev.map((t, i) =>
            i === idx
              ? { ...t, status: entry ? "done" : "error", error: entry ? undefined : "Removal returned null" }
              : t,
          ),
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((t, i) => (i === idx ? { ...t, status: "error", error: String(err) } : t)),
        );
      }
    }

    await loadAssets();
    setPhase("done");
  }, [items, loadAssets]);

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
              className="h-full rounded-full bg-accent transition-all"
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
                  : "hover:bg-white/3 cursor-pointer"
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
                <span className="text-2xs text-red-400 truncate max-w-[120px]" title={item.error}>
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
    status === "done" ? "bg-emerald-400" :
    status === "error" ? "bg-red-400" :
    status === "processing" ? "bg-amber-400 animate-pulse" :
    status === "skipped" ? "bg-white/20" :
    "bg-white/10";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}
