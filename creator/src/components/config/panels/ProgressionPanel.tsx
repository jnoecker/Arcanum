import type { ConfigPanelProps, AppConfig } from "./types";
import {
  Section,
  FieldRow,
  NumberInput,
  CheckboxInput,
} from "@/components/ui/FormWidgets";

export function ProgressionPanel({ config, onChange }: ConfigPanelProps) {
  const p = config.progression;

  const patchProg = (patch: Partial<AppConfig["progression"]>) =>
    onChange({ progression: { ...p, ...patch } });

  return (
    <>
      <Section title="Level Cap">
        <FieldRow label="Max Level">
          <NumberInput
            value={p.maxLevel}
            onCommit={(v) => patchProg({ maxLevel: v ?? 50 })}
            min={1}
          />
        </FieldRow>
      </Section>

      <Section title="XP Curve">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Base XP">
            <NumberInput
              value={p.xp.baseXp}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, baseXp: v ?? 100 } })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="Exponent">
            <NumberInput
              value={p.xp.exponent}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, exponent: v ?? 2.0 } })
              }
              min={1}
              step={0.1}
            />
          </FieldRow>
          <FieldRow label="Linear XP">
            <NumberInput
              value={p.xp.linearXp}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, linearXp: v ?? 0 } })
              }
              min={0}
            />
          </FieldRow>
          <FieldRow label="Multiplier">
            <NumberInput
              value={p.xp.multiplier}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, multiplier: v ?? 1.0 } })
              }
              min={0.1}
              step={0.1}
            />
          </FieldRow>
          <FieldRow label="Default Kill XP">
            <NumberInput
              value={p.xp.defaultKillXp}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, defaultKillXp: v ?? 50 } })
              }
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Level-Up Rewards">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="HP / Level">
            <NumberInput
              value={p.rewards.hpPerLevel}
              onCommit={(v) =>
                patchProg({
                  rewards: { ...p.rewards, hpPerLevel: v ?? 2 },
                })
              }
              min={0}
            />
          </FieldRow>
          <FieldRow label="Mana / Level">
            <NumberInput
              value={p.rewards.manaPerLevel}
              onCommit={(v) =>
                patchProg({
                  rewards: { ...p.rewards, manaPerLevel: v ?? 5 },
                })
              }
              min={0}
            />
          </FieldRow>
          <FieldRow label="Base HP">
            <NumberInput
              value={p.rewards.baseHp}
              onCommit={(v) =>
                patchProg({
                  rewards: { ...p.rewards, baseHp: v ?? 10 },
                })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="Base Mana">
            <NumberInput
              value={p.rewards.baseMana}
              onCommit={(v) =>
                patchProg({
                  rewards: { ...p.rewards, baseMana: v ?? 20 },
                })
              }
              min={0}
            />
          </FieldRow>
          <CheckboxInput
            checked={p.rewards.fullHealOnLevelUp}
            onCommit={(v) =>
              patchProg({
                rewards: { ...p.rewards, fullHealOnLevelUp: v },
              })
            }
            label="Full heal on level up"
          />
          <CheckboxInput
            checked={p.rewards.fullManaOnLevelUp}
            onCommit={(v) =>
              patchProg({
                rewards: { ...p.rewards, fullManaOnLevelUp: v },
              })
            }
            label="Full mana on level up"
          />
        </div>
      </Section>
    </>
  );
}
