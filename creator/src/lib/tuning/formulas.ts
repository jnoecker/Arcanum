// ─── Tuning Wizard Formula Evaluators ───────────────────────────────
//
// Pure stateless functions that compute derived gameplay metrics from
// AppConfig values. These mirror the server's progression and world
// loader rules so tuning previews stay grounded in the actual MUD.

import type {
  AppConfig,
  DamageSchool,
  MobTierConfig,
  StatBindings,
} from "@/types/config";
import { extractMeleeSchool } from "@/types/config";
import type { MetricSnapshot } from "./types";
import { REPRESENTATIVE_LEVELS } from "./types";

const BASE_STAT = 10;

export { extractMeleeSchool };

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
  tier: Pick<MobTierConfig, "baseHp" | "hpScalingRate">,
  level: number,
): number {
  return Math.floor(tier.baseHp * Math.pow(tier.hpScalingRate, levelSteps(level)));
}

/** Mob min damage at a given level for a specific tier. */
export function mobMinDamageAtLevel(
  tier: Pick<MobTierConfig, "baseMinDamage" | "damageScalingRate">,
  level: number,
): number {
  return Math.floor(tier.baseMinDamage * Math.pow(tier.damageScalingRate, levelSteps(level)));
}

/** Mob max damage at a given level for a specific tier. */
export function mobMaxDamageAtLevel(
  tier: Pick<MobTierConfig, "baseMaxDamage" | "damageScalingRate">,
  level: number,
): number {
  return Math.floor(tier.baseMaxDamage * Math.pow(tier.damageScalingRate, levelSteps(level)));
}

/** Average mob damage at a given level for a specific tier. */
export function mobAvgDamageAtLevel(
  tier: Pick<MobTierConfig, "baseMinDamage" | "baseMaxDamage" | "damageScalingRate">,
  level: number,
): number {
  return (mobMinDamageAtLevel(tier, level) + mobMaxDamageAtLevel(tier, level)) / 2;
}

/** Mob XP reward at a given level before progression multiplier is applied. */
export function mobXpRewardAtLevel(
  tier: Pick<MobTierConfig, "baseXpReward" | "xpScalingRate">,
  level: number,
): number {
  return Math.floor(tier.baseXpReward * Math.pow(tier.xpScalingRate, levelSteps(level)));
}

/** Mob gold minimum at a given level for a specific tier. */
export function mobGoldMinAtLevel(
  tier: Pick<MobTierConfig, "baseGoldMin" | "goldScalingRate">,
  level: number,
): number {
  return Math.floor(tier.baseGoldMin * Math.pow(tier.goldScalingRate, levelSteps(level)));
}

/** Mob gold maximum at a given level for a specific tier. */
export function mobGoldMaxAtLevel(
  tier: Pick<MobTierConfig, "baseGoldMax" | "goldScalingRate">,
  level: number,
): number {
  return Math.floor(tier.baseGoldMax * Math.pow(tier.goldScalingRate, levelSteps(level)));
}

/** Average mob gold drop at a given level for a specific tier. */
export function mobAvgGoldAtLevel(
  tier: Pick<MobTierConfig, "baseGoldMin" | "baseGoldMax" | "goldScalingRate">,
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

// ─── Damage-school formula ──────────────────────────────────────────
//
// Mirrors the server's `computePlayerMeleeSwing` (CombatSystem.kt). The
// shape is generic over `DamageSchool` so spell-damage / heal / utility
// schools can plug into the same math once they exist server-side.
//
//   attackPower = school.baseAttackPower + equipmentContribution
//   statBonus   = (statValue - baseStat) * school.statMultiplier
//   levelScale  = school.levelScalingRate ^ (level - 1)
//   core        = (attackPower + statBonus) * levelScale
//   raw[min,max]= round(core * varianceMin/Max)
//   mitigation  = enemyDefense / (enemyDefense + school.mitigationK)
//   final       = round(raw * (1 - mitigation)), clamped >= 1

export interface AttackDamageRange {
  min: number;
  max: number;
  avg: number;
}

/**
 * Multiplicative armor (or spell-resist) mitigation. Self-scaling: matched
 * to the school's `mitigationK`, defensive stats stay meaningful at every
 * level instead of evaporating against the level-scaled damage curve.
 */
export function armorMitigation(armor: number, mitigationK: number): number {
  if (armor <= 0 || mitigationK <= 0) return 0;
  return armor / (armor + mitigationK);
}

/**
 * Damage range a single basic attack would land at the given level against
 * a target with the given defense. Variance is baked into the [min, max]
 * band; `avg` is the midpoint.
 */
export function computeAttackDamage(
  school: DamageSchool,
  attackPower: number,
  statValue: number,
  level: number,
  enemyDefense: number,
  baseStat: number = BASE_STAT,
): AttackDamageRange {
  const steps = levelSteps(level);
  const statBonusValue = (statValue - baseStat) * school.statMultiplier;
  const levelScale = Math.pow(school.levelScalingRate, steps);
  const core = (attackPower + statBonusValue) * levelScale;
  const mitigation = armorMitigation(enemyDefense, school.mitigationK);
  const survives = Math.max(0, 1 - mitigation);
  const rawMin = Math.round(core * school.varianceMin);
  const rawMax = Math.round(core * school.varianceMax);
  const min = Math.max(1, Math.round(rawMin * survives));
  const max = Math.max(min, Math.round(rawMax * survives));
  return { min, max, avg: (min + max) / 2 };
}

/**
 * Player basic-melee damage range at the given level. Convenience wrapper
 * around [computeAttackDamage] that pulls the melee `DamageSchool` from
 * the config bindings and adds the bindings' `meleeBaseAttackPower` to the
 * caller-supplied equipment attack value.
 */
export function playerMeleeDamage(
  bindings: StatBindings,
  level: number,
  equipmentAttack: number = 0,
  statValue: number = BASE_STAT,
  enemyArmor: number = 0,
): AttackDamageRange {
  const school = extractMeleeSchool(bindings);
  const attackPower = school.baseAttackPower + equipmentAttack;
  return computeAttackDamage(
    school,
    attackPower,
    statValue,
    level,
    enemyArmor,
  );
}

/**
 * Player HP at a given level.
 * Mirrors PlayerProgression.maxHpForLevel for a resolved hpScalingRate value.
 *
 * `hpScalingRate` is a multiplicative per-level growth rate (e.g. 1.1 = +10%/level).
 * Stat bonuses remain additive on top of the multiplicative base curve.
 */
export function playerHpAtLevel(
  level: number,
  rewards: { baseHp: number },
  hpScalingRate: number,
  hpScalingStat: number,
  hpScalingDivisor: number,
): number {
  const steps = levelSteps(level);
  const scaled = Math.floor(rewards.baseHp * Math.pow(hpScalingRate, steps));
  const total = scaled + steps * statBonus(hpScalingStat, hpScalingDivisor);
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
  const playerMeleeAvgDamage: Record<number, number> = {};
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

    // Baseline unarmed melee avg at base stat against a 0-armor target. The
    // tuning charts call playerMeleeDamage() directly when they need to
    // sweep equipment / stat values.
    playerMeleeAvgDamage[level] = playerMeleeDamage(
      config.stats.bindings,
      level,
    ).avg;

    playerHpMap[level] = playerHpAtLevel(
      level,
      config.progression.rewards,
      config.progression.rewards.hpScalingRate,
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
    playerMeleeAvgDamage,
    playerHp: playerHpMap,
    dodgeChance: dodgeChanceMap,
    regenInterval: regenIntervalMap,
  };
}
