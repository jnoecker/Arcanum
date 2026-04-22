// ─── Preset Card ────────────────────────────────────────────────────
// Themed card for a tuning preset with selection glow and metric indicators.

import type { TuningPreset } from "@/lib/tuning/presets";
import type { ArchetypeEvaluation } from "@/lib/tuning/archetypeScore";
import type { MetricSnapshot } from "@/lib/tuning/types";

interface PresetCardProps {
  preset: TuningPreset;
  metrics: MetricSnapshot;
  evaluation: ArchetypeEvaluation | null;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
}

const PRESET_ACCENTS: Record<string, { border: string; glow: string; text: string; bg: string }> = {
  casual: {
    border: "border-warm",
    glow: "shadow-[0_0_20px_rgb(var(--accent-rgb)/0.35)]",
    text: "text-warm",
    bg: "bg-warm/[0.14]",
  },
  balanced: {
    border: "border-stellar-blue",
    glow: "shadow-[0_0_20px_rgba(47,147,161,0.35)]",
    text: "text-stellar-blue",
    bg: "bg-stellar-blue/[0.14]",
  },
  hardcore: {
    border: "border-status-error",
    glow: "shadow-[0_0_20px_rgba(219,184,184,0.35)]",
    text: "text-status-error",
    bg: "bg-status-error/[0.14]",
  },
  soloStory: {
    border: "border-status-success",
    glow: "shadow-[0_0_20px_rgba(152,195,121,0.35)]",
    text: "text-status-success",
    bg: "bg-status-success/[0.14]",
  },
  pvpArena: {
    border: "border-status-warning",
    glow: "shadow-[0_0_20px_rgba(229,192,123,0.35)]",
    text: "text-status-warning",
    bg: "bg-status-warning/[0.14]",
  },
  loreExplorer: {
    border: "border-accent",
    glow: "shadow-[0_0_20px_rgb(var(--accent-rgb)/0.35)]",
    text: "text-accent",
    bg: "bg-accent/[0.14]",
  },
};

const DEFAULT_ACCENT = {
  border: "border-border-muted",
  glow: "",
  text: "text-text-muted",
  bg: "bg-bg-secondary",
};

const CONTRACT_STYLES = {
  validated: {
    badge: "border-status-success/35 bg-status-success/[0.08] text-status-success",
    label: "Validated",
  },
  close: {
    badge: "border-status-warning/35 bg-status-warning/[0.08] text-status-warning",
    label: "Close To Target",
  },
  "needs-tuning": {
    badge: "border-status-error/35 bg-status-error/[0.08] text-status-error",
    label: "Needs Tuning",
  },
} as const;

/** Format a number with K/M suffix. */
function abbreviate(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** Build 4 human-readable metric rows from a MetricSnapshot + preset config. */
function buildIndicators(
  preset: TuningPreset,
  metrics: MetricSnapshot,
): { label: string; value: string }[] {
  const indicators: { label: string; value: string }[] = [];

  // XP Curve -- XP to reach level 20
  const xp20 = metrics.xpPerLevel[20];
  if (xp20 != null) {
    indicators.push({ label: "XP Curve", value: `${abbreviate(xp20)} XP to Lv20` });
  }

  // Combat -- Standard mob HP at level 10
  const stdHp10 = metrics.mobHp["standard"]?.[10];
  if (stdHp10 != null) {
    indicators.push({ label: "Combat", value: `${stdHp10} HP at Lv10` });
  }

  // Economy -- buy/sell multipliers from preset config
  const buy = preset.config.economy?.buyMultiplier;
  const sell = preset.config.economy?.sellMultiplier;
  if (buy != null && sell != null) {
    indicators.push({ label: "Economy", value: `${buy}x buy / ${sell}x sell` });
  }

  // Mob Difficulty -- Boss avg damage at level 10
  const bossDmg10 = metrics.mobDamageAvg["boss"]?.[10];
  if (bossDmg10 != null) {
    indicators.push({ label: "Mob Difficulty", value: `Avg ${Math.round(bossDmg10)} boss dmg Lv10` });
  }

  return indicators;
}

export function PresetCard({
  preset,
  metrics,
  evaluation,
  isSelected,
  isDimmed,
  onSelect,
}: PresetCardProps) {
  const accent = PRESET_ACCENTS[preset.id] ?? DEFAULT_ACCENT;
  const contractStyle = evaluation ? CONTRACT_STYLES[evaluation.status] : null;

  const borderClass = isSelected ? accent.border : "border-border-muted";
  const glowClass = isSelected ? accent.glow : "";
  const dimClass = isDimmed ? "opacity-[0.65]" : "";

  const indicators = buildIndicators(preset, metrics);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${preset.name} preset${isSelected ? ", selected" : ""}`}
      className={[
        "focus-ring panel-surface relative w-full overflow-hidden rounded-[1.75rem] p-6 text-left",
        "min-h-[16rem] cursor-pointer",
        "transition-[color,background-color,border-color,box-shadow,opacity] duration-200 hover:bg-bg-hover",
        borderClass,
        glowClass,
        dimClass,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent opacity-70" />
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className={`font-display text-2xs uppercase tracking-wide-ui ${accent.text}`}>
            Arcanum archetype
          </p>
          {contractStyle && (
            <span
              className={`rounded-full border px-2 py-0.5 font-display text-2xs uppercase tracking-wide-ui ${contractStyle.badge}`}
            >
              {contractStyle.label}
            </span>
          )}
        </div>
        {/* Preset name */}
        <h3 className="font-display text-lg font-semibold leading-[1.2] tracking-[0.5px] text-text-primary">
          {preset.name}
        </h3>

        {/* Description */}
        <p className="text-[15px] leading-[1.6] text-text-secondary line-clamp-2">
          {preset.description}
        </p>
        {evaluation && (
          <p className="text-2xs leading-[1.5] text-text-muted">
            Contract score {evaluation.score}/100 · {evaluation.passCount} pass · {evaluation.warnCount} warn · {evaluation.failCount} fail
          </p>
        )}

        {/* Metric indicators */}
        <div className="flex flex-col gap-2">
          {indicators.map((ind) => (
            <div key={ind.label} className="flex items-center justify-between gap-2">
              <span className="text-sm text-text-muted">{ind.label}</span>
              <span
                className={`${accent.bg} ${accent.text} rounded-full px-2 py-0.5 font-mono text-sm`}
              >
                {ind.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
