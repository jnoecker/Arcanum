import type { FixedLayout, FixedLayoutRoom } from "./generateZoneContent";

/**
 * Deterministically place `count` rooms on a 2D grid and derive exits from
 * cardinal adjacency. The result is a fully-wired `FixedLayout` that the
 * sketch-flavor LLM path can flesh out — no geometric contradictions possible,
 * which is how we avoid the messy spiral-resolved layouts that the graph-first
 * LLM generator used to produce.
 *
 * Placement is a weighted random-walk BFS: later rooms prefer recent parents
 * (creating natural spines) but occasionally branch from older rooms (creating
 * side-passages and dead-ends). After the spanning tree is built, a fraction
 * of unused grid adjacencies are promoted to loop exits so the map isn't a
 * pure tree.
 */

const DIR_PAIRS: Array<[string, string, number, number]> = [
  ["n", "s", 0, -1],
  ["s", "n", 0, 1],
  ["e", "w", 1, 0],
  ["w", "e", -1, 0],
];

/** Small fast PRNG — mulberry32. Seed 0 is allowed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

export interface GridGenerationOptions {
  /** Number of rooms to place (≥ 1). */
  count: number;
  /** Deterministic seed. Strings are hashed. */
  seed?: number | string;
  /** Bias toward recent placements. 0.4 = moderate spines with occasional branches. */
  branchBias?: number;
  /** Fraction of grid-adjacent, non-tree pairs that become loop exits. */
  loopProbability?: number;
  /** Room ID prefix. Defaults to `room`. */
  idPrefix?: string;
}

export function generateGridLayout(opts: GridGenerationOptions): FixedLayout {
  const count = Math.max(1, Math.floor(opts.count));
  const seed =
    typeof opts.seed === "string"
      ? hashString(opts.seed)
      : opts.seed ?? Date.now();
  const rng = mulberry32(seed);
  const branchBias = opts.branchBias ?? 0.4;
  const loopProbability = opts.loopProbability ?? 0.22;
  const idPrefix = opts.idPrefix ?? "room";

  const cells = new Map<string, string>();
  const placed: Array<{ id: string; x: number; y: number }> = [];
  const exits: Record<string, Record<string, string>> = {};

  const start = { id: `${idPrefix}_0`, x: 0, y: 0 };
  placed.push(start);
  cells.set("0,0", start.id);
  exits[start.id] = {};

  for (let i = 1; i < count; i++) {
    const id = `${idPrefix}_${i}`;
    let placedThis = false;

    // Up to N rotations of the "pick a recent room, try to branch" loop before
    // giving up and doing an exhaustive scan from the oldest room forward.
    for (let attempt = 0; attempt < 32 && !placedThis; attempt++) {
      // Geometric(1-branchBias)-ish draw from the tail of `placed`.
      let offset = 0;
      while (offset < placed.length - 1 && rng() > branchBias) offset++;
      const parent = placed[placed.length - 1 - offset]!;

      const shuffled = shuffle(DIR_PAIRS, rng);
      for (const [dir, rev, dx, dy] of shuffled) {
        const nx = parent.x + dx;
        const ny = parent.y + dy;
        const key = `${nx},${ny}`;
        if (cells.has(key)) continue;
        cells.set(key, id);
        placed.push({ id, x: nx, y: ny });
        exits[id] = {};
        exits[parent.id]![dir] = id;
        exits[id]![rev] = parent.id;
        placedThis = true;
        break;
      }
    }

    if (placedThis) continue;

    // Fallback: linear scan from oldest to find any room with a free neighbor.
    for (const parent of placed) {
      for (const [dir, rev, dx, dy] of DIR_PAIRS) {
        const nx = parent.x + dx;
        const ny = parent.y + dy;
        const key = `${nx},${ny}`;
        if (cells.has(key)) continue;
        cells.set(key, id);
        placed.push({ id, x: nx, y: ny });
        exits[id] = {};
        exits[parent.id]![dir] = id;
        exits[id]![rev] = parent.id;
        placedThis = true;
        break;
      }
      if (placedThis) break;
    }

    // Truly-full grid is effectively impossible for practical room counts;
    // bail if it somehow happens so we return a valid partial layout.
    if (!placedThis) break;
  }

  // Promote a fraction of unused grid adjacencies to loop exits. Iterate in a
  // stable order so the result is deterministic given the seed.
  const placedSorted = [...placed].sort((a, b) =>
    a.x === b.x ? a.y - b.y : a.x - b.x,
  );
  for (const room of placedSorted) {
    for (const [dir, rev, dx, dy] of DIR_PAIRS) {
      const neighborId = cells.get(`${room.x + dx},${room.y + dy}`);
      if (!neighborId) continue;
      if (exits[room.id]![dir]) continue;
      if (exits[neighborId]![rev]) continue;
      if (rng() >= loopProbability) continue;
      exits[room.id]![dir] = neighborId;
      exits[neighborId]![rev] = room.id;
    }
  }

  const rooms: FixedLayoutRoom[] = placed.map((p) => ({
    id: p.id,
    hint: null,
    exits: exits[p.id]!,
  }));

  return { rooms };
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}
