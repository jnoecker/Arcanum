import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function WorldCyclePanel({ config, onChange }: ConfigPanelProps) {
  const wt = config.worldTime;
  const patchTime = (p: Partial<AppConfig["worldTime"]>) =>
    onChange({ worldTime: { ...wt, ...p } });

  const w = config.weather;
  const patchWeather = (p: Partial<AppConfig["weather"]>) =>
    onChange({ weather: { ...w, ...p } });

  return (
    <>
      <Section
        title="Day/Night Cycle"
        description="One game day cycles through dawn, day, dusk, and night. The cycle length controls how long a full day takes in real time."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Cycle Length (ms)" hint="Real-time milliseconds for one full game day. 3600000 = 1 hour.">
            <NumberInput
              value={wt.cycleLengthMs}
              onCommit={(v) => patchTime({ cycleLengthMs: v ?? 3600000 })}
              min={1000}
            />
          </FieldRow>
          <FieldRow label="Dawn Hour" hint="Game hour when dawn begins (0-23).">
            <NumberInput
              value={wt.dawnHour}
              onCommit={(v) => patchTime({ dawnHour: v ?? 5 })}
              min={0}
              max={23}
            />
          </FieldRow>
          <FieldRow label="Day Hour" hint="Game hour when day begins.">
            <NumberInput
              value={wt.dayHour}
              onCommit={(v) => patchTime({ dayHour: v ?? 8 })}
              min={0}
              max={23}
            />
          </FieldRow>
          <FieldRow label="Dusk Hour" hint="Game hour when dusk begins.">
            <NumberInput
              value={wt.duskHour}
              onCommit={(v) => patchTime({ duskHour: v ?? 18 })}
              min={0}
              max={23}
            />
          </FieldRow>
          <FieldRow label="Night Hour" hint="Game hour when night begins.">
            <NumberInput
              value={wt.nightHour}
              onCommit={(v) => patchTime({ nightHour: v ?? 21 })}
              min={0}
              max={23}
            />
          </FieldRow>
        </div>

        <div className="mt-3 rounded-lg border border-border-muted bg-bg-secondary/40 p-3">
          <p className="text-2xs font-display uppercase tracking-widest text-text-muted mb-2">Time Periods</p>
          <div className="grid grid-cols-4 gap-2 text-2xs">
            {[
              { label: "Dawn", from: wt.dawnHour, to: wt.dayHour - 1, color: "text-status-warning" },
              { label: "Day", from: wt.dayHour, to: wt.duskHour - 1, color: "text-warm-pale" },
              { label: "Dusk", from: wt.duskHour, to: wt.nightHour - 1, color: "text-warm" },
              { label: "Night", from: wt.nightHour, to: wt.dawnHour - 1, color: "text-accent-muted" },
            ].map((p) => (
              <div key={p.label} className="text-center">
                <span className={`font-display ${p.color}`}>{p.label}</span>
                <div className="text-text-muted">{String(p.from).padStart(2, "0")}:00–{String(((p.to % 24) + 24) % 24).padStart(2, "0")}:59</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Weather"
        description="Weather transitions happen per-zone at random intervals within these bounds. Weather types (clear, rain, storm, fog, snow, wind) are weighted random on the server."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Min Transition (ms)" hint="Minimum real-time milliseconds between weather changes.">
            <NumberInput
              value={w.minTransitionMs}
              onCommit={(v) => patchWeather({ minTransitionMs: v ?? 300000 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Max Transition (ms)" hint="Maximum real-time milliseconds between weather changes.">
            <NumberInput
              value={w.maxTransitionMs}
              onCommit={(v) => patchWeather({ maxTransitionMs: v ?? 900000 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
