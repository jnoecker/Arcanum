import type {
  WorldFile,
  RoomFile,
  ExitValue,
  DoorFile,
  FeatureFile,
  MobFile,
  ItemFile,
  ShopFile,
  TrainerFile,
  QuestFile,
  GatheringNodeFile,
  RecipeFile,
  DungeonFile,
  PuzzleFile,
} from "@/types/world";

// ─── Pure helpers for WorldFile mutation (immutable) ─────────────────

/** Deep-clone a WorldFile so callers never mutate the original. */
function clone(world: WorldFile): WorldFile {
  return structuredClone(world);
}

export const OPPOSITE: Record<string, string> = {
  n: "s",
  s: "n",
  e: "w",
  w: "e",
  ne: "sw",
  sw: "ne",
  nw: "se",
  se: "nw",
  u: "d",
  d: "u",
};

/** Map long-form direction names to their abbreviated forms. */
const DIR_ABBREV: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
  up: "u",
  down: "d",
};

/** Normalize a direction key to its abbreviated form (n/s/e/w/etc.). */
export function normalizeDir(dir: string): string {
  return DIR_ABBREV[dir.toLowerCase()] ?? dir;
}

/**
 * Migrate the legacy `mob.room` shorthand to a single-entry `spawns` list.
 * Idempotent: mobs that already declare `spawns` are left as-is, with their
 * stale `room` field stripped. Mutates in place and returns the same world.
 *
 * For migrating legacy entries we rebuild the mob object so `spawns` lands
 * in the same key position `room` used to occupy — this keeps the YAML diff
 * minimal on the next save (matching the MUD-side migrated format).
 */
export function normalizeMobSpawns(world: WorldFile): WorldFile {
  if (!world.mobs) return world;
  for (const [id, mob] of Object.entries(world.mobs)) {
    if (mob.spawns && mob.spawns.length > 0) {
      if (mob.room !== undefined) delete mob.room;
      continue;
    }
    if (mob.room) {
      const room = mob.room;
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(mob)) {
        if (k === "room") {
          next.spawns = [{ room }];
        } else {
          next[k] = v;
        }
      }
      world.mobs[id] = next as unknown as MobFile;
    }
  }
  return world;
}

/**
 * Normalize all exit direction keys in a WorldFile from long-form
 * ("north", "south") to abbreviated form ("n", "s").
 * Mutates in place and returns the same object.
 */
export function normalizeExitDirections(world: WorldFile): WorldFile {
  for (const room of Object.values(world.rooms)) {
    if (!room.exits) continue;
    const normalized: Record<string, string | ExitValue> = {};
    let changed = false;
    for (const [dir, val] of Object.entries(room.exits)) {
      const abbr = normalizeDir(dir);
      if (abbr !== dir) changed = true;
      normalized[abbr] = val;
    }
    if (changed) {
      room.exits = normalized;
    }
  }
  return world;
}

// ─── Generic entity CRUD ────────────────────────────────────────────

type EntityCollection =
  | "mobs"
  | "items"
  | "shops"
  | "trainers"
  | "quests"
  | "gatheringNodes"
  | "recipes"
  | "puzzles";

const ENTITY_LABELS: Record<EntityCollection, string> = {
  mobs: "Mob",
  items: "Item",
  shops: "Shop",
  trainers: "Trainer",
  quests: "Quest",
  gatheringNodes: "Gathering node",
  recipes: "Recipe",
  puzzles: "Puzzle",
};

function addEntity<T>(
  world: WorldFile,
  collection: EntityCollection,
  id: string,
  entity: T,
  roomField?: string,
): WorldFile {
  const label = ENTITY_LABELS[collection];
  if (world[collection]?.[id]) {
    throw new Error(`${label} "${id}" already exists`);
  }
  if (roomField && !world.rooms[roomField]) {
    throw new Error(`Room "${roomField}" does not exist`);
  }
  const next = clone(world);
  if (!next[collection]) (next as any)[collection] = {};
  (next[collection] as Record<string, T>)[id] = entity;
  return next;
}

function updateEntity<T>(
  world: WorldFile,
  collection: EntityCollection,
  id: string,
  patch: Partial<T>,
): WorldFile {
  const label = ENTITY_LABELS[collection];
  if (!world[collection]?.[id]) {
    throw new Error(`${label} "${id}" does not exist`);
  }
  const next = clone(world);
  const col = next[collection] as Record<string, T>;
  col[id] = { ...col[id], ...patch } as T;
  return next;
}

function removeEntity(
  world: WorldFile,
  collection: EntityCollection,
  id: string,
): WorldFile {
  const label = ENTITY_LABELS[collection];
  if (!world[collection]?.[id]) {
    throw new Error(`${label} "${id}" does not exist`);
  }
  const next = clone(world);
  delete (next[collection] as Record<string, unknown>)[id];
  return next;
}

/** Remove all entities in a given room across room-bound collections. */
function removeEntitiesInRoom(world: WorldFile, roomId: string): void {
  // Mobs: drop matching spawn entries; delete the mob entirely if no spawns remain.
  if (world.mobs) {
    for (const [id, mob] of Object.entries(world.mobs)) {
      const spawns = (mob.spawns ?? []).filter((s) => s.room !== roomId);
      if (spawns.length === 0) {
        delete world.mobs[id];
      } else if (spawns.length !== (mob.spawns?.length ?? 0)) {
        world.mobs[id] = { ...mob, spawns };
      }
    }
  }
  // Other room-bound collections: delete entity if its single room matches.
  const collections: EntityCollection[] = ["items", "shops", "trainers", "gatheringNodes"];
  for (const col of collections) {
    const map = world[col] as Record<string, { room?: string }> | undefined;
    if (!map) continue;
    for (const [id, entity] of Object.entries(map)) {
      if (entity.room === roomId) delete map[id];
    }
  }
  // Puzzles live at zone level but reference a room via puzzle.roomId.
  if (world.puzzles) {
    for (const [id, puzzle] of Object.entries(world.puzzles)) {
      if (puzzle.roomId === roomId) delete world.puzzles[id];
    }
  }
}

// ─── Room operations ─────────────────────────────────────────────────

export function addRoom(
  world: WorldFile,
  roomId: string,
  room: RoomFile,
): WorldFile {
  if (world.rooms[roomId]) {
    throw new Error(`Room "${roomId}" already exists`);
  }
  const next = clone(world);
  next.rooms[roomId] = room;
  return next;
}

export function deleteRoom(world: WorldFile, roomId: string): WorldFile {
  if (roomId === world.startRoom) {
    throw new Error("Cannot delete the start room");
  }
  if (!world.rooms[roomId]) {
    throw new Error(`Room "${roomId}" does not exist`);
  }
  const next = clone(world);
  delete next.rooms[roomId];

  // Remove exits pointing to this room from all other rooms
  for (const room of Object.values(next.rooms)) {
    if (!room.exits) continue;
    for (const [dir, exit] of Object.entries(room.exits)) {
      const target = typeof exit === "string" ? exit : exit.to;
      if (target === roomId) {
        delete room.exits[dir];
      }
    }
  }

  // Remove entities in this room
  removeEntitiesInRoom(next, roomId);

  return next;
}

export function updateRoom(
  world: WorldFile,
  roomId: string,
  patch: Partial<RoomFile>,
): WorldFile {
  if (!world.rooms[roomId]) {
    throw new Error(`Room "${roomId}" does not exist`);
  }
  const next = clone(world);
  const existing = next.rooms[roomId];
  next.rooms[roomId] = { ...existing, ...patch } as RoomFile;
  return next;
}

// ─── Exit operations ─────────────────────────────────────────────────

export function addExit(
  world: WorldFile,
  sourceRoom: string,
  direction: string,
  targetRoom: string,
  bidirectional = true,
): WorldFile {
  if (!world.rooms[sourceRoom]) {
    throw new Error(`Source room "${sourceRoom}" does not exist`);
  }
  // Target can be cross-zone (contains ":") so we only validate same-zone targets
  if (!targetRoom.includes(":") && !world.rooms[targetRoom]) {
    throw new Error(`Target room "${targetRoom}" does not exist`);
  }
  const next = clone(world);
  const srcRoom = next.rooms[sourceRoom]!;
  if (!srcRoom.exits) srcRoom.exits = {};
  srcRoom.exits[direction] = targetRoom;

  if (bidirectional && !targetRoom.includes(":")) {
    const rev = OPPOSITE[direction];
    const tgtRoom = next.rooms[targetRoom];
    if (rev && tgtRoom) {
      if (!tgtRoom.exits) tgtRoom.exits = {};
      tgtRoom.exits[rev] = sourceRoom;
    }
  }

  return next;
}

export function deleteExit(
  world: WorldFile,
  sourceRoom: string,
  direction: string,
  bidirectional = true,
): WorldFile {
  if (!world.rooms[sourceRoom]?.exits?.[direction]) {
    throw new Error(
      `Exit "${direction}" from "${sourceRoom}" does not exist`,
    );
  }
  const next = clone(world);
  const srcRoom = next.rooms[sourceRoom]!;
  const srcExits = srcRoom.exits!;
  const exit = srcExits[direction]!;
  const target = typeof exit === "string" ? exit : exit.to;

  delete srcExits[direction];

  if (bidirectional && !target.includes(":")) {
    const rev = OPPOSITE[direction];
    if (rev && next.rooms[target]?.exits?.[rev]) {
      const revExit = next.rooms[target].exits![rev];
      const revTarget = typeof revExit === "string" ? revExit : revExit.to;
      if (revTarget === sourceRoom) {
        delete next.rooms[target].exits![rev];
      }
    }
  }

  return next;
}

// ─── Exit door operations ───────────────────────────────────────────

/**
 * Update an existing exit's direction, target, and bidirectional behavior.
 * Preserves any door metadata on the source exit while reworking the reverse
 * link when the destination is in the current zone.
 */
export function updateExit(
  world: WorldFile,
  sourceRoom: string,
  currentDirection: string,
  nextDirection: string,
  nextTargetRoom: string,
  bidirectional = true,
): WorldFile {
  const existing = world.rooms[sourceRoom]?.exits?.[currentDirection];
  if (!existing) {
    throw new Error(`Exit "${currentDirection}" from "${sourceRoom}" does not exist`);
  }

  const normalizedDirection = normalizeDir(nextDirection.trim());
  const trimmedTarget = nextTargetRoom.trim();
  if (!normalizedDirection) {
    throw new Error("Exit direction is required");
  }
  if (!trimmedTarget) {
    throw new Error("Exit target is required");
  }

  const currentExits = world.rooms[sourceRoom]?.exits ?? {};
  if (normalizedDirection !== currentDirection && currentExits[normalizedDirection]) {
    throw new Error(`Exit "${normalizedDirection}" from "${sourceRoom}" already exists`);
  }

  const door = typeof existing === "string" ? undefined : existing.door;
  const effectiveBidirectional = bidirectional && !trimmedTarget.includes(":");

  let next = deleteExit(world, sourceRoom, currentDirection, true);
  next = addExit(next, sourceRoom, normalizedDirection, trimmedTarget, effectiveBidirectional);
  if (door) {
    next = setExitDoor(next, sourceRoom, normalizedDirection, door);
  }
  return next;
}

/**
 * Canonical door initial states. Mirrors the Kotlin {@code DoorFile.initialState}
 * values the MUD accepts ("open" | "closed" | "locked").
 */
export const DOOR_INITIAL_STATES = ["open", "closed", "locked"] as const;
export type DoorInitialState = typeof DOOR_INITIAL_STATES[number];

/**
 * Attach or replace the door on an existing exit. Converts shorthand
 * (string) exit values to the object form. The door patch is merged with
 * any existing door fields and undefined entries are stripped so we never
 * emit noise into YAML.
 */
export function setExitDoor(
  world: WorldFile,
  sourceRoom: string,
  direction: string,
  doorPatch: Partial<DoorFile>,
): WorldFile {
  const srcExits = world.rooms[sourceRoom]?.exits;
  if (!srcExits || !(direction in srcExits)) {
    throw new Error(`Exit "${direction}" from "${sourceRoom}" does not exist`);
  }
  const next = clone(world);
  const exit = next.rooms[sourceRoom]!.exits![direction]!;
  const existing: ExitValue = typeof exit === "string" ? { to: exit } : exit;
  const merged: DoorFile = { ...(existing.door ?? {}), ...doorPatch };
  const cleaned = cleanDoor(merged);
  const nextExit: ExitValue = { to: existing.to };
  if (cleaned) nextExit.door = cleaned;
  if (existing.requiresAchievement) nextExit.requiresAchievement = existing.requiresAchievement;
  if (existing.lockedMessage) nextExit.lockedMessage = existing.lockedMessage;
  next.rooms[sourceRoom]!.exits![direction] = nextExit;
  return next;
}

/**
 * Remove the door from an exit. Collapses back to shorthand only if no other
 * object-form fields (e.g. achievement gate) remain.
 */
export function removeExitDoor(
  world: WorldFile,
  sourceRoom: string,
  direction: string,
): WorldFile {
  const srcExits = world.rooms[sourceRoom]?.exits;
  if (!srcExits || !(direction in srcExits)) {
    throw new Error(`Exit "${direction}" from "${sourceRoom}" does not exist`);
  }
  const next = clone(world);
  const exit = next.rooms[sourceRoom]!.exits![direction]!;
  if (typeof exit === "string") return world;
  if (exit.requiresAchievement || exit.lockedMessage) {
    const { door: _door, ...rest } = exit;
    next.rooms[sourceRoom]!.exits![direction] = rest;
  } else {
    next.rooms[sourceRoom]!.exits![direction] = exit.to;
  }
  return next;
}

/**
 * Set or update the achievement gate on an exit. Converts shorthand (string)
 * exits to the object form and preserves any existing door settings.
 * Pass `undefined` for `requiresAchievement` to clear the gate.
 */
export function setExitAchievementGate(
  world: WorldFile,
  sourceRoom: string,
  direction: string,
  patch: { requiresAchievement?: string; lockedMessage?: string },
): WorldFile {
  const srcExits = world.rooms[sourceRoom]?.exits;
  if (!srcExits || !(direction in srcExits)) {
    throw new Error(`Exit "${direction}" from "${sourceRoom}" does not exist`);
  }
  const next = clone(world);
  const exit = next.rooms[sourceRoom]!.exits![direction]!;
  const existing: ExitValue = typeof exit === "string" ? { to: exit } : exit;
  const nextExit: ExitValue = { to: existing.to };
  if (existing.door) nextExit.door = existing.door;
  const requires = patch.requiresAchievement !== undefined ? patch.requiresAchievement : existing.requiresAchievement;
  const message = patch.lockedMessage !== undefined ? patch.lockedMessage : existing.lockedMessage;
  if (requires) nextExit.requiresAchievement = requires;
  if (message) nextExit.lockedMessage = message;
  if (!nextExit.door && !nextExit.requiresAchievement && !nextExit.lockedMessage) {
    next.rooms[sourceRoom]!.exits![direction] = nextExit.to;
  } else {
    next.rooms[sourceRoom]!.exits![direction] = nextExit;
  }
  return next;
}

/**
 * Strip undefined/legacy keys from a door and return `undefined` if nothing
 * meaningful remains. Used by both editor helpers and sanitizeZone.
 */
function cleanDoor(door: DoorFile): DoorFile | undefined {
  const out: DoorFile = {};
  if (door.initialState) out.initialState = door.initialState;
  if (door.keyItemId) out.keyItemId = door.keyItemId;
  if (door.keyConsumed != null) out.keyConsumed = door.keyConsumed;
  if (door.resetWithZone != null) out.resetWithZone = door.resetWithZone;
  return Object.keys(out).length > 0 ? out : undefined;
}

// ─── Room feature operations ────────────────────────────────────────

/**
 * Feature types supported by the server's FeatureFile DTO. Keep in sync
 * with the Kotlin enum if the server ever grows a new one.
 */
export const FEATURE_TYPES = ["CONTAINER", "LEVER", "SIGN"] as const;
export type FeatureType = typeof FEATURE_TYPES[number];

export const CONTAINER_STATES = ["open", "closed", "locked"] as const;
export const LEVER_STATES = ["up", "down"] as const;

/** Build a sensible blank feature of the given type. */
export function defaultFeature(type: FeatureType, featureKey: string): FeatureFile {
  const base: FeatureFile = {
    type,
    displayName: featureKey.replace(/_/g, " "),
    keyword: featureKey,
  };
  if (type === "CONTAINER") {
    base.initialState = "closed";
    base.resetWithZone = true;
    base.items = [];
  } else if (type === "LEVER") {
    base.initialState = "up";
    base.resetWithZone = true;
  } else if (type === "SIGN") {
    base.text = "";
  }
  return base;
}

/** Generate a unique feature key within the room. */
export function generateFeatureId(
  world: WorldFile,
  roomId: string,
  type: FeatureType,
): string {
  const room = world.rooms[roomId];
  if (!room) throw new Error(`Room "${roomId}" does not exist`);
  const prefix = type.toLowerCase();
  const existing = room.features ?? {};
  let n = Object.keys(existing).filter((k) => k.startsWith(prefix)).length + 1;
  while (existing[`${prefix}_${n}`]) n++;
  return `${prefix}_${n}`;
}

export function addFeature(
  world: WorldFile,
  roomId: string,
  featureId: string,
  feature: FeatureFile,
): WorldFile {
  if (!world.rooms[roomId]) {
    throw new Error(`Room "${roomId}" does not exist`);
  }
  if (world.rooms[roomId].features?.[featureId]) {
    throw new Error(`Feature "${featureId}" already exists in room "${roomId}"`);
  }
  const next = clone(world);
  const room = next.rooms[roomId]!;
  if (!room.features) room.features = {};
  room.features[featureId] = cleanFeature(feature);
  return next;
}

export function updateFeature(
  world: WorldFile,
  roomId: string,
  featureId: string,
  patch: Partial<FeatureFile>,
): WorldFile {
  const existing = world.rooms[roomId]?.features?.[featureId];
  if (!existing) {
    throw new Error(`Feature "${featureId}" does not exist in room "${roomId}"`);
  }
  const next = clone(world);
  next.rooms[roomId]!.features![featureId] = cleanFeature({ ...existing, ...patch });
  return next;
}

export function removeFeature(
  world: WorldFile,
  roomId: string,
  featureId: string,
): WorldFile {
  if (!world.rooms[roomId]?.features?.[featureId]) {
    throw new Error(`Feature "${featureId}" does not exist in room "${roomId}"`);
  }
  const next = clone(world);
  const room = next.rooms[roomId]!;
  delete room.features![featureId];
  if (Object.keys(room.features!).length === 0) {
    delete room.features;
  }
  return next;
}

/**
 * Rename a feature's local key while preserving its position in insertion
 * order. The local key is what sequence puzzle steps reference via
 * `steps[].feature`, so keeping it stable and visible matters.
 */
export function renameFeature(
  world: WorldFile,
  roomId: string,
  oldId: string,
  newId: string,
): WorldFile {
  if (oldId === newId) return world;
  const room = world.rooms[roomId];
  if (!room?.features?.[oldId]) {
    throw new Error(`Feature "${oldId}" does not exist in room "${roomId}"`);
  }
  if (room.features[newId]) {
    throw new Error(`Feature "${newId}" already exists in room "${roomId}"`);
  }
  const next = clone(world);
  const rebuilt: Record<string, FeatureFile> = {};
  for (const [key, value] of Object.entries(next.rooms[roomId]!.features!)) {
    rebuilt[key === oldId ? newId : key] = value;
  }
  next.rooms[roomId]!.features = rebuilt;
  return next;
}

/**
 * Reorder features within a room by providing the new ordered key list. Keys
 * not in the list are dropped (so callers should pass the full set).
 */
export function reorderFeatures(
  world: WorldFile,
  roomId: string,
  orderedIds: string[],
): WorldFile {
  const room = world.rooms[roomId];
  if (!room?.features) {
    throw new Error(`Room "${roomId}" has no features to reorder`);
  }
  const next = clone(world);
  const current = next.rooms[roomId]!.features!;
  const rebuilt: Record<string, FeatureFile> = {};
  for (const id of orderedIds) {
    if (current[id]) rebuilt[id] = current[id];
  }
  next.rooms[roomId]!.features = rebuilt;
  return next;
}

/**
 * Strip empty / type-inappropriate fields from a feature so the YAML stays
 * minimal. E.g. a LEVER should not carry `items` or `text`.
 */
function cleanFeature(feature: FeatureFile): FeatureFile {
  const type = feature.type.trim().toUpperCase();
  const out: FeatureFile = {
    type,
    displayName: feature.displayName ?? "",
    keyword: feature.keyword ?? "",
  };
  if (type === "CONTAINER") {
    if (feature.initialState) out.initialState = feature.initialState;
    if (feature.keyItemId) out.keyItemId = feature.keyItemId;
    if (feature.keyConsumed != null) out.keyConsumed = feature.keyConsumed;
    if (feature.resetWithZone != null) out.resetWithZone = feature.resetWithZone;
    if (feature.items && feature.items.length > 0) out.items = [...feature.items];
  } else if (type === "LEVER") {
    if (feature.initialState) out.initialState = feature.initialState;
    if (feature.resetWithZone != null) out.resetWithZone = feature.resetWithZone;
  } else if (type === "SIGN") {
    if (feature.text != null) out.text = feature.text;
  }
  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Generate a unique room ID based on zone name. */
export function generateRoomId(world: WorldFile): string {
  const base = world.zone.replace(/[^a-zA-Z0-9]/g, "_");
  let n = Object.keys(world.rooms).length + 1;
  while (world.rooms[`${base}_room${n}`]) {
    n++;
  }
  return `${base}_room${n}`;
}

/** Resolve exit value to a target string. */
export function exitTarget(exit: string | ExitValue): string {
  return typeof exit === "string" ? exit : exit.to;
}

// ─── Mob operations ─────────────────────────────────────────────────

export function addMob(world: WorldFile, mobId: string, mob: MobFile): WorldFile {
  return addEntity(world, "mobs", mobId, mob, mob.spawns?.[0]?.room);
}

export function updateMob(world: WorldFile, mobId: string, patch: Partial<MobFile>): WorldFile {
  return updateEntity(world, "mobs", mobId, patch);
}

export function deleteMob(world: WorldFile, mobId: string): WorldFile {
  const next = removeEntity(world, "mobs", mobId);
  // Clear quest giver references pointing to this mob
  if (next.quests) {
    for (const quest of Object.values(next.quests)) {
      if (quest.giver === mobId) {
        quest.giver = "";
      }
    }
  }
  return next;
}

// ─── Item operations ────────────────────────────────────────────────

export function addItem(world: WorldFile, itemId: string, item: ItemFile): WorldFile {
  return addEntity(world, "items", itemId, item, item.room || undefined);
}

export function updateItem(world: WorldFile, itemId: string, patch: Partial<ItemFile>): WorldFile {
  return updateEntity(world, "items", itemId, patch);
}

export function deleteItem(world: WorldFile, itemId: string): WorldFile {
  const next = removeEntity(world, "items", itemId);
  // Remove from shop inventories
  if (next.shops) {
    for (const shop of Object.values(next.shops)) {
      if (shop.items) {
        shop.items = shop.items.filter((id) => id !== itemId);
      }
    }
  }
  // Remove from mob drops
  if (next.mobs) {
    for (const mob of Object.values(next.mobs)) {
      if (mob.drops) {
        mob.drops = mob.drops.filter((d) => d.itemId !== itemId);
      }
    }
  }
  return next;
}

// ─── Shop operations ────────────────────────────────────────────────

export function addShop(world: WorldFile, shopId: string, shop: ShopFile): WorldFile {
  return addEntity(world, "shops", shopId, shop, shop.room);
}

export function updateShop(world: WorldFile, shopId: string, patch: Partial<ShopFile>): WorldFile {
  return updateEntity(world, "shops", shopId, patch);
}

export function deleteShop(world: WorldFile, shopId: string): WorldFile {
  return removeEntity(world, "shops", shopId);
}

// ─── Trainer operations ─────────────────────────────────────────────

export function addTrainer(world: WorldFile, trainerId: string, trainer: TrainerFile): WorldFile {
  return addEntity(world, "trainers", trainerId, trainer, trainer.room);
}

export function updateTrainer(world: WorldFile, trainerId: string, patch: Partial<TrainerFile>): WorldFile {
  return updateEntity(world, "trainers", trainerId, patch);
}

export function deleteTrainer(world: WorldFile, trainerId: string): WorldFile {
  return removeEntity(world, "trainers", trainerId);
}

// ─── Quest operations ───────────────────────────────────────────────

export function addQuest(world: WorldFile, questId: string, quest: QuestFile): WorldFile {
  return addEntity(world, "quests", questId, quest);
}

export function updateQuest(world: WorldFile, questId: string, patch: Partial<QuestFile>): WorldFile {
  return updateEntity(world, "quests", questId, patch);
}

export function deleteQuest(world: WorldFile, questId: string): WorldFile {
  const next = removeEntity(world, "quests", questId);
  // Remove quest references from mobs
  if (next.mobs) {
    for (const mob of Object.values(next.mobs)) {
      if (mob.quests) {
        mob.quests = mob.quests.filter((id) => id !== questId);
      }
    }
  }
  return next;
}

// ─── Gathering node operations ──────────────────────────────────────

export function addGatheringNode(world: WorldFile, nodeId: string, node: GatheringNodeFile): WorldFile {
  return addEntity(world, "gatheringNodes", nodeId, node, node.room);
}

export function updateGatheringNode(world: WorldFile, nodeId: string, patch: Partial<GatheringNodeFile>): WorldFile {
  return updateEntity(world, "gatheringNodes", nodeId, patch);
}

export function deleteGatheringNode(world: WorldFile, nodeId: string): WorldFile {
  return removeEntity(world, "gatheringNodes", nodeId);
}

// ─── Recipe operations ──────────────────────────────────────────────

export function addRecipe(world: WorldFile, recipeId: string, recipe: RecipeFile): WorldFile {
  return addEntity(world, "recipes", recipeId, recipe);
}

export function updateRecipe(world: WorldFile, recipeId: string, patch: Partial<RecipeFile>): WorldFile {
  return updateEntity(world, "recipes", recipeId, patch);
}

export function deleteRecipe(world: WorldFile, recipeId: string): WorldFile {
  return removeEntity(world, "recipes", recipeId);
}

// ─── Puzzle operations ─────────────────────────────────────────────

export function addPuzzle(world: WorldFile, puzzleId: string, puzzle: PuzzleFile): WorldFile {
  return addEntity(world, "puzzles", puzzleId, puzzle, puzzle.roomId.includes(":") ? undefined : puzzle.roomId);
}

export function updatePuzzle(world: WorldFile, puzzleId: string, patch: Partial<PuzzleFile>): WorldFile {
  return updateEntity(world, "puzzles", puzzleId, patch);
}

export function deletePuzzle(world: WorldFile, puzzleId: string): WorldFile {
  return removeEntity(world, "puzzles", puzzleId);
}

/** Build a sensible blank puzzle for the given room and type. */
export function defaultPuzzle(roomId: string, type: "riddle" | "sequence"): PuzzleFile {
  if (type === "riddle") {
    return {
      type: "riddle",
      roomId,
      question: "",
      answer: "",
      reward: { type: "give_gold", gold: 10 },
    };
  }
  return {
    type: "sequence",
    roomId,
    steps: [],
    reward: { type: "give_gold", gold: 10 },
  };
}

// ─── ID generation helpers ──────────────────────────────────────────

export function generateEntityId(
  world: WorldFile,
  collection: EntityCollection,
  prefix?: string,
): string {
  const base = prefix ?? world.zone.replace(/[^a-zA-Z0-9]/g, "_");
  const suffix = collection === "gatheringNodes" ? "node" : collection === "trainers" ? "trainer" : collection.replace(/s$/, "");
  const existing = world[collection] ?? {};
  let n = Object.keys(existing).length + 1;
  while (existing[`${base}_${suffix}${n}`]) {
    n++;
  }
  return `${base}_${suffix}${n}`;
}

// ─── Dungeon operations ────────────────────────────────────────────

export function setDungeon(world: WorldFile, dungeon: DungeonFile): WorldFile {
  const next = clone(world);
  next.dungeon = dungeon;
  return next;
}

export function updateDungeon(world: WorldFile, patch: Partial<DungeonFile>): WorldFile {
  const next = clone(world);
  next.dungeon = { ...next.dungeon!, ...patch };
  return next;
}

export function removeDungeon(world: WorldFile): WorldFile {
  const next = clone(world);
  delete next.dungeon;
  return next;
}
