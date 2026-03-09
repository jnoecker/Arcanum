import { useCallback, useMemo } from "react";
import type { ConfigPanelProps } from "./types";
import type { AbilityDefinitionConfig, AbilityEffectConfig } from "@/types/config";
import {
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { getPreamble } from "@/lib/arcanumPrompts";
import type { ArtStyle } from "@/lib/arcanumPrompts";

const FALLBACK_TARGET_TYPES = [
  { value: "enemy", label: "Enemy" },
  { value: "self", label: "Self" },
  { value: "ally", label: "Ally" },
];

const EFFECT_TYPES = [
  { value: "DIRECT_DAMAGE", label: "Direct Damage" },
  { value: "DIRECT_HEAL", label: "Direct Heal" },
  { value: "APPLY_STATUS", label: "Apply Status" },
  { value: "AREA_DAMAGE", label: "Area Damage" },
  { value: "TAUNT", label: "Taunt" },
];

function abilityPrompt(ability: AbilityDefinitionConfig, style: ArtStyle): string {
  const preamble = getPreamble(style);
  const effectDesc = ability.effect.type.toLowerCase().replace(/_/g, " ");
  return `${preamble}, a game ability icon for "${ability.displayName}" — ${effectDesc} spell, ${ability.description || "magical ability"}, centered square composition like an RPG ability sprite, iconic symbol rendered as flowing energy, no text, no figures`;
}

export function AbilitiesPanel({ config, onChange }: ConfigPanelProps) {
  const targetTypeOptions = useMemo(() => {
    const entries = Object.entries(config.abilityTargetTypes);
    if (entries.length > 0) {
      return entries.map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_TARGET_TYPES;
  }, [config.abilityTargetTypes]);

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
      renderDetail={(id, a, patch) => (
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
              options={targetTypeOptions}
            />
          </FieldRow>
          <FieldRow label="Req. Class" hint="If set, only this class can learn the ability. Leave empty for any class.">
            <SelectInput
              value={a.requiredClass ?? a.classRestriction ?? ""}
              onCommit={(v) => patch({ requiredClass: v || "", classRestriction: v || undefined })}
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
                a.effect.type === "AREA_DAMAGE") && (
                <>
                  <FieldRow label="Min Damage" hint="Minimum damage dealt per hit. 0 means no direct damage.">
                    <NumberInput
                      value={a.effect.minDamage ?? 0}
                      onCommit={(v) =>
                        patchEffect(a, patch, { minDamage: v ?? 0 })
                      }
                      min={0}
                    />
                  </FieldRow>
                  <FieldRow label="Max Damage" hint="Maximum damage dealt per hit. The actual value is rolled between min and max.">
                    <NumberInput
                      value={a.effect.maxDamage ?? 0}
                      onCommit={(v) =>
                        patchEffect(a, patch, { maxDamage: v ?? 0 })
                      }
                      min={0}
                    />
                  </FieldRow>
                </>
              )}
              {(a.effect.type === "DIRECT_HEAL" ||
                a.effect.type === "AREA_DAMAGE") && (
                <>
                  <FieldRow label="Min Heal" hint="Minimum healing per cast. 0 means no healing component.">
                    <NumberInput
                      value={a.effect.minHeal ?? 0}
                      onCommit={(v) =>
                        patchEffect(a, patch, { minHeal: v ?? 0 })
                      }
                      min={0}
                    />
                  </FieldRow>
                  <FieldRow label="Max Heal" hint="Maximum healing per cast. The actual value is rolled between min and max.">
                    <NumberInput
                      value={a.effect.maxHeal ?? 0}
                      onCommit={(v) =>
                        patchEffect(a, patch, { maxHeal: v ?? 0 })
                      }
                      min={0}
                    />
                  </FieldRow>
                </>
              )}
              {(a.effect.type === "DIRECT_DAMAGE" ||
                a.effect.type === "AREA_DAMAGE" ||
                a.effect.type === "DIRECT_HEAL") && (
                <FieldRow label="Value" hint="Legacy flat value. Used when min/max are both 0.">
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
              {(a.effect.type === "TAUNT" ||
                a.effect.type === "AREA_DAMAGE") && (
                <>
                  <FieldRow label="Flat Threat" hint="Fixed threat added to the target's threat table. Forces mob attention.">
                    <NumberInput
                      value={a.effect.flatThreat ?? 0}
                      onCommit={(v) =>
                        patchEffect(a, patch, { flatThreat: v ?? 0 })
                      }
                      min={0}
                    />
                  </FieldRow>
                  <FieldRow label="Margin" hint="Extra threat margin above current highest. Ensures taunt sticks.">
                    <NumberInput
                      value={a.effect.margin ?? 0}
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

          {/* Sprite section */}
          <div className="mt-1 border-t border-border-muted pt-1.5">
            <h5 className="mb-1 text-[10px] font-display uppercase tracking-widest text-text-muted">
              Sprite
            </h5>
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Image">
                <TextInput
                  value={a.image ?? ""}
                  onCommit={(v) => patch({ image: v || undefined })}
                  placeholder="none"
                />
              </FieldRow>
              <EntityArtGenerator
                getPrompt={(style) => abilityPrompt(a, style)}
                currentImage={a.image}
                onAccept={(filePath) => patch({ image: filePath })}
                assetType="ability_sprite"
                context={{ zone: "", entity_type: "ability", entity_id: id }}
              />
            </div>
          </div>
        </>
      )}
    />
  );
}
