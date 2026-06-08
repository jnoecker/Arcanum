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
          <FieldRow label="Regen Percent" hint="Fraction of max HP restored per tick (e.g. 0.05 = 5%). Scales automatically with player level, so the same value feels right at every tier. Must be in (0, 1].">
            <NumberInput
              value={r.regenPercent}
              onCommit={(v) => patch({ regenPercent: v ?? 0.05 })}
              min={0.0001}
              max={1}
              step={0.01}
            />
          </FieldRow>
          <FieldRow label="In-Combat Multiplier" hint="Multiplier applied to regen while the player is in combat. 1.0 keeps full regen; 0.5 halves it; 0.0 disables in-combat regen entirely. Range [0, 1].">
            <NumberInput
              value={r.inCombatMultiplier}
              onCommit={(v) => patch({ inCombatMultiplier: v ?? 0.5 })}
              min={0}
              max={1}
              step={0.05}
            />
          </FieldRow>
          <FieldRow label="Inn Multiplier" hint="Multiplier applied to HP/MP regen in rooms flagged as inns. 2.0 doubles regen so resting at an inn is meaningfully faster. Must be >= 1.0.">
            <NumberInput
              value={r.innMultiplier}
              onCommit={(v) => patch({ innMultiplier: v ?? 2.0 })}
              min={1}
              step={0.5}
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
          <FieldRow label="Regen Percent" hint="Fraction of max mana restored per tick (e.g. 0.05 = 5%). Scales with the player's mana pool so casters recover at a consistent pace across levels. Must be in (0, 1].">
            <NumberInput
              value={r.mana.regenPercent}
              onCommit={(v) =>
                patch({
                  mana: { ...r.mana, regenPercent: v ?? 0.05 },
                })
              }
              min={0.0001}
              max={1}
              step={0.01}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
