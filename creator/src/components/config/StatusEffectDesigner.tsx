import { useMemo } from "react";
import type { AppConfig, StatusEffectDefinitionConfig } from "@/types/config";
import {
  StatusEffectDetail,
  defaultStatusEffectDefinition,
  renameStatusEffectDefinition,
  summarizeStatusEffect,
} from "@/components/config/panels/StatusEffectsPanel";
import { DefinitionWorkbench } from "./DefinitionWorkbench";

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

function modifierCount(effect: StatusEffectDefinitionConfig) {
  const flat = [effect.strMod, effect.dexMod, effect.conMod, effect.intMod, effect.wisMod, effect.chaMod].filter(Boolean).length;
  return flat + Object.keys(effect.statMods ?? {}).length;
}

export function StatusEffectDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const statIds = useMemo(() => Object.keys(config.stats.definitions), [config.stats.definitions]);

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

  return (
    <DefinitionWorkbench
      title="Condition designer"
      countLabel="Condition roster"
      description="Tune ticking behavior, stack rules, and stat pressure for this condition in one editing pass."
      addPlaceholder="New condition id"
      searchPlaceholder="Search conditions"
      emptyMessage="No conditions match the current search."
      emptyTitle="Create a condition to start designing it."
      items={config.statusEffects}
      defaultItem={defaultStatusEffectDefinition}
      getDisplayName={(effect) => effect.displayName}
      renderSummary={summarizeStatusEffect}
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
      searchFilter={(id, effect, q) => (
        id.toLowerCase().includes(q) ||
        effect.displayName.toLowerCase().includes(q) ||
        effect.effectType.toLowerCase().includes(q) ||
        (effect.stackBehavior ?? "").toLowerCase().includes(q)
      )}
      renderListCard={(id, effect) => (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-lg text-text-primary">{effect.displayName}</div>
              <div className="mt-1 truncate text-2xs text-text-muted">{id}</div>
            </div>
            {effect.image && (
              <span className="rounded-full bg-badge-success-bg px-2 py-1 text-2xs uppercase tracking-label text-badge-success">
                Art
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-2xs uppercase tracking-label text-text-muted">
            <span>{effect.effectType}</span>
            <span>{effect.stackBehavior ?? "REFRESH"}</span>
            <span>{Math.round(effect.durationMs / 1000)}s</span>
            {modifierCount(effect) > 0 && <span>{modifierCount(effect)} mods</span>}
          </div>
          <div className="mt-3 text-xs text-text-secondary">{summarizeStatusEffect(effect)}</div>
        </>
      )}
      renderDetailHeader={(_, effect) => (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">{effect.effectType}</span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">{effect.stackBehavior ?? "REFRESH"}</span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">{effect.durationMs}ms</span>
          {effect.tickIntervalMs ? (
            <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">Tick {effect.tickIntervalMs}ms</span>
          ) : null}
        </div>
      )}
      onRename={(oldId, newId) => {
        const updated = renameStatusEffectDefinition(config, oldId, newId);
        onChange({ statusEffects: updated.statusEffects, abilities: updated.abilities });
      }}
      renderDetail={(_id, effect, patch) => (
        <StatusEffectDetail
          effect={effect}
          patch={patch}
          statIds={statIds}
          effectTypeOptions={effectTypeOptions}
          stackBehaviorOptions={stackBehaviorOptions}
        />
      )}
      onItemsChange={(statusEffects) => onChange({ statusEffects })}
    />
  );
}
