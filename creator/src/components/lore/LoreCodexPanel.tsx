import { useMemo, useState } from "react";
import type { WorldLore, CodexEntry } from "@/types/lore";
import { DefinitionWorkbench } from "@/components/config/DefinitionWorkbench";
import { Section, FieldRow, TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { LoreTextArea } from "./LoreTextArea";
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

// ─── Codex entry detail ────────────────────────────────────────────

function CodexDetail({
  entry,
  entryId,
  patch,
  allEntryIds,
  getTitle,
  worldContext,
}: {
  entry: CodexEntry;
  entryId: string;
  patch: (p: Partial<CodexEntry>) => void;
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
        <LoreTextArea
          label="Article content"
          value={entry.content}
          onCommit={(v) => patch({ content: v })}
          placeholder="Write your lore entry here..."
          rows={12}
          generateSystemPrompt={CODEX_GENERATE_PROMPT}
          generateUserPrompt={`Write a lore encyclopedia entry titled "${entry.title}"${entry.category ? ` in the category "${entry.category}"` : ""}.`}
          context={worldContext}
        />
      </Section>

      <Section title="Tags">
        <TagList
          items={entry.tags ?? []}
          onChange={(tags) => patch({ tags })}
        />
      </Section>

      {otherEntries.length > 0 && (
        <Section title="Related">
          <RelatedEntriesSelect
            selected={entry.relatedEntries ?? []}
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

export function LoreCodexPanel({
  lore,
  onChange,
}: {
  lore: WorldLore;
  onChange: (patch: Partial<WorldLore>) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const allEntryIds = useMemo(() => Object.keys(lore.codex), [lore.codex]);

  const getTitle = (id: string) => lore.codex[id]?.title ?? id;

  const filteredItems = useMemo(() => {
    if (!categoryFilter) return lore.codex;
    return Object.fromEntries(
      Object.entries(lore.codex).filter(([, e]) => e.category === categoryFilter),
    );
  }, [lore.codex, categoryFilter]);

  const worldContext = useMemo(() => {
    const s = lore.setting;
    const parts: string[] = [];
    if (s.name) parts.push(`World: ${s.name}`);
    if (s.tagline) parts.push(s.tagline);
    if (s.themes?.length) parts.push(`Themes: ${s.themes.join(", ")}`);
    return parts.join("\n") || "A fantasy MUD world";
  }, [lore.setting]);

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

      <DefinitionWorkbench<CodexEntry>
        title="Lore codex"
        countLabel="Entries"
        description="Encyclopedia-style articles for your world's places, legends, creatures, and more."
        addPlaceholder="New entry id"
        searchPlaceholder="Search entries"
        emptyMessage="No entries match the current filter."
        items={filteredItems}
        defaultItem={(raw) => ({
          title: raw
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          category: categoryFilter || undefined,
          content: "",
        })}
        getDisplayName={(e) => e.title}
        renderSummary={(e) => {
          const preview = e.content.slice(0, 80);
          return preview.length < e.content.length ? `${preview}...` : preview;
        }}
        renderBadges={(e) => (e.category ? [e.category] : [])}
        renderDetail={(entry, patch) => {
          const entryId = Object.entries(lore.codex).find(([, e]) => e === entry)?.[0] ?? "";
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
        onItemsChange={(updated) => {
          // Merge filtered updates back into the full codex
          if (categoryFilter) {
            const full = { ...lore.codex };
            // Remove old filtered entries
            for (const id of Object.keys(full)) {
              if (full[id]?.category === categoryFilter && !(id in updated)) {
                delete full[id];
              }
            }
            // Add/update filtered entries
            for (const [id, entry] of Object.entries(updated)) {
              full[id] = entry;
            }
            onChange({ codex: full });
          } else {
            onChange({ codex: updated });
          }
        }}
      />
    </div>
  );
}
