import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { generateWorldSeed } from "@/lib/loreGeneration";
import { useFocusTrap } from "@/lib/useFocusTrap";

export function WorldSeedWizard({
  onClose,
}: {
  onClose: () => void;
}) {
  const createArticle = useLoreStore((s) => s.createArticle);
  const setCalendarSystems = useLoreStore((s) => s.setCalendarSystems);
  const setTimelineEvents = useLoreStore((s) => s.setTimelineEvents);
  const selectArticle = useLoreStore((s) => s.selectArticle);

  const [concept, setConcept] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    articleCount: number;
    hasCalendar: boolean;
    eventCount: number;
  } | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(generating ? undefined : onClose);

  const handleGenerate = useCallback(async () => {
    if (!concept.trim()) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const seed = await generateWorldSeed(concept.trim());

      // Insert all articles
      for (const article of seed.articles) {
        createArticle(article);
      }

      // Set calendar if generated
      if (seed.calendar) {
        setCalendarSystems([seed.calendar]);
      }

      // Set timeline events if generated
      if (seed.events && seed.events.length > 0) {
        setTimelineEvents(seed.events);
      }

      // Select the world setting article
      const ws = seed.articles.find((a) => a.template === "world_setting");
      if (ws) selectArticle(ws.id);

      setResult({
        articleCount: seed.articles.length,
        hasCalendar: !!seed.calendar,
        eventCount: seed.events?.length ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "World generation failed");
    } finally {
      setGenerating(false);
    }
  }, [concept, createArticle, setCalendarSystems, setTimelineEvents, selectArticle]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--chrome-fill-soft)]0"
      onClick={(e) => {
        if (e.target === e.currentTarget && !generating) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seed-wizard-title"
        className="relative w-full max-w-xl rounded-3xl border border-[var(--chrome-stroke)] bg-bg-secondary p-6 shadow-panel"
      >
        <h3 id="seed-wizard-title" className="font-display text-xl text-text-primary">Seed a World</h3>
        <p className="mt-1 text-xs text-text-muted">
          Describe your world concept in a paragraph and the AI will generate a complete
          starter world — setting, factions, locations, characters, a calendar system,
          and historical events.
        </p>

        {!result ? (
          <>
            <div className="mt-4">
              <label className="mb-1 block text-xs text-text-muted">World concept</label>
              <textarea
                className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                rows={5}
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="e.g. A shattered archipelago where each island floats on a different layer of reality. Magic flows from crystallized dreams, and the factions compete to control the Dreamshard mines that power their sky-ships..."
                disabled={generating}
              />
            </div>

            {error && <p role="alert" className="mt-2 text-xs text-status-error">{error}</p>}

            {generating && (
              <div className="mt-4 flex items-center gap-2 text-xs text-accent">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Generating your world... this may take a moment.
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={generating}
                className="rounded-full px-4 py-2 text-xs text-text-muted hover:text-text-primary disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !concept.trim()}
                className="rounded-full border border-[rgb(var(--accent-rgb)/0.28)] bg-gradient-active-strong px-5 py-2 text-xs font-medium text-text-primary transition enabled:hover:shadow-glow disabled:opacity-40"
              >
                {generating ? "Generating..." : "Generate World"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4" role="status" aria-live="polite">
              <h4 className="font-display text-sm text-accent">World generated!</h4>
              <div className="mt-2 flex flex-col gap-1 text-xs text-text-secondary">
                <span>{result.articleCount} articles created</span>
                {result.hasCalendar && <span>Calendar system with eras</span>}
                {result.eventCount > 0 && <span>{result.eventCount} timeline events</span>}
              </div>
              <p className="mt-2 text-2xs text-text-muted">
                Your world is ready to explore. You can edit any article, add more content,
                or generate additional articles from the Articles panel.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-full border border-[rgb(var(--accent-rgb)/0.28)] bg-gradient-active-strong px-5 py-2 text-xs font-medium text-text-primary transition hover:shadow-glow"
              >
                Start Exploring
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
