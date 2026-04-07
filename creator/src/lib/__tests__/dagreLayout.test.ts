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

  // ─── Step 2: collision resolution + component packing ─────────

  it("never places two rooms on top of each other, even with a cycle", () => {
    // A cycle that cannot embed perfectly in 2D: the s-exit from C
    // points at the cell already occupied by B's north neighbor.
    const world = makeWorld({
      a: { title: "A", description: "", exits: { n: "b", e: "c" } },
      b: { title: "B", description: "", exits: { e: "d" } },
      c: { title: "C", description: "", exits: { n: "d" } },
      d: { title: "D", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);

    // Every room must have a unique pixel position — no overlaps.
    const seen = new Set<string>();
    for (const n of laid) {
      const key = `${n.position.x},${n.position.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("pushes the colliding subtree instead of scattering it", () => {
    // A has two east branches that both want the same cells.
    // Without a push, the second branch would spiral into a random spot.
    const world = makeWorld({
      a: { title: "A", description: "", exits: { n: "b", ne: "c" } },
      b: { title: "B", description: "", exits: { e: "c_collider" } },
      c: { title: "C", description: "" },
      c_collider: { title: "Collider", description: "" },
    });
    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);

    // All four rooms should still land on the grid with no overlaps.
    const positions = new Set(laid.map((n) => `${n.position.x},${n.position.y}`));
    expect(positions.size).toBe(laid.length);
  });

  it("packs disconnected components horizontally, not stacked vertically", () => {
    const world = makeWorld({
      a1: { title: "A1", description: "", exits: { e: "a2" } },
      a2: { title: "A2", description: "" },
      b1: { title: "B1", description: "", exits: { e: "b2" } },
      b2: { title: "B2", description: "" },
    }, { startRoom: "a1" });

    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);

    const byId = new Map(laid.map((n) => [n.id, n]));
    const a1 = byId.get("a1")!;
    const a2 = byId.get("a2")!;
    const b1 = byId.get("b1")!;
    const b2 = byId.get("b2")!;

    // Component A is a horizontal pair; component B is a horizontal pair.
    // Both components should sit on the same y row (y=0), packed left-to-right.
    expect(a1.position.y).toBe(0);
    expect(a2.position.y).toBe(0);
    expect(b1.position.y).toBe(0);
    expect(b2.position.y).toBe(0);

    // Component B must start to the right of component A's rightmost cell.
    expect(b1.position.x).toBeGreaterThan(a2.position.x);
  });

  it("places the start-room component first (leftmost)", () => {
    const world = makeWorld({
      orphan: { title: "Orphan", description: "" },
      start: { title: "Start", description: "", exits: { e: "next" } },
      next: { title: "Next", description: "" },
    }, { startRoom: "start" });

    const { nodes } = zoneToGraph(world);
    const laid = compassLayout(nodes, world);

    const start = laid.find((n) => n.id === "start")!;
    const orphan = laid.find((n) => n.id === "orphan")!;
    // The start component anchors the left edge; the orphan is packed to its right.
    expect(orphan.position.x).toBeGreaterThan(start.position.x);
  });
});
