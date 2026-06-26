import { describe, it, expect } from "vitest";
import {
  computeZoneFootprint,
  roomNormalizedPos,
  zoneConnectionPoints,
} from "../zoneFootprint";
import type { WorldFile } from "@/types/world";

function makeWorld(rooms: WorldFile["rooms"], overrides?: Partial<WorldFile>): WorldFile {
  return {
    zone: "test_zone",
    startRoom: Object.keys(rooms)[0] ?? "room1",
    rooms,
    ...overrides,
  };
}

describe("computeZoneFootprint", () => {
  it("places a single room at a 1x1 footprint", () => {
    const fp = computeZoneFootprint(makeWorld({ solo: { title: "S", description: "" } }));
    expect(fp.cells).toHaveLength(1);
    expect(fp.cols).toBe(1);
    expect(fp.rows).toBe(1);
    expect(fp.chaotic).toBe(false);
  });

  it("packs a 2x2 loop into a 2-wide, 2-tall grid", () => {
    const fp = computeZoneFootprint(
      makeWorld({
        a: { title: "A", description: "", exits: { e: "b", s: "c" } },
        b: { title: "B", description: "", exits: { w: "a", s: "d" } },
        c: { title: "C", description: "", exits: { n: "a", e: "d" } },
        d: { title: "D", description: "", exits: { w: "c", n: "b" } },
      }),
    );
    expect(fp.cells).toHaveLength(4);
    expect(fp.cols).toBe(2);
    expect(fp.rows).toBe(2);
    expect(fp.chaotic).toBe(false);
  });

  it("puts a north neighbor above the start room (smaller normalized y)", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { n: "b" } },
      b: { title: "B", description: "" },
    });
    const fp = computeZoneFootprint(world);
    const a = roomNormalizedPos(fp, "a")!;
    const b = roomNormalizedPos(fp, "b")!;
    expect(b.ny).toBeLessThan(a.ny);
    expect(b.nx).toBeCloseTo(a.nx, 5);
  });

  it("puts an east neighbor to the right of the start room", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { e: "b" } },
      b: { title: "B", description: "" },
    });
    const fp = computeZoneFootprint(world);
    const a = roomNormalizedPos(fp, "a")!;
    const b = roomNormalizedPos(fp, "b")!;
    expect(b.nx).toBeGreaterThan(a.nx);
    expect(b.ny).toBeCloseTo(a.ny, 5);
  });

  it("ignores cross-zone exit targets when building the footprint", () => {
    const fp = computeZoneFootprint(
      makeWorld({
        a: { title: "A", description: "", exits: { e: "other:gate" } },
      }),
    );
    expect(fp.cells).toHaveLength(1);
  });

  it("places every room even for a geometrically impossible graph", () => {
    const fp = computeZoneFootprint(
      makeWorld({
        a: { title: "A", description: "", exits: { n: "b", e: "c" } },
        b: { title: "B", description: "", exits: { s: "a", e: "c" } },
        c: { title: "C", description: "", exits: { w: "a", sw: "b" } },
      }),
    );
    expect(fp.cells).toHaveLength(3);
    for (const c of fp.cells) {
      expect(Number.isFinite(c.gx)).toBe(true);
      expect(Number.isFinite(c.gy)).toBe(true);
    }
  });
});

describe("zoneConnectionPoints", () => {
  it("extracts cross-zone exits with direction and target", () => {
    const cps = zoneConnectionPoints(
      makeWorld({
        a: { title: "A", description: "", exits: { e: "b", n: "harbor:dock1" } },
        b: { title: "B", description: "", exits: { w: "a", s: "caves:mouth" } },
      }),
    );
    expect(cps).toHaveLength(2);
    expect(cps).toContainEqual({ roomId: "a", dir: "n", toZone: "harbor", toRoom: "dock1" });
    expect(cps).toContainEqual({ roomId: "b", dir: "s", toZone: "caves", toRoom: "mouth" });
  });

  it("returns nothing when there are no cross-zone exits", () => {
    const cps = zoneConnectionPoints(
      makeWorld({
        a: { title: "A", description: "", exits: { e: "b" } },
        b: { title: "B", description: "", exits: { w: "a" } },
      }),
    );
    expect(cps).toHaveLength(0);
  });
});
