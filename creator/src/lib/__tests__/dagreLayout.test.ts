import { describe, it, expect } from "vitest";
import { compassLayout, type LayoutMeasurement } from "../dagreLayout";
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
