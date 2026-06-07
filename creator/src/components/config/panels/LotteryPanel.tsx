import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, CheckboxInput } from "@/components/ui/FormWidgets";

export function LotteryPanel({ config, onChange }: ConfigPanelProps) {
  const lottery = config.lottery ?? { enabled: false, ticketCost: 100, drawingIntervalMs: 86400000, jackpotSeedGold: 10000, jackpotPercentFromTickets: 80, maxTicketsPerPlayer: 10 };
  const patch = (p: Partial<typeof lottery>) =>
    onChange({ lottery: { ...lottery, ...p } } as Partial<AppConfig>);

  return (
    <Section title="Lottery">
      <div className="flex flex-col gap-3">
        <CheckboxInput label="Enabled" checked={lottery.enabled} onCommit={(v) => patch({ enabled: v })} />
        <FieldRow label="Ticket Cost (gold)">
          <NumberInput value={lottery.ticketCost} onCommit={(v) => patch({ ticketCost: v ?? 100 })} />
        </FieldRow>
        <FieldRow label="Drawing Interval (ms)">
          <NumberInput value={lottery.drawingIntervalMs} onCommit={(v) => patch({ drawingIntervalMs: v ?? 86400000 })} />
        </FieldRow>
        <FieldRow label="Jackpot Seed (gold)">
          <NumberInput value={lottery.jackpotSeedGold} onCommit={(v) => patch({ jackpotSeedGold: v ?? 10000 })} />
        </FieldRow>
        <FieldRow label="Jackpot % from tickets" hint="Share of each ticket sale added to the jackpot (0–100)">
          <NumberInput value={lottery.jackpotPercentFromTickets} onCommit={(v) => patch({ jackpotPercentFromTickets: v ?? 80 })} />
        </FieldRow>
        <FieldRow label="Max tickets per player">
          <NumberInput value={lottery.maxTicketsPerPlayer} onCommit={(v) => patch({ maxTicketsPerPlayer: v ?? 10 })} />
        </FieldRow>
      </div>
    </Section>
  );
}
