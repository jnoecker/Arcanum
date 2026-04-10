import { useState } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { DialogShell, ActionButton } from "@/components/ui/FormWidgets";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { Article, CustomTemplateDefinition } from "@/types/lore";

function BulkTemplateChangeDialog({
  ids,
  articles,
  customTemplates,
  onConfirm,
  onCancel,
}: {
  ids: string[];
  articles: Record<string, Article>;
  customTemplates?: CustomTemplateDefinition[];
  onConfirm: (template: string) => void;
  onCancel: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(onCancel);
  const [selected, setSelected] = useState("");

  // Build combined list of built-in + custom templates
  const builtInOptions = Object.values(TEMPLATE_SCHEMAS).map((s) => ({
    value: s.template,
    label: s.label,
  }));
  const customOptions = (customTemplates ?? []).map((ct) => ({
    value: ct.id,
    label: ct.displayName,
  }));
  const allOptions = [...builtInOptions, ...customOptions];

  // Count current templates in selection
  const templateCounts = new Map<string, number>();
  for (const id of ids) {
    const a = articles[id];
    if (a) {
      templateCounts.set(a.template, (templateCounts.get(a.template) ?? 0) + 1);
    }
  }

  const selectedLabel = allOptions.find((o) => o.value === selected)?.label ?? selected;

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="bulk-template-title"
      title="Change Template"
      subtitle={`${ids.length} articles selected`}
      onClose={onCancel}
      widthClassName="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onCancel}>Cancel</ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            onClick={() => onConfirm(selected)}
            disabled={!selected}
          >
            Change to {selectedLabel}
          </ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-2 text-2xs text-text-muted">Currently:</p>
          <div className="flex flex-wrap gap-1">
            {[...templateCounts.entries()].map(([t, count]) => (
              <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-2xs text-accent">
                {allOptions.find((o) => o.value === t)?.label ?? t} ({count})
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
            New template
          </label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded border border-border-default bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          >
            <option value="">Choose a template...</option>
            {allOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <p className="text-2xs text-text-muted">
          Existing fields are preserved. Fields that don't match the new template will be kept as data but won't appear in the editor.
        </p>
      </div>
    </DialogShell>
  );
}

export function BulkActionsBar() {
  const selectedIds = useLoreStore((s) => s.selectedArticleIds);
  const clearSelection = useLoreStore((s) => s.clearArticleSelection);
  const bulkDelete = useLoreStore((s) => s.bulkDelete);
  const bulkSetDraft = useLoreStore((s) => s.bulkSetDraft);
  const bulkAddTags = useLoreStore((s) => s.bulkAddTags);
  const bulkChangeTemplate = useLoreStore((s) => s.bulkChangeTemplate);
  const customTemplates = useLoreStore((s) => s.lore?.customTemplates);
  const articles = useLoreStore(selectArticles);
  const [showDelete, setShowDelete] = useState(false);
  const [showTag, setShowTag] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const ids = [...selectedIds];
  if (ids.length < 2) return null;

  return (
    <div role="toolbar" className="relative mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
      <span className="text-2xs font-medium text-accent">
        {ids.length} selected
      </span>

      <button
        onClick={() => bulkSetDraft(ids, true)}
        aria-label="Mark selected as draft"
        className="rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-text-secondary hover:bg-[var(--chrome-highlight-strong)]"
      >
        Draft
      </button>
      <button
        onClick={() => bulkSetDraft(ids, false)}
        aria-label="Publish selected"
        className="rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-text-secondary hover:bg-[var(--chrome-highlight-strong)]"
      >
        Publish
      </button>
      <button
        onClick={() => setShowTag(true)}
        aria-label="Tag selected articles"
        className="rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-text-secondary hover:bg-[var(--chrome-highlight-strong)]"
      >
        Tag
      </button>
      <button
        onClick={() => setShowTemplate(true)}
        aria-label="Change template of selected articles"
        className="rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-text-secondary hover:bg-[var(--chrome-highlight-strong)]"
      >
        Template
      </button>
      <button
        onClick={() => setShowDelete(true)}
        aria-label="Delete selected articles"
        className="rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-status-danger hover:bg-status-danger/10"
      >
        Delete
      </button>
      <button
        onClick={clearSelection}
        aria-label="Clear selection"
        className="ml-auto text-3xs text-text-muted hover:text-text-primary"
      >
        Clear
      </button>

      {showTag && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-[var(--chrome-stroke)] bg-bg-primary p-3 shadow-lg">
          <div className="flex gap-1.5">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Tag to add..."
              aria-label="Enter tag to add"
              className="ornate-input min-w-0 flex-1 px-2 py-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  bulkAddTags(ids, [tagInput.trim()]);
                  setTagInput("");
                  setShowTag(false);
                }
                if (e.key === "Escape") setShowTag(false);
              }}
              autoFocus
            />
            <button
              onClick={() => {
                if (tagInput.trim()) {
                  bulkAddTags(ids, [tagInput.trim()]);
                  setTagInput("");
                }
                setShowTag(false);
              }}
              className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-3xs text-accent"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {showDelete && (
        <ConfirmDialog
          title="Delete Articles"
          message={`Delete ${ids.length} articles? This cannot be undone.`}
          confirmLabel={`Delete ${ids.length}`}
          destructive
          onConfirm={() => {
            bulkDelete(ids);
            setShowDelete(false);
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {showTemplate && (
        <BulkTemplateChangeDialog
          ids={ids}
          articles={articles}
          customTemplates={customTemplates}
          onConfirm={(newTemplate) => {
            bulkChangeTemplate(ids, newTemplate);
            clearSelection();
            setShowTemplate(false);
          }}
          onCancel={() => setShowTemplate(false)}
        />
      )}
    </div>
  );
}
