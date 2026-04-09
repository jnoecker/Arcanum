// ─── Chart Color Constants ─────────────────────────────────────────
//
// Hex values sourced from the Arcanum design system (index.css).
// Used by Recharts SVG rendering in visualization components.

export const CHART_COLORS = {
  currentSeries: "#dccbb3",   // text-text-secondary -- muted current config
  presetSeries: "#ff7d00",    // ember orange -- preset visually dominates
  grid: "#174852",            // border-muted
  axisText: "#ad9d88",        // text-muted
  axisLine: "#2e7680",        // border-default
  barHp: "#d9756b",           // chart-hp
  barDamage: "#e08a73",       // status-error warm red
  barArmor: "#2f93a1",        // stellar-blue
  barXp: "#7cb66d",           // status-success green
} as const;
