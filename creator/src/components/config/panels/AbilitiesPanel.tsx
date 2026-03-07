import { useState, useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { AbilityDefinitionConfig, AbilityEffectConfig } from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";

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
  const abilities = config.abilities;
  const abilityIds = Object.keys(abilities);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newId, setNewId] = useState("");

  const patchAbility = (id: string, p: Partial<AbilityDefinitionConfig>) =>
    onChange({
      abilities: { ...abilities, [id]: { ...abilities[id]!, ...p } },
    });

  const patchEffect = (id: string, p: Partial<AbilityEffectConfig>) => {
    const prev = abilities[id]!;
    // When effect type changes, reset to only the new type's fields
    const newEffect =
      p.type && p.type !== prev.effect.type
        ? { type: p.type, ...p }
        : { ...prev.effect, ...p };
    onChange({
      abilities: {
        ...abilities,
        [id]: { ...prev, effect: newEffect },
      },
    });
  };

  const deleteAbility = (id: string) => {
    const next = { ...abilities };
    delete next[id];
    onChange({ abilities: next });
    if (expanded === id) setExpanded(null);
  };

  const addAbility = useCallback(() => {
    const id = newId.trim().toLowerCase().replace(/\s+/g, "_");
    if (!id || abilities[id]) return;
    onChange({
      abilities: {
        ...abilities,
        [id]: {
          displayName: newId.trim(),
          manaCost: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          effect: { type: "DIRECT_DAMAGE", minDamage: 1, maxDamage: 3 },
        },
      },
    });
    setNewId("");
    setExpanded(id);
  }, [newId, abilities, onChange]);

  const statusEffectOptions = Object.keys(config.statusEffects).map((id) => ({
    value: id,
    label: config.statusEffects[id]!.displayName,
  }));

  const classOptions = Object.keys(config.classes).map((id) => ({
    value: id,
    label: config.classes[id]!.displayName,
  }));

  return (
    <Section
      title={`Abilities (${abilityIds.length})`}
      actions={
        <div className="flex items-center gap-1">
          <input
            className="w-28 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
            placeholder="New ability"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addAbility();
            }}
          />
          <IconButton onClick={addAbility} title="Add ability">
            +
          </IconButton>
        </div>
      }
    >
      {abilityIds.length === 0 ? (
        <p className="text-xs text-text-muted">No abilities defined</p>
      ) : (
        <div className="flex flex-col gap-1">
          {abilityIds.map((id) => {
            const a = abilities[id]!;
            const isOpen = expanded === id;
            return (
              <div
                key={id}
                className="rounded border border-border-muted bg-bg-primary"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-2 py-1.5"
                  onClick={() => setExpanded(isOpen ? null : id)}
                >
                  <span className="text-xs text-text-primary">
                    <span className="font-semibold">{a.displayName}</span>
                    <span className="ml-2 text-text-muted">{id}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-text-muted">
                      {a.effect.type}
                    </span>
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <IconButton
                        onClick={() => deleteAbility(id)}
                        title="Delete"
                        danger
                      >
                        x
                      </IconButton>
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-border-muted px-2 py-2">
                    <div className="flex flex-col gap-1.5">
                      <FieldRow label="Display Name">
                        <TextInput
                          value={a.displayName}
                          onCommit={(v) =>
                            patchAbility(id, { displayName: v })
                          }
                        />
                      </FieldRow>
                      <FieldRow label="Description">
                        <TextInput
                          value={a.description ?? ""}
                          onCommit={(v) =>
                            patchAbility(id, {
                              description: v || undefined,
                            })
                          }
                          placeholder="optional"
                        />
                      </FieldRow>
                      <FieldRow label="Mana Cost">
                        <NumberInput
                          value={a.manaCost}
                          onCommit={(v) =>
                            patchAbility(id, { manaCost: v ?? 0 })
                          }
                          min={0}
                        />
                      </FieldRow>
                      <FieldRow label="Cooldown (ms)">
                        <NumberInput
                          value={a.cooldownMs}
                          onCommit={(v) =>
                            patchAbility(id, { cooldownMs: v ?? 0 })
                          }
                          min={0}
                        />
                      </FieldRow>
                      <FieldRow label="Level Req">
                        <NumberInput
                          value={a.levelRequired}
                          onCommit={(v) =>
                            patchAbility(id, { levelRequired: v ?? 1 })
                          }
                          min={1}
                        />
                      </FieldRow>
                      <FieldRow label="Target">
                        <SelectInput
                          value={a.targetType}
                          onCommit={(v) =>
                            patchAbility(id, { targetType: v })
                          }
                          options={TARGET_TYPES}
                        />
                      </FieldRow>
                      <FieldRow label="Req. Class">
                        <SelectInput
                          value={a.requiredClass ?? ""}
                          onCommit={(v) =>
                            patchAbility(id, {
                              requiredClass: v || undefined,
                            })
                          }
                          options={classOptions}
                          allowEmpty
                          placeholder="-- any class --"
                        />
                      </FieldRow>

                      {/* Effect sub-section */}
                      <div className="mt-1 border-t border-border-muted pt-1.5">
                        <h5 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Effect
                        </h5>
                        <div className="flex flex-col gap-1.5">
                          <FieldRow label="Type">
                            <SelectInput
                              value={a.effect.type}
                              onCommit={(v) =>
                                patchEffect(id, { type: v })
                              }
                              options={EFFECT_TYPES}
                            />
                          </FieldRow>
                          {(a.effect.type === "DIRECT_DAMAGE" ||
                            a.effect.type === "AREA_DAMAGE") && (
                            <>
                              <FieldRow label="Min Damage">
                                <NumberInput
                                  value={a.effect.minDamage}
                                  onCommit={(v) =>
                                    patchEffect(id, { minDamage: v ?? 1 })
                                  }
                                  min={0}
                                />
                              </FieldRow>
                              <FieldRow label="Max Damage">
                                <NumberInput
                                  value={a.effect.maxDamage}
                                  onCommit={(v) =>
                                    patchEffect(id, { maxDamage: v ?? 3 })
                                  }
                                  min={0}
                                />
                              </FieldRow>
                            </>
                          )}
                          {a.effect.type === "DIRECT_HEAL" && (
                            <>
                              <FieldRow label="Min Heal">
                                <NumberInput
                                  value={a.effect.minHeal}
                                  onCommit={(v) =>
                                    patchEffect(id, { minHeal: v ?? 1 })
                                  }
                                  min={0}
                                />
                              </FieldRow>
                              <FieldRow label="Max Heal">
                                <NumberInput
                                  value={a.effect.maxHeal}
                                  onCommit={(v) =>
                                    patchEffect(id, { maxHeal: v ?? 3 })
                                  }
                                  min={0}
                                />
                              </FieldRow>
                            </>
                          )}
                          {a.effect.type === "APPLY_STATUS" && (
                            <FieldRow label="Status Effect">
                              <SelectInput
                                value={a.effect.statusEffectId ?? ""}
                                onCommit={(v) =>
                                  patchEffect(id, {
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
                                    patchEffect(id, {
                                      flatThreat: v ?? 10,
                                    })
                                  }
                                  min={0}
                                />
                              </FieldRow>
                              <FieldRow label="Margin">
                                <NumberInput
                                  value={a.effect.margin}
                                  onCommit={(v) =>
                                    patchEffect(id, { margin: v ?? 0 })
                                  }
                                  min={0}
                                />
                              </FieldRow>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
