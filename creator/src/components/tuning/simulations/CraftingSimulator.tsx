// ─── Crafting Viability Analyzer ───────────────────────────────────
// For every recipe in the loaded zones, checks whether its materials
// have sourcing gathering nodes, estimates gather time, and compares
// material value to output price.

import { useMemo, useState } from "react";
import type { AppConfig } from "@/types/config";
import { useZoneStore } from "@/stores/zoneStore";
import {
  analyzeCraftingViability,
  type CraftingViabilityRow,
} from "@/lib/tuning/simulations";

interface CraftingSimulatorProps {
  config: AppConfig;
}

type SortKey = "displayName" | "estimatedGatherSeconds" | "netValue" | "xpPerMinute";

export function CraftingSimulator({ config }: CraftingSimulatorProps) {
  const zones = useZoneStore((s) => s.zones);
  const [hideUnsourced, setHideUnsourced] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("netValue");

  const rows = useMemo(
    () => analyzeCraftingViability(config, zones),
    [config, zones],
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (hideUnsourced) list = list.filter((r) => r.materialsSourced);
    list = [...list].sort((a, b) => compareRows(a, b, sortKey));
    return list;
  }, [rows, hideUnsourced, sortKey]);

  const stats = useMemo(() => {
    const total = rows.length;
    const sourced = rows.filter((r) => r.materialsSourced).length;
    const profitable = rows.filter((r) => r.netValue > 0).length;
    return { total, sourced, profitable };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border-muted bg-bg-secondary/40 px-4 py-6 text-center text-sm text-text-muted">
        No recipes found in the loaded zones.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <HeadlineTile label="Recipes" value={String(stats.total)} />
        <HeadlineTile
          label="Fully sourced"
          value={`${stats.sourced} / ${stats.total}`}
          tone={stats.sourced === stats.total ? "text-status-success" : "text-warm"}
        />
        <HeadlineTile
          label="Profitable to craft & sell"
          value={`${stats.profitable} / ${stats.total}`}
          tone={stats.profitable > 0 ? "text-status-success" : "text-text-muted"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={hideUnsourced}
            onChange={(e) => setHideUnsourced(e.target.checked)}
            className="accent-accent"
          />
          Hide recipes with missing materials
        </label>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Sort by
          <select
            className="ornate-input px-2 py-0.5 text-xs"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="displayName">Name</option>
            <option value="estimatedGatherSeconds">Gather time</option>
            <option value="netValue">Net value</option>
            <option value="xpPerMinute">XP / minute</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border border-border-muted">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-bg-secondary/60 text-text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-normal uppercase tracking-wider">
                Recipe
              </th>
              <th className="px-3 py-2 text-left font-normal uppercase tracking-wider">
                Zone
              </th>
              <th className="px-3 py-2 text-right font-normal uppercase tracking-wider">
                Gather
              </th>
              <th className="px-3 py-2 text-right font-normal uppercase tracking-wider">
                Mat Value
              </th>
              <th className="px-3 py-2 text-right font-normal uppercase tracking-wider">
                Output
              </th>
              <th className="px-3 py-2 text-right font-normal uppercase tracking-wider">
                Net
              </th>
              <th className="px-3 py-2 text-right font-normal uppercase tracking-wider">
                XP/min
              </th>
              <th className="px-3 py-2 text-left font-normal uppercase tracking-wider">
                Missing
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={`${row.zoneId}/${row.recipeId}`}
                className={`border-t border-border-muted ${
                  row.materialsSourced ? "" : "bg-status-error/5"
                }`}
              >
                <td className="px-3 py-2 text-text-primary">{row.displayName}</td>
                <td className="px-3 py-2 text-text-muted">{row.zoneId}</td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {formatSeconds(row.estimatedGatherSeconds)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {row.materialValue}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {row.outputValue}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${
                    row.netValue > 0
                      ? "text-status-success"
                      : row.netValue < 0
                        ? "text-status-error"
                        : "text-text-muted"
                  }`}
                >
                  {row.netValue > 0 ? "+" : ""}
                  {row.netValue}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {row.xpPerMinute.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-status-error">
                  {row.missingMaterialIds.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compareRows(a: CraftingViabilityRow, b: CraftingViabilityRow, key: SortKey): number {
  if (key === "displayName") return a.displayName.localeCompare(b.displayName);
  // Numeric keys — descending
  return (b[key] as number) - (a[key] as number);
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function HeadlineTile({
  label,
  value,
  tone = "text-text-primary",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border-muted bg-bg-primary/40 px-4 py-3">
      <p className="text-2xs uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`font-display text-xl ${tone}`}>{value}</p>
    </div>
  );
}
