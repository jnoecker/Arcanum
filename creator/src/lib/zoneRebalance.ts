// ─── Zone Rebalance Engine ──────────────────────────────────────────
//
// Pure deterministic restat pass. The world's tuning math (tier baselines,
// item budgets) owns every combat number; this module rewrites the zone so
// those numbers match the rules. Hand-tuned overrides on individual mobs
// or items are intentionally dropped — keeping them defeats the point of
// having a math layer.
//
// Preserved per-mob: name, description, image, video, behavior, dialogue,
// quests, drops, faction, spells, role, tier, respawnSeconds, toughness,
// per-mob mults (hpMult/dmgMult/xpMult/goldMult).
//
// Preserved per-item: displayName, description, slot, classes, keyword,
// room, mob, basePrice, image, video, onUse, charges, consumable, itemType,
// questItem, matchByKey, archetype, primary/secondary/tertiary stat IDs.

import type { AppConfig, MobTierConfig } from "@/types/config";
import type { ItemFile, MobFile, MobRole, WorldFile } from "@/types/world";
import {
  mobGoldMaxAtLevel,
  mobGoldMinAtLevel,
  mobHpAtLevel,
  mobMaxDamageAtLevel,
  mobMinDamageAtLevel,
  mobXpRewardAtLevel,
} from "./tuning/formulas";
import {
  deriveItemStats,
  ITEM_TIERS,
  type ItemArchetype,
  type ItemTier,
} from "./tuning/itemBudget";

export type MobClassification = "trash" | "named" | "non-combat";

export type DifficultyHint = "casual" | "standard" | "challenging";

export interface ZoneRebalanceSummary {
  band: { min: number; max: number };
  difficulty: DifficultyHint;
  mobsRestated: number;
  mobsSkippedNonCombat: number;
  mobsSkippedNoTier: number;
  itemsRestated: number;
  itemsSkipped: number;
  bandClampedToScaling: boolean;
  /** Player-scaled zones derive levels at runtime; rebalance is a no-op. */
  playerScaledNoOp: boolean;
}

export interface ZoneRebalanceResult {
  world: WorldFile;
  summary: ZoneRebalanceSummary;
}

// ─── Level placement ────────────────────────────────────────────────

/**
 * Distribute mob levels by tier within the band.
 * weak → min, standard → mid, elite → max-1 (clamped), boss → max.
 * Difficulty hint nudges standard/elite by ±1.
 */
export function targetLevelForTier(
  tier: string,
  band: { min: number; max: number },
  difficultyHint: DifficultyHint = "standard",
): number {
  const { min, max } = band;
  const mid = Math.round((min + max) / 2);
  const offset = difficultyHint === "casual" ? -1 : difficultyHint === "challenging" ? 1 : 0;
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
 * Distribute item levels by tier within the band so rarer items target the
 * upper end. Mirrors the loot composition philosophy ("epic = endgame for
 * this zone").
 */
export function targetLevelForItemTier(
  tier: ItemTier,
  band: { min: number; max: number },
): number {
  const { min, max } = band;
  const mid = Math.round((min + max) / 2);
  switch (tier) {
    case "legendary":
    case "epic":
      return max;
    case "rare":
      return Math.min(max, mid + 1);
    case "uncommon":
      return mid;
    case "common":
      return Math.max(min, mid - 1);
    case "trash":
      return min;
  }
}

// ─── Classification ─────────────────────────────────────────────────

/**
 * Classify a mob for rebalance treatment. `non-combat` mobs are skipped
 * entirely (rewriting a shopkeeper's level is almost always a mistake).
 * `named` vs `trash` is informational only — both get restated.
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

// ─── Band inference + clamping ──────────────────────────────────────

/**
 * Infer a sensible default level band from the zone, falling through:
 * bounded-scaling range → persisted levelBand → explicit mob levels →
 * tier mix → generic fallback.
 */
export function inferLevelBand(zone: WorldFile): { min: number; max: number } {
  if (zone.scaling?.mode === "bounded" && zone.scaling.levelRange) {
    const [min, max] = zone.scaling.levelRange;
    return { min, max };
  }
  if (zone.levelBand) return zone.levelBand;
  const mobs = Object.values(zone.mobs ?? {}).filter((m) => (m.role ?? "combat") === "combat");
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

// ─── Pure restat helpers ────────────────────────────────────────────

const MOB_OVERRIDE_FIELDS = [
  "hp",
  "minDamage",
  "maxDamage",
  "armor",
  "xpReward",
  "goldMin",
  "goldMax",
] as const;

/**
 * Restat a single combatant mob deterministically. Sets the level and drops
 * authored overrides for hp/damage/xp/gold/armor — tier formulas in the
 * server's `application.yaml` are the source of truth at runtime, and
 * keeping local overrides defeats the point of having a math layer.
 * Per-mob mults (hpMult / dmgMult / xpMult / goldMult / toughness) are
 * preserved as flavor knobs.
 */
export function restatMob(mob: MobFile, level: number, tier: MobTierConfig): MobFile {
  // Reference the formulas so the helper graph stays connected — these
  // values aren't written into the YAML (the server computes them at
  // runtime from tier × level) but the import is what makes targeted
  // refactors easier later if we ever do bake values into the file.
  void mobHpAtLevel(tier, level);
  void mobMinDamageAtLevel(tier, level);
  void mobMaxDamageAtLevel(tier, level);
  void mobXpRewardAtLevel(tier, level);
  void mobGoldMinAtLevel(tier, level);
  void mobGoldMaxAtLevel(tier, level);

  const next: MobFile = { ...mob, level };
  for (const field of MOB_OVERRIDE_FIELDS) {
    delete (next as unknown as Record<string, unknown>)[field];
  }
  return next;
}

function inferArchetypeFromSlot(slot: string | undefined): ItemArchetype {
  if (!slot) return "balanced";
  const lower = slot.toLowerCase();
  if (lower.includes("weapon") || lower === "wielded" || lower === "main" || lower === "off") {
    return "damage";
  }
  if (
    lower.includes("body") ||
    lower.includes("chest") ||
    lower.includes("shield") ||
    lower.includes("head") ||
    lower.includes("legs") ||
    lower.includes("feet") ||
    lower.includes("hands")
  ) {
    return "armor";
  }
  return "balanced";
}

/**
 * Restat a single equippable item. Computes damage/armor/stats from the
 * deterministic budget pipeline. Skips items without a slot (consumables,
 * quest items, treasure) — they don't have a stat budget to compute.
 *
 * Returns the item unchanged if it has no slot, no tier, or is marked
 * `consumable: true` (those have their own on-use math).
 */
export function restatItem(
  item: ItemFile,
  level: number,
  slotBudgets?: Record<string, number>,
): ItemFile {
  if (!item.slot || item.consumable === true) return item;
  const tier = (item.tier ?? "common") as ItemTier;
  if (!ITEM_TIERS.includes(tier)) return item;

  const archetype: ItemArchetype = item.archetype ?? inferArchetypeFromSlot(item.slot);
  const derived = deriveItemStats({
    slot: item.slot,
    level,
    tier,
    archetype,
    primaryStat: item.primaryStat,
    secondaryStat: item.secondaryStat,
    tertiaryStat: item.tertiaryStat,
    slotBudgets,
  });

  // Re-build the item, overwriting only the math-owned fields. Drop zero
  // damage/armor so the YAML stays clean for archetypes that don't carry
  // those (e.g. accessory items have zero damage and zero armor).
  const next: ItemFile = {
    ...item,
    level,
    tier,
    archetype: derived.effectiveArchetype,
    stats: derived.stats,
  };
  if (derived.damage > 0) next.damage = derived.damage;
  else delete (next as unknown as Record<string, unknown>).damage;
  if (derived.armor > 0) next.armor = derived.armor;
  else delete (next as unknown as Record<string, unknown>).armor;
  return next;
}

// ─── Top-level entry ────────────────────────────────────────────────

/**
 * Rebalance an entire zone deterministically. Combatant mobs are restated
 * against their tier baseline at the target level; equippable items are
 * restated against the deterministic budget formula. Names, descriptions,
 * behavior, dialogue, drops graph, quests, and class restrictions are
 * preserved.
 *
 * Player-scaled zones (scaling.mode = "player") short-circuit — the server
 * derives mob levels at runtime from the killer's level, so authored levels
 * don't do anything. The caller should surface the no-op in the UI.
 */
export function rebalanceZone(world: WorldFile, config: AppConfig): ZoneRebalanceResult {
  const playerScaledNoOp = world.scaling?.mode === "player";
  if (playerScaledNoOp) {
    return {
      world,
      summary: {
        band: world.levelBand ?? { min: 1, max: 1 },
        difficulty: world.difficultyHint ?? "standard",
        mobsRestated: 0,
        mobsSkippedNonCombat: 0,
        mobsSkippedNoTier: 0,
        itemsRestated: 0,
        itemsSkipped: 0,
        bandClampedToScaling: false,
        playerScaledNoOp: true,
      },
    };
  }

  // Prefer the explicitly authored band over inference so the rebalance
  // honors whatever the wizard or YAML author set. Then clamp to scaling
  // bounds — if a wider band was set on a bounded zone, we clip the wings
  // and surface that in the summary.
  const requestedBand = world.levelBand ?? inferLevelBand(world);
  const { band, clamped } = clampBandToScaling(requestedBand, world);
  const difficulty: DifficultyHint = world.difficultyHint ?? "standard";

  let mobsRestated = 0;
  let mobsSkippedNonCombat = 0;
  let mobsSkippedNoTier = 0;
  const nextMobs: Record<string, MobFile> = {};
  for (const [mobId, mob] of Object.entries(world.mobs ?? {})) {
    if (classifyMob(mob) === "non-combat") {
      nextMobs[mobId] = mob;
      mobsSkippedNonCombat++;
      continue;
    }
    const tierKey = mob.tier ?? "standard";
    const tier = config.mobTiers?.[tierKey as keyof typeof config.mobTiers];
    if (!tier) {
      nextMobs[mobId] = mob;
      mobsSkippedNoTier++;
      continue;
    }
    const level = targetLevelForTier(tierKey, band, difficulty);
    nextMobs[mobId] = restatMob(mob, level, tier);
    mobsRestated++;
  }

  let itemsRestated = 0;
  let itemsSkipped = 0;
  const nextItems: Record<string, ItemFile> = {};
  for (const [itemId, item] of Object.entries(world.items ?? {})) {
    if (!item.slot || item.consumable === true) {
      nextItems[itemId] = item;
      itemsSkipped++;
      continue;
    }
    const tier = (item.tier ?? "common") as ItemTier;
    const itemLevel = targetLevelForItemTier(tier, band);
    const restated = restatItem(item, itemLevel);
    if (restated === item) {
      itemsSkipped++;
    } else {
      itemsRestated++;
    }
    nextItems[itemId] = restated;
  }

  const nextWorld: WorldFile = {
    ...world,
    levelBand: { ...band },
    difficultyHint: difficulty,
    mobs: nextMobs,
    items: Object.keys(nextItems).length > 0 ? nextItems : world.items,
  };

  return {
    world: nextWorld,
    summary: {
      band,
      difficulty,
      mobsRestated,
      mobsSkippedNonCombat,
      mobsSkippedNoTier,
      itemsRestated,
      itemsSkipped,
      bandClampedToScaling: clamped,
      playerScaledNoOp: false,
    },
  };
}
