import { useState } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import type { CustomTemplateDefinition, CustomFieldDef } from "@/types/lore";
import { Section, ActionButton } from "@/components/ui/FormWidgets";

const DEFAULT_COLORS = [
  "#a897d2", "#8caec9", "#bea873", "#a3c48e", "#c4956a",
  "#b88faa", "#95a0bf", "#d4c8a0", "#7a8a6e", "#6e5a8a",
];

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const FIELD_TYPES: { value: CustomFieldDef["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "tags", label: "Tags" },
];

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: CustomFieldDef;
  onChange: (f: CustomFieldDef) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border-muted bg-bg-primary p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value, key: generateId(e.target.value) || field.key })}
            placeholder="Field label"
            className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
          <select
            value={field.type}
            onChange={(e) => onChange({ ...field, type: e.target.value as CustomFieldDef["type"] })}
            className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <input
          value={field.placeholder ?? ""}
          onChange={(e) => onChange({ ...field, placeholder: e.target.value || undefined })}
          placeholder="Placeholder text (optional)"
          className="rounded border border-border-default bg-bg-primary px-2 py-1 text-2xs text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        />
        {field.type === "select" && (
          <input
            value={(field.options ?? []).join(", ")}
            onChange={(e) => onChange({ ...field, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="Options (comma-separated)"
            className="rounded border border-border-default bg-bg-primary px-2 py-1 text-2xs text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
        )}
      </div>
      <button
        onClick={onRemove}
        aria-label="Remove field"
        className="shrink-0 rounded p-1 text-text-muted hover:text-status-danger"
      >
        &times;
      </button>
    </div>
  );
}

function TemplateForm({
  initial,
  existingIds,
  onSave,
  onCancel,
}: {
  initial?: CustomTemplateDefinition;
  existingIds: Set<string>;
  onSave: (t: CustomTemplateDefinition) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CustomTemplateDefinition>(
    initial ?? {
      id: "",
      displayName: "",
      pluralName: "",
      color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)] ?? "#a897d2",
      fields: [],
    },
  );

  const isNew = !initial;
  const id = isNew ? generateId(draft.displayName) : draft.id;
  const idConflict = isNew && (existingIds.has(id) || id in TEMPLATE_SCHEMAS);

  const addField = () => {
    setDraft({
      ...draft,
      fields: [...draft.fields, { key: `field_${draft.fields.length + 1}`, label: "", type: "text" }],
    });
  };

  const handleSave = () => {
    if (!draft.displayName.trim() || idConflict) return;
    onSave({ ...draft, id, pluralName: draft.pluralName || draft.displayName + "s" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">Name</label>
          <input
            value={draft.displayName}
            onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
            placeholder="e.g. Magic School"
            className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            autoFocus
          />
          {isNew && id && (
            <p className={`mt-1 text-2xs ${idConflict ? "text-status-error" : "text-text-muted"}`}>
              ID: {id}{idConflict ? " (already exists)" : ""}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">Color</label>
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            className="h-9 w-12 cursor-pointer rounded border border-border-default bg-bg-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">Description</label>
        <input
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined })}
          placeholder="What this template represents"
          className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-2xs uppercase tracking-wider text-text-muted">Fields</label>
          <button
            onClick={addField}
            className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-2xs text-accent hover:bg-accent/20"
          >
            + Add Field
          </button>
        </div>
        {draft.fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-6 text-center text-xs text-text-muted">
            No fields yet. Articles of this template will only have a title and body text.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {draft.fields.map((f, i) => (
              <FieldEditor
                key={i}
                field={f}
                onChange={(updated) => {
                  const fields = [...draft.fields];
                  fields[i] = updated;
                  setDraft({ ...draft, fields });
                }}
                onRemove={() => {
                  setDraft({ ...draft, fields: draft.fields.filter((_, j) => j !== i) });
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <ActionButton variant="ghost" size="sm" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!draft.displayName.trim() || idConflict}
        >
          {isNew ? "Create Template" : "Save Changes"}
        </ActionButton>
      </div>
    </div>
  );
}

export function TemplateEditorPanel() {
  const customTemplates = useLoreStore((s) => s.lore?.customTemplates ?? []);
  const addCustomTemplate = useLoreStore((s) => s.addCustomTemplate);
  const updateCustomTemplate = useLoreStore((s) => s.updateCustomTemplate);
  const deleteCustomTemplate = useLoreStore((s) => s.deleteCustomTemplate);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const builtInIds = new Set(Object.keys(TEMPLATE_SCHEMAS));
  const allIds = new Set([...builtInIds, ...customTemplates.map((t) => t.id)]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg text-text-primary">Templates</h2>
          <p className="mt-1 text-xs text-text-muted">
            {Object.keys(TEMPLATE_SCHEMAS).length} built-in, {customTemplates.length} custom
          </p>
        </div>
        <ActionButton variant="primary" size="sm" onClick={() => { setCreating(true); setEditing(null); }}>
          New Template
        </ActionButton>
      </div>

      {/* Built-in templates (read-only list) */}
      <Section title="Built-in Templates">
        <div className="flex flex-wrap gap-2">
          {Object.values(TEMPLATE_SCHEMAS).map((s) => (
            <span
              key={s.template}
              className="rounded-full border border-border-muted px-3 py-1 text-2xs text-text-secondary"
            >
              {s.label} ({s.fields.length} fields)
            </span>
          ))}
        </div>
      </Section>

      {/* Custom templates */}
      <Section title="Custom Templates">
        {customTemplates.length === 0 && !creating ? (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-6 text-center text-xs text-text-muted">
            No custom templates yet. Create one to add new article types.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {customTemplates.map((t) => (
              <div key={t.id} className="rounded-lg border border-border-muted bg-bg-primary p-4">
                {editing === t.id ? (
                  <TemplateForm
                    initial={t}
                    existingIds={allIds}
                    onSave={(updated) => {
                      updateCustomTemplate(t.id, updated);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-display text-sm text-text-primary">{t.displayName}</span>
                      <span className="ml-2 text-2xs text-text-muted">
                        {t.fields.length} field{t.fields.length !== 1 ? "s" : ""}
                      </span>
                      {t.description && (
                        <p className="mt-0.5 text-2xs text-text-secondary">{t.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setEditing(t.id); setCreating(false); }}
                      className="rounded-full border border-white/8 px-2.5 py-1 text-2xs text-text-secondary hover:bg-white/8"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCustomTemplate(t.id)}
                      className="rounded-full border border-white/8 px-2.5 py-1 text-2xs text-text-muted hover:text-status-danger"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Create form */}
      {creating && (
        <Section title="New Template">
          <TemplateForm
            existingIds={allIds}
            onSave={(t) => {
              addCustomTemplate(t);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </Section>
      )}
    </div>
  );
}
