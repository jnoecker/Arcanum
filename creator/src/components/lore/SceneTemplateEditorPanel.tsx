// ─── SceneTemplateEditorPanel ───────────────────────────────────────
// Manage user-defined scene templates that appear alongside the built-in
// presets in the story editor's TemplatePicker and SceneContextMenu.

import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { SCENE_TEMPLATE_PRESETS } from "@/lib/sceneTemplates";
import { plainTextToTiptap, tiptapToPlainText } from "@/lib/loreRelations";
import { CUSTOM_TEMPLATE_COLORS } from "@/lib/loreTemplates";
import { Section, ActionButton } from "@/components/ui/FormWidgets";
import type { CustomSceneTemplate } from "@/types/lore";

// Stable empty fallback so the selector below doesn't return a fresh array
// every render and trigger an infinite re-render via useSyncExternalStore.
const EMPTY_TEMPLATES: CustomSceneTemplate[] = [];

function generateId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    || `scene_template_${Date.now()}`;
}

function emptyTemplate(): CustomSceneTemplate {
  return {
    id: `scene_tpl_${Date.now()}`,
    label: "",
    badgeColor: CUSTOM_TEMPLATE_COLORS[0]!,
    defaultTitle: "",
    defaultNarration: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    }),
  };
}

// ─── Built-in templates display (read-only) ────────────────────────

function BuiltInTemplates() {
  return (
    <Section title="Built-in templates" defaultExpanded={false}>
      <div className="flex flex-col gap-2 p-3">
        <p className="text-2xs italic text-text-muted">
          The three built-in scene templates are baked into the editor and cannot be modified.
          Add your own custom templates below to extend the picker.
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.values(SCENE_TEMPLATE_PRESETS).map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-muted bg-bg-tertiary px-2.5 py-1 text-2xs"
              style={{ color: p.badgeColor }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: p.badgeColor }}
              />
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Single template editor row ────────────────────────────────────

function TemplateEditor({
  template,
  onChange,
  onDelete,
}: {
  template: CustomSceneTemplate;
  onChange: (patch: Partial<CustomSceneTemplate>) => void;
  onDelete: () => void;
}) {
  // Render narration as plain text for editing simplicity; convert back on commit.
  const plain = tiptapToPlainText(template.defaultNarration);
  return (
    <div className="rounded-lg border border-border-default bg-bg-primary p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={template.label}
          onChange={(e) => onChange({ label: e.target.value })}
          onBlur={(e) => {
            // Auto-derive a stable id from label if id is still the placeholder
            if (template.id.startsWith("scene_tpl_") && e.target.value.trim()) {
              onChange({ id: generateId(e.target.value) });
            }
          }}
          placeholder="Template name (e.g. Boss Reveal)"
          className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete template"
          className="rounded border border-border-default px-2 py-1 text-2xs text-text-muted hover:border-status-error/50 hover:text-status-error"
        >
          Delete
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted">
            Default scene title
          </label>
          <input
            value={template.defaultTitle}
            onChange={(e) => onChange({ defaultTitle: e.target.value })}
            placeholder="A Sudden Confrontation"
            className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted">
            Badge color
          </label>
          <div className="flex flex-wrap gap-1">
            {CUSTOM_TEMPLATE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ badgeColor: c })}
                aria-label={`Use color ${c}`}
                aria-pressed={template.badgeColor === c}
                className="h-6 w-6 rounded-full border-2 transition hover:ring-2 hover:ring-accent/50"
                style={{
                  backgroundColor: c,
                  borderColor: template.badgeColor === c ? "white" : "transparent",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <label className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted">
          Default narration
        </label>
        <textarea
          value={plain}
          onChange={(e) => {
            const json = plainTextToTiptap(e.target.value);
            onChange({ defaultNarration: json });
          }}
          rows={4}
          placeholder="The narrator falls silent. The world holds its breath..."
          className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 resize-y"
        />
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function SceneTemplateEditorPanel() {
  const customTemplates = useLoreStore((s) => s.lore?.customSceneTemplates) ?? EMPTY_TEMPLATES;
  const addCustomSceneTemplate = useLoreStore((s) => s.addCustomSceneTemplate);
  const updateCustomSceneTemplate = useLoreStore((s) => s.updateCustomSceneTemplate);
  const deleteCustomSceneTemplate = useLoreStore((s) => s.deleteCustomSceneTemplate);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    addCustomSceneTemplate(emptyTemplate());
  }, [addCustomSceneTemplate]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl tracking-[0.5px] text-text-primary">
          Scene Templates
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Define reusable scene presets that appear in the story editor's template picker.
          Each template provides a default title and narration that scenes can be initialised from.
        </p>
      </header>

      <BuiltInTemplates />

      <Section title="Custom templates" defaultExpanded>
        <div className="flex flex-col gap-3 p-3">
          {customTemplates.length === 0 ? (
            <p className="rounded border border-dashed border-border-muted px-4 py-6 text-center text-2xs italic text-text-muted">
              No custom scene templates yet. Add one to extend the picker.
            </p>
          ) : (
            customTemplates.map((tpl) =>
              pendingDelete === tpl.id ? (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-status-error/40 bg-status-error/5 p-3 text-xs text-text-secondary"
                >
                  <span>
                    Delete "<span className="font-medium">{tpl.label || tpl.id}</span>"? Scenes already
                    using this template will keep their content but lose the template tag.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        deleteCustomSceneTemplate(tpl.id);
                        setPendingDelete(null);
                      }}
                      className="rounded border border-status-error/60 bg-status-error/10 px-2 py-1 text-2xs text-status-error hover:bg-status-error/20"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="rounded border border-border-default px-2 py-1 text-2xs text-text-muted hover:bg-bg-tertiary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <TemplateEditor
                  key={tpl.id}
                  template={tpl}
                  onChange={(patch) => updateCustomSceneTemplate(tpl.id, patch)}
                  onDelete={() => setPendingDelete(tpl.id)}
                />
              ),
            )
          )}

          <div>
            <ActionButton variant="primary" onClick={handleAdd}>
              + Add scene template
            </ActionButton>
          </div>
        </div>
      </Section>
    </div>
  );
}
