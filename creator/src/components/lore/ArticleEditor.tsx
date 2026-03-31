import { useCallback, useMemo, useRef } from "react";
import { useLoreStore } from "@/stores/loreStore";
import type { Article, ArticleRelation } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { Section } from "@/components/ui/FormWidgets";
import { LoreEditor } from "./LoreEditor";
import { TemplateFields } from "./TemplateFields";
import { CODEX_GENERATE_PROMPT } from "@/lib/lorePrompts";
import { ArticleArtSection } from "./ArticleArtSection";

// ─── Tag list (compact) ────────────────────────────────────────────

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 rounded-full border border-border-muted bg-bg-tertiary px-2 py-0.5 text-2xs text-text-secondary"
        >
          {t}
          <button
            onClick={() => onChange(tags.filter((_, j) => j !== i))}
            className="ml-0.5 text-text-muted hover:text-status-danger"
          >
            &times;
          </button>
        </span>
      ))}
      <input
        className="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 text-xs text-text-primary outline-none"
        placeholder="Add tag..."
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = e.currentTarget.value.trim();
            if (v && !tags.includes(v)) {
              onChange([...tags, v]);
              e.currentTarget.value = "";
            }
          }
        }}
      />
    </div>
  );
}

// ─── Relations editor ──────────────────────────────────────────────

function RelationsEditor({
  relations,
  onChange,
}: {
  relations: ArticleRelation[];
  onChange: (r: ArticleRelation[]) => void;
}) {
  const articles = useLoreStore((s) => s.lore?.articles ?? {});
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
            className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
            defaultValue=""
          >
            <option value="">Link to article...</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <input
            ref={typeRef}
            aria-label="Relation type"
            className="w-24 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
            placeholder="type"
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
  const deleteArticle = useLoreStore((s) => s.deleteArticle);

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

  const worldContext = useMemo(() => {
    const articles = useLoreStore.getState().lore?.articles ?? {};
    const ws = Object.values(articles).find((a) => a.template === "world_setting");
    if (!ws) return "A fantasy world";
    const parts: string[] = [];
    const name = typeof ws.fields.name === "string" ? ws.fields.name : "";
    if (name) parts.push(`World: ${name}`);
    if (ws.content) parts.push(ws.content.slice(0, 200));
    return parts.join("\n") || "A fantasy world";
  }, [articleId]);

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
            <span className="text-2xs text-text-muted">{article.id}</span>
          </div>
          <input
            aria-label="Article title"
            className="mt-2 w-full bg-transparent font-display text-2xl text-text-primary outline-none placeholder:text-text-muted/50"
            value={article.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Article title"
          />
        </div>
        <button
          onClick={() => {
            if (window.confirm(`Delete "${article.title}"? This cannot be undone.`)) {
              deleteArticle(articleId);
            }
          }}
          className="shrink-0 rounded-full border border-status-danger/40 bg-status-danger/10 px-3 py-1.5 text-2xs text-status-danger hover:bg-status-danger/15"
        >
          Delete
        </button>
      </div>

      {/* Template fields */}
      <TemplateFields
        article={article}
        onFieldChange={handleFieldChange}
      />

      {/* Rich text content */}
      <Section title="Content" defaultExpanded>
        <LoreEditor
          value={article.content}
          onCommit={(v) => patch({ content: v })}
          placeholder={`Write about ${article.title}...`}
          generateSystemPrompt={CODEX_GENERATE_PROMPT}
          generateUserPrompt={`Write a lore article titled "${article.title}" (type: ${schema?.label ?? article.template}).`}
          context={worldContext}
        />
      </Section>

      {/* Tags */}
      <Section title="Tags" defaultExpanded={false}>
        <TagEditor
          tags={article.tags ?? []}
          onChange={(tags) => patch({ tags: tags.length > 0 ? tags : undefined })}
        />
      </Section>

      {/* Art */}
      <ArticleArtSection
        article={article}
        onImageChange={(image) => patch({ image })}
      />

      {/* Relations */}
      <Section title="Relations" defaultExpanded={false}>
        <RelationsEditor
          relations={article.relations ?? []}
          onChange={(relations) => patch({ relations: relations.length > 0 ? relations : undefined })}
        />
      </Section>
    </div>
  );
}
