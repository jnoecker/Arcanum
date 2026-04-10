import { describe, it, expect } from "vitest";
import { sanitizeZone, sanitizeId, buildIdRemap } from "../sanitizeZone";
import type { WorldFile } from "@/types/world";

// ─── sanitizeId ───────────────────────────────────────────────────

describe("sanitizeId", () => {
  it("returns null for blank input", () => {
    expect(sanitizeId("", "room")).toBeNull();
    expect(sanitizeId("   ", "room")).toBeNull();
  });

  it("prefixes purely numeric IDs", () => {
    expect(sanitizeId("3001", "room")).toBe("room_3001");
    expect(sanitizeId("42", "mob")).toBe("mob_42");
    expect(sanitizeId("0", "item")).toBe("item_0");
  });

  it("leaves valid IDs unchanged", () => {
    expect(sanitizeId("town_square", "room")).toBe("town_square");
    expect(sanitizeId("goblin_warrior", "mob")).toBe("goblin_warrior");
  });

  it("lowercases IDs", () => {
    expect(sanitizeId("Town_Square", "room")).toBe("town_square");
    expect(sanitizeId("GOBLIN", "mob")).toBe("goblin");
  });

  it("replaces spaces and hyphens with underscores", () => {
    expect(sanitizeId("town square", "room")).toBe("town_square");
    expect(sanitizeId("goblin-warrior", "mob")).toBe("goblin_warrior");
    expect(sanitizeId("old.gate", "room")).toBe("old_gate");
  });

  it("strips special characters", () => {
    expect(sanitizeId("room@#$%abc", "room")).toBe("roomabc");
    expect(sanitizeId("mob!name", "mob")).toBe("mobname");
  });

  it("collapses multiple underscores and trims edges", () => {
    expect(sanitizeId("__room__name__", "room")).toBe("room_name");
    expect(sanitizeId("room___name", "room")).toBe("room_name");
  });

  it("handles mixed-numeric with letters (not purely numeric)", () => {
    expect(sanitizeId("room3001", "room")).toBe("room3001");
    expect(sanitizeId("3a", "room")).toBe("3a");
  });

  it("returns null when all chars are stripped", () => {
    expect(sanitizeId("@#$%", "room")).toBeNull();
  });
});

// ─── buildIdRemap ─────────────────────────────────────────────────

describe("buildIdRemap", () => {
  it("returns empty map for valid IDs", () => {
    const remap = buildIdRemap(["town_square", "tavern", "gate"], "room");
    expect(remap.size).toBe(0);
  });

  it("remaps numeric IDs", () => {
    const remap = buildIdRemap(["3001", "3002", "valid_room"], "room");
    expect(remap.get("3001")).toBe("room_3001");
    expect(remap.get("3002")).toBe("room_3002");
    expect(remap.has("valid_room")).toBe(false);
  });

  it("handles collisions with suffix", () => {
    const remap = buildIdRemap(["3001", "room_3001"], "room");
    expect(remap.get("3001")).toBe("room_3001_2");
    expect(remap.has("room_3001")).toBe(false);
  });

  it("marks blank-sanitized IDs for removal", () => {
    const remap = buildIdRemap(["@#$", "valid"], "room");
    expect(remap.get("@#$")).toBe("");
  });
});

// ─── sanitizeZone — ID remapping ──────────────────────────────────

function makeWorld(overrides: Partial<WorldFile> = {}): WorldFile {
  return {
    zone: "testzone",
    startRoom: "room_a",
    rooms: {
      room_a: { title: "Room A", description: "Desc A", exits: { n: "room_b" } },
      room_b: { title: "Room B", description: "Desc B", exits: { s: "room_a" } },
    },
    ...overrides,
  };
}

describe("sanitizeZone — ID remapping", () => {
  it("renames numeric room IDs and cascades to exits", () => {
    const world: WorldFile = {
      zone: "midgaard",
      startRoom: "3001",
      rooms: {
        "3001": { title: "Temple Square", description: "The center of town.", exits: { n: "3002" } },
        "3002": { title: "North Road", description: "A wide road.", exits: { s: "3001" } },
      },
    };

    const result = sanitizeZone(world);
    expect(result.rooms["room_3001"]).toBeDefined();
    expect(result.rooms["room_3002"]).toBeDefined();
    expect(result.rooms["3001"]).toBeUndefined();
    expect(result.startRoom).toBe("room_3001");

    const exits3001 = result.rooms["room_3001"]!.exits!;
    expect(exits3001.n).toBe("room_3002");
    const exits3002 = result.rooms["room_3002"]!.exits!;
    expect(exits3002.s).toBe("room_3001");
  });

  it("renames numeric mob IDs and updates room ref", () => {
    const world = makeWorld({
      mobs: {
        "100": { name: "Goblin", room: "room_a" },
      },
    });

    const result = sanitizeZone(world);
    expect(result.mobs!["mob_100"]).toBeDefined();
    expect(result.mobs!["mob_100"]!.room).toBe("room_a");
    expect(result.mobs!["100"]).toBeUndefined();
  });

  it("renames numeric item IDs and cascades to shop items + mob drops", () => {
    const world = makeWorld({
      items: {
        "200": { displayName: "Sword" },
        "201": { displayName: "Shield" },
      },
      shops: {
        armory: { name: "Armory", room: "room_a", items: ["200", "201"] },
      },
      mobs: {
        goblin: { name: "Goblin", room: "room_a", drops: [{ itemId: "200", chance: 50 }] },
      },
    });

    const result = sanitizeZone(world);
    expect(result.items!["item_200"]).toBeDefined();
    expect(result.items!["item_201"]).toBeDefined();
    expect(result.shops!["armory"]!.items).toEqual(["item_200", "item_201"]);
    expect(result.mobs!["goblin"]!.drops![0]!.itemId).toBe("item_200");
  });

  it("preserves cross-zone exit references (contain ':')", () => {
    const world = makeWorld({
      rooms: {
        room_a: { title: "A", description: "A", exits: { n: "otherzone:gate" } },
      },
    });

    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.exits!.n).toBe("otherzone:gate");
  });

  it("renames numeric quest IDs and cascades to mob.quests", () => {
    const world = makeWorld({
      mobs: { guard: { name: "Guard", room: "room_a", quests: ["10"] } },
      quests: { "10": { name: "Fetch Sword", giver: "guard", objectives: [] } },
    });

    const result = sanitizeZone(world);
    expect(result.quests!["quest_10"]).toBeDefined();
    expect(result.mobs!["guard"]!.quests).toEqual(["quest_10"]);
  });
});

// ─── sanitizeZone — invalid entity stripping ──────────────────────

describe("sanitizeZone — invalid entity stripping", () => {
  it("removes shops with non-existent room refs", () => {
    const world = makeWorld({
      shops: {
        valid_shop: { name: "Valid", room: "room_a" },
        broken_shop: { name: "Broken", room: "nonexistent" },
      },
    });

    const result = sanitizeZone(world);
    expect(result.shops!["valid_shop"]).toBeDefined();
    expect(result.shops!["broken_shop"]).toBeUndefined();
  });

  it("removes mobs with non-existent room refs", () => {
    const world = makeWorld({
      mobs: {
        good_mob: { name: "Good", room: "room_a" },
        bad_mob: { name: "Bad", room: "nonexistent" },
      },
    });

    const result = sanitizeZone(world);
    expect(result.mobs!["good_mob"]).toBeDefined();
    expect(result.mobs!["bad_mob"]).toBeUndefined();
  });

  it("removes trainers with non-existent room refs", () => {
    const world = makeWorld({
      trainers: {
        valid: { name: "Valid", class: "WARRIOR", room: "room_a" },
        broken: { name: "Broken", class: "MAGE", room: "nonexistent" },
      },
    });

    const result = sanitizeZone(world);
    expect(result.trainers!["valid"]).toBeDefined();
    expect(result.trainers!["broken"]).toBeUndefined();
  });

  it("removes gathering nodes with non-existent room refs", () => {
    const world = makeWorld({
      gatheringNodes: {
        valid: { displayName: "Ore", room: "room_a", skill: "mining", yields: [] },
        broken: { displayName: "Ore", room: "nonexistent", skill: "mining", yields: [] },
      },
    });

    const result = sanitizeZone(world);
    expect(result.gatheringNodes!["valid"]).toBeDefined();
    expect(result.gatheringNodes!["broken"]).toBeUndefined();
  });

  it("defaults blank room title/description to ID", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: { title: "", description: "" },
      },
    };

    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.title).toBe("room_a");
    expect(result.rooms["room_a"]!.description).toBe("No description.");
  });

  it("defaults blank mob name to ID", () => {
    const world = makeWorld({
      mobs: { goblin: { name: "", room: "room_a" } },
    });

    const result = sanitizeZone(world);
    expect(result.mobs!["goblin"]!.name).toBe("goblin");
  });

  it("defaults blank shop name to ID", () => {
    const world = makeWorld({
      shops: { armory: { name: "", room: "room_a" } },
    });

    const result = sanitizeZone(world);
    expect(result.shops!["armory"]!.name).toBe("armory");
  });

  it("defaults blank item displayName to ID", () => {
    const world = makeWorld({
      items: { sword: { displayName: "" } },
    });

    const result = sanitizeZone(world);
    expect(result.items!["sword"]!.displayName).toBe("sword");
  });

  it("clears invalid optional room ref on items", () => {
    const world = makeWorld({
      items: { sword: { displayName: "Sword", room: "nonexistent" } },
    });

    const result = sanitizeZone(world);
    expect(result.items!["sword"]!.room).toBeUndefined();
  });
});

// ─── sanitizeZone — dangling reference cleanup ────────────────────

describe("sanitizeZone — dangling reference cleanup", () => {
  it("strips exits to non-existent local rooms", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: { title: "A", description: "A", exits: { n: "nonexistent", s: "room_b" } },
        room_b: { title: "B", description: "B" },
      },
    };

    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.exits).toEqual({ s: "room_b" });
  });

  it("strips non-existent items from shop inventories", () => {
    const world = makeWorld({
      items: { sword: { displayName: "Sword" } },
      shops: {
        armory: { name: "Armory", room: "room_a", items: ["sword", "nonexistent"] },
      },
    });

    const result = sanitizeZone(world);
    expect(result.shops!["armory"]!.items).toEqual(["sword"]);
  });

  it("strips non-existent items from mob drops", () => {
    const world = makeWorld({
      items: { gold: { displayName: "Gold" } },
      mobs: {
        goblin: {
          name: "Goblin",
          room: "room_a",
          drops: [
            { itemId: "gold", chance: 0.5 },
            { itemId: "nonexistent", chance: 0.3 },
          ],
        },
      },
    });

    const result = sanitizeZone(world);
    expect(result.mobs!["goblin"]!.drops).toEqual([{ itemId: "gold", chance: 0.5 }]);
  });

  it("strips non-existent quests from mob.quests", () => {
    const world = makeWorld({
      quests: { fetch: { name: "Fetch", giver: "guard", objectives: [] } },
      mobs: {
        guard: { name: "Guard", room: "room_a", quests: ["fetch", "nonexistent"] },
      },
    });

    const result = sanitizeZone(world);
    expect(result.mobs!["guard"]!.quests).toEqual(["fetch"]);
  });

  it("clears quest giver when mob doesn't exist", () => {
    const world = makeWorld({
      quests: { fetch: { name: "Fetch", giver: "nonexistent_mob", objectives: [] } },
    });

    const result = sanitizeZone(world);
    expect(result.quests!["fetch"]!.giver).toBe("");
  });

  it("strips recipes with non-existent output item", () => {
    const world = makeWorld({
      items: { ingot: { displayName: "Ingot" } },
      recipes: {
        good_recipe: {
          displayName: "Smelt",
          skill: "smithing",
          outputItemId: "ingot",
          materials: [{ itemId: "ingot", quantity: 2 }],
        },
        bad_recipe: {
          displayName: "Bad",
          skill: "smithing",
          outputItemId: "nonexistent",
          materials: [{ itemId: "ingot", quantity: 1 }],
        },
      },
    });

    const result = sanitizeZone(world);
    expect(result.recipes!["good_recipe"]).toBeDefined();
    expect(result.recipes!["bad_recipe"]).toBeUndefined();
  });

  it("clears door key when item doesn't exist", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          exits: {
            n: { to: "room_b", door: { locked: true, key: "nonexistent" } },
          },
        },
        room_b: { title: "B", description: "B" },
      },
    };

    const result = sanitizeZone(world);
    const exit = result.rooms["room_a"]!.exits!.n as { to: string; door: { key?: string } };
    expect(exit.to).toBe("room_b");
    expect(exit.door.key).toBeUndefined();
  });
});

// ─── sanitizeZone — output cleanup ────────────────────────────────

describe("sanitizeZone — output cleanup", () => {
  it("omits empty optional collections", () => {
    const world = makeWorld({
      mobs: {},
      items: {},
      shops: {},
      trainers: {},
      quests: {},
      gatheringNodes: {},
      recipes: {},
    });

    const result = sanitizeZone(world);
    expect(result.mobs).toBeUndefined();
    expect(result.items).toBeUndefined();
    expect(result.shops).toBeUndefined();
    expect(result.trainers).toBeUndefined();
    expect(result.quests).toBeUndefined();
    expect(result.gatheringNodes).toBeUndefined();
    expect(result.recipes).toBeUndefined();
  });

  it("strips zero-value stats from items", () => {
    const world = makeWorld({
      items: {
        sword: {
          displayName: "Sword",
          stats: { strength: 5, dexterity: 0, constitution: 0, intelligence: 3 },
        },
      },
    });

    const result = sanitizeZone(world);
    expect(result.items!["sword"]!.stats).toEqual({ strength: 5, intelligence: 3 });
  });

  it("omits stats entirely when all are zero", () => {
    const world = makeWorld({
      items: {
        sword: { displayName: "Sword", stats: { strength: 0, dexterity: 0 } },
      },
    });

    const result = sanitizeZone(world);
    expect(result.items!["sword"]!.stats).toBeUndefined();
  });

  it("falls back startRoom to first room when invalid", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "nonexistent",
      rooms: {
        actual_room: { title: "Room", description: "Room" },
      },
    };

    const result = sanitizeZone(world);
    expect(result.startRoom).toBe("actual_room");
  });

  it("sanitizes zone name (numeric)", () => {
    const world: WorldFile = {
      zone: "123",
      startRoom: "room_a",
      rooms: { room_a: { title: "A", description: "A" } },
    };

    const result = sanitizeZone(world);
    expect(result.zone).toBe("zone_123");
  });

  it("canonicalizes legacy door fields on output", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          exits: {
            n: { to: "room_b", door: { locked: true, key: "iron_key" } },
          },
        },
        room_b: { title: "B", description: "B" },
      },
      items: {
        iron_key: { displayName: "Iron Key" },
      },
    };

    const result = sanitizeZone(world);
    const exit = result.rooms.room_a.exits!.n as { door: Record<string, unknown> };
    expect(exit.door).toEqual({ initialState: "locked", keyItemId: "iron_key" });
  });

  it("strips legacy room audio field on output", () => {
    const result = sanitizeZone(makeWorld({
      rooms: {
        room_a: { title: "A", description: "A", audio: "legacy.ogg" },
        room_b: { title: "B", description: "B" },
      },
    }));
    expect(result.rooms.room_a.audio).toBeUndefined();
  });

  it("writes single-class and multi-class trainers in minimal schema", () => {
    const result = sanitizeZone(makeWorld({
      trainers: {
        warrior_trainer: { name: "Trainer", class: "WARRIOR", classes: ["WARRIOR"], room: "room_a" },
        academy_master: { name: "Master", class: "WARRIOR", classes: ["WARRIOR", "ROGUE"], room: "room_b" },
      },
    }));
    expect(result.trainers!.warrior_trainer).toMatchObject({ class: "WARRIOR", classes: undefined });
    expect(result.trainers!.academy_master).toMatchObject({ class: undefined, classes: ["WARRIOR", "ROGUE"] });
  });
});

// ─── sanitizeZone — complex end-to-end scenario ──────────────────

describe("sanitizeZone — end-to-end", () => {
  it("handles a ROM-converted zone with multiple issues", () => {
    const world: WorldFile = {
      zone: "midgaard",
      startRoom: "3001",
      rooms: {
        "3001": {
          title: "Temple Square",
          description: "The center of Midgaard.",
          exits: { n: "3002", s: "3003", e: "9999" },
        },
        "3002": {
          title: "North Road",
          description: "A road heading north.",
          exits: { s: "3001" },
        },
        "3003": {
          title: "South Gate",
          description: "The southern gate.",
          exits: { n: "3001", s: "wilderness:entrance" },
        },
      },
      mobs: {
        "100": { name: "City Guard", room: "3001", quests: ["500"] },
        "101": { name: "Lost Traveler", room: "9999" },
      },
      items: {
        "200": { displayName: "Iron Sword", stats: { strength: 3, dexterity: 0 } },
        "201": { displayName: "Wooden Shield" },
      },
      shops: {
        "300": { name: "Blacksmith", room: "3001", items: ["200", "201", "999"] },
        "301": { name: "", room: "9999" },
      },
      quests: {
        "500": { name: "Patrol Duty", giver: "100", objectives: [] },
      },
    };

    const result = sanitizeZone(world);

    // IDs are sanitized
    expect(result.rooms["room_3001"]).toBeDefined();
    expect(result.rooms["room_3002"]).toBeDefined();
    expect(result.rooms["room_3003"]).toBeDefined();
    expect(result.startRoom).toBe("room_3001");

    // Exits updated + dangling exit to 9999 stripped
    expect(result.rooms["room_3001"]!.exits!.n).toBe("room_3002");
    expect(result.rooms["room_3001"]!.exits!.s).toBe("room_3003");
    expect(result.rooms["room_3001"]!.exits!.e).toBeUndefined();

    // Cross-zone exit preserved
    expect(result.rooms["room_3003"]!.exits!.s).toBe("wilderness:entrance");

    // Mob with valid room kept, mob with invalid room stripped
    expect(result.mobs!["mob_100"]).toBeDefined();
    expect(result.mobs!["mob_100"]!.room).toBe("room_3001");
    expect(result.mobs!["mob_101"]).toBeUndefined();

    // Quest ID remapped, mob.quests updated
    expect(result.quests!["quest_500"]).toBeDefined();
    expect(result.quests!["quest_500"]!.giver).toBe("mob_100");
    expect(result.mobs!["mob_100"]!.quests).toEqual(["quest_500"]);

    // Items remapped, zero stats stripped
    expect(result.items!["item_200"]!.stats).toEqual({ strength: 3 });
    expect(result.items!["item_201"]).toBeDefined();

    // Valid shop kept, non-existent item stripped, broken shop removed
    expect(result.shops!["shop_300"]).toBeDefined();
    expect(result.shops!["shop_300"]!.items).toEqual(["item_200", "item_201"]);
    expect(result.shops!["shop_301"]).toBeUndefined();
  });
});
