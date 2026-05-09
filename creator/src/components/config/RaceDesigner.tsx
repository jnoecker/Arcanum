import { useEffect, useMemo, useState } from "react";
import type { RaceDefinitionConfig } from "@/types/config";
import type { ConfigPanelProps } from "./panels/types";
import { RacesList } from "./races/RacesList";
import { RaceEditor } from "./races/RaceEditor";
import {
  defaultRaceDefinition,
  renameRaceDefinition,
} from "./panels/RacesPanel";

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "NEW_RACE";
  if (!existing[base]) return base;
  let i = 2;
  while (existing[`${base}_${i}`]) i += 1;
  return `${base}_${i}`;
}

function nextDuplicateId(base: string, existing: Record<string, unknown>): string {
  let i = 1;
  while (existing[`${base}_COPY_${i}`]) i += 1;
  return `${base}_COPY_${i}`;
}

function normalizeId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

export function RaceDesigner({ config, onChange }: ConfigPanelProps) {
  const races = config.races;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && races[selectedId]) return;
    const first = Object.keys(races)[0] ?? null;
    setSelectedId(first);
  }, [races, selectedId]);

  const statIds = useMemo(
    () => Object.keys(config.stats.definitions),
    [config.stats.definitions],
  );
  const statDefs = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(config.stats.definitions).map(([id, def]) => [
          id,
          { displayName: def.displayName, baseStat: def.baseStat },
        ]),
      ),
    [config.stats.definitions],
  );

  const patchRace = (id: string, patch: Partial<RaceDefinitionConfig>) => {
    onChange({
      races: {
        ...races,
        [id]: { ...races[id]!, ...patch },
      },
    });
  };

  const renameRace = (oldId: string, rawNewId: string) => {
    const newId = normalizeId(rawNewId);
    if (!newId || oldId === newId || races[newId]) return;
    onChange({ races: renameRaceDefinition({ ...config }, oldId, newId) });
    if (selectedId === oldId) setSelectedId(newId);
  };

  const addRace = () => {
    const id = nextDefaultId(races);
    onChange({
      races: {
        ...races,
        [id]: defaultRaceDefinition("New Race"),
      },
    });
    setSelectedId(id);
  };

  const duplicateRace = () => {
    if (!selectedId || !races[selectedId]) return;
    const source = races[selectedId];
    const newId = nextDuplicateId(selectedId, races);
    const cloned: RaceDefinitionConfig = {
      ...source,
      displayName: `${source.displayName} (copy)`,
      traits: source.traits ? [...source.traits] : undefined,
      abilities: source.abilities ? [...source.abilities] : undefined,
      statMods: source.statMods ? { ...source.statMods } : undefined,
    };
    onChange({ races: { ...races, [newId]: cloned } });
    setSelectedId(newId);
  };

  const deleteRace = () => {
    if (!selectedId || !races[selectedId]) return;
    const next = { ...races };
    delete next[selectedId];
    onChange({ races: next });
    setSelectedId(null);
  };

  const selected = selectedId ? races[selectedId] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <RacesList
          races={races}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={addRace}
          onDuplicate={duplicateRace}
          onDelete={deleteRace}
        />
      </div>

      <div className="xl:col-span-9">
        {selectedId && selected ? (
          <RaceEditor
            id={selectedId}
            race={selected}
            patch={(p) => patchRace(selectedId, p)}
            onRename={(v) => renameRace(selectedId, v)}
            statIds={statIds}
            statDefs={statDefs}
          />
        ) : (
          <EmptyEditor onAdd={addRace} />
        )}
      </div>
    </div>
  );
}

function EmptyEditor({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="panel-surface flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center shadow-section">
      <div>
        <p className="font-display text-base text-text-primary">No race selected</p>
        <p className="mt-1 max-w-xs text-2xs text-text-muted/80">
          Choose a race from the roster, or create a new one to start designing.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        + Add Race
      </button>
    </div>
  );
}
