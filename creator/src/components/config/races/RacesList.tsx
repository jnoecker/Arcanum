import { useMemo, useState } from "react";
import type { RaceDefinitionConfig } from "@/types/config";
import { useImageSrc } from "@/lib/useImageSrc";
import { useAssetStore } from "@/stores/assetStore";
import { SearchIcon, PlusIcon, CopyIcon, TrashIcon } from "../achievements/icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface RacesListProps {
  races: Record<string, RaceDefinitionConfig>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function RacesList({
  races,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: RacesListProps) {
  const hasSelection = selectedId !== null;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(races).filter(([id, race]) => {
      if (!q) return true;
      return (
        id.toLowerCase().includes(q) ||
        race.displayName.toLowerCase().includes(q) ||
        (race.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [races, query]);

  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Race Roster
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(races).length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search races…"
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
          title="Duplicate the selected race"
          aria-label="Duplicate the selected race"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete the selected race"
          aria-label="Delete the selected race"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <TrashIcon />
        </button>
      </div>

      <ul className="-mx-1 flex max-h-[64vh] flex-col gap-2 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No races match your search.
            </div>
          </li>
        ) : (
          filtered.map(([id, race]) => (
            <RaceRow
              key={id}
              id={id}
              race={race}
              selected={selectedId === id}
              onSelect={() => onSelect(id)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

interface RaceRowProps {
  id: string;
  race: RaceDefinitionConfig;
  selected: boolean;
  onSelect: () => void;
}

function RaceRow({ id, race, selected, onSelect }: RaceRowProps) {
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const imagePath = race.image && assetsDir ? `${assetsDir}\\images\\${race.image}` : undefined;
  const src = useImageSrc(imagePath);

  const mods = race.statMods ?? {};
  const modEntries = Object.entries(mods).slice(0, 3);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-stretch gap-3 rounded-xl border p-2 text-left transition",
          selected
            ? "selected-card"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <Portrait src={src} name={race.displayName} />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-display text-base font-semibold text-text-primary">
              {race.displayName || id}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-2xs uppercase tracking-[0.14em] text-text-muted/70">
            {id}
          </div>
          {modEntries.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {modEntries.map(([stat, value]) => (
                <ModChip key={stat} stat={stat} value={value} />
              ))}
            </div>
          )}
        </div>
      </button>
    </li>
  );
}

function Portrait({ src, name }: { src: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]">
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-display text-lg text-text-muted/60">
          {initial}
        </div>
      )}
    </div>
  );
}

function ModChip({ stat, value }: { stat: string; value: number }) {
  const sign = value >= 0 ? "+" : "";
  const tone =
    value > 0
      ? "border-status-success/40 text-status-success"
      : value < 0
        ? "border-status-danger/40 text-status-danger"
        : "border-[var(--chrome-stroke)] text-text-muted";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border bg-bg-primary/40 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.12em]",
        tone,
      )}
    >
      <span className="text-text-muted/80">{stat.slice(0, 3)}</span>
      <span className="font-semibold">
        {sign}
        {value}
      </span>
    </span>
  );
}
