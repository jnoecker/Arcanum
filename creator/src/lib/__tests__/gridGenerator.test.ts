import { describe, it, expect } from "vitest";
import { generateGridLayout } from "../gridGenerator";
import { OPPOSITE } from "../zoneEdits";

const DIR_OFFSET: Record<string, [number, number]> = {
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0],
};

/** Walk the exits, inferring a grid position for each room from the start. */
function reconstructGrid(
  layout: ReturnType<typeof generateGridLayout>,
): Map<string, [number, number]> | null {
  const pos = new Map<string, [number, number]>();
  const first = layout.rooms[0]!;
  pos.set(first.id, [0, 0]);
  const queue = [first.id];
  const byId = new Map(layout.rooms.map((r) => [r.id, r]));

  while (queue.length > 0) {
    const id = queue.shift()!;
    const [x, y] = pos.get(id)!;
    const room = byId.get(id)!;
    for (const [dir, target] of Object.entries(room.exits)) {
      const offset = DIR_OFFSET[dir];
      if (!offset) continue;
      const expected: [number, number] = [x + offset[0], y + offset[1]];
      const existing = pos.get(target);
      if (existing) {
        if (existing[0] !== expected[0] || existing[1] !== expected[1]) {
          return null; // inconsistent
        }
      } else {
        pos.set(target, expected);
        queue.push(target);
      }
    }
  }
  return pos;
}

describe("generateGridLayout", () => {
  it("produces the requested number of rooms", () => {
    for (const count of [1, 5, 25, 60]) {
      const layout = generateGridLayout({ count, seed: 1 });
      expect(layout.rooms).toHaveLength(count);
    }
  });

  it("gives every room a unique id", () => {
    const layout = generateGridLayout({ count: 30, seed: "test" });
    const ids = new Set(layout.rooms.map((r) => r.id));
    expect(ids.size).toBe(30);
  });

  it("keeps every room reachable from the first via cardinal exits", () => {
    const layout = generateGridLayout({ count: 40, seed: 42 });
    const byId = new Map(layout.rooms.map((r) => [r.id, r]));
    const visited = new Set<string>([layout.rooms[0]!.id]);
    const queue = [layout.rooms[0]!.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const target of Object.values(byId.get(cur)!.exits)) {
        if (!visited.has(target)) {
          visited.add(target);
          queue.push(target);
        }
      }
    }
    expect(visited.size).toBe(40);
  });

  it("produces a geometrically consistent grid", () => {
    const layout = generateGridLayout({ count: 50, seed: 7 });
    const grid = reconstructGrid(layout);
    expect(grid).not.toBeNull();

    const seen = new Set<string>();
    for (const [, [x, y]] of grid!) {
      const key = `${x},${y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("wires all exits bidirectionally", () => {
    const layout = generateGridLayout({ count: 30, seed: 123 });
    const byId = new Map(layout.rooms.map((r) => [r.id, r]));
    for (const room of layout.rooms) {
      for (const [dir, target] of Object.entries(room.exits)) {
        const rev = OPPOSITE[dir]!;
        expect(byId.get(target)!.exits[rev]).toBe(room.id);
      }
    }
  });

  it("is deterministic given the same seed", () => {
    const a = generateGridLayout({ count: 20, seed: "stable" });
    const b = generateGridLayout({ count: 20, seed: "stable" });
    expect(a).toEqual(b);
  });

  it("produces different layouts for different seeds", () => {
    const a = generateGridLayout({ count: 20, seed: "one" });
    const b = generateGridLayout({ count: 20, seed: "two" });
    expect(a).not.toEqual(b);
  });

  it("uses only cardinal directions", () => {
    const layout = generateGridLayout({ count: 25, seed: 99 });
    const cardinals = new Set(["n", "s", "e", "w"]);
    for (const room of layout.rooms) {
      for (const dir of Object.keys(room.exits)) {
        expect(cardinals.has(dir)).toBe(true);
      }
    }
  });
});
