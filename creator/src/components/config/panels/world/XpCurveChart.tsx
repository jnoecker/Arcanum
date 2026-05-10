import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { XpCurveConfig } from "@/types/config";

interface XpCurveChartProps {
  xp: XpCurveConfig;
  maxLevel: number;
  height?: number;
}

const TICK_STYLE = {
  fill: "var(--color-text-muted)",
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
};

function formatLargeNumber(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function xpForLevel(level: number, xp: XpCurveConfig): number {
  const exp = Number(xp.exponent ?? 2);
  const base = Number(xp.baseXp ?? 100);
  const linear = Number(xp.linearXp ?? 0);
  const mult = Number(xp.multiplier ?? 1);
  return (base * Math.pow(level, exp) + linear * level) * mult;
}

export function XpCurveChart({ xp, maxLevel, height = 140 }: XpCurveChartProps) {
  const cap = Math.max(2, Math.min(maxLevel || 50, 200));

  const data = useMemo(() => {
    const stride = cap > 60 ? Math.ceil(cap / 30) : 1;
    const points: { level: number; xp: number }[] = [];
    for (let lv = 1; lv <= cap; lv += stride) {
      points.push({ level: lv, xp: xpForLevel(lv, xp) });
    }
    if (points[points.length - 1]?.level !== cap) {
      points.push({ level: cap, xp: xpForLevel(cap, xp) });
    }
    return points;
  }, [xp, cap]);

  const milestones = useMemo(() => {
    const marks: { level: number; xp: number; label: string }[] = [];
    if (cap >= 50) {
      [10, 50].forEach((lv) => {
        if (lv < cap) {
          marks.push({ level: lv, xp: xpForLevel(lv, xp), label: `Lv ${lv}` });
        }
      });
    } else {
      const half = Math.max(2, Math.round(cap / 2));
      marks.push({ level: half, xp: xpForLevel(half, xp), label: `Lv ${half}` });
    }
    return marks;
  }, [cap, xp]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="xpCurveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.55} />
            <stop offset="55%" stopColor="var(--color-arcane-teal)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-arcane-teal)" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="xpCurveStroke" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-arcane-teal)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chrome-stroke)" vertical={false} />
        <XAxis
          dataKey="level"
          tick={TICK_STYLE}
          stroke="var(--color-border-default)"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={TICK_STYLE}
          stroke="var(--color-border-default)"
          tickLine={false}
          axisLine={false}
          tickFormatter={formatLargeNumber}
          width={48}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--color-border-default)",
            background: "var(--bg-elevated)",
            fontSize: 11,
            padding: "4px 8px",
          }}
          labelStyle={{ color: "var(--color-text-muted)", fontSize: 10 }}
          itemStyle={{ color: "var(--color-accent)" }}
          formatter={(v) => [formatLargeNumber(Number(v)), "XP"]}
          labelFormatter={(lv) => `Lv ${lv}`}
        />
        <Area
          type="monotone"
          dataKey="xp"
          stroke="url(#xpCurveStroke)"
          strokeWidth={2.25}
          fill="url(#xpCurveFill)"
          isAnimationActive={true}
          animationDuration={400}
          animationEasing="ease-out"
          dot={false}
          activeDot={{
            r: 4,
            fill: "var(--color-accent)",
            stroke: "var(--bg-primary)",
            strokeWidth: 2,
          }}
        />
        {milestones.map((m) => (
          <ReferenceDot
            key={m.level}
            x={m.level}
            y={m.xp}
            r={4}
            fill="var(--color-accent)"
            stroke="var(--bg-primary)"
            strokeWidth={2}
            ifOverflow="extendDomain"
            label={{
              value: m.label,
              position: "top",
              fill: "var(--color-text-muted)",
              fontSize: 10,
              fontFamily: "'Cinzel', serif",
            }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
