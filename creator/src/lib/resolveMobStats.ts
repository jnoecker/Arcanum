// ─── Mob Stat Resolver ──────────────────────────────────────────────
//
// Mirrors the server's WorldLoader fallback math: when a mob doesn't
// author a stat, the engine computes it as `base + perLevel * steps`
// from the tier config at the mob's level. Arcanum uses the same
// formulas so authors see the actual values the engine will produce.
//
// Keep this file in sync with WorldLoader's resolvedXxx assignments
// and with tuning/formulas.ts.

import type { MobFile } from "@/types/world";
import type { MobTierConfig, MobTiersConfig } from "@/types/config";
import {
  mobHpAtLevel,
  mobMinDamageAtLevel,
  mobMaxDamageAtLevel,
  mobXpRewardAtLevel,
  mobGoldMinAtLevel,
  mobGoldMaxAtLevel,
} from "@/lib/tuning/formulas";

export interface MobStatValue {
  /** Effective value the engine will use (override when set, else tier default). */
  effective: number;
  /** What the tier+level (with any multiplier applied) would produce if the author removed the override. */
  tierDefault: number;
  /** True when the author set an explicit absolute value overriding the tier default. */
  overridden: boolean;
}

export interface ResolvedMobStats {
  hp: MobStatValue;
  minDamage: MobStatValue;
  maxDamage: MobStatValue;
  armor: MobStatValue;
  xpReward: MobStatValue;
  goldMin: MobStatValue;
  goldMax: MobStatValue;
  /** True when *any* combat field has an explicit override. */
  anyOverridden: boolean;
}

function tierFor(mob: MobFile, mobTiers: MobTiersConfig | undefined): MobTierConfig | undefined {
  const id = mob.tier ?? "standard";
  if (!mobTiers) return undefined;
  return (mobTiers as unknown as Record<string, MobTierConfig>)[id];
}

function multOrDefault(value: number | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 1;
  return value;
}

/**
 * Resolve every combat stat for a mob using the tier + level math the MUD
 * engine runs at load time, then applies the per-mob multipliers
 * (`hpMult`, `dmgMult`, `xpMult`, `goldMult`) before falling back to any
 * absolute author override.
 *
 * Resolution order (matches `ResolvedMobStats.resolveMobStats` in the
 * AmbonMUD Kotlin source — `src/main/kotlin/dev/ambon/domain/world/
 * ResolvedMobStats.kt` — which is the source of truth):
 *   1. tier × level baseline
 *   2. multiplier (default 1.0; clamp resulting hp/min/max damage to ≥ 1,
 *      xp/gold to ≥ 0, and maxDamage to ≥ multiplier-applied minDamage)
 *   3. absolute override (`mob.hp`, `mob.minDamage`, …) — always wins,
 *      multiplier is ignored for that specific field.
 *
 * Returns undefined if the tier lookup fails (no mobTiers config, or the
 * mob references an unknown tier). Callers should treat that as "can't
 * preview — trust whatever the author put".
 */
export function resolveMobStats(
  mob: MobFile,
  mobTiers: MobTiersConfig | undefined,
): ResolvedMobStats | undefined {
  const tier = tierFor(mob, mobTiers);
  if (!tier) return undefined;
  const level = mob.level ?? 1;

  const hpMult = multOrDefault(mob.hpMult);
  const dmgMult = multOrDefault(mob.dmgMult);
  const xpMult = multOrDefault(mob.xpMult);
  const goldMult = multOrDefault(mob.goldMult);

  const baseHp = Math.max(1, Math.round(mobHpAtLevel(tier, level) * hpMult));
  const baseMin = Math.max(1, Math.round(mobMinDamageAtLevel(tier, level) * dmgMult));
  const baseMax = Math.max(baseMin, Math.round(mobMaxDamageAtLevel(tier, level) * dmgMult));
  const baseXp = Math.max(0, Math.round(mobXpRewardAtLevel(tier, level) * xpMult));
  const baseGoldMin = Math.max(0, Math.round(mobGoldMinAtLevel(tier, level) * goldMult));
  const baseGoldMax = Math.max(baseGoldMin, Math.round(mobGoldMaxAtLevel(tier, level) * goldMult));

  const make = (authored: number | undefined, tierDefault: number): MobStatValue => ({
    effective: authored ?? tierDefault,
    tierDefault,
    overridden: authored != null,
  });

  const stats: ResolvedMobStats = {
    hp: make(mob.hp, baseHp),
    minDamage: make(mob.minDamage, baseMin),
    maxDamage: make(mob.maxDamage, baseMax),
    armor: make(mob.armor, tier.baseArmor),
    xpReward: make(mob.xpReward, baseXp),
    goldMin: make(mob.goldMin, baseGoldMin),
    goldMax: make(mob.goldMax, baseGoldMax),
    anyOverridden: false,
  };
  stats.anyOverridden =
    stats.hp.overridden ||
    stats.minDamage.overridden ||
    stats.maxDamage.overridden ||
    stats.armor.overridden ||
    stats.xpReward.overridden ||
    stats.goldMin.overridden ||
    stats.goldMax.overridden;
  return stats;
}
