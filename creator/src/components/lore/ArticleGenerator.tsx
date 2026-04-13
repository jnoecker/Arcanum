import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLoreStore } from "@/stores/loreStore";
import type { ArticleTemplate } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { generateArticle } from "@/lib/loreGeneration";
import { SelectInput } from "@/components/ui/FormWidgets";
import { useFocusTrap } from "@/lib/useFocusTrap";

const TEMPLATE_OPTIONS = Object.values(TEMPLATE_SCHEMAS)
  .filter((s) => s.template !== "world_setting")
  .map((s) => ({ value: s.template, label: s.label }));

export function ArticleGenerator({
  onClose,
}: {
  onClose: () => void;
}) {
  const createArticle = useLoreStore((s) => s.createArticle);
  const selectArticle = useLoreStore((s) => s.selectArticle);

  const [template, setTemplate] = useState<ArticleTemplate>("character");
  const [concept, setConcept] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(generating ? undefined : onClose);

  const handleGenerate = useCallback(async () => {
    if (!concept.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const article = await generateArticle({ template, concept: concept.trim() });
      createArticle(article);
      selectArticle(article.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [template, concept, createArticle, selectArticle, onClose]);

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !generating) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gen-article-title"
        className="relative w-full max-w-lg rounded-3xl border border-[var(--chrome-stroke)] bg-bg-secondary p-6 shadow-panel"
      >
        <h3 id="gen-article-title" className="font-display text-xl text-text-primary">Generate Article</h3>
        <p className="mt-1 text-xs text-text-muted">
          Describe your concept and the AI will generate a complete article with structured fields and content.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Template type</label>
            <SelectInput
              value={template}
              options={TEMPLATE_OPTIONS}
              onCommit={(v) => setTemplate(v as ArticleTemplate)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">Concept</label>
            <textarea
              className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              rows={3}
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g. A secretive guild of shadow mages who operate from the sewers beneath Caldera..."
            />
          </div>

          {error && <p role="alert" className="text-xs text-status-error">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={generating}
            className="rounded-full px-4 py-2 text-xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !concept.trim()}
            className="rounded-full border border-[rgb(var(--accent-rgb)/0.28)] bg-gradient-active-strong px-5 py-2 text-xs font-medium text-text-primary transition enabled:hover:shadow-glow disabled:opacity-40"
          >
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
