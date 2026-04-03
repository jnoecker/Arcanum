import { useState, useMemo, useCallback } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { inferRelations, type RelationSuggestion } from "@/lib/loreRelationInference";

function suggestionKey(s: RelationSuggestion) {
  return `${s.sourceId}:${s.targetId}:${s.type}`;
}

export function RelationInferencePanel() {
  const articles = useLoreStore(selectArticles);
  const updateArticle = useLoreStore((s) => s.updateArticle);
  const [suggestions, setSuggestions] = useState<RelationSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleScan = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setSuggestions(inferRelations(articles));
      setDismissed(new Set());
      setAccepted(new Set());
      setScanned(true);
      setLoading(false);
    }, 0);
  }, [articles]);

  const visible = useMemo(
    () => suggestions.filter((s) => !dismissed.has(suggestionKey(s)) && !accepted.has(suggestionKey(s))),
    [suggestions, dismissed, accepted],
  );

  const highCount = visible.filter((s) => s.confidence === "high").length;

  const handleAccept = useCallback(
    (s: RelationSuggestion) => {
      const article = articles[s.sourceId];
      if (!article) return;
      const existing = article.relations ?? [];
      const newRel = { targetId: s.targetId, type: s.type, label: s.label };
      updateArticle(s.sourceId, { relations: [...existing, newRel] });
      setAccepted((prev) => new Set(prev).add(suggestionKey(s)));
    },
    [articles, updateArticle],
  );

  const handleDismiss = useCallback((s: RelationSuggestion) => {
    setDismissed((prev) => new Set(prev).add(suggestionKey(s)));
  }, []);

  const handleAcceptAllHigh = useCallback(() => {
    for (const s of visible) {
      if (s.confidence === "high") {
        const article = articles[s.sourceId];
        if (!article) continue;
        const existing = article.relations ?? [];
        const newRel = { targetId: s.targetId, type: s.type, label: s.label };
        updateArticle(s.sourceId, { relations: [...existing, newRel] });
        setAccepted((prev) => new Set(prev).add(suggestionKey(s)));
      }
    }
  }, [visible, articles, updateArticle]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleScan}
          disabled={loading}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {loading ? "Analyzing..." : scanned ? "Rescan" : "Suggest Relations"}
        </button>
        {scanned && visible.length > 0 && highCount > 0 && (
          <button
            onClick={handleAcceptAllHigh}
            className="focus-ring rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-text-secondary transition hover:bg-white/8"
          >
            Accept All High ({highCount})
          </button>
        )}
        {scanned && (
          <span className="text-2xs text-text-muted">
            {visible.length} suggestion{visible.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {scanned && visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-center text-sm text-text-muted">
          {accepted.size > 0
            ? `All done! ${accepted.size} relation${accepted.size !== 1 ? "s" : ""} accepted.`
            : "No missing relations detected."}
        </p>
      )}

      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {visible.map((s) => (
            <div
              key={suggestionKey(s)}
              className="rounded-xl border border-white/8 bg-black/10 px-4 py-3"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs text-text-primary">
                  {articles[s.sourceId]?.title ?? s.sourceId}
                </span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-text-muted">
                  {s.label ?? s.type}
                </span>
                <span className="text-2xs text-text-muted">&rarr;</span>
                <span className="text-xs text-accent">
                  {articles[s.targetId]?.title ?? s.targetId}
                </span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${
                    s.confidence === "high"
                      ? "bg-accent/15 text-accent"
                      : "bg-white/8 text-text-muted"
                  }`}
                >
                  {s.confidence}
                </span>
              </div>
              <p className="mb-2 text-2xs text-text-secondary">{s.evidence}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(s)}
                  className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent transition hover:bg-accent/20"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDismiss(s)}
                  className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] text-text-muted transition hover:bg-white/8"
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
