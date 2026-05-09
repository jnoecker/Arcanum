import { useMemo, useState } from "react";
import type { PetDefinitionConfig } from "@/types/config";
import { useImageSrc } from "@/lib/useImageSrc";
import { SearchIcon, PlusIcon, CopyIcon, TrashIcon } from "../achievements/icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface PetsListProps {
  pets: Record<string, PetDefinitionConfig>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function PetsList({
  pets,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: PetsListProps) {
  const [query, setQuery] = useState("");
  const hasSelection = selectedId !== null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(pets).filter(([id, pet]) => {
      if (!q) return true;
      return (
        id.toLowerCase().includes(q) ||
        (pet.name ?? "").toLowerCase().includes(q) ||
        (pet.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [pets, query]);

  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Bestiary
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(pets).length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search companions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/20"
        >
          <PlusIcon />
          Add
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={!hasSelection}
          title="Duplicate the selected companion"
          aria-label="Duplicate the selected companion"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete the selected companion"
          aria-label="Delete the selected companion"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <TrashIcon />
        </button>
      </div>

      <ul className="-mx-1 flex max-h-[64vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No companions match your search.
            </div>
          </li>
        ) : (
          filtered.map(([id, pet]) => (
            <PetRow
              key={id}
              id={id}
              pet={pet}
              selected={selectedId === id}
              onSelect={() => onSelect(id)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

interface PetRowProps {
  id: string;
  pet: PetDefinitionConfig;
  selected: boolean;
  onSelect: () => void;
}

function PetRow({ id, pet, selected, onSelect }: PetRowProps) {
  const thumb = useImageSrc(pet.image || undefined);
  const dmg = `${pet.minDamage}–${pet.maxDamage}`;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-stretch gap-3 rounded-xl border p-2.5 text-left transition",
          selected
            ? "selected-card"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <div
          className={cx(
            "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
            selected
              ? "border-accent/40"
              : "border-[var(--chrome-stroke)] group-hover:border-[var(--chrome-stroke-strong)]",
          )}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={pet.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-display text-xs font-semibold text-text-muted/50">
              {(pet.name || id).slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold text-text-primary">
            {pet.name || id}
          </div>
          <div className="mt-0.5 truncate font-mono text-2xs text-text-muted/70">
            {id}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <RowPill label="HP" value={pet.hp} tone="rose" />
            <RowPill label="DMG" value={dmg} tone="warm" />
            {pet.armor > 0 && (
              <RowPill label="ARM" value={pet.armor} tone="blue" />
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function RowPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "rose" | "warm" | "blue";
}) {
  const toneClass =
    tone === "rose"
      ? "border-status-error/30 bg-status-error/10 text-status-error"
      : tone === "warm"
        ? "border-accent/30 bg-accent/10 text-accent"
        : "border-stellar-blue/30 bg-stellar-blue/10 text-stellar-blue";
  return (
    <span
      className={cx(
        "inline-flex items-baseline gap-1 rounded-full border px-1.5 py-0.5",
        toneClass,
      )}
    >
      <span className="font-display text-[0.5rem] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </span>
      <span className="font-display text-[0.65rem] font-semibold tabular-nums">
        {value}
      </span>
    </span>
  );
}
