import { useState, useCallback } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import {
  scanForMissingSuggestions,
  type MentionSuggestion,
} from "@/lib/loreMentionScan";
import { SuggestionPanel } from "@/components/lore/SuggestionPanel";

interface MentionItem {
  key: string;
  suggestion: MentionSuggestion;
}

export function MentionSuggestionsPanel() {
  const articles = useLoreStore(selectArticles);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [items, setItems] = useState<MentionItem[]>([]);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleScan = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const results = scanForMissingSuggestions(articles);
      setItems(
        results.map((s) => ({
          key: `${s.sourceId}:${s.targetId}`,
          suggestion: s,
        })),
      );
      setScanned(true);
      setLoading(false);
    }, 0);
  }, [articles]);

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
            {items.length} suggestion{items.length !== 1 ? "s" : ""}
            {(() => {
              const exactCount = items.filter(
                (i) => i.suggestion.quality === "exact",
              ).length;
              return exactCount > 0 ? ` (${exactCount} exact)` : "";
            })()}
          </span>
        )}
      </div>

      <SuggestionPanel<MentionItem>
        items={items}
        loading={loading}
        trackAccepted={false}
        emptyMessage="No missing mentions found. All plain-text references are already linked."
        renderCard={(item, { onDismiss }) => {
          const s = item.suggestion;
          return (
            <>
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
                      : "bg-[var(--chrome-highlight-strong)] text-text-muted"
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
                  onClick={onDismiss}
                  className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
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
