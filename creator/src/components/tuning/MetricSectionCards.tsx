// ─── Metric Section Cards ───────────────────────────────────────────
// 2x2 grid of KPI cards, one per TuningSection. Appears between preset
// row and SearchFilterBar when a preset is selected.

import type { MetricSnapshot } from "@/lib/tuning/types";
import { TuningSection } from "@/lib/tuning/types";
import { MetricCard } from "./MetricCard";

const CARD_ORDER = [
  TuningSection.CombatStats,
  TuningSection.ProgressionQuests,
  TuningSection.EconomyCrafting,
  TuningSection.WorldSocial,
] as const;

interface MetricSectionCardsProps {
  currentMetrics: MetricSnapshot;
  presetMetrics: MetricSnapshot;
  diffCounts?: Map<string, number>;
}

export function MetricSectionCards({
  currentMetrics,
  presetMetrics,
  diffCounts,
}: MetricSectionCardsProps) {
  return (
    <div className="animate-unfurl-in mt-6 mb-6 grid grid-cols-2 gap-4 px-6">
      {CARD_ORDER.map((section) => (
        <MetricCard
          key={section}
          section={section}
          currentMetrics={currentMetrics}
          presetMetrics={presetMetrics}
          diffCount={
            section === TuningSection.WorldSocial
              ? diffCounts?.get(TuningSection.WorldSocial)
              : undefined
          }
        />
      ))}
    </div>
  );
}
