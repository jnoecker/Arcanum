import { useMemo } from "react";
import type { AppConfig, RaceDefinitionConfig } from "@/types/config";
import {
  RaceDetail,
  defaultRaceDefinition,
  renameRaceDefinition,
  summarizeRace,
} from "@/components/config/panels/RacesPanel";
import { DefinitionWorkbench } from "./DefinitionWorkbench";

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
  const statIds = useMemo(() => Object.keys(config.stats.definitions), [config.stats.definitions]);
  const statDefs = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(config.stats.definitions).map(([id, def]) => [id, { displayName: def.displayName, baseStat: def.baseStat }]),
      ),
    [config.stats.definitions],
  );

  return (
    <DefinitionWorkbench
      title="Race designer"
      countLabel="Race roster"
      description="Lore, traits, body language, and stat identity."
      addPlaceholder="New race id"
      searchPlaceholder="Search races"
      emptyMessage="No races match the current search."
      emptyTitle="Create a race to start designing it."
      items={config.races}
      defaultItem={defaultRaceDefinition}
      getDisplayName={(race) => race.displayName}
      renderSummary={summarizeRace}
      idTransform={(raw) => raw.trim().toUpperCase().replace(/\s+/g, "_")}
      renderListCard={(id, race) => (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-lg text-text-primary">{race.displayName}</div>
              <div className="mt-1 truncate text-2xs text-text-muted">{id}</div>
            </div>
            {race.image && (
              <span className="rounded-full bg-badge-success-bg px-2 py-1 text-2xs uppercase tracking-label text-badge-success">
                Art
              </span>
            )}
          </div>
          <div className="mt-3 text-xs text-text-secondary">{summarizeRace(race)}</div>
        </>
      )}
      renderDetailHeader={(_, race) => (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">
            {race.traits?.length ?? 0} traits
          </span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">
            {race.abilities?.length ?? 0} abilities
          </span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">
            Net stat mod {netStatMods(race.statMods) >= 0 ? "+" : ""}{netStatMods(race.statMods)}
          </span>
        </div>
      )}
      onRename={(oldId, newId) => {
        onChange({ races: renameRaceDefinition(config, oldId, newId) });
      }}
      renderDetail={(id, race, patch) => (
        <RaceDetail
          id={id}
          race={race}
          patch={patch}
          statIds={statIds}
          statDefs={statDefs}
        />
      )}
      onItemsChange={(races) => onChange({ races })}
    />
  );
}
