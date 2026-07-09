import type { Node } from "@xyflow/react";
import type { WorldFile } from "@/types/world";
import { exitTarget, normalizeDir } from "@/lib/zoneEdits";

/**
 * Map-pin grid contract, shared with the AmbonMUD server (WorldLoader).
 *
 * Every room may carry an explicit minimap cell (`mapX`/`mapY`/`mapZ` in zone
 * YAML). The server seats pinned rooms exactly where the author put them and
 * BFS-places unpinned rooms around them. This module is Arcanum's side of the
 * contract: it derives pins from the zone editor's dragged node positions
 * ("Save Layout") and applies them back onto the WorldFile.
 *
 * Grid frame (matches the server): `+x` = east, `+y` = south, `z` = floor
 * (0 = ground, `u` exits go up one floor, `d` down one). Absolute values are
 * meaningless — only relative placement within a floor matters — so pins are
 * normalized to a 0-based frame per floor.
 */

/** Node footprint + gutters — one layout grid cell in pixels. `dagreLayout`
 *  builds pixel positions from these; quantization inverts them. */
export const DEFAULT_NODE_WIDTH = 220;
export const DEFAULT_NODE_HEIGHT = 140;
export const COL_GUTTER = 80;
export const ROW_GUTTER = 60;
export const CELL_W = DEFAULT_NODE_WIDTH + COL_GUTTER;
export const CELL_H = DEFAULT_NODE_HEIGHT + ROW_GUTTER;

/**
 * Compass direction → grid offset (x, y). Y-axis is inverted: negative = up
 * (north). Mirrors the server's DIRECTION_OFFSETS. u/d are omitted on
 * purpose: they're floor transitions, not 2D directions.
 */
export const DIR_OFFSET: Record<string, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
};

export interface MapPin {
  x: number;
  y: number;
  z: number;
}

/**
 * A room's authored pin, or undefined when it declares none. Half-specified
 * pins (only one of mapX/mapY) are treated as unpinned here — `validateZone`
 * flags them as errors, since the server refuses to load them.
 */
export function roomMapPin(room: WorldFile["rooms"][string]): MapPin | undefined {
  if (room.mapX == null || room.mapY == null) return undefined;
  return { x: room.mapX, y: room.mapY, z: room.mapZ ?? 0 };
}

/** All authored pins in a zone, keyed by room id. */
export function zoneMapPins(world: WorldFile): Map<string, MapPin> {
  const pins = new Map<string, MapPin>();
  for (const [id, room] of Object.entries(world.rooms)) {
    const pin = roomMapPin(room);
    if (pin) pins.set(id, pin);
  }
  return pins;
}

/** Spiral outward from (x, y) to the nearest unoccupied grid cell. */
export function findFreeCell(
  x: number,
  y: number,
  grid: Map<string, string>,
): [number, number] {
  for (let r = 1; r <= 20; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) < r && Math.abs(dy) < r) continue;
        const key = `${x + dx},${y + dy}`;
        if (!grid.has(key)) return [x + dx, y + dy];
      }
    }
  }
  return [x + 1, y];
}

/**
 * Assign each room a floor by walking the exit graph from the start room,
 * mirroring the server's layout: horizontal exits stay on the current floor,
 * `u` goes to floor+1, `d` to floor-1. Rooms with no static inbound path are
 * anchored through their own outgoing exits (offset reversed); anything fully
 * disconnected lands on the ground floor.
 */
export function roomFloors(world: WorldFile): Map<string, number> {
  const floors = new Map<string, number>();
  const queue: string[] = [];

  const seed = (id: string, z: number) => {
    if (!world.rooms[id] || floors.has(id)) return;
    floors.set(id, z);
    queue.push(id);
  };

  const drain = () => {
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const z = floors.get(cur)!;
      const exits = world.rooms[cur]?.exits;
      if (!exits) continue;
      for (const [rawDir, exitVal] of Object.entries(exits)) {
        const target = exitTarget(exitVal);
        if (target.includes(":")) continue; // cross-zone
        const dir = normalizeDir(rawDir);
        const dz = dir === "u" ? 1 : dir === "d" ? -1 : 0;
        seed(target, z + dz);
      }
    }
  };

  if (world.rooms[world.startRoom]) seed(world.startRoom, 0);
  drain();

  // Rooms only reachable through dynamic exits (puzzles, etc.): anchor each
  // through an outgoing exit back to a placed neighbour, repeating until
  // stable so chains of hidden rooms resolve too.
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [id, room] of Object.entries(world.rooms)) {
      if (floors.has(id) || !room.exits) continue;
      for (const [rawDir, exitVal] of Object.entries(room.exits)) {
        const target = exitTarget(exitVal);
        if (target.includes(":")) continue;
        const zn = floors.get(target);
        if (zn == null) continue;
        const dir = normalizeDir(rawDir);
        // Reversed: my `u` exit leads to a room above me, so I sit below it.
        const z = dir === "u" ? zn - 1 : dir === "d" ? zn + 1 : zn;
        seed(id, z);
        progressed = true;
        break;
      }
    }
    drain();
  }

  for (const id of Object.keys(world.rooms)) {
    if (!floors.has(id)) floors.set(id, 0);
  }
  return floors;
}

/**
 * Quantize the zone editor's current node positions into map pins: nearest
 * grid cell per room (from the node's pixel center), spiral-resolved on
 * collision, normalized to a 0-based frame per floor. Floors come from the
 * exit graph (see {@link roomFloors}), not from pixel positions, so they
 * always agree with what the server would derive.
 *
 * Cross-zone nodes and nodes without a backing room are ignored.
 */
export function quantizeLayout(
  nodes: Node[],
  world: WorldFile,
): Map<string, MapPin> {
  const floors = roomFloors(world);
  const byFloor = new Map<number, Array<{ id: string; cx: number; cy: number }>>();
  for (const node of nodes) {
    if (!world.rooms[node.id]) continue;
    const w = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
    const h = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
    const z = floors.get(node.id) ?? 0;
    const list = byFloor.get(z) ?? [];
    list.push({
      id: node.id,
      cx: (node.position?.x ?? 0) + w / 2,
      cy: (node.position?.y ?? 0) + h / 2,
    });
    byFloor.set(z, list);
  }

  const pins = new Map<string, MapPin>();
  for (const [z, rooms] of byFloor) {
    let minCx = Infinity;
    let minCy = Infinity;
    for (const r of rooms) {
      if (r.cx < minCx) minCx = r.cx;
      if (r.cy < minCy) minCy = r.cy;
    }

    const provisional = rooms.map((r) => ({
      id: r.id,
      gx: Math.round((r.cx - minCx) / CELL_W),
      gy: Math.round((r.cy - minCy) / CELL_H),
    }));
    // Reading order, then id — deterministic, and rooms keep their own cell
    // over latecomers when two quantize to the same spot.
    provisional.sort((a, b) => a.gy - b.gy || a.gx - b.gx || a.id.localeCompare(b.id));

    const grid = new Map<string, string>();
    const placed: Array<{ id: string; gx: number; gy: number }> = [];
    for (const p of provisional) {
      let gx = p.gx;
      let gy = p.gy;
      if (grid.has(`${gx},${gy}`)) [gx, gy] = findFreeCell(gx, gy, grid);
      grid.set(`${gx},${gy}`, p.id);
      placed.push({ id: p.id, gx, gy });
    }

    let minGx = Infinity;
    let minGy = Infinity;
    for (const p of placed) {
      if (p.gx < minGx) minGx = p.gx;
      if (p.gy < minGy) minGy = p.gy;
    }
    for (const p of placed) {
      pins.set(p.id, { x: p.gx - minGx, y: p.gy - minGy, z });
    }
  }
  return pins;
}

/**
 * Write pins onto the zone. Rooms without an entry keep whatever they had;
 * `mapZ: 0` is written as absent (the server default) to keep YAML diffs
 * quiet for single-floor zones.
 */
export function applyMapPins(
  world: WorldFile,
  pins: Map<string, MapPin>,
): WorldFile {
  const rooms: WorldFile["rooms"] = {};
  for (const [id, room] of Object.entries(world.rooms)) {
    const pin = pins.get(id);
    rooms[id] = pin
      ? { ...room, mapX: pin.x, mapY: pin.y, mapZ: pin.z === 0 ? undefined : pin.z }
      : room;
  }
  return { ...world, rooms };
}
