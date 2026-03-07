import type { ConfigPanelProps } from "./types";
import type { StatusEffectDefinitionConfig } from "@/types/config";
import type { StatMap } from "@/types/world";
import {
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

const EFFECT_TYPES = [
  { value: "DOT", label: "Damage Over Time" },
  { value: "HOT", label: "Heal Over Time" },
  { value: "STAT_BUFF", label: "Stat Buff" },
  { value: "STAT_DEBUFF", label: "Stat Debuff" },
  { value: "STUN", label: "Stun" },
  { value: "ROOT", label: "Root" },
  { value: "SHIELD", label: "Shield" },
];

const STACK_BEHAVIORS = [
  { value: "REFRESH", label: "Refresh" },
  { value: "STACK", label: "Stack" },
  { value: "NONE", label: "None" },
];

export function StatusEffectsPanel({ config, onChange }: ConfigPanelProps) {
  const statIds = Object.keys(config.stats.definitions);

  return (
    <RegistryPanel<StatusEffectDefinitionConfig>
      title="Status Effects"
      items={config.statusEffects}
      onItemsChange={(statusEffects) => onChange({ statusEffects })}
      placeholder="New effect"
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
      getDisplayName={(e) => e.displayName}
      defaultItem={(raw) => ({
        displayName: raw,
        effectType: "DOT",
        durationMs: 10000,
        stackBehavior: "REFRESH",
      })}
      renderSummary={(_id, e) => e.effectType}
      renderDetail={(_id, e, patch) => {
        const showTick =
          e.effectType === "DOT" || e.effectType === "HOT";
        const showStatMods =
          e.effectType === "STAT_BUFF" || e.effectType === "STAT_DEBUFF";

        return (
          <>
            <FieldRow label="Display Name">
              <TextInput
                value={e.displayName}
                onCommit={(v) => patch({ displayName: v })}
              />
            </FieldRow>
            <FieldRow label="Effect Type">
              <SelectInput
                value={e.effectType}
                onCommit={(v) => patch({ effectType: v })}
                options={EFFECT_TYPES}
              />
            </FieldRow>
            <FieldRow label="Duration (ms)">
              <NumberInput
                value={e.durationMs}
                onCommit={(v) => patch({ durationMs: v ?? 10000 })}
                min={0}
              />
            </FieldRow>
            <FieldRow label="Stack Behavior">
              <SelectInput
                value={e.stackBehavior ?? "REFRESH"}
                onCommit={(v) => patch({ stackBehavior: v })}
                options={STACK_BEHAVIORS}
              />
            </FieldRow>
            {e.stackBehavior === "STACK" && (
              <FieldRow label="Max Stacks">
                <NumberInput
                  value={e.maxStacks}
                  onCommit={(v) => patch({ maxStacks: v ?? 3 })}
                  min={1}
                />
              </FieldRow>
            )}

            {showTick && (
              <>
                <FieldRow label="Tick Interval">
                  <NumberInput
                    value={e.tickIntervalMs}
                    onCommit={(v) => patch({ tickIntervalMs: v ?? 2000 })}
                    min={100}
                  />
                </FieldRow>
                <FieldRow label="Tick Min">
                  <NumberInput
                    value={e.tickMinValue}
                    onCommit={(v) => patch({ tickMinValue: v ?? 1 })}
                    min={0}
                  />
                </FieldRow>
                <FieldRow label="Tick Max">
                  <NumberInput
                    value={e.tickMaxValue}
                    onCommit={(v) => patch({ tickMaxValue: v ?? 3 })}
                    min={0}
                  />
                </FieldRow>
              </>
            )}

            {e.effectType === "SHIELD" && (
              <FieldRow label="Shield Amount">
                <NumberInput
                  value={e.shieldAmount}
                  onCommit={(v) => patch({ shieldAmount: v ?? 20 })}
                  min={0}
                />
              </FieldRow>
            )}

            {showStatMods && (
              <StatModsEditor
                statMods={e.statMods}
                statIds={statIds}
                onChange={(mods) => patch({ statMods: mods })}
              />
            )}
          </>
        );
      }}
    />
  );
}

function StatModsEditor({
  statMods,
  statIds,
  onChange,
}: {
  statMods: StatMap | undefined;
  statIds: string[];
  onChange: (mods: StatMap | undefined) => void;
}) {
  const mods = statMods ?? {};
  const modKeys = Object.keys(mods);
  const available = statIds.filter((id) => !(id in mods));

  const addMod = (statId: string) => {
    onChange({ ...mods, [statId]: 1 });
  };

  const removeMod = (statId: string) => {
    const next = { ...mods };
    delete next[statId];
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  const updateMod = (statId: string, value: number) => {
    onChange({ ...mods, [statId]: value });
  };

  return (
    <div className="mt-1 border-t border-border-muted pt-1.5">
      <div className="mb-1 flex items-center gap-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Stat Modifiers
        </h5>
        {available.length > 0 && (
          <select
            className="rounded border border-border-default bg-bg-primary px-1 py-0.5 text-[10px] text-text-primary outline-none"
            value=""
            onChange={(e) => {
              if (e.target.value) addMod(e.target.value);
            }}
          >
            <option value="">+ add</option>
            {available.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        )}
      </div>
      {modKeys.length === 0 ? (
        <p className="text-[10px] text-text-muted">No modifiers</p>
      ) : (
        <div className="flex flex-col gap-1">
          {modKeys.map((statId) => (
            <div key={statId} className="flex items-center gap-1.5">
              <span className="w-16 shrink-0 text-xs text-text-muted">
                {statId}
              </span>
              <NumberInput
                value={mods[statId]}
                onCommit={(v) => updateMod(statId, v ?? 0)}
              />
              <IconButton
                onClick={() => removeMod(statId)}
                title="Remove"
                danger
              >
                x
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
