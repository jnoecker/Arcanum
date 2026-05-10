import type { FactionDefinition } from "@/types/config";
import type { FactionUsage } from "@/lib/factionUsage";
import { ActionButton } from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
import { CompassRoseIcon, PlusIcon, SearchIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface AllegianceListProps {
  factionIds: string[];
  definitions: Record<string, FactionDefinition>;
  factionLabelMap: Map<string, string>;
  usage: Map<string, FactionUsage>;
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
  usage,
  selected,
  newId,
  onNewIdChange,
  onAdd,
  onSelect,
}: AllegianceListProps) {
  return (
    <SectionCard
      title="Allegiances"
      description="Every faction in the world. Mobs and quests bind to these IDs."
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
        <ActionButton
          variant="primary"
          size="sm"
          onClick={onAdd}
          disabled={!newId.trim()}
          className="shrink-0"
        >
          <PlusIcon />
          Add Allegiance
        </ActionButton>
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
              usage={usage.get(id)}
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
  usage: FactionUsage | undefined;
  selected: boolean;
  onSelect: () => void;
}

function AllegianceRow({
  id,
  definition,
  factionLabelMap,
  usage,
  selected,
  onSelect,
}: AllegianceRowProps) {
  const enemies = definition.enemies ?? [];
  const visible = enemies.slice(0, 3);
  const overflow = enemies.length - visible.length;
  const mobCount = usage?.mobCount ?? 0;
  const questCount = usage?.questCount ?? 0;
  const zoneCount = usage?.zones.size ?? 0;
  const isUnused = mobCount === 0 && questCount === 0;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition",
          selected
            ? "selected-card"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <div className="flex w-full items-center gap-3">
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
        </div>
        <UsageMeta
          mobCount={mobCount}
          questCount={questCount}
          zoneCount={zoneCount}
          isUnused={isUnused}
        />
      </button>
    </li>
  );
}

interface UsageMetaProps {
  mobCount: number;
  questCount: number;
  zoneCount: number;
  isUnused: boolean;
}

function UsageMeta({ mobCount, questCount, zoneCount, isUnused }: UsageMetaProps) {
  if (isUnused) {
    return (
      <p
        className="pl-12 font-display text-[0.65rem] uppercase tracking-wider text-text-muted/60"
        title="No mobs or quests reference this faction yet."
      >
        Unused &mdash; no mobs or quests reference this faction.
      </p>
    );
  }
  const mobLabel = `${mobCount} ${mobCount === 1 ? "mob" : "mobs"}`;
  const questLabel = `${questCount} ${questCount === 1 ? "quest" : "quests"}`;
  const zoneLabel = `${zoneCount} ${zoneCount === 1 ? "zone" : "zones"}`;
  return (
    <p
      className="pl-12 font-mono text-[0.65rem] text-text-muted/70"
      title={`Referenced by ${mobLabel}, ${questLabel}, across ${zoneLabel}.`}
    >
      <span aria-hidden="true" className="text-accent/70">{"✦ "}</span>
      {mobLabel} {"·"} {questLabel} {"·"} {zoneLabel}
    </p>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-8 text-center">
      <CompassRoseIcon className="mx-auto mb-2 h-6 w-6 text-text-muted/50" />
      <p className="font-display text-xs text-text-muted">
        Every world needs its quarrels.
      </p>
      <p className="mt-1 text-2xs leading-snug text-text-muted/70">
        Name a guild, a court, a thieves' den — and tell us who hates whom. Try{" "}
        <code className="text-text-muted">thieves_guild</code> or{" "}
        <code className="text-text-muted">royal_court</code>.
      </p>
    </div>
  );
}

