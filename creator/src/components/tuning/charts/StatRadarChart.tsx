// ─── Stat Profile Radar Chart ───────────────────────────────────────
// Recharts RadarChart comparing current vs preset stat scaling across
// 8 stat dimensions. Preset polygon uses higher fill opacity to
// visually dominate.

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { StatRadarPoint } from "@/lib/tuning/chartData";
import { CHART_COLORS } from "@/lib/tuning/chartColors";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

interface StatRadarChartProps {
  data: StatRadarPoint[];
}

export function StatRadarChart({ data }: StatRadarChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="panel-surface rounded-[1.5rem] p-4">
      <h3 className="mb-2 font-display text-[14px] font-normal uppercase tracking-[0.5px] text-text-secondary">
        STAT PROFILE
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke={CHART_COLORS.grid} />
          <PolarAngleAxis
            dataKey="stat"
            tick={{
              fill: CHART_COLORS.axisText,
              fontSize: 11,
              fontFamily: "'Crimson Pro', Georgia, serif",
            }}
          />
          <PolarRadiusAxis tick={false} axisLine={false} />
          <Radar
            name="Current"
            dataKey="current"
            stroke={CHART_COLORS.currentSeries}
            fill={CHART_COLORS.currentSeries}
            fillOpacity={0.15}
            strokeWidth={1.5}
            isAnimationActive={!prefersReducedMotion}
            animationDuration={300}
          />
          <Radar
            name="Preset"
            dataKey="preset"
            stroke={CHART_COLORS.presetSeries}
            fill={CHART_COLORS.presetSeries}
            fillOpacity={0.25}
            strokeWidth={1.5}
            isAnimationActive={!prefersReducedMotion}
            animationDuration={300}
          />
          <Tooltip />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
