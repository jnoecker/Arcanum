import { useCallback, useMemo } from "react";
import type { ConfigPanelProps } from "./types";
import type { StatusEffectDefinitionConfig } from "@/types/config";
import type { StatMap } from "@/types/world";
import { useStatMods } from "@/lib/useStatMods";
import {
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { renameStatusEffectInConfig } from "@/lib/refactorId";
import { BulkImportButton } from "./BulkImportButton";

const FALLBACK_EFFECT_TYPES = [
  { value: "dot", label: "Damage Over Time" },
  { value: "hot", label: "Heal Over Time" },
  { value: "stat_buff", label: "Stat Buff" },
  { value: "stat_debuff", label: "Stat Debuff" },
  { value: "stun", label: "Stun" },
  { value: "root", label: "Root" },
  { value: "shield", label: "Shield" },
];

const FALLBACK_STACK_BEHAVIORS = [
  { value: "refresh", label: "Refresh" },
  { value: "stack", label: "Stack" },
  { value: "none", label: "None" },
];

export function defaultStatusEffectDefinition(raw: string): StatusEffectDefinitionConfig {
  return {
    displayName: raw,
    effectType: "DOT",
    durationMs: 10000,
    stackBehavior: "REFRESH",
  };
}

export function summarizeStatusEffect(effect: StatusEffectDefinitionConfig): string {
  const parts = [effect.effectType];
  if (effect.stackBehavior) parts.push(effect.stackBehavior);
  if (effect.image) parts.push("art");
  return parts.filter(Boolean).join(" | ");
}

export function renameStatusEffectDefinition(
  config: ConfigPanelProps["config"],
  oldId: string,
  newId: string,
) {
  return renameStatusEffectInConfig(config, oldId, newId);
}

export function StatusEffectsPanel({ config, onChange }: ConfigPanelProps) {
  const statIds = Object.keys(config.stats.definitions);

  const effectTypeOptions = useMemo(() => {
    const entries = Object.entries(config.statusEffectTypes);
    if (entries.length > 0) {
      return entries.map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_EFFECT_TYPES;
  }, [config.statusEffectTypes]);

  const stackBehaviorOptions = useMemo(() => {
    const entries = Object.entries(config.stackBehaviors);
    if (entries.length > 0) {
      return entries.map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_STACK_BEHAVIORS;
  }, [config.stackBehaviors]);

  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      const updated = renameStatusEffectDefinition(config, oldId, newId);
      onChange({ statusEffects: updated.statusEffects, abilities: updated.abilities });
    },
    [config, onChange],
  );

  const handleBulkImport = useCallback(
    (mapping: Array<{ original_name: string; file_name: string }>) => {
      const lookup = Object.fromEntries(mapping.map((m) => [m.original_name, m.file_name]));
      const updated: Record<string, StatusEffectDefinitionConfig> = {};
      for (const [id, effect] of Object.entries(config.statusEffects)) {
        const stem = effect.image?.replace(/^.*[\\/]/, "").replace(/\.\w+$/, "");
        if (stem && lookup[stem]) {
          updated[id] = { ...effect, image: lookup[stem] };
        } else {
          updated[id] = effect;
        }
      }
      onChange({ statusEffects: updated });
    },
    [config.statusEffects, onChange],
  );

  return (
    <>
      <BulkImportButton
        assetType="status_effect_icon"
        entityType="status_effect"
        label="Import Status Effect Icons"
        onImported={handleBulkImport}
      />
      <RegistryPanel<StatusEffectDefinitionConfig>
        title="Status Effects"
        items={config.statusEffects}
        onItemsChange={(statusEffects) => onChange({ statusEffects })}
        onRenameId={handleRename}
        placeholder="New effect"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(effect) => effect.displayName}
        defaultItem={defaultStatusEffectDefinition}
        renderSummary={(_id, effect) => summarizeStatusEffect(effect)}
        renderDetail={(_id, effect, patch) => (
          <StatusEffectDetail
            effect={effect}
            patch={patch}
            statIds={statIds}
            effectTypeOptions={effectTypeOptions}
            stackBehaviorOptions={stackBehaviorOptions}
          />
        )}
      />
    </>
  );
}

export function StatusEffectDetail({
  effect,
  patch,
  statIds,
  effectTypeOptions,
  stackBehaviorOptions,
}: {
  effect: StatusEffectDefinitionConfig;
  patch: (p: Partial<StatusEffectDefinitionConfig>) => void;
  statIds: string[];
  effectTypeOptions: { value: string; label: string }[];
  stackBehaviorOptions: { value: string; label: string }[];
}) {
  const et = effect.effectType?.toUpperCase();
  const showTick = et === "DOT" || et === "HOT";
  const showStatMods = et === "STAT_BUFF" || et === "STAT_DEBUFF";

  return (
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={effect.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Image">
        <TextInput
          value={effect.image ?? ""}
          onCommit={(v) => patch({ image: v || undefined })}
          placeholder="None"
        />
      </FieldRow>
      <FieldRow label="Effect Type">
        <SelectInput
          value={effect.effectType}
          onCommit={(v) => patch({ effectType: v })}
          options={effectTypeOptions}
        />
      </FieldRow>
      <FieldRow label="Duration (ms)">
        <NumberInput
          value={effect.durationMs}
          onCommit={(v) => patch({ durationMs: v ?? 10000 })}
          min={0}
        />
      </FieldRow>
      <FieldRow label="Stack Behavior">
        <SelectInput
          value={effect.stackBehavior ?? "REFRESH"}
          onCommit={(v) => patch({ stackBehavior: v })}
          options={stackBehaviorOptions}
        />
      </FieldRow>
      {effect.stackBehavior?.toUpperCase() === "STACK" && (
        <FieldRow label="Max Stacks">
          <NumberInput
            value={effect.maxStacks}
            onCommit={(v) => patch({ maxStacks: v ?? 3 })}
            min={1}
          />
        </FieldRow>
      )}

      {showTick && (
        <>
          <FieldRow label="Tick Interval" hint="Milliseconds between each tick of damage or healing.">
            <NumberInput
              value={effect.tickIntervalMs}
              onCommit={(v) => patch({ tickIntervalMs: v ?? 2000 })}
              min={100}
            />
          </FieldRow>
          <FieldRow label="Tick Min Value" hint="Minimum damage/heal per tick. Actual value is rolled between min and max.">
            <NumberInput
              value={effect.tickMinValue ?? 0}
              onCommit={(v) => patch({ tickMinValue: v ?? 0 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Tick Max Value" hint="Maximum damage/heal per tick.">
            <NumberInput
              value={effect.tickMaxValue ?? 0}
              onCommit={(v) => patch({ tickMaxValue: v ?? 0 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Tick Value" hint="Legacy flat value per tick. Used when min/max are both 0.">
            <NumberInput
              value={effect.tickValue}
              onCommit={(v) => patch({ tickValue: v ?? 1 })}
              min={0}
            />
          </FieldRow>
        </>
      )}

      {et === "SHIELD" && (
        <FieldRow label="Shield Amount" hint="Total damage the shield absorbs before breaking.">
          <NumberInput
            value={effect.shieldAmount}
            onCommit={(v) => patch({ shieldAmount: v ?? 20 })}
            min={0}
          />
        </FieldRow>
      )}

      {showStatMods && (
        <div className="mt-1 border-t border-border-muted pt-1.5">
          <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
            Stat Modifiers
          </h5>
          <div className="grid grid-cols-2 gap-1.5">
            <FieldRow label="STR">
              <NumberInput
                value={effect.strMod ?? 0}
                onCommit={(v) => patch({ strMod: v ?? 0 })}
              />
            </FieldRow>
            <FieldRow label="DEX">
              <NumberInput
                value={effect.dexMod ?? 0}
                onCommit={(v) => patch({ dexMod: v ?? 0 })}
              />
            </FieldRow>
            <FieldRow label="CON">
              <NumberInput
                value={effect.conMod ?? 0}
                onCommit={(v) => patch({ conMod: v ?? 0 })}
              />
            </FieldRow>
            <FieldRow label="INT">
              <NumberInput
                value={effect.intMod ?? 0}
                onCommit={(v) => patch({ intMod: v ?? 0 })}
              />
            </FieldRow>
            <FieldRow label="WIS">
              <NumberInput
                value={effect.wisMod ?? 0}
                onCommit={(v) => patch({ wisMod: v ?? 0 })}
              />
            </FieldRow>
            <FieldRow label="CHA">
              <NumberInput
                value={effect.chaMod ?? 0}
                onCommit={(v) => patch({ chaMod: v ?? 0 })}
              />
            </FieldRow>
          </div>
        </div>
      )}

      {showStatMods && (
        <StatModsEditor
          statMods={effect.statMods}
          statIds={statIds}
          onChange={(mods) => patch({ statMods: mods })}
        />
      )}
    </>
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
  const { mods, addMod, removeMod, updateMod } = useStatMods(statMods, onChange);
  const modKeys = Object.keys(mods);
  const available = statIds.filter((id) => !(id in mods));

  return (
    <div className="mt-1 border-t border-border-muted pt-1.5">
      <div className="mb-1 flex items-center gap-2">
        <h5 className="text-2xs font-display uppercase tracking-widest text-text-muted">
          Stat Modifiers
        </h5>
        {available.length > 0 && (
          <select
            className="rounded border border-border-default bg-bg-primary px-1 py-0.5 text-2xs text-text-primary outline-none"
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
        <p className="text-2xs text-text-muted">No modifiers</p>
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
