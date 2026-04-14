// ─── Progression Pacing Simulator ──────────────────────────────────
// Given an XP/hour rate, show cumulative hours to reach each level
// across the chosen level range. Flags the single slowest level.

import { useMemo, useState } from "react";
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
import type { AppConfig } from "@/types/config";
import { simulateProgression } from "@/lib/tuning/simulations";
import { CHART_COLORS } from "@/lib/tuning/chartColors";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

interface ProgressionSimulatorProps {
  config: AppConfig;
}

const TICK_STYLE = {
  fill: CHART_COLORS.axisText,
  fontSize: 12,
  fontFamily: "'Crimson Pro', Georgia, serif",
};

export function ProgressionSimulator({ config }: ProgressionSimulatorProps) {
  const maxLevel = config.progression.maxLevel || 50;
  const [startLevel, setStartLevel] = useState(1);
  const [endLevel, setEndLevel] = useState(Math.min(maxLevel, 30));
  const [xpPerHour, setXpPerHour] = useState(2000);

  const outcome = useMemo(
    () => simulateProgression(config, { startLevel, endLevel, xpPerHour }),
    [config, startLevel, endLevel, xpPerHour],
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  const chartData = outcome.points.map((p) => ({
    level: p.level,
    hours: p.cumulativeHours,
    xp: p.xpForLevel,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Start Lv
          <input
            type="number"
            min={1}
            max={maxLevel}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={startLevel}
            onChange={(e) => setStartLevel(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          End Lv
          <input
            type="number"
            min={1}
            max={maxLevel}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={endLevel}
            onChange={(e) => setEndLevel(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          XP / hour
          <input
            type="number"
            min={1}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={xpPerHour}
            onChange={(e) => setXpPerHour(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <HeadlineTile label="Total XP" value={outcome.totalXp.toLocaleString()} />
        <HeadlineTile label="Total hours" value={outcome.totalHours.toFixed(1)} />
        <HeadlineTile
          label="Slowest level"
          value={`Lv ${outcome.slowestLevel} · ${outcome.slowestLevelHours.toFixed(1)}h`}
        />
      </div>

      <div className="panel-surface rounded-[1.5rem] p-4">
        <h3 className="mb-2 font-display text-[14px] font-normal uppercase tracking-[0.5px] text-text-secondary">
          Cumulative Hours to Level
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="level" tick={TICK_STYLE} stroke={CHART_COLORS.axisLine} />
            <YAxis tick={TICK_STYLE} stroke={CHART_COLORS.axisLine} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="hours"
              name="Cumulative Hours"
              stroke={CHART_COLORS.presetSeries}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!prefersReducedMotion}
              animationDuration={300}
            />
            <Line
              type="monotone"
              dataKey="xp"
              name="XP This Level"
              stroke={CHART_COLORS.currentSeries}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!prefersReducedMotion}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HeadlineTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-muted bg-bg-primary/40 px-4 py-3">
      <p className="text-2xs uppercase tracking-wider text-text-muted">{label}</p>
      <p className="font-display text-xl text-text-primary">{value}</p>
    </div>
  );
}
