import { describe, it, expect } from "vitest";
import {
  inferDirection,
  sanitizeLabel,
  sketchToWorldData,
  mergeSketchRooms,
} from "@/lib/sketchToZone";
import type { SketchParseResult } from "@/types/sketch";
import type { WorldFile } from "@/types/world";

// ─── inferDirection ─────────────────────────────────────────────────

describe("inferDirection", () => {
  it("maps cardinal directions correctly", () => {
    expect(inferDirection(0, 0, 1, 0)).toBe("e");
    expect(inferDirection(0, 0, -1, 0)).toBe("w");
    expect(inferDirection(0, 0, 0, -1)).toBe("n");
    expect(inferDirection(0, 0, 0, 1)).toBe("s");
  });

  it("maps diagonal directions correctly", () => {
    expect(inferDirection(0, 0, 1, -1)).toBe("ne");
    expect(inferDirection(0, 0, -1, -1)).toBe("nw");
    expect(inferDirection(0, 0, 1, 1)).toBe("se");
    expect(inferDirection(0, 0, -1, 1)).toBe("sw");
  });

  it("returns null for same position", () => {
    expect(inferDirection(0, 0, 0, 0)).toBeNull();
    expect(inferDirection(3, 5, 3, 5)).toBeNull();
  });

  it("normalizes non-unit vectors", () => {
    // room 3 cells to the east still = east
    expect(inferDirection(0, 0, 3, 0)).toBe("e");
    expect(inferDirection(0, 0, 2, -5)).toBe("ne");
  });
});

// ─── sanitizeLabel ──────────────────────────────────────────────────

describe("sanitizeLabel", () => {
  it("lowercases and replaces spaces with underscores", () => {
    expect(sanitizeLabel("Entrance Hall")).toBe("entrance_hall");
  });

  it("removes special characters", () => {
    expect(sanitizeLabel("Room #1!")).toBe("room_1");
  });

  it("ensures ID starts with a letter", () => {
    expect(sanitizeLabel("123 start")).toBe("room_123_start");
  });

  it("handles empty string", () => {
    expect(sanitizeLabel("")).toBe("room_");
  });
});

// ─── sketchToWorldData ──────────────────────────────────────────────

describe("sketchToWorldData", () => {
  it("returns a fallback zone for empty sketch", () => {
    const result: SketchParseResult = { rooms: [], connections: [] };
    const world = sketchToWorldData(result, "test_zone");
    expect(world.zone).toBe("test_zone");
    expect(world.startRoom).toBe("entrance");
    expect(Object.keys(world.rooms)).toHaveLength(1);
  });

  it("creates rooms with titles from labels", () => {
    const result: SketchParseResult = {
      rooms: [
        { id: "room_1", label: "Tavern", gridX: 0, gridY: 0 },
        { id: "room_2", label: "Market", gridX: 1, gridY: 0 },
      ],
      connections: [{ from: "room_1", to: "room_2" }],
    };
    const world = sketchToWorldData(result, "town");
    expect(world.rooms["tavern"]).toBeDefined();
    expect(world.rooms["tavern"].title).toBe("Tavern");
    expect(world.rooms["market"]).toBeDefined();
    expect(world.rooms["market"].title).toBe("Market");
  });

  it("assigns placeholder names for unlabeled rooms", () => {
    const result: SketchParseResult = {
      rooms: [
        { id: "room_1", label: null, gridX: 0, gridY: 0 },
        { id: "room_2", label: null, gridX: 1, gridY: 0 },
      ],
      connections: [],
    };
    const world = sketchToWorldData(result, "cave");
    expect(world.rooms["cave_room1"]).toBeDefined();
    expect(world.rooms["cave_room2"]).toBeDefined();
  });

  it("creates bidirectional exits", () => {
    const result: SketchParseResult = {
      rooms: [
        { id: "room_1", label: "West Room", gridX: 0, gridY: 0 },
        { id: "room_2", label: "East Room", gridX: 1, gridY: 0 },
      ],
      connections: [{ from: "room_1", to: "room_2" }],
    };
    const world = sketchToWorldData(result, "z");
    expect(world.rooms["west_room"].exits?.["e"]).toBe("east_room");
    expect(world.rooms["east_room"].exits?.["w"]).toBe("west_room");
  });

  it("sets the first room as startRoom", () => {
    const result: SketchParseResult = {
      rooms: [
        { id: "room_1", label: "Start", gridX: 0, gridY: 0 },
        { id: "room_2", label: "End", gridX: 1, gridY: 0 },
      ],
      connections: [],
    };
    const world = sketchToWorldData(result, "z");
    expect(world.startRoom).toBe("start");
  });

  it("deduplicates room IDs from identical labels", () => {
    const result: SketchParseResult = {
      rooms: [
        { id: "room_1", label: "Hall", gridX: 0, gridY: 0 },
        { id: "room_2", label: "Hall", gridX: 1, gridY: 0 },
      ],
      connections: [],
    };
    const world = sketchToWorldData(result, "z");
    const ids = Object.keys(world.rooms);
    expect(ids).toHaveLength(2);
    expect(ids).toContain("hall");
    expect(ids).toContain("hall_2");
  });

  it("handles diagonal connections", () => {
    const result: SketchParseResult = {
      rooms: [
        { id: "room_1", label: "A", gridX: 0, gridY: 0 },
        { id: "room_2", label: "B", gridX: 1, gridY: 1 },
      ],
      connections: [{ from: "room_1", to: "room_2" }],
    };
    const world = sketchToWorldData(result, "z");
    expect(world.rooms["a"].exits?.["se"]).toBe("b");
    expect(world.rooms["b"].exits?.["nw"]).toBe("a");
  });
});

// ─── mergeSketchRooms ───────────────────────────────────────────────

describe("mergeSketchRooms", () => {
  const baseWorld: WorldFile = {
    zone: "town",
    startRoom: "entrance",
    rooms: {
      entrance: { title: "Entrance", description: "The entrance." },
    },
  };

  it("adds new rooms without overwriting existing", () => {
    const result: SketchParseResult = {
      rooms: [{ id: "room_1", label: "Market", gridX: 0, gridY: 0 }],
      connections: [],
    };
    const merged = mergeSketchRooms(baseWorld, result);
    expect(merged.rooms["entrance"]).toBeDefined();
    expect(merged.rooms["market"]).toBeDefined();
    expect(merged.startRoom).toBe("entrance");
  });

  it("avoids ID collisions with existing rooms", () => {
    const result: SketchParseResult = {
      rooms: [{ id: "room_1", label: "Entrance", gridX: 0, gridY: 0 }],
      connections: [],
    };
    const merged = mergeSketchRooms(baseWorld, result);
    const ids = Object.keys(merged.rooms);
    expect(ids).toContain("entrance");
    expect(ids).toContain("entrance_2");
    expect(ids).toHaveLength(2);
  });

  it("returns world unchanged for empty sketch", () => {
    const result: SketchParseResult = { rooms: [], connections: [] };
    const merged = mergeSketchRooms(baseWorld, result);
    expect(Object.keys(merged.rooms)).toHaveLength(1);
  });
});
