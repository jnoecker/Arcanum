// ─── Chart Data Transformers ───────────────────────────────────────
//
// Pure functions that convert AppConfig into Recharts-compatible
// arrays for visualization components. No side effects, no state.

import type { AppConfig, StatBindings } from "@/types/config";
import { xpForLevel, mobHpAtLevel, mobAvgDamageAtLevel } from "./formulas";

// ─── Interfaces ────────────────────────────────────────────────────

export interface XpCurvePoint {
  level: number;
  current: number;
  preset: number;
}

export interface MobTierPoint {
  tier: string;
  hp: number;
  damage: number;
  armor: number;
  xp: number;
  /** Raw (non-normalized) values for tooltip display */
  rawHp: number;
  rawDamage: number;
  rawArmor: number;
  rawXp: number;
}

export interface StatRadarPoint {
  stat: string;
  current: number;
  preset: number;
}

// ─── Tier display labels ───────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  weak: "Weak",
  standard: "Standard",
  elite: "Elite",
  boss: "Boss",
};

const TIER_KEYS = ["weak", "standard", "elite", "boss"] as const;

// ─── Builder Functions ─────────────────────────────────────────────

/**
 * Build XP curve data for levels 1..50, comparing current config vs preset.
 * Returns exactly 50 data points.
 */
export function buildXpCurveData(
  currentConfig: AppConfig,
  presetConfig: AppConfig,
): XpCurvePoint[] {
  const points: XpCurvePoint[] = [];
  for (let level = 1; level <= 50; level++) {
    points.push({
      level,
      current: xpForLevel(level, currentConfig.progression.xp),
      preset: xpForLevel(level, presetConfig.progression.xp),
    });
  }
  return points;
}

/**
 * Build mob tier comparison data at a given level.
 * Returns exactly 4 entries (Weak, Standard, Elite, Boss).
 */
export function buildMobTierData(config: AppConfig, level: number): MobTierPoint[] {
  const raw = TIER_KEYS.map((key) => {
    const tier = config.mobTiers[key];
    return {
      tier: TIER_LABELS[key] ?? key,
      hp: mobHpAtLevel(tier, level),
      damage: mobAvgDamageAtLevel(tier, level),
      armor: tier.baseArmor,
      xp: tier.baseXpReward + tier.xpRewardPerLevel * level,
    };
  });

  // Normalize each metric to 0-100% of max so bars are visually comparable
  const maxHp = Math.max(...raw.map((r) => r.hp), 1);
  const maxDamage = Math.max(...raw.map((r) => r.damage), 1);
  const maxArmor = Math.max(...raw.map((r) => r.armor), 1);
  const maxXp = Math.max(...raw.map((r) => r.xp), 1);

  return raw.map((r) => ({
    tier: r.tier,
    hp: Math.round((r.hp / maxHp) * 100),
    damage: Math.round((r.damage / maxDamage) * 100),
    armor: Math.round((r.armor / maxArmor) * 100),
    xp: Math.round((r.xp / maxXp) * 100),
    rawHp: r.hp,
    rawDamage: r.damage,
    rawArmor: r.armor,
    rawXp: r.xp,
  }));
}

/**
 * Build stat radar data comparing current vs preset stat bindings.
 * Returns exactly 8 entries with human-readable labels.
 *
 * Divisor fields are inverted (1/divisor) so that smaller divisors
 * produce larger radar values (more impactful stats appear bigger).
 * Direct fields (per-point values) are used as-is.
 */
export function buildStatRadarData(
  currentBindings: StatBindings,
  presetBindings: StatBindings,
): StatRadarPoint[] {
  return [
    {
      stat: "Melee Dmg",
      current: 1 / currentBindings.meleeDamageDivisor,
      preset: 1 / presetBindings.meleeDamageDivisor,
    },
    {
      stat: "Spell Dmg",
      current: 1 / currentBindings.spellDamageDivisor,
      preset: 1 / presetBindings.spellDamageDivisor,
    },
    {
      stat: "HP Scaling",
      current: 1 / currentBindings.hpScalingDivisor,
      preset: 1 / presetBindings.hpScalingDivisor,
    },
    {
      stat: "Mana Scaling",
      current: 1 / currentBindings.manaScalingDivisor,
      preset: 1 / presetBindings.manaScalingDivisor,
    },
    {
      stat: "Dodge",
      current: currentBindings.dodgePerPoint,
      preset: presetBindings.dodgePerPoint,
    },
    {
      stat: "HP Regen",
      current: currentBindings.hpRegenMsPerPoint,
      preset: presetBindings.hpRegenMsPerPoint,
    },
    {
      stat: "Mana Regen",
      current: currentBindings.manaRegenMsPerPoint,
      preset: presetBindings.manaRegenMsPerPoint,
    },
    {
      stat: "XP Bonus",
      current: currentBindings.xpBonusPerPoint,
      preset: presetBindings.xpBonusPerPoint,
    },
  ];
}
