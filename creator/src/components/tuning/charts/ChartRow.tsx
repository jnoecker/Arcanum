// ─── Chart Row Container ────────────────────────────────────────────
// 3-column grid layout for XP curve, mob tier, and stat radar charts.
// Renders between MetricSectionCards and HealthCheckBanner when a
// preset is selected.

import { useMemo } from "react";
import type { AppConfig } from "@/types/config";
import type { MetricSnapshot } from "@/lib/tuning/types";
import { buildXpCurveData, buildStatRadarData } from "@/lib/tuning/chartData";
import { XpCurveChart } from "./XpCurveChart";
import { MobTierChart } from "./MobTierChart";
import { StatRadarChart } from "./StatRadarChart";

interface ChartRowProps {
  currentConfig: AppConfig;
  presetConfig: AppConfig;
  currentMetrics: MetricSnapshot;
  presetMetrics: MetricSnapshot;
  /** When true, drop outer padding/margins — parent owns the frame. */
  nested?: boolean;
}

export function ChartRow({
  currentConfig,
  presetConfig,
  nested = false,
}: ChartRowProps) {
  const xpCurveData = useMemo(
    () => buildXpCurveData(currentConfig, presetConfig),
    [currentConfig, presetConfig],
  );

  const statRadarData = useMemo(
    () => buildStatRadarData(currentConfig.stats.bindings, presetConfig.stats.bindings),
    [currentConfig, presetConfig],
  );

  const wrapperClass = nested
    ? "grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
    : "animate-unfurl-in mb-4 mt-4 grid grid-cols-1 gap-4 px-6 lg:grid-cols-2 2xl:grid-cols-3";

  return (
    <div className={wrapperClass}>
      <XpCurveChart data={xpCurveData} nested={nested} />
      <MobTierChart currentConfig={presetConfig} nested={nested} />
      <StatRadarChart data={statRadarData} nested={nested} />
    </div>
  );
}
