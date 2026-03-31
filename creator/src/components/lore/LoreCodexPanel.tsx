import { useMemo, useState, useCallback } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import type { Article, ArticleRelation } from "@/types/lore";
import { DefinitionWorkbench } from "@/components/config/DefinitionWorkbench";
import { Section, FieldRow, TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { LoreEditor } from "./LoreEditor";
import { CODEX_GENERATE_PROMPT } from "@/lib/lorePrompts";

const CODEX_CATEGORIES = [
  { value: "places", label: "Places" },
  { value: "legends", label: "Legends" },
  { value: "materials", label: "Materials" },
  { value: "deities", label: "Deities" },
  { value: "creatures", label: "Creatures" },
  { value: "events", label: "Events" },
  { value: "customs", label: "Customs" },
];

// Templates that are managed by the codex (not by dedicated panels)
const CODEX_TEMPLATES = new Set([
  "character", "location", "species", "item", "event", "language", "freeform",
]);

// ─── Tag list ──────────────────────────────────────────────────────

function TagList({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {items.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-full border border-border-muted bg-bg-tertiary px-2 py-0.5 text-2xs text-text-secondary"
            >
              {t}
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-0.5 text-text-muted hover:text-status-danger"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add tag..."
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="rounded border border-border-default px-2 py-0.5 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Related entries selector ──────────────────────────────────────

function RelatedEntriesSelect({
  selected,
  options,
  getTitle,
  onChange,
}: {
  selected: string[];
  options: string[];
  getTitle: (id: string) => string;
  onChange: (ids: string[]) => void;
}) {
  const available = options.filter((id) => !selected.includes(id));

  return (
    <div className="mt-1">
      <label className="text-xs text-text-muted">Related entries</label>
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-0.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-2xs text-accent"
            >
              {getTitle(id)}
              <button
                onClick={() => onChange(selected.filter((s) => s !== id))}
                className="ml-0.5 hover:text-status-danger"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <select
          className="mt-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...selected, e.target.value]);
          }}
        >
          <option value="">Link related entry...</option>
          {available.map((id) => (
            <option key={id} value={id}>{getTitle(id)}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ─── View type for DefinitionWorkbench ─────────────────────────────

interface CodexView {
  title: string;
  category?: string;
  content: string;
  tags: string[];
  relatedEntries: string[];
}

function articleToCodex(a: Article): CodexView {
  const related = (a.relations ?? []).filter((r) => r.type === "related").map((r) => r.targetId);
  return {
    title: a.title,
    category: typeof a.fields.category === "string" ? a.fields.category : undefined,
    content: a.content,
    tags: a.tags ?? [],
    relatedEntries: related,
  };
}

// ─── Codex entry detail ────────────────────────────────────────────

function CodexDetail({
  entry,
  entryId,
  patch,
  allEntryIds,
  getTitle,
  worldContext,
}: {
  entry: CodexView;
  entryId: string;
  patch: (p: Partial<CodexView>) => void;
  allEntryIds: string[];
  getTitle: (id: string) => string;
  worldContext: string;
}) {
  const otherEntries = allEntryIds.filter((id) => id !== entryId);

  return (
    <div className="flex flex-col gap-4">
      <Section title="Metadata">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Title">
            <TextInput
              value={entry.title}
              onCommit={(v) => patch({ title: v })}
            />
          </FieldRow>
          <FieldRow label="Category">
            <SelectInput
              value={entry.category ?? ""}
              options={CODEX_CATEGORIES}
              onCommit={(v) => patch({ category: v || undefined })}
              placeholder="— select category —"
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Content">
        <LoreEditor
          value={entry.content}
          onCommit={(v) => patch({ content: v })}
          placeholder="Write your lore entry here..."
          generateSystemPrompt={CODEX_GENERATE_PROMPT}
          generateUserPrompt={`Write a lore encyclopedia entry titled "${entry.title}"${entry.category ? ` in the category "${entry.category}"` : ""}.`}
          context={worldContext}
        />
      </Section>

      <Section title="Tags">
        <TagList
          items={entry.tags}
          onChange={(tags) => patch({ tags })}
        />
      </Section>

      {otherEntries.length > 0 && (
        <Section title="Related">
          <RelatedEntriesSelect
            selected={entry.relatedEntries}
            options={otherEntries}
            getTitle={getTitle}
            onChange={(relatedEntries) => patch({ relatedEntries })}
          />
        </Section>
      )}
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function LoreCodexPanel() {
  const articles = useLoreStore(selectArticles);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Codex articles: everything that isn't world_setting or organization
  const codexArticles = useMemo(
    () => Object.fromEntries(
      Object.entries(articles).filter(([, a]) => CODEX_TEMPLATES.has(a.template)),
    ),
    [articles],
  );

  const codexViews = useMemo(
    () => Object.fromEntries(
      Object.entries(codexArticles).map(([id, a]) => [id, articleToCodex(a)]),
    ),
    [codexArticles],
  );

  const allEntryIds = useMemo(() => Object.keys(codexViews), [codexViews]);
  const getTitle = (id: string) => codexViews[id]?.title ?? id;

  const filteredViews = useMemo(() => {
    if (!categoryFilter) return codexViews;
    return Object.fromEntries(
      Object.entries(codexViews).filter(([, e]) => e.category === categoryFilter),
    );
  }, [codexViews, categoryFilter]);

  const worldContext = useMemo(() => {
    const ws = Object.values(articles).find((a) => a.template === "world_setting");
    if (!ws) return "A fantasy MUD world";
    const parts: string[] = [];
    const name = typeof ws.fields.name === "string" ? ws.fields.name : "";
    if (name) parts.push(`World: ${name}`);
    const tagline = typeof ws.fields.tagline === "string" ? ws.fields.tagline : "";
    if (tagline) parts.push(tagline);
    const themes = Array.isArray(ws.fields.themes) ? ws.fields.themes : [];
    if (themes.length) parts.push(`Themes: ${themes.join(", ")}`);
    return parts.join("\n") || "A fantasy MUD world";
  }, [articles]);

  const handleItemsChange = useCallback(
    (newViews: Record<string, CodexView>) => {
      // When filtering, we need to merge changes back into the full set
      const baseViews = categoryFilter ? { ...codexViews } : {};

      if (categoryFilter) {
        // Remove old filtered entries
        for (const id of Object.keys(baseViews)) {
          if (baseViews[id]?.category === categoryFilter && !(id in newViews)) {
            delete baseViews[id];
          }
        }
        // Add/update filtered entries
        for (const [id, cv] of Object.entries(newViews)) {
          baseViews[id] = cv;
        }
      } else {
        Object.assign(baseViews, newViews);
      }

      // Convert views back to articles, preserving template info
      // We need to replace articles across ALL codex templates
      const now = new Date().toISOString();
      const newArticles: Record<string, Article> = {};
      for (const [id, cv] of Object.entries(categoryFilter ? baseViews : newViews)) {
        const existing = codexArticles[id];
        const related: ArticleRelation[] = cv.relatedEntries.map((targetId) => ({
          targetId,
          type: "related",
        }));
        // Preserve non-related relations from existing article
        const otherRelations = (existing?.relations ?? []).filter((r) => r.type !== "related");
        const allRelations = [...otherRelations, ...related];

        if (existing) {
          newArticles[id] = {
            ...existing,
            title: cv.title,
            content: cv.content,
            fields: { ...existing.fields, category: cv.category },
            tags: cv.tags.length > 0 ? cv.tags : undefined,
            relations: allRelations.length > 0 ? allRelations : undefined,
            updatedAt: now,
          };
        } else {
          newArticles[id] = {
            id,
            template: "freeform",
            title: cv.title,
            content: cv.content,
            fields: { category: cv.category },
            tags: cv.tags.length > 0 ? cv.tags : undefined,
            relations: allRelations.length > 0 ? allRelations : undefined,
            createdAt: now,
            updatedAt: now,
          };
        }
      }

      // Replace all codex-template articles at once
      // First remove all current codex articles, then add the new ones
      const store = useLoreStore.getState();
      if (!store.lore) return;
      const kept: Record<string, Article> = {};
      for (const [id, a] of Object.entries(store.lore.articles)) {
        if (!CODEX_TEMPLATES.has(a.template)) kept[id] = a;
      }
      store.setLore({ ...store.lore, articles: { ...kept, ...newArticles } });
      // setLore doesn't mark dirty, so we need to do it via a dummy update
      // Actually, let's just use the store's internal mechanism
      useLoreStore.setState({ dirty: true });
    },
    [codexArticles, codexViews, categoryFilter],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Category filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Filter by category:</span>
        <select
          className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {CODEX_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <DefinitionWorkbench<CodexView>
        title="Lore codex"
        countLabel="Entries"
        description="Encyclopedia-style articles for your world's places, legends, creatures, and more."
        addPlaceholder="New entry id"
        searchPlaceholder="Search entries"
        emptyMessage="No entries match the current filter."
        items={filteredViews}
        defaultItem={(raw) => ({
          title: raw
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          category: categoryFilter || undefined,
          content: "",
          tags: [],
          relatedEntries: [],
        })}
        getDisplayName={(e) => e.title}
        renderSummary={(e) => {
          const preview = e.content.slice(0, 80);
          return preview.length < e.content.length ? `${preview}...` : preview;
        }}
        renderBadges={(e) => (e.category ? [e.category] : [])}
        renderDetail={(entry, patch) => {
          const entryId = Object.entries(filteredViews).find(([, e]) => e === entry)?.[0] ?? "";
          return (
            <CodexDetail
              entry={entry}
              entryId={entryId}
              patch={patch}
              allEntryIds={allEntryIds}
              getTitle={getTitle}
              worldContext={worldContext}
            />
          );
        }}
        onItemsChange={handleItemsChange}
      />
    </div>
  );
}
