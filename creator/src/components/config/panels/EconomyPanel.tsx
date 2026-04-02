import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function EconomyPanel({ config, onChange }: ConfigPanelProps) {
  const e = config.economy;
  const patch = (p: Partial<AppConfig["economy"]>) =>
    onChange({ economy: { ...e, ...p } });

  const b = config.bank;
  const patchBank = (p: Partial<AppConfig["bank"]>) =>
    onChange({ bank: { ...b, ...p } });

  return (
    <>
      <Section
        title="Multipliers"
        description="Shop price multipliers control the gold economy. The buy multiplier scales the cost of purchasing items, while the sell multiplier determines how much players get back. A sell multiplier below the buy multiplier creates a gold sink that prevents inflation."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Buy Multiplier" hint="Multiplied against an item's base price when purchasing from shops. 1.0 = full price. Values above 1.0 make items more expensive, creating a tighter economy.">
            <NumberInput
              value={e.buyMultiplier}
              onCommit={(v) => patch({ buyMultiplier: v ?? 1.0 })}
              min={0}
              step={0.1}
            />
          </FieldRow>
          <FieldRow label="Sell Multiplier" hint="Multiplied against an item's base price when selling to shops. 0.5 = half price (classic MUD default). Lower values are a stronger gold sink. Set to 0 to disable selling entirely.">
            <NumberInput
              value={e.sellMultiplier}
              onCommit={(v) => patch({ sellMultiplier: v ?? 0.5 })}
              min={0}
              step={0.1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Bank"
        description="Players can deposit gold and items in bank rooms. Banked items persist across sessions."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Vault Items" hint="Maximum number of items a player can store in the bank. Gold has no limit.">
            <NumberInput
              value={b.maxItems}
              onCommit={(v) => patchBank({ maxItems: v ?? 50 })}
              min={1}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
