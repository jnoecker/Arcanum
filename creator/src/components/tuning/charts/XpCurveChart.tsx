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

interface XpCurveChartProps {
  data: XpCurvePoint[];
}

const TICK_STYLE = {
  fill: CHART_COLORS.axisText,
  fontSize: 12,
  fontFamily: "'Crimson Pro', Georgia, serif",
};

function formatLargeNumber(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
}

export function XpCurveChart({ data }: XpCurveChartProps) {
  return (
    <div className="rounded-lg border border-border-muted bg-bg-tertiary p-4">
      <h3 className="mb-2 font-display text-[14px] font-normal uppercase tracking-[0.5px] text-text-secondary">
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
            isAnimationActive={true}
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
            isAnimationActive={true}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
