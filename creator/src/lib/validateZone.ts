import type {
  WorldFile,
  DoorFile,
  FeatureFile,
  PuzzleFile,
  PuzzleReward,
  RareYieldFile,
  RecipeFile,
} from "@/types/world";
import type { EquipmentSlotDefinition } from "@/types/config";
import { resolveDoorKeyId, resolveDoorState } from "./doorHelpers";
import { exitTarget } from "./zoneEdits";
import { getTrainerClasses } from "./trainers";

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

function addIssue(
  issues: ValidationIssue[],
  severity: Severity,
  entity: string,
  message: string,
): void {
  issues.push({ severity, entity, message });
}

function hasPositiveOnUse(item: NonNullable<WorldFile["items"]>[string]): boolean {
  const onUse = item.onUse;
  if (!onUse) return false;
  return (onUse.healHp ?? 0) > 0 || (onUse.grantXp ?? 0) > 0;
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
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roomIds = new Set(Object.keys(world.rooms));
  const mobIds = new Set(Object.keys(world.mobs ?? {}));
  const itemIds = new Set(Object.keys(world.items ?? {}));
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
  factionCheck("zone", world.faction, "Controlling faction");

  for (const [roomId, room] of Object.entries(world.rooms)) {
    const entity = `room:${roomId}`;
    if (!room.title?.trim()) addIssue(issues, "warning", entity, "Room has no title");
    if (!room.description?.trim()) addIssue(issues, "warning", entity, "Room has no description");
    if (room.terrain && !VALID_TERRAINS.has(room.terrain)) {
      addIssue(issues, "warning", entity, `Terrain "${room.terrain}" is not a recognized terrain type`);
    }

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
  }

  for (const [mobId, mob] of Object.entries(world.mobs ?? {})) {
    const entity = `mob:${mobId}`;
    if (!mob.name?.trim()) addIssue(issues, "warning", entity, "Mob has no name");
    if (!roomIds.has(mob.room)) addIssue(issues, "error", entity, `Room "${mob.room}" does not exist`);
    factionCheck(entity, mob.faction, "Faction");
    if (mob.category && !VALID_MOB_CATEGORIES.has(mob.category)) {
      addIssue(issues, "warning", entity, `Category "${mob.category}" is not a recognized mob category`);
    }
    if (mob.respawnSeconds != null && mob.respawnSeconds <= 0) {
      addIssue(issues, "error", entity, "Respawn seconds must be greater than 0");
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
    if (item.onUse) {
      if ((item.onUse.healHp ?? 0) < 0) addIssue(issues, "error", entity, "onUse.healHp must be >= 0");
      if ((item.onUse.grantXp ?? 0) < 0) addIssue(issues, "error", entity, "onUse.grantXp must be >= 0");
      if (!hasPositiveOnUse(item)) addIssue(issues, "error", entity, "onUse must define at least one positive effect");
    }
    if (item.slot && equipmentSlots && Object.keys(equipmentSlots).length > 0) {
      if (!equipmentSlots[item.slot] && !equipmentSlots[item.slot.toLowerCase()]) {
        addIssue(issues, "warning", entity, `Slot "${item.slot}" is not a defined equipment slot`);
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

  const trainerRooms = new Set<string>();
  for (const [trainerId, trainer] of Object.entries(world.trainers ?? {})) {
    const entity = `trainer:${trainerId}`;
    if (!trainer.name?.trim()) addIssue(issues, "warning", entity, "Trainer has no name");
    if (!roomIds.has(trainer.room)) addIssue(issues, "error", entity, `Room "${trainer.room}" does not exist`);
    const trainerClassList = getTrainerClasses(trainer);
    if (trainerClassList.length === 0) {
      addIssue(issues, "error", entity, "Trainer has no class");
    } else {
      for (const cls of trainerClassList) {
        if (!VALID_CLASSES.has(cls.toUpperCase())) {
          addIssue(issues, "warning", entity, `Class "${cls}" is not a standard class`);
        }
      }
    }
    if (trainerRooms.has(trainer.room)) {
      addIssue(issues, "warning", entity, `Room "${trainer.room}" already has a trainer`);
    }
    trainerRooms.add(trainer.room);
  }

  for (const [questId, quest] of Object.entries(world.quests ?? {})) {
    const entity = `quest:${questId}`;
    if (!quest.name?.trim()) addIssue(issues, "warning", entity, "Quest has no name");
    if (!quest.giver) {
      addIssue(issues, "warning", entity, "Quest has no giver");
    } else if (!mobIds.has(quest.giver)) {
      addIssue(issues, "warning", entity, `Giver mob "${quest.giver}" is not a known mob in this zone`);
    }
    if (!quest.objectives || quest.objectives.length === 0) {
      addIssue(issues, "error", entity, "Quest must have at least one objective");
    } else {
      for (const [index, obj] of quest.objectives.entries()) {
        if (!obj.type) addIssue(issues, "warning", entity, "Objective has no type");
        if (!obj.targetKey) addIssue(issues, "warning", entity, "Objective has no target key");
        if (obj.count != null && obj.count < 1) {
          addIssue(issues, "error", entity, `Objective #${index + 1} count must be at least 1`);
        }
      }
    }
    if (quest.requiredReputation) {
      factionCheck(entity, quest.requiredReputation.faction, "Rep gate faction");
      const { min, max } = quest.requiredReputation;
      if (min != null && max != null && min > max) {
        addIssue(issues, "error", entity, `Rep gate min (${min}) must be <= max (${max})`);
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
): Map<string, ValidationIssue[]> {
  const results = new Map<string, ValidationIssue[]>();
  for (const [zoneId, zone] of zones) {
    const issues = validateZone(zone.data, equipmentSlots, validClasses, knownFactions, knownAchievements);
    if (issues.length > 0) {
      results.set(zoneId, issues);
    }
  }
  return results;
}
