import type { Node } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import type { WorldFile } from "@/types/world";
import { exitTarget } from "@/lib/zoneEdits";

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 140;

const COL_GUTTER = 80;
const ROW_GUTTER = 60;

/** Empty grid rows inserted between separate floor islands. */
const ISLAND_GAP = 3;

/**
 * Compass direction → grid offset (x, y). Y-axis is inverted: negative = up.
 *
 * u/d are omitted on purpose: they're vertical transitions (stairs, portals),
 * not 2D directions. BFS traverses through them for reachability but does not
 * let them dictate grid coordinates — otherwise a cave with n/u/s/w chains
 * explodes into a diagonal sprawl.
 */
const DIR_OFFSET: Record<string, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
};

/** Process cardinals first so they pin the grid before diagonals fill gaps. */
const DIR_PRIORITY: Record<string, number> = {
  n: 0, s: 0, e: 0, w: 0,
  ne: 1, nw: 1, se: 1, sw: 1,
  u: 2, d: 2,
};

/**
 * Threshold at which we abandon compass-BFS placement and fall back to a
 * hierarchical dagre layout. Collisions correlate with geometric contradictions
 * in the exit graph (e.g. A→n→B→e→C→s→A is an impossible rectangle), which
 * the spiral-search resolves by scattering rooms — the chaotic look we're
 * trying to avoid.
 */
const COLLISION_FALLBACK_RATIO = 0.25;

export interface LayoutMeasurement {
  width: number;
  height: number;
}

/**
 * Layout rooms on a grid using compass directions from exits.
 *
 * Each "floor" — a maximal subgraph reachable through n/s/e/w/diagonals only —
 * is laid out independently as its own island. u/d exits are NOT used for
 * placement; instead, when BFS hits a u/d link, we record the target as the
 * seed of the next floor island and stack it below the current one. This is
 * intentional: stairs/portals don't have a sensible 2D position, and trying
 * to satellite them onto the same grid was tangling unrelated floors.
 *
 * The u/d edges still render between islands (zoneToGraph styles them as
 * dashed vertical connections), so the visual story is "this floor connects
 * to that floor via stairs" with each floor readable on its own.
 *
 * If the start floor has too many geometric contradictions (rooms competing
 * for the same grid cell), the whole layout is discarded and re-run via
 * `@dagrejs/dagre`.
 *
 * @param nodes          The raw nodes from `zoneToGraph`.
 * @param world          The zone WorldFile (for `rooms`, `startRoom`, exits).
 * @param measurements   Optional map of nodeId → measured size. Missing or
 *                       zero-sized entries fall back to sensible defaults.
 */
export function compassLayout(
  nodes: Node[],
  world: WorldFile,
  measurements?: Map<string, LayoutMeasurement>,
): Node[] {
  if (nodes.length === 0) return nodes;

  const allNodeIds = new Set(nodes.map((n) => n.id));
  const grid = new Map<string, string>();
  const pos = new Map<string, [number, number]>();
  let collisions = 0;

  function place(id: string, gx: number, gy: number) {
    const key = `${gx},${gy}`;
    if (grid.has(key)) {
      collisions++;
      [gx, gy] = findEmpty(gx, gy, grid);
    }
    pos.set(id, [gx, gy]);
    grid.set(`${gx},${gy}`, id);
  }

  function sortedExits(exits: Record<string, unknown>): string[] {
    return Object.keys(exits).sort(
      (a, b) => (DIR_PRIORITY[a] ?? 99) - (DIR_PRIORITY[b] ?? 99),
    );
  }

  /**
   * BFS-place a single floor (compass-connected component) starting from
   * `startId` at grid origin (ox, oy). Returns the rooms placed in this call
   * plus the u/d-linked target rooms that belong to *other* floors — the
   * caller uses these to seed the next island below.
   */
  function placeFloor(startId: string, ox: number, oy: number): {
    placed: string[];
    nextFloorSeeds: string[];
  } {
    const placed: string[] = [];
    const nextSeeds: string[] = [];
    if (pos.has(startId)) return { placed, nextFloorSeeds: nextSeeds };

    place(startId, ox, oy);
    placed.push(startId);

    const queue = [startId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const [cx, cy] = pos.get(cur)!;

      const room = world.rooms[cur];
      if (!room?.exits) continue;

      for (const dir of sortedExits(room.exits)) {
        const exitVal = room.exits[dir]!;
        const raw = exitTarget(exitVal);
        const nodeId = raw.includes(":") ? `xzone:${raw}` : raw;

        if (!allNodeIds.has(nodeId)) continue;
        if (pos.has(nodeId)) continue;

        const offset = DIR_OFFSET[dir];
        if (!offset) {
          // u/d: don't pull the target into this floor — it lives on its own
          // island. Note the link so the caller can seed the next floor.
          if (!raw.includes(":") && world.rooms[raw]) {
            nextSeeds.push(nodeId);
          }
          continue;
        }

        place(nodeId, cx + offset[0], cy + offset[1]);
        placed.push(nodeId);

        if (!raw.includes(":") && world.rooms[raw]) {
          queue.push(nodeId);
        }
      }
    }

    return { placed, nextFloorSeeds: nextSeeds };
  }

  // Place the start floor, then walk u/d links breadth-first to find sibling
  // floors and stack each one below the previous. Floors connected via stairs
  // end up in vertical reading order (start → upstairs → attic, etc.); fully
  // disconnected pockets fall through to the orphan sweep below.
  let maxY = 0;
  const floorQueue: string[] = [world.startRoom];

  function placeAndAdvance(seedId: string) {
    const islandY = pos.size === 0 ? 0 : maxY + ISLAND_GAP;
    const result = placeFloor(seedId, 0, islandY);
    if (result.placed.length === 0) return;
    for (const [, [, y]] of pos) {
      if (y > maxY) maxY = y;
    }
    for (const next of result.nextFloorSeeds) {
      if (!pos.has(next)) floorQueue.push(next);
    }
  }

  // Main-BFS collisions are computed against the *first* floor only — the
  // start floor is the canonical "is this graph grid-embeddable" sample.
  let mainCollisions = 0;
  let mainPlaced = 0;
  while (floorQueue.length > 0) {
    const seed = floorQueue.shift()!;
    if (pos.has(seed)) continue;
    const beforeCol = collisions;
    const beforeSize = pos.size;
    placeAndAdvance(seed);
    if (mainPlaced === 0) {
      mainCollisions = collisions - beforeCol;
      mainPlaced = pos.size - beforeSize;
    }
  }

  // Final sweep: any rooms unreachable from start (or any floor reachable
  // from it via u/d) become standalone islands below.
  for (const roomId of Object.keys(world.rooms)) {
    if (pos.has(roomId)) continue;
    placeAndAdvance(roomId);
  }

  if (pos.size === 0) return nodes;

  // Heuristic: if many placements collided in the main BFS, the graph isn't
  // grid-embeddable. Throw it away and run a proper hierarchical layout.
  if (
    mainPlaced >= 8 &&
    mainCollisions / Math.max(1, mainPlaced) > COLLISION_FALLBACK_RATIO
  ) {
    return dagreLayout(nodes, world, measurements);
  }

  return gridToPixels(nodes, pos, measurements);
}

/**
 * Convert integer grid coordinates to pixel positions using per-column/row
 * max extents. Rooms are centered within their (possibly larger) cell so
 * non-uniform sizes don't overlap.
 */
function gridToPixels(
  nodes: Node[],
  pos: Map<string, [number, number]>,
  measurements?: Map<string, LayoutMeasurement>,
): Node[] {
  const getDim = (id: string): LayoutMeasurement => {
    const m = measurements?.get(id);
    if (m && m.width > 0 && m.height > 0) return m;
    return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  };

  let minGx = Infinity;
  let maxGx = -Infinity;
  let minGy = Infinity;
  let maxGy = -Infinity;
  for (const [, [gx, gy]] of pos) {
    if (gx < minGx) minGx = gx;
    if (gx > maxGx) maxGx = gx;
    if (gy < minGy) minGy = gy;
    if (gy > maxGy) maxGy = gy;
  }

  const colCount = maxGx - minGx + 1;
  const rowCount = maxGy - minGy + 1;
  const colWidth: number[] = new Array(colCount).fill(DEFAULT_NODE_WIDTH);
  const rowHeight: number[] = new Array(rowCount).fill(DEFAULT_NODE_HEIGHT);

  for (const [id, [gx, gy]] of pos) {
    const dim = getDim(id);
    const ci = gx - minGx;
    const ri = gy - minGy;
    if (dim.width > colWidth[ci]!) colWidth[ci] = dim.width;
    if (dim.height > rowHeight[ri]!) rowHeight[ri] = dim.height;
  }

  const colStart: number[] = new Array(colCount);
  const rowStart: number[] = new Array(rowCount);
  let acc = 0;
  for (let i = 0; i < colCount; i++) {
    colStart[i] = acc;
    acc += colWidth[i]! + COL_GUTTER;
  }
  acc = 0;
  for (let i = 0; i < rowCount; i++) {
    rowStart[i] = acc;
    acc += rowHeight[i]! + ROW_GUTTER;
  }

  return nodes.map((node) => {
    const p = pos.get(node.id);
    if (!p) return node;
    const ci = p[0] - minGx;
    const ri = p[1] - minGy;
    const dim = getDim(node.id);
    const x = colStart[ci]! + (colWidth[ci]! - dim.width) / 2;
    const y = rowStart[ri]! + (rowHeight[ri]! - dim.height) / 2;
    return { ...node, position: { x, y } };
  });
}

/**
 * Fallback: dagre hierarchical layout. Used when compass BFS produces enough
 * collisions that it's clearly not a grid-embeddable graph. Produces a clean
 * top-down tree with reasonable gutters even for pathological inputs.
 */
export function dagreLayout(
  nodes: Node[],
  world: WorldFile,
  measurements?: Map<string, LayoutMeasurement>,
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: COL_GUTTER,
    ranksep: ROW_GUTTER + 40,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const getDim = (id: string): LayoutMeasurement => {
    const m = measurements?.get(id);
    if (m && m.width > 0 && m.height > 0) return m;
    return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  };

  for (const node of nodes) {
    const dim = getDim(node.id);
    g.setNode(node.id, { width: dim.width, height: dim.height });
  }

  const added = new Set<string>();
  for (const [roomId, room] of Object.entries(world.rooms)) {
    if (!room.exits) continue;
    for (const exitVal of Object.values(room.exits)) {
      const raw = exitTarget(exitVal);
      const nodeId = raw.includes(":") ? `xzone:${raw}` : raw;
      if (!g.hasNode(nodeId)) continue;
      const key = `${roomId}|${nodeId}`;
      const rev = `${nodeId}|${roomId}`;
      if (added.has(key) || added.has(rev)) continue;
      added.add(key);
      g.setEdge(roomId, nodeId);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const info = g.node(node.id);
    if (!info) return node;
    const dim = getDim(node.id);
    return {
      ...node,
      position: { x: info.x - dim.width / 2, y: info.y - dim.height / 2 },
    };
  });
}

/**
 * Layout dispatcher. Compass BFS first; if the graph doesn't fit a grid,
 * falls through to dagre internally. Callers should always use this.
 */
export function layoutZone(
  nodes: Node[],
  world: WorldFile,
  measurements?: Map<string, LayoutMeasurement>,
): Node[] {
  return compassLayout(nodes, world, measurements);
}

/**
 * Compute the bounding rectangle for a set of positioned nodes.
 */
export function getLayoutBounds(
  nodes: Node[],
  measurements?: Map<string, LayoutMeasurement>,
): { x: number; y: number; width: number; height: number } | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const m = measurements?.get(node.id);
    const width =
      (m && m.width > 0 ? m.width : undefined) ??
      node.measured?.width ??
      node.width ??
      DEFAULT_NODE_WIDTH;
    const height =
      (m && m.height > 0 ? m.height : undefined) ??
      node.measured?.height ??
      node.height ??
      DEFAULT_NODE_HEIGHT;

    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + width > maxX) maxX = x + width;
    if (y + height > maxY) maxY = y + height;
  }

  if (!isFinite(minX) || !isFinite(minY)) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Spiral outward from (x, y) to find the nearest unoccupied grid cell. */
function findEmpty(
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

