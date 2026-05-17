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
      <Section
        title="Timing"
        description="Controls the pace of combat. Each tick, the server processes one round of attacks for all active fights. Shorter ticks feel faster and more action-oriented; longer ticks give players more time to react and use abilities."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Tick (ms)" hint="Milliseconds between combat rounds. 2000ms (2s) is a classic MUD pace. Try 1500 for faster action or 3000 for a more strategic feel.">
            <NumberInput
              value={c.tickMillis}
              onCommit={(v) => patch({ tickMillis: v ?? 2000 })}
              min={100}
            />
          </FieldRow>
          <FieldRow label="Max / Tick" hint="Maximum simultaneous combats processed per tick. Higher values support more concurrent fights but increase server load. 20 is comfortable for most MUDs.">
            <NumberInput
              value={c.maxCombatsPerTick}
              onCommit={(v) => patch({ maxCombatsPerTick: v ?? 20 })}
              min={1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Feedback"
        description="Combat feedback shows damage numbers and hit/miss messages to players. Room broadcast lets bystanders see fights happening around them, adding immersion."
      >
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
