// ─── Economy Flow Simulator ────────────────────────────────────────
// Gold-in vs gold-out at a given level. Shows tier-weighted income,
// shop revenue, and sink spend as an at-a-glance waterfall.

import { useMemo, useState } from "react";
import type { AppConfig } from "@/types/config";
import {
  simulateEconomy,
  TIER_KEYS,
  TIER_LABELS,
  type TierKey,
} from "@/lib/tuning/simulations";

interface EconomySimulatorProps {
  config: AppConfig;
}

const DEFAULT_MIX: Record<TierKey, number> = {
  weak: 0.4,
  standard: 0.4,
  elite: 0.15,
  boss: 0.05,
};

export function EconomySimulator({ config }: EconomySimulatorProps) {
  const [level, setLevel] = useState(10);
  const [killsPerHour, setKillsPerHour] = useState(60);
  const [mix, setMix] = useState<Record<TierKey, number>>(DEFAULT_MIX);
  const [sellRate, setSellRate] = useState(0.5);
  const [consumableSpend, setConsumableSpend] = useState(50);
  const [gamblingStake, setGamblingStake] = useState(0);

  const outcome = useMemo(
    () =>
      simulateEconomy(config, {
        level,
        killsPerHour,
        tierMix: mix,
        sellRate,
        consumableSpendPerHour: consumableSpend,
        gamblingStakePerHour: gamblingStake,
      }),
    [config, level, killsPerHour, mix, sellRate, consumableSpend, gamblingStake],
  );

  const maxBar = Math.max(
    ...outcome.breakdown.map((b) => b.goldPerHour),
    Math.abs(outcome.goldPerHour) || 1,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Primary inputs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Player Lv
          <input
            type="number"
            min={1}
            max={config.progression.maxLevel || 50}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={level}
            onChange={(e) => setLevel(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Kills / hour
          <input
            type="number"
            min={0}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={killsPerHour}
            onChange={(e) => setKillsPerHour(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Sell rate (0–1)
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={sellRate}
            onChange={(e) => setSellRate(Math.max(0, Math.min(1, Number(e.target.value) || 0)))}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Consumables / hr
          <input
            type="number"
            min={0}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={consumableSpend}
            onChange={(e) => setConsumableSpend(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted md:col-span-1">
          Gambling stake / hr
          <input
            type="number"
            min={0}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={gamblingStake}
            onChange={(e) => setGamblingStake(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      </div>

      {/* Tier mix sliders */}
      <div>
        <p className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
          Kill mix (will be normalised)
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TIER_KEYS.map((k) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-text-secondary">
              <span className="flex justify-between">
                <span>{TIER_LABELS[k]}</span>
                <span className="font-mono text-text-muted">
                  {Math.round(outcome.normalisedMix[k] * 100)}%
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mix[k]}
                onChange={(e) =>
                  setMix({ ...mix, [k]: Number(e.target.value) })
                }
                className="accent-accent"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <HeadlineTile
          label="Gold / hour"
          value={outcome.goldPerHour.toString()}
          tone={outcome.goldPerHour >= 0 ? "text-status-success" : "text-status-error"}
        />
        <HeadlineTile label="XP / hour" value={outcome.xpPerHour.toLocaleString()} />
        <HeadlineTile
          label="Hours to next level"
          value={
            Number.isFinite(outcome.timeToNextLevelHours)
              ? outcome.timeToNextLevelHours.toFixed(2)
              : "∞"
          }
        />
      </div>

      {/* Waterfall breakdown */}
      <div>
        <p className="mb-2 text-2xs uppercase tracking-wider text-text-muted">Breakdown</p>
        <div className="flex flex-col gap-2">
          {outcome.breakdown.map((b) => {
            const pct = (b.goldPerHour / maxBar) * 100;
            return (
              <div key={b.source} className="flex items-center gap-3">
                <span className="w-44 text-xs text-text-secondary">{b.source}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-secondary/60">
                  <div
                    className={`h-full ${
                      b.sign === "in" ? "bg-status-success/70" : "bg-status-error/70"
                    }`}
                    style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                  />
                </div>
                <span
                  className={`w-20 text-right font-mono text-xs ${
                    b.sign === "in" ? "text-status-success" : "text-status-error"
                  }`}
                >
                  {b.sign === "in" ? "+" : "-"}
                  {b.goldPerHour}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
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
