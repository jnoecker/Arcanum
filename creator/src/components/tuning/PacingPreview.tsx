// ─── Pacing Preview ─────────────────────────────────────────────────
// Shows estimated time-to-level under a canonical trash-clearing
// scenario, compared against the selected preset's pacing targets.
// Surfaces over/under-tuning before the user clicks Apply.

import { useMemo } from "react";
import type { AppConfig } from "@/types/config";
import { estimatePacing } from "@/lib/tuning/pacing";
import type { PacingMilestone, PacingVerdict } from "@/lib/tuning/pacing";

interface PacingPreviewProps {
  presetConfig: AppConfig;
  presetId: string;
}

const VERDICT_STYLES: Record<PacingVerdict, { dot: string; text: string; label: string }> = {
  "way-too-fast": {
    dot: "bg-status-error",
    text: "text-status-error",
    label: "Way too fast",
  },
  fast: {
    dot: "bg-status-warning",
    text: "text-status-warning",
    label: "Too fast",
  },
  "on-target": {
    dot: "bg-status-success",
    text: "text-status-success",
    label: "On target",
  },
  slow: {
    dot: "bg-status-warning",
    text: "text-status-warning",
    label: "Too slow",
  },
  "way-too-slow": {
    dot: "bg-status-error",
    text: "text-status-error",
    label: "Way too slow",
  },
};

function fmtMinutes(min: number): string {
  if (!Number.isFinite(min)) return "∞";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function worstVerdict(milestones: PacingMilestone[]): PacingVerdict {
  const order: PacingVerdict[] = [
    "way-too-fast",
    "way-too-slow",
    "fast",
    "slow",
    "on-target",
  ];
  for (const v of order) {
    if (milestones.some((m) => m.verdict === v)) return v;
  }
  return "on-target";
}

export function PacingPreview({ presetConfig, presetId }: PacingPreviewProps) {
  const pacing = useMemo(
    () => estimatePacing(presetConfig, presetId),
    [presetConfig, presetId],
  );

  if (!pacing.targetsPresetId || pacing.milestones.length === 0) return null;

  const headline = worstVerdict(pacing.milestones);
  const headlineStyle = VERDICT_STYLES[headline];

  return (
    <section
      aria-label="Estimated leveling pace"
      className="panel-surface mx-auto mt-6 w-full max-w-6xl rounded-[1.75rem] border border-border-muted px-6 py-5"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
            Estimated pacing
          </p>
          <h3 className="mt-1 font-display text-base font-semibold text-text-primary">
            Time to level under canonical trash run
          </h3>
          <p className="mt-1 text-2xs text-text-muted">
            120 kills/hr, mostly weak mobs. Compares against this preset's intent.
          </p>
        </div>
        <div className={`flex items-center gap-2 ${headlineStyle.text}`}>
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${headlineStyle.dot}`} />
          <span className="font-display text-2xs uppercase tracking-wide-ui">
            {headlineStyle.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {pacing.milestones.map((m) => {
          const style = VERDICT_STYLES[m.verdict];
          return (
            <div
              key={m.level}
              className="rounded-[1rem] border border-border-muted bg-bg-secondary/40 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
                  Lv {m.level}
                </span>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              </div>
              <p className={`mt-1 font-mono text-sm ${style.text}`}>
                {fmtMinutes(m.minutesEstimated)}
              </p>
              {m.minutesTarget != null && (
                <p className="text-2xs text-text-muted">
                  target ~{fmtMinutes(m.minutesTarget)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
