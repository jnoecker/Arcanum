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
}

export function ChartRow({
  currentConfig,
  presetConfig,
}: ChartRowProps) {
  const xpCurveData = useMemo(
    () => buildXpCurveData(currentConfig, presetConfig),
    [currentConfig, presetConfig],
  );

  const statRadarData = useMemo(
    () => buildStatRadarData(currentConfig.stats.bindings, presetConfig.stats.bindings),
    [currentConfig, presetConfig],
  );

  return (
    <div className="animate-unfurl-in mb-4 mt-4 grid grid-cols-3 gap-4 px-6">
      <XpCurveChart data={xpCurveData} />
      <MobTierChart currentConfig={presetConfig} />
      <StatRadarChart data={statRadarData} />
    </div>
  );
}
