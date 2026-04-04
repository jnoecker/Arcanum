/**
 * Tier sprite scaffolding — computes expected race×class×tier combos,
 * detects gaps vs existing definitions, and creates missing definitions.
 */
import type { AppConfig, TierDefinitionConfig } from "@/types/config";
import type { SpriteDefinition } from "@/types/sprites";
import { DEFAULT_TIER_DEFINITIONS } from "./defaultSpriteData";

// ─── Types ──────────────────────────────────────────────────────────

export interface TierSpriteSlot {
  /** Canonical ID: race_class_tier (e.g. "archae_arcanist_t25") */
  id: string;
  race: string;
  playerClass: string;
  tier: string;
  tierDisplayName: string;
  minLevel: number | null;
  isStaff: boolean;
}

export interface GapSummary {
  /** All slots the tier system expects */
  expected: TierSpriteSlot[];
  /** Slots that already have a matching definition */
  existing: TierSpriteSlot[];
  /** Slots with no matching definition */
  missing: TierSpriteSlot[];
  /** Counts grouped by tier key */
  byTier: Record<string, { total: number; existing: number; missing: number }>;
}

// ─── Slot computation ───────────────────────────────────────────────

/** Parse the starting level from a tier's level string (e.g. "10–24" → 10). */
function tierStartLevel(def: TierDefinitionConfig): number | null {
  const match = def.levels.match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * Compute the full expected set of tier sprite slots from config.
 *
 * Rules:
 * - Lowest tier (t1): every race × "base" only (race identity, no class gear)
 * - Middle/high tiers (t10, t25, t50…): every race × every real class
 * - tstaff: every race × "base" only (god-tier staff sprites)
 */
export function computeExpectedSlots(config: AppConfig): TierSpriteSlot[] {
  const races = Object.keys(config.races);
  const classes = Object.keys(config.classes).filter((c) => c !== "base");

  // Derive tiers from spriteLevelTiers breakpoints, with playerTiers providing definitions
  const breakpoints = [...config.images.spriteLevelTiers].sort((a, b) => a - b);
  const tierDefs: Record<string, TierDefinitionConfig> = {};
  for (const level of breakpoints) {
    const key = `t${level}`;
    const nextLevel = breakpoints[breakpoints.indexOf(level) + 1];
    tierDefs[key] = config.playerTiers?.[key]
      ?? DEFAULT_TIER_DEFINITIONS[key]
      ?? {
        displayName: `Tier ${level}`,
        levels: nextLevel ? `${level}–${nextLevel - 1}` : `${level}`,
        visualDescription: "",
      };
  }
  // Always include tstaff
  tierDefs.tstaff = config.playerTiers?.tstaff
    ?? DEFAULT_TIER_DEFINITIONS.tstaff
    ?? { displayName: "Staff", levels: "—", visualDescription: "Game administrator." };

  // Sort tiers by start level (ascending), with tstaff last
  const tierEntries = Object.entries(tierDefs).sort(([ka, a], [kb, b]) => {
    if (ka === "tstaff") return 1;
    if (kb === "tstaff") return -1;
    return (tierStartLevel(a) ?? 0) - (tierStartLevel(b) ?? 0);
  });

  const lowestTierKey = tierEntries.find(([k]) => k !== "tstaff")?.[0];
  const slots: TierSpriteSlot[] = [];

  for (const [tierKey, tierDef] of tierEntries) {
    const isStaff = tierKey === "tstaff";
    const isBase = tierKey === lowestTierKey;
    const minLevel = tierStartLevel(tierDef);

    if (isStaff || isBase) {
      // Race-only sprites (no class differentiation)
      for (const race of races) {
        slots.push({
          id: `${race}_base_${tierKey}`,
          race,
          playerClass: "base",
          tier: tierKey,
          tierDisplayName: tierDef.displayName,
          minLevel,
          isStaff,
        });
      }
    } else {
      // Race × class sprites
      for (const race of races) {
        for (const cls of classes) {
          slots.push({
            id: `${race}_${cls}_${tierKey}`,
            race,
            playerClass: cls,
            tier: tierKey,
            tierDisplayName: tierDef.displayName,
            minLevel,
            isStaff: false,
          });
        }
      }
    }
  }

  return slots;
}

// ─── Gap detection ──────────────────────────────────────────────────

/** Check if an existing definition matches a tier slot. */
function definitionMatchesSlot(
  id: string,
  def: SpriteDefinition,
  slot: TierSpriteSlot,
): boolean {
  // Quick check: if the definition ID matches the slot ID, it's a match
  if (id === slot.id) return true;

  // Otherwise check requirements
  const raceReq = def.requirements.find((r) => r.type === "race");
  const classReq = def.requirements.find((r) => r.type === "class");
  const levelReq = def.requirements.find((r) => r.type === "minLevel");
  const staffReq = def.requirements.find((r) => r.type === "staff");

  if (slot.isStaff) {
    return (
      Boolean(staffReq || def.category === "staff") &&
      (raceReq?.type === "race" && raceReq.race === slot.race) === true
    );
  }

  const raceMatch = raceReq?.type === "race" && raceReq.race === slot.race;
  if (!raceMatch) return false;

  // For base class (lowest tier), just need race match + no class requirement
  if (slot.playerClass === "base") {
    return !classReq && (levelReq == null || (levelReq.type === "minLevel" && levelReq.level === (slot.minLevel ?? 1)));
  }

  // For class tiers, need race + class + level match
  const classMatch = classReq?.type === "class" && classReq.playerClass === slot.playerClass;
  const levelMatch = levelReq?.type === "minLevel" && levelReq.level === slot.minLevel;
  return classMatch === true && levelMatch === true;
}

/** Compute which tier sprite slots are missing from existing definitions. */
export function computeGaps(
  config: AppConfig,
  definitions: Record<string, SpriteDefinition>,
): GapSummary {
  const expected = computeExpectedSlots(config);
  const defEntries = Object.entries(definitions);

  const existing: TierSpriteSlot[] = [];
  const missing: TierSpriteSlot[] = [];

  for (const slot of expected) {
    const found = defEntries.some(([id, def]) => definitionMatchesSlot(id, def, slot));
    if (found) {
      existing.push(slot);
    } else {
      missing.push(slot);
    }
  }

  // Group by tier
  const byTier: GapSummary["byTier"] = {};
  for (const slot of expected) {
    if (!byTier[slot.tier]) byTier[slot.tier] = { total: 0, existing: 0, missing: 0 };
    byTier[slot.tier]!.total++;
  }
  for (const slot of existing) {
    byTier[slot.tier]!.existing++;
  }
  for (const slot of missing) {
    byTier[slot.tier]!.missing++;
  }

  return { expected, existing, missing, byTier };
}

// ─── Definition scaffolding ─────────────────────────────────────────

/** Build a display name for a tier sprite slot. */
function slotDisplayName(slot: TierSpriteSlot, config: AppConfig): string {
  const raceName = config.races[slot.race]?.displayName ?? slot.race;
  if (slot.isStaff) return `${raceName} (Staff)`;
  if (slot.playerClass === "base") return `${raceName} (${slot.tierDisplayName})`;
  const className = config.classes[slot.playerClass]?.displayName ?? slot.playerClass;
  return `${raceName} ${className} (${slot.tierDisplayName})`;
}

/** Create a SpriteDefinition for a missing tier slot. */
export function scaffoldDefinition(
  slot: TierSpriteSlot,
  config: AppConfig,
  sortBase: number,
): SpriteDefinition {
  const def: SpriteDefinition = {
    displayName: slotDisplayName(slot, config),
    category: slot.isStaff ? "staff" : "general",
    sortOrder: sortBase,
    requirements: [],
    image: `player_sprites/${slot.id}.png`,
  };

  // Add requirements
  def.requirements.push({ type: "race", race: slot.race });

  if (slot.isStaff) {
    def.requirements.push({ type: "staff" });
  } else if (slot.playerClass !== "base") {
    def.requirements.push({ type: "class", playerClass: slot.playerClass });
  }

  if (slot.minLevel != null && !slot.isStaff) {
    def.requirements.push({ type: "minLevel", level: slot.minLevel });
  }

  return def;
}

/** Scaffold definitions for all given slots. Returns [id, definition] pairs. */
export function scaffoldDefinitions(
  slots: TierSpriteSlot[],
  config: AppConfig,
  existingCount: number,
): [string, SpriteDefinition][] {
  return slots.map((slot, i) => [
    slot.id,
    scaffoldDefinition(slot, config, (existingCount + i) * 10),
  ]);
}
