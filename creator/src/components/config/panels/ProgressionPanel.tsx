import type { ConfigPanelProps, AppConfig } from "./types";
import type { DiminishingXpConfig, DiminishingXpThreshold } from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  CheckboxInput,
  IconButton,
} from "@/components/ui/FormWidgets";

export function ProgressionPanel({ config, onChange }: ConfigPanelProps) {
  const p = config.progression;

  const patchProg = (patch: Partial<AppConfig["progression"]>) =>
    onChange({ progression: { ...p, ...patch } });

  return (
    <>
      <Section
        title="Level Cap"
        description="The maximum level a player character can reach. Higher caps extend the endgame grind; lower caps let players reach max power sooner. Most classic MUDs use 30-100."
      >
        <FieldRow label="Max Level" hint="Suggested: 30 for a focused experience, 50 for a standard MUD, 100 for an extended grind.">
          <NumberInput
            value={p.maxLevel}
            onCommit={(v) => patchProg({ maxLevel: v ?? 50 })}
            min={1}
          />
        </FieldRow>
      </Section>

      <Section
        title="XP Curve"
        description="Controls how much XP is needed to level up. The formula is: XP(level) = baseXp * level^exponent + linearXp * level, then multiplied by the global multiplier. Higher exponents create a steep late-game curve where each level takes dramatically more effort."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Base XP" hint="Starting XP constant in the curve formula. Higher values slow down all leveling uniformly. 100 is a good starting point.">
            <NumberInput
              value={p.xp.baseXp}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, baseXp: v ?? 100 } })
              }
              min={1}
            />
          </FieldRow>
          <FieldRow label="Exponent" hint="How steeply XP requirements grow. 1.5 = gentle curve, 2.0 = classic quadratic, 3.0 = very steep late game. Most MUDs use 1.5-2.5.">
            <NumberInput
              value={p.xp.exponent}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, exponent: v ?? 2.0 } })
              }
              min={1}
              step={0.1}
            />
          </FieldRow>
          <FieldRow label="Linear XP" hint="Flat XP added per level on top of the exponential curve. Useful for smoothing out the early-level experience. 0 disables it.">
            <NumberInput
              value={p.xp.linearXp}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, linearXp: v ?? 0 } })
              }
              min={0}
            />
          </FieldRow>
          <FieldRow label="Multiplier" hint="Global XP requirement multiplier. 1.0 = normal. Set below 1.0 for faster leveling (e.g. 0.5 = double speed). Useful for testing or events.">
            <NumberInput
              value={p.xp.multiplier}
              onCommit={(v) =>
                patchProg({ xp: { ...p.xp, multiplier: v ?? 1.0 } })
              }
              min={0.1}
              step={0.1}
            />
          </FieldRow>
          <FieldRow label="Default Kill XP" hint="XP awarded per mob kill when no specific XP is set on the mob. Acts as a fallback. 50 is reasonable for standard-tier mobs near level 1.">
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

      <Section
        title="Diminishing Returns"
        description="Scales down XP when a player has out-levelled the source — applies to kills (mob level) and to quests or puzzles that declare an intended level. Each threshold kicks in when the gap is at least `levelsBelow`, and the largest matching threshold wins. Prevents trivial trash farming and flat-reward quest ladders from running away with progression."
      >
        <DiminishingReturnsEditor
          value={p.xp.diminishing}
          onChange={(next) => patchProg({ xp: { ...p.xp, diminishing: next } })}
        />
      </Section>

      <Section
        title="Level-Up Rewards"
        description="What players gain each time they level up. HP and Mana per level stack with the values defined in the class designer, while the base values set the starting pool at level 1."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="HP / Level" hint="Global HP gained per level, added on top of class-specific HP/level. Set to 0 if classes should fully control HP growth.">
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
          <FieldRow label="Mana / Level" hint="Global Mana gained per level. Combined with class-specific mana/level. Melee classes may not benefit from this.">
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
          <FieldRow label="Base HP" hint="Every character starts with this much HP at level 1, before class and stat bonuses. 10-20 is typical for a low-power start.">
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
          <FieldRow label="Base Mana" hint="Starting mana pool at level 1. Set higher if you want new players to cast several spells before running dry. 0 for mana-less systems.">
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

function DiminishingReturnsEditor({
  value,
  onChange,
}: {
  value: DiminishingXpConfig | undefined;
  onChange: (next: DiminishingXpConfig | undefined) => void;
}) {
  const enabled = !!value?.enabled;
  const thresholds = value?.thresholds ?? [];

  const setEnabled = (on: boolean) => {
    if (!on && thresholds.length === 0) {
      onChange(undefined);
    } else {
      onChange({ enabled: on, thresholds });
    }
  };

  const patchThresholds = (next: DiminishingXpThreshold[]) => {
    onChange({ enabled, thresholds: next });
  };

  const addThreshold = () => {
    const last = thresholds[thresholds.length - 1];
    const nextLevels = last ? last.levelsBelow + 5 : 5;
    const nextMultiplier = last ? Math.max(0, last.multiplier / 2) : 0.5;
    patchThresholds([
      ...thresholds,
      { levelsBelow: nextLevels, multiplier: Number(nextMultiplier.toFixed(2)) },
    ]);
  };

  const updateThreshold = (index: number, patch: Partial<DiminishingXpThreshold>) => {
    patchThresholds(
      thresholds.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
  };

  const removeThreshold = (index: number) => {
    patchThresholds(thresholds.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <CheckboxInput
        checked={enabled}
        onCommit={setEnabled}
        label="Enable diminishing returns"
      />
      {enabled && (
        <div className="flex flex-col gap-1.5">
          {thresholds.length === 0 ? (
            <p className="text-2xs text-text-muted">
              No thresholds yet. Add one below — e.g. <code>levelsBelow: 5, multiplier: 0.5</code> halves XP once the player is 5+ levels over the mob.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {thresholds.map((threshold, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded border border-border-muted bg-bg-tertiary/35 px-2 py-1.5"
                >
                  <label className="flex min-w-0 flex-1 items-center gap-1.5 text-2xs text-text-muted">
                    <span className="shrink-0">Levels below</span>
                    <NumberInput
                      value={threshold.levelsBelow}
                      onCommit={(v) => updateThreshold(i, { levelsBelow: v ?? 0 })}
                      min={0}
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 items-center gap-1.5 text-2xs text-text-muted">
                    <span className="shrink-0">Multiplier</span>
                    <NumberInput
                      value={threshold.multiplier}
                      onCommit={(v) => updateThreshold(i, { multiplier: v ?? 1 })}
                      min={0}
                      step={0.05}
                    />
                  </label>
                  <IconButton
                    onClick={() => removeThreshold(i)}
                    title="Remove threshold"
                    aria-label="Remove threshold"
                    size="sm"
                    danger
                  >
                    ×
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={addThreshold}
            className="self-start rounded border border-accent/30 px-2 py-1 text-2xs text-accent transition-colors hover:bg-accent/10"
          >
            + Add threshold
          </button>
        </div>
      )}
    </div>
  );
}
