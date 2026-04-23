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
  /** What the tier+level would produce if the author removed the override. */
  tierDefault: number;
  /** True when the author set an explicit value overriding the tier default. */
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

/**
 * Resolve every combat stat for a mob using the tier + level math the MUD
 * engine runs at load time. Returns both the effective value and the tier
 * default so the editor can show one alongside the other.
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

  const make = (authored: number | undefined, tierDefault: number): MobStatValue => ({
    effective: authored ?? tierDefault,
    tierDefault,
    overridden: authored != null,
  });

  const stats: ResolvedMobStats = {
    hp: make(mob.hp, mobHpAtLevel(tier, level)),
    minDamage: make(mob.minDamage, mobMinDamageAtLevel(tier, level)),
    maxDamage: make(mob.maxDamage, mobMaxDamageAtLevel(tier, level)),
    armor: make(mob.armor, tier.baseArmor),
    xpReward: make(mob.xpReward, mobXpRewardAtLevel(tier, level)),
    goldMin: make(mob.goldMin, mobGoldMinAtLevel(tier, level)),
    goldMax: make(mob.goldMax, mobGoldMaxAtLevel(tier, level)),
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
