import { useMemo, useState } from "react";
import type { GenderDefinition } from "@/types/config";
import { TextInput, cx } from "@/components/ui/FormWidgets";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlusIcon, SearchIcon, TrashIcon } from "@/components/config/icons";

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

interface GenderTabProps {
  genders: Record<string, GenderDefinition>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (id: string) => void;
  onPatch: (id: string, p: Partial<GenderDefinition>) => void;
  onDelete: (id: string) => void;
  onRename: (oldId: string, newId: string) => void;
}

export function GenderTab({
  genders,
  selected,
  onSelect,
  onAdd,
  onPatch,
  onDelete,
  onRename,
}: GenderTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <GenderList
          genders={genders}
          selected={selected}
          onSelect={onSelect}
          onAdd={onAdd}
          onDelete={onDelete}
        />
      </div>
      <div className="lg:col-span-7">
        {selected && genders[selected] ? (
          <GenderDesigner
            id={selected}
            gender={genders[selected]!}
            onPatch={(p) => onPatch(selected, p)}
            onDelete={() => onDelete(selected)}
            onRename={(v) => onRename(selected, v)}
          />
        ) : (
          <SectionCard
            title="Gender Designer"
            description="Refine this form."
          >
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-12 text-center">
              <p className="font-display text-xs text-text-muted">No form chosen.</p>
              <p className="mt-1 text-2xs leading-snug text-text-muted/70">
                Pick one from the list.
              </p>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

interface GenderListProps {
  genders: Record<string, GenderDefinition>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (id: string) => void;
  onDelete: (id: string) => void;
}

function GenderList({ genders, selected, onSelect, onAdd, onDelete }: GenderListProps) {
  const [newId, setNewId] = useState("");
  const [query, setQuery] = useState("");

  const ids = Object.keys(genders);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ids;
    return ids.filter((id) => {
      const g = genders[id]!;
      return (
        id.toLowerCase().includes(q) ||
        g.displayName.toLowerCase().includes(q)
      );
    });
  }, [ids, query, genders]);

  const handleAdd = () => {
    const id = normalizeId(newId);
    if (!id || genders[id]) return;
    onAdd(id);
    setNewId("");
  };

  return (
    <SectionCard
      title="Gender Definitions"
      description="Forms a soul may take."
      actions={
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-text-muted">
          {ids.length} {ids.length === 1 ? "Entry" : "Entries"}
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            className="ornate-input min-w-0 flex-1 px-2.5 py-1.5 text-xs text-text-primary"
            placeholder="New gender id"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            aria-label="New gender id"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newId.trim()}
            className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon />
            Inscribe Form
          </button>
        </div>

        <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
          <SearchIcon className="text-text-muted/70" />
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
            placeholder="Search genders…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ul className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-8 text-center text-2xs italic text-text-muted/70">
              {ids.length === 0
                ? "No genders defined. Add one above."
                : `No genders match "${query}".`}
            </li>
          ) : (
            filtered.map((id) => (
              <GenderRow
                key={id}
                id={id}
                gender={genders[id]!}
                selected={selected === id}
                onSelect={() => onSelect(selected === id ? null : id)}
                onDelete={() => onDelete(id)}
              />
            ))
          )}
        </ul>
      </div>
    </SectionCard>
  );
}

interface GenderRowProps {
  id: string;
  gender: GenderDefinition;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function GenderRow({ id, gender, selected, onSelect, onDelete }: GenderRowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li>
      <div
        className={cx(
          "group relative flex items-center gap-3 rounded-2xl border p-3 transition",
          selected
            ? "selected-card border-l-[3px] border-l-accent"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-semibold text-text-primary">
              {gender.displayName || id}
            </p>
            <p className="truncate font-mono text-2xs text-text-muted/70">{id}</p>
            <p className="mt-1 text-[0.55rem] font-semibold uppercase tracking-wider text-text-muted/70">
              {gender.spriteCode ? gender.spriteCode : "Uses ID"}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          aria-label={`Erase ${gender.displayName || id}`}
          className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted/60 transition hover:bg-status-error/10 hover:text-status-error"
        >
          <TrashIcon />
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title="Erase this form?"
          message={`"${gender.displayName || id}" will be removed from the list of available genders. Existing characters who chose it may need to be reassigned. This cannot be undone.`}
          confirmLabel="Erase"
          destructive
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </li>
  );
}

interface GenderDesignerProps {
  id: string;
  gender: GenderDefinition;
  onPatch: (p: Partial<GenderDefinition>) => void;
  onDelete: () => void;
  onRename: (newId: string) => void;
}

function GenderDesigner({
  id,
  gender,
  onPatch,
  onDelete,
  onRename,
}: GenderDesignerProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
    <SectionCard
      title="Gender Designer"
      description="Refine this form."
      actions={
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-2.5 py-1.5 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
        >
          <TrashIcon />
          Erase
        </button>
      }
    >
      <div className="border-b border-[var(--chrome-stroke)] pb-3">
        <h4 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-text-primary">
          {gender.displayName || id}
        </h4>
        <div
          aria-hidden="true"
          className="mt-1 h-px w-24 bg-gradient-to-r from-accent/60 via-accent/20 to-transparent"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[8rem_1fr] lg:items-start">
        <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted lg:pt-2">
          Display Name
        </p>
        <div>
          <div className="ornate-input flex min-h-10 items-center gap-2 px-2.5 py-1.5">
            <div className="min-w-0 flex-1 [&_input]:!min-h-7 [&_input]:!border-none [&_input]:!bg-transparent [&_input]:!p-0">
              <TextInput
                value={gender.displayName}
                onCommit={(v) => onPatch({ displayName: v })}
                placeholder="Male"
                dense
              />
            </div>
          </div>
          <p className="mt-1 text-2xs text-text-muted/70">Name displayed to players.</p>
        </div>

        <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted lg:pt-2">
          Sprite Code
        </p>
        <div>
          <div className="ornate-input flex min-h-10 items-center gap-2 px-2.5 py-1.5">
            <div className="min-w-0 flex-1 [&_input]:!min-h-7 [&_input]:!border-none [&_input]:!bg-transparent [&_input]:!p-0 [&_input]:!font-mono">
              <TextInput
                value={gender.spriteCode ?? ""}
                onCommit={(v) => onPatch({ spriteCode: v || undefined })}
                placeholder="defaults to id"
                dense
              />
            </div>
          </div>
          <p className="mt-1 text-2xs text-text-muted/70">
            Code used in sprite filenames (e.g. <code className="font-mono">'m'</code> or{" "}
            <code className="font-mono">'f'</code>).
            <br />
            Defaults to the gender's ID if left blank.
          </p>
        </div>

        <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted lg:pt-2">
          Internal ID
        </p>
        <div>
          <SlugRenamer id={id} onRename={onRename} />
          <p className="mt-1 text-2xs text-text-muted/70">
            Used for references. Renaming updates references throughout the
            project.
          </p>
        </div>
      </div>
    </SectionCard>
    {confirming && (
      <ConfirmDialog
        title="Erase this form?"
        message={`"${gender.displayName || id}" will be removed from the list of available genders. Existing characters who chose it may need to be reassigned. This cannot be undone.`}
        confirmLabel="Erase"
        destructive
        onConfirm={() => {
          setConfirming(false);
          onDelete();
        }}
        onCancel={() => setConfirming(false)}
      />
    )}
    </>
  );
}

function SlugRenamer({ id, onRename }: { id: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(id);
  const [focused, setFocused] = useState(false);
  if (!focused && draft !== id) setDraft(id);

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    else setDraft(id);
  };

  return (
    <input
      className="ornate-input min-h-10 w-full px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(id);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
