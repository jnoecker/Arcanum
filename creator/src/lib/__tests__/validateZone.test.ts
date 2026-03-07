import { describe, it, expect } from "vitest";
import { validateZone, type ValidationIssue } from "../validateZone";
import type { WorldFile } from "@/types/world";

function makeValidWorld(): WorldFile {
  return {
    zone: "test",
    startRoom: "room1",
    rooms: {
      room1: {
        title: "Room 1",
        description: "First room",
        exits: { n: "room2" },
      },
      room2: {
        title: "Room 2",
        description: "Second room",
        exits: { s: "room1" },
      },
    },
    mobs: {
      rat: { name: "Rat", room: "room1" },
    },
    items: {
      sword: { displayName: "Sword", room: "room1" },
    },
  };
}

function errors(issues: ValidationIssue[]) {
  return issues.filter((i) => i.severity === "error");
}

function warnings(issues: ValidationIssue[]) {
  return issues.filter((i) => i.severity === "warning");
}

describe("validateZone", () => {
  it("returns no issues for a valid world", () => {
    const issues = validateZone(makeValidWorld());
    expect(issues).toHaveLength(0);
  });

  // ─── Zone-level ──────────────────────────────────────────────
  it("errors if startRoom does not exist", () => {
    const world = makeValidWorld();
    world.startRoom = "nonexistent";
    const issues = errors(validateZone(world));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("does not exist");
  });

  it("errors if zone has no rooms", () => {
    const world = makeValidWorld();
    world.rooms = {};
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("no rooms"))).toBe(true);
  });

  // ─── Room exits ──────────────────────────────────────────────
  it("errors on exit to non-existent room", () => {
    const world = makeValidWorld();
    world.rooms.room1.exits = { n: "missing_room" };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_room"))).toBe(true);
  });

  it("does not error on cross-zone exits", () => {
    const world = makeValidWorld();
    world.rooms.room1.exits = { n: "other_zone:room1" };
    const issues = errors(validateZone(world));
    expect(issues).toHaveLength(0);
  });

  it("warns on door key that is not a known item", () => {
    const world = makeValidWorld();
    world.rooms.room1.exits = {
      n: { to: "room2", door: { locked: true, key: "missing_key" } },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_key"))).toBe(true);
  });

  // ─── Room content ────────────────────────────────────────────
  it("warns on room with no title", () => {
    const world = makeValidWorld();
    world.rooms.room1.title = "";
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("no title"))).toBe(true);
  });

  // ─── Mob checks ──────────────────────────────────────────────
  it("errors if mob room does not exist", () => {
    const world = makeValidWorld();
    world.mobs!.rat.room = "missing";
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "mob:rat")).toBe(true);
  });

  it("warns on mob drop referencing unknown item", () => {
    const world = makeValidWorld();
    world.mobs!.rat.drops = [{ itemId: "missing_item", chance: 50 }];
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_item"))).toBe(true);
  });

  it("warns on invalid drop chance", () => {
    const world = makeValidWorld();
    world.mobs!.rat.drops = [{ itemId: "sword", chance: 0 }];
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("invalid chance"))).toBe(true);
  });

  it("errors on patrol route with non-existent room", () => {
    const world = makeValidWorld();
    world.mobs!.rat.behavior = {
      template: "PATROL",
      params: { patrolRoute: ["room1", "missing"] },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing"))).toBe(true);
  });

  it("errors on mob quest reference to non-existent quest", () => {
    const world = makeValidWorld();
    world.mobs!.rat.quests = ["no_quest"];
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("no_quest"))).toBe(true);
  });

  // ─── Dialogue checks ────────────────────────────────────────
  it("errors on dialogue choice pointing to non-existent node", () => {
    const world = makeValidWorld();
    world.mobs!.rat.dialogue = {
      root: {
        text: "Hello",
        choices: [{ text: "Go", next: "missing_node" }],
      },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_node"))).toBe(true);
  });

  it("warns on dialogue node with empty text", () => {
    const world = makeValidWorld();
    world.mobs!.rat.dialogue = {
      root: { text: "" },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("empty text"))).toBe(true);
  });

  // ─── Item checks ────────────────────────────────────────────
  it("errors if item room does not exist", () => {
    const world = makeValidWorld();
    world.items!.sword.room = "missing";
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "item:sword")).toBe(true);
  });

  // ─── Shop checks ───────────────────────────────────────────
  it("errors if shop room does not exist", () => {
    const world = makeValidWorld();
    world.shops = { vendor: { name: "Vendor", room: "missing" } };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "shop:vendor")).toBe(true);
  });

  it("warns on shop inventory item not in zone", () => {
    const world = makeValidWorld();
    world.shops = {
      vendor: { name: "Vendor", room: "room1", items: ["missing_item"] },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_item"))).toBe(true);
  });

  // ─── Quest checks ──────────────────────────────────────────
  it("warns if quest giver mob does not exist", () => {
    const world = makeValidWorld();
    world.quests = {
      q1: {
        name: "Quest",
        giver: "missing_mob",
        objectives: [{ type: "KILL", targetKey: "rat" }],
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_mob"))).toBe(true);
  });

  it("warns if quest has no objectives", () => {
    const world = makeValidWorld();
    world.quests = {
      q1: { name: "Quest", giver: "rat" },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("no objectives"))).toBe(true);
  });

  // ─── Gathering node checks ────────────────────────────────
  it("errors if gathering node room does not exist", () => {
    const world = makeValidWorld();
    world.gatheringNodes = {
      ore: {
        displayName: "Ore",
        skill: "MINING",
        yields: [{ itemId: "sword" }],
        room: "missing",
      },
    };
    const issues = errors(validateZone(world));
    expect(issues.some((i) => i.entity === "gatheringNode:ore")).toBe(true);
  });

  it("warns on gathering yield referencing unknown item", () => {
    const world = makeValidWorld();
    world.gatheringNodes = {
      ore: {
        displayName: "Ore",
        skill: "MINING",
        yields: [{ itemId: "missing_item" }],
        room: "room1",
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_item"))).toBe(true);
  });

  // ─── Recipe checks ────────────────────────────────────────
  it("warns on recipe output item not in zone", () => {
    const world = makeValidWorld();
    world.recipes = {
      r1: {
        displayName: "Recipe",
        skill: "SMITHING",
        materials: [{ itemId: "sword", quantity: 1 }],
        outputItemId: "missing_output",
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_output"))).toBe(
      true,
    );
  });

  it("warns on recipe material item not in zone", () => {
    const world = makeValidWorld();
    world.recipes = {
      r1: {
        displayName: "Recipe",
        skill: "SMITHING",
        materials: [{ itemId: "missing_mat", quantity: 1 }],
        outputItemId: "sword",
      },
    };
    const issues = warnings(validateZone(world));
    expect(issues.some((i) => i.message.includes("missing_mat"))).toBe(true);
  });
});
