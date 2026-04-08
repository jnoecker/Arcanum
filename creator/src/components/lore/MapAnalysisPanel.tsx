import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { analyzeMap, type MapFeatureSuggestion } from "@/lib/loreMapAnalysis";
import type { LoreMap } from "@/types/lore";

export function MapAnalysisPanel({
  map,
  imageDataUrl,
}: {
  map: LoreMap;
  imageDataUrl: string;
}) {
  const lore = useLoreStore((s) => s.lore);
  const addPin = useLoreStore((s) => s.addPin);
  const [suggestions, setSuggestions] = useState<MapFeatureSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!lore || !imageDataUrl) return;
    setLoading(true);
    setError(null);
    try {
      const results = await analyzeMap(map, imageDataUrl, lore);
      setSuggestions(results);
      setDismissed(new Set());
      setAccepted(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [map, imageDataUrl, lore]);

  const handleAccept = useCallback(
    (idx: number) => {
      const s = suggestions[idx];
      if (!s) return;
      addPin(map.id, {
        id: `pin_${Date.now()}_${idx}`,
        position: [s.y, s.x],
        label: s.label,
        articleId: s.matchedArticleId,
      });
      setAccepted((prev) => new Set(prev).add(idx));
    },
    [suggestions, map.id, addPin],
  );

  const handleAcceptAll = useCallback(() => {
    suggestions.forEach((s, i) => {
      if (dismissed.has(i) || accepted.has(i)) return;
      addPin(map.id, {
        id: `pin_${Date.now()}_${i}`,
        position: [s.y, s.x],
        label: s.label,
        articleId: s.matchedArticleId,
      });
    });
    setAccepted(
      new Set(
        suggestions
          .map((_, i) => i)
          .filter((i) => !dismissed.has(i)),
      ),
    );
  }, [suggestions, dismissed, accepted, map.id, addPin]);

  const visible = suggestions.filter(
    (_, i) => !dismissed.has(i) && !accepted.has(i),
  );

  return (
    <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={handleAnalyze}
          disabled={loading || !imageDataUrl}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {loading ? "Analyzing..." : "Analyze Map"}
        </button>
        {visible.length > 0 && (
          <>
            <span className="text-2xs text-text-muted">
              {visible.length} feature{visible.length !== 1 ? "s" : ""} found
            </span>
            <button
              onClick={handleAcceptAll}
              className="rounded-full border border-accent/20 px-3 py-1 text-3xs text-accent hover:bg-accent/10"
            >
              Pin All
            </button>
          </>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-status-danger">{error}</p>}

      {suggestions.length > 0 && visible.length === 0 && !loading && (
        <p className="text-2xs text-text-muted">
          All features processed. {accepted.size} pin
          {accepted.size !== 1 ? "s" : ""} added.
        </p>
      )}

      {visible.length > 0 && (
        <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
          {suggestions.map((s, i) => {
            if (dismissed.has(i) || accepted.has(i)) return null;
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-text-primary">{s.label}</span>
                  {s.matchedArticleTitle && (
                    <span className="ml-2 text-3xs text-accent">
                      &rarr; {s.matchedArticleTitle}
                    </span>
                  )}
                  {s.suggestNewArticle && (
                    <span className="ml-2 text-3xs italic text-text-muted">
                      new
                    </span>
                  )}
                </div>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                    s.confidence === "high"
                      ? "bg-accent/15 text-accent"
                      : s.confidence === "medium"
                        ? "bg-[var(--chrome-highlight-strong)] text-text-secondary"
                        : "bg-[var(--chrome-highlight)] text-text-muted"
                  }`}
                >
                  {s.confidence}
                </span>
                <button
                  onClick={() => handleAccept(i)}
                  className="rounded-full border border-accent/30 px-2 py-0.5 text-3xs text-accent hover:bg-accent/10"
                >
                  Pin
                </button>
                <button
                  onClick={() =>
                    setDismissed((prev) => new Set(prev).add(i))
                  }
                  className="rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-text-muted hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Skip
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
