import { useState, useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { StatDefinition, StatBindings } from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";

export function StatsPanel({ config, onChange, showDefinitions = true }: ConfigPanelProps & { showDefinitions?: boolean }) {
  const { definitions, bindings } = config.stats;
  const statIds = Object.keys(definitions);

  const patchDef = (id: string, p: Partial<StatDefinition>) =>
    onChange({
      stats: {
        ...config.stats,
        definitions: {
          ...definitions,
          [id]: { ...definitions[id]!, ...p },
        },
      },
    });

  const patchBindings = (p: Partial<StatBindings>) =>
    onChange({
      stats: { ...config.stats, bindings: { ...bindings, ...p } },
    });

  const deleteStat = (id: string) => {
    const next = { ...definitions };
    delete next[id];
    onChange({ stats: { ...config.stats, definitions: next } });
  };

  const [newId, setNewId] = useState("");

  const addStat = useCallback(() => {
    const id = newId.trim().toUpperCase();
    if (!id || definitions[id]) return;
    onChange({
      stats: {
        ...config.stats,
        definitions: {
          ...definitions,
          [id]: {
            id,
            displayName: id,
            abbreviation: id.slice(0, 3),
            description: "",
            baseStat: 10,
          },
        },
      },
    });
    setNewId("");
  }, [newId, definitions, config.stats, onChange]);

  const statOptions = statIds.map((id) => ({
    value: id,
    label: definitions[id]!.displayName,
  }));

  return (
    <>
      {showDefinitions && <Section
        title="Stat Definitions"
        description="Define the core attributes for player characters. Common setups include the classic six (STR, DEX, CON, INT, WIS, CHA) or simplified systems with 3-4 stats. Each stat can be linked to game mechanics via Stat Bindings below."
        actions={
          <div className="flex items-center gap-1">
            <input
              className="w-20 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              placeholder="NEW_ID"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addStat();
              }}
            />
            <IconButton onClick={addStat} title="Add stat">
              +
            </IconButton>
          </div>
        }
      >
        {statIds.length === 0 ? (
          <p className="text-xs text-text-muted">No stats defined</p>
        ) : (
          <div className="flex flex-col gap-3">
            {statIds.map((id) => {
              const def = definitions[id]!;
              return (
                <div
                  key={id}
                  className="rounded border border-border-muted bg-bg-primary p-2"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">
                      {id}
                    </span>
                    <IconButton
                      onClick={() => deleteStat(id)}
                      title="Delete stat"
                      danger
                    >
                      x
                    </IconButton>
                  </div>
                  <div className="flex flex-col gap-1">
                    <FieldRow label="Display Name" hint="Shown in the character sheet and UI.">
                      <TextInput
                        value={def.displayName}
                        onCommit={(v) => patchDef(id, { displayName: v })}
                      />
                    </FieldRow>
                    <FieldRow label="Abbreviation" hint="Short form used in compact displays (e.g. STR, DEX).">
                      <TextInput
                        value={def.abbreviation}
                        onCommit={(v) => patchDef(id, { abbreviation: v })}
                      />
                    </FieldRow>
                    <FieldRow label="Description" hint="Flavor text explaining what this stat does for the player.">
                      <TextInput
                        value={def.description}
                        onCommit={(v) => patchDef(id, { description: v })}
                      />
                    </FieldRow>
                    <FieldRow label="Base Value" hint="Default value before racial modifiers and equipment. 10 is a standard neutral baseline.">
                      <NumberInput
                        value={def.baseStat}
                        onCommit={(v) => patchDef(id, { baseStat: v ?? 10 })}
                        min={0}
                      />
                    </FieldRow>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>}

      <Section
        title="Stat Bindings"
        description="Connect stats to game mechanics. Each binding links a stat to a formula that affects combat, regen, or progression. Divisors control how many stat points are needed per unit of effect — higher divisors make stats less impactful per point."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Melee Dmg Stat" hint="Which stat adds bonus melee damage. Typically Strength.">
            <SelectInput
              value={bindings.meleeDamageStat}
              onCommit={(v) => patchBindings({ meleeDamageStat: v })}
              options={statOptions}
            />
          </FieldRow>
          <FieldRow label="Melee Divisor" hint="Bonus damage = stat / divisor. At divisor 3, a stat of 15 adds +5 damage. Lower divisor = stronger scaling.">
            <NumberInput
              value={bindings.meleeDamageDivisor}
              onCommit={(v) =>
                patchBindings({ meleeDamageDivisor: v ?? 3 })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="Dodge Stat" hint="Which stat grants dodge chance. Typically Dexterity or Agility.">
            <SelectInput
              value={bindings.dodgeStat}
              onCommit={(v) => patchBindings({ dodgeStat: v })}
              options={statOptions}
            />
          </FieldRow>
          <FieldRow label="Dodge / Point" hint="Dodge % gained per stat point. At 2.0, a stat of 15 gives 30% dodge (capped by Max Dodge %).">
            <NumberInput
              value={bindings.dodgePerPoint}
              onCommit={(v) => patchBindings({ dodgePerPoint: v ?? 2 })}
              min={0}
              step={0.1}
            />
          </FieldRow>
          <FieldRow label="Max Dodge %" hint="Hard cap on dodge chance regardless of stat investment. 30% is a classic cap. 50%+ makes dodge builds dominant.">
            <NumberInput
              value={bindings.maxDodgePercent}
              onCommit={(v) =>
                patchBindings({ maxDodgePercent: v ?? 30 })
              }
              min={0}
              max={100}
            />
          </FieldRow>
          <FieldRow label="Spell Dmg Stat" hint="Which stat adds bonus spell/ability damage. Typically Intelligence or Wisdom.">
            <SelectInput
              value={bindings.spellDamageStat}
              onCommit={(v) => patchBindings({ spellDamageStat: v })}
              options={statOptions}
            />
          </FieldRow>
          <FieldRow label="Spell Divisor" hint="Bonus spell damage = stat / divisor. Same scaling logic as melee. Typically matched to melee divisor for balance.">
            <NumberInput
              value={bindings.spellDamageDivisor}
              onCommit={(v) =>
                patchBindings({ spellDamageDivisor: v ?? 3 })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="HP Scaling Stat" hint="Which stat provides bonus max HP. Typically Constitution or Vitality.">
            <SelectInput
              value={bindings.hpScalingStat}
              onCommit={(v) => patchBindings({ hpScalingStat: v })}
              options={statOptions}
            />
          </FieldRow>
          <FieldRow label="HP Divisor" hint="Bonus HP = stat / divisor. At divisor 5, a stat of 20 adds +4 max HP. Lower values make the stat more impactful.">
            <NumberInput
              value={bindings.hpScalingDivisor}
              onCommit={(v) =>
                patchBindings({ hpScalingDivisor: v ?? 5 })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="Mana Stat" hint="Which stat provides bonus max mana. Typically Intelligence or Wisdom.">
            <SelectInput
              value={bindings.manaScalingStat}
              onCommit={(v) => patchBindings({ manaScalingStat: v })}
              options={statOptions}
            />
          </FieldRow>
          <FieldRow label="Mana Divisor" hint="Bonus mana = stat / divisor. Same logic as HP divisor but for the mana pool.">
            <NumberInput
              value={bindings.manaScalingDivisor}
              onCommit={(v) =>
                patchBindings({ manaScalingDivisor: v ?? 5 })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="HP Regen Stat" hint="Which stat speeds up HP regeneration. Typically Constitution.">
            <SelectInput
              value={bindings.hpRegenStat}
              onCommit={(v) => patchBindings({ hpRegenStat: v })}
              options={statOptions}
            />
          </FieldRow>
          <FieldRow label="HP Regen ms/pt" hint="Milliseconds reduced from regen interval per stat point. At 200, a stat of 10 shaves 2s off the regen timer.">
            <NumberInput
              value={bindings.hpRegenMsPerPoint}
              onCommit={(v) =>
                patchBindings({ hpRegenMsPerPoint: v ?? 200 })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="Mana Regen Stat" hint="Which stat speeds up mana regeneration. Typically Wisdom or Intelligence.">
            <SelectInput
              value={bindings.manaRegenStat}
              onCommit={(v) => patchBindings({ manaRegenStat: v })}
              options={statOptions}
            />
          </FieldRow>
          <FieldRow label="Mana Regen ms/pt" hint="Milliseconds reduced from mana regen interval per stat point. Same mechanic as HP regen.">
            <NumberInput
              value={bindings.manaRegenMsPerPoint}
              onCommit={(v) =>
                patchBindings({ manaRegenMsPerPoint: v ?? 200 })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="XP Bonus Stat" hint="Which stat grants bonus XP from kills. A niche stat that rewards players who invest in it with faster leveling.">
            <SelectInput
              value={bindings.xpBonusStat}
              onCommit={(v) => patchBindings({ xpBonusStat: v })}
              options={statOptions}
            />
          </FieldRow>
          <FieldRow label="XP / Point" hint="Fractional XP bonus per stat point. At 0.005, a stat of 20 gives +10% bonus XP. Keep this small to avoid snowballing.">
            <NumberInput
              value={bindings.xpBonusPerPoint}
              onCommit={(v) =>
                patchBindings({ xpBonusPerPoint: v ?? 0.005 })
              }
              min={0}
              step={0.001}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
