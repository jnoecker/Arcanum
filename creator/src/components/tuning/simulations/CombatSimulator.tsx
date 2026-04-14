// ─── Combat Encounter Simulator ────────────────────────────────────
// Expected-value duel calculator: player vs mob at chosen level/tier.
// Uses the same formulas as the Tuning Wizard metric snapshot.

import { useMemo, useState } from "react";
import type { AppConfig } from "@/types/config";
import {
  simulateEncounter,
  tierForLevel,
  TIER_KEYS,
  TIER_LABELS,
  type TierKey,
} from "@/lib/tuning/simulations";

interface CombatSimulatorProps {
  config: AppConfig;
}

const VERDICT_STYLE: Record<string, { label: string; tone: string }> = {
  easy: { label: "Easy", tone: "text-status-success" },
  fair: { label: "Fair", tone: "text-warm" },
  risky: { label: "Risky", tone: "text-status-warning" },
  lethal: { label: "Lethal", tone: "text-status-error" },
};

export function CombatSimulator({ config }: CombatSimulatorProps) {
  const classOptions = useMemo(
    () =>
      Object.entries(config.classes ?? {})
        .filter(([, c]) => c.selectable !== false)
        .map(([id, c]) => ({ id, name: c.displayName })),
    [config.classes],
  );

  const [playerLevel, setPlayerLevel] = useState(10);
  const [mobLevel, setMobLevel] = useState(10);
  const [classId, setClassId] = useState<string>(classOptions[0]?.id ?? "");
  const [tier, setTier] = useState<TierKey>(() => tierForLevel(config.mobTiers, 10));

  const outcome = useMemo(
    () =>
      simulateEncounter(config, {
        playerLevel,
        classId: classId || undefined,
        mobTier: tier,
        mobLevel,
      }),
    [config, playerLevel, classId, tier, mobLevel],
  );

  const verdict = VERDICT_STYLE[outcome.verdict]!;
  const hpPct = outcome.playerHp > 0 ? (outcome.playerHpRemaining / outcome.playerHp) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Player Lv
          <input
            type="number"
            min={1}
            max={config.progression.maxLevel || 50}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={playerLevel}
            onChange={(e) => setPlayerLevel(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Class
          <select
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">— default —</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Mob Tier
          <select
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={tier}
            onChange={(e) => setTier(e.target.value as TierKey)}
          >
            {TIER_KEYS.map((k) => (
              <option key={k} value={k}>
                {TIER_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-2xs uppercase tracking-wider text-text-muted">
          Mob Lv
          <input
            type="number"
            min={1}
            max={config.progression.maxLevel || 50}
            className="ornate-input px-2 py-1 text-sm text-text-primary"
            value={mobLevel}
            onChange={(e) => setMobLevel(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      {/* Verdict headline */}
      <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border-muted bg-bg-secondary/40 px-4 py-3">
        <div>
          <p className="font-display text-[12px] uppercase tracking-wider text-text-muted">
            Encounter Verdict
          </p>
          <p className={`font-display text-2xl tracking-wide ${verdict.tone}`}>{verdict.label}</p>
        </div>
        <div className="text-right font-mono text-xs text-text-secondary">
          <p>{outcome.turnsToKill} rounds to kill</p>
          <p>{outcome.turnsToDie === Number.MAX_SAFE_INTEGER ? "∞" : outcome.turnsToDie} rounds to die</p>
        </div>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Player HP" value={`${outcome.playerHpRemaining} / ${outcome.playerHp}`} />
        <StatTile label="Mob HP" value={String(outcome.mobHp)} />
        <StatTile label="Your dmg / round" value={String(outcome.playerDmgPerRound)} />
        <StatTile label="Mob dmg / round" value={String(outcome.mobDmgPerRound)} />
        <StatTile label="Dodge" value={`${outcome.dodgePercent}%`} />
        <StatTile
          label="Survived"
          value={outcome.playerWins ? "Yes" : "No"}
          tone={outcome.playerWins ? "text-status-success" : "text-status-error"}
        />
      </div>

      {/* HP bar after kill */}
      <div>
        <p className="mb-1 text-2xs uppercase tracking-wider text-text-muted">
          Expected HP remaining after kill
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-bg-secondary/60">
          <div
            className="h-full bg-warm transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "text-text-primary",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border-muted bg-bg-primary/40 px-3 py-2">
      <p className="text-2xs uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`font-mono text-sm ${tone}`}>{value}</p>
    </div>
  );
}
