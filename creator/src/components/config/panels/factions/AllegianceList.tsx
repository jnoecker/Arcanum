import { useMemo, useState } from "react";
import type { FactionDefinition } from "@/types/config";
import type { FactionUsage } from "@/lib/factionUsage";
import { useImageSrc } from "@/lib/useImageSrc";
import { CompassRoseIcon, CopyIcon, PlusIcon, SearchIcon, TrashIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface AllegianceListProps {
  factionIds: string[];
  definitions: Record<string, FactionDefinition>;
  usage: Map<string, FactionUsage>;
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function AllegianceList({
  factionIds,
  definitions,
  usage,
  selected,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: AllegianceListProps) {
  const [query, setQuery] = useState("");
  const hasSelection = selected !== null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return factionIds;
    return factionIds.filter((id) => {
      const def = definitions[id]!;
      return (
        id.toLowerCase().includes(q) ||
        def.name.toLowerCase().includes(q) ||
        (def.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [factionIds, definitions, query]);

  return (
    <aside className="panel-surface flex h-[34rem] min-h-0 flex-col gap-2 rounded-2xl p-3 shadow-section xl:h-full xl:self-stretch">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Allegiances
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {factionIds.length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search allegiances…"
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
          title="Duplicate the selected faction"
          aria-label="Duplicate the selected faction"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete the selected faction"
          aria-label="Delete the selected faction"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <TrashIcon />
        </button>
      </div>

      <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              {factionIds.length === 0
                ? "Every world needs its quarrels — add one to begin."
                : `No allegiances match "${query}".`}
            </div>
          </li>
        ) : (
          filtered.map((id) => (
            <AllegianceRow
              key={id}
              id={id}
              definition={definitions[id]!}
              usage={usage.get(id)}
              selected={selected === id}
              onSelect={() => onSelect(id)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

interface AllegianceRowProps {
  id: string;
  definition: FactionDefinition;
  usage: FactionUsage | undefined;
  selected: boolean;
  onSelect: () => void;
}

function AllegianceRow({
  id,
  definition,
  usage,
  selected,
  onSelect,
}: AllegianceRowProps) {
  const enemies = definition.enemies ?? [];
  const allies = definition.allies ?? [];
  const mobCount = usage?.mobCount ?? 0;
  const questCount = usage?.questCount ?? 0;
  const isUnused =
    mobCount === 0 && questCount === 0 && enemies.length === 0 && allies.length === 0;
  const emblemSrc = useImageSrc(definition.image);
  const factionColor = definition.color || undefined;

  const metaPieces: string[] = [];
  if (enemies.length > 0)
    metaPieces.push(`${enemies.length} ${enemies.length === 1 ? "rival" : "rivals"}`);
  if (allies.length > 0)
    metaPieces.push(`${allies.length} ${allies.length === 1 ? "ally" : "allies"}`);
  if (mobCount > 0)
    metaPieces.push(`${mobCount} ${mobCount === 1 ? "mob" : "mobs"}`);
  if (questCount > 0)
    metaPieces.push(`${questCount} ${questCount === 1 ? "quest" : "quests"}`);
  if (isUnused) metaPieces.push("unused");

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition",
          selected
            ? "selected-card"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border",
            !factionColor &&
              (selected
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-[var(--chrome-stroke)] bg-[var(--bg-panel)] text-text-muted group-hover:border-accent/30 group-hover:text-accent/80"),
          )}
          style={
            factionColor
              ? {
                  borderColor: factionColor,
                  background: `color-mix(in srgb, ${factionColor} 15%, transparent)`,
                  color: factionColor,
                }
              : undefined
          }
        >
          {emblemSrc ? (
            <img
              src={emblemSrc}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <CompassRoseIcon className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold text-text-primary">
            {definition.name || id}
          </div>
          <div className="truncate text-2xs text-text-muted/80">
            {metaPieces.length > 0 ? metaPieces.join(" · ") : id}
          </div>
        </div>
      </button>
    </li>
  );
}
