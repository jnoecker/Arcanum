import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import {
  inferTimelineEvents,
  type TimelineSuggestion,
  type InferenceProgress,
} from "@/lib/loreTimelineInference";
import { SuggestionPanel } from "@/components/lore/SuggestionPanel";

interface TimelineItem {
  key: string;
  suggestion: TimelineSuggestion;
  index: number;
}

function suggestionKey(s: TimelineSuggestion) {
  return `${s.articleId}:${s.year}:${s.title.toLowerCase()}`;
}

export function TimelineInferencePanel() {
  const lore = useLoreStore((s) => s.lore);
  const addTimelineEvent = useLoreStore((s) => s.addTimelineEvent);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<InferenceProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleInfer = useCallback(async () => {
    if (!lore) return;
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const results = await inferTimelineEvents(lore, undefined, setProgress);
      setItems(
        results.map((s, i) => ({ key: suggestionKey(s), suggestion: s, index: i })),
      );
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [lore]);

  const acceptOne = useCallback(
    (item: TimelineItem) => {
      const s = item.suggestion;
      addTimelineEvent({
        id: `inferred_${Date.now()}_${item.index}`,
        title: s.title,
        year: s.year,
        eraId: s.eraId,
        calendarId: lore?.calendarSystems?.[0]?.id ?? "",
        importance: s.importance,
        articleId: s.articleId,
        description: s.evidence,
      });
    },
    [lore, addTimelineEvent],
  );

  const handleApproveAll = useCallback(
    (visible: TimelineItem[]) => {
      for (const item of visible) acceptOne(item);
    },
    [acceptOne],
  );

  return (
    <div>
      <details
        open={infoOpen}
        onToggle={(e) => setInfoOpen((e.target as HTMLDetailsElement).open)}
        className="mb-3 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-2 text-xs text-text-secondary"
      >
        <summary className="cursor-pointer select-none text-text-muted transition-colors hover:text-text-primary">
          How timeline suggestions work
        </summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>
            Arcanum reads your published (non-draft) articles, extracts
            temporal references from their content and fields, and proposes
            events it found. It uses your calendar systems and eras to place
            each event, and it sees your existing timeline to skip
            duplicates.
          </p>
          <p>
            <span className="text-text-primary">This is a review queue.</span>{" "}
            Nothing is written to your timeline until you explicitly click{" "}
            <em>Approve</em> on a suggestion (or <em>Approve all</em>).
            Denied suggestions stay dismissed for the rest of this session,
            even if you re-run the inference.
          </p>
          <p className="text-text-muted">
            Arcanum will not invent events, rewrite existing ones, or touch
            articles.
          </p>
        </div>
      </details>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={handleInfer}
          disabled={!lore || loading || !lore.calendarSystems?.length}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {loading ? "Analyzing..." : scanned ? "Rescan" : "Infer Timeline"}
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
      </div>

      {error && <p className="mb-3 text-xs text-status-danger">{error}</p>}

      <SuggestionPanel<TimelineItem>
        items={items}
        loading={loading}
        onApprove={acceptOne}
        onApproveAll={handleApproveAll}
        renderCard={(item, { onApprove, onDismiss }) => {
          const s = item.suggestion;
          return (
            <>
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
                    onClick={onApprove}
                    className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-2xs text-accent hover:bg-accent/20"
                  >
                    Approve
                  </button>
                  <button
                    onClick={onDismiss}
                    className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-muted hover:bg-[var(--chrome-highlight-strong)]"
                  >
                    Deny
                  </button>
                </div>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
