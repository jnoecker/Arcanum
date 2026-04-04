import { useState, useMemo, useCallback } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import {
  scanForMissingSuggestions,
  type MentionSuggestion,
} from "@/lib/loreMentionScan";

export function MentionSuggestionsPanel() {
  const articles = useLoreStore(selectArticles);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleScan = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const results = scanForMissingSuggestions(articles);
      setSuggestions(results);
      setDismissed(new Set());
      setScanned(true);
      setLoading(false);
    }, 0);
  }, [articles]);

  const handleDismiss = useCallback(
    (sourceId: string, targetId: string) => {
      setDismissed((s) => new Set(s).add(`${sourceId}:${targetId}`));
    },
    [],
  );

  const visible = useMemo(
    () =>
      suggestions.filter(
        (s) => !dismissed.has(`${s.sourceId}:${s.targetId}`),
      ),
    [suggestions, dismissed],
  );

  const exactCount = visible.filter((s) => s.quality === "exact").length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleScan}
          disabled={loading}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {loading ? "Scanning..." : scanned ? "Rescan" : "Find Missing Mentions"}
        </button>
        {scanned && (
          <span className="text-2xs text-text-muted">
            {visible.length} suggestion{visible.length !== 1 ? "s" : ""}
            {exactCount > 0 && ` (${exactCount} exact)`}
          </span>
        )}
      </div>

      {scanned && visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-text-muted">
          No missing mentions found. All plain-text references are already
          linked.
        </p>
      )}

      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {visible.map((s) => (
            <div
              key={`${s.sourceId}:${s.targetId}`}
              className="rounded-xl border border-white/8 bg-black/10 px-4 py-3"
            >
              <div className="mb-1 flex items-center gap-2">
                <button
                  onClick={() => selectArticle(s.sourceId)}
                  className="text-xs font-medium text-text-primary transition-colors hover:text-accent"
                >
                  {articles[s.sourceId]?.title ?? s.sourceId}
                </button>
                <span className="text-2xs text-text-muted">&rarr;</span>
                <button
                  onClick={() => selectArticle(s.targetId)}
                  className="text-xs font-medium text-accent transition-colors hover:text-text-primary"
                >
                  {s.targetTitle}
                </button>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-3xs ${
                    s.quality === "exact"
                      ? "bg-accent/15 text-accent"
                      : "bg-white/8 text-text-muted"
                  }`}
                >
                  {s.quality}
                </span>
              </div>
              <p className="mb-2 text-2xs leading-5 text-text-secondary">
                {s.context}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDismiss(s.sourceId, s.targetId)}
                  className="rounded-full border border-white/8 px-2.5 py-1 text-2xs text-text-muted transition hover:bg-white/8 hover:text-text-primary"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
