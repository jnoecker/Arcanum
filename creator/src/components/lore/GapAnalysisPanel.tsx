import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { analyzeLoreGaps, type LoreGap } from "@/lib/loreGapAnalysis";

export function GapAnalysisPanel() {
  const lore = useLoreStore((s) => s.lore);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [gaps, setGaps] = useState<LoreGap[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!lore) return;
    setGaps(analyzeLoreGaps(lore));
    setDismissed(new Set());
    setAnalyzed(true);
  }, [lore]);

  const visible = gaps.filter((_, i) => !dismissed.has(i));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg text-text-primary">
          Gap Analysis
        </h2>
        <button
          onClick={handleAnalyze}
          disabled={!lore}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {analyzed ? "Re-analyze" : "Analyze Gaps"}
        </button>
      </div>
      <p className="mb-4 text-2xs text-text-secondary">
        Detect missing template coverage, isolated articles, empty factions, and
        structural gaps in your world-building.
      </p>

      {analyzed && (
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
      )}

      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {visible.map((gap) => {
            const realIdx = gaps.indexOf(gap);
            return (
              <div
                key={realIdx}
                className="rounded-xl border border-white/8 bg-black/10 px-4 py-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-[10px] font-medium text-status-warning">
                    Gap
                  </span>
                  <span className="text-[10px] text-text-muted">
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
                      className="text-[11px] text-accent transition-colors hover:text-text-primary"
                    >
                      {lore?.articles[id]?.title ?? id}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setDismissed((s) => new Set(s).add(realIdx))
                    }
                    className="ml-auto rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-text-muted transition hover:bg-white/8"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
