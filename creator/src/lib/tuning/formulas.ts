// ─── Tuning Wizard Formula Evaluators ──────────────────────────────
//
// Pure stateless functions that compute derived gameplay metrics from
// AppConfig values. Used by preset comparison and visualization.

import type { AppConfig } from "@/types/config";
import type { MetricSnapshot } from "./types";
import { REPRESENTATIVE_LEVELS } from "./types";

/**
 * XP required to reach a given level.
 * Formula inferred from XpCurveConfig field semantics -- exact Kotlin
 * computation not in reference/.
 */
export function xpForLevel(
  level: number,
  xp: { baseXp: number; exponent: number; linearXp: number; multiplier: number },
): number {
  return Math.floor(
    (xp.baseXp * Math.pow(level, xp.exponent) + xp.linearXp * level) * xp.multiplier,
  );
}

/** Mob hit points at a given level for a specific tier. */
export function mobHpAtLevel(
  tier: { baseHp: number; hpPerLevel: number },
  level: number,
): number {
  return tier.baseHp + tier.hpPerLevel * level;
}

/** Average mob damage at a given level for a specific tier. */
export function mobAvgDamageAtLevel(
  tier: { baseMinDamage: number; baseMaxDamage: number; damagePerLevel: number },
  level: number,
): number {
  return (tier.baseMinDamage + tier.baseMaxDamage) / 2 + tier.damagePerLevel * level;
}

/** Average mob gold drop at a given level for a specific tier. */
export function mobAvgGoldAtLevel(
  tier: { baseGoldMin: number; baseGoldMax: number; goldPerLevel: number },
  level: number,
): number {
  return (tier.baseGoldMin + tier.baseGoldMax) / 2 + tier.goldPerLevel * level;
}

/** Stat-derived bonus: floor(statValue / divisor). */
export function statBonus(statValue: number, divisor: number): number {
  return Math.floor(statValue / divisor);
}

/** Dodge chance percentage, capped at maxDodgePercent. */
export function dodgeChance(
  dodgeStatValue: number,
  bindings: { dodgePerPoint: number; maxDodgePercent: number },
): number {
  return Math.min(bindings.dodgePerPoint * dodgeStatValue, bindings.maxDodgePercent);
}

/**
 * Player HP at a given level.
 * Approximation -- exact server formula involves full player model.
 * Stat bonus scales per level.
 */
export function playerHpAtLevel(
  level: number,
  rewards: { baseHp: number; hpPerLevel: number },
  classHpPerLevel: number,
  hpScalingStat: number,
  hpScalingDivisor: number,
): number {
  return (
    rewards.baseHp +
    (rewards.hpPerLevel + classHpPerLevel + statBonus(hpScalingStat, hpScalingDivisor)) * level
  );
}

/** HP regen interval in milliseconds, clamped to minIntervalMillis. */
export function regenIntervalMs(
  statValue: number,
  regen: { baseIntervalMillis: number; minIntervalMillis: number },
  hpRegenMsPerPoint: number,
): number {
  return Math.max(
    regen.baseIntervalMillis - hpRegenMsPerPoint * statValue,
    regen.minIntervalMillis,
  );
}

/**
 * Compute a full MetricSnapshot from an AppConfig, evaluating all
 * formulas at the representative levels [1, 5, 10, 20, 30, 50].
 *
 * Assumptions for player-dependent metrics:
 * - Base stat value: 10 (reasonable starting character)
 * - Class HP per level: 3 (mid-range class)
 */
export function computeMetrics(config: AppConfig): MetricSnapshot {
  const BASE_STAT = 10;
  const CLASS_HP_PER_LEVEL = 3;

  const xpPerLevel: Record<number, number> = {};
  const mobHp: Record<string, Record<number, number>> = {};
  const mobDamageAvg: Record<string, Record<number, number>> = {};
  const mobGoldAvg: Record<string, Record<number, number>> = {};
  const playerDamageBonus: Record<number, number> = {};
  const playerHpMap: Record<number, number> = {};
  const dodgeChanceMap: Record<number, number> = {};
  const regenIntervalMap: Record<number, number> = {};

  const tierKeys = Object.keys(config.mobTiers) as Array<keyof typeof config.mobTiers>;

  for (const tierKey of tierKeys) {
    mobHp[tierKey] = {};
    mobDamageAvg[tierKey] = {};
    mobGoldAvg[tierKey] = {};
  }

  for (const level of REPRESENTATIVE_LEVELS) {
    xpPerLevel[level] = xpForLevel(level, config.progression.xp);

    for (const tierKey of tierKeys) {
      const tier = config.mobTiers[tierKey];
      mobHp[tierKey]![level] = mobHpAtLevel(tier, level);
      mobDamageAvg[tierKey]![level] = mobAvgDamageAtLevel(tier, level);
      mobGoldAvg[tierKey]![level] = mobAvgGoldAtLevel(tier, level);
    }

    playerDamageBonus[level] = statBonus(BASE_STAT, config.stats.bindings.meleeDamageDivisor);

    playerHpMap[level] = playerHpAtLevel(
      level,
      config.progression.rewards,
      CLASS_HP_PER_LEVEL,
      BASE_STAT,
      config.stats.bindings.hpScalingDivisor,
    );

    dodgeChanceMap[level] = dodgeChance(BASE_STAT, config.stats.bindings);

    regenIntervalMap[level] = regenIntervalMs(
      BASE_STAT,
      config.regen,
      config.stats.bindings.hpRegenMsPerPoint,
    );
  }

  return {
    xpPerLevel,
    mobHp,
    mobDamageAvg,
    mobGoldAvg,
    playerDamageBonus,
    playerHp: playerHpMap,
    dodgeChance: dodgeChanceMap,
    regenInterval: regenIntervalMap,
  };
}
