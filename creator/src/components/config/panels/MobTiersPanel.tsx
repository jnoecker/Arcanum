import type { MobTierConfig } from "@/types/config";
import type { ConfigPanelProps } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

const TIER_NAMES = ["weak", "standard", "elite", "boss"] as const;

const TIER_FIELDS: { key: keyof MobTierConfig; label: string }[] = [
  { key: "baseHp", label: "Base HP" },
  { key: "hpPerLevel", label: "HP / Level" },
  { key: "baseMinDamage", label: "Min Damage" },
  { key: "baseMaxDamage", label: "Max Damage" },
  { key: "damagePerLevel", label: "Dmg / Level" },
  { key: "baseArmor", label: "Armor" },
  { key: "baseXpReward", label: "Base XP" },
  { key: "xpRewardPerLevel", label: "XP / Level" },
  { key: "baseGoldMin", label: "Gold Min" },
  { key: "baseGoldMax", label: "Gold Max" },
  { key: "goldPerLevel", label: "Gold / Level" },
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
      {TIER_NAMES.map((tier) => (
        <Section key={tier} title={tier.charAt(0).toUpperCase() + tier.slice(1)}>
          <div className="flex flex-col gap-1.5">
            {TIER_FIELDS.map((field) => (
              <FieldRow key={field.key} label={field.label}>
                <NumberInput
                  value={config.mobTiers[tier][field.key]}
                  onCommit={(v) =>
                    patchTier(tier, { [field.key]: v ?? 0 })
                  }
                  min={0}
                />
              </FieldRow>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
