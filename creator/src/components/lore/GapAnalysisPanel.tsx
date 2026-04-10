import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { analyzeLoreGaps, type LoreGap } from "@/lib/loreGapAnalysis";
import { SuggestionPanel } from "@/components/lore/SuggestionPanel";

interface GapItem {
  key: string;
  gap: LoreGap;
}

export function GapAnalysisPanel() {
  const lore = useLoreStore((s) => s.lore);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [items, setItems] = useState<GapItem[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!lore) return;
    setLoading(true);
    setTimeout(() => {
      const gaps = analyzeLoreGaps(lore);
      setItems(gaps.map((g, i) => ({ key: `gap-${i}`, gap: g })));
      setAnalyzed(true);
      setLoading(false);
    }, 0);
  }, [lore]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg text-text-primary">
          Gap Analysis
        </h2>
        <button
          onClick={handleAnalyze}
          disabled={!lore || loading}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {loading ? "Analyzing..." : analyzed ? "Re-analyze" : "Analyze Gaps"}
        </button>
      </div>
      <p className="mb-4 text-2xs text-text-secondary">
        Detect missing template coverage, isolated articles, empty factions, and
        structural gaps in your world-building.
      </p>

      <SuggestionPanel<GapItem>
        items={items}
        loading={loading}
        trackAccepted={false}
        emptyMessage="No gaps detected -- your lore is well-connected!"
        summarySlot={(visible) =>
          analyzed ? (
            <div className="mb-4 flex gap-3 text-2xs">
              {visible.length > 0 ? (
                <span className="text-status-warning">
                  {visible.length} gap{visible.length !== 1 ? "s" : ""} found
                </span>
              ) : (
                <span className="text-status-success">
                  No gaps detected -- your lore is well-connected!
                </span>
              )}
            </div>
          ) : null
        }
        renderCard={(item, { onDismiss }) => {
          const gap = item.gap;
          return (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-3xs font-medium text-status-warning">
                  Gap
                </span>
                <span className="text-3xs text-text-muted">
                  {gap.category}
                </span>
              </div>
              <p className="mb-1 text-xs text-text-secondary">
                {gap.message}
              </p>
              {gap.suggestion && (
                <p className="mb-2 text-2xs italic text-text-muted">
                  {gap.suggestion}
                </p>
              )}
              <div className="flex items-center gap-2">
                {gap.articleIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => selectArticle(id)}
                    className="text-2xs text-accent transition-colors hover:text-text-primary"
                  >
                    {lore?.articles[id]?.title ?? id}
                  </button>
                ))}
                <button
                  onClick={onDismiss}
                  className="ml-auto rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Dismiss
                </button>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
