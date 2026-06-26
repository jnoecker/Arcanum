import type { WorldFile } from "@/types/world";
import { exitTarget } from "@/lib/zoneEdits";

/**
 * Footprint of a zone derived from a compass-BFS of its room exits — the same
 * grid the zone-map compass layout uses, reduced to integer cells. This drives
 * the silhouette drawn on the world-overlay atlas.
 *
 * The full pixel layout in `dagreLayout.ts` is overkill here: the overlay only
 * needs the *shape* (which grid cells are occupied) and each room's position
 * within it (to anchor cross-zone connectors to the correct edge). When a zone
 * isn't grid-embeddable (its exits describe an impossible geometry), `chaotic`
 * is set and callers should fall back to a plain rectangle.
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

const DIR_PRIORITY: Record<string, number> = {
  n: 0, s: 0, e: 0, w: 0,
  ne: 1, nw: 1, se: 1, sw: 1,
  u: 2, d: 2,
};

/** Rows of empty space stacked between separate floors (u/d-linked islands). */
const ISLAND_GAP = 2;

/** Match dagreLayout's grid-embeddability heuristic. */
const COLLISION_FALLBACK_RATIO = 0.25;

export interface FootprintCell {
  roomId: string;
  gx: number;
  gy: number;
}

export interface ZoneFootprint {
  /** True when the exit graph isn't grid-embeddable — render a rectangle. */
  chaotic: boolean;
  cells: FootprintCell[];
  cellOf: Map<string, { gx: number; gy: number }>;
  cols: number;
  rows: number;
  minGx: number;
  minGy: number;
}

function isLocalRoom(world: WorldFile, raw: string): boolean {
  return !raw.includes(":") && !!world.rooms[raw];
}

function findEmpty(x: number, y: number, grid: Set<string>): [number, number] {
  for (let r = 1; r <= 20; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) < r && Math.abs(dy) < r) continue;
        if (!grid.has(`${x + dx},${y + dy}`)) return [x + dx, y + dy];
      }
    }
  }
  return [x + 1, y];
}

export function computeZoneFootprint(world: WorldFile): ZoneFootprint {
  const rooms = world.rooms ?? {};
  const roomIds = Object.keys(rooms);
  const cellOf = new Map<string, { gx: number; gy: number }>();
  const grid = new Set<string>();
  let collisions = 0;

  function place(id: string, gx: number, gy: number) {
    if (grid.has(`${gx},${gy}`)) {
      collisions++;
      [gx, gy] = findEmpty(gx, gy, grid);
    }
    cellOf.set(id, { gx, gy });
    grid.add(`${gx},${gy}`);
  }

  function sortedExits(exits: Record<string, unknown>): string[] {
    return Object.keys(exits).sort(
      (a, b) => (DIR_PRIORITY[a] ?? 99) - (DIR_PRIORITY[b] ?? 99),
    );
  }

  /** BFS one compass-connected floor; collect u/d targets as next-floor seeds. */
  function placeFloor(startId: string, oy: number): { placed: number; seeds: string[] } {
    const seeds: string[] = [];
    if (cellOf.has(startId)) return { placed: 0, seeds };

    place(startId, 0, oy);
    let placed = 1;
    const queue = [startId];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const cell = cellOf.get(cur)!;
      const room = rooms[cur];
      if (!room?.exits) continue;

      for (const dir of sortedExits(room.exits)) {
        const raw = exitTarget(room.exits[dir]!);
        if (!isLocalRoom(world, raw)) continue;
        if (cellOf.has(raw)) continue;

        const offset = DIR_OFFSET[dir];
        if (!offset) {
          seeds.push(raw); // u/d → its own floor
          continue;
        }
        place(raw, cell.gx + offset[0], cell.gy + offset[1]);
        placed++;
        queue.push(raw);
      }
    }
    return { placed, seeds };
  }

  let maxY = 0;
  let mainPlaced = 0;
  let mainCollisions = 0;
  const floorQueue: string[] = [];
  if (world.startRoom && rooms[world.startRoom]) floorQueue.push(world.startRoom);

  function advance(seed: string) {
    if (cellOf.has(seed)) return;
    const oy = cellOf.size === 0 ? 0 : maxY + ISLAND_GAP;
    const before = collisions;
    const { placed } = placeFloor(seed, oy);
    if (placed === 0) return;
    for (const { gy } of cellOf.values()) if (gy > maxY) maxY = gy;
    if (mainPlaced === 0) {
      mainPlaced = placed;
      mainCollisions = collisions - before;
    }
    // u/d seeds discovered during this floor are queued by placeFloor's caller.
  }

  // Walk start floor + its u/d-linked floors, stacking each below the last.
  const seen = new Set<string>();
  while (floorQueue.length > 0) {
    const seed = floorQueue.shift()!;
    if (cellOf.has(seed) || seen.has(seed)) continue;
    seen.add(seed);
    const oy = cellOf.size === 0 ? 0 : maxY + ISLAND_GAP;
    const before = collisions;
    const { placed, seeds } = placeFloor(seed, oy);
    if (placed > 0) {
      for (const { gy } of cellOf.values()) if (gy > maxY) maxY = gy;
      if (mainPlaced === 0) {
        mainPlaced = placed;
        mainCollisions = collisions - before;
      }
    }
    for (const s of seeds) if (!cellOf.has(s)) floorQueue.push(s);
  }

  // Disconnected pockets become their own stacked islands.
  for (const id of roomIds) {
    if (!cellOf.has(id)) advance(id);
  }

  const cells: FootprintCell[] = [];
  let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
  for (const [roomId, { gx, gy }] of cellOf) {
    cells.push({ roomId, gx, gy });
    if (gx < minGx) minGx = gx;
    if (gy < minGy) minGy = gy;
    if (gx > maxGx) maxGx = gx;
    if (gy > maxGy) maxGy = gy;
  }

  if (cells.length === 0) {
    return { chaotic: false, cells, cellOf, cols: 1, rows: 1, minGx: 0, minGy: 0 };
  }

  const chaotic =
    mainPlaced >= 8 && mainCollisions / Math.max(1, mainPlaced) > COLLISION_FALLBACK_RATIO;

  return {
    chaotic,
    cells,
    cellOf,
    cols: maxGx - minGx + 1,
    rows: maxGy - minGy + 1,
    minGx,
    minGy,
  };
}

/**
 * Normalized [0..1] position of a room's cell center within the footprint
 * bounding box. `nx` runs left→right, `ny` runs top→bottom (north is up).
 * Returns null when the room isn't in the grid.
 */
export function roomNormalizedPos(
  fp: ZoneFootprint,
  roomId: string,
): { nx: number; ny: number } | null {
  const cell = fp.cellOf.get(roomId);
  if (!cell) return null;
  return {
    nx: (cell.gx - fp.minGx + 0.5) / fp.cols,
    ny: (cell.gy - fp.minGy + 0.5) / fp.rows,
  };
}

export interface ZoneConnectionPoint {
  roomId: string;
  dir: string;
  toZone: string;
  toRoom: string;
}

/** Every cross-zone exit leaving this zone's rooms (one per direction). */
export function zoneConnectionPoints(world: WorldFile): ZoneConnectionPoint[] {
  const out: ZoneConnectionPoint[] = [];
  for (const [roomId, room] of Object.entries(world.rooms ?? {})) {
    if (!room.exits) continue;
    for (const [dir, val] of Object.entries(room.exits)) {
      const raw = exitTarget(val);
      const colon = raw.indexOf(":");
      if (colon < 0) continue;
      out.push({
        roomId,
        dir,
        toZone: raw.slice(0, colon),
        toRoom: raw.slice(colon + 1),
      });
    }
  }
  return out;
}
