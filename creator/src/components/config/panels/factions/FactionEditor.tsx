import { useState, useEffect, useRef } from "react";
import type { FactionDefinition } from "@/types/config";
import { TextInput, CommitTextarea } from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
import { XIcon, TrashIcon, PencilIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface FactionEditorProps {
  id: string;
  definition: FactionDefinition;
  factionIds: string[];
  factionLabelMap: Map<string, string>;
  onPatch: (p: Partial<FactionDefinition>) => void;
  onClose: () => void;
  onDelete: () => void;
  onRename: (newId: string) => void;
}

export function FactionEditor({
  id,
  definition,
  factionIds,
  factionLabelMap,
  onPatch,
  onClose,
  onDelete,
  onRename,
}: FactionEditorProps) {
  const enemies = definition.enemies ?? [];
  const others = factionIds.filter((fid) => fid !== id);

  const toggleEnemy = (enemyId: string) => {
    const next = enemies.includes(enemyId)
      ? enemies.filter((e) => e !== enemyId)
      : [...enemies, enemyId];
    onPatch({ enemies: next.length > 0 ? next : undefined });
  };

  return (
    <SectionCard
      title="Editing Faction"
      actions={
        <button
          type="button"
          onClick={onClose}
          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2.5 py-1 text-2xs text-text-muted transition hover:border-accent/30 hover:text-text-primary"
        >
          <XIcon className="h-3 w-3" />
          Close
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 border-b border-[var(--chrome-stroke)] pb-3">
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-base font-semibold text-text-primary">
              {definition.name || id}
            </h4>
            <RenamableId id={id} onRename={onRename} />
          </div>
        </div>

        <Field label="Display name" hint="Shown in reputation readouts, quest text, and faction commands.">
          <TextInput
            value={definition.name}
            onCommit={(v) => onPatch({ name: v })}
            placeholder="The Royal Court"
            dense
          />
        </Field>

        <Field
          label="Flavor description"
          hint="Short summary shown in faction info and help text."
        >
          <CommitTextarea
            label=""
            value={definition.description ?? ""}
            onCommit={(v) => onPatch({ description: v || undefined })}
            placeholder="A secretive order of spellwrights who..."
            rows={2}
          />
        </Field>

        <div>
          <p className="font-display text-2xs uppercase tracking-wider text-text-muted">
            Rivals
          </p>
          <p className="mb-2 mt-0.5 text-2xs leading-snug text-text-muted/70">
            Killing a member of this faction grants reputation with the
            selected rivals, and vice versa.
          </p>
          {others.length === 0 ? (
            <p className="text-2xs italic text-text-muted/60">
              Add another faction to set up rivalries.
            </p>
          ) : (
            <RivalChips
              all={others}
              selected={enemies}
              factionLabelMap={factionLabelMap}
              onToggle={toggleEnemy}
            />
          )}
        </div>

        <div className="mt-1 flex justify-end border-t border-[var(--chrome-stroke)] pt-3">
          <button
            type="button"
            onClick={onDelete}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-1.5 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
          >
            <TrashIcon />
            Delete faction
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
    </div>
  );
}

function RenamableId({ id, onRename }: { id: string; onRename: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(id);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(id);
  }, [id]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(id);
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1 font-mono text-xs text-text-muted/80 underline-offset-2 hover:text-text-primary hover:underline"
        title="Rename — Esc to cancel"
      >
        <span>ID: {id}</span>
        <PencilIcon className="h-3 w-3 opacity-50 transition group-hover:opacity-100" />
      </button>
    );
  }

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    setEditing(false);
  };

  return (
    <input
      ref={inputRef}
      autoFocus
      className="ornate-input min-h-7 px-2 py-0.5 font-mono text-xs"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(id);
          setEditing(false);
        }
      }}
    />
  );
}

interface RivalChipsProps {
  all: string[];
  selected: string[];
  factionLabelMap: Map<string, string>;
  onToggle: (id: string) => void;
}

function RivalChips({ all, selected, factionLabelMap, onToggle }: RivalChipsProps) {
  return (
    <div className="rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((eid) => {
          const label = factionLabelMap.get(eid);
          const missing = !label;
          return (
            <span
              key={eid}
              title={missing ? `Unknown faction: ${eid}. Define it or remove the rivalry.` : undefined}
              className={cx(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-display text-2xs",
                missing
                  ? "border-status-warning/40 bg-status-warning/10 text-status-warning"
                  : "border-status-error/40 bg-status-error/10 text-status-error",
              )}
            >
              {missing && <span aria-hidden="true">{"⚠ "}</span>}
              {label ?? eid}
              <button
                type="button"
                onClick={() => onToggle(eid)}
                aria-label={`Remove ${label ?? eid}`}
                className={cx(
                  "focus-ring -mr-0.5 rounded p-0.5 transition",
                  missing
                    ? "text-status-warning/70 hover:bg-status-warning/20 hover:text-status-warning"
                    : "text-status-error/70 hover:bg-status-error/20 hover:text-status-error",
                )}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      {all.filter((id) => !selected.includes(id)).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--chrome-stroke)] pt-2">
          {all
            .filter((id) => !selected.includes(id))
            .map((eid) => (
              <button
                key={eid}
                type="button"
                onClick={() => onToggle(eid)}
                className={cx(
                  "focus-ring inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--chrome-stroke-strong)] bg-transparent px-2 py-1 font-display text-2xs text-text-muted transition",
                  "hover:border-accent/40 hover:text-accent",
                )}
              >
                + {factionLabelMap.get(eid) ?? eid}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
