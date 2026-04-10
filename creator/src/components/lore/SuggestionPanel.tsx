import { useState, useMemo, useCallback, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Generic suggestion-panel scaffolding                               */
/* ------------------------------------------------------------------ */

interface Suggestion {
  /** Unique key for dismiss/accept tracking. */
  key: string;
}

interface SuggestionPanelProps<T extends Suggestion> {
  /** Items to render (externally provided after scanning). */
  items: T[];
  /** Whether the parent is currently loading / scanning. */
  loading: boolean;
  /** Render the body of a single card. The outer card chrome is handled here. */
  renderCard: (
    item: T,
    actions: { onApprove?: () => void; onDismiss: () => void },
  ) => ReactNode;
  /** Called when the user approves a single item. Omit if approve is not applicable. */
  onApprove?: (item: T) => void;
  /** Called when the user approves all visible items at once. Omit to hide the button. */
  onApproveAll?: (items: T[]) => void;
  /** Extra batch-action buttons rendered between Approve-all and Deny-all. */
  extraBatchActions?: (visible: T[]) => ReactNode;
  /** Message shown when scan completed but nothing was found. */
  emptyMessage?: string;
  /** If true, items that were approved are also hidden from the visible list (default true). */
  trackAccepted?: boolean;
  /** Slot rendered above the card list (summaries, stats, etc.). */
  summarySlot?: (visible: T[], accepted: Set<string>, dismissed: Set<string>) => ReactNode;
}

export function SuggestionPanel<T extends Suggestion>({
  items,
  loading,
  renderCard,
  onApprove,
  onApproveAll,
  extraBatchActions,
  emptyMessage = "No suggestions found.",
  trackAccepted = true,
  summarySlot,
}: SuggestionPanelProps<T>) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (dismissed.has(item.key)) return false;
        if (trackAccepted && accepted.has(item.key)) return false;
        return true;
      }),
    [items, dismissed, accepted, trackAccepted],
  );

  const handleDismissOne = useCallback((item: T) => {
    setDismissed((prev) => new Set(prev).add(item.key));
  }, []);

  const handleApproveOne = useCallback(
    (item: T) => {
      onApprove?.(item);
      if (trackAccepted) {
        setAccepted((prev) => new Set(prev).add(item.key));
      }
    },
    [onApprove, trackAccepted],
  );

  const handleApproveAllVisible = useCallback(() => {
    if (!onApproveAll) return;
    onApproveAll(visible);
    if (trackAccepted) {
      setAccepted((prev) => {
        const next = new Set(prev);
        for (const item of visible) next.add(item.key);
        return next;
      });
    }
  }, [onApproveAll, visible, trackAccepted]);

  const handleDenyAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const item of visible) next.add(item.key);
      return next;
    });
  }, [visible]);

  const hasResults = items.length > 0;
  const showBatch = !loading && visible.length > 0;

  return (
    <>
      {/* Batch actions */}
      {showBatch && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {onApproveAll && (
            <button
              onClick={handleApproveAllVisible}
              className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-2xs text-accent transition hover:bg-accent/20"
            >
              Approve all ({visible.length})
            </button>
          )}
          {extraBatchActions?.(visible)}
          <button
            onClick={handleDenyAll}
            className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1.5 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
          >
            Deny all
          </button>
          <span className="ml-auto text-2xs text-text-muted">
            {visible.length} pending
          </span>
        </div>
      )}

      {/* Summary slot */}
      {summarySlot?.(visible, accepted, dismissed)}

      {/* Empty state */}
      {hasResults && visible.length === 0 && !loading && (
        <p className="rounded-2xl border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-6 text-center text-sm text-text-muted">
          {trackAccepted && (accepted.size > 0 || dismissed.size > 0)
            ? `All suggestions processed. ${accepted.size} approved, ${dismissed.size} denied.`
            : emptyMessage}
        </p>
      )}

      {/* Card list */}
      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {visible.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3"
            >
              {renderCard(item, {
                onApprove: onApprove
                  ? () => handleApproveOne(item)
                  : undefined,
                onDismiss: () => handleDismissOne(item),
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
