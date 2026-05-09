import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

export function XpCurveChart({ xp, maxLevel, height = 130 }: XpCurveChartProps) {
  const data = useMemo(() => {
    const cap = Math.max(2, Math.min(maxLevel || 50, 200));
    const stride = cap > 60 ? Math.ceil(cap / 30) : 1;
    const points: { level: number; xp: number }[] = [];
    for (let lv = 1; lv <= cap; lv += stride) {
      points.push({ level: lv, xp: xpForLevel(lv, xp) });
    }
    if (points[points.length - 1]?.level !== cap) {
      points.push({ level: cap, xp: xpForLevel(cap, xp) });
    }
    return points;
  }, [xp, maxLevel]);

  return (
    <div className="rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          XP Required per Level
        </span>
        <span className="font-mono text-2xs text-text-muted/70">
          peak {formatLargeNumber(xpForLevel(maxLevel || 50, xp))}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="xpCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="var(--color-border-muted)"
            vertical={false}
          />
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
            width={42}
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
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#xpCurveFill)"
            isAnimationActive={false}
            dot={{ r: 2, fill: "var(--color-accent)", stroke: "none" }}
            activeDot={{ r: 4, fill: "var(--color-accent)", stroke: "var(--bg-primary)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-1 px-1 text-[10px] leading-tight text-text-muted/60">
        Higher exponents create a steeper late-game curve.
      </p>
    </div>
  );
}
