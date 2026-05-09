// ─── XP Curve Line Chart ────────────────────────────────────────────
// Recharts LineChart comparing XP-per-level for current vs preset
// across levels 1-50. Preset line uses warm aurum-gold, current uses
// muted secondary tone.

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { XpCurvePoint } from "@/lib/tuning/chartData";
import { CHART_COLORS } from "@/lib/tuning/chartColors";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

interface XpCurveChartProps {
  data: XpCurvePoint[];
  /** When true, use lighter card chrome — parent owns the heavy frame. */
  nested?: boolean;
}

const TICK_STYLE = {
  fill: CHART_COLORS.axisText,
  fontSize: 12,
  fontFamily: "'Crimson Pro', Georgia, serif",
};

function formatLargeNumber(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
}

export function XpCurveChart({ data, nested = false }: XpCurveChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const cardClass = nested
    ? "rounded-[1.25rem] border border-border-muted bg-bg-secondary/30 p-4"
    : "panel-surface rounded-[1.5rem] p-4";

  return (
    <div className={cardClass}>
      <h3 className="mb-2 font-display text-sm font-normal uppercase tracking-label text-text-secondary">
        XP CURVE
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="level"
            tick={TICK_STYLE}
            stroke={CHART_COLORS.axisLine}
          />
          <YAxis
            tick={TICK_STYLE}
            stroke={CHART_COLORS.axisLine}
            tickFormatter={formatLargeNumber}
          />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="current"
            name="Current"
            stroke={CHART_COLORS.currentSeries}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!prefersReducedMotion}
            animationDuration={300}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="preset"
            name="Preset"
            stroke={CHART_COLORS.presetSeries}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!prefersReducedMotion}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
