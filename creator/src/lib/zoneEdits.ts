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

  // Remove mobs/items/shops/gatheringNodes in this room
  if (next.mobs) {
    for (const [id, mob] of Object.entries(next.mobs)) {
      if (mob.room === roomId) delete next.mobs[id];
    }
  }
  if (next.items) {
    for (const [id, item] of Object.entries(next.items)) {
      if (item.room === roomId) delete next.items[id];
    }
  }
  if (next.shops) {
    for (const [id, shop] of Object.entries(next.shops)) {
      if (shop.room === roomId) delete next.shops[id];
    }
  }
  if (next.gatheringNodes) {
    for (const [id, node] of Object.entries(next.gatheringNodes)) {
      if (node.room === roomId) delete next.gatheringNodes[id];
    }
  }

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

export function addMob(
  world: WorldFile,
  mobId: string,
  mob: MobFile,
): WorldFile {
  if (world.mobs?.[mobId]) {
    throw new Error(`Mob "${mobId}" already exists`);
  }
  if (!world.rooms[mob.room]) {
    throw new Error(`Room "${mob.room}" does not exist`);
  }
  const next = clone(world);
  if (!next.mobs) next.mobs = {};
  next.mobs[mobId] = mob;
  return next;
}

export function updateMob(
  world: WorldFile,
  mobId: string,
  patch: Partial<MobFile>,
): WorldFile {
  if (!world.mobs?.[mobId]) {
    throw new Error(`Mob "${mobId}" does not exist`);
  }
  const next = clone(world);
  next.mobs![mobId] = { ...next.mobs![mobId], ...patch } as MobFile;
  return next;
}

export function deleteMob(world: WorldFile, mobId: string): WorldFile {
  if (!world.mobs?.[mobId]) {
    throw new Error(`Mob "${mobId}" does not exist`);
  }
  const next = clone(world);
  delete next.mobs![mobId];
  return next;
}

// ─── Item operations ────────────────────────────────────────────────

export function addItem(
  world: WorldFile,
  itemId: string,
  item: ItemFile,
): WorldFile {
  if (world.items?.[itemId]) {
    throw new Error(`Item "${itemId}" already exists`);
  }
  const next = clone(world);
  if (!next.items) next.items = {};
  next.items[itemId] = item;
  return next;
}

export function updateItem(
  world: WorldFile,
  itemId: string,
  patch: Partial<ItemFile>,
): WorldFile {
  if (!world.items?.[itemId]) {
    throw new Error(`Item "${itemId}" does not exist`);
  }
  const next = clone(world);
  next.items![itemId] = { ...next.items![itemId], ...patch } as ItemFile;
  return next;
}

export function deleteItem(world: WorldFile, itemId: string): WorldFile {
  if (!world.items?.[itemId]) {
    throw new Error(`Item "${itemId}" does not exist`);
  }
  const next = clone(world);
  delete next.items![itemId];

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

export function addShop(
  world: WorldFile,
  shopId: string,
  shop: ShopFile,
): WorldFile {
  if (world.shops?.[shopId]) {
    throw new Error(`Shop "${shopId}" already exists`);
  }
  if (!world.rooms[shop.room]) {
    throw new Error(`Room "${shop.room}" does not exist`);
  }
  const next = clone(world);
  if (!next.shops) next.shops = {};
  next.shops[shopId] = shop;
  return next;
}

export function updateShop(
  world: WorldFile,
  shopId: string,
  patch: Partial<ShopFile>,
): WorldFile {
  if (!world.shops?.[shopId]) {
    throw new Error(`Shop "${shopId}" does not exist`);
  }
  const next = clone(world);
  next.shops![shopId] = { ...next.shops![shopId], ...patch } as ShopFile;
  return next;
}

export function deleteShop(world: WorldFile, shopId: string): WorldFile {
  if (!world.shops?.[shopId]) {
    throw new Error(`Shop "${shopId}" does not exist`);
  }
  const next = clone(world);
  delete next.shops![shopId];
  return next;
}

// ─── Quest operations ───────────────────────────────────────────────

export function addQuest(
  world: WorldFile,
  questId: string,
  quest: QuestFile,
): WorldFile {
  if (world.quests?.[questId]) {
    throw new Error(`Quest "${questId}" already exists`);
  }
  const next = clone(world);
  if (!next.quests) next.quests = {};
  next.quests[questId] = quest;
  return next;
}

export function updateQuest(
  world: WorldFile,
  questId: string,
  patch: Partial<QuestFile>,
): WorldFile {
  if (!world.quests?.[questId]) {
    throw new Error(`Quest "${questId}" does not exist`);
  }
  const next = clone(world);
  next.quests![questId] = { ...next.quests![questId], ...patch } as QuestFile;
  return next;
}

export function deleteQuest(world: WorldFile, questId: string): WorldFile {
  if (!world.quests?.[questId]) {
    throw new Error(`Quest "${questId}" does not exist`);
  }
  const next = clone(world);
  delete next.quests![questId];

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

export function addGatheringNode(
  world: WorldFile,
  nodeId: string,
  node: GatheringNodeFile,
): WorldFile {
  if (world.gatheringNodes?.[nodeId]) {
    throw new Error(`Gathering node "${nodeId}" already exists`);
  }
  if (!world.rooms[node.room]) {
    throw new Error(`Room "${node.room}" does not exist`);
  }
  const next = clone(world);
  if (!next.gatheringNodes) next.gatheringNodes = {};
  next.gatheringNodes[nodeId] = node;
  return next;
}

export function updateGatheringNode(
  world: WorldFile,
  nodeId: string,
  patch: Partial<GatheringNodeFile>,
): WorldFile {
  if (!world.gatheringNodes?.[nodeId]) {
    throw new Error(`Gathering node "${nodeId}" does not exist`);
  }
  const next = clone(world);
  next.gatheringNodes![nodeId] = { ...next.gatheringNodes![nodeId], ...patch } as GatheringNodeFile;
  return next;
}

export function deleteGatheringNode(
  world: WorldFile,
  nodeId: string,
): WorldFile {
  if (!world.gatheringNodes?.[nodeId]) {
    throw new Error(`Gathering node "${nodeId}" does not exist`);
  }
  const next = clone(world);
  delete next.gatheringNodes![nodeId];
  return next;
}

// ─── Recipe operations ──────────────────────────────────────────────

export function addRecipe(
  world: WorldFile,
  recipeId: string,
  recipe: RecipeFile,
): WorldFile {
  if (world.recipes?.[recipeId]) {
    throw new Error(`Recipe "${recipeId}" already exists`);
  }
  const next = clone(world);
  if (!next.recipes) next.recipes = {};
  next.recipes[recipeId] = recipe;
  return next;
}

export function updateRecipe(
  world: WorldFile,
  recipeId: string,
  patch: Partial<RecipeFile>,
): WorldFile {
  if (!world.recipes?.[recipeId]) {
    throw new Error(`Recipe "${recipeId}" does not exist`);
  }
  const next = clone(world);
  next.recipes![recipeId] = { ...next.recipes![recipeId], ...patch } as RecipeFile;
  return next;
}

export function deleteRecipe(world: WorldFile, recipeId: string): WorldFile {
  if (!world.recipes?.[recipeId]) {
    throw new Error(`Recipe "${recipeId}" does not exist`);
  }
  const next = clone(world);
  delete next.recipes![recipeId];
  return next;
}

// ─── ID generation helpers ──────────────────────────────────────────

export function generateEntityId(
  world: WorldFile,
  collection: "mobs" | "items" | "shops" | "quests" | "gatheringNodes" | "recipes",
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
