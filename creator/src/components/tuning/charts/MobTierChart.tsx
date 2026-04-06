// ─── Mob Tier Bar Chart ─────────────────────────────────────────────
// Recharts BarChart showing HP, damage, armor, and XP across all 4 mob
// tiers at a user-selectable level (Lv 10, 20, 30, 50).

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AppConfig } from "@/types/config";
import { buildMobTierData, type MobTierPoint } from "@/lib/tuning/chartData";
import { CHART_COLORS } from "@/lib/tuning/chartColors";

interface MobTierChartProps {
  currentConfig: AppConfig;
}

const LEVEL_OPTIONS = [10, 20, 30, 50] as const;

const TICK_STYLE = {
  fill: CHART_COLORS.axisText,
  fontSize: 12,
  fontFamily: "'Crimson Pro', Georgia, serif",
};

function formatLargeNumber(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
}

const RAW_KEY_MAP: Record<string, keyof MobTierPoint> = {
  HP: "rawHp",
  Damage: "rawDamage",
  Armor: "rawArmor",
  XP: "rawXp",
};

function MobTierTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: MobTierPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-text-primary">{label}</p>
      {payload.map((entry) => {
        const rawKey = RAW_KEY_MAP[entry.name];
        const rawVal = rawKey ? entry.payload[rawKey] : entry.value;
        return (
          <p key={entry.name} className="text-2xs" style={{ color: entry.color }}>
            {entry.name}: {formatLargeNumber(rawVal as number)} ({entry.value}%)
          </p>
        );
      })}
    </div>
  );
}

export function MobTierChart({ currentConfig }: MobTierChartProps) {
  const [selectedLevel, setSelectedLevel] = useState(30);

  const data = useMemo(
    () => buildMobTierData(currentConfig, selectedLevel),
    [currentConfig, selectedLevel],
  );

  return (
    <div className="rounded-lg border border-border-muted bg-bg-tertiary p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-[14px] font-normal uppercase tracking-[0.5px] text-text-secondary">
          MOB POWER
        </h3>
        <select
          className="ornate-input px-2 py-0.5 text-[13px]"
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(Number(e.target.value))}
        >
          {LEVEL_OPTIONS.map((lv) => (
            <option key={lv} value={lv}>
              Lv {lv}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          barCategoryGap="20%"
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="tier"
            tick={TICK_STYLE}
            stroke={CHART_COLORS.axisLine}
          />
          <YAxis
            tick={TICK_STYLE}
            stroke={CHART_COLORS.axisLine}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<MobTierTooltip />} />
          <Legend />
          <Bar
            dataKey="hp"
            name="HP"
            fill={CHART_COLORS.barHp}
            isAnimationActive={true}
            animationDuration={300}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="damage"
            name="Damage"
            fill={CHART_COLORS.barDamage}
            isAnimationActive={true}
            animationDuration={300}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="armor"
            name="Armor"
            fill={CHART_COLORS.barArmor}
            isAnimationActive={true}
            animationDuration={300}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="xp"
            name="XP"
            fill={CHART_COLORS.barXp}
            isAnimationActive={true}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
