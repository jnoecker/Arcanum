import type { ConfigPanelProps, AppConfig } from "./types";
import {
  Section,
  FieldRow,
  NumberInput,
  CheckboxInput,
} from "@/components/ui/FormWidgets";

export function CombatPanel({ config, onChange }: ConfigPanelProps) {
  const c = config.combat;
  const patch = (p: Partial<AppConfig["combat"]>) =>
    onChange({ combat: { ...c, ...p } });

  return (
    <>
      <Section title="Timing">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Tick (ms)">
            <NumberInput
              value={c.tickMillis}
              onCommit={(v) => patch({ tickMillis: v ?? 2000 })}
              min={100}
            />
          </FieldRow>
          <FieldRow label="Max / Tick">
            <NumberInput
              value={c.maxCombatsPerTick}
              onCommit={(v) => patch({ maxCombatsPerTick: v ?? 20 })}
              min={1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Base Damage">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Min Damage">
            <NumberInput
              value={c.minDamage}
              onCommit={(v) => patch({ minDamage: v ?? 1 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Max Damage">
            <NumberInput
              value={c.maxDamage}
              onCommit={(v) => patch({ maxDamage: v ?? 4 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Feedback">
        <div className="flex flex-col gap-1.5">
          <CheckboxInput
            checked={c.feedback.enabled}
            onCommit={(v) =>
              patch({ feedback: { ...c.feedback, enabled: v } })
            }
            label="Enable combat feedback"
          />
          <CheckboxInput
            checked={c.feedback.roomBroadcastEnabled}
            onCommit={(v) =>
              patch({
                feedback: { ...c.feedback, roomBroadcastEnabled: v },
              })
            }
            label="Broadcast to room"
          />
        </div>
      </Section>
    </>
  );
}
