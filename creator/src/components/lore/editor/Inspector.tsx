import { useMemo, useState } from "react";
import type { Article, ArticleRelation } from "@/types/lore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { TEMPLATE_SCHEMAS, templateTint } from "@/lib/loreTemplates";
import { TemplateFields } from "@/components/lore/TemplateFields";
import { totalWordCount } from "@/lib/loreSections";
import { extractMentionCounts } from "@/lib/loreRelations";

interface InspectorProps {
  article: Article;
  onFieldChange: (key: string, value: unknown) => void;
  onTagsChange: (tags: string[] | undefined) => void;
  onRelationsChange: (relations: ArticleRelation[] | undefined) => void;
  onCollapse: () => void;
  onExpand: () => void;
}

// ─── Tag pill row ──────────────────────────────────────────────────

function KeywordRow({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[] | undefined) => void;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const commit = () => {
    const v = draft.trim();
    setAdding(false);
    setDraft("");
    if (!v || tags.includes(v)) return;
    onChange([...tags, v]);
  };

  return (
    <div className="ae-tagrow">
      {tags.map((t) => (
        <span key={t} className="ae-tag">
          {t}
          <button
            type="button"
            className="ae-tag__x"
            onClick={() => {
              const next = tags.filter((x) => x !== t);
              onChange(next.length > 0 ? next : undefined);
            }}
            aria-label={`Remove keyword ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <span className="ae-tag ae-tag--input">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={commit}
            placeholder="keyword"
          />
        </span>
      ) : (
        <button
          type="button"
          className="ae-tag ae-tag--add"
          onClick={() => setAdding(true)}
        >
          + keyword
        </button>
      )}
    </div>
  );
}

// ─── Connections panel ─────────────────────────────────────────────

interface ConnRow {
  id: string;
  targetId: string;
  type: string;
  template: string;
  title: string;
  /** True when the target article is also @mentioned in this article's content. */
  fromMention: boolean;
}

function ConnectionsPanel({
  article,
  onRelationsChange,
}: {
  article: Article;
  onRelationsChange: (next: ArticleRelation[] | undefined) => void;
}) {
  const articles = useLoreStore(selectArticles);
  const relations = article.relations ?? [];
  const [adding, setAdding] = useState(false);
  const [pickTarget, setPickTarget] = useState("");
  const [pickType, setPickType] = useState("related");

  // Scan each TipTap body separately (extractMentionCounts requires valid JSON).
  const mentionIds = useMemo(() => {
    const bodies: string[] = [];
    if (article.content) bodies.push(article.content);
    for (const s of article.sections ?? []) {
      if (s.type === "richtext" && s.body) bodies.push(s.body);
    }
    const ids = new Set<string>();
    for (const body of bodies) {
      const counts = extractMentionCounts(body);
      for (const id of counts.keys()) ids.add(id);
    }
    return ids;
  }, [article.content, article.sections]);

  const rows: ConnRow[] = useMemo(() => {
    const out: ConnRow[] = relations.map((r, i) => ({
      id: `rel-${i}-${r.targetId}`,
      targetId: r.targetId,
      type: r.type,
      template: articles[r.targetId]?.template ?? "freeform",
      title: articles[r.targetId]?.title ?? r.targetId,
      fromMention: mentionIds.has(r.targetId),
    }));
    // Synthesize "from @mention" rows for any mention not already an explicit relation.
    const explicitTargets = new Set(relations.map((r) => r.targetId));
    for (const id of mentionIds) {
      if (!explicitTargets.has(id) && articles[id]) {
        out.push({
          id: `mention-${id}`,
          targetId: id,
          type: "mentioned",
          template: articles[id]?.template ?? "freeform",
          title: articles[id]?.title ?? id,
          fromMention: true,
        });
      }
    }
    return out;
  }, [relations, mentionIds, articles]);

  // Memoize the available-articles list so we don't filter the entire article
  // index on every parent re-render (e.g. on every title/tagline keystroke).
  const available = useMemo(() => {
    const linkedIds = new Set(relations.map((r) => r.targetId));
    return Object.values(articles).filter(
      (a) => a.id !== article.id && !linkedIds.has(a.id),
    );
  }, [relations, articles, article.id]);

  const removeRelation = (targetId: string) => {
    const next = relations.filter((r) => r.targetId !== targetId);
    onRelationsChange(next.length > 0 ? next : undefined);
  };

  const promoteToRelation = (targetId: string) => {
    if (relations.some((r) => r.targetId === targetId)) return;
    onRelationsChange([...relations, { targetId, type: "mentioned" }]);
  };

  const addRelation = () => {
    if (!pickTarget) return;
    if (relations.some((r) => r.targetId === pickTarget)) return;
    onRelationsChange([
      ...relations,
      { targetId: pickTarget, type: pickType.trim() || "related" },
    ]);
    setPickTarget("");
    setPickType("related");
    setAdding(false);
  };

  const totalCount = rows.length;
  const mentionCount = rows.filter((r) => r.fromMention).length;

  return (
    <div className="ae-iblock">
      <div className="ae-iblock__head">
        <span className="ae-iblock__title">Connections</span>
        <span className="ae-iblock__chip">
          {totalCount} · {mentionCount} mentions
        </span>
      </div>
      {rows.map((row) => {
        const tint = templateTint(row.template, "var(--color-arcane-teal)");
        const initial = (row.title[0] || "?").toUpperCase();
        const isAuto = !relations.some((r) => r.targetId === row.targetId);
        return (
          <div
            key={row.id}
            className="ae-conn"
            style={{ ["--ae-conn-bg" as string]: tint }}
          >
            <span className="ae-conn__icon" aria-hidden>{initial}</span>
            <div className="ae-trunc-min">
              <div className="ae-conn__name">{row.title}</div>
              <div className="ae-conn__rel">
                {row.type} · {row.template.replace(/_/g, " ")}
              </div>
            </div>
            <div className="ae-conn__src" data-auto={row.fromMention || undefined}>
              {row.fromMention ? "From @mention" : "Manual"}
              {isAuto ? (
                <button
                  type="button"
                  className="ae-conn__promote"
                  title="Pin as a manual connection"
                  onClick={() => promoteToRelation(row.targetId)}
                  aria-label={`Pin ${row.title} as a manual connection`}
                >
                  ↗
                </button>
              ) : (
                <button
                  type="button"
                  className="ae-conn__del"
                  title="Remove connection"
                  onClick={() => removeRelation(row.targetId)}
                  aria-label={`Remove connection to ${row.title}`}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        );
      })}
      {adding ? (
        <div className="ae-col ae-conn__addform">
          <select
            className="ae-field__inp"
            value={pickTarget}
            onChange={(e) => setPickTarget(e.target.value)}
            aria-label="Article to link"
          >
            <option value="">Pick an article to connect…</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <input
            className="ae-field__inp"
            value={pickType}
            onChange={(e) => setPickType(e.target.value)}
            placeholder="Relation (e.g. allied with)"
            aria-label="Relation type"
          />
          <div className="ae-row">
            <button
              className="ae-btn"
              data-variant="ember"
              type="button"
              onClick={addRelation}
              disabled={!pickTarget}
            >
              Add
            </button>
            <button
              className="ae-btn"
              type="button"
              onClick={() => {
                setAdding(false);
                setPickTarget("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        available.length > 0 && (
          <button
            type="button"
            className="ae-inspector__add"
            onClick={() => setAdding(true)}
          >
            + Connect another article
          </button>
        )
      )}
    </div>
  );
}

// ─── Inspector ─────────────────────────────────────────────────────

export function Inspector({
  article,
  onFieldChange,
  onTagsChange,
  onRelationsChange,
  onCollapse,
  onExpand,
}: InspectorProps) {
  const schema = TEMPLATE_SCHEMAS[article.template];
  const sections = article.sections ?? [];
  const wordCount = useMemo(() => totalWordCount(sections), [sections]);
  const lastUpdated = useMemo(() => {
    try {
      const d = new Date(article.updatedAt);
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return article.updatedAt;
    }
  }, [article.updatedAt]);

  return (
    <aside className="ae-inspector" aria-label="Article inspector">
      {/* Stub shown when collapsed — clicking expands. */}
      <div className="ae-inspector__stub">
        <button
          type="button"
          className="ae-collapse-btn"
          onClick={onExpand}
          title="Expand inspector"
          aria-label="Expand inspector"
        >
          ‹
        </button>
      </div>

      <div className="ae-inspector__head">
        <span className="ae-inspector__head__label">Inspector</span>
        <button
          type="button"
          className="ae-collapse-btn"
          onClick={onCollapse}
          title="Collapse inspector"
          aria-label="Collapse inspector"
        >
          ›
        </button>
      </div>

      {schema && schema.fields.length > 0 && (
        <div className="ae-iblock">
          <div className="ae-iblock__head">
            <span className="ae-iblock__title">{schema.label} · Template</span>
            <span className="ae-iblock__chip">{article.id}</span>
          </div>
          <TemplateFields article={article} onFieldChange={onFieldChange} />
        </div>
      )}

      <div className="ae-iblock">
        <div className="ae-iblock__head">
          <span className="ae-iblock__title">Keywords</span>
          <span className="ae-iblock__chip">{(article.tags ?? []).length}</span>
        </div>
        <KeywordRow tags={article.tags ?? []} onChange={onTagsChange} />
      </div>

      <ConnectionsPanel article={article} onRelationsChange={onRelationsChange} />

      <div className="ae-iblock">
        <div className="ae-iblock__head">
          <span className="ae-iblock__title">Lifecycle</span>
        </div>
        <div className="ae-field">
          <label className="ae-field__lbl">Last Updated</label>
          <div className="ae-field__inp ae-field__readonly">{lastUpdated}</div>
        </div>
        <div className="ae-field">
          <label className="ae-field__lbl">Word Count</label>
          <div className="ae-field__inp ae-field__readonly ae-field__readonly--mono">
            {wordCount} words across {sections.length} {sections.length === 1 ? "section" : "sections"}
          </div>
        </div>
      </div>
    </aside>
  );
}
