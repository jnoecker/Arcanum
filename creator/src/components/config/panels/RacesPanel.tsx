import type { ConfigPanelProps } from "./types";
import type { RaceDefinitionConfig } from "@/types/config";
import type { StatMap } from "@/types/world";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

export function RacesPanel({ config, onChange }: ConfigPanelProps) {
  const statDefs = config.stats.definitions;
  const statIds = Object.keys(statDefs);

  return (
    <RegistryPanel<RaceDefinitionConfig>
      title="Races"
      items={config.races}
      onItemsChange={(races) => onChange({ races })}
      placeholder="New race"
      idTransform={(raw) => raw.trim().toUpperCase().replace(/\s+/g, "_")}
      getDisplayName={(r) => r.displayName}
      defaultItem={(raw) => ({ displayName: raw })}
      renderSummary={(_id, race) => {
        const mods = race.statMods ?? {};
        return Object.entries(mods)
          .map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v}`)
          .join(" ");
      }}
      renderDetail={(_id, race, patch) => (
        <>
          <FieldRow label="Display Name">
            <TextInput
              value={race.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
          <FieldRow label="Description">
            <TextInput
              value={race.description ?? ""}
              onCommit={(v) => patch({ description: v || undefined })}
              placeholder="optional"
            />
          </FieldRow>
          <RaceStatMods
            statMods={race.statMods}
            statIds={statIds}
            statDefs={statDefs}
            onChange={(mods) => patch({ statMods: mods })}
          />
        </>
      )}
    />
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
