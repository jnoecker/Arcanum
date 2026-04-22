// ─── Balance Simulation Engines ────────────────────────────────────
//
// Pure "what-if" simulators for the Tuning Wizard. Each function takes
// an AppConfig plus a handful of scenario inputs and returns analytic
// outcomes so designers can tune balance without running the server.
//
// All models are deterministic expected-value calculations (no RNG):
// reproducibility matters more than simulation fidelity at this stage.

import type { AppConfig, MobTierConfig } from "@/types/config";
import type { WorldFile, GatheringNodeFile, RecipeFile, ItemFile } from "@/types/world";
import {
  xpForLevel,
  mobHpAtLevel,
  mobAvgDamageAtLevel,
  mobAvgGoldAtLevel,
  mobXpRewardAtLevel,
  playerHpAtLevel,
  scaledXpReward,
  statBonus,
  dodgeChance,
} from "./formulas";

// ─── Shared helpers ────────────────────────────────────────────────

export type TierKey = "weak" | "standard" | "elite" | "boss";

export const TIER_KEYS: readonly TierKey[] = ["weak", "standard", "elite", "boss"];

/** Friendly label for a tier key. */
export const TIER_LABELS: Record<TierKey, string> = {
  weak: "Weak",
  standard: "Standard",
  elite: "Elite",
  boss: "Boss",
};

/** Combat config damage band average, plus the server's melee stat bonus. */
function playerBaseDamage(
  config: AppConfig,
  meleeStatValue: number,
): number {
  const { minDamage, maxDamage } = config.combat;
  const base = (minDamage + maxDamage) / 2;
  const bonus = statBonus(meleeStatValue, config.stats.bindings.meleeDamageDivisor);
  return Math.max(1, base + bonus);
}

// ─── 1. Combat Encounter ───────────────────────────────────────────

export interface EncounterInputs {
  playerLevel: number;
  /** Chosen class id (e.g. "warrior"). Used for HP-per-level. */
  classId?: string;
  /** Primary stat baseline. Default 10 + 2 per level. */
  baseStat?: number;
  mobTier: TierKey;
  mobLevel: number;
}

export interface EncounterOutcome {
  /** Expected rounds for the player to reduce mob HP to zero. */
  turnsToKill: number;
  /** Expected rounds for the mob to reduce the player to zero HP. */
  turnsToDie: number;
  /** True if player kills first (turnsToKill <= turnsToDie). */
  playerWins: boolean;
  /** Player HP at start of fight. */
  playerHp: number;
  /** Mob HP at start of fight. */
  mobHp: number;
  /** Average damage player deals per round, after mob armor. */
  playerDmgPerRound: number;
  /** Average damage mob deals per round after dodge + player armor. */
  mobDmgPerRound: number;
  /** Expected HP remaining after the kill (clamped to 0). */
  playerHpRemaining: number;
  /** Dodge percent used in the calculation. */
  dodgePercent: number;
  /** Verdict string for quick scanning. */
  verdict: "easy" | "fair" | "risky" | "lethal";
}

export function simulateEncounter(
  config: AppConfig,
  inputs: EncounterInputs,
): EncounterOutcome {
  const { playerLevel, mobTier, mobLevel } = inputs;
  const baseStat = inputs.baseStat ?? 10 + playerLevel * 2;
  const classDef = inputs.classId ? config.classes?.[inputs.classId] : undefined;
  const hpPerLevel = classDef?.hpPerLevel ?? config.progression.rewards.hpPerLevel;

  const tier = config.mobTiers[mobTier];
  const mobHp = mobHpAtLevel(tier, mobLevel);
  const mobDmg = mobAvgDamageAtLevel(tier, mobLevel);

  const playerHp = playerHpAtLevel(
    playerLevel,
    config.progression.rewards,
    hpPerLevel,
    baseStat,
    config.stats.bindings.hpScalingDivisor,
  );

  const playerDmgRaw = playerBaseDamage(config, baseStat);
  const playerDmgPerRound = Math.max(1, playerDmgRaw - tier.baseArmor);

  const dodgePct = dodgeChance(baseStat, config.stats.bindings);
  const mobDmgPerRound = mobDmg * (1 - dodgePct / 100);

  const turnsToKill = Math.max(1, Math.ceil(mobHp / playerDmgPerRound));
  const turnsToDie =
    mobDmgPerRound > 0 ? Math.max(1, Math.ceil(playerHp / mobDmgPerRound)) : Infinity;

  const playerHpRemaining = Math.max(0, playerHp - mobDmgPerRound * turnsToKill);
  const playerWins = turnsToKill <= turnsToDie;

  let verdict: EncounterOutcome["verdict"];
  if (!playerWins) {
    verdict = "lethal";
  } else {
    const pct = playerHp > 0 ? playerHpRemaining / playerHp : 0;
    if (pct >= 0.7) verdict = "easy";
    else if (pct >= 0.35) verdict = "fair";
    else verdict = "risky";
  }

  return {
    turnsToKill,
    turnsToDie: Number.isFinite(turnsToDie) ? turnsToDie : Number.MAX_SAFE_INTEGER,
    playerWins,
    playerHp: Math.round(playerHp),
    mobHp: Math.round(mobHp),
    playerDmgPerRound: Math.round(playerDmgPerRound * 10) / 10,
    mobDmgPerRound: Math.round(mobDmgPerRound * 10) / 10,
    playerHpRemaining: Math.round(playerHpRemaining),
    dodgePercent: Math.round(dodgePct * 10) / 10,
    verdict,
  };
}

// ─── 2. Economy Flow ────────────────────────────────────────────────

export interface EconomyInputs {
  level: number;
  killsPerHour: number;
  /** Fractions should roughly sum to 1; function re-normalises if not. */
  tierMix: Record<TierKey, number>;
  /** Fraction of gear sold to shops each hour (0–1). Average basePrice = 25. */
  sellRate: number;
  /** Gold spent per hour on consumables / repairs. */
  consumableSpendPerHour: number;
  /** Optional fixed gambling stake per hour. */
  gamblingStakePerHour?: number;
}

export interface EconomyBreakdown {
  source: string;
  goldPerHour: number;
  sign: "in" | "out";
}

export interface EconomyOutcome {
  goldPerHour: number;
  xpPerHour: number;
  timeToNextLevelHours: number;
  breakdown: EconomyBreakdown[];
  /** Normalised tier mix as used. */
  normalisedMix: Record<TierKey, number>;
}

const AVG_SHOP_BASE_PRICE = 25;

export function simulateEconomy(
  config: AppConfig,
  inputs: EconomyInputs,
): EconomyOutcome {
  const { level, killsPerHour, tierMix, sellRate, consumableSpendPerHour } = inputs;
  const total = TIER_KEYS.reduce((sum, k) => sum + Math.max(0, tierMix[k] ?? 0), 0);
  const normalised: Record<TierKey, number> = { weak: 0, standard: 0, elite: 0, boss: 0 };
  for (const k of TIER_KEYS) {
    normalised[k] = total > 0 ? Math.max(0, tierMix[k] ?? 0) / total : 0;
  }

  let goldFromMobs = 0;
  let xpFromMobs = 0;
  for (const k of TIER_KEYS) {
    const tier = config.mobTiers[k];
    const killsOfTier = killsPerHour * normalised[k];
    goldFromMobs += killsOfTier * mobAvgGoldAtLevel(tier, level);
    xpFromMobs += killsOfTier * scaledXpReward(
      mobXpRewardAtLevel(tier, level),
      config.progression.xp.multiplier,
    );
  }

  // Shop revenue — sellRate is the fraction of acquired drops sold per hour.
  // Assume one sellable drop per 3 kills at average basePrice, multiplied by
  // the economy sellMultiplier.
  const dropsPerHour = killsPerHour / 3;
  const goldFromSelling =
    dropsPerHour * sellRate * AVG_SHOP_BASE_PRICE * config.economy.sellMultiplier;

  const gamblingOut = inputs.gamblingStakePerHour ?? 0;

  const goldPerHour =
    goldFromMobs + goldFromSelling - consumableSpendPerHour - gamblingOut;

  const xpCurve = config.progression.xp;
  const xpToNext = xpForLevel(level + 1, xpCurve) - xpForLevel(level, xpCurve);
  const timeToNextLevelHours = xpFromMobs > 0 ? xpToNext / xpFromMobs : Infinity;

  const breakdown: EconomyBreakdown[] = [
    { source: "Mob drops", goldPerHour: goldFromMobs, sign: "in" },
    { source: "Shop sales", goldPerHour: goldFromSelling, sign: "in" },
    { source: "Consumables / repairs", goldPerHour: consumableSpendPerHour, sign: "out" },
  ];
  if (gamblingOut > 0) {
    breakdown.push({ source: "Gambling stake", goldPerHour: gamblingOut, sign: "out" });
  }

  return {
    goldPerHour: Math.round(goldPerHour),
    xpPerHour: Math.round(xpFromMobs),
    timeToNextLevelHours: Number.isFinite(timeToNextLevelHours)
      ? Math.round(timeToNextLevelHours * 100) / 100
      : Number.POSITIVE_INFINITY,
    breakdown: breakdown.map((b) => ({ ...b, goldPerHour: Math.round(b.goldPerHour) })),
    normalisedMix: normalised,
  };
}

// ─── 3. Progression Pacing ─────────────────────────────────────────

export interface PacingInputs {
  startLevel: number;
  endLevel: number;
  xpPerHour: number;
}

export interface PacingPoint {
  level: number;
  xpForLevel: number;
  cumulativeXp: number;
  cumulativeHours: number;
}

export interface PacingOutcome {
  points: PacingPoint[];
  totalXp: number;
  totalHours: number;
  /** Hours spent on the single slowest level. */
  slowestLevelHours: number;
  /** Which level was slowest (peaked XP). */
  slowestLevel: number;
}

export function simulateProgression(
  config: AppConfig,
  inputs: PacingInputs,
): PacingOutcome {
  const { startLevel, endLevel, xpPerHour } = inputs;
  const lo = Math.max(1, Math.min(startLevel, endLevel));
  const hi = Math.min(config.progression.maxLevel || 50, Math.max(startLevel, endLevel));
  const xpCurve = config.progression.xp;

  const points: PacingPoint[] = [];
  let cumulativeXp = 0;
  let cumulativeHours = 0;
  let slowestLevelHours = 0;
  let slowestLevel = lo;

  for (let lv = lo; lv <= hi; lv++) {
    const xpThis = xpForLevel(lv + 1, xpCurve) - xpForLevel(lv, xpCurve);
    cumulativeXp += xpThis;
    const hoursThis = xpPerHour > 0 ? xpThis / xpPerHour : 0;
    cumulativeHours += hoursThis;
    if (hoursThis > slowestLevelHours) {
      slowestLevelHours = hoursThis;
      slowestLevel = lv;
    }
    points.push({
      level: lv,
      xpForLevel: xpThis,
      cumulativeXp,
      cumulativeHours: Math.round(cumulativeHours * 100) / 100,
    });
  }

  return {
    points,
    totalXp: cumulativeXp,
    totalHours: Math.round(cumulativeHours * 100) / 100,
    slowestLevelHours: Math.round(slowestLevelHours * 100) / 100,
    slowestLevel,
  };
}

// ─── 4. Crafting Viability ─────────────────────────────────────────

export interface CraftingViabilityRow {
  recipeId: string;
  zoneId: string;
  displayName: string;
  /** All materials can be produced by at least one gathering node in the loaded zones. */
  materialsSourced: boolean;
  missingMaterialIds: string[];
  /** Seconds of gathering time (ignoring travel) assuming cooldown per yield. */
  estimatedGatherSeconds: number;
  /** Sum of material basePrice (if known) used as shorthand input value. */
  materialValue: number;
  /** Output item basePrice × outputQuantity, if known. */
  outputValue: number;
  /** outputValue − materialValue; positive = profitable to craft + sell. */
  netValue: number;
  /** xpReward / estimatedGatherSeconds, if both known. */
  xpPerMinute: number;
}

/** Gather every recipe and gathering node from the project's loaded zones. */
export function collectCraftingData(zones: Map<string, { data: WorldFile }>) {
  const recipes: Array<{ zoneId: string; recipeId: string; recipe: RecipeFile }> = [];
  const nodesByItem = new Map<string, GatheringNodeFile[]>();
  const items = new Map<string, ItemFile>();

  for (const [zoneId, state] of zones) {
    const world = state.data;
    if (world.recipes) {
      for (const [rid, r] of Object.entries(world.recipes)) {
        recipes.push({ zoneId, recipeId: rid, recipe: r });
      }
    }
    if (world.gatheringNodes) {
      for (const node of Object.values(world.gatheringNodes)) {
        for (const yield_ of node.yields ?? []) {
          const bucket = nodesByItem.get(yield_.itemId) ?? [];
          bucket.push(node);
          nodesByItem.set(yield_.itemId, bucket);
        }
        for (const rare of node.rareYields ?? []) {
          const bucket = nodesByItem.get(rare.itemId) ?? [];
          bucket.push(node);
          nodesByItem.set(rare.itemId, bucket);
        }
      }
    }
    if (world.items) {
      for (const [iid, item] of Object.entries(world.items)) {
        items.set(iid, item);
      }
    }
  }

  return { recipes, nodesByItem, items };
}

export function analyzeCraftingViability(
  config: AppConfig,
  zones: Map<string, { data: WorldFile }>,
): CraftingViabilityRow[] {
  const { recipes, nodesByItem, items } = collectCraftingData(zones);
  const gatherCooldownSec = config.crafting.gatherCooldownMs / 1000;

  return recipes.map(({ zoneId, recipeId, recipe }) => {
    const missing: string[] = [];
    let materialValue = 0;
    let totalGatherAttempts = 0;

    for (const mat of recipe.materials ?? []) {
      const nodes = nodesByItem.get(mat.itemId) ?? [];
      if (nodes.length === 0) missing.push(mat.itemId);
      const item = items.get(mat.itemId);
      materialValue += (item?.basePrice ?? 0) * mat.quantity;

      // Average yield per node — pick the first match; assume mid of min/max.
      const primaryNode = nodes[0];
      let avgYield = 1;
      if (primaryNode) {
        const yieldDef = primaryNode.yields?.find((y) => y.itemId === mat.itemId);
        if (yieldDef) {
          const minQ = yieldDef.minQuantity ?? 1;
          const maxQ = yieldDef.maxQuantity ?? minQ;
          avgYield = Math.max(1, (minQ + maxQ) / 2);
        }
      }
      totalGatherAttempts += Math.ceil(mat.quantity / avgYield);
    }

    const outputItem = items.get(recipe.outputItemId);
    const outputQty = recipe.outputQuantity ?? 1;
    const outputValue = (outputItem?.basePrice ?? 0) * outputQty;
    const estimatedGatherSeconds = totalGatherAttempts * gatherCooldownSec;
    const xp = recipe.xpReward ?? 0;
    const xpPerMinute =
      estimatedGatherSeconds > 0 ? (xp * 60) / estimatedGatherSeconds : 0;

    return {
      recipeId,
      zoneId,
      displayName: recipe.displayName,
      materialsSourced: missing.length === 0,
      missingMaterialIds: missing,
      estimatedGatherSeconds: Math.round(estimatedGatherSeconds),
      materialValue: Math.round(materialValue),
      outputValue: Math.round(outputValue),
      netValue: Math.round(outputValue - materialValue),
      xpPerMinute: Math.round(xpPerMinute * 10) / 10,
    };
  });
}

/** Helper to pick a sensible default tier for a given level. */
export function tierForLevel(tiers: Record<TierKey, MobTierConfig>, level: number): TierKey {
  // Pick tier whose HP at the given level is in a fightable range
  const targetHp = 40 + level * 8;
  let best: TierKey = "standard";
  let bestDiff = Infinity;
  for (const k of TIER_KEYS) {
    const diff = Math.abs(mobHpAtLevel(tiers[k], level) - targetHp);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = k;
    }
  }
  return best;
}
