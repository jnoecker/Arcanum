// ─── Item Budget Derivation ─────────────────────────────────────────
//
// Pure math for tier-based item authoring. Authors pick slot + level +
// tier + archetype + 1–3 stats; this module computes damage / armor /
// per-stat values from those inputs.
//
// Anchored to docs/DERIVED_STATS.md. Calibration:
// - Level scaling 1.1×/level (same as combat scaling rate)
// - Tier curve sized so Legendary = Common at +5 levels
// - Worked example: L5 Rare Damage weapon → ~329 budget →
//   ~10 damage + ~26 stat points (13 / 8 / 5 across primary/secondary/tertiary)

import type { StatMap } from "@/types/world";

// ─── Constants ──────────────────────────────────────────────────────

/** Combat scaling rate. Player HP, player damage, mob HP, mob damage, and
 *  item budgets all scale at this rate per level. */
export const LEVEL_SCALING_RATE = 1.1;

/** Hard cap on any single character stat. */
export const STAT_CAP = 100;

/** XP-per-level growth (xpToNext(n) = XP_L1 × XP_LEVEL_MULTIPLIER^(n-1)). */
export const XP_LEVEL_MULTIPLIER = 1.5;

export type ItemTier =
  | "trash"
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export const ITEM_TIERS: readonly ItemTier[] = [
  "trash",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

/** Tier multiplier on item budget. Each entry corresponds to a common-level
 *  delta (rounded): Legendary at L1 plays like Common at L6. */
export const TIER_MULTIPLIERS: Record<ItemTier, number> = {
  trash: 0.83, // common −2
  common: 1.0,
  uncommon: 1.13, // common +1.25
  rare: 1.27, // common +2.5
  epic: 1.43, // common +3.75
  legendary: 1.61, // common +5
};

export type ItemArchetype = "damage" | "armor" | "balanced" | "stat";

export const ITEM_ARCHETYPES: readonly ItemArchetype[] = [
  "damage",
  "armor",
  "balanced",
  "stat",
] as const;

/** Fraction of total item budget allocated to each output by archetype. */
export const ARCHETYPE_SPLITS: Record<
  ItemArchetype,
  { damage: number; armor: number; stats: number }
> = {
  damage: { damage: 0.6, armor: 0.0, stats: 0.4 },
  armor: { damage: 0.0, armor: 0.6, stats: 0.4 },
  balanced: { damage: 0.3, armor: 0.3, stats: 0.4 },
  stat: { damage: 0.0, armor: 0.0, stats: 1.0 },
};

/** Slots that cannot carry damage or armor — archetype is forced to "stat". */
export const ACCESSORY_SLOTS: ReadonlySet<string> = new Set([
  "ring",
  "neck",
  "wrist",
  "light",
  "held",
  "floating",
  "finger",
  "ear",
]);

/** Default slot base budgets at L1 common. Per-world overrides accepted. */
export const DEFAULT_SLOT_BASE_BUDGETS: Record<string, number> = {
  weapon: 100,
  body: 100,
  torso: 100,
  shield: 70,
  legs: 70,
  arms: 70,
  head: 50,
  feet: 50,
  hands: 50,
  hand: 50,
  back: 50,
  waist: 50,
  ring: 40,
  neck: 40,
  wrist: 40,
  finger: 40,
  ear: 40,
  light: 30,
  held: 30,
  floating: 30,
};

/** Fallback when a slot has no entry in DEFAULT_SLOT_BASE_BUDGETS. */
export const FALLBACK_SLOT_BASE = 50;

export interface PointCosts {
  /** Budget points per 1 damage. */
  damagePointCost: number;
  /** Budget points per 1 armor. */
  armorPointCost: number;
  /** Budget points per 1 stat point. */
  statPointCost: number;
}

/** Default point costs. Tunable in playtest — re-tune in this constant when
 *  the per-level fight pacing diverges from the calibration target. */
export const DEFAULT_POINT_COSTS: PointCosts = {
  damagePointCost: 20,
  armorPointCost: 10,
  statPointCost: 5,
};

// ─── Inputs / outputs ──────────────────────────────────────────────

export interface ItemDerivationInput {
  slot: string;
  level: number;
  tier: ItemTier;
  archetype: ItemArchetype;
  primaryStat?: string;
  secondaryStat?: string;
  tertiaryStat?: string;
  /** Optional per-world override map. Falls back to DEFAULT_SLOT_BASE_BUDGETS. */
  slotBudgets?: Record<string, number>;
  /** Optional point-cost overrides. Falls back to DEFAULT_POINT_COSTS. */
  pointCosts?: Partial<PointCosts>;
}

export interface ItemBudgetBreakdown {
  totalBudget: number;
  damageBudget: number;
  armorBudget: number;
  statBudget: number;
}

export interface ItemDerivationOutput {
  budget: ItemBudgetBreakdown;
  damage: number;
  armor: number;
  stats: StatMap;
  /** Archetype actually used after slot-based forcing (accessories → stat). */
  effectiveArchetype: ItemArchetype;
}

// ─── Pure functions ────────────────────────────────────────────────

/** Multiplier on item budget for a given level (1.1^(level-1)). */
export function levelBudgetMultiplier(level: number): number {
  const steps = Math.max(0, level - 1);
  return Math.pow(LEVEL_SCALING_RATE, steps);
}

/** Multiplier on combat stats (player HP, damage, mob HP, etc.) for level. */
export function combatScalingAtLevel(level: number): number {
  return levelBudgetMultiplier(level);
}

/** Look up the slot's base budget, falling back to default then FALLBACK_SLOT_BASE. */
export function resolveSlotBase(
  slot: string,
  slotBudgets?: Record<string, number>,
): number {
  const overrideValue = slotBudgets?.[slot];
  if (typeof overrideValue === "number" && overrideValue > 0) return overrideValue;
  const defaultValue = DEFAULT_SLOT_BASE_BUDGETS[slot];
  if (typeof defaultValue === "number" && defaultValue > 0) return defaultValue;
  return FALLBACK_SLOT_BASE;
}

/** Force archetype = "stat" for accessory slots that can't carry dmg/armor. */
export function effectiveArchetypeForSlot(
  slot: string,
  archetype: ItemArchetype,
): ItemArchetype {
  if (ACCESSORY_SLOTS.has(slot)) return "stat";
  return archetype;
}

/** Total raw budget points before archetype split. */
export function itemTotalBudget(
  slot: string,
  level: number,
  tier: ItemTier,
  slotBudgets?: Record<string, number>,
): number {
  const slotBase = resolveSlotBase(slot, slotBudgets);
  const tierMult = TIER_MULTIPLIERS[tier];
  return slotBase * levelBudgetMultiplier(level) * tierMult;
}

/** Split total budget into damage / armor / stat buckets per archetype. */
export function splitItemBudget(
  totalBudget: number,
  archetype: ItemArchetype,
): ItemBudgetBreakdown {
  const split = ARCHETYPE_SPLITS[archetype];
  return {
    totalBudget,
    damageBudget: totalBudget * split.damage,
    armorBudget: totalBudget * split.armor,
    statBudget: totalBudget * split.stats,
  };
}

/** Distribute a stat-budget across 1–3 stat IDs.
 *
 *  Returns an empty map if no stats are picked or statBudget is 0.
 *  Distribution:
 *    1 stat  → 100% primary
 *    2 stats → 60% primary / 40% secondary
 *    3 stats → 50% primary / 30% secondary / 20% tertiary
 */
export function distributeStats(
  statBudget: number,
  primary?: string,
  secondary?: string,
  tertiary?: string,
  statPointCost: number = DEFAULT_POINT_COSTS.statPointCost,
): StatMap {
  if (statBudget <= 0 || statPointCost <= 0) return {};

  const picks: string[] = [];
  if (primary) picks.push(primary);
  if (secondary) picks.push(secondary);
  if (tertiary) picks.push(tertiary);
  if (picks.length === 0) return {};

  let weights: number[];
  if (picks.length === 1) weights = [1.0];
  else if (picks.length === 2) weights = [0.6, 0.4];
  else weights = [0.5, 0.3, 0.2];

  const out: StatMap = {};
  for (let i = 0; i < picks.length; i++) {
    const id = picks[i]!;
    const points = Math.round((statBudget * weights[i]!) / statPointCost);
    if (points > 0) {
      // Stack if author picked the same stat twice (defensive; UI should prevent).
      out[id] = (out[id] ?? 0) + points;
    }
  }
  return out;
}

/** Top-level entry: given author inputs, produce derived item stats. */
export function deriveItemStats(input: ItemDerivationInput): ItemDerivationOutput {
  const effectiveArchetype = effectiveArchetypeForSlot(input.slot, input.archetype);
  const totalBudget = itemTotalBudget(input.slot, input.level, input.tier, input.slotBudgets);
  const breakdown = splitItemBudget(totalBudget, effectiveArchetype);

  const costs: PointCosts = { ...DEFAULT_POINT_COSTS, ...input.pointCosts };

  const damage =
    breakdown.damageBudget > 0
      ? Math.round(breakdown.damageBudget / costs.damagePointCost)
      : 0;
  const armor =
    breakdown.armorBudget > 0
      ? Math.round(breakdown.armorBudget / costs.armorPointCost)
      : 0;
  const stats = distributeStats(
    breakdown.statBudget,
    input.primaryStat,
    input.secondaryStat,
    input.tertiaryStat,
    costs.statPointCost,
  );

  return {
    budget: breakdown,
    damage,
    armor,
    stats,
    effectiveArchetype,
  };
}
