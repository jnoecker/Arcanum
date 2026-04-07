import type { Node } from "@xyflow/react";
import type { WorldFile } from "@/types/world";
import { exitTarget } from "@/lib/zoneEdits";

/** Default room dimensions when no measurement is available (matches RoomNode). */
const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 140;

/** Gutter added between columns and rows in pixels. */
const COL_GUTTER = 80;
const ROW_GUTTER = 60;

/** Grid columns of empty space between disconnected components. */
const COMPONENT_GRID_GAP = 2;

/** Safety cap on cascade-push recursion depth. */
const MAX_PUSH_DEPTH = 24;

/** Compass direction → grid offset (x, y). Y-axis is inverted: negative = up. */
const DIR_OFFSET: Record<string, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
  u: [1, -1],
  d: [1, 1],
};

export interface LayoutMeasurement {
  width: number;
  height: number;
}

/**
 * Layout rooms on a grid using compass directions from exits.
 *
 * The algorithm has three phases:
 *
 * 1. **Component discovery.** Rooms are partitioned into connected
 *    components (undirected). The component containing the start room
 *    is laid out first.
 *
 * 2. **Per-component compass BFS.** Each component runs a BFS from its
 *    seed room. Neighbors are placed at the grid offset implied by the
 *    exit direction. On collision, the existing occupant's entire
 *    subtree is pushed further along the incoming direction (so their
 *    relative compass relationships are preserved). If the push cascade
 *    bottoms out, we fall back to a spiral search for the nearest empty
 *    cell.
 *
 * 3. **Horizontal packing + pixel conversion.** Components are packed
 *    side-by-side in grid space with a fixed gap, then the merged grid
 *    is converted to pixel coordinates using per-column max widths and
 *    per-row max heights (prefix-summed). Nodes are centered inside
 *    their cells.
 *
 * @param nodes          The raw nodes from `zoneToGraph`.
 * @param world          The zone WorldFile.
 * @param measurements   Optional map of nodeId → measured size. Missing
 *                       or zero-sized entries fall back to defaults.
 */
export function compassLayout(
  nodes: Node[],
  world: WorldFile,
  measurements?: Map<string, LayoutMeasurement>,
): Node[] {
  const allNodeIds = new Set(nodes.map((n) => n.id));

  // ─── Phase 1: find connected components ──────────────────────────
  const components = findConnectedComponents(world);

  // Layout the component containing the start room first so it anchors
  // the left edge of the map.
  components.sort((a, b) => {
    const aHasStart = a.includes(world.startRoom) ? 1 : 0;
    const bHasStart = b.includes(world.startRoom) ? 1 : 0;
    return bHasStart - aHasStart;
  });

  // ─── Phase 2: per-component BFS, then pack horizontally ──────────
  const pos = new Map<string, [number, number]>();
  const grid = new Map<string, string>();
  let columnCursor = 0;

  for (const component of components) {
    if (component.length === 0) continue;

    const localPos = new Map<string, [number, number]>();
    const localGrid = new Map<string, string>();
    const localChildren = new Map<string, string[]>();

    const seed = component.includes(world.startRoom)
      ? world.startRoom
      : component[0]!;

    bfsComponent({
      seed,
      world,
      allNodeIds,
      localPos,
      localGrid,
      localChildren,
    });

    if (localPos.size === 0) continue;

    // Compute local bbox for this component.
    let minGx = Infinity;
    let maxGx = -Infinity;
    for (const [, [gx]] of localPos) {
      if (gx < minGx) minGx = gx;
      if (gx > maxGx) maxGx = gx;
    }

    // Shift component into the global grid, starting at the current cursor.
    const shift = columnCursor - minGx;
    for (const [id, [gx, gy]] of localPos) {
      const newGx = gx + shift;
      pos.set(id, [newGx, gy]);
      grid.set(`${newGx},${gy}`, id);
    }

    columnCursor += maxGx - minGx + 1 + COMPONENT_GRID_GAP;
  }

  if (pos.size === 0) return nodes;

  // ─── Phase 3: grid → pixel (max-extent prefix-sum) ───────────────
  return applyGridToPixel(nodes, pos, measurements);
}

// ─────────────────────────────────────────────────────────────────
// Connected components
// ─────────────────────────────────────────────────────────────────

/**
 * Partition same-zone rooms into connected components, treating exits
 * as undirected edges. Cross-zone exits are ignored.
 */
function findConnectedComponents(world: WorldFile): string[][] {
  const adj = new Map<string, Set<string>>();
  const roomIds = Object.keys(world.rooms);
  for (const id of roomIds) adj.set(id, new Set());

  for (const [id, room] of Object.entries(world.rooms)) {
    if (!room.exits) continue;
    for (const exitVal of Object.values(room.exits)) {
      const raw = exitTarget(exitVal);
      if (raw.includes(":")) continue;
      if (!world.rooms[raw]) continue;
      adj.get(id)!.add(raw);
      adj.get(raw)!.add(id);
    }
  }

  const seen = new Set<string>();
  const components: string[][] = [];

  for (const id of roomIds) {
    if (seen.has(id)) continue;
    const comp: string[] = [];
    const queue = [id];
    seen.add(id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const next of adj.get(cur) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    components.push(comp);
  }

  return components;
}

// ─────────────────────────────────────────────────────────────────
// Compass BFS with push collision resolution
// ─────────────────────────────────────────────────────────────────

interface BfsContext {
  seed: string;
  world: WorldFile;
  allNodeIds: Set<string>;
  localPos: Map<string, [number, number]>;
  localGrid: Map<string, string>;
  localChildren: Map<string, string[]>;
}

function bfsComponent(ctx: BfsContext): void {
  const { seed, world, allNodeIds, localPos, localGrid, localChildren } = ctx;

  function place(id: string, gx: number, gy: number, fromDir?: string) {
    const key = `${gx},${gy}`;
    if (localGrid.has(key)) {
      const occupant = localGrid.get(key)!;
      let pushed = false;
      if (fromDir) {
        pushed = cascadePush(
          occupant,
          fromDir,
          localGrid,
          localPos,
          localChildren,
        );
      }
      if (!pushed) {
        [gx, gy] = findEmpty(gx, gy, localGrid);
      }
    }
    localPos.set(id, [gx, gy]);
    localGrid.set(`${gx},${gy}`, id);
  }

  place(seed, 0, 0);
  const queue = [seed];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curPos = localPos.get(cur)!;
    const cx = curPos[0];
    const cy = curPos[1];

    const room = world.rooms[cur];
    if (!room?.exits) continue;

    for (const [dir, exitVal] of Object.entries(room.exits)) {
      const raw = exitTarget(exitVal);
      const nodeId = raw.includes(":") ? `xzone:${raw}` : raw;

      if (!allNodeIds.has(nodeId)) continue;
      if (localPos.has(nodeId)) continue;

      const offset = DIR_OFFSET[dir];
      if (!offset) continue;

      place(nodeId, cx + offset[0], cy + offset[1], dir);

      // Record child relationship for future cascade pushes.
      let kids = localChildren.get(cur);
      if (!kids) {
        kids = [];
        localChildren.set(cur, kids);
      }
      kids.push(nodeId);

      // Continue BFS only into same-zone rooms.
      if (!raw.includes(":") && world.rooms[raw]) {
        queue.push(nodeId);
      }
    }
  }
}

/**
 * Push the given node and its entire subtree one step in `dir`. If the
 * target cell is occupied by something outside the subtree, recursively
 * push that other subtree first. Preserves compass relationships inside
 * the pushed subtree. Returns false if the cascade exceeds the depth
 * limit, letting the caller fall back to a spiral search.
 */
function cascadePush(
  startId: string,
  dir: string,
  grid: Map<string, string>,
  pos: Map<string, [number, number]>,
  children: Map<string, string[]>,
  depth = 0,
): boolean {
  if (depth > MAX_PUSH_DEPTH) return false;
  const offset = DIR_OFFSET[dir];
  if (!offset) return false;

  const subtree = subtreeOf(startId, children);
  const subtreeSet = new Set(subtree);

  // Resolve any external collisions along the push direction first.
  for (const id of subtree) {
    const p = pos.get(id);
    if (!p) continue;
    const nx = p[0] + offset[0];
    const ny = p[1] + offset[1];
    const other = grid.get(`${nx},${ny}`);
    if (other && !subtreeSet.has(other)) {
      if (!cascadePush(other, dir, grid, pos, children, depth + 1)) {
        return false;
      }
    }
  }

  // Clear old cells, then set new ones (avoids trampling mid-shift).
  for (const id of subtree) {
    const p = pos.get(id);
    if (!p) continue;
    grid.delete(`${p[0]},${p[1]}`);
  }
  for (const id of subtree) {
    const p = pos.get(id);
    if (!p) continue;
    const nx = p[0] + offset[0];
    const ny = p[1] + offset[1];
    pos.set(id, [nx, ny]);
    grid.set(`${nx},${ny}`, id);
  }

  return true;
}

function subtreeOf(
  rootId: string,
  children: Map<string, string[]>,
): string[] {
  const result: string[] = [rootId];
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const child of children.get(cur) ?? []) {
      result.push(child);
      queue.push(child);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// Grid → pixel conversion
// ─────────────────────────────────────────────────────────────────

function applyGridToPixel(
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

  // Prefix-sum start positions (top-left of each cell).
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
