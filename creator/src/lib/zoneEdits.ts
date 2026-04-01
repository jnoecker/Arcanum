import type {
  WorldFile,
  RoomFile,
  ExitValue,
  MobFile,
  ItemFile,
  ShopFile,
  QuestFile,
  GatheringNodeFile,
  RecipeFile,
  DungeonFile,
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

// ─── Generic entity CRUD ────────────────────────────────────────────

type EntityCollection = "mobs" | "items" | "shops" | "quests" | "gatheringNodes" | "recipes";

const ENTITY_LABELS: Record<EntityCollection, string> = {
  mobs: "Mob",
  items: "Item",
  shops: "Shop",
  quests: "Quest",
  gatheringNodes: "Gathering node",
  recipes: "Recipe",
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
  const collections: EntityCollection[] = ["mobs", "items", "shops", "gatheringNodes"];
  for (const col of collections) {
    const map = world[col] as Record<string, { room?: string }> | undefined;
    if (!map) continue;
    for (const [id, entity] of Object.entries(map)) {
      if (entity.room === roomId) delete map[id];
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
  return addEntity(world, "mobs", mobId, mob, mob.room);
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

// ─── ID generation helpers ──────────────────────────────────────────

export function generateEntityId(
  world: WorldFile,
  collection: EntityCollection,
  prefix?: string,
): string {
  const base = prefix ?? world.zone.replace(/[^a-zA-Z0-9]/g, "_");
  const suffix = collection === "gatheringNodes" ? "node" : collection.replace(/s$/, "");
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
