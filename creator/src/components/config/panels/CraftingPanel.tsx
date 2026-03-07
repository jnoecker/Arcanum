import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function CraftingPanel({ config, onChange }: ConfigPanelProps) {
  const c = config.crafting;
  const patch = (p: Partial<AppConfig["crafting"]>) =>
    onChange({ crafting: { ...c, ...p } });

  return (
    <>
      <Section title="Skill Progression">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Skill Level">
            <NumberInput
              value={c.maxSkillLevel}
              onCommit={(v) => patch({ maxSkillLevel: v ?? 100 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="Base XP / Level">
            <NumberInput
              value={c.baseXpPerLevel}
              onCommit={(v) => patch({ baseXpPerLevel: v ?? 50 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="XP Exponent">
            <NumberInput
              value={c.xpExponent}
              onCommit={(v) => patch({ xpExponent: v ?? 1.5 })}
              min={1}
              step={0.1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Gathering">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Cooldown (ms)">
            <NumberInput
              value={c.gatherCooldownMs}
              onCommit={(v) => patch({ gatherCooldownMs: v ?? 3000 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Station Bonus">
            <NumberInput
              value={c.stationBonusQuantity}
              onCommit={(v) => patch({ stationBonusQuantity: v ?? 1 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
