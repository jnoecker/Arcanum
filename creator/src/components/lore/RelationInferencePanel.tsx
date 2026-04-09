import { useState, useMemo, useCallback } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useToastStore } from "@/stores/toastStore";
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
  const [infoOpen, setInfoOpen] = useState(false);

  const handleScan = useCallback(() => {
    setLoading(true);
    // Defer to next tick so the button shows "Analyzing…" before the
    // synchronous scan runs (purely cosmetic — inferRelations is sync).
    setTimeout(() => {
      try {
        const result = inferRelations(articles);
        // Filter out anything the user already denied or approved this
        // session so sticky dismissals survive re-scans.
        const filtered = result.filter((s) => {
          const key = suggestionKey(s);
          return !dismissed.has(key) && !accepted.has(key);
        });
        setSuggestions(filtered);
        setScanned(true);
        if (filtered.length === 0) {
          useToastStore.getState().show(
            "No new relations to review",
          );
        } else {
          useToastStore.getState().show(
            `Found ${filtered.length} relation suggestion${filtered.length !== 1 ? "s" : ""}`,
          );
        }
      } catch (err) {
        // Surface inference failures instead of leaving the button stuck
        // on "Analyzing…". The scan previously ate exceptions silently
        // because setLoading(false) lived on the happy path only.
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
  }, [articles, dismissed, accepted]);

  const visible = useMemo(
    () => suggestions.filter((s) => !dismissed.has(suggestionKey(s)) && !accepted.has(suggestionKey(s))),
    [suggestions, dismissed, accepted],
  );

  const highCount = visible.filter((s) => s.confidence === "high").length;

  const acceptOne = useCallback(
    (s: RelationSuggestion) => {
      const article = articles[s.sourceId];
      if (!article) return false;
      const existing = article.relations ?? [];
      const newRel = { targetId: s.targetId, type: s.type, label: s.label };
      updateArticle(s.sourceId, { relations: [...existing, newRel] });
      return true;
    },
    [articles, updateArticle],
  );

  const handleAccept = useCallback(
    (s: RelationSuggestion) => {
      if (acceptOne(s)) {
        setAccepted((prev) => new Set(prev).add(suggestionKey(s)));
      }
    },
    [acceptOne],
  );

  const handleDismiss = useCallback((s: RelationSuggestion) => {
    setDismissed((prev) => new Set(prev).add(suggestionKey(s)));
  }, []);

  const handleApproveAll = useCallback(() => {
    const newlyAccepted = new Set(accepted);
    for (const s of visible) {
      if (acceptOne(s)) {
        newlyAccepted.add(suggestionKey(s));
      }
    }
    setAccepted(newlyAccepted);
  }, [visible, acceptOne, accepted]);

  const handleAcceptAllHigh = useCallback(() => {
    const newlyAccepted = new Set(accepted);
    for (const s of visible) {
      if (s.confidence === "high" && acceptOne(s)) {
        newlyAccepted.add(suggestionKey(s));
      }
    }
    setAccepted(newlyAccepted);
  }, [visible, acceptOne, accepted]);

  const handleDenyAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      visible.forEach((s) => next.add(suggestionKey(s)));
      return next;
    });
  }, [visible]);

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
        {scanned && visible.length > 0 && (
          <>
            <button
              onClick={handleApproveAll}
              className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-2xs text-accent transition hover:bg-accent/20"
            >
              Approve all ({visible.length})
            </button>
            {highCount > 0 && highCount < visible.length && (
              <button
                onClick={handleAcceptAllHigh}
                className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1.5 text-2xs text-text-secondary transition hover:bg-[var(--chrome-highlight-strong)]"
              >
                Approve high ({highCount})
              </button>
            )}
            <button
              onClick={handleDenyAll}
              className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1.5 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
            >
              Deny all
            </button>
          </>
        )}
        {scanned && (
          <span className="ml-auto text-2xs text-text-muted">
            {visible.length} pending
          </span>
        )}
      </div>

      {scanned && visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-6 text-center text-sm text-text-muted">
          {accepted.size > 0 || dismissed.size > 0
            ? `All done! ${accepted.size} approved, ${dismissed.size} denied.`
            : "No missing relations detected."}
        </p>
      )}

      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {visible.map((s) => (
            <div
              key={suggestionKey(s)}
              className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3"
            >
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
                  onClick={() => handleAccept(s)}
                  className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-2xs text-accent transition hover:bg-accent/20"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDismiss(s)}
                  className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
