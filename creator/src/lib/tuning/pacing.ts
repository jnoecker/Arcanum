// ─── Progression Pacing Gate ───────────────────────────────────────
//
// Estimates how fast a player will hit milestone levels under a
// canonical trash-clearing scenario, and compares against per-preset
// time-to-level targets so the wizard can flag presets whose XP curve
// + mob rewards combine into runaway leveling. The estimator runs
// before apply (preview) and after apply (health check).
//
// Pure, deterministic, no RNG.

import type { AppConfig } from "@/types/config";
import {
  mobAvgGoldAtLevel,
  mobXpRewardAtLevel,
  scaledXpReward,
  xpForLevel,
} from "./formulas";
import type { TierKey } from "./simulations";
import { TIER_KEYS } from "./simulations";

/**
 * Canonical trash-clearing scenario used across all pacing estimates.
 * Models a player working through low-tier mobs at a steady pace —
 * one kill every ~30 seconds, weighted toward weak trash. This is the
 * scenario the user reported runaway leveling in (Auringold academy).
 */
export const CANONICAL_TRASH_RUN = {
  killsPerHour: 120,
  tierMix: { weak: 0.7, standard: 0.25, elite: 0.05, boss: 0 } as Record<TierKey, number>,
} as const;

/** Cumulative minutes from level 1 to reach each milestone, by preset id. */
export interface PacingTargets {
  /** Minutes to reach milestone level (cumulative from level 1). */
  minutesToLevel: Record<number, number>;
}

/**
 * Per-preset time-to-level targets. These encode the design intent of
 * each preset — "Lore Explorer" really should level fast, but not
 * trivially fast. A few-minutes-to-L30 run violates even Lore Explorer's
 * intent and should be flagged.
 *
 * Targets are deliberately generous (a player who plays efficiently
 * should beat them by 2x without triggering the warning); the gate
 * only fires when reality is *much* faster than intent.
 */
export const PRESET_PACING_TARGETS: Record<string, PacingTargets> = {
  loreExplorer: {
    minutesToLevel: { 5: 60, 10: 120, 20: 200, 30: 300 },
  },
  soloStory: {
    minutesToLevel: { 5: 45, 10: 90, 20: 200, 30: 320 },
  },
  casual: {
    minutesToLevel: { 5: 60, 10: 150, 20: 300, 30: 540 },
  },
  balanced: {
    minutesToLevel: { 5: 60, 10: 180, 20: 540, 30: 900 },
  },
  pvpArena: {
    minutesToLevel: { 5: 50, 10: 150, 20: 360, 30: 720 },
  },
  hardcore: {
    minutesToLevel: { 5: 150, 10: 450, 20: 1500, 30: 3000 },
  },
};

/**
 * Representative XP-bonus stat value used to model a modestly invested
 * player in the pacing sim. 5 above the BASE_STAT of 10 — not maxed,
 * not neglected — captures the realistic multiplier without making
 * pacing projections sensitive to minmaxed builds.
 */
const REPRESENTATIVE_XP_BONUS_STAT_OFFSET = 5;

/**
 * Estimate XP/hour the canonical trash run produces against a config.
 * Sampled at the player level (mob XP scales with level and then runs
 * through the progression XP multiplier, matching the server). The
 * server applies a stat-driven XP multiplier on top of the scaled
 * reward (`1 + (stat - BASE_STAT) * xpBonusPerPoint`); we model that
 * here against a representative invested stat so runaway xpBonusPerPoint
 * values surface in time-to-level projections.
 */
export function estimateXpPerHour(config: AppConfig, playerLevel: number): number {
  const { killsPerHour, tierMix } = CANONICAL_TRASH_RUN;
  const xpBonusPerPoint = config.stats?.bindings?.xpBonusPerPoint ?? 0;
  const statMultiplier = Math.max(
    1,
    1 + REPRESENTATIVE_XP_BONUS_STAT_OFFSET * xpBonusPerPoint,
  );
  let xp = 0;
  for (const tier of TIER_KEYS) {
    const tierConfig = config.mobTiers[tier];
    if (!tierConfig) continue;
    const fraction = tierMix[tier] ?? 0;
    const xpPerKill = scaledXpReward(
      mobXpRewardAtLevel(tierConfig, playerLevel),
      config.progression.xp.multiplier,
    );
    xp += killsPerHour * fraction * xpPerKill * statMultiplier;
  }
  return xp;
}

/**
 * Estimate gold/hour from the same canonical run. Useful for sanity
 * — currently informational, not gated.
 */
export function estimateGoldPerHour(config: AppConfig, playerLevel: number): number {
  const { killsPerHour, tierMix } = CANONICAL_TRASH_RUN;
  let gold = 0;
  for (const tier of TIER_KEYS) {
    const tierConfig = config.mobTiers[tier];
    if (!tierConfig) continue;
    gold += killsPerHour * (tierMix[tier] ?? 0) * mobAvgGoldAtLevel(tierConfig, playerLevel);
  }
  return gold;
}

export type PacingVerdict = "way-too-fast" | "fast" | "on-target" | "slow" | "way-too-slow";

export interface PacingMilestone {
  level: number;
  minutesEstimated: number;
  minutesTarget: number | null;
  verdict: PacingVerdict;
}

export interface PacingEstimate {
  milestones: PacingMilestone[];
  /** Total minutes from L1 to the highest milestone with a target. */
  totalMinutes: number;
  /** Preset id whose targets were used, or null if no targets matched. */
  targetsPresetId: string | null;
}

/**
 * Walk levels 1 → max-with-target, summing per-level XP cost / per-level
 * XP rate. XP rate is recomputed at each level because mob XP scales.
 */
function computeMinutesToLevel(
  config: AppConfig,
  targetLevel: number,
): number {
  const xpCurve = config.progression.xp;
  const maxLevel = config.progression.maxLevel || 50;
  const cap = Math.min(targetLevel, maxLevel);
  let minutes = 0;
  for (let lv = 1; lv < cap; lv++) {
    const xpThis = xpForLevel(lv + 1, xpCurve) - xpForLevel(lv, xpCurve);
    const xpPerHour = estimateXpPerHour(config, lv);
    if (xpPerHour <= 0) return Number.POSITIVE_INFINITY;
    minutes += (xpThis / xpPerHour) * 60;
  }
  return minutes;
}

function verdictFor(estimated: number, target: number): PacingVerdict {
  if (target <= 0) return "on-target";
  const ratio = estimated / target;
  // Asymmetric bands: presets are allowed to be ~3x slower or faster than
  // their stated target before flagging. "Way-too-fast" is the primary
  // signal — it's what a runaway XP curve looks like from the UI.
  if (ratio < 0.15) return "way-too-fast";
  if (ratio < 0.35) return "fast";
  if (ratio > 5) return "way-too-slow";
  if (ratio > 3) return "slow";
  return "on-target";
}

/**
 * Estimate how long the canonical trash run takes to reach each
 * milestone, against the targets for the given preset (or no targets
 * if the preset id is unknown).
 */
export function estimatePacing(config: AppConfig, presetId: string | null): PacingEstimate {
  const targets = presetId ? PRESET_PACING_TARGETS[presetId] : undefined;
  const milestoneLevels = targets
    ? Object.keys(targets.minutesToLevel).map((s) => Number(s)).sort((a, b) => a - b)
    : [5, 10, 20, 30];

  const milestones: PacingMilestone[] = [];
  for (const level of milestoneLevels) {
    const minutesEstimated = computeMinutesToLevel(config, level);
    const minutesTarget = targets?.minutesToLevel[level] ?? null;
    const verdict = minutesTarget != null ? verdictFor(minutesEstimated, minutesTarget) : "on-target";
    milestones.push({
      level,
      minutesEstimated: Number.isFinite(minutesEstimated)
        ? Math.round(minutesEstimated * 10) / 10
        : Number.POSITIVE_INFINITY,
      minutesTarget,
      verdict,
    });
  }

  const last = milestones[milestones.length - 1];
  return {
    milestones,
    totalMinutes: last && Number.isFinite(last.minutesEstimated) ? last.minutesEstimated : 0,
    targetsPresetId: targets ? presetId : null,
  };
}
