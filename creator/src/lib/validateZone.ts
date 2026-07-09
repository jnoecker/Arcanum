import type {
  WorldFile,
  DoorFile,
  FeatureFile,
  MobFile,
  PuzzleFile,
  PuzzleReward,
  RareYieldFile,
  RecipeFile,
} from "@/types/world";
import { ITEM_TYPES, ARCHETYPAL_STATS, isArchetypalStat } from "@/types/world";
import type { EquipmentSlotDefinition, MobTiersConfig } from "@/types/config";
import { resolveDoorKeyId, resolveDoorState } from "./doorHelpers";
import { mobMaxDamageAtLevel, mobMinDamageAtLevel } from "./tuning/formulas";
import { classifyMob, inferLevelBand } from "./zoneRebalance";
import { exitTarget } from "./zoneEdits";
import { getTrainerClasses } from "./trainers";
import { resolveMobStats } from "./resolveMobStats";
import { resolveQuestXp } from "./resolveQuestXp";
import type { QuestXpConfig } from "@/types/config";

const VALID_TIME_PERIODS = new Set(["DAWN", "DAY", "DUSK", "NIGHT"]);
const VALID_SEASONS = new Set(["SPRING", "SUMMER", "AUTUMN", "WINTER"]);

/**
 * A mob is a "unique NPC" iff it places exactly one runtime instance —
 * a single spawn entry with count <= 1. Quest givers and turn-in NPCs
 * must satisfy this so quest dialogue can resolve to a single mob.
 */
function isUniqueSpawn(mob: MobFile): boolean {
  const spawns = mob.spawns ?? [];
  if (spawns.length !== 1) return false;
  const spawn = spawns[0]!;
  return (spawn.count ?? 1) <= 1;
}

export type Severity = "error" | "warning";

export interface ValidationIssue {
  severity: Severity;
  entity: string;
  message: string;
}

const DEFAULT_VALID_CLASSES = new Set(["WARRIOR", "MAGE", "CLERIC", "ROGUE"]);
const VALID_TERRAINS = new Set([
  "inside", "outside", "forest", "mountain", "underground",
  "underwater", "desert", "swamp", "urban", "sky",
]);
const VALID_MOB_CATEGORIES = new Set([
  "humanoid", "beast", "undead", "elemental", "construct", "aberration",
]);
const LOCKABLE_STATES = new Set(["open", "closed", "locked"]);
const LEVER_STATES = new Set(["up", "down"]);
const PUZZLE_TYPES = new Set(["riddle", "sequence"]);
const PUZZLE_REWARD_TYPES = new Set(["unlock_exit", "give_item", "give_gold", "give_xp"]);

function isPositiveInteger(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function addIssue(
  issues: ValidationIssue[],
  severity: Severity,
  entity: string,
  message: string,
): void {
  issues.push({ severity, entity, message });
}

/**
 * Flight-map pins must satisfy the server's load contract: each coordinate, if
 * present, is a number in 0..100, and the engine only seats a hotspot when both
 * are set. A roost with no coords is valid (it stays "unmapped").
 */
function validateFlightMapCoords(
  issues: ValidationIssue[],
  entity: string,
  room: WorldFile["rooms"][string],
): void {
  const { flightMapX, flightMapY, flightMaster } = room;
  const hasX = flightMapX != null;
  const hasY = flightMapY != null;
  if (!hasX && !hasY) return;

  for (const [axis, value] of [["flightMapX", flightMapX], ["flightMapY", flightMapY]] as const) {
    if (value == null) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      addIssue(issues, "error", entity, `${axis} must be a number between 0 and 100`);
    } else if (value < 0 || value > 100) {
      addIssue(issues, "error", entity, `${axis} (${value}) is outside the valid 0–100 range; the server will refuse to load this zone`);
    }
  }

  if (hasX !== hasY) {
    addIssue(issues, "warning", entity, "Flight map pin needs both flightMapX and flightMapY — set both to place the roost, or clear both to leave it unmapped");
  }
  if (!flightMaster) {
    addIssue(issues, "warning", entity, "Room has flight map coordinates but is not a flight master — the pin will be ignored");
  }
}

/**
 * Minimap pins must satisfy the server's load contract: `mapX`/`mapY` come as
 * an integer pair, `mapZ` is only valid alongside them, and no two rooms in a
 * zone may pin the same cell of the same floor. The loader refuses the whole
 * zone on any of these, so they're all errors.
 */
function validateMapPin(
  issues: ValidationIssue[],
  entity: string,
  roomId: string,
  room: WorldFile["rooms"][string],
  pinnedCells: Map<string, string>,
): void {
  const { mapX, mapY, mapZ } = room;
  if (mapX == null && mapY == null) {
    if (mapZ != null) {
      addIssue(issues, "error", entity, "mapZ without mapX/mapY — a floor alone doesn't pin a map cell; the server will refuse to load this zone");
    }
    return;
  }
  if (mapX == null || mapY == null) {
    addIssue(issues, "error", entity, "Map pin needs both mapX and mapY — the server refuses half-specified pins");
    return;
  }
  for (const [axis, value] of [["mapX", mapX], ["mapY", mapY], ["mapZ", mapZ]] as const) {
    if (value != null && !Number.isInteger(value)) {
      addIssue(issues, "error", entity, `${axis} (${value}) must be an integer grid coordinate`);
      return;
    }
  }
  const cell = `${mapX},${mapY},${mapZ ?? 0}`;
  const other = pinnedCells.get(cell);
  if (other) {
    addIssue(issues, "error", entity, `Pinned to map cell (${mapX},${mapY}) on floor ${mapZ ?? 0}, already taken by room "${other}" — the server refuses duplicate pins`);
  } else {
    pinnedCells.set(cell, roomId);
  }
}

/**
 * Boat docks share the flight map's coordinate contract (each coord, if present,
 * is a number in 0..100, and the engine only seats a hotspot when both are set),
 * and additionally carry authored routes. Each route needs a non-negative fare
 * and a destination; local destinations must resolve to a real room, while
 * cross-zone destinations (`zone:room`) are passed through — the server silently
 * skips routes whose target isn't loaded, mirroring the flight kiosk.
 */
function validateBoatDock(
  issues: ValidationIssue[],
  entity: string,
  room: WorldFile["rooms"][string],
  roomIds: Set<string>,
): void {
  const { boatMapX, boatMapY, boatDock, boatRoutes } = room;
  const hasX = boatMapX != null;
  const hasY = boatMapY != null;

  if (hasX || hasY) {
    for (const [axis, value] of [["boatMapX", boatMapX], ["boatMapY", boatMapY]] as const) {
      if (value == null) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        addIssue(issues, "error", entity, `${axis} must be a number between 0 and 100`);
      } else if (value < 0 || value > 100) {
        addIssue(issues, "error", entity, `${axis} (${value}) is outside the valid 0–100 range; the server will refuse to load this zone`);
      }
    }
    if (hasX !== hasY) {
      addIssue(issues, "warning", entity, "Boat map pin needs both boatMapX and boatMapY — set both to place the dock, or clear both to leave it unmapped");
    }
    if (!boatDock) {
      addIssue(issues, "warning", entity, "Room has boat map coordinates but is not a boat dock — the pin will be ignored");
    }
  }

  if (boatRoutes && boatRoutes.length > 0) {
    if (!boatDock) {
      addIssue(issues, "warning", entity, "Room has boat routes but is not a boat dock — the routes will be ignored");
    }
    boatRoutes.forEach((route, i) => {
      const label = `Boat route ${i + 1}`;
      const to = typeof route?.to === "string" ? route.to.trim() : "";
      if (!to) {
        addIssue(issues, "error", entity, `${label} has no destination`);
      } else if (!to.includes(":") && !roomIds.has(to)) {
        addIssue(issues, "error", entity, `${label} points to non-existent room "${to}"`);
      }
      if (typeof route?.price !== "number" || !Number.isFinite(route.price) || route.price < 0) {
        addIssue(issues, "error", entity, `${label} needs a fare of 0 or more`);
      }
    });
  }
}

function hasPositiveOnUse(item: NonNullable<WorldFile["items"]>[string]): boolean {
  const onUse = item.onUse;
  if (!onUse) return false;
  return (onUse.healHp ?? 0) > 0 || (onUse.healMana ?? 0) > 0 || (onUse.grantXp ?? 0) > 0;
}

/**
 * Resolve a mob's effective min/max damage by falling back to its tier baseline
 * at the mob's level when either override is absent. Returns undefined if we
 * can't determine both sides (missing tier config + missing overrides).
 *
 * Mirrors the server's WorldLoader fallback: tier min/max = `base + perLevel * level`.
 * Returning `undefined` means "can't check" — the server will use its own rules.
 */
function resolveMobDamage(
  mob: MobFile,
  mobTiers: MobTiersConfig | undefined,
): { min: number; max: number; hint: string } | undefined {
  const hasMin = mob.minDamage != null;
  const hasMax = mob.maxDamage != null;
  if (hasMin && hasMax) {
    return {
      min: mob.minDamage!,
      max: mob.maxDamage!,
      hint: "Both overrides set — adjust one or both so max >= min.",
    };
  }
  const tierId = mob.tier;
  const tier = tierId && mobTiers ? (mobTiers as unknown as Record<string, MobTiersConfig["weak"]>)[tierId] : undefined;
  if (!tier) return undefined;
  const level = mob.level ?? 1;
  const tierMin = mobMinDamageAtLevel(tier, level);
  const tierMax = mobMaxDamageAtLevel(tier, level);
  const resolvedMin = hasMin ? mob.minDamage! : tierMin;
  const resolvedMax = hasMax ? mob.maxDamage! : tierMax;
  const inherited = hasMin ? "maxDamage" : "minDamage";
  const overrideSide = hasMin ? "minDamage" : "maxDamage";
  return {
    min: resolvedMin,
    max: resolvedMax,
    hint: `${overrideSide} is overridden but ${inherited} inherits from tier "${tierId}" at level ${level} (${inherited === "minDamage" ? tierMin : tierMax}). Set both overrides explicitly.`,
  };
}

function formatZoneTargetLabel(
  band: { min: number; max: number },
  difficultyHint: string | undefined,
): string {
  const bandLabel = `${band.min}-${band.max}`;
  return difficultyHint ? `${bandLabel} (${difficultyHint})` : bandLabel;
}

function validateZoneBalanceTargets(
  issues: ValidationIssue[],
  world: WorldFile,
  mobTiers: MobTiersConfig | undefined,
): void {
  if (!mobTiers || !world.mobs || Object.keys(world.mobs).length === 0) return;

  // Player-scaled zones intentionally track the reference player's level —
  // authored mob levels are seeds, not bounds. Skip the tier-band check.
  if (world.scaling?.mode === "player") return;

  // Prefer the bounded-scaling range when set (that's what the zone editor
  // writes to); fall back to the authored levelBand, then to inferred bounds
  // from mobs/tiers. Without any signal at all, skip.
  const hasBoundedRange =
    world.scaling?.mode === "bounded" && !!world.scaling.levelRange;
  if (!hasBoundedRange && !world.levelBand) return;

  const band = inferLevelBand(world);
  const zoneTargetLabel = formatZoneTargetLabel(band, world.difficultyHint);

  for (const [mobId, mob] of Object.entries(world.mobs)) {
    if (classifyMob(mob) === "non-combat") continue;
    const tierKey = mob.tier ?? "standard";
    const tier = mobTiers[tierKey as keyof typeof mobTiers];
    if (!tier) {
      addIssue(
        issues,
        "warning",
        `mob:${mobId}`,
        `Tier "${tierKey}" is not defined in config, so the zone target ${zoneTargetLabel} cannot be validated for this mob.`,
      );
      continue;
    }

    // Flag a mob only when its level escapes the zone's level band entirely.
    // Within the band, authored placement is legitimate — graduated zones
    // intentionally spread tiers across their range (weak near the entrance,
    // bosses in the deep), so pinning every tier to a single canonical level
    // produced warnings authors could only ignore. "Rebalance to tier" is
    // still available to snap a mob to its tier's target inside the band.
    if (mob.level != null && (mob.level < band.min || mob.level > band.max)) {
      addIssue(
        issues,
        "warning",
        `mob:${mobId}`,
        `Mob level ${mob.level} falls outside the zone level band ${zoneTargetLabel}. Bring it within the band, widen the zone's level band, or run "Rebalance to tier".`,
      );
    }
  }
}

function validateDoor(
  issues: ValidationIssue[],
  entity: string,
  label: string,
  door: DoorFile | undefined,
  itemIds: Set<string>,
): void {
  if (!door) return;

  const state = resolveDoorState(door);
  if (state && !LOCKABLE_STATES.has(state.toLowerCase())) {
    addIssue(issues, "error", entity, `${label} has invalid initialState "${state}"`);
  }

  const keyItemId = resolveDoorKeyId(door);
  if (keyItemId && !itemIds.has(keyItemId)) {
    addIssue(issues, "error", entity, `${label} key "${keyItemId}" is not a known item in this zone`);
  }

  if (door.respawnSeconds != null && door.respawnSeconds <= 0) {
    addIssue(issues, "error", entity, `${label} respawn seconds must be greater than 0`);
  }
}

function validateFeature(
  issues: ValidationIssue[],
  entity: string,
  featureId: string,
  feature: FeatureFile,
  itemIds: Set<string>,
): void {
  const type = feature.type.trim().toUpperCase();
  if (!feature.displayName?.trim()) {
    addIssue(issues, "error", entity, `Feature "${featureId}" has no displayName`);
  }
  if (!feature.keyword?.trim()) {
    addIssue(issues, "error", entity, `Feature "${featureId}" has no keyword`);
  }

  switch (type) {
    case "CONTAINER":
      if (feature.initialState && !LOCKABLE_STATES.has(feature.initialState.toLowerCase())) {
        addIssue(issues, "error", entity, `Feature "${featureId}" has invalid initialState "${feature.initialState}"`);
      }
      if (feature.keyItemId && !itemIds.has(feature.keyItemId)) {
        addIssue(issues, "error", entity, `Feature "${featureId}" key "${feature.keyItemId}" is not a known item in this zone`);
      }
      for (const itemId of feature.items ?? []) {
        if (!itemIds.has(itemId)) {
          addIssue(issues, "error", entity, `Feature "${featureId}" contains unknown item "${itemId}"`);
        }
      }
      break;
    case "LEVER":
      if (feature.initialState && !LEVER_STATES.has(feature.initialState.toLowerCase())) {
        addIssue(issues, "error", entity, `Feature "${featureId}" has invalid initialState "${feature.initialState}"`);
      }
      break;
    case "SIGN":
      if (!feature.text?.trim()) {
        addIssue(issues, "error", entity, `Sign feature "${featureId}" must have non-empty text`);
      }
      break;
    default:
      addIssue(issues, "error", entity, `Feature "${featureId}" has unknown type "${feature.type}"`);
      break;
  }

  if (feature.respawnSeconds != null && feature.respawnSeconds <= 0) {
    addIssue(issues, "error", entity, `Feature "${featureId}" respawn seconds must be greater than 0`);
  }
}

function validateRareYield(
  issues: ValidationIssue[],
  entity: string,
  label: string,
  rareYield: RareYieldFile,
  itemIds: Set<string>,
): void {
  if (!rareYield.itemId) {
    addIssue(issues, "error", entity, `${label} has empty item ID`);
  } else if (!itemIds.has(rareYield.itemId)) {
    addIssue(issues, "warning", entity, `${label} item "${rareYield.itemId}" is not a known item in this zone`);
  }
  if ((rareYield.quantity ?? 1) < 1) {
    addIssue(issues, "error", entity, `${label} quantity must be >= 1`);
  }
  if (rareYield.dropChance <= 0 || rareYield.dropChance > 1) {
    addIssue(issues, "error", entity, `${label} dropChance ${rareYield.dropChance} out of range ((0.0, 1.0])`);
  }
}

function validateRecipe(
  issues: ValidationIssue[],
  recipeId: string,
  recipe: RecipeFile,
  itemIds: Set<string>,
): void {
  const entity = `recipe:${recipeId}`;
  if (!recipe.displayName?.trim()) {
    addIssue(issues, "warning", entity, "Recipe has no display name");
  }
  if (!recipe.outputItemId) {
    addIssue(issues, "warning", entity, "Recipe has no output item");
  } else if (!itemIds.has(recipe.outputItemId)) {
    addIssue(issues, "warning", entity, `Output item "${recipe.outputItemId}" is not a known item in this zone`);
  }
  if ((recipe.outputQuantity ?? 1) < 1) {
    addIssue(issues, "error", entity, "Output quantity must be at least 1");
  }
  if (!recipe.materials || recipe.materials.length === 0) {
    addIssue(issues, "error", entity, "Recipe must have at least one material");
  } else {
    for (const [index, mat] of recipe.materials.entries()) {
      if (!mat.itemId) {
        addIssue(issues, "warning", entity, "Material has empty item ID");
      } else if (!itemIds.has(mat.itemId)) {
        addIssue(issues, "warning", entity, `Material item "${mat.itemId}" is not a known item in this zone`);
      }
      if (mat.quantity < 1) {
        addIssue(issues, "error", entity, `Material #${index + 1} quantity must be at least 1`);
      }
    }
  }
}

function validatePuzzleReward(
  issues: ValidationIssue[],
  entity: string,
  reward: PuzzleReward,
  itemIds: Set<string>,
  roomIds: Set<string>,
): void {
  const type = reward.type.trim().toLowerCase();
  if (!PUZZLE_REWARD_TYPES.has(type)) {
    addIssue(issues, "error", entity, `Puzzle has unknown reward type "${reward.type}"`);
    return;
  }

  if (type === "unlock_exit") {
    if (!reward.exitDirection?.trim()) {
      addIssue(issues, "error", entity, "unlock_exit reward requires exitDirection");
    }
    if (!reward.targetRoom?.trim()) {
      addIssue(issues, "error", entity, "unlock_exit reward requires targetRoom");
    } else if (!reward.targetRoom.includes(":") && !roomIds.has(reward.targetRoom)) {
      addIssue(issues, "error", entity, `unlock_exit reward targetRoom "${reward.targetRoom}" does not exist`);
    }
  }
  if (type === "give_item") {
    if (!reward.itemId?.trim()) {
      addIssue(issues, "error", entity, "give_item reward requires itemId");
    } else if (!itemIds.has(reward.itemId)) {
      addIssue(issues, "warning", entity, `give_item reward item "${reward.itemId}" is not a known item in this zone`);
    }
  }
  const goldAmount = reward.gold ?? reward.amount ?? 0;
  const xpAmount = reward.xp ?? reward.amount ?? 0;
  if (type === "give_gold" && goldAmount <= 0) {
    addIssue(issues, "error", entity, "give_gold reward requires amount > 0");
  }
  if (type === "give_xp" && xpAmount <= 0) {
    addIssue(issues, "error", entity, "give_xp reward requires amount > 0");
  }
}

function validatePuzzle(
  issues: ValidationIssue[],
  puzzleId: string,
  puzzle: PuzzleFile,
  world: WorldFile,
  roomIds: Set<string>,
  mobIds: Set<string>,
  itemIds: Set<string>,
): void {
  const entity = `puzzle:${puzzleId}`;
  const type = puzzle.type.trim().toLowerCase();

  if (!PUZZLE_TYPES.has(type)) {
    addIssue(issues, "error", entity, `Puzzle has unknown type "${puzzle.type}"`);
  }
  if (!puzzle.roomId?.trim()) {
    addIssue(issues, "error", entity, "Puzzle has no roomId");
  } else if (!puzzle.roomId.includes(":") && !roomIds.has(puzzle.roomId)) {
    addIssue(issues, "error", entity, `Puzzle room "${puzzle.roomId}" does not exist`);
  }
  if (puzzle.mobId && !mobIds.has(puzzle.mobId)) {
    addIssue(issues, "warning", entity, `Puzzle mob "${puzzle.mobId}" is not a known mob in this zone`);
  }

  if (type === "riddle") {
    const answers = [
      ...(puzzle.answer?.trim() ? [puzzle.answer.trim()] : []),
      ...((puzzle.acceptableAnswers ?? []).map((answer) => answer.trim()).filter(Boolean)),
    ];
    if (answers.length === 0) {
      addIssue(issues, "error", entity, "Riddle puzzle must have at least one answer");
    }
  }

  if (type === "sequence") {
    if (!puzzle.steps || puzzle.steps.length === 0) {
      addIssue(issues, "error", entity, "Sequence puzzle must have at least one step");
    } else {
      // Resolve the puzzle room's features so we can check step.feature refs.
      // Accept either the local feature key OR the feature keyword — the
      // authored YAML can stabilize on the local key, but older content
      // still matches by keyword at runtime.
      const puzzleRoom = puzzle.roomId && !puzzle.roomId.includes(":")
        ? world.rooms[puzzle.roomId]
        : undefined;
      const roomFeatureKeys = new Set<string>();
      if (puzzleRoom?.features) {
        for (const [fId, f] of Object.entries(puzzleRoom.features)) {
          roomFeatureKeys.add(fId.toLowerCase());
          if (f.keyword) roomFeatureKeys.add(f.keyword.trim().toLowerCase());
        }
      }

      for (const [index, step] of puzzle.steps.entries()) {
        if (!step.feature?.trim()) {
          addIssue(issues, "error", entity, `Step #${index + 1} feature cannot be blank`);
        } else if (puzzleRoom && roomFeatureKeys.size > 0 && !roomFeatureKeys.has(step.feature.trim().toLowerCase())) {
          addIssue(
            issues,
            "warning",
            entity,
            `Step #${index + 1} feature "${step.feature}" does not match any feature in room "${puzzle.roomId}"`,
          );
        } else if (puzzleRoom && roomFeatureKeys.size === 0) {
          addIssue(
            issues,
            "warning",
            entity,
            `Step #${index + 1} references feature "${step.feature}" but room "${puzzle.roomId}" has no features defined`,
          );
        }
        if (!step.action?.trim()) {
          addIssue(issues, "error", entity, `Step #${index + 1} action cannot be blank`);
        }
      }
    }
  }

  validatePuzzleReward(issues, entity, puzzle.reward, itemIds, roomIds);
}

export function validateZone(
  world: WorldFile,
  equipmentSlots?: Record<string, EquipmentSlotDefinition>,
  validClasses?: ReadonlySet<string>,
  knownFactions?: ReadonlySet<string>,
  knownAchievements?: ReadonlySet<string>,
  mobTiers?: MobTiersConfig,
  questXpConfig?: QuestXpConfig,
  /** Class id -> ordered statPriorities. Used to warn when an item uses an
   *  archetypal stat slot that no class fills (the bonus would silently drop). */
  classStatPriorities?: Record<string, string[]>,
  /** `jukeboxOutput` enables the server's strict title/duration checks, which
   *  only hold after save-time enrichment — in-editor songs are bare file refs.
   *  `knownQualifiedMobIds` is the set of every `zone:mobKey` across all zones,
   *  supplied by `validateAllZones`. When present, a zone-qualified quest
   *  giver/turn-in reference is resolved against it instead of blindly warned;
   *  cross-zone references are a first-class feature (turn a letter in at
   *  another town), so they should only warn when they resolve to nothing. */
  opts?: { jukeboxOutput?: boolean; knownQualifiedMobIds?: ReadonlySet<string> },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roomIds = new Set(Object.keys(world.rooms));
  const mobIds = new Set(Object.keys(world.mobs ?? {}));
  const itemIds = new Set(Object.keys(world.items ?? {}));
  const levelBand = world.levelBand;
  const VALID_CLASSES = validClasses ?? DEFAULT_VALID_CLASSES;
  const factionCheck = (entity: string, factionId: string | undefined, label: string) => {
    if (!factionId || !knownFactions) return;
    if (!knownFactions.has(factionId)) {
      addIssue(issues, "warning", entity, `${label} "${factionId}" is not a defined faction`);
    }
  };

  if (!world.startRoom) {
    addIssue(issues, "error", "zone", "No start room defined");
  } else if (!roomIds.has(world.startRoom)) {
    addIssue(issues, "error", "zone", `Start room "${world.startRoom}" does not exist`);
  }
  if (roomIds.size === 0) {
    addIssue(issues, "error", "zone", "Zone has no rooms");
  }
  if (world.terrain && !VALID_TERRAINS.has(world.terrain)) {
    addIssue(issues, "warning", "zone", `Terrain "${world.terrain}" is not a recognized terrain type`);
  }
  if (levelBand) {
    if (!isPositiveInteger(levelBand.min)) {
      addIssue(issues, "error", "zone", "levelBand.min must be a positive integer");
    }
    if (!isPositiveInteger(levelBand.max)) {
      addIssue(issues, "error", "zone", "levelBand.max must be a positive integer");
    }
    if (
      isPositiveInteger(levelBand.min)
      && isPositiveInteger(levelBand.max)
      && levelBand.max < levelBand.min
    ) {
      addIssue(issues, "error", "zone", "levelBand.max must be greater than or equal to levelBand.min");
    }
  }
  if (world.scaling) {
    const { mode, levelRange } = world.scaling;
    if (mode === "bounded") {
      if (!levelRange || levelRange.length !== 2) {
        addIssue(issues, "error", "zone", "scaling.mode 'bounded' requires a levelRange [min, max]");
      } else {
        const [min, max] = levelRange;
        if (!isPositiveInteger(min) || !isPositiveInteger(max)) {
          addIssue(issues, "error", "zone", "scaling.levelRange values must be positive integers");
        } else if (max < min) {
          addIssue(issues, "error", "zone", `scaling.levelRange max (${max}) must be >= min (${min})`);
        }
      }
    } else if (mode === "player" && levelRange) {
      addIssue(
        issues,
        "warning",
        "zone",
        "scaling.mode 'player' ignores levelRange — content tracks the reference player without bounds.",
      );
    } else if (mode === "static" && levelRange) {
      addIssue(
        issues,
        "warning",
        "zone",
        "scaling.mode 'static' ignores levelRange — use levelBand for rebalance targets instead.",
      );
    }
  }
  factionCheck("zone", world.faction, "Controlling faction");

  const pinnedCells = new Map<string, string>();
  for (const [roomId, room] of Object.entries(world.rooms)) {
    const entity = `room:${roomId}`;
    if (!room.title?.trim()) addIssue(issues, "warning", entity, "Room has no title");
    if (!room.description?.trim()) addIssue(issues, "warning", entity, "Room has no description");
    if (room.terrain && !VALID_TERRAINS.has(room.terrain)) {
      addIssue(issues, "warning", entity, `Terrain "${room.terrain}" is not a recognized terrain type`);
    }

    validateFlightMapCoords(issues, entity, room);
    validateMapPin(issues, entity, roomId, room, pinnedCells);
    validateBoatDock(issues, entity, room, roomIds);

    for (const [dir, exit] of Object.entries(room.exits ?? {})) {
      const target = exitTarget(exit);
      if (!target.includes(":") && !roomIds.has(target)) {
        addIssue(issues, "error", entity, `Exit "${dir}" points to non-existent room "${target}"`);
      }
      if (typeof exit !== "string") {
        validateDoor(issues, entity, `Exit "${dir}" door`, exit.door, itemIds);
        if (exit.requiresAchievement && knownAchievements && !knownAchievements.has(exit.requiresAchievement)) {
          addIssue(
            issues,
            "warning",
            entity,
            `Exit "${dir}" requires achievement "${exit.requiresAchievement}" which is not defined in config`,
          );
        }
      }
    }

    for (const [featureId, feature] of Object.entries(room.features ?? {})) {
      validateFeature(issues, entity, featureId, feature, itemIds);
    }

    if (room.jukebox) {
      if (room.jukebox.length === 0) {
        addIssue(issues, "warning", entity, "Jukebox has no songs — add tracks or remove it");
      }
      for (const [index, song] of room.jukebox.entries()) {
        const where = `Jukebox song #${index + 1}`;
        if (!song.file?.trim()) {
          addIssue(issues, "error", entity, `${where} has no audio file`);
        }
        if (song.cost != null && song.cost < 0) {
          addIssue(issues, "error", entity, `${where} has a negative cost (${song.cost})`);
        }
        if (song.lyrics) {
          if (song.lyrics.some((line) => typeof line !== "string" || !line.trim())) {
            addIssue(issues, "error", entity, `${where} has a blank lyric line`);
          }
          const duration = song.durationSeconds;
          if (typeof duration === "number" && duration > 0) {
            const maxLines = Math.floor(duration / 3);
            if (song.lyrics.length > maxLines) {
              addIssue(
                issues,
                "error",
                entity,
                `${where} has ${song.lyrics.length} lyric lines but durationSeconds=${duration} allows at most ${maxLines} — at most one lyric line per 3 seconds`,
              );
            }
          }
        }
        if (opts?.jukeboxOutput) {
          if (!song.title?.trim()) {
            addIssue(issues, "error", entity, `${where} has no title — name the track in the Audio Studio`);
          }
          if (typeof song.durationSeconds !== "number" || song.durationSeconds <= 0) {
            addIssue(
              issues,
              "error",
              entity,
              `${where} has no playable duration — set the track's duration in the Audio Studio`,
            );
          }
        }
      }
    }

    if (room.musicBox) {
      const box = room.musicBox;
      const where = "Music box";
      if (!box.file?.trim()) {
        addIssue(issues, "error", entity, `${where} has no audio file`);
      }
      if (box.lyrics) {
        if (box.lyrics.some((line) => typeof line !== "string" || !line.trim())) {
          addIssue(issues, "error", entity, `${where} has a blank lyric line`);
        }
        const duration = box.durationSeconds;
        if (typeof duration === "number" && duration > 0) {
          const maxLines = Math.floor(duration / 3);
          if (box.lyrics.length > maxLines) {
            addIssue(
              issues,
              "error",
              entity,
              `${where} has ${box.lyrics.length} lyric lines but durationSeconds=${duration} allows at most ${maxLines} — at most one lyric line per 3 seconds`,
            );
          }
        }
      }
      if (opts?.jukeboxOutput) {
        if (!box.title?.trim()) {
          addIssue(issues, "error", entity, `${where} has no title — name the track in the Audio Studio`);
        }
        if (typeof box.durationSeconds !== "number" || box.durationSeconds <= 0) {
          addIssue(
            issues,
            "error",
            entity,
            `${where} has no playable duration — set the track's duration in the Audio Studio`,
          );
        }
      }
    }
  }

  for (const [mobId, mob] of Object.entries(world.mobs ?? {})) {
    const entity = `mob:${mobId}`;
    if (!mob.name?.trim()) addIssue(issues, "warning", entity, "Mob has no name");
    const spawns = mob.spawns ?? [];
    if (spawns.length === 0) {
      addIssue(issues, "error", entity, "Mob has no spawns");
    }
    for (const [index, spawn] of spawns.entries()) {
      if (!spawn.room) {
        addIssue(issues, "error", entity, `Spawn #${index + 1} has no room`);
      } else if (!roomIds.has(spawn.room)) {
        addIssue(issues, "error", entity, `Spawn #${index + 1} room "${spawn.room}" does not exist`);
      }
      if (spawn.count != null && (!Number.isInteger(spawn.count) || spawn.count < 1)) {
        addIssue(issues, "error", entity, `Spawn #${index + 1} count must be a positive integer`);
      }
    }
    factionCheck(entity, mob.faction, "Faction");
    if (mob.category && !VALID_MOB_CATEGORIES.has(mob.category)) {
      addIssue(issues, "warning", entity, `Category "${mob.category}" is not a recognized mob category`);
    }
    if (mob.respawnSeconds != null && mob.respawnSeconds <= 0) {
      addIssue(issues, "error", entity, "Respawn seconds must be greater than 0");
    }

    const mobRole = mob.role ?? "combat";
    if (mobRole === "prop" && ((mob.quests?.length ?? 0) > 0 || Object.keys(mob.dialogue ?? {}).length > 0)) {
      addIssue(
        issues,
        "warning",
        entity,
        "Props can't offer quests or dialogue — consider role 'quest_giver' or 'dialog' instead.",
      );
    }
    if (mobRole !== "combat") {
      const combatFieldsSet =
        mob.hp != null || mob.xpReward != null || mob.minDamage != null || mob.maxDamage != null || mob.armor != null;
      if (combatFieldsSet) {
        addIssue(
          issues,
          "warning",
          entity,
          `Role '${mobRole}' ignores combat stats (hp/xpReward/damage/armor). Remove the overrides to keep the editor clean.`,
        );
      }
    } else {
      const resolved = resolveMobStats(mob, mobTiers);
      if (resolved?.anyOverridden) {
        const breakdown = (
          [
            ["HP", resolved.hp],
            ["min damage", resolved.minDamage],
            ["max damage", resolved.maxDamage],
            ["armor", resolved.armor],
            ["XP", resolved.xpReward],
            ["gold min", resolved.goldMin],
            ["gold max", resolved.goldMax],
          ] as const
        )
          .filter(([, s]) => s.overridden)
          .map(([label, s]) => `${label} ${s.effective} (tier default ${s.tierDefault})`);
        addIssue(
          issues,
          "warning",
          entity,
          `Stat override breaks tier curve: ${breakdown.join("; ")}. Prefer adjusting tier or level over hand-tuning numbers.`,
        );
      }
    }

    const resolvedDamage = resolveMobDamage(mob, mobTiers);
    if (resolvedDamage && resolvedDamage.max < resolvedDamage.min) {
      addIssue(
        issues,
        "error",
        entity,
        `Resolved maxDamage (${resolvedDamage.max}) must be >= minDamage (${resolvedDamage.min}). ${resolvedDamage.hint}`,
      );
    }

    for (const [index, drop] of (mob.drops ?? []).entries()) {
      if (!drop.itemId) {
        addIssue(issues, "warning", entity, "Drop has empty item ID");
      } else if (!itemIds.has(drop.itemId)) {
        addIssue(issues, "warning", entity, `Drop item "${drop.itemId}" is not a known item in this zone`);
      }
      if (Number.isNaN(drop.chance) || drop.chance < 0 || drop.chance > 1) {
        addIssue(issues, "error", entity, `Drop #${index + 1} has invalid chance ${drop.chance}; expected 0.0-1.0`);
      }
    }

    if (mob.condition) {
      const cond = mob.condition;
      if (cond.chance != null && (Number.isNaN(cond.chance) || cond.chance < 0 || cond.chance > 1)) {
        addIssue(issues, "error", entity, `Spawn condition chance ${cond.chance} is out of range; expected 0.0-1.0`);
      }
      for (const t of cond.time ?? []) {
        if (!VALID_TIME_PERIODS.has(t)) {
          addIssue(issues, "error", entity, `Spawn condition time "${t}" is invalid; expected one of ${[...VALID_TIME_PERIODS].join(", ")}`);
        }
      }
      for (const s of cond.seasons ?? []) {
        if (!VALID_SEASONS.has(s)) {
          addIssue(issues, "error", entity, `Spawn condition season "${s}" is invalid; expected one of ${[...VALID_SEASONS].join(", ")}`);
        }
      }
    }

    if (mob.behavior?.params?.patrolRoute) {
      for (const routeRoom of mob.behavior.params.patrolRoute) {
        if (!roomIds.has(routeRoom)) {
          addIssue(issues, "error", entity, `Patrol route room "${routeRoom}" does not exist`);
        }
      }
    }

    for (const questId of mob.quests ?? []) {
      if (!world.quests?.[questId]) {
        addIssue(issues, "error", entity, `Quest "${questId}" does not exist`);
      }
    }

    if (mob.dialogue) {
      const dialogueIds = new Set(Object.keys(mob.dialogue));
      if (!dialogueIds.has("root")) {
        addIssue(issues, "error", entity, "Dialogue must contain a \"root\" node");
      }
      for (const [nodeId, node] of Object.entries(mob.dialogue)) {
        if (!node.text?.trim()) {
          addIssue(issues, "warning", entity, `Dialogue node "${nodeId}" has empty text`);
        }
        for (const choice of node.choices ?? []) {
          if (!choice.text?.trim()) {
            addIssue(issues, "warning", entity, `Dialogue node "${nodeId}" has a choice with empty text`);
          }
          if (choice.next && !dialogueIds.has(choice.next)) {
            addIssue(issues, "error", entity, `Dialogue choice in "${nodeId}" points to non-existent node "${choice.next}"`);
          }
        }
      }
    }
  }

  if (
    levelBand
    && isPositiveInteger(levelBand.min)
    && isPositiveInteger(levelBand.max)
    && levelBand.max >= levelBand.min
  ) {
    validateZoneBalanceTargets(issues, world, mobTiers);
  }

  for (const [itemId, item] of Object.entries(world.items ?? {})) {
    const entity = `item:${itemId}`;
    if (!item.displayName?.trim()) addIssue(issues, "warning", entity, "Item has no display name");
    if (item.room && !roomIds.has(item.room)) {
      addIssue(issues, "error", entity, `Room "${item.room}" does not exist`);
    }
    if (item.mob?.trim()) {
      addIssue(issues, "error", entity, "Deprecated `mob` placement is not supported; use mobs.<id>.drops instead");
    }
    if (item.room?.trim() && item.mob?.trim()) {
      addIssue(issues, "error", entity, "Item cannot be placed in both a room and a mob");
    }
    if (item.respawnSeconds != null && item.respawnSeconds <= 0) {
      addIssue(issues, "error", entity, "respawnSeconds must be greater than 0");
    }
    if (item.respawnSeconds != null && !item.room?.trim()) {
      addIssue(issues, "warning", entity, "respawnSeconds only applies to ground items — set a room or it is ignored");
    }
    if (item.onUse) {
      if ((item.onUse.healHp ?? 0) < 0) addIssue(issues, "error", entity, "onUse.healHp must be >= 0");
      if ((item.onUse.healMana ?? 0) < 0) addIssue(issues, "error", entity, "onUse.healMana must be >= 0");
      if ((item.onUse.grantXp ?? 0) < 0) addIssue(issues, "error", entity, "onUse.grantXp must be >= 0");
      if (!hasPositiveOnUse(item)) addIssue(issues, "error", entity, "onUse must define at least one positive effect");
    }
    if (item.slot && equipmentSlots && Object.keys(equipmentSlots).length > 0) {
      if (!equipmentSlots[item.slot] && !equipmentSlots[item.slot.toLowerCase()]) {
        addIssue(issues, "warning", entity, `Slot "${item.slot}" is not a defined equipment slot`);
      }
    }
    if (item.itemType != null && !(ITEM_TYPES as readonly string[]).includes(item.itemType)) {
      addIssue(
        issues,
        "error",
        entity,
        `itemType "${item.itemType}" is not a known type. Valid: ${ITEM_TYPES.join(", ")}`,
      );
    }
    if (item.classes && item.classes.length > 0) {
      for (const cls of item.classes) {
        if (!VALID_CLASSES.has(cls.toUpperCase())) {
          addIssue(issues, "warning", entity, `Class restriction "${cls}" is not a known class`);
        }
      }
    }
    // Archetypal stats (PRIMARY/SECONDARY/TERTIARY) silently drop for classes
    // whose statPriorities is too shallow. Surface the gap so authors don't
    // ship an item that gives a hidden Mage no bonus.
    if (item.stats && classStatPriorities && Object.keys(classStatPriorities).length > 0) {
      const usedArchetypal = Object.keys(item.stats).filter(isArchetypalStat);
      for (const key of usedArchetypal) {
        const depthNeeded = ARCHETYPAL_STATS.indexOf(key) + 1;
        const shallow = Object.entries(classStatPriorities)
          .filter(([, prio]) => prio.length < depthNeeded)
          .map(([id]) => id);
        if (shallow.length > 0) {
          addIssue(
            issues,
            "warning",
            entity,
            `Stat "${key}" has no resolution for class${shallow.length > 1 ? "es" : ""} ${shallow.join(", ")} — extend their statPriorities or remove this bonus`,
          );
        }
      }
    }
  }

  for (const [shopId, shop] of Object.entries(world.shops ?? {})) {
    const entity = `shop:${shopId}`;
    if (!shop.name?.trim()) addIssue(issues, "warning", entity, "Shop has no name");
    if (!roomIds.has(shop.room)) addIssue(issues, "error", entity, `Room "${shop.room}" does not exist`);
    for (const itemId of shop.items ?? []) {
      if (!itemIds.has(itemId)) {
        addIssue(issues, "warning", entity, `Inventory item "${itemId}" is not a known item in this zone`);
      }
    }
    if (shop.requiredReputation) {
      factionCheck(entity, shop.requiredReputation.faction, "Rep gate faction");
      const { min, max } = shop.requiredReputation;
      if (min != null && max != null && min > max) {
        addIssue(issues, "error", entity, `Rep gate min (${min}) must be <= max (${max})`);
      }
    }
  }

  // Trainer mobs: validate the trainer-specific fields on each mob whose
  // role is "trainer". The server-facing `trainers:` map is synthesized at
  // save time, so all validation lives on the mob.
  const trainerRoomOwner = new Map<string, string>();
  for (const [mobId, mob] of Object.entries(world.mobs ?? {})) {
    if (mob.role !== "trainer") continue;
    const entity = `mob:${mobId}`;
    const classList = getTrainerClasses(mob);
    if (classList.length === 0) {
      addIssue(issues, "error", entity, "Trainer mob has no class");
    } else {
      for (const cls of classList) {
        if (!VALID_CLASSES.has(cls.toUpperCase())) {
          addIssue(issues, "warning", entity, `Class "${cls}" is not a standard class`);
        }
      }
    }
    const spawns = mob.spawns ?? [];
    if (spawns.length === 0) {
      addIssue(issues, "error", entity, "Trainer mob has no spawn room");
    }
    for (const spawn of spawns) {
      const existing = trainerRoomOwner.get(spawn.room);
      if (existing && existing !== mobId) {
        addIssue(
          issues,
          "warning",
          entity,
          `Room "${spawn.room}" already trains via mob "${existing}" — only one trainer per room is honoured`,
        );
      } else if (!existing) {
        trainerRoomOwner.set(spawn.room, mobId);
      }
    }
  }

  // Validate a quest giver/turn-in reference. Bare keywords are qualified with
  // this zone by the loader, so they must resolve locally. A zone-qualified
  // `zone:mob` reference is an intentional cross-zone link (e.g. accept a
  // letter here, deliver it in another town) — resolve it against the whole-
  // world registry when we have one, and only warn when it resolves to nothing.
  const knownQualifiedMobIds = opts?.knownQualifiedMobIds;
  const checkQuestNpc = (entity: string, ref: string, label: string, uniqueNoun: string): void => {
    if (ref.includes(":")) {
      if (knownQualifiedMobIds && !knownQualifiedMobIds.has(ref)) {
        addIssue(
          issues,
          "warning",
          entity,
          `${label} mob "${ref}" does not resolve to any mob in any zone — check the zone id and mob key.`,
        );
      }
      return;
    }
    if (!mobIds.has(ref)) {
      addIssue(
        issues,
        "warning",
        entity,
        `${label} mob "${ref}" is not a known mob in this zone. Use a bare keyword for a local NPC, or "zone:mob" to point at an NPC in another zone.`,
      );
      return;
    }
    const mob = world.mobs?.[ref];
    if (mob && !isUniqueSpawn(mob)) {
      addIssue(
        issues,
        "error",
        entity,
        `${label} mob "${ref}" must have exactly one spawn with count 1 — ${uniqueNoun} are unique NPCs`,
      );
    }
  };

  for (const [questId, quest] of Object.entries(world.quests ?? {})) {
    const entity = `quest:${questId}`;
    if (!quest.name?.trim()) addIssue(issues, "warning", entity, "Quest has no name");
    if (!quest.giver) {
      addIssue(issues, "warning", entity, "Quest has no giver");
    } else {
      checkQuestNpc(entity, quest.giver, "Giver", "quest givers");
    }
    if (quest.turnInMob) {
      checkQuestNpc(entity, quest.turnInMob, "Turn-in", "turn-in NPCs");
    }
    // Objective-less quests are valid for the npc_turn_in completion type
    // (use case: "go visit this other NPC"). Auto-completion needs at least
    // one objective — otherwise it has no trigger to fire on.
    const hasObjectives = (quest.objectives?.length ?? 0) > 0;
    const completion = quest.completionType ?? "NPC_TURN_IN";
    const isAutoCompletion = completion.toLowerCase() === "auto";
    if (!hasObjectives && isAutoCompletion) {
      addIssue(
        issues,
        "error",
        entity,
        "Auto-completion quests must have at least one objective — otherwise the engine has nothing to listen for. Switch to NPC Turn-in or add an objective.",
      );
    }
    for (const [index, obj] of quest.objectives?.entries() ?? []) {
      if (!obj.type) addIssue(issues, "warning", entity, "Objective has no type");
      if (!obj.targetKey) addIssue(issues, "warning", entity, "Objective has no target key");
      if (obj.count != null && obj.count < 1) {
        addIssue(issues, "error", entity, `Objective #${index + 1} count must be at least 1`);
      }
    }
    if (quest.requiredReputation) {
      factionCheck(entity, quest.requiredReputation.faction, "Rep gate faction");
      const { min, max } = quest.requiredReputation;
      if (min != null && max != null && min > max) {
        addIssue(issues, "error", entity, `Rep gate min (${min}) must be <= max (${max})`);
      }
    }
    if (quest.level != null && quest.level < 1) {
      addIssue(issues, "error", entity, `Intended level (${quest.level}) must be at least 1`);
    }
    if (quest.level == null && (quest.rewards?.xp ?? 0) >= 100) {
      addIssue(
        issues,
        "warning",
        entity,
        "Quest awards >=100 XP but has no intended level — players who out-level this quest will still receive the full flat reward",
      );
    }
    const resolvedXp = resolveQuestXp(quest, questXpConfig);
    if (resolvedXp.reason === "override") {
      addIssue(
        issues,
        "warning",
        entity,
        `XP override (${resolvedXp.authored}) breaks the difficulty tier — '${quest.difficulty}' at level ${quest.level ?? 1} would compute ${resolvedXp.computed}. Remove rewards.xp to use the tier, or pick a different difficulty.`,
      );
    }
    for (const reward of quest.rewards?.items ?? []) {
      if (!reward.itemId) {
        addIssue(issues, "warning", entity, "Reward item has empty item ID");
      } else if (!reward.itemId.includes(":") && !itemIds.has(reward.itemId)) {
        addIssue(
          issues,
          "warning",
          entity,
          `Reward item "${reward.itemId}" is not a known item in this zone`,
        );
      }
      if (reward.count != null && reward.count < 1) {
        addIssue(issues, "error", entity, `Reward item "${reward.itemId}" has invalid count ${reward.count}`);
      }
    }
  }

  for (const [nodeId, node] of Object.entries(world.gatheringNodes ?? {})) {
    const entity = `gatheringNode:${nodeId}`;
    if (!node.displayName?.trim()) addIssue(issues, "warning", entity, "Gathering node has no display name");
    if (!node.image) addIssue(issues, "warning", entity, "Gathering node has no image — players will see a missing sprite");
    if (!roomIds.has(node.room)) addIssue(issues, "error", entity, `Room "${node.room}" does not exist`);
    if (!node.yields || node.yields.length === 0) {
      addIssue(issues, "error", entity, "Gathering node must have at least one yield");
    } else {
      for (const [index, yieldDef] of node.yields.entries()) {
        if (!yieldDef.itemId) {
          addIssue(issues, "warning", entity, "Yield has empty item ID");
        } else if (!itemIds.has(yieldDef.itemId)) {
          addIssue(issues, "warning", entity, `Yield item "${yieldDef.itemId}" is not a known item in this zone`);
        }
        if ((yieldDef.minQuantity ?? 1) < 1) {
          addIssue(issues, "error", entity, `Yield #${index + 1} minQuantity must be at least 1`);
        }
        if ((yieldDef.maxQuantity ?? 1) < (yieldDef.minQuantity ?? 1)) {
          addIssue(issues, "error", entity, `Yield #${index + 1} maxQuantity must be >= minQuantity`);
        }
      }
    }
    for (const [index, rareYield] of (node.rareYields ?? []).entries()) {
      validateRareYield(issues, entity, `Rare yield #${index + 1}`, rareYield, itemIds);
    }
  }

  for (const [recipeId, recipe] of Object.entries(world.recipes ?? {})) {
    validateRecipe(issues, recipeId, recipe, itemIds);
  }

  for (const [puzzleId, puzzle] of Object.entries(world.puzzles ?? {})) {
    validatePuzzle(issues, puzzleId, puzzle, world, roomIds, mobIds, itemIds);
  }

  if (world.dungeon) {
    const d = world.dungeon;
    if (!d.name?.trim()) addIssue(issues, "warning", "dungeon", "Dungeon has no name");
    if (d.roomCountMin != null && d.roomCountMin < 3) {
      addIssue(issues, "error", "dungeon", "Room count min must be >= 3");
    }
    if (d.roomCountMax != null && d.roomCountMin != null && d.roomCountMax < d.roomCountMin) {
      addIssue(issues, "error", "dungeon", "Room count max must be >= min");
    }
    const categories = Object.entries(d.roomTemplates ?? {});
    if (categories.length === 0) {
      addIssue(issues, "warning", "dungeon", "Dungeon has no room template categories");
    }
    for (const [cat, templates] of categories) {
      if (templates.length === 0) addIssue(issues, "warning", "dungeon", `Room category "${cat}" is empty`);
      for (const tpl of templates) {
        if (!tpl.title?.trim()) addIssue(issues, "warning", "dungeon", `Room template in "${cat}" has no title`);
      }
    }
    if (d.portalRoom && !world.rooms[d.portalRoom]) {
      addIssue(issues, "warning", "dungeon", `Portal room "${d.portalRoom}" not found in this zone`);
    }
    const pools = Object.entries(d.mobPools ?? {}) as [string, string[] | undefined][];
    if (pools.length === 0) addIssue(issues, "warning", "dungeon", "Dungeon has no mob pools");
    for (const [pool, poolMobIds] of pools) {
      if (!poolMobIds || poolMobIds.length === 0) {
        addIssue(issues, "warning", "dungeon", `Mob pool "${pool}" is empty`);
      }
    }
    if ((d.mobPools?.boss ?? []).length === 0) {
      addIssue(issues, "error", "dungeon", "Dungeon must have at least one boss in mobPools.boss");
    }
  }

  return issues;
}

export function validateAllZones(
  zones: Map<string, { data: WorldFile }>,
  equipmentSlots?: Record<string, EquipmentSlotDefinition>,
  validClasses?: ReadonlySet<string>,
  knownFactions?: ReadonlySet<string>,
  knownAchievements?: ReadonlySet<string>,
  mobTiers?: MobTiersConfig,
  questXpConfig?: QuestXpConfig,
  classStatPriorities?: Record<string, string[]>,
): Map<string, ValidationIssue[]> {
  // Registry of every `zone:mobKey` across all loaded zones, so per-zone
  // validation can resolve intentional cross-zone quest references (turn-in
  // NPCs, remote givers) instead of warning on every one of them.
  const knownQualifiedMobIds = new Set<string>();
  for (const [zoneId, zone] of zones) {
    for (const mobKey of Object.keys(zone.data.mobs ?? {})) {
      knownQualifiedMobIds.add(`${zoneId}:${mobKey}`);
    }
  }

  const results = new Map<string, ValidationIssue[]>();
  for (const [zoneId, zone] of zones) {
    const issues = validateZone(zone.data, equipmentSlots, validClasses, knownFactions, knownAchievements, mobTiers, questXpConfig, classStatPriorities, { knownQualifiedMobIds });
    if (issues.length > 0) {
      results.set(zoneId, issues);
    }
  }
  return results;
}
