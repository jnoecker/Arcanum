// ─── Chart Color Constants ─────────────────────────────────────────
//
// Hex values sourced from the Arcanum design system (index.css).
// Used by Recharts SVG rendering in visualization components.

export const CHART_COLORS = {
  currentSeries: "var(--color-text-secondary)",
  presetSeries: "var(--color-accent)",
  grid: "var(--color-border-muted)",
  axisText: "var(--color-text-muted)",
  axisLine: "var(--color-border-default)",
  barHp: "var(--color-chart-hp)",
  barDamage: "var(--color-diff-del-text)",
  barArmor: "var(--color-stellar-blue)",
  barXp: "var(--color-status-success)",
} as const;
