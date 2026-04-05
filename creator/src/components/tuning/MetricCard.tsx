// ─── Metric Card ────────────────────────────────────────────────────
// Single KPI card for one TuningSection. Shows 2-3 curated derived
// metrics with current vs preset values and delta badges.

import { useRef, useEffect, useMemo } from "react";
import tippy from "tippy.js";
import { TuningSection } from "@/lib/tuning/types";
import type { MetricSnapshot } from "@/lib/tuning/types";
import { pctDelta, deltaDirection, deltaColor } from "@/lib/tuning/deltaUtils";

// ─── Formatting Helpers ─────────────────────────────────────────────

function fmtInt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDec1(n: number): string {
  return n.toFixed(1);
}

function fmtMs(n: number): string {
  return `${n.toFixed(0)}ms`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ─── Types ──────────────────────────────────────────────────────────

interface MetricRowData {
  label: string;
  current: number;
  preset: number;
  format: (n: number) => string;
  formulaTooltip: string;
}

interface MetricCardProps {
  section: TuningSection;
  currentMetrics: MetricSnapshot;
  presetMetrics: MetricSnapshot;
  diffCount?: number;
}

// ─── MetricRow (internal) ───────────────────────────────────────────

function MetricRow({
  label,
  current,
  preset,
  format,
  formulaTooltip,
  showHeader,
}: MetricRowData & { showHeader?: boolean }) {
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!labelRef.current || !formulaTooltip) return;
    const t = tippy(labelRef.current, {
      content: formulaTooltip,
      theme: "arcanum",
      placement: "top-start",
      delay: [200, 100],
      maxWidth: 260,
    });
    return () => t.destroy();
  }, [formulaTooltip]);

  const dir = deltaDirection(current, preset);
  const color = deltaColor(dir);
  const delta = pctDelta(current, preset);

  return (
    <div>
      {showHeader && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="flex-1" />
          <span className="w-[72px] text-right font-sans text-[12px] uppercase tracking-wide text-text-muted">
            Current
          </span>
          <span className="w-[110px] text-right font-sans text-[12px] uppercase tracking-wide text-text-muted">
            Preset
          </span>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2 py-1">
        <span
          ref={labelRef}
          className="flex-1 cursor-default font-sans text-[14px] text-text-secondary"
        >
          {label}
        </span>
        <span className="w-[72px] text-right font-mono text-[13px] text-text-muted">
          {format(current)}
        </span>
        <span className={`w-[110px] text-right font-mono text-[13px] ${color}`}>
          {format(preset)}{" "}
          {dir !== "same" ? delta : "\u2014"}
        </span>
      </div>
    </div>
  );
}

// ─── Curated Metrics Per Section ────────────────────────────────────

function getMetricRows(
  section: TuningSection,
  current: MetricSnapshot,
  preset: MetricSnapshot,
): MetricRowData[] {
  switch (section) {
    case TuningSection.CombatStats:
      return [
        {
          label: "Mob HP \u2014 Lv10",
          current: current.mobHp["standard"]?.[10] ?? 0,
          preset: preset.mobHp["standard"]?.[10] ?? 0,
          format: fmtInt,
          formulaTooltip: "baseHp + hpPerLevel \u00D7 level (Normal tier)",
        },
        {
          label: "Mob HP \u2014 Lv30",
          current: current.mobHp["standard"]?.[30] ?? 0,
          preset: preset.mobHp["standard"]?.[30] ?? 0,
          format: fmtInt,
          formulaTooltip: "baseHp + hpPerLevel \u00D7 level (Normal tier)",
        },
        {
          label: "Dodge Chance",
          current: current.dodgeChance[10] ?? 0,
          preset: preset.dodgeChance[10] ?? 0,
          format: fmtPct,
          formulaTooltip: "agility stat bonus / (agility stat bonus + 100)",
        },
      ];

    case TuningSection.ProgressionQuests:
      return [
        {
          label: "XP to Lv10",
          current: current.xpPerLevel[10] ?? 0,
          preset: preset.xpPerLevel[10] ?? 0,
          format: fmtInt,
          formulaTooltip: "Cumulative XP from level 1 to N using the XP exponent curve",
        },
        {
          label: "XP to Lv30",
          current: current.xpPerLevel[30] ?? 0,
          preset: preset.xpPerLevel[30] ?? 0,
          format: fmtInt,
          formulaTooltip: "Cumulative XP from level 1 to N using the XP exponent curve",
        },
        {
          label: "Player HP \u2014 Lv10",
          current: current.playerHp[10] ?? 0,
          preset: preset.playerHp[10] ?? 0,
          format: fmtInt,
          formulaTooltip: "baseHp + hpPerLevel \u00D7 level",
        },
      ];

    case TuningSection.EconomyCrafting:
      return [
        {
          label: "Gold/Kill \u2014 Lv10",
          current: current.mobGoldAvg["standard"]?.[10] ?? 0,
          preset: preset.mobGoldAvg["standard"]?.[10] ?? 0,
          format: fmtDec1,
          formulaTooltip: "mob base gold \u00D7 goldMultiplier (Normal tier)",
        },
        {
          label: "Gold/Kill \u2014 Lv30",
          current: current.mobGoldAvg["standard"]?.[30] ?? 0,
          preset: preset.mobGoldAvg["standard"]?.[30] ?? 0,
          format: fmtDec1,
          formulaTooltip: "mob base gold \u00D7 goldMultiplier (Normal tier)",
        },
      ];

    case TuningSection.WorldSocial:
      return [
        {
          label: "Regen Interval",
          current: current.regenInterval[1] ?? 0,
          preset: preset.regenInterval[1] ?? 0,
          format: fmtMs,
          formulaTooltip: "regenIntervalBase (milliseconds per regen tick)",
        },
      ];
  }
}

// ─── MetricCard Component ───────────────────────────────────────────

export function MetricCard({ section, currentMetrics, presetMetrics, diffCount }: MetricCardProps) {
  const rows = useMemo(
    () => getMetricRows(section, currentMetrics, presetMetrics),
    [section, currentMetrics, presetMetrics],
  );

  return (
    <div className="rounded-xl border border-border-muted bg-bg-secondary p-4">
      <h3 className="mb-2 font-display text-[14px] font-normal uppercase tracking-[0.5px] text-text-secondary">
        {section}
      </h3>
      {rows.map((row, i) => (
        <MetricRow key={row.label} {...row} showHeader={i === 0} />
      ))}
      {section === TuningSection.EconomyCrafting && (
        <p className="mt-2 text-[12px] text-text-muted">
          Buy/sell multipliers visible in raw fields below
        </p>
      )}
      {section === TuningSection.WorldSocial && diffCount != null && diffCount > 0 && (
        <p className="mt-2 text-[12px] text-text-muted">
          {diffCount} other fields changed
        </p>
      )}
    </div>
  );
}
