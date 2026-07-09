import { describe, it, expect } from "vitest";
import { compassLayout, getLayoutBounds, type LayoutMeasurement } from "../dagreLayout";
import { zoneToGraph } from "../zoneToGraph";
import type { WorldFile } from "@/types/world";

function makeWorld(rooms: WorldFile["rooms"], overrides?: Partial<WorldFile>): WorldFile {
  return {
    zone: "test_zone",
    startRoom: Object.keys(rooms)[0] ?? "room1",
    rooms,
    ...overrides,
  };
}

describe("compassLayout", () => {
  it("places the start room at the origin", () => {
    const world = makeWorld({
      start: { title: "Start", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const start = laid.find((n) => n.id === "start")!;
    // With a single room, origin-aligned, centering and prefix sums cancel out.
    expect(start.position.x).toBe(0);
    expect(start.position.y).toBe(0);
  });

  it("places a north neighbor above the start room", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { n: "b" } },
      b: { title: "B", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;
    expect(b.position.y).toBeLessThan(a.position.y);
    expect(b.position.x).toBe(a.position.x);
  });

  it("places an east neighbor to the right of the start room", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { e: "b" } },
      b: { title: "B", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;
    expect(b.position.x).toBeGreaterThan(a.position.x);
    expect(b.position.y).toBe(a.position.y);
  });

  it("expands a column to fit the widest room and centers narrower ones", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { n: "b" } },
      b: { title: "B", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const measurements = new Map<string, LayoutMeasurement>([
      // "a" is wider than "b"; both sit in the same column (gx=0).
      ["a", { width: 400, height: 140 }],
      ["b", { width: 200, height: 140 }],
    ]);
    const laid = compassLayout(nodes, world, measurements);
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;

    // Column width = max(400, 200) = 400. "a" spans it; "b" is centered inside.
    // a.x should be 0 (widest, centered in 400-wide column at origin).
    // b.x should be (400 - 200) / 2 = 100.
    expect(a.position.x).toBe(0);
    expect(b.position.x).toBe(100);
  });

  it("expands a row to fit the tallest room and centers shorter ones", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { e: "b" } },
      b: { title: "B", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const measurements = new Map<string, LayoutMeasurement>([
      ["a", { width: 220, height: 300 }],
      ["b", { width: 220, height: 100 }],
    ]);
    const laid = compassLayout(nodes, world, measurements);
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;

    // Row height = max(300, 100) = 300. "a" is centered (y=0); "b" centered at (300-100)/2 = 100.
    expect(a.position.y).toBe(0);
    expect(b.position.y).toBe(100);
  });

  it("spaces east-chain rooms by the column's max width plus gutter", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { e: "b" } },
      b: { title: "B", description: "", exits: { e: "c" } },
      c: { title: "C", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const measurements = new Map<string, LayoutMeasurement>([
      ["a", { width: 220, height: 140 }],
      ["b", { width: 220, height: 140 }],
      ["c", { width: 220, height: 140 }],
    ]);
    const laid = compassLayout(nodes, world, measurements);
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;
    const c = laid.find((n) => n.id === "c")!;

    // Each column is 220 wide + 80 gutter = 300 stride.
    expect(b.position.x - a.position.x).toBe(300);
    expect(c.position.x - b.position.x).toBe(300);
  });

  it("falls back to default dimensions when measurements are missing", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { e: "b" } },
      b: { title: "B", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;
    // Default column width 220 + 80 gutter = 300.
    expect(b.position.x - a.position.x).toBe(300);
  });
});

describe("compassLayout fallbacks", () => {
  it("stacks u/d-linked floors as separate islands below the start floor", () => {
    // Two distinct floors connected only by stairs. The upstairs floor must
    // not be tangled into the start floor's grid — it should sit cleanly
    // below it with its own internal layout.
    const world = makeWorld({
      // Start floor: hub with one east neighbor.
      hub: { title: "Hub", description: "", exits: { e: "lounge", u: "landing" } },
      lounge: { title: "Lounge", description: "", exits: { w: "hub" } },
      // Upstairs floor: landing + bedroom east of it.
      landing: { title: "Landing", description: "", exits: { d: "hub", e: "bedroom" } },
      bedroom: { title: "Bedroom", description: "", exits: { w: "landing" } },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const hub = laid.find((n) => n.id === "hub")!;
    const lounge = laid.find((n) => n.id === "lounge")!;
    const landing = laid.find((n) => n.id === "landing")!;
    const bedroom = laid.find((n) => n.id === "bedroom")!;
    // Start floor: lounge to the east of hub, same row.
    expect(lounge.position.x).toBeGreaterThan(hub.position.x);
    expect(lounge.position.y).toBe(hub.position.y);
    // Upstairs floor: landing strictly below the start floor.
    expect(landing.position.y).toBeGreaterThan(lounge.position.y);
    // Internal upstairs layout: bedroom east of landing on the same row.
    expect(bedroom.position.x).toBeGreaterThan(landing.position.x);
    expect(bedroom.position.y).toBe(landing.position.y);
  });

  it("traverses u/d for reachability without pinning grid coordinates", () => {
    // Start has `u` to upstairs; upstairs has `e` to attic. Verify upstairs is
    // placed (reachable) and attic ends up east of upstairs on the grid.
    const world = makeWorld({
      start: { title: "Start", description: "", exits: { u: "upstairs" } },
      upstairs: { title: "Up", description: "", exits: { d: "start", e: "attic" } },
      attic: { title: "Attic", description: "", exits: { w: "upstairs" } },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const start = laid.find((n) => n.id === "start")!;
    const upstairs = laid.find((n) => n.id === "upstairs")!;
    const attic = laid.find((n) => n.id === "attic")!;
    // `start` is the origin; `upstairs` is reached via u/d — should satellite
    // onto the start cell (collision pushes it into an adjacent cell).
    expect(start).toBeDefined();
    expect(upstairs).toBeDefined();
    // Attic sits east of upstairs.
    expect(attic.position.x).toBeGreaterThan(upstairs.position.x);
  });

  it("still places all rooms when a graph is geometrically impossible", () => {
    // A triangle of n/e/s-w exits that can't embed on a grid. The fallback
    // should still give every room a finite position.
    const world = makeWorld({
      a: { title: "A", description: "", exits: { n: "b", e: "c" } },
      b: { title: "B", description: "", exits: { s: "a", e: "c" } },
      c: { title: "C", description: "", exits: { w: "a", sw: "b" } },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    expect(laid).toHaveLength(3);
    for (const node of laid) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });
});

describe("getLayoutBounds", () => {
  it("returns null for an empty node list", () => {
    expect(getLayoutBounds([])).toBeNull();
  });

  it("bounds a single default-sized node at its origin", () => {
    const world = makeWorld({
      solo: { title: "Solo", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const bounds = getLayoutBounds(laid);
    expect(bounds).not.toBeNull();
    // Default 220x140 node at (0,0).
    expect(bounds).toEqual({ x: 0, y: 0, width: 220, height: 140 });
  });

  it("bounds an east-chain using supplied measurements", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { e: "b" } },
      b: { title: "B", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const measurements = new Map<string, LayoutMeasurement>([
      ["a", { width: 220, height: 140 }],
      ["b", { width: 220, height: 140 }],
    ]);
    const laid = compassLayout(nodes, world, measurements);
    const bounds = getLayoutBounds(laid, measurements);
    // Two 220-wide nodes with a 80-gutter stride of 300 → total width 520,
    // single row of height 140.
    expect(bounds).toEqual({ x: 0, y: 0, width: 520, height: 140 });
  });

  it("prefers explicit measurements over node.measured values", () => {
    // Simulate stale DOM measurements on a node by placing a bogus
    // `measured` field that should be ignored in favor of the map.
    const world = makeWorld({
      a: { title: "A", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world).map((n) => ({
      ...n,
      measured: { width: 999, height: 999 },
    }));
    const overrides = new Map<string, LayoutMeasurement>([
      ["a", { width: 100, height: 50 }],
    ]);
    const bounds = getLayoutBounds(laid, overrides);
    expect(bounds).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });
});

describe("compassLayout with map pins", () => {
  it("seats pinned rooms in their authored arrangement, ignoring exit geometry", () => {
    // The exit says "b is north of a", but the author pinned b two cells EAST.
    // Pins win.
    const world = makeWorld({
      a: { title: "A", description: "", exits: { n: "b" }, mapX: 0, mapY: 0 },
      b: { title: "B", description: "", exits: { s: "a" }, mapX: 2, mapY: 0 },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;
    expect(b.position.y).toBe(a.position.y);
    expect(b.position.x).toBeGreaterThan(a.position.x);
  });

  it("BFS-places unpinned rooms relative to their pinned neighbours", () => {
    const world = makeWorld({
      a: { title: "A", description: "", exits: { e: "b" }, mapX: 4, mapY: 4 },
      b: { title: "B", description: "", exits: { w: "a", e: "c" }, mapX: 5, mapY: 4 },
      c: { title: "C", description: "", exits: { w: "b" } }, // unpinned
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const b = laid.find((n) => n.id === "b")!;
    const c = laid.find((n) => n.id === "c")!;
    // c flows out of pinned b, one cell east on the same row.
    expect(c.position.y).toBe(b.position.y);
    expect(c.position.x).toBeGreaterThan(b.position.x);
  });

  it("keeps pinned floors on separate islands and expands through stairs", () => {
    const world = makeWorld({
      ground: { title: "", description: "", exits: { u: "loft" }, mapX: 0, mapY: 0 },
      loft: { title: "", description: "", exits: { d: "ground", e: "loft_east" }, mapX: 0, mapY: 0, mapZ: 1 },
      loft_east: { title: "", description: "", exits: { w: "loft" } }, // unpinned
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);
    const ground = laid.find((n) => n.id === "ground")!;
    const loft = laid.find((n) => n.id === "loft")!;
    const loftEast = laid.find((n) => n.id === "loft_east")!;
    // Same authored cell, different floors → stacked islands, not a collision.
    expect(loft.position.y).not.toBe(ground.position.y);
    // The unpinned neighbour seats east of the pinned loft on its island.
    expect(loftEast.position.y).toBe(loft.position.y);
    expect(loftEast.position.x).toBeGreaterThan(loft.position.x);
  });

  it("recomputes the cached layout when only pins change", () => {
    const rooms: WorldFile["rooms"] = {
      a: { title: "A", description: "", exits: { e: "b" } },
      b: { title: "B", description: "", exits: { w: "a" } },
    };
    const unpinned = makeWorld(structuredClone(rooms));
    const { nodes: nodes1 } = zoneToGraph(unpinned);
    const before = compassLayout(nodes1, unpinned);
    const bBefore = before.find((n) => n.id === "b")!;

    // Same exits, but b pinned far east — the layout cache must not serve
    // the unpinned result.
    const pinned = makeWorld(structuredClone(rooms));
    pinned.rooms.a = { ...pinned.rooms.a!, mapX: 0, mapY: 0 };
    pinned.rooms.b = { ...pinned.rooms.b!, mapX: 5, mapY: 0 };
    const { nodes: nodes2 } = zoneToGraph(pinned);
    const after = compassLayout(nodes2, pinned);
    const bAfter = after.find((n) => n.id === "b")!;
    expect(bAfter.position.x).toBeGreaterThan(bBefore.position.x);
  });
});
