import type { FactionDefinition } from "@/types/config";
import { SectionCard } from "./SectionCard";
import { CompassRoseIcon, PlusIcon, SearchIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface AllegianceListProps {
  factionIds: string[];
  definitions: Record<string, FactionDefinition>;
  factionLabelMap: Map<string, string>;
  selected: string | null;
  newId: string;
  onNewIdChange: (v: string) => void;
  onAdd: () => void;
  onSelect: (id: string) => void;
}

export function AllegianceList({
  factionIds,
  definitions,
  factionLabelMap,
  selected,
  newId,
  onNewIdChange,
  onAdd,
  onSelect,
}: AllegianceListProps) {
  return (
    <SectionCard
      title="Allegiances"
      description="Every political group in the world. Mobs and quests reference these IDs."
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="ornate-input flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5">
          <SearchIcon className="text-text-muted/70" />
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
            placeholder="new_faction_id"
            value={newId}
            onChange={(e) => onNewIdChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
            }}
          />
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!newId.trim()}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon />
          Add
        </button>
      </div>

      {factionIds.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-2">
          {factionIds.map((id) => (
            <AllegianceRow
              key={id}
              id={id}
              definition={definitions[id]!}
              factionLabelMap={factionLabelMap}
              selected={selected === id}
              onSelect={() => onSelect(id)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

interface AllegianceRowProps {
  id: string;
  definition: FactionDefinition;
  factionLabelMap: Map<string, string>;
  selected: boolean;
  onSelect: () => void;
}

function AllegianceRow({
  id,
  definition,
  factionLabelMap,
  selected,
  onSelect,
}: AllegianceRowProps) {
  const enemies = definition.enemies ?? [];
  const visible = enemies.slice(0, 3);
  const overflow = enemies.length - visible.length;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
          selected
            ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_28px_-12px_rgb(var(--accent-rgb)/0.7)]"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition",
            selected
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-[var(--chrome-stroke)] bg-[var(--bg-panel)] text-text-muted group-hover:border-accent/30 group-hover:text-accent/80",
          )}
        >
          <CompassRoseIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-text-primary">
            {definition.name || id}
          </p>
          <p className="truncate font-mono text-2xs text-text-muted/70">
            ID: {id}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {enemies.length === 0 ? (
            <span className="text-2xs italic text-text-muted/60">No rivals</span>
          ) : (
            <>
              <span className="font-display text-2xs uppercase tracking-wider text-text-muted/70">
                Rivals ·
              </span>
              {visible.map((eid) => {
                const label = factionLabelMap.get(eid);
                const missing = !label;
                return (
                  <span
                    key={eid}
                    title={missing ? `Unknown faction: ${eid}` : undefined}
                    className={cx(
                      "rounded-md px-1.5 py-0.5 font-display text-2xs",
                      missing
                        ? "bg-status-warning/15 text-status-warning"
                        : "bg-status-error/15 text-status-error",
                    )}
                  >
                    {label ?? `? ${eid}`}
                  </span>
                );
              })}
              {overflow > 0 && (
                <span className="text-2xs text-text-muted/60">+{overflow}</span>
              )}
            </>
          )}
        </div>
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-8 text-center">
      <CompassRoseIcon className="mx-auto mb-2 h-6 w-6 text-text-muted/50" />
      <p className="font-display text-xs text-text-muted">No factions defined.</p>
      <p className="mt-1 text-2xs text-text-muted/70">
        Try <code className="text-text-muted">thieves_guild</code> or{" "}
        <code className="text-text-muted">royal_court</code>.
      </p>
    </div>
  );
}

