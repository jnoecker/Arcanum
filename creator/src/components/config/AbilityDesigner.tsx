import { useCallback, useMemo } from "react";
import type { AbilityDefinitionConfig, AbilityEffectConfig, AppConfig } from "@/types/config";
import {
  AbilityDetail,
  defaultAbilityDefinition,
  renameAbilityDefinition,
  summarizeAbility,
} from "@/components/config/panels/AbilitiesPanel";
import { DefinitionWorkbench } from "./DefinitionWorkbench";

const FALLBACK_TARGET_TYPES = [
  { value: "enemy", label: "Enemy" },
  { value: "self", label: "Self" },
  { value: "ally", label: "Ally" },
];

export function AbilityDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const targetTypeOptions = useMemo(() => {
    const entries = Object.entries(config.abilityTargetTypes);
    if (entries.length > 0) {
      return entries.map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_TARGET_TYPES;
  }, [config.abilityTargetTypes]);

  const statusEffectOptions = useMemo(
    () =>
      Object.keys(config.statusEffects).map((id) => ({
        value: id,
        label: config.statusEffects[id]!.displayName,
      })),
    [config.statusEffects],
  );

  const classOptions = useMemo(
    () =>
      Object.keys(config.classes).map((id) => ({
        value: id,
        label: config.classes[id]!.displayName,
      })),
    [config.classes],
  );

  const petOptions = useMemo(
    () =>
      Object.keys(config.pets ?? {}).map((id) => ({
        value: id,
        label: (config.pets ?? {})[id]!.name,
      })),
    [config.pets],
  );

  const patchEffect = useCallback(
    (
      ability: AbilityDefinitionConfig,
      patch: (p: Partial<AbilityDefinitionConfig>) => void,
      effectPatch: Partial<AbilityEffectConfig>,
    ) => {
      const nextEffect =
        effectPatch.type && effectPatch.type !== ability.effect.type
          ? { type: effectPatch.type } as AbilityEffectConfig
          : { ...ability.effect, ...effectPatch };
      patch({ effect: nextEffect });
    },
    [],
  );

  return (
    <DefinitionWorkbench
      title="Ability designer"
      countLabel="Ability roster"
      description="Target rules, class access, effects, and icon identity."
      addPlaceholder="New ability id"
      searchPlaceholder="Search abilities"
      emptyMessage="No abilities match the current search."
      emptyTitle="Create an ability to start designing it."
      items={config.abilities}
      defaultItem={defaultAbilityDefinition}
      getDisplayName={(ability) => ability.displayName}
      renderSummary={summarizeAbility}
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
      searchFilter={(id, ability, q) => {
        const restriction = ability.requiredClass || ability.classRestriction || "";
        return (
          id.toLowerCase().includes(q) ||
          ability.displayName.toLowerCase().includes(q) ||
          restriction.toLowerCase().includes(q) ||
          ability.effect.type.toLowerCase().includes(q)
        );
      }}
      renderListCard={(id, ability) => {
        const classId = ability.requiredClass || ability.classRestriction;
        return (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-display text-lg text-text-primary">{ability.displayName}</div>
                <div className="mt-1 truncate text-2xs text-text-muted">{id}</div>
              </div>
              {ability.image && (
                <span className="rounded-full bg-badge-success-bg px-2 py-1 text-2xs uppercase tracking-label text-badge-success">
                  Art
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-2xs uppercase tracking-label text-text-muted">
              <span>{ability.effect.type}</span>
              <span>{ability.targetType}</span>
              <span>Lvl {ability.levelRequired}</span>
              {classId && <span>{classId}</span>}
              {(ability.skillPointCost ?? 1) === 0 ? (
                <span className="text-badge-success">Auto</span>
              ) : (
                <span>{ability.skillPointCost ?? 1} SP</span>
              )}
            </div>
            <div className="mt-3 text-xs text-text-secondary">{summarizeAbility(ability)}</div>
          </>
        );
      }}
      renderDetailHeader={(_, ability) => (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">{ability.effect.type}</span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">{ability.targetType}</span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">Mana {ability.manaCost}</span>
          <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">CD {ability.cooldownMs}ms</span>
          {(() => {
            const cost = ability.skillPointCost ?? 1;
            return (
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  cost === 0
                    ? "bg-badge-success-bg text-badge-success"
                    : "bg-[var(--chrome-highlight-strong)] text-text-secondary"
                }`}
                title={
                  cost === 0
                    ? "Auto-learned when level, class, and prerequisites are met"
                    : `Costs ${cost} skill ${cost === 1 ? "point" : "points"} at a trainer`
                }
              >
                {cost === 0 ? "Auto-learn" : `${cost} SP`}
              </span>
            );
          })()}
        </div>
      )}
      onRename={(oldId, newId) => {
        onChange({ abilities: renameAbilityDefinition(config, oldId, newId) });
      }}
      renderDetail={(id, ability, patch) => (
        <AbilityDetail
          id={id}
          ability={ability}
          patch={patch}
          classOptions={classOptions}
          statusEffectOptions={statusEffectOptions}
          targetTypeOptions={targetTypeOptions}
          petOptions={petOptions}
          patchEffect={patchEffect}
        />
      )}
      onItemsChange={(abilities) => onChange({ abilities })}
    />
  );
}
