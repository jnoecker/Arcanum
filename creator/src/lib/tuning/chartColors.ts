// ─── Chart Color Constants ─────────────────────────────────────────
//
// Hex values sourced from the Arcanum design system (index.css).
// Used by Recharts SVG rendering in visualization components.

export const CHART_COLORS = {
  currentSeries: "#aebada",   // text-text-secondary -- muted current config
  presetSeries: "#c8a46a",    // warm aurum-gold -- preset visually dominates
  grid: "#39455f",            // border-muted
  axisText: "#95a0bf",        // text-muted
  axisLine: "#56617d",        // border-default
  barHp: "#c05060",           // chart-hp
  barDamage: "#dbb8b8",       // status-error warm red
  barArmor: "#8caec9",        // stellar-blue
  barXp: "#a3c48e",           // status-success green
} as const;
