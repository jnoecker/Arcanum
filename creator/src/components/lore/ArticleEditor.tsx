import { useCallback, useMemo, useRef, useState } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import type { Article, ArticleRelation } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { Section } from "@/components/ui/FormWidgets";
import { LoreEditor } from "./LoreEditor";
import { TemplateFields } from "./TemplateFields";
import { getCodexGeneratePrompt } from "@/lib/lorePrompts";
import { buildWorldContext } from "@/lib/loreGeneration";
import { ArticleArtSection } from "./ArticleArtSection";
import { RewriteDialog } from "./RewriteDialog";
import { TagListEditor } from "./TagListEditor";
import type { RewriteResult } from "@/lib/loreRewrite";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ─── Template guide (editable description + AI description) ───────

// ─── Relations editor ──────────────────────────────────────────────

function RelationsEditor({
  relations,
  onChange,
}: {
  relations: ArticleRelation[];
  onChange: (r: ArticleRelation[]) => void;
}) {
  const articles = useLoreStore(selectArticles);
  const linkedIds = new Set(relations.map((r) => r.targetId));
  const available = Object.values(articles).filter((a) => !linkedIds.has(a.id));
  const targetRef = useRef<HTMLSelectElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {relations.length > 0 && (
        <div className="mb-1.5 flex flex-col gap-1">
          {relations.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-2xs text-accent">
                {r.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-text-secondary">
                {articles[r.targetId]?.title ?? r.targetId}
              </span>
              <button
                onClick={() => onChange(relations.filter((_, j) => j !== i))}
                aria-label={`Remove relation to ${articles[r.targetId]?.title ?? r.targetId}`}
                className="rounded px-1 py-0.5 text-text-muted hover:bg-bg-tertiary hover:text-status-danger"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div className="flex gap-1.5">
          <select
            ref={targetRef}
            aria-label="Target article"
            className="ornate-input flex-1 px-2 py-1 text-xs text-text-secondary"
            defaultValue=""
          >
            <option value="">Connect to a legend...</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <input
            ref={typeRef}
            aria-label="Relation type"
            className="ornate-input w-24 px-2 py-1 text-xs text-text-primary"
            placeholder="e.g. allied with, born in"
            defaultValue="related"
          />
          <button
            aria-label="Add relation"
            className="rounded border border-border-default px-3 py-1 text-xs text-text-secondary hover:bg-bg-tertiary"
            onClick={() => {
              const target = targetRef.current?.value;
              const type = typeRef.current?.value.trim() || "related";
              if (target) {
                onChange([...relations, { targetId: target, type }]);
              }
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

export function ArticleEditor({ articleId }: { articleId: string }) {
  const article = useLoreStore((s) => s.lore?.articles[articleId] ?? null);
  const updateArticle = useLoreStore((s) => s.updateArticle);
  const renameArticle = useLoreStore((s) => s.renameArticle);
  const deleteArticle = useLoreStore((s) => s.deleteArticle);
  const duplicateArticle = useLoreStore((s) => s.duplicateArticle);
  const [renaming, setRenaming] = useState(false);
  const [newId, setNewId] = useState("");
  const [showRewrite, setShowRewrite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = useCallback(
    (p: Partial<Article>) => updateArticle(articleId, p),
    [articleId, updateArticle],
  );

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      if (!article) return;
      patch({ fields: { ...article.fields, [key]: value } });
    },
    [article, patch],
  );

  const handleRewriteAccept = useCallback((result: RewriteResult) => {
    if (!article) return;
    const updated = { ...article };
    if (result.content) {
      updated.content = result.content;
    }
    if (Object.keys(result.fields).length > 0) {
      updated.fields = { ...article.fields, ...result.fields };
    }
    updateArticle(article.id, updated);
  }, [article, updateArticle]);

  const worldContext = useMemo(() => buildWorldContext(), [articleId]);

  if (!article) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
        Select an article to start editing.
      </div>
    );
  }

  const schema = TEMPLATE_SCHEMAS[article.template];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent/15 px-2 py-0.5 text-2xs font-medium uppercase tracking-ui text-accent">
              {schema?.label ?? article.template}
            </span>
            {renaming ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const id = newId.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
                  if (id && id !== articleId) renameArticle(articleId, id);
                  setRenaming(false);
                }}
              >
                <input
                  autoFocus
                  aria-label="New article name"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                  className="ornate-input w-40 px-1.5 py-0.5 text-2xs text-text-primary"
                  placeholder="new_article_id"
                />
                <button type="submit" className="text-2xs text-accent hover:text-text-primary">Rename</button>
                <button type="button" onClick={() => setRenaming(false)} className="text-2xs text-text-muted">Cancel</button>
              </form>
            ) : (
              <button
                onClick={() => { setNewId(article.id); setRenaming(true); }}
                className="text-2xs text-text-muted hover:text-accent transition-colors"
                title="Click to rename article ID"
              >
                {article.id}
              </button>
            )}
          </div>
          <input
            aria-label="Article title"
            className="focus-ring mt-2 w-full rounded bg-transparent font-display text-2xl text-text-primary placeholder:text-text-muted/50"
            value={article.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Article title"
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-1.5 text-2xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={article.draft ?? false}
              onChange={() => patch({ draft: !article.draft })}
              className="accent-accent"
            />
            Draft
          </label>
          <button
            onClick={() => setShowRewrite(true)}
            title="Rewrite article with specific instructions"
            className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-secondary hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
          >
            Rewrite
          </button>
          <button
            onClick={() => {
              duplicateArticle(articleId);
            }}
            className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1 text-2xs font-medium text-text-secondary transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
            title="Duplicate this article"
          >
            Duplicate
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-full border border-status-danger/40 bg-status-danger/10 px-3 py-1.5 text-2xs text-status-danger hover:bg-status-danger/15"
          >
            Delete
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete article"
          message={`Delete "${article.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Keep it"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deleteArticle(articleId);
          }}
        />
      )}

      {/* Template fields */}
      <TemplateFields
        article={article}
        onFieldChange={handleFieldChange}
      />

      {/* Rich text content */}
      <Section title="Chronicle" defaultExpanded>
        <LoreEditor
          value={article.content}
          onCommit={(v) => patch({ content: v })}
          placeholder={`Write about ${article.title}...`}
          generateSystemPrompt={getCodexGeneratePrompt()}
          generateUserPrompt={`Write a lore article titled "${article.title}" (type: ${schema?.label ?? article.template}).`}
          context={worldContext}
        />
      </Section>

      {/* Private Notes (never exported) */}
      <Section title="Creator's Notes" defaultExpanded={false} description="For your eyes only — never exported to the showcase.">
        <LoreEditor
          value={article.privateNotes ?? ""}
          onCommit={(v) => patch({ privateNotes: v || undefined })}
          placeholder={`Internal notes about ${article.title}...`}
        />
      </Section>

      {/* Tags */}
      <Section title="Keywords" defaultExpanded={false}>
        <TagListEditor
          items={article.tags ?? []}
          onChange={(tags) => patch({ tags: tags.length > 0 ? tags : undefined })}
          placeholder="Add a keyword..."
        />
      </Section>

      {/* Art */}
      <ArticleArtSection
        article={article}
        onImageChange={(image) => patch({ image })}
        onGalleryChange={(gallery) => patch({ gallery })}
      />

      {/* Relations */}
      <Section title="Connections" defaultExpanded={false}>
        <RelationsEditor
          relations={article.relations ?? []}
          onChange={(relations) => patch({ relations: relations.length > 0 ? relations : undefined })}
        />
      </Section>

      {showRewrite && (
        <RewriteDialog
          article={article}
          onAccept={handleRewriteAccept}
          onClose={() => setShowRewrite(false)}
        />
      )}
    </div>
  );
}
