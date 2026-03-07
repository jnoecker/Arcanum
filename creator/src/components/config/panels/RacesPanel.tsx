import { useState, useCallback, useMemo } from "react";
import type { ConfigPanelProps } from "./types";
import type { RaceDefinitionConfig } from "@/types/config";
import type { StatMap } from "@/types/world";
import {
  Section,
  FieldRow,
  TextInput,
  IconButton,
} from "@/components/ui/FormWidgets";

export function RacesPanel({ config, onChange }: ConfigPanelProps) {
  const races = config.races;
  const raceIds = Object.keys(races);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [search, setSearch] = useState("");

  const statDefs = config.stats.definitions;
  const statIds = Object.keys(statDefs);

  const filteredIds = useMemo(() => {
    const ids = Object.keys(races);
    if (!search.trim()) return ids;
    const q = search.toLowerCase();
    return ids.filter(
      (id) =>
        id.toLowerCase().includes(q) ||
        races[id]!.displayName.toLowerCase().includes(q),
    );
  }, [races, search]);

  const patchRace = (id: string, p: Partial<RaceDefinitionConfig>) =>
    onChange({
      races: { ...races, [id]: { ...races[id]!, ...p } },
    });

  const deleteRace = (id: string) => {
    const next = { ...races };
    delete next[id];
    onChange({ races: next });
    if (expanded === id) setExpanded(null);
  };

  const addRace = useCallback(() => {
    const id = newId.trim().toUpperCase().replace(/\s+/g, "_");
    if (!id || races[id]) return;
    onChange({
      races: {
        ...races,
        [id]: {
          displayName: newId.trim(),
        },
      },
    });
    setNewId("");
    setExpanded(id);
  }, [newId, races, onChange]);

  return (
    <Section
      title={`Races (${raceIds.length})`}
      actions={
        <div className="flex items-center gap-1">
          <input
            className="w-28 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
            placeholder="New race"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addRace();
            }}
          />
          <IconButton onClick={addRace} title="Add race">
            +
          </IconButton>
        </div>
      }
    >
      {raceIds.length > 3 && (
        <input
          className="mb-2 w-full rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
          placeholder="Search races..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {filteredIds.length === 0 ? (
        <p className="text-xs text-text-muted">
          {raceIds.length === 0 ? "No races defined" : "No matches"}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredIds.map((id) => {
            const race = races[id]!;
            const isOpen = expanded === id;
            const mods = race.statMods ?? {};
            const modSummary = Object.entries(mods)
              .map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v}`)
              .join(" ");

            return (
              <div
                key={id}
                className="rounded border border-border-muted bg-bg-primary"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-2 py-1.5"
                  onClick={() => setExpanded(isOpen ? null : id)}
                >
                  <span className="text-xs text-text-primary">
                    <span className="font-semibold">{race.displayName}</span>
                    <span className="ml-2 text-text-muted">{id}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {modSummary && (
                      <span className="text-[10px] text-text-muted">
                        {modSummary}
                      </span>
                    )}
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <IconButton
                        onClick={() => deleteRace(id)}
                        title="Delete"
                        danger
                      >
                        x
                      </IconButton>
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-border-muted px-2 py-2">
                    <div className="flex flex-col gap-1.5">
                      <FieldRow label="Display Name">
                        <TextInput
                          value={race.displayName}
                          onCommit={(v) =>
                            patchRace(id, { displayName: v })
                          }
                        />
                      </FieldRow>
                      <FieldRow label="Description">
                        <TextInput
                          value={race.description ?? ""}
                          onCommit={(v) =>
                            patchRace(id, {
                              description: v || undefined,
                            })
                          }
                          placeholder="optional"
                        />
                      </FieldRow>

                      <RaceStatMods
                        statMods={race.statMods}
                        statIds={statIds}
                        statDefs={statDefs}
                        onChange={(mods) =>
                          patchRace(id, { statMods: mods })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/**
 * Renders +/- steppers for every defined stat.
 * Shows all stats (not just those with non-zero values) so the user
 * can easily adjust any stat. Only non-zero values are serialized.
 * Includes net-zero indicator and effective base stats preview.
 */
function RaceStatMods({
  statMods,
  statIds,
  statDefs,
  onChange,
}: {
  statMods: StatMap | undefined;
  statIds: string[];
  statDefs: Record<string, { displayName: string; baseStat: number }>;
  onChange: (mods: StatMap | undefined) => void;
}) {
  const mods = statMods ?? {};

  const netTotal = Object.values(mods).reduce((sum, v) => sum + v, 0);

  const updateMod = (statId: string, value: number) => {
    const next = { ...mods };
    if (value === 0) {
      delete next[statId];
    } else {
      next[statId] = value;
    }
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <div className="mt-1 border-t border-border-muted pt-1.5">
      <div className="mb-1 flex items-center gap-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Stat Modifiers
        </h5>
        <span
          className={`text-[10px] font-medium ${
            netTotal === 0
              ? "text-status-success"
              : "text-status-warning"
          }`}
        >
          Net: {netTotal >= 0 ? "+" : ""}
          {netTotal}
          {netTotal === 0 ? " (balanced)" : ""}
        </span>
      </div>
      {statIds.length === 0 ? (
        <p className="text-[10px] text-text-muted">No stats defined</p>
      ) : (
        <div className="flex flex-col gap-1">
          {statIds.map((statId) => {
            const mod = mods[statId] ?? 0;
            const def = statDefs[statId]!;
            const effective = def.baseStat + mod;
            return (
              <div key={statId} className="flex items-center gap-1.5">
                <span className="w-20 shrink-0 text-xs text-text-muted" title={def.displayName}>
                  {statId}
                </span>
                <button
                  className="flex h-5 w-5 items-center justify-center rounded text-xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                  onClick={() => updateMod(statId, mod - 1)}
                  title="Decrease"
                >
                  -
                </button>
                <span
                  className={`w-8 text-center text-xs font-medium ${
                    mod > 0
                      ? "text-status-success"
                      : mod < 0
                        ? "text-status-danger"
                        : "text-text-muted"
                  }`}
                >
                  {mod >= 0 ? "+" : ""}
                  {mod}
                </span>
                <button
                  className="flex h-5 w-5 items-center justify-center rounded text-xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                  onClick={() => updateMod(statId, mod + 1)}
                  title="Increase"
                >
                  +
                </button>
                <span className="ml-1 text-[10px] text-text-muted">
                  = {effective}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
