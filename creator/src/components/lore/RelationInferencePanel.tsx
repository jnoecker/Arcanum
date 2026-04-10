import { useState, useCallback } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useToastStore } from "@/stores/toastStore";
import { inferRelations, type RelationSuggestion } from "@/lib/loreRelationInference";
import { SuggestionPanel } from "@/components/lore/SuggestionPanel";

interface RelationItem {
  key: string;
  suggestion: RelationSuggestion;
}

function suggestionKey(s: RelationSuggestion) {
  return `${s.sourceId}:${s.targetId}:${s.type}`;
}

export function RelationInferencePanel() {
  const articles = useLoreStore(selectArticles);
  const updateArticle = useLoreStore((s) => s.updateArticle);
  const [items, setItems] = useState<RelationItem[]>([]);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const handleScan = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      try {
        const result = inferRelations(articles);
        setItems(result.map((s) => ({ key: suggestionKey(s), suggestion: s })));
        setScanned(true);
        if (result.length === 0) {
          useToastStore.getState().show("No new relations to review");
        } else {
          useToastStore.getState().show(
            `Found ${result.length} relation suggestion${result.length !== 1 ? "s" : ""}`,
          );
        }
      } catch (err) {
        console.error("Relation inference failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        useToastStore.getState().show(
          `Relation suggest failed: ${message}`,
          4000,
        );
      } finally {
        setLoading(false);
      }
    }, 0);
  }, [articles]);

  const acceptOne = useCallback(
    (item: RelationItem) => {
      const s = item.suggestion;
      const article = articles[s.sourceId];
      if (!article) return;
      const existing = article.relations ?? [];
      const newRel = { targetId: s.targetId, type: s.type, label: s.label };
      updateArticle(s.sourceId, { relations: [...existing, newRel] });
    },
    [articles, updateArticle],
  );

  const handleApproveAll = useCallback(
    (visible: RelationItem[]) => {
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
          How relation suggestions work
        </summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>
            Arcanum scans your articles locally (no AI call) and looks for
            relationships that are implied by template fields (affiliation,
            profession, participants, leader, territory, &hellip;) but not
            yet represented as explicit relations. Each suggestion shows
            the evidence that triggered it and a confidence level.
          </p>
          <p>
            <span className="text-text-primary">This is a review queue.</span>{" "}
            Nothing is written to an article until you explicitly click{" "}
            <em>Approve</em> (or one of the bulk actions). Denied
            suggestions stay dismissed for the rest of this session, even
            if you rescan.
          </p>
          <p className="text-text-muted">
            Arcanum will not create new articles or modify anything other
            than the source article&rsquo;s relations list.
          </p>
        </div>
      </details>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={handleScan}
          disabled={loading}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {loading ? "Analyzing..." : scanned ? "Rescan" : "Suggest Relations"}
        </button>
        {scanned && (
          <span className="ml-auto text-2xs text-text-muted">
            {items.length} total
          </span>
        )}
      </div>

      <SuggestionPanel<RelationItem>
        items={items}
        loading={loading}
        onApprove={acceptOne}
        onApproveAll={handleApproveAll}
        extraBatchActions={(visible) => {
          const highCount = visible.filter(
            (i) => i.suggestion.confidence === "high",
          ).length;
          if (highCount > 0 && highCount < visible.length) {
            return (
              <button
                onClick={() => {
                  for (const item of visible) {
                    if (item.suggestion.confidence === "high") acceptOne(item);
                  }
                }}
                className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1.5 text-2xs text-text-secondary transition hover:bg-[var(--chrome-highlight-strong)]"
              >
                Approve high ({highCount})
              </button>
            );
          }
          return null;
        }}
        emptyMessage="No missing relations detected."
        renderCard={(item, { onApprove, onDismiss }) => {
          const s = item.suggestion;
          return (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs text-text-primary">
                  {articles[s.sourceId]?.title ?? s.sourceId}
                </span>
                <span className="rounded bg-[var(--chrome-highlight-strong)] px-1.5 py-0.5 text-3xs text-text-muted">
                  {s.label ?? s.type}
                </span>
                <span className="text-2xs text-text-muted">&rarr;</span>
                <span className="text-xs text-accent">
                  {articles[s.targetId]?.title ?? s.targetId}
                </span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-3xs ${
                    s.confidence === "high"
                      ? "bg-accent/15 text-accent"
                      : "bg-[var(--chrome-highlight-strong)] text-text-muted"
                  }`}
                >
                  {s.confidence}
                </span>
              </div>
              <p className="mb-2 text-2xs text-text-secondary">{s.evidence}</p>
              <div className="flex gap-2">
                <button
                  onClick={onApprove}
                  className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-2xs text-accent transition hover:bg-accent/20"
                >
                  Approve
                </button>
                <button
                  onClick={onDismiss}
                  className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Deny
                </button>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
