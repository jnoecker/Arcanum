import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function RegenPanel({ config, onChange }: ConfigPanelProps) {
  const r = config.regen;
  const patch = (p: Partial<AppConfig["regen"]>) =>
    onChange({ regen: { ...r, ...p } });

  return (
    <>
      <Section
        title="HP Regen"
        description="Controls how quickly players recover HP outside of combat. The HP regen stat binding can shorten this interval down to the minimum value, so faster regeneration means less downtime between fights."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max / Tick" hint="Maximum players processed per regen tick. Higher values ensure all players regen simultaneously, but cost more CPU. 50 is fine for most servers.">
            <NumberInput
              value={r.maxPlayersPerTick}
              onCommit={(v) => patch({ maxPlayersPerTick: v ?? 50 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="Base Interval" hint="Milliseconds between regen ticks with no stat bonus. 5000ms (5s) means a player heals every 5 seconds at minimum. Lower = faster recovery.">
            <NumberInput
              value={r.baseIntervalMillis}
              onCommit={(v) => patch({ baseIntervalMillis: v ?? 5000 })}
              min={100}
            />
          </FieldRow>
          <FieldRow label="Min Interval" hint="Fastest possible regen rate even with maximum stat investment. Prevents regen from becoming instant. 1000ms (1s) is a reasonable floor.">
            <NumberInput
              value={r.minIntervalMillis}
              onCommit={(v) => patch({ minIntervalMillis: v ?? 1000 })}
              min={100}
            />
          </FieldRow>
          <FieldRow label="Regen Amount" hint="HP restored per tick. 1 is slow and steady; higher values create burst healing between fights. Scale with your HP pools.">
            <NumberInput
              value={r.regenAmount}
              onCommit={(v) => patch({ regenAmount: v ?? 1 })}
              min={1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Mana Regen"
        description="How quickly mana recovers. Mana regen is separate from HP regen and is reduced by the Mana Regen Stat binding. Faster mana regen lets casters use abilities more freely; slower regen makes mana a strategic resource."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Base Interval" hint="Milliseconds between mana regen ticks at base. 3000ms (3s) is faster than HP regen by default, reflecting mana as a more fluid resource.">
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
          <FieldRow label="Min Interval" hint="Fastest possible mana regen rate. Same principle as HP min interval — prevents regen from trivializing mana costs.">
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
          <FieldRow label="Regen Amount" hint="Mana restored per tick. Higher values let casters recover faster between encounters. Balance against ability mana costs.">
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
