import { useState } from "react";
import type { Article } from "@/types/lore";
import type { TemplateFieldDef } from "@/lib/loreTemplates";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { Section, FieldRow, TextInput, NumberInput, SelectInput } from "@/components/ui/FormWidgets";
import { LoreTextArea } from "./LoreTextArea";
import { useLoreStore, selectArticles } from "@/stores/loreStore";

// ─── Tag list (inline) ─────────────────────────────────────────────

function InlineTagList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
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
          className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder ?? "Add..."}
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

// ─── Article reference selector ────────────────────────────────────

function ArticleRefSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const articles = useLoreStore(selectArticles);
  const options = Object.values(articles)
    .map((a) => ({ value: a.id, label: a.title }))
    .filter((o) => o.value !== value);

  return (
    <select
      className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— none —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Article refs multi-select ─────────────────────────────────────

function ArticleRefsSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const articles = useLoreStore(selectArticles);
  const available = Object.values(articles)
    .filter((a) => !selected.includes(a.id))
    .map((a) => ({ value: a.id, label: a.title }));

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-0.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-2xs text-accent"
            >
              {articles[id]?.title ?? id}
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
          className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...selected, e.target.value]);
          }}
        >
          <option value="">Link article...</option>
          {available.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ─── Field renderer ────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: TemplateFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <TextInput
          value={typeof value === "string" ? value : ""}
          onCommit={(v) => onChange(v || undefined)}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return (
        <NumberInput
          value={typeof value === "number" ? value : undefined}
          onCommit={(v) => onChange(v)}
          placeholder={field.placeholder}
        />
      );
    case "textarea":
      return (
        <LoreTextArea
          label={field.label}
          value={typeof value === "string" ? value : ""}
          onCommit={(v) => onChange(v || undefined)}
          placeholder={field.placeholder}
          rows={4}
        />
      );
    case "select":
      return (
        <SelectInput
          value={typeof value === "string" ? value : ""}
          options={field.options ?? []}
          onCommit={(v) => onChange(v || undefined)}
          placeholder={`— select —`}
        />
      );
    case "tags":
      return (
        <InlineTagList
          items={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(v.length > 0 ? v : undefined)}
          placeholder={field.placeholder}
        />
      );
    case "article_ref":
      return (
        <ArticleRefSelect
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v || undefined)}
        />
      );
    case "article_refs":
      return (
        <ArticleRefsSelect
          selected={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(v.length > 0 ? v : undefined)}
        />
      );
    default:
      return null;
  }
}

// ─── Main component ────────────────────────────────────────────────

export function TemplateFields({
  article,
  onFieldChange,
}: {
  article: Article;
  onFieldChange: (key: string, value: unknown) => void;
}) {
  const schema = TEMPLATE_SCHEMAS[article.template];
  if (!schema || schema.fields.length === 0) return null;

  return (
    <Section title="Details" defaultExpanded>
      <div className="flex flex-col gap-1.5">
        {schema.fields.map((field) => (
          <FieldRow key={field.key} label={field.label}>
            <FieldRenderer
              field={field}
              value={article.fields[field.key]}
              onChange={(v) => onFieldChange(field.key, v)}
            />
          </FieldRow>
        ))}
      </div>
    </Section>
  );
}
