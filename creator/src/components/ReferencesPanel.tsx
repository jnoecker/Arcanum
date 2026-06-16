import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useReferenceStore } from "@/stores/referenceStore";
import { ActionButton, FieldRow, SelectInput, TextInput } from "@/components/ui/FormWidgets";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { REFERENCE_CATEGORIES, type ReferenceCategory } from "@/types/reference";
import { slugifyToken } from "@/lib/referenceTokens";

const CATEGORY_GLYPH: Record<ReferenceCategory, string> = Object.fromEntries(
  REFERENCE_CATEGORIES.map((c) => [c.id, c.glyph]),
) as Record<ReferenceCategory, string>;

/** Multi-line field that commits on blur (no per-keystroke disk writes). */
function AppearanceField({
  value,
  onCommit,
  placeholder,
  rows = 5,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  if (!focused && draft !== value) setDraft(value);
  return (
    <textarea
      className="ornate-input w-full px-3 py-2 text-xs leading-relaxed text-text-primary"
      value={draft}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}

export function ReferencesPanel() {
  const project = useProjectStore((s) => s.project);
  const subjects = useReferenceStore((s) => s.subjects);
  const addSubject = useReferenceStore((s) => s.addSubject);
  const updateSubject = useReferenceStore((s) => s.updateSubject);
  const removeSubject = useReferenceStore((s) => s.removeSubject);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects],
  );
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) => s.name.toLowerCase().includes(q) || s.token.toLowerCase().includes(q),
    );
  }, [sorted, filter]);

  const selected = subjects.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && sorted.length > 0) setSelectedId(sorted[0]!.id);
    if (selectedId && !subjects.some((s) => s.id === selectedId)) {
      setSelectedId(sorted[0]?.id ?? null);
    }
  }, [sorted, selectedId, subjects]);

  // Warn when two subjects share a token — the resolver can only pick one.
  const tokenCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subjects) m.set(s.token, (m.get(s.token) ?? 0) + 1);
    return m;
  }, [subjects]);

  if (!project) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-text-muted">
        Open a project to manage references.
      </div>
    );
  }

  const handleAdd = async () => {
    const subject = await addSubject({ name: "New reference" });
    setSelectedId(subject.id);
  };

  return (
    <>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-6">
        <div>
          <h2 className="font-display text-xl uppercase tracking-wide-ui text-aurum">Reference Canon</h2>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            Canonical visual descriptions for recurring characters, ancestries, places, and factions.
            Mention one in any entity description with <code className="text-accent">@{"{token}"}</code> (or
            <code className="text-accent"> @[Display Name]</code>) and Arcanum injects its appearance into
            image prompts — the same subject renders consistently everywhere, while the saved game text stays clean.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 gap-5">
          {/* ── Rail ── */}
          <div className="flex w-64 shrink-0 flex-col gap-3">
            <ActionButton onClick={handleAdd} variant="primary">
              ＋ New reference
            </ActionButton>
            <TextInput value={filter} onCommit={setFilter} placeholder="Filter…" dense />
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border-muted bg-[var(--chrome-fill-soft)] p-1.5">
              {visible.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-text-muted">
                  {subjects.length === 0 ? "No references yet." : "No matches."}
                </p>
              ) : (
                visible.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                      s.id === selectedId
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:bg-[var(--chrome-fill)]"
                    }`}
                  >
                    <span aria-hidden>{CATEGORY_GLYPH[s.category] ?? "✧"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display tracking-wide-ui">{s.name}</span>
                      <span className="block truncate font-mono text-2xs text-text-muted">@{s.token}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Editor ── */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border-muted bg-[var(--chrome-fill-soft)] p-5">
            {selected ? (
              <div className="flex flex-col gap-4">
                <FieldRow label="Name" hint="Display name. Also usable as @[Name] in descriptions.">
                  <TextInput
                    value={selected.name}
                    onCommit={(v) => void updateSubject(selected.id, { name: v })}
                    placeholder="Aineroia"
                  />
                </FieldRow>

                <FieldRow
                  label="Token"
                  hint={
                    tokenCounts.get(selected.token) && tokenCounts.get(selected.token)! > 1
                      ? "⚠ Another reference uses this token — only one will resolve."
                      : "The @token form. Lowercase, no spaces."
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-text-muted">@</span>
                    <TextInput
                      value={selected.token}
                      onCommit={(v) => void updateSubject(selected.id, { token: slugifyToken(v) })}
                      placeholder="aineroia"
                    />
                  </div>
                </FieldRow>

                <FieldRow label="Category">
                  <SelectInput
                    value={selected.category}
                    onCommit={(v) => void updateSubject(selected.id, { category: v as ReferenceCategory })}
                    options={REFERENCE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
                  />
                </FieldRow>

                <FieldRow
                  label="Canonical appearance"
                  hint="Tight visual description injected into image prompts. Focus on what the model needs to render the subject consistently."
                >
                  <AppearanceField
                    value={selected.appearance}
                    onCommit={(v) => void updateSubject(selected.id, { appearance: v })}
                    placeholder="A tall elven woman with silver-white hair braided with copper wire, luminous amber eyes, wearing layered teal robes…"
                  />
                </FieldRow>

                <FieldRow label="Notes" hint="Author-only. Never sent to the image model.">
                  <AppearanceField
                    rows={2}
                    value={selected.notes ?? ""}
                    onCommit={(v) => void updateSubject(selected.id, { notes: v || undefined })}
                    placeholder="Internal notes, sources, reminders…"
                  />
                </FieldRow>

                <div className="flex justify-end border-t border-border-muted pt-3">
                  <ActionButton variant="danger" onClick={() => setPendingDelete(selected.id)}>
                    Delete reference
                  </ActionButton>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                Select or create a reference to edit it.
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete reference?"
          message="Existing @token mentions of this subject will stop resolving and generate from their plain text instead."
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            void removeSubject(pendingDelete);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
