import type { WorldFile, RoomFile, ExitValue } from "@/types/world";

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
