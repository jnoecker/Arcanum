import type { Node } from "@xyflow/react";
import type { WorldFile } from "@/types/world";
import { exitTarget } from "@/lib/zoneEdits";

/** Default room dimensions when no measurement is available (matches RoomNode). */
const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 140;

/** Gutter added between columns and rows in pixels. */
const COL_GUTTER = 80;
const ROW_GUTTER = 60;

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
 * BFS from startRoom, placing each neighbor at the grid offset implied by
 * the exit direction. Collisions are resolved by spiraling to the nearest
 * empty cell.
 *
 * Unlike a fixed-cell grid, the conversion from grid coordinates to pixel
 * coordinates uses the **max width of each column** and **max height of
 * each row**, prefix-summed. This means rooms with different sizes get
 * appropriate spacing without overlap, and uniformly-sized rooms pack
 * tightly. Nodes are centered within their row/column cell.
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
  const allNodeIds = new Set(nodes.map((n) => n.id));
  const grid = new Map<string, string>(); // "gx,gy" → nodeId
  const pos = new Map<string, [number, number]>(); // nodeId → [gx, gy]

  function place(id: string, gx: number, gy: number) {
    const key = `${gx},${gy}`;
    if (grid.has(key)) {
      [gx, gy] = findEmpty(gx, gy, grid);
    }
    pos.set(id, [gx, gy]);
    grid.set(`${gx},${gy}`, id);
  }

  function bfsFrom(startId: string, ox: number, oy: number) {
    if (pos.has(startId)) return;
    place(startId, ox, oy);

    const queue = [startId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const [cx, cy] = pos.get(cur)!;

      const room = world.rooms[cur];
      if (!room?.exits) continue;

      for (const [dir, exitVal] of Object.entries(room.exits)) {
        const raw = exitTarget(exitVal);
        const nodeId = raw.includes(":") ? `xzone:${raw}` : raw;

        if (!allNodeIds.has(nodeId)) continue;
        if (pos.has(nodeId)) continue;

        const offset = DIR_OFFSET[dir];
        if (!offset) continue;

        place(nodeId, cx + offset[0], cy + offset[1]);

        // Continue BFS only into same-zone rooms
        if (!raw.includes(":") && world.rooms[raw]) {
          queue.push(nodeId);
        }
      }
    }
  }

  // Place main component from startRoom
  bfsFrom(world.startRoom, 0, 0);

  // Place any disconnected rooms below the main graph
  let maxY = 0;
  for (const [, [, y]] of pos) {
    maxY = Math.max(maxY, y);
  }

  for (const roomId of Object.keys(world.rooms)) {
    if (!pos.has(roomId)) {
      bfsFrom(roomId, 0, maxY + 3);
      for (const [, [, y]] of pos) {
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (pos.size === 0) return nodes;

  // ─── Grid → pixel conversion (max-extent per row/column) ──────────
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
    // Center node within its (possibly larger) cell.
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
