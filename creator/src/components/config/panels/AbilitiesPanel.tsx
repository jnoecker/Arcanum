import { useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { AbilityDefinitionConfig, AbilityEffectConfig } from "@/types/config";
import {
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

const TARGET_TYPES = [
  { value: "ENEMY", label: "Enemy" },
  { value: "SELF", label: "Self" },
  { value: "ALLY", label: "Ally" },
];

const EFFECT_TYPES = [
  { value: "DIRECT_DAMAGE", label: "Direct Damage" },
  { value: "DIRECT_HEAL", label: "Direct Heal" },
  { value: "APPLY_STATUS", label: "Apply Status" },
  { value: "AREA_DAMAGE", label: "Area Damage" },
  { value: "TAUNT", label: "Taunt" },
];

export function AbilitiesPanel({ config, onChange }: ConfigPanelProps) {
  const statusEffectOptions = Object.keys(config.statusEffects).map((id) => ({
    value: id,
    label: config.statusEffects[id]!.displayName,
  }));

  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      const abilities: Record<string, AbilityDefinitionConfig> = {};
      for (const [k, v] of Object.entries(config.abilities)) {
        abilities[k === oldId ? newId : k] = v;
      }
      onChange({ abilities });
    },
    [config.abilities, onChange],
  );

  const classOptions = Object.keys(config.classes).map((id) => ({
    value: id,
    label: config.classes[id]!.displayName,
  }));

  const patchEffect = (
    ability: AbilityDefinitionConfig,
    patch: (p: Partial<AbilityDefinitionConfig>) => void,
    p: Partial<AbilityEffectConfig>,
  ) => {
    const newEffect =
      p.type && p.type !== ability.effect.type
        ? { type: p.type, ...p }
        : { ...ability.effect, ...p };
    patch({ effect: newEffect as AbilityEffectConfig });
  };

  return (
    <RegistryPanel<AbilityDefinitionConfig>
      title="Abilities"
      items={config.abilities}
      onItemsChange={(abilities) => onChange({ abilities })}
      onRenameId={handleRename}
      placeholder="New ability"
      idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
      getDisplayName={(a) => a.displayName}
      defaultItem={(raw) => ({
        displayName: raw,
        manaCost: 5,
        cooldownMs: 0,
        levelRequired: 1,
        targetType: "ENEMY",
        effect: { type: "DIRECT_DAMAGE", value: 3 },
      })}
      renderSummary={(_id, a) => a.effect.type}
      renderDetail={(_id, a, patch) => (
        <>
          <FieldRow label="Display Name">
            <TextInput
              value={a.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
          <FieldRow label="Description">
            <TextInput
              value={a.description ?? ""}
              onCommit={(v) => patch({ description: v || undefined })}
              placeholder="optional"
            />
          </FieldRow>
          <FieldRow label="Mana Cost">
            <NumberInput
              value={a.manaCost}
              onCommit={(v) => patch({ manaCost: v ?? 0 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Cooldown (ms)">
            <NumberInput
              value={a.cooldownMs}
              onCommit={(v) => patch({ cooldownMs: v ?? 0 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Level Req">
            <NumberInput
              value={a.levelRequired}
              onCommit={(v) => patch({ levelRequired: v ?? 1 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="Target">
            <SelectInput
              value={a.targetType}
              onCommit={(v) => patch({ targetType: v })}
              options={TARGET_TYPES}
            />
          </FieldRow>
          <FieldRow label="Req. Class">
            <SelectInput
              value={a.classRestriction ?? ""}
              onCommit={(v) => patch({ classRestriction: v || undefined })}
              options={classOptions}
              allowEmpty
              placeholder="-- any class --"
            />
          </FieldRow>

          {/* Effect sub-section */}
          <div className="mt-1 border-t border-border-muted pt-1.5">
            <h5 className="mb-1 text-[10px] font-display uppercase tracking-widest text-text-muted">
              Effect
            </h5>
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Type">
                <SelectInput
                  value={a.effect.type}
                  onCommit={(v) => patchEffect(a, patch, { type: v })}
                  options={EFFECT_TYPES}
                />
              </FieldRow>
              {(a.effect.type === "DIRECT_DAMAGE" ||
                a.effect.type === "AREA_DAMAGE" ||
                a.effect.type === "DIRECT_HEAL") && (
                <FieldRow label="Value">
                  <NumberInput
                    value={a.effect.value}
                    onCommit={(v) =>
                      patchEffect(a, patch, { value: v ?? 1 })
                    }
                    min={0}
                  />
                </FieldRow>
              )}
              {a.effect.type === "APPLY_STATUS" && (
                <FieldRow label="Status Effect">
                  <SelectInput
                    value={a.effect.statusEffectId ?? ""}
                    onCommit={(v) =>
                      patchEffect(a, patch, {
                        statusEffectId: v || undefined,
                      })
                    }
                    options={statusEffectOptions}
                    allowEmpty
                    placeholder="-- select --"
                  />
                </FieldRow>
              )}
              {a.effect.type === "TAUNT" && (
                <>
                  <FieldRow label="Flat Threat">
                    <NumberInput
                      value={a.effect.flatThreat}
                      onCommit={(v) =>
                        patchEffect(a, patch, { flatThreat: v ?? 10 })
                      }
                      min={0}
                    />
                  </FieldRow>
                  <FieldRow label="Margin">
                    <NumberInput
                      value={a.effect.margin}
                      onCommit={(v) =>
                        patchEffect(a, patch, { margin: v ?? 0 })
                      }
                      min={0}
                    />
                  </FieldRow>
                </>
              )}
            </div>
          </div>
        </>
      )}
    />
  );
}
