import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, CheckboxInput } from "@/components/ui/FormWidgets";

export function GamblingPanel({ config, onChange }: ConfigPanelProps) {
  const gambling = config.gambling ?? { enabled: false, minBet: 10, maxBet: 1000, winChance: 0.45, winMultiplier: 2.0 };
  const patch = (p: Partial<typeof gambling>) =>
    onChange({ gambling: { ...gambling, ...p } } as Partial<AppConfig>);

  return (
    <Section title="Dice Gambling">
      <div className="flex flex-col gap-3">
        <CheckboxInput label="Enabled" checked={gambling.enabled} onCommit={(v) => patch({ enabled: v })} />
        <FieldRow label="Min Bet (gold)">
          <NumberInput value={gambling.minBet} onCommit={(v) => patch({ minBet: v ?? 10 })} />
        </FieldRow>
        <FieldRow label="Max Bet (gold)">
          <NumberInput value={gambling.maxBet} onCommit={(v) => patch({ maxBet: v ?? 1000 })} />
        </FieldRow>
        <FieldRow label="Win Chance" hint="0.0 to 1.0">
          <NumberInput value={gambling.winChance} onCommit={(v) => patch({ winChance: v ?? 0.45 })} />
        </FieldRow>
        <FieldRow label="Win Multiplier">
          <NumberInput value={gambling.winMultiplier} onCommit={(v) => patch({ winMultiplier: v ?? 2.0 })} />
        </FieldRow>
      </div>
    </Section>
  );
}
