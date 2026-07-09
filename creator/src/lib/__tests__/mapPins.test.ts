import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { WorldFile } from "@/types/world";
import {
  CELL_H,
  CELL_W,
  applyMapPins,
  quantizeLayout,
  roomFloors,
  roomMapPin,
  zoneMapPins,
} from "../mapPins";

function makeWorld(rooms: WorldFile["rooms"], overrides?: Partial<WorldFile>): WorldFile {
  return {
    zone: "test_zone",
    startRoom: Object.keys(rooms)[0] ?? "room1",
    rooms,
    ...overrides,
  };
}

/** Minimal React Flow node at a pixel position (default 220x140 footprint). */
function node(id: string, x: number, y: number): Node {
  return { id, position: { x, y }, data: {} } as Node;
}

describe("roomMapPin / zoneMapPins", () => {
  it("reads a full pin, defaulting mapZ to 0", () => {
    expect(roomMapPin({ title: "", description: "", mapX: 3, mapY: 7 })).toEqual({
      x: 3,
      y: 7,
      z: 0,
    });
    expect(roomMapPin({ title: "", description: "", mapX: 1, mapY: 2, mapZ: -1 })).toEqual({
      x: 1,
      y: 2,
      z: -1,
    });
  });

  it("treats half-specified pins as unpinned", () => {
    expect(roomMapPin({ title: "", description: "", mapX: 3 })).toBeUndefined();
    expect(roomMapPin({ title: "", description: "", mapY: 3 })).toBeUndefined();
    const world = makeWorld({
      a: { title: "A", description: "", mapX: 1, mapY: 1 },
      b: { title: "B", description: "", mapX: 5 },
      c: { title: "C", description: "" },
    });
    expect([...zoneMapPins(world).keys()]).toEqual(["a"]);
  });
});

describe("roomFloors", () => {
  it("assigns floors through stairs: u is +1, d is -1", () => {
    const world = makeWorld({
      ground: { title: "", description: "", exits: { u: "upstairs", d: "cellar" } },
      upstairs: { title: "", description: "", exits: { d: "ground", e: "attic_hall" } },
      attic_hall: { title: "", description: "", exits: { w: "upstairs" } },
      cellar: { title: "", description: "", exits: { u: "ground" } },
    });
    const floors = roomFloors(world);
    expect(floors.get("ground")).toBe(0);
    expect(floors.get("upstairs")).toBe(1);
    expect(floors.get("attic_hall")).toBe(1);
    expect(floors.get("cellar")).toBe(-1);
  });

  it("anchors rooms with no inbound path through their own exits, reversed", () => {
    // "hidden" has no exit leading to it, only an outgoing u to a placed room:
    // my `u` leads above me, so I sit one floor below it.
    const world = makeWorld({
      start: { title: "", description: "" },
      hidden: { title: "", description: "", exits: { u: "start" } },
    });
    const floors = roomFloors(world);
    expect(floors.get("start")).toBe(0);
    expect(floors.get("hidden")).toBe(-1);
  });

  it("puts fully disconnected rooms on the ground floor", () => {
    const world = makeWorld({
      start: { title: "", description: "" },
      island: { title: "", description: "" },
    });
    expect(roomFloors(world).get("island")).toBe(0);
  });

  it("understands long-form direction names", () => {
    const world = makeWorld({
      start: { title: "", description: "", exits: { up: "loft" } },
      loft: { title: "", description: "" },
    });
    expect(roomFloors(world).get("loft")).toBe(1);
  });
});

describe("quantizeLayout", () => {
  it("snaps node centers to the nearest grid cell, normalized per floor", () => {
    const world = makeWorld({
      a: { title: "", description: "", exits: { e: "b" } },
      b: { title: "", description: "", exits: { w: "a" } },
    });
    // b dragged roughly one cell east and slightly off-grid.
    const pins = quantizeLayout(
      [node("a", 100, 100), node("b", 100 + CELL_W + 30, 100 - 20)],
      world,
    );
    expect(pins.get("a")).toEqual({ x: 0, y: 0, z: 0 });
    expect(pins.get("b")).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("resolves two rooms snapping to the same cell onto distinct cells", () => {
    const world = makeWorld({
      a: { title: "", description: "" },
      b: { title: "", description: "" },
    });
    const pins = quantizeLayout([node("a", 0, 0), node("b", 40, 30)], world);
    const cells = new Set([...pins.values()].map((p) => `${p.x},${p.y},${p.z}`));
    expect(cells.size).toBe(2);
  });

  it("quantizes each floor in its own frame, from graph-derived floors", () => {
    const world = makeWorld({
      ground: { title: "", description: "", exits: { u: "loft" } },
      loft: { title: "", description: "", exits: { d: "ground", e: "loft_east" } },
      loft_east: { title: "", description: "", exits: { w: "loft" } },
    });
    // The editor stacks the loft island far below the ground floor; per-floor
    // normalization must strip that pixel offset out of the pins.
    const pins = quantizeLayout(
      [
        node("ground", 0, 0),
        node("loft", 0, 5 * CELL_H),
        node("loft_east", CELL_W, 5 * CELL_H),
      ],
      world,
    );
    expect(pins.get("ground")).toEqual({ x: 0, y: 0, z: 0 });
    expect(pins.get("loft")).toEqual({ x: 0, y: 0, z: 1 });
    expect(pins.get("loft_east")).toEqual({ x: 1, y: 0, z: 1 });
  });

  it("ignores cross-zone nodes", () => {
    const world = makeWorld({
      a: { title: "", description: "", exits: { e: "other:room" } },
    });
    const pins = quantizeLayout(
      [node("a", 0, 0), node("xzone:other:room", CELL_W, 0)],
      world,
    );
    expect([...pins.keys()]).toEqual(["a"]);
  });
});

describe("applyMapPins", () => {
  it("writes pins onto rooms, omitting mapZ on the ground floor", () => {
    const world = makeWorld({
      a: { title: "A", description: "desc", bank: true },
      b: { title: "B", description: "" },
    });
    const next = applyMapPins(
      world,
      new Map([
        ["a", { x: 2, y: 3, z: 0 }],
        ["b", { x: 0, y: 0, z: 1 }],
      ]),
    );
    expect(next.rooms.a).toMatchObject({ title: "A", description: "desc", bank: true, mapX: 2, mapY: 3 });
    expect(next.rooms.a!.mapZ).toBeUndefined();
    expect(next.rooms.b).toMatchObject({ mapX: 0, mapY: 0, mapZ: 1 });
    // Input world untouched.
    expect(world.rooms.a!.mapX).toBeUndefined();
  });

  it("leaves rooms without a pin entry unchanged", () => {
    const world = makeWorld({
      a: { title: "A", description: "", mapX: 9, mapY: 9 },
      b: { title: "B", description: "" },
    });
    const next = applyMapPins(world, new Map([["b", { x: 1, y: 1, z: 0 }]]));
    expect(next.rooms.a).toBe(world.rooms.a);
    expect(next.rooms.b).toMatchObject({ mapX: 1, mapY: 1 });
  });
});
