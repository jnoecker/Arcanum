import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, CheckboxInput } from "@/components/ui/FormWidgets";

export function GamblingPanel({ config, onChange }: ConfigPanelProps) {
  const gambling = config.gambling ?? { enabled: false, diceMinBet: 10, diceMaxBet: 1000, diceWinChance: 0.45, diceWinMultiplier: 2, cooldownMs: 5000 };
  const patch = (p: Partial<typeof gambling>) =>
    onChange({ gambling: { ...gambling, ...p } } as Partial<AppConfig>);

  return (
    <Section title="Dice Gambling">
      <div className="flex flex-col gap-3">
        <CheckboxInput label="Enabled" checked={gambling.enabled} onCommit={(v) => patch({ enabled: v })} />
        <FieldRow label="Min Bet (gold)">
          <NumberInput value={gambling.diceMinBet} onCommit={(v) => patch({ diceMinBet: v ?? 10 })} />
        </FieldRow>
        <FieldRow label="Max Bet (gold)">
          <NumberInput value={gambling.diceMaxBet} onCommit={(v) => patch({ diceMaxBet: v ?? 1000 })} />
        </FieldRow>
        <FieldRow label="Win Chance" hint="Probability of a win (0.0–1.0)">
          <NumberInput value={gambling.diceWinChance} onCommit={(v) => patch({ diceWinChance: v ?? 0.45 })} />
        </FieldRow>
        <FieldRow label="Win Multiplier" hint="Payout as a multiple of the bet">
          <NumberInput value={gambling.diceWinMultiplier} onCommit={(v) => patch({ diceWinMultiplier: v ?? 2 })} />
        </FieldRow>
        <FieldRow label="Cooldown (ms)" hint="Minimum delay between rolls">
          <NumberInput value={gambling.cooldownMs} onCommit={(v) => patch({ cooldownMs: v ?? 5000 })} />
        </FieldRow>
      </div>
    </Section>
  );
}
