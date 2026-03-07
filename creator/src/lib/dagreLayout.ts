import type { Node } from "@xyflow/react";
import type { WorldFile, ExitValue } from "@/types/world";

const CELL_W = 300;
const CELL_H = 140;

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

/**
 * Layout rooms on a grid using compass directions from exits.
 * BFS from startRoom, placing each neighbor at the grid offset
 * implied by the exit direction. Collisions are resolved by
 * shifting to the nearest empty cell.
 */
export function compassLayout(nodes: Node[], world: WorldFile): Node[] {
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

  // Convert grid coordinates to pixel positions
  return nodes.map((node) => {
    const p = pos.get(node.id);
    if (!p) return node;
    return {
      ...node,
      position: { x: p[0] * CELL_W, y: p[1] * CELL_H },
    };
  });
}

function exitTarget(exit: string | ExitValue): string {
  return typeof exit === "string" ? exit : exit.to;
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
