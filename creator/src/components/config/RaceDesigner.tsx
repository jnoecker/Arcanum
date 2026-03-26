import { useEffect, useMemo, useState } from "react";
import type { AppConfig, RaceDefinitionConfig } from "@/types/config";
import {
  RaceDetail,
  defaultRaceDefinition,
  renameRaceDefinition,
  summarizeRace,
} from "@/components/config/panels/RacesPanel";

function netStatMods(statMods: RaceDefinitionConfig["statMods"]): number {
  return Object.values(statMods ?? {}).reduce((sum, value) => sum + value, 0);
}

export function RaceDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newId, setNewId] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const raceIds = useMemo(
    () =>
      Object.keys(config.races).filter((id) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const race = config.races[id]!;
        return id.toLowerCase().includes(q) || race.displayName.toLowerCase().includes(q);
      }),
    [config.races, search],
  );

  useEffect(() => {
    if (selectedId && config.races[selectedId]) return;
    setSelectedId(raceIds[0] ?? Object.keys(config.races)[0] ?? null);
  }, [config.races, raceIds, selectedId]);

  const selected = selectedId ? config.races[selectedId] ?? null : null;

  const statIds = useMemo(() => Object.keys(config.stats.definitions), [config.stats.definitions]);
  const statDefs = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(config.stats.definitions).map(([id, def]) => [id, { displayName: def.displayName, baseStat: def.baseStat }]),
      ),
    [config.stats.definitions],
  );

  const addRace = () => {
    const id = newId.trim().toUpperCase().replace(/\s+/g, "_");
    if (!id || config.races[id]) return;
    onChange({
      races: {
        ...config.races,
        [id]: defaultRaceDefinition(newId.trim()),
      },
    });
    setSelectedId(id);
    setNewId("");
  };

  const patchRace = (id: string, patch: Partial<RaceDefinitionConfig>) => {
    onChange({
      races: {
        ...config.races,
        [id]: { ...config.races[id]!, ...patch },
      },
    });
  };

  const deleteRace = (id: string) => {
    const next = { ...config.races };
    delete next[id];
    onChange({ races: next });
    if (selectedId === id) setSelectedId(null);
  };

  const commitRename = () => {
    if (!selectedId) return;
    const nextId = renameValue.trim().toUpperCase().replace(/\s+/g, "_");
    if (!nextId || nextId === selectedId || config.races[nextId]) return;
    onChange({ races: renameRaceDefinition(config, selectedId, nextId) });
    setSelectedId(nextId);
    setRenaming(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-ui text-text-muted">Race roster</p>
          <h4 className="mt-2 font-display text-xl text-text-primary">{Object.keys(config.races).length} races</h4>
        </div>

        <div className="flex gap-2">
          <input
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addRace();
            }}
            placeholder="New race id"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none"
          />
          <button
            onClick={addRace}
            className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary transition hover:bg-white/12"
          >
            Add
          </button>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search races"
          className="mt-3 w-full rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none"
        />

        <div className="mt-4 flex max-h-[38rem] flex-col gap-2 overflow-y-auto pr-1">
          {raceIds.map((id) => {
            const race = config.races[id]!;
            const selectedCard = id === selectedId;
            return (
              <button
                key={id}
                onClick={() => {
                  setSelectedId(id);
                  setRenaming(false);
                }}
                className={`rounded-[20px] border px-4 py-3 text-left transition ${
                  selectedCard
                    ? "border-border-active bg-gradient-active"
                    : "border-white/8 bg-white/4 hover:bg-white/8"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg text-text-primary">{race.displayName}</div>
                    <div className="mt-1 truncate text-[11px] text-text-muted">{id}</div>
                  </div>
                  {race.image && (
                    <span className="rounded-full bg-badge-success-bg px-2 py-1 text-2xs uppercase tracking-label text-badge-success">
                      Art
                    </span>
                  )}
                </div>
                <div className="mt-3 text-xs text-text-secondary">{summarizeRace(race)}</div>
              </button>
            );
          })}
          {raceIds.length === 0 && (
            <div className="rounded-[20px] border border-dashed border-white/12 bg-white/4 px-4 py-6 text-sm text-text-muted">
              No races match the current search.
            </div>
          )}
        </div>
      </div>

      {selectedId && selected ? (
        <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-ui text-text-muted">Race designer</p>
              <h4 className="mt-2 font-display text-3xl text-text-primary">{selected.displayName}</h4>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary">
                Lore, traits, body language, and stat identity.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">
                {selected.traits?.length ?? 0} traits
              </span>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">
                {selected.abilities?.length ?? 0} abilities
              </span>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">
                Net stat mod {netStatMods(selected.statMods) >= 0 ? "+" : ""}{netStatMods(selected.statMods)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {renaming ? (
              <>
                <input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename();
                    if (event.key === "Escape") setRenaming(false);
                  }}
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none"
                />
                <button onClick={commitRename} title="Confirm rename" className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary hover:bg-white/12">
                  Rename
                </button>
                <button onClick={() => setRenaming(false)} title="Cancel rename" className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs text-text-secondary hover:bg-white/8">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setRenameValue(selectedId);
                    setRenaming(true);
                  }}
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary hover:bg-white/12"
                >
                  Rename ID
                </button>
                <button
                  onClick={() => deleteRace(selectedId)}
                  className="rounded-full border border-status-danger/40 bg-status-danger/10 px-4 py-2 text-xs text-status-danger hover:bg-status-danger/15"
                >
                  Delete Race
                </button>
              </>
            )}
          </div>

          <div className="mt-4">
            <RaceDetail
              id={selectedId}
              race={selected}
              patch={(patch) => patchRace(selectedId, patch)}
              statIds={statIds}
              statDefs={statDefs}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/12 bg-white/4 px-6 py-10 text-sm text-text-muted">
          Create a race to start designing it.
        </div>
      )}
    </div>
  );
}
