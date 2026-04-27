import { describe, it, expect } from "vitest";
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

describe("zoneToGraph", () => {
  it("creates nodes for each room", () => {
    const world = makeWorld({
      room1: { title: "Room 1", description: "desc" },
      room2: { title: "Room 2", description: "desc" },
    });
    const { nodes } = zoneToGraph(world);
    const roomNodes = nodes.filter((n) => n.type === "room");
    expect(roomNodes).toHaveLength(2);
    expect(roomNodes.map((n) => n.id).sort()).toEqual(["room1", "room2"]);
  });

  it("marks start room in node data", () => {
    const world = makeWorld({
      start: { title: "Start", description: "desc" },
      other: { title: "Other", description: "desc" },
    }, { startRoom: "start" });
    const { nodes } = zoneToGraph(world);
    const startNode = nodes.find((n) => n.id === "start");
    const otherNode = nodes.find((n) => n.id === "other");
    expect((startNode?.data as Record<string, unknown>).isStartRoom).toBe(true);
    expect((otherNode?.data as Record<string, unknown>).isStartRoom).toBe(false);
  });

  it("creates edges for exits between rooms", () => {
    const world = makeWorld({
      room1: { title: "Room 1", description: "desc", exits: { n: "room2" } },
      room2: { title: "Room 2", description: "desc", exits: { s: "room1" } },
    });
    const { edges } = zoneToGraph(world);
    // Bidirectional should be deduplicated to one edge
    expect(edges).toHaveLength(1);
    expect(edges[0]!.label).toBe("N / S");
  });

  it("creates directed edge for one-way exit", () => {
    const world = makeWorld({
      room1: { title: "Room 1", description: "desc", exits: { n: "room2" } },
      room2: { title: "Room 2", description: "desc" },
    });
    const { edges } = zoneToGraph(world);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.label).toBe("N");
    expect(edges[0]!.markerEnd).toBeDefined();
  });

  it("creates cross-zone ghost nodes", () => {
    const world = makeWorld({
      room1: {
        title: "Room 1",
        description: "desc",
        exits: { n: "other_zone:target_room" },
      },
    });
    const { nodes, edges } = zoneToGraph(world);
    const ghost = nodes.find((n) => n.type === "crossZone");
    expect(ghost).toBeDefined();
    expect(ghost!.id).toBe("xzone:other_zone:target_room");
    expect((ghost!.data as Record<string, unknown>).zone).toBe("other_zone");
    expect((ghost!.data as Record<string, unknown>).room).toBe("target_room");
    expect(edges).toHaveLength(1);
  });

  it("counts mobs and items per room", () => {
    const world = makeWorld(
      {
        room1: { title: "Room 1", description: "desc" },
      },
      {
        mobs: {
          mob1: { name: "Mob", spawns: [{ room: "room1" }], tier: "weak" },
          mob2: { name: "Mob 2", spawns: [{ room: "room1" }], tier: "weak" },
        },
        items: {
          item1: { displayName: "Item", room: "room1" },
        },
      },
    );
    const { nodes } = zoneToGraph(world);
    const room = nodes.find((n) => n.id === "room1");
    const data = room?.data as Record<string, unknown>;
    expect(data.mobCount).toBe(2);
    expect(data.itemCount).toBe(1);
  });

  it("handles complex exit values with doors", () => {
    const world = makeWorld({
      room1: {
        title: "Room 1",
        description: "desc",
        exits: { e: { to: "room2", door: { closed: true, locked: true, key: "gold_key" } } },
      },
      room2: { title: "Room 2", description: "desc" },
    });
    const { edges } = zoneToGraph(world);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.style).toBeDefined();
    // Door exits get dashed stroke
    expect((edges[0]!.style as Record<string, unknown>).strokeDasharray).toBe("6 3");
  });

  it("skips exits to nonexistent rooms", () => {
    const world = makeWorld({
      room1: {
        title: "Room 1",
        description: "desc",
        exits: { n: "nonexistent" },
      },
    });
    const { edges } = zoneToGraph(world);
    expect(edges).toHaveLength(0);
  });
});
