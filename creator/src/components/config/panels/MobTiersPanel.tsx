import type { MobTierConfig } from "@/types/config";
import type { ConfigPanelProps } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

const TIER_NAMES = ["weak", "standard", "elite", "boss"] as const;

const TIER_DESCRIPTIONS: Record<(typeof TIER_NAMES)[number], string> = {
  weak: "Fodder mobs meant to be dispatched quickly. Good for new players learning combat and for populating areas with ambient danger. Typically killed in 2-3 hits.",
  standard: "Bread-and-butter enemies that provide a fair fight for on-level players. Most mobs in the world should be this tier. Expect fights lasting 4-8 rounds.",
  elite: "Dangerous foes that require preparation or a group. Use sparingly as mini-bosses, rare spawns, or guardians. Deal significant damage and reward proportionally more XP and gold.",
  boss: "Zone bosses and storyline antagonists. Designed for group content or high-level solo players. High HP pools create extended encounters. Generous gold and XP rewards make them worth seeking out.",
};

const TIER_FIELDS: { key: keyof MobTierConfig; label: string; hint?: string; step?: number }[] = [
  { key: "baseHp", label: "Base HP", hint: "Starting HP at level 1. Higher values mean longer fights." },
  { key: "hpScalingRate", label: "HP Scaling Rate", hint: "Per-level multiplicative growth (e.g. 1.1 = ~10%/level, ~15x over 30 levels).", step: 0.005 },
  { key: "baseMinDamage", label: "Min Damage", hint: "Minimum damage per hit at level 1." },
  { key: "baseMaxDamage", label: "Max Damage", hint: "Maximum damage per hit at level 1." },
  { key: "damageScalingRate", label: "Damage Scaling Rate", hint: "Per-level multiplicative growth applied to both min and max damage.", step: 0.005 },
  { key: "baseArmor", label: "Armor", hint: "Flat damage reduction. High armor makes mobs feel 'tanky' against weak attacks." },
  { key: "baseXpReward", label: "Base XP", hint: "XP granted at level 1. Balance against the XP curve in Progression to control leveling speed." },
  { key: "xpScalingRate", label: "XP Scaling Rate", hint: "Per-level multiplicative growth applied to base kill XP.", step: 0.005 },
  { key: "baseGoldMin", label: "Gold Min", hint: "Minimum gold dropped at level 1." },
  { key: "baseGoldMax", label: "Gold Max", hint: "Maximum gold dropped at level 1. The min/max range adds loot variance." },
  { key: "goldScalingRate", label: "Gold Scaling Rate", hint: "Per-level multiplicative growth applied to gold drops.", step: 0.005 },
];

export function MobTiersPanel({ config, onChange }: ConfigPanelProps) {
  const patchTier = (tier: (typeof TIER_NAMES)[number], p: Partial<MobTierConfig>) =>
    onChange({
      mobTiers: {
        ...config.mobTiers,
        [tier]: { ...config.mobTiers[tier], ...p },
      },
    });

  return (
    <>
      <Section
        title="Action Delay"
        description="How often mobs take autonomous actions (attacking, using abilities, wandering). Shorter delays make mobs feel more aggressive; longer delays give players breathing room between attacks."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Min Delay (ms)" hint="Fastest a mob can act. 8000ms (8s) prevents mobs from overwhelming players. Lower values create frantic combat.">
            <NumberInput
              value={config.mobActionDelay.minActionDelayMillis}
              onCommit={(v) =>
                onChange({
                  mobActionDelay: {
                    ...config.mobActionDelay,
                    minActionDelayMillis: v ?? 8000,
                  },
                })
              }
              min={0}
            />
          </FieldRow>
          <FieldRow label="Max Delay (ms)" hint="Slowest a mob can act. The actual delay is random between min and max. 20000ms (20s) keeps mobs from feeling idle.">
            <NumberInput
              value={config.mobActionDelay.maxActionDelayMillis}
              onCommit={(v) =>
                onChange({
                  mobActionDelay: {
                    ...config.mobActionDelay,
                    maxActionDelayMillis: v ?? 20000,
                  },
                })
              }
              min={0}
            />
          </FieldRow>
        </div>
      </Section>
      {TIER_NAMES.map((tier) => (
        <Section
          key={tier}
          title={tier.charAt(0).toUpperCase() + tier.slice(1)}
          description={TIER_DESCRIPTIONS[tier]}
        >
          <div className="flex flex-col gap-1.5">
            {TIER_FIELDS.map((field) => {
              const isRate = field.key.endsWith("ScalingRate");
              return (
                <FieldRow key={field.key} label={field.label} hint={field.hint}>
                  <NumberInput
                    value={config.mobTiers[tier][field.key]}
                    onCommit={(v) =>
                      patchTier(tier, { [field.key]: v ?? (isRate ? 1.1 : 0) })
                    }
                    min={isRate ? 1.0 : 0}
                    max={isRate ? 2.0 : undefined}
                    step={field.step}
                  />
                </FieldRow>
              );
            })}
          </div>
        </Section>
      ))}
    </>
  );
}
