import type { FixedLayout, FixedLayoutRoom } from "./generateZoneContent";

/**
 * Deterministically pack `count` rooms into a compact rectangle and wire every
 * orthogonally-adjacent pair, producing a fully-connected grid. The result is a
 * clean square/rectangular `FixedLayout` that the sketch-flavor LLM path fleshes
 * out — and, just as importantly, an easy canvas to reshape by hand. Builders
 * almost always redraw an auto-generated organic sprawl, so we hand them a
 * predictable block to carve from instead of a wandering walk.
 *
 * It renders as an exact rectangle: `compassLayout` (see `dagreLayout.ts`)
 * embeds the graph with zero collisions because the exits are geometrically
 * consistent by construction.
 */

const DIR_PAIRS: Array<[string, number, number]> = [
  ["n", 0, -1],
  ["s", 0, 1],
  ["e", 1, 0],
  ["w", -1, 0],
];

/** Default width:height ratio — a touch wider than tall reads well left-to-right. */
const DEFAULT_ASPECT = 1.2;

export interface GridGenerationOptions {
  /** Number of rooms to place (≥ 1). */
  count: number;
  /**
   * Accepted for call-site compatibility. The packed grid is deterministic by
   * size, so the seed no longer changes the shape — a given `count` always
   * yields the same rectangle.
   */
  seed?: number | string;
  /** Target width:height ratio of the rectangle. Default ~1.2. */
  aspect?: number;
  /** Room ID prefix. Defaults to `room`. */
  idPrefix?: string;
}

export function generateGridLayout(opts: GridGenerationOptions): FixedLayout {
  const count = Math.max(1, Math.floor(opts.count));
  const idPrefix = opts.idPrefix ?? "room";
  const aspect = opts.aspect && opts.aspect > 0 ? opts.aspect : DEFAULT_ASPECT;

  // Columns chosen so the block sits close to `aspect`; rows follow from count.
  // `room_0` lands at the top-left (0,0) so it reads as the natural entry corner.
  const cols = Math.min(count, Math.max(1, Math.round(Math.sqrt(count * aspect))));

  const rooms: FixedLayoutRoom[] = [];
  const cellId = new Map<string, string>();
  const coord = new Map<string, [number, number]>();

  for (let i = 0; i < count; i++) {
    const x = i % cols;
    const y = Math.floor(i / cols);
    const id = `${idPrefix}_${i}`;
    rooms.push({ id, hint: null, exits: {} });
    cellId.set(`${x},${y}`, id);
    coord.set(id, [x, y]);
  }

  // Wire each room to its existing cardinal neighbors. Visiting every room sets
  // both halves of each pair (A→e→B when on A, B→w→A when on B), so the graph
  // comes out fully bidirectional without a separate reverse pass.
  for (const room of rooms) {
    const [x, y] = coord.get(room.id)!;
    for (const [dir, dx, dy] of DIR_PAIRS) {
      const neighbor = cellId.get(`${x + dx},${y + dy}`);
      if (neighbor) room.exits[dir] = neighbor;
    }
  }

  return { rooms };
}
