import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function RegenPanel({ config, onChange }: ConfigPanelProps) {
  const r = config.regen;
  const patch = (p: Partial<AppConfig["regen"]>) =>
    onChange({ regen: { ...r, ...p } });

  return (
    <>
      <Section title="HP Regen">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max / Tick">
            <NumberInput
              value={r.maxPlayersPerTick}
              onCommit={(v) => patch({ maxPlayersPerTick: v ?? 50 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="Base Interval">
            <NumberInput
              value={r.baseIntervalMillis}
              onCommit={(v) => patch({ baseIntervalMillis: v ?? 5000 })}
              min={100}
            />
          </FieldRow>
          <FieldRow label="Min Interval">
            <NumberInput
              value={r.minIntervalMillis}
              onCommit={(v) => patch({ minIntervalMillis: v ?? 1000 })}
              min={100}
            />
          </FieldRow>
          <FieldRow label="Regen Amount">
            <NumberInput
              value={r.regenAmount}
              onCommit={(v) => patch({ regenAmount: v ?? 1 })}
              min={1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Mana Regen">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Base Interval">
            <NumberInput
              value={r.mana.baseIntervalMillis}
              onCommit={(v) =>
                patch({
                  mana: { ...r.mana, baseIntervalMillis: v ?? 3000 },
                })
              }
              min={100}
            />
          </FieldRow>
          <FieldRow label="Min Interval">
            <NumberInput
              value={r.mana.minIntervalMillis}
              onCommit={(v) =>
                patch({
                  mana: { ...r.mana, minIntervalMillis: v ?? 1000 },
                })
              }
              min={100}
            />
          </FieldRow>
          <FieldRow label="Regen Amount">
            <NumberInput
              value={r.mana.regenAmount}
              onCommit={(v) =>
                patch({
                  mana: { ...r.mana, regenAmount: v ?? 1 },
                })
              }
              min={1}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
