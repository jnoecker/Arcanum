import type { WorldFile, RoomFile } from "@/types/world";
import type { SketchParseResult, SketchRoom } from "@/types/sketch";
import { OPPOSITE } from "@/lib/zoneEdits";

// ─── Direction inference ────────────────────────────────────────────

const DIR_MAP: Record<string, string> = {
  "0,-1": "n",
  "0,1": "s",
  "1,0": "e",
  "-1,0": "w",
  "1,-1": "ne",
  "-1,-1": "nw",
  "1,1": "se",
  "-1,1": "sw",
};

export function inferDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string | null {
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);
  if (dx === 0 && dy === 0) return null;
  return DIR_MAP[`${dx},${dy}`] ?? null;
}

// ─── Room ID sanitization ───────────────────────────────────────────

export function sanitizeLabel(label: string): string {
  let id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!id || !/^[a-z]/.test(id)) {
    id = "room_" + id;
  }
  return id;
}

function deduplicateId(id: string, existing: Set<string>): string {
  if (!existing.has(id)) return id;
  let n = 2;
  while (existing.has(`${id}_${n}`)) n++;
  return `${id}_${n}`;
}

// ─── Build room ID map from sketch rooms ────────────────────────────

function buildRoomIdMap(
  rooms: SketchRoom[],
  zoneId: string,
  existingIds?: Set<string>,
): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>(existingIds ?? []);
  let unlabeledCount = 0;

  for (const room of rooms) {
    let roomId: string;
    if (room.label) {
      roomId = sanitizeLabel(room.label);
    } else {
      unlabeledCount++;
      roomId = `${zoneId}_room${unlabeledCount}`;
    }
    roomId = deduplicateId(roomId, used);
    used.add(roomId);
    map.set(room.id, roomId);
  }

  return map;
}

// ─── Create new zone from sketch ────────────────────────────────────

export function sketchToWorldData(
  result: SketchParseResult,
  zoneId: string,
): WorldFile {
  if (result.rooms.length === 0) {
    return {
      zone: zoneId,
      startRoom: "entrance",
      rooms: {
        entrance: { title: "Entrance", description: "A new room." },
      },
    };
  }

  const idMap = buildRoomIdMap(result.rooms, zoneId);
  const rooms: Record<string, RoomFile> = {};

  // Create room entries
  for (const sketchRoom of result.rooms) {
    const roomId = idMap.get(sketchRoom.id)!;
    rooms[roomId] = {
      title: sketchRoom.label ?? roomId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: "A new room.",
    };
  }

  // Build grid lookup for direction inference
  const gridLookup = new Map<string, SketchRoom>();
  for (const room of result.rooms) {
    gridLookup.set(room.id, room);
  }

  // Add exits from connections
  for (const conn of result.connections) {
    const fromRoom = gridLookup.get(conn.from);
    const toRoom = gridLookup.get(conn.to);
    if (!fromRoom || !toRoom) continue;

    const fromId = idMap.get(conn.from);
    const toId = idMap.get(conn.to);
    if (!fromId || !toId) continue;
    if (!rooms[fromId] || !rooms[toId]) continue;

    const dir = inferDirection(
      fromRoom.gridX,
      fromRoom.gridY,
      toRoom.gridX,
      toRoom.gridY,
    );
    if (!dir) continue;

    // Forward exit
    if (!rooms[fromId].exits) rooms[fromId].exits = {};
    rooms[fromId].exits![dir] = toId;

    // Reverse exit
    const rev = OPPOSITE[dir];
    if (rev) {
      if (!rooms[toId].exits) rooms[toId].exits = {};
      rooms[toId].exits![rev] = fromId;
    }
  }

  const startRoom = idMap.get(result.rooms[0]!.id) ?? Object.keys(rooms)[0]!;

  return {
    zone: zoneId,
    startRoom,
    rooms,
  };
}

// ─── Merge sketch rooms into existing zone ──────────────────────────

export function mergeSketchRooms(
  world: WorldFile,
  result: SketchParseResult,
): WorldFile {
  if (result.rooms.length === 0) return world;

  const next = structuredClone(world);
  const existingIds = new Set(Object.keys(next.rooms));
  const idMap = buildRoomIdMap(result.rooms, next.zone, existingIds);

  // Add rooms
  for (const sketchRoom of result.rooms) {
    const roomId = idMap.get(sketchRoom.id)!;
    next.rooms[roomId] = {
      title: sketchRoom.label ?? roomId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: "A new room.",
    };
  }

  // Build grid lookup
  const gridLookup = new Map<string, SketchRoom>();
  for (const room of result.rooms) {
    gridLookup.set(room.id, room);
  }

  // Add exits
  for (const conn of result.connections) {
    const fromRoom = gridLookup.get(conn.from);
    const toRoom = gridLookup.get(conn.to);
    if (!fromRoom || !toRoom) continue;

    const fromId = idMap.get(conn.from);
    const toId = idMap.get(conn.to);
    if (!fromId || !toId) continue;
    if (!next.rooms[fromId] || !next.rooms[toId]) continue;

    const dir = inferDirection(
      fromRoom.gridX,
      fromRoom.gridY,
      toRoom.gridX,
      toRoom.gridY,
    );
    if (!dir) continue;

    if (!next.rooms[fromId].exits) next.rooms[fromId].exits = {};
    next.rooms[fromId].exits![dir] = toId;

    const rev = OPPOSITE[dir];
    if (rev) {
      if (!next.rooms[toId].exits) next.rooms[toId].exits = {};
      next.rooms[toId].exits![rev] = fromId;
    }
  }

  return next;
}
