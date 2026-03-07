import { useState, useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { StatusEffectDefinitionConfig } from "@/types/config";
import type { StatMap } from "@/types/world";
import { useStatMods } from "@/lib/useStatMods";
import {
  Section,
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";

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
  const effects = config.statusEffects;
  const effectIds = Object.keys(effects);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newId, setNewId] = useState("");

  const patchEffect = (
    id: string,
    p: Partial<StatusEffectDefinitionConfig>,
  ) =>
    onChange({
      statusEffects: { ...effects, [id]: { ...effects[id]!, ...p } },
    });

  const deleteEffect = (id: string) => {
    const next = { ...effects };
    delete next[id];
    onChange({ statusEffects: next });
    if (expanded === id) setExpanded(null);
  };

  const addEffect = useCallback(() => {
    const id = newId.trim().toLowerCase().replace(/\s+/g, "_");
    if (!id || effects[id]) return;
    onChange({
      statusEffects: {
        ...effects,
        [id]: {
          displayName: newId.trim(),
          effectType: "DOT",
          durationMs: 10000,
          stackBehavior: "REFRESH",
        },
      },
    });
    setNewId("");
    setExpanded(id);
  }, [newId, effects, onChange]);

  const statIds = Object.keys(config.stats.definitions);

  return (
    <Section
      title={`Status Effects (${effectIds.length})`}
      actions={
        <div className="flex items-center gap-1">
          <input
            className="w-28 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
            placeholder="New effect"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addEffect();
            }}
          />
          <IconButton onClick={addEffect} title="Add effect">
            +
          </IconButton>
        </div>
      }
    >
      {effectIds.length === 0 ? (
        <p className="text-xs text-text-muted">No status effects defined</p>
      ) : (
        <div className="flex flex-col gap-1">
          {effectIds.map((id) => {
            const e = effects[id]!;
            const isOpen = expanded === id;
            const showTick =
              e.effectType === "DOT" || e.effectType === "HOT";
            const showStatMods =
              e.effectType === "STAT_BUFF" || e.effectType === "STAT_DEBUFF";

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
                    <span className="font-semibold">{e.displayName}</span>
                    <span className="ml-2 text-text-muted">{id}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-text-muted">
                      {e.effectType}
                    </span>
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <IconButton
                        onClick={() => deleteEffect(id)}
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
                          value={e.displayName}
                          onCommit={(v) =>
                            patchEffect(id, { displayName: v })
                          }
                        />
                      </FieldRow>
                      <FieldRow label="Effect Type">
                        <SelectInput
                          value={e.effectType}
                          onCommit={(v) =>
                            patchEffect(id, { effectType: v })
                          }
                          options={EFFECT_TYPES}
                        />
                      </FieldRow>
                      <FieldRow label="Duration (ms)">
                        <NumberInput
                          value={e.durationMs}
                          onCommit={(v) =>
                            patchEffect(id, { durationMs: v ?? 10000 })
                          }
                          min={0}
                        />
                      </FieldRow>
                      <FieldRow label="Stack Behavior">
                        <SelectInput
                          value={e.stackBehavior ?? "REFRESH"}
                          onCommit={(v) =>
                            patchEffect(id, { stackBehavior: v })
                          }
                          options={STACK_BEHAVIORS}
                        />
                      </FieldRow>
                      {(e.stackBehavior === "STACK") && (
                        <FieldRow label="Max Stacks">
                          <NumberInput
                            value={e.maxStacks}
                            onCommit={(v) =>
                              patchEffect(id, { maxStacks: v ?? 3 })
                            }
                            min={1}
                          />
                        </FieldRow>
                      )}

                      {showTick && (
                        <>
                          <FieldRow label="Tick Interval">
                            <NumberInput
                              value={e.tickIntervalMs}
                              onCommit={(v) =>
                                patchEffect(id, {
                                  tickIntervalMs: v ?? 2000,
                                })
                              }
                              min={100}
                            />
                          </FieldRow>
                          <FieldRow label="Tick Value">
                            <NumberInput
                              value={e.tickValue}
                              onCommit={(v) =>
                                patchEffect(id, { tickValue: v ?? 1 })
                              }
                              min={0}
                            />
                          </FieldRow>
                        </>
                      )}

                      {e.effectType === "SHIELD" && (
                        <FieldRow label="Shield Amount">
                          <NumberInput
                            value={e.shieldAmount}
                            onCommit={(v) =>
                              patchEffect(id, { shieldAmount: v ?? 20 })
                            }
                            min={0}
                          />
                        </FieldRow>
                      )}

                      {showStatMods && (
                        <StatModsEditor
                          statMods={e.statMods}
                          statIds={statIds}
                          onChange={(mods) =>
                            patchEffect(id, { statMods: mods })
                          }
                        />
                      )}
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
