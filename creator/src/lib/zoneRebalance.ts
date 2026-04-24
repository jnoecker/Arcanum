// ─── Zone Rebalance Engine ──────────────────────────────────────────
//
// Pure functions for computing and applying a level/difficulty rebalance
// across a zone's mobs. Given a target level band, computes per-mob
// level changes and surfaces stat overrides that diverge from the tier
// baseline at the new level.
//
// Mobs are classified as "trash" (auto-apply safe) or "named" (require
// review) based on tier + presence of quests / dialogue / drops.

import type { AppConfig, MobTierConfig } from "@/types/config";
import type { MobFile, MobRole, WorldFile } from "@/types/world";
import {
  mobAvgGoldAtLevel,
  mobGoldMaxAtLevel,
  mobGoldMinAtLevel,
  mobHpAtLevel,
  mobMaxDamageAtLevel,
  mobMinDamageAtLevel,
  mobXpRewardAtLevel,
} from "./tuning/formulas";

export type MobClassification = "trash" | "named" | "non-combat";

/**
 * Why the engine declined to produce a diff at all. `player`-scaled zones
 * derive mob levels from the reference player at runtime, so authored
 * levels don't do anything — the wizard has nothing to rewrite.
 */
export type RebalanceAvailability = "applicable" | "player-scaled";

export type OverrideField =
  | "hp"
  | "minDamage"
  | "maxDamage"
  | "armor"
  | "xpReward"
  | "goldMin"
  | "goldMax";

export type OverrideAction = "drop" | "keep" | "flag";

export interface OverrideChange {
  field: OverrideField;
  currentOverride: number;
  tierBaseline: number;
  action: OverrideAction;
}

export interface MobRebalanceDiff {
  mobId: string;
  displayName: string;
  tier: string;
  currentLevel: number | null;
  targetLevel: number;
  levelChanged: boolean;
  classification: MobClassification;
  overrideChanges: OverrideChange[];
}

export interface ZoneRebalanceTarget {
  levelBand: { min: number; max: number };
  difficultyHint?: "casual" | "standard" | "challenging";
}

export interface ZoneRebalanceDiff {
  target: ZoneRebalanceTarget;
  mobs: MobRebalanceDiff[];
  /** Mob IDs without a known tier in config — engine couldn't compute baselines. */
  skippedMobIds: string[];
  /**
   * Whether the zone can be rebalanced at all. `player-scaled` zones bail out
   * before any per-mob work — consumers should render the explanatory empty
   * state rather than the usual review/apply UI.
   */
  availability: RebalanceAvailability;
  /**
   * True when the target band had to be narrowed to fit the zone's bounded
   * scaling range. UI surfaces this as a hint so the designer knows their
   * request was clamped.
   */
  bandClampedToScaling: boolean;
}

// ─── Heuristics ─────────────────────────────────────────────────────

/**
 * Distribute mob levels by tier within the band.
 * weak → min, standard → mid, elite → max-1 (clamped), boss → max.
 */
export function targetLevelForTier(
  tier: string,
  band: { min: number; max: number },
  difficultyHint: ZoneRebalanceTarget["difficultyHint"] = "standard",
): number {
  const { min, max } = band;
  const mid = Math.round((min + max) / 2);
  const offset =
    difficultyHint === "casual"
      ? -1
      : difficultyHint === "challenging"
        ? 1
        : 0;
  const clamp = (value: number) => Math.max(min, Math.min(max, value));
  switch (tier) {
    case "weak":
      return difficultyHint === "challenging" ? clamp(min + 1) : min;
    case "elite":
      return clamp(Math.max(min, max - 1) + offset);
    case "boss":
      return max;
    case "standard":
    default:
      return clamp(mid + offset);
  }
}

/**
 * Classify a mob for the rebalance wizard.
 *
 * - `non-combat` — vendor / quest_giver / dialog / prop mobs. The engine
 *   never rewrites their level or stats; leveling a shopkeeper or a flavor
 *   NPC is almost always a mistake.
 * - `named` — boss tier, or combat mobs with quests/dialogue/drops.
 *   Require review before rewriting.
 * - `trash` — everything else. Safe to batch-apply.
 */
export function classifyMob(mob: MobFile): MobClassification {
  const role: MobRole = mob.role ?? "combat";
  if (role !== "combat") return "non-combat";
  if (mob.tier === "boss" || mob.tier === "elite") return "named";
  if (mob.quests && mob.quests.length > 0) return "named";
  if (mob.dialogue && Object.keys(mob.dialogue).length > 0) return "named";
  if (mob.drops && mob.drops.length > 0) return "named";
  return "trash";
}

/** Within ±10% — small enough to drop the override and let tier formula take over. */
function withinTolerance(actual: number, baseline: number, tolerance = 0.1): boolean {
  if (baseline === 0) return actual === 0;
  return Math.abs(actual - baseline) / Math.abs(baseline) <= tolerance;
}

function computeOverrideChange(
  field: OverrideField,
  currentOverride: number,
  tierBaseline: number,
): OverrideChange {
  const action: OverrideAction = withinTolerance(currentOverride, tierBaseline)
    ? "drop"
    : "flag";
  return {
    field,
    currentOverride,
    tierBaseline: Math.round(tierBaseline * 10) / 10,
    action,
  };
}

/**
 * For a mob's set overrides (hp, damage, xp, gold), compute whether
 * each diverges from the tier baseline at the new level enough to
 * preserve, or is close enough to drop.
 */
function diffMobOverrides(
  mob: MobFile,
  tier: MobTierConfig,
  targetLevel: number,
): OverrideChange[] {
  const changes: OverrideChange[] = [];

  if (mob.hp != null) {
    changes.push(computeOverrideChange("hp", mob.hp, mobHpAtLevel(tier, targetLevel)));
  }
  const tierMinDmg = mobMinDamageAtLevel(tier, targetLevel);
  const tierMaxDmg = mobMaxDamageAtLevel(tier, targetLevel);
  if (mob.minDamage != null) {
    changes.push(computeOverrideChange("minDamage", mob.minDamage, tierMinDmg));
  }
  if (mob.maxDamage != null) {
    changes.push(computeOverrideChange("maxDamage", mob.maxDamage, tierMaxDmg));
  }
  if (mob.armor != null) {
    changes.push(computeOverrideChange("armor", mob.armor, tier.baseArmor));
  }
  const tierXp = mobXpRewardAtLevel(tier, targetLevel);
  if (mob.xpReward != null) {
    changes.push(computeOverrideChange("xpReward", mob.xpReward, tierXp));
  }
  const tierGoldMin = mobGoldMinAtLevel(tier, targetLevel);
  const tierGoldMax = mobGoldMaxAtLevel(tier, targetLevel);
  if (mob.goldMin != null) {
    changes.push(computeOverrideChange("goldMin", mob.goldMin, tierGoldMin));
  }
  if (mob.goldMax != null) {
    changes.push(computeOverrideChange("goldMax", mob.goldMax, tierGoldMax));
  }
  // Keep the average helper referenced so the diff output stays consistent with
  // the preview metrics elsewhere in the tuning UI.
  void mobAvgGoldAtLevel(tier, targetLevel);

  return changes;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Infer a sensible default level band from the zone's existing mobs,
 * using whichever signal is available: bounded-scaling range, then the
 * zone's persisted levelBand, then explicit mob levels, then tier mix,
 * then a generic fallback.
 */
export function inferLevelBand(zone: WorldFile): { min: number; max: number } {
  if (zone.scaling?.mode === "bounded" && zone.scaling.levelRange) {
    const [min, max] = zone.scaling.levelRange;
    return { min, max };
  }
  if (zone.levelBand) return zone.levelBand;
  const mobs = Object.values(zone.mobs ?? {})
    .filter((m) => (m.role ?? "combat") === "combat");
  const explicit = mobs.map((m) => m.level).filter((l): l is number => l != null && l > 0);
  if (explicit.length > 0) {
    return { min: Math.min(...explicit), max: Math.max(...explicit) };
  }
  const tiers = new Set(mobs.map((m) => m.tier).filter((t): t is string => !!t));
  if (tiers.has("boss") || tiers.has("elite")) return { min: 5, max: 10 };
  if (tiers.has("standard")) return { min: 3, max: 7 };
  if (tiers.has("weak")) return { min: 1, max: 5 };
  return { min: 1, max: 5 };
}

function clampBandToScaling(
  band: { min: number; max: number },
  zone: WorldFile,
): { band: { min: number; max: number }; clamped: boolean } {
  if (zone.scaling?.mode !== "bounded" || !zone.scaling.levelRange) {
    return { band, clamped: false };
  }
  const [scalingMin, scalingMax] = zone.scaling.levelRange;
  const min = Math.max(scalingMin, Math.min(scalingMax, band.min));
  const max = Math.max(min, Math.min(scalingMax, band.max));
  const clamped = min !== band.min || max !== band.max;
  return { band: { min, max }, clamped };
}

/**
 * Compute a structured diff describing how each mob would change under
 * the given target. Pure — does not mutate the zone.
 *
 * Player-scaled zones short-circuit: authored levels don't affect runtime,
 * so the wizard returns `availability: "player-scaled"` with an empty
 * mob list. Bounded zones have their target band clamped to the zone's
 * scaling range; the returned `target.levelBand` reflects the clamped
 * values and `bandClampedToScaling` flags when that happened.
 */
export function computeZoneRebalance(
  zone: WorldFile,
  config: Pick<AppConfig, "mobTiers">,
  target: ZoneRebalanceTarget,
): ZoneRebalanceDiff {
  if (zone.scaling?.mode === "player") {
    return {
      target,
      mobs: [],
      skippedMobIds: [],
      availability: "player-scaled",
      bandClampedToScaling: false,
    };
  }

  const { band: effectiveBand, clamped } = clampBandToScaling(target.levelBand, zone);
  const effectiveTarget: ZoneRebalanceTarget = { ...target, levelBand: effectiveBand };

  const mobs: MobRebalanceDiff[] = [];
  const skippedMobIds: string[] = [];

  for (const [mobId, mob] of Object.entries(zone.mobs ?? {})) {
    const classification = classifyMob(mob);
    const tierKey = mob.tier ?? "standard";
    const tier = config.mobTiers?.[tierKey as keyof typeof config.mobTiers];
    const currentLevel = mob.level ?? null;

    if (classification === "non-combat") {
      mobs.push({
        mobId,
        displayName: mob.name || mobId,
        tier: tierKey,
        currentLevel,
        targetLevel: currentLevel ?? effectiveBand.min,
        levelChanged: false,
        classification,
        overrideChanges: [],
      });
      continue;
    }

    if (!tier) {
      skippedMobIds.push(mobId);
      continue;
    }

    const targetLevel = targetLevelForTier(tierKey, effectiveBand, target.difficultyHint);
    mobs.push({
      mobId,
      displayName: mob.name || mobId,
      tier: tierKey,
      currentLevel,
      targetLevel,
      levelChanged: currentLevel !== targetLevel,
      classification,
      overrideChanges: diffMobOverrides(mob, tier, targetLevel),
    });
  }

  // Order: named first (review top), then trash, then non-combat (informational).
  const rank: Record<MobClassification, number> = { named: 0, trash: 1, "non-combat": 2 };
  mobs.sort((a, b) => {
    if (a.classification !== b.classification) {
      return rank[a.classification] - rank[b.classification];
    }
    return a.mobId.localeCompare(b.mobId);
  });

  return {
    target: effectiveTarget,
    mobs,
    skippedMobIds,
    availability: "applicable",
    bandClampedToScaling: clamped,
  };
}

// ─── Apply ──────────────────────────────────────────────────────────

export interface ApplySelection {
  /** Mob IDs whose level change should be applied. */
  acceptedMobIds: Set<string>;
  /**
   * Per-mob, per-field override decisions. Missing entries default to
   * the action computed in the diff. Lets the UI override "drop" → "keep"
   * for individual fields the designer wants to preserve.
   */
  overrideOverrides?: Map<string, Map<OverrideField, OverrideAction>>;
}

/**
 * Produce a new WorldFile reflecting the accepted parts of the diff.
 * Sets `zone.levelBand` and `zone.difficultyHint` so the choice is
 * persistent for future rebalances.
 */
export function applyZoneRebalance(
  zone: WorldFile,
  diff: ZoneRebalanceDiff,
  selection: ApplySelection,
): WorldFile {
  const next: WorldFile = {
    ...zone,
    levelBand: { ...diff.target.levelBand },
    mobs: { ...(zone.mobs ?? {}) },
  };
  if (diff.target.difficultyHint) {
    next.difficultyHint = diff.target.difficultyHint;
  } else {
    delete next.difficultyHint;
  }

  for (const mobDiff of diff.mobs) {
    if (!selection.acceptedMobIds.has(mobDiff.mobId)) continue;
    const original = zone.mobs?.[mobDiff.mobId];
    if (!original) continue;

    const updated: MobFile = { ...original };
    if (mobDiff.levelChanged) {
      updated.level = mobDiff.targetLevel;
    }

    const fieldOverrides = selection.overrideOverrides?.get(mobDiff.mobId);
    for (const change of mobDiff.overrideChanges) {
      const action = fieldOverrides?.get(change.field) ?? change.action;
      if (action === "drop") {
        delete updated[change.field];
      }
      // "keep" / "flag" → leave existing override in place
    }

    next.mobs![mobDiff.mobId] = updated;
  }

  return next;
}
