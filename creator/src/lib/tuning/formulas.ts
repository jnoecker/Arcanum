// ─── Tuning Wizard Formula Evaluators ───────────────────────────────
//
// Pure stateless functions that compute derived gameplay metrics from
// AppConfig values. These mirror the server's progression and world
// loader rules so tuning previews stay grounded in the actual MUD.

import type { AppConfig, MobTierConfig } from "@/types/config";
import type { MetricSnapshot } from "./types";
import { REPRESENTATIVE_LEVELS } from "./types";

const BASE_STAT = 10;

function levelSteps(level: number): number {
  return Math.max(1, level) - 1;
}

/**
 * Total XP required to reach a given level.
 * Mirrors PlayerProgression.totalXpForLevel in the server.
 */
export function xpForLevel(
  level: number,
  xp: { baseXp: number; exponent: number; linearXp: number; multiplier: number },
): number {
  if (level <= 1) return 0;
  const steps = levelSteps(level);
  const total = xp.baseXp * Math.pow(steps, xp.exponent) + xp.linearXp * steps;
  if (!Number.isFinite(total)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.round(total));
}

/** Mob hit points at a given level for a specific tier. */
export function mobHpAtLevel(
  tier: Pick<MobTierConfig, "baseHp" | "hpPerLevel">,
  level: number,
): number {
  return tier.baseHp + tier.hpPerLevel * levelSteps(level);
}

/** Mob min damage at a given level for a specific tier. */
export function mobMinDamageAtLevel(
  tier: Pick<MobTierConfig, "baseMinDamage" | "damagePerLevel">,
  level: number,
): number {
  return tier.baseMinDamage + tier.damagePerLevel * levelSteps(level);
}

/** Mob max damage at a given level for a specific tier. */
export function mobMaxDamageAtLevel(
  tier: Pick<MobTierConfig, "baseMaxDamage" | "damagePerLevel">,
  level: number,
): number {
  return tier.baseMaxDamage + tier.damagePerLevel * levelSteps(level);
}

/** Average mob damage at a given level for a specific tier. */
export function mobAvgDamageAtLevel(
  tier: Pick<MobTierConfig, "baseMinDamage" | "baseMaxDamage" | "damagePerLevel">,
  level: number,
): number {
  return (mobMinDamageAtLevel(tier, level) + mobMaxDamageAtLevel(tier, level)) / 2;
}

/** Mob XP reward at a given level before progression multiplier is applied. */
export function mobXpRewardAtLevel(
  tier: Pick<MobTierConfig, "baseXpReward" | "xpRewardPerLevel">,
  level: number,
): number {
  return tier.baseXpReward + tier.xpRewardPerLevel * levelSteps(level);
}

/** Mob gold minimum at a given level for a specific tier. */
export function mobGoldMinAtLevel(
  tier: Pick<MobTierConfig, "baseGoldMin" | "goldPerLevel">,
  level: number,
): number {
  return tier.baseGoldMin + tier.goldPerLevel * levelSteps(level);
}

/** Mob gold maximum at a given level for a specific tier. */
export function mobGoldMaxAtLevel(
  tier: Pick<MobTierConfig, "baseGoldMax" | "goldPerLevel">,
  level: number,
): number {
  return tier.baseGoldMax + tier.goldPerLevel * levelSteps(level);
}

/** Average mob gold drop at a given level for a specific tier. */
export function mobAvgGoldAtLevel(
  tier: Pick<MobTierConfig, "baseGoldMin" | "baseGoldMax" | "goldPerLevel">,
  level: number,
): number {
  return (mobGoldMinAtLevel(tier, level) + mobGoldMaxAtLevel(tier, level)) / 2;
}

/** Applies the server's XP reward multiplier to a raw reward amount. */
export function scaledXpReward(amount: number, multiplier: number): number {
  if (amount <= 0) return 0;
  const total = amount * multiplier;
  if (!Number.isFinite(total)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.round(total));
}

/** Stat-derived bonus: points above base, divided with truncation toward zero. */
export function statBonus(statValue: number, divisor: number): number {
  if (divisor <= 0) return 0;
  return Math.trunc((statValue - BASE_STAT) / divisor);
}

/** Dodge chance percentage, capped at maxDodgePercent. */
export function dodgeChance(
  dodgeStatValue: number,
  bindings: { dodgePerPoint: number; maxDodgePercent: number },
): number {
  return Math.min(
    Math.max((dodgeStatValue - BASE_STAT) * bindings.dodgePerPoint, 0),
    bindings.maxDodgePercent,
  );
}

/**
 * Player HP at a given level.
 * Mirrors PlayerProgression.maxHpForLevel for a resolved hpPerLevel value.
 */
export function playerHpAtLevel(
  level: number,
  rewards: { baseHp: number; hpPerLevel: number },
  hpPerLevel: number,
  hpScalingStat: number,
  hpScalingDivisor: number,
): number {
  const steps = levelSteps(level);
  const total =
    rewards.baseHp +
    steps * hpPerLevel +
    steps * statBonus(hpScalingStat, hpScalingDivisor);
  return Math.max(rewards.baseHp, total);
}

/** HP regen interval in milliseconds, clamped to minIntervalMillis. */
export function regenIntervalMs(
  statValue: number,
  regen: { baseIntervalMillis: number; minIntervalMillis: number },
  hpRegenMsPerPoint: number,
): number {
  return Math.max(
    regen.baseIntervalMillis - hpRegenMsPerPoint * Math.max(statValue - BASE_STAT, 0),
    regen.minIntervalMillis,
  );
}

/**
 * Compute a full MetricSnapshot from an AppConfig, evaluating all
 * formulas at the representative levels [1, 5, 10, 20, 30, 50].
 *
 * Assumptions for player-dependent metrics:
 * - Base stat value: 10 (server baseline)
 * - HP-per-level uses the progression default rather than an invented class
 */
export function computeMetrics(config: AppConfig): MetricSnapshot {
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
      config.progression.rewards.hpPerLevel,
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
