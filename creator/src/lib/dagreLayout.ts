import type { Node } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import type { WorldFile } from "@/types/world";
import { exitTarget } from "@/lib/zoneEdits";
import {
  COL_GUTTER,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  DIR_OFFSET,
  ROW_GUTTER,
  findFreeCell,
  zoneMapPins,
  type MapPin,
} from "@/lib/mapPins";

/** Empty grid rows inserted between separate floor islands. */
const ISLAND_GAP = 3;

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

// ─── Layout memoization ──────────────────────────────────────────────
//
// `compassLayout` runs on every `updateZone` via ZoneEditor's useMemo. For
// large zones the BFS + grid packing is the second-biggest cost after
// `zoneToGraph` itself. The layout only depends on room IDs + exits +
// startRoom — title/image/role flag edits leave it untouched. We cache the
// result on a layout-only fingerprint and short-circuit when nothing
// structural changed.
//
// The cache also stores the rawNodes ref it last saw. If `zoneToGraph` hit
// its own cache, rawNodes is identical and we return the previous result
// verbatim. If `zoneToGraph` missed but the layout fingerprint matches
// (e.g. only a mob image changed), we reuse cached positions on the new
// rawNodes refs.
//
// Skipped entirely when measurements are passed — that's the relayout path
// which intentionally recomputes against fresh DOM dimensions.

interface LayoutCacheEntry {
  fingerprint: string;
  rawNodesRef: Node[];
  result: Node[];
}

// Keyed by a stable per-zone cache key (the zone id). A single shared slot
// thrashes the moment the atlas lays out more than one zone in a loop, so each
// zone gets its own entry. Bounded by the number of distinct zones, cleared on
// project switch. Callers that don't pass a key share one default slot.
const DEFAULT_LAYOUT_CACHE_KEY = "__default__";
const layoutCache = new Map<string, LayoutCacheEntry>();

/** Free the layout cache. Call when switching projects so the cache doesn't
 *  pin memory for rooms that no longer exist. */
export function clearLayoutCache(): void {
  layoutCache.clear();
}

function buildLayoutFingerprint(world: WorldFile): string {
  const parts: string[] = [`s:${world.startRoom}`];
  for (const [id, room] of Object.entries(world.rooms)) {
    let exits = "";
    if (room.exits) {
      const exitParts: string[] = [];
      for (const [dir, val] of Object.entries(room.exits)) {
        const target = typeof val === "string" ? val : val.to;
        exitParts.push(`${dir}>${target}`);
      }
      exits = exitParts.join(";");
    }
    // Authored map pins shape the layout too, so they invalidate the cache.
    const pin =
      room.mapX != null && room.mapY != null
        ? `|p${room.mapX},${room.mapY},${room.mapZ ?? 0}`
        : "";
    parts.push(`r:${id}|${exits}${pin}`);
  }
  return parts.join("\n");
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
  cacheKey: string = DEFAULT_LAYOUT_CACHE_KEY,
): Node[] {
  if (nodes.length === 0) return nodes;

  // Cache hits only when not measuring (the measurement path is for the
  // user-triggered relayout and must always recompute).
  const cached = measurements ? undefined : layoutCache.get(cacheKey);
  if (cached) {
    if (cached.rawNodesRef === nodes) {
      return cached.result;
    }
    const fp = buildLayoutFingerprint(world);
    if (cached.fingerprint === fp) {
      // Layout structure unchanged, but rawNodes refs differ (zoneToGraph
      // had to rebuild for a non-layout-affecting reason). Apply cached
      // positions to the new rawNodes so downstream consumers still see
      // a stable visual layout.
      const posById = new Map<string, { x: number; y: number }>();
      for (const n of cached.result) {
        posById.set(n.id, n.position);
      }
      const result = nodes.map((n) => {
        const pos = posById.get(n.id);
        return pos ? { ...n, position: pos } : n;
      });
      layoutCache.set(cacheKey, { fingerprint: fp, rawNodesRef: nodes, result });
      return result;
    }
  }

  const allNodeIds = new Set(nodes.map((n) => n.id));
  const grid = new Map<string, string>();
  const pos = new Map<string, [number, number]>();
  /** Rooms whose exits have already been walked — placed-but-unexpanded rooms
   *  (author pins) still spread their neighbours when BFS reaches them. */
  const expanded = new Set<string>();
  let collisions = 0;

  function place(id: string, gx: number, gy: number) {
    const key = `${gx},${gy}`;
    if (grid.has(key)) {
      collisions++;
      [gx, gy] = findFreeCell(gx, gy, grid);
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
    if (expanded.has(startId)) return { placed, nextFloorSeeds: nextSeeds };

    // A pre-seated seed (author pin) keeps its cell and just expands in place.
    if (!pos.has(startId)) {
      place(startId, ox, oy);
      placed.push(startId);
    }

    const queue = [startId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (!expanded.add(cur)) continue;
      const [cx, cy] = pos.get(cur)!;

      const room = world.rooms[cur];
      if (!room?.exits) continue;

      for (const dir of sortedExits(room.exits)) {
        const exitVal = room.exits[dir]!;
        const raw = exitTarget(exitVal);
        const nodeId = raw.includes(":") ? `xzone:${raw}` : raw;

        if (!allNodeIds.has(nodeId)) continue;
        const isRoom = !raw.includes(":") && Boolean(world.rooms[raw]);

        const offset = DIR_OFFSET[dir];
        if (!offset) {
          // u/d: don't pull the target into this floor — it lives on its own
          // island. Note the link so the caller can seed the next floor. A
          // pinned partner is already seated; walk through it so its own
          // unpinned neighbours seat around the authored cell.
          if (!isRoom) continue;
          if (pos.has(nodeId)) {
            if (!expanded.has(nodeId)) queue.push(nodeId);
          } else {
            nextSeeds.push(nodeId);
          }
          continue;
        }

        if (pos.has(nodeId)) {
          // Placed earlier (pin or previous pass) — keep its cell but keep
          // flowing outward through it.
          if (isRoom && !expanded.has(nodeId)) queue.push(nodeId);
          continue;
        }

        place(nodeId, cx + offset[0], cy + offset[1]);
        placed.push(nodeId);

        if (isRoom) {
          queue.push(nodeId);
        }
      }
    }

    return { placed, nextFloorSeeds: nextSeeds };
  }

  let maxY = 0;

  // Phase 0: seat author pins (mapX/mapY/mapZ) exactly where they were placed,
  // one island per pinned floor in ascending z order. This mirrors the server
  // loader: pins are fixed anchors, BFS lays out only the unpinned remainder
  // around them (flowing outward through pinned rooms via `expanded`).
  const pins = zoneMapPins(world);
  const pinnedIds: string[] = [];
  if (pins.size > 0) {
    const byFloor = new Map<number, Array<[string, MapPin]>>();
    for (const [id, pin] of pins) {
      if (!allNodeIds.has(id)) continue;
      const list = byFloor.get(pin.z) ?? [];
      list.push([id, pin]);
      byFloor.set(pin.z, list);
    }
    const zs = [...byFloor.keys()].sort((a, b) => a - b);
    for (const z of zs) {
      const entries = byFloor.get(z)!;
      let minX = Infinity;
      let minY = Infinity;
      for (const [, p] of entries) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
      }
      const islandY = pos.size === 0 ? 0 : maxY + ISLAND_GAP;
      entries.sort(
        (a, b) => a[1].y - b[1].y || a[1].x - b[1].x || a[0].localeCompare(b[0]),
      );
      for (const [id, p] of entries) {
        place(id, p.x - minX, islandY + (p.y - minY));
        pinnedIds.push(id);
      }
      for (const [, [, y]] of pos) {
        if (y > maxY) maxY = y;
      }
    }
    // Pin collisions are authoring errors (validateZone flags them); the
    // spiral in place() keeps the editor usable, but they mustn't count
    // toward the grid-embeddability heuristic below.
    collisions = 0;
  }

  // Place the start floor, then walk u/d links breadth-first to find sibling
  // floors and stack each one below the previous. Floors connected via stairs
  // end up in vertical reading order (start → upstairs → attic, etc.); fully
  // disconnected pockets fall through to the orphan sweep below. Pinned rooms
  // queue too so their unpinned neighbours seat around the authored cells.
  const floorQueue: string[] = [world.startRoom, ...pinnedIds];

  function placeAndAdvance(seedId: string) {
    const islandY = pos.size === 0 ? 0 : maxY + ISLAND_GAP;
    const result = placeFloor(seedId, 0, islandY);
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
    if (expanded.has(seed)) continue;
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
  // Never when the author pinned a layout — pins ARE the layout.
  let result: Node[];
  if (
    pins.size === 0 &&
    mainPlaced >= 8 &&
    mainCollisions / Math.max(1, mainPlaced) > COLLISION_FALLBACK_RATIO
  ) {
    result = dagreLayout(nodes, world, measurements);
  } else {
    result = gridToPixels(nodes, pos, measurements);
  }

  if (!measurements) {
    layoutCache.set(cacheKey, {
      fingerprint: buildLayoutFingerprint(world),
      rawNodesRef: nodes,
      result,
    });
  }
  return result;
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
  cacheKey?: string,
): Node[] {
  return compassLayout(nodes, world, measurements, cacheKey);
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


