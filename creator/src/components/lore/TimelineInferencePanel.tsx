import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import {
  inferTimelineEvents,
  type TimelineSuggestion,
  type InferenceProgress,
} from "@/lib/loreTimelineInference";

export function TimelineInferencePanel() {
  const lore = useLoreStore((s) => s.lore);
  const addTimelineEvent = useLoreStore((s) => s.addTimelineEvent);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [suggestions, setSuggestions] = useState<TimelineSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<InferenceProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInfer = useCallback(async () => {
    if (!lore) return;
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const results = await inferTimelineEvents(lore, undefined, setProgress);
      setSuggestions(results);
      setDismissed(new Set());
      setAccepted(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [lore]);

  const handleAccept = useCallback(
    (idx: number) => {
      const s = suggestions[idx];
      if (!s) return;
      addTimelineEvent({
        id: `inferred_${Date.now()}_${idx}`,
        title: s.title,
        year: s.year,
        eraId: s.eraId,
        calendarId: lore?.calendarSystems?.[0]?.id ?? "",
        importance: s.importance,
        articleId: s.articleId,
        description: s.evidence,
      });
      setAccepted((prev) => new Set(prev).add(idx));
    },
    [suggestions, lore, addTimelineEvent],
  );

  const visible = suggestions.filter(
    (_, i) => !dismissed.has(i) && !accepted.has(i),
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={handleInfer}
          disabled={!lore || loading || !lore.calendarSystems?.length}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {loading ? "Analyzing..." : "Infer Timeline"}
        </button>
        {loading && progress && (
          <span className="text-2xs text-text-muted">
            Batch {progress.batch} of {progress.totalBatches}
          </span>
        )}
        {!lore?.calendarSystems?.length && (
          <span className="text-2xs text-text-muted">
            Add a calendar system first
          </span>
        )}
        {!loading && visible.length > 0 && (
          <span className="text-2xs text-text-muted">
            {visible.length} suggestion{visible.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-status-danger">{error}</p>}

      {suggestions.length > 0 && visible.length === 0 && !loading && (
        <p className="rounded-2xl border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-6 text-sm text-text-muted">
          All suggestions processed. {accepted.size} accepted.
        </p>
      )}

      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {suggestions.map((s, i) => {
            if (dismissed.has(i) || accepted.has(i)) return null;
            return (
              <div
                key={i}
                className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-text-primary">
                    {s.title}
                  </span>
                  <span className="rounded bg-[var(--chrome-highlight-strong)] px-1.5 py-0.5 text-3xs text-text-muted">
                    Year {s.year}
                  </span>
                  <span className="rounded bg-[var(--chrome-highlight-strong)] px-1.5 py-0.5 text-3xs text-text-muted">
                    {s.eraName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-3xs ${
                      s.importance === "legendary"
                        ? "bg-accent/20 text-accent"
                        : s.importance === "major"
                          ? "bg-[var(--chrome-highlight-strong)] text-text-primary"
                          : "bg-[var(--chrome-highlight)] text-text-muted"
                    }`}
                  >
                    {s.importance}
                  </span>
                </div>
                <p className="mb-1 text-2xs italic text-text-secondary">
                  &ldquo;{s.evidence}&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectArticle(s.articleId)}
                    className="text-2xs text-accent transition-colors hover:text-text-primary"
                  >
                    {s.articleTitle}
                  </button>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => handleAccept(i)}
                      className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-2xs text-accent hover:bg-accent/20"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        setDismissed((prev) => new Set(prev).add(i))
                      }
                      className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-muted hover:bg-[var(--chrome-highlight-strong)]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
