import { describe, it, expect } from "vitest";
import { parseDocument, stringify } from "yaml";
import { sanitizeZone, sanitizeId, buildIdRemap } from "../sanitizeZone";
import type { ExitValue, ItemFile, WorldFile } from "@/types/world";

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

  it("renames numeric mob IDs and updates spawn room ref", () => {
    const world = makeWorld({
      mobs: {
        "100": { name: "Goblin", spawns: [{ room: "room_a" }] },
      },
    });

    const result = sanitizeZone(world);
    expect(result.mobs!["mob_100"]).toBeDefined();
    expect(result.mobs!["mob_100"]!.spawns).toEqual([{ room: "room_a" }]);
    expect(result.mobs!["mob_100"]!.room).toBeUndefined();
    expect(result.mobs!["100"]).toBeUndefined();
  });

  it("preserves spawn condition and rareVariants on mobs", () => {
    const world = makeWorld({
      mobs: {
        midnight_moth: {
          name: "a luminous midnight moth",
          spawns: [{ room: "room_a" }],
          rareVariants: false,
          condition: {
            time: ["NIGHT", "DUSK"],
            seasons: ["WINTER"],
            weather: ["STORM"],
            events: ["blood_moon"],
            chance: 0.5,
          },
        },
      },
    });

    const result = sanitizeZone(world);
    const moth = result.mobs!["midnight_moth"]!;
    expect(moth.rareVariants).toBe(false);
    expect(moth.condition).toEqual({
      time: ["NIGHT", "DUSK"],
      seasons: ["WINTER"],
      weather: ["STORM"],
      events: ["blood_moon"],
      chance: 0.5,
    });
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
        goblin: { name: "Goblin", spawns: [{ room: "room_a" }], drops: [{ itemId: "200", chance: 50 }] },
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
      mobs: { guard: { name: "Guard", spawns: [{ room: "room_a" }], quests: ["10"] } },
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
        good_mob: { name: "Good", spawns: [{ room: "room_a" }] },
        bad_mob: { name: "Bad", spawns: [{ room: "nonexistent" }] },
      },
    });

    const result = sanitizeZone(world);
    expect(result.mobs!["good_mob"]).toBeDefined();
    expect(result.mobs!["bad_mob"]).toBeUndefined();
  });

  it("drops trainer synthesis for mobs whose spawn room is invalid", () => {
    // Trainer registry is synthesized from mobs at save time. Mobs whose
    // spawns all reference missing rooms get stripped first (existing rule),
    // so no `trainers:` entry should be emitted for them.
    const world = makeWorld({
      mobs: {
        valid_trainer: {
          name: "Valid",
          spawns: [{ room: "room_a" }],
          role: "trainer",
          trainerClasses: ["WARRIOR"],
        },
        broken_trainer: {
          name: "Broken",
          spawns: [{ room: "nonexistent" }],
          role: "trainer",
          trainerClasses: ["MAGE"],
        },
      },
    });

    const result = sanitizeZone(world) as WorldFile & {
      trainers?: Record<string, { name: string; class?: string; classes?: string[]; room: string }>;
    };
    expect(result.trainers!["valid_trainer"]).toBeDefined();
    expect(result.trainers!["valid_trainer"]!.room).toBe("room_a");
    expect(result.trainers!["broken_trainer"]).toBeUndefined();
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
      mobs: { goblin: { name: "", spawns: [{ room: "room_a" }] } },
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
          spawns: [{ room: "room_a" }],
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
        guard: { name: "Guard", spawns: [{ room: "room_a" }], quests: ["fetch", "nonexistent"] },
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
      quests: {},
      gatheringNodes: {},
      recipes: {},
    });

    const result = sanitizeZone(world) as WorldFile & { trainers?: unknown };
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

  it("preserves per-entity respawnSeconds on doors, features, and ground items", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          exits: {
            n: { to: "room_b", door: { initialState: "closed", respawnSeconds: 90 } },
          },
          features: {
            chest: { type: "CONTAINER", displayName: "Chest", keyword: "chest", respawnSeconds: 300, items: ["coin"] },
            lever: { type: "LEVER", displayName: "Lever", keyword: "lever", respawnSeconds: 45 },
          },
        },
        room_b: { title: "B", description: "B" },
      },
      items: { coin: { displayName: "Coin", room: "room_a", respawnSeconds: 30 } },
    };

    const result = sanitizeZone(world);
    const exit = result.rooms.room_a.exits!.n as { door: { respawnSeconds?: number } };
    expect(exit.door.respawnSeconds).toBe(90);
    expect(result.rooms.room_a.features!.chest!.respawnSeconds).toBe(300);
    expect(result.rooms.room_a.features!.lever!.respawnSeconds).toBe(45);
    expect(result.items!.coin!.respawnSeconds).toBe(30);
  });

  it("round-trips layered lever art fields", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          features: {
            lever: {
              type: "LEVER",
              displayName: "an ostentatious brass lever",
              keyword: "lever",
              initialState: "up",
              plateImage: "plate.png",
              handleImage: "handle.png",
              leverPivot: { x: 0.5, y: 0.85 },
              upAngle: -28,
              downAngle: 32,
            },
          },
        },
      },
    };

    const lever = sanitizeZone(world).rooms.room_a.features!.lever!;
    expect(lever.plateImage).toBe("plate.png");
    expect(lever.handleImage).toBe("handle.png");
    expect(lever.leverPivot).toEqual({ x: 0.5, y: 0.85 });
    expect(lever.upAngle).toBe(-28);
    expect(lever.downAngle).toBe(32);
  });

  it("preserves per-feature backgroundImage on every feature type", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          features: {
            chest: {
              type: "CONTAINER",
              displayName: "a curio chest",
              keyword: "chest",
              items: ["coin"],
              backgroundImage: "chest_bg.webp",
            },
            lever: {
              type: "LEVER",
              displayName: "a brass lever",
              keyword: "lever",
              backgroundImage: "lever_bg.webp",
            },
            sign: {
              type: "SIGN",
              displayName: "a carved sign",
              keyword: "sign",
              text: "Beware",
              backgroundImage: "sign_bg.webp",
            },
          },
        },
      },
    };

    const features = sanitizeZone(world).rooms.room_a.features!;
    expect(features.chest!.backgroundImage).toBe("chest_bg.webp");
    expect(features.lever!.backgroundImage).toBe("lever_bg.webp");
    expect(features.sign!.backgroundImage).toBe("sign_bg.webp");
  });

  it("preserves a puzzle's backgroundImage on output", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: { title: "A", description: "A" },
      },
      puzzles: {
        sphinx: {
          type: "riddle",
          roomId: "room_a",
          answer: "footsteps",
          reward: { type: "give_gold", gold: 10 },
          backgroundImage: "codex.webp",
        },
      },
    };

    const result = sanitizeZone(world) as WorldFile;
    expect(result.puzzles!.sphinx!.backgroundImage).toBe("codex.webp");
  });

  it("preserves per-door layered art fields on output", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          exits: {
            east: {
              to: "room_b",
              door: {
                initialState: "closed",
                frameImage: "frame.webp",
                leafImage: "leaf.webp",
                hinge: "right",
                openAngle: 120,
                leafScale: 0.66,
                leafOffsetY: 0.05,
              },
            },
          },
        },
        room_b: { title: "B", description: "B" },
      },
    };

    const door = (sanitizeZone(world).rooms.room_a.exits!.east as ExitValue).door!;
    expect(door.frameImage).toBe("frame.webp");
    expect(door.leafImage).toBe("leaf.webp");
    expect(door.hinge).toBe("right");
    expect(door.openAngle).toBe(120);
    expect(door.leafScale).toBe(0.66);
    expect(door.leafOffsetY).toBe(0.05);
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

  it("synthesizes single-class and multi-class trainers from mobs", () => {
    const result = sanitizeZone(makeWorld({
      mobs: {
        warrior_trainer: {
          name: "Trainer",
          spawns: [{ room: "room_a" }],
          role: "trainer",
          trainerClasses: ["WARRIOR"],
        },
        academy_master: {
          name: "Master",
          spawns: [{ room: "room_b" }],
          role: "trainer",
          trainerClasses: ["WARRIOR", "ROGUE"],
        },
      },
    })) as WorldFile & {
      trainers?: Record<string, { name: string; class?: string; classes?: string[]; room: string }>;
    };
    expect(result.trainers!.warrior_trainer).toMatchObject({
      class: "WARRIOR",
      room: "room_a",
    });
    expect(result.trainers!.warrior_trainer).not.toHaveProperty("classes");
    expect(result.trainers!.academy_master).toMatchObject({
      classes: ["WARRIOR", "ROGUE"],
      room: "room_b",
    });
    expect(result.trainers!.academy_master).not.toHaveProperty("class");
    // Mob output strips the Arcanum-only role and trainerClasses so the
    // server's MobRole parser doesn't choke on `trainer`.
    expect(result.mobs!.warrior_trainer!.role).toBeUndefined();
    expect(result.mobs!.warrior_trainer!.trainerClasses).toBeUndefined();
  });

  it("emits one trainers entry per spawn room and skips duplicates", () => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "room_a",
      rooms: {
        room_a: { title: "A", description: "A" },
        room_b: { title: "B", description: "B" },
      },
      mobs: {
        wandering_trainer: {
          name: "Wanderer",
          spawns: [{ room: "room_a" }, { room: "room_b" }],
          role: "trainer",
          trainerClasses: ["MAGE"],
        },
      },
    };
    const result = sanitizeZone(world) as WorldFile & {
      trainers?: Record<string, { room: string; class?: string }>;
    };
    const ids = Object.keys(result.trainers ?? {}).sort();
    expect(ids).toHaveLength(2);
    // First spawn keeps the mob ID; later spawns get a `__<room>` suffix to
    // stay unique without colliding with other trainer entries.
    expect(result.trainers!["wandering_trainer"]!.room).toBe("room_a");
    expect(result.trainers!["wandering_trainer__room_b"]!.room).toBe("room_b");
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
        "100": { name: "City Guard", spawns: [{ room: "3001" }], quests: ["500"] },
        "101": { name: "Lost Traveler", spawns: [{ room: "9999" }] },
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
    expect(result.mobs!["mob_100"]!.spawns).toEqual([{ room: "room_3001" }]);
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

// ─── sanitizeZone — cinematic text alternatives (videoText) ────────

describe("sanitizeZone — videoText / videoTextSeconds", () => {
  it("serializes zone-level videoText and a positive videoTextSeconds", () => {
    const world = makeWorld({
      video: "intro.mp4",
      videoText: "A hawk's-eye sweep over slate rooftops.\nThe view dives toward a quiet keep.",
      videoTextSeconds: 30,
    });

    const result = sanitizeZone(world) as WorldFile;
    expect(result.video).toBe("intro.mp4");
    expect(result.videoText).toBe(
      "A hawk's-eye sweep over slate rooftops.\nThe view dives toward a quiet keep.",
    );
    expect(result.videoTextSeconds).toBe(30);
  });

  it("preserves the block-literal text verbatim without trimming internal lines", () => {
    const world = makeWorld({ videoText: "Line one\nLine two\nLine three" });
    const result = sanitizeZone(world) as WorldFile;
    expect(result.videoText).toBe("Line one\nLine two\nLine three");
  });

  it("allows a text-only vision (videoText without video)", () => {
    const world = makeWorld({ videoText: "Glyphs flare to life, tracing a hidden door." });
    const result = sanitizeZone(world) as WorldFile;
    expect(result.video).toBeUndefined();
    expect(result.videoText).toBe("Glyphs flare to life, tracing a hidden door.");
  });

  it("drops blank videoText and non-positive videoTextSeconds", () => {
    const world = makeWorld({ videoText: "   ", videoTextSeconds: 0 });
    const result = sanitizeZone(world) as WorldFile;
    expect(result.videoText).toBeUndefined();
    expect(result.videoTextSeconds).toBeUndefined();
  });

  it("carries room, mob, and item videoText through serialization", () => {
    const world = makeWorld({
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          video: "glyphs.mp4",
          videoText: "Glyphs along the wall flare to life.",
          videoTextSeconds: 10,
        },
      },
      mobs: {
        seer: {
          name: "Seer",
          spawns: [{ room: "room_a" }],
          videoText: "The seer's eyes cloud with prophecy.",
        },
      },
      items: {
        orb: { displayName: "Orb", videoText: "The orb pulses with trapped light." },
      },
    });

    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.videoText).toBe("Glyphs along the wall flare to life.");
    expect(result.rooms["room_a"]!.videoTextSeconds).toBe(10);
    expect(result.mobs!["seer"]!.videoText).toBe("The seer's eyes cloud with prophecy.");
    expect(result.items!["orb"]!.videoText).toBe("The orb pulses with trapped light.");
  });
});

describe("sanitizeZone — room jukebox", () => {
  it("rebuilds songs in contract key order with empty optionals omitted", () => {
    const world = makeWorld({
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          jukebox: [
            {
              durationSeconds: 96.4,
              lyrics: ["  When the lanterns lean in low,  ", "", "the teacups start to sway."],
              description: "A waltz that remembers being hummed.",
              artist: "The Wandering Bards",
              cost: 5.4,
              file: "song.mp3",
              title: "The Borrowed Song",
            },
            { file: "plain.mp3", title: "", artist: " ", description: "  ", lyrics: [], durationSeconds: 0, cost: -1 },
          ],
        },
      },
    });

    const result = sanitizeZone(world);
    const songs = result.rooms["room_a"]!.jukebox!;
    expect(Object.keys(songs[0]!)).toEqual([
      "title", "file", "durationSeconds", "cost", "artist", "description", "lyrics",
    ]);
    expect(songs[0]).toEqual({
      title: "The Borrowed Song",
      file: "song.mp3",
      durationSeconds: 96,
      cost: 5,
      artist: "The Wandering Bards",
      description: "A waltz that remembers being hummed.",
      lyrics: ["When the lanterns lean in low,", "the teacups start to sway."],
    });
    expect(songs[1]).toEqual({ file: "plain.mp3" });
    expect(Object.keys(songs[1]!)).toEqual(["file"]);
  });

  it("keeps a zero cost — free songs are valid", () => {
    const world = makeWorld({
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          jukebox: [{ title: "Free Tune", file: "free.mp3", durationSeconds: 20, cost: 0 }],
        },
      },
    });

    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.jukebox![0]!.cost).toBe(0);
  });

  it("drops blank-file songs and removes the jukebox when none survive", () => {
    const world = makeWorld({
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          jukebox: [{ file: "" }, { file: "   ", title: "Ghost" }],
        },
        room_b: {
          title: "B",
          description: "B",
          jukebox: [{ file: "" }, { file: "keeper.mp3" }],
        },
      },
    });

    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.jukebox).toBeUndefined();
    expect(result.rooms["room_b"]!.jukebox).toEqual([{ file: "keeper.mp3" }]);
  });

  it("leaves rooms without a jukebox alone", () => {
    const world = makeWorld();
    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.jukebox).toBeUndefined();
  });
});

describe("sanitizeZone — room music box", () => {
  it("rebuilds the box in contract key order with empty optionals omitted and no cost", () => {
    const world = makeWorld({
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          musicBox: {
            durationSeconds: 60.6,
            lyrics: ["  Down where the lantern-light is low  ", "", "the scuttlefish sings soft and slow"],
            description: "A soft tune.",
            artist: "Scuttlefish",
            // A stray cost must not survive — the music box is always free.
            cost: 5,
            file: "lullaby.mp3",
            title: "Scuttlefish's Lullaby",
          } as never,
        },
      },
    });

    const result = sanitizeZone(world);
    const box = result.rooms["room_a"]!.musicBox!;
    expect(Object.keys(box)).toEqual([
      "title", "file", "durationSeconds", "artist", "description", "lyrics",
    ]);
    expect(box).toEqual({
      title: "Scuttlefish's Lullaby",
      file: "lullaby.mp3",
      durationSeconds: 61,
      artist: "Scuttlefish",
      description: "A soft tune.",
      lyrics: ["Down where the lantern-light is low", "the scuttlefish sings soft and slow"],
    });
  });

  it("serializes the keepsake image between description and lyrics, omitting a blank one", () => {
    const world = makeWorld({
      rooms: {
        room_a: {
          title: "A",
          description: "A",
          musicBox: {
            file: "lullaby.mp3",
            title: "Scuttlefish's Lullaby",
            description: "A soft tune.",
            image: "items/lyric-sheet-lullaby.png",
            lyrics: ["the scuttlefish sings soft and slow"],
          },
        },
        room_b: {
          title: "B",
          description: "B",
          musicBox: { file: "keeper.mp3", image: "   " },
        },
      },
    });

    const result = sanitizeZone(world);
    const boxA = result.rooms["room_a"]!.musicBox!;
    expect(Object.keys(boxA)).toEqual([
      "title", "file", "description", "image", "lyrics",
    ]);
    expect(boxA.image).toBe("items/lyric-sheet-lullaby.png");
    // A blank image is dropped, never serialized as an empty key.
    expect(result.rooms["room_b"]!.musicBox).toEqual({ file: "keeper.mp3" });
  });

  it("drops a blank-file music box entirely", () => {
    const world = makeWorld({
      rooms: {
        room_a: { title: "A", description: "A", musicBox: { file: "   ", title: "Ghost" } },
        room_b: { title: "B", description: "B", musicBox: { file: "keeper.mp3" } },
      },
    });

    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.musicBox).toBeUndefined();
    expect(result.rooms["room_b"]!.musicBox).toEqual({ file: "keeper.mp3" });
  });

  it("leaves rooms without a music box alone", () => {
    const world = makeWorld();
    const result = sanitizeZone(world);
    expect(result.rooms["room_a"]!.musicBox).toBeUndefined();
  });
});

describe("sanitizeZone — keepsake items", () => {
  // Keepsakes bind via itemType alone server-side (Item.isBound = questItem ||
  // itemType == KEEPSAKE), so a real keepsake carries no questItem flag.
  it("round-trips a keepsake item through YAML with its type and multi-line lyrics", () => {
    const world = makeWorld({
      items: {
        lyric_sheet: {
          displayName: "a lyric sheet for \"The Word of Ambon\"",
          description: "\"The Word of Ambon\"\n\nWhen the lanterns lean in low,\nthe teacups start to sway.",
          itemType: "keepsake",
          basePrice: 0,
        },
      },
    });

    const sanitized = sanitizeZone(world);
    const reparsed = parseDocument(stringify(sanitized)).toJS() as WorldFile;
    const item = reparsed.items!["lyric_sheet"] as ItemFile;

    expect(item.itemType).toBe("keepsake");
    expect(item.description).toContain("\n");
  });
});

// ─── sanitizeZone — flight map pins ───────────────────────────────

describe("sanitizeZone — flight map pins", () => {
  it("preserves valid flight-map coordinates on a flight master", () => {
    const world = makeWorld({
      rooms: {
        roost: { title: "Roost", description: "A roost", flightMaster: true, flightMapX: 42, flightMapY: 63.5 },
      },
      startRoom: "roost",
    });
    const result = sanitizeZone(world);
    expect(result.rooms["roost"]!.flightMapX).toBe(42);
    expect(result.rooms["roost"]!.flightMapY).toBe(63.5);
  });

  it("clamps out-of-range coordinates to 0..100", () => {
    const world = makeWorld({
      rooms: {
        roost: { title: "Roost", description: "A roost", flightMaster: true, flightMapX: -10, flightMapY: 250 },
      },
      startRoom: "roost",
    });
    const result = sanitizeZone(world);
    expect(result.rooms["roost"]!.flightMapX).toBe(0);
    expect(result.rooms["roost"]!.flightMapY).toBe(100);
  });

  it("rounds coordinates to one decimal place", () => {
    const world = makeWorld({
      rooms: {
        roost: { title: "Roost", description: "A roost", flightMaster: true, flightMapX: 33.333, flightMapY: 66.666 },
      },
      startRoom: "roost",
    });
    const result = sanitizeZone(world);
    expect(result.rooms["roost"]!.flightMapX).toBe(33.3);
    expect(result.rooms["roost"]!.flightMapY).toBe(66.7);
  });

  it("drops orphaned coordinates when the room is not a flight master", () => {
    const world = makeWorld({
      rooms: {
        roost: { title: "Roost", description: "A roost", flightMapX: 42, flightMapY: 63 },
      },
      startRoom: "roost",
    });
    const result = sanitizeZone(world);
    expect(result.rooms["roost"]!.flightMapX).toBeUndefined();
    expect(result.rooms["roost"]!.flightMapY).toBeUndefined();
  });
});

// ─── sanitizeZone — boat docks ────────────────────────────────────

describe("sanitizeZone — boat docks", () => {
  it("preserves coordinates and routes on a boat dock, clamping coords", () => {
    const world = makeWorld({
      rooms: {
        harbor: {
          title: "Harbor",
          description: "A harbor",
          boatDock: true,
          boatMapX: 33.333,
          boatMapY: 250,
          boatRoutes: [{ to: "harbor2", price: 150 }],
        },
        harbor2: { title: "Harbor Two", description: "Another harbor", boatDock: true },
      },
      startRoom: "harbor",
    });
    const result = sanitizeZone(world);
    expect(result.rooms["harbor"]!.boatMapX).toBe(33.3);
    expect(result.rooms["harbor"]!.boatMapY).toBe(100);
    expect(result.rooms["harbor"]!.boatRoutes).toEqual([{ to: "harbor2", price: 150 }]);
  });

  it("drops orphaned coordinates and routes when the room is not a boat dock", () => {
    const world = makeWorld({
      rooms: {
        harbor: {
          title: "Harbor",
          description: "A harbor",
          boatMapX: 42,
          boatMapY: 63,
          boatRoutes: [{ to: "harbor2", price: 100 }],
        },
        harbor2: { title: "Harbor Two", description: "Another harbor" },
      },
      startRoom: "harbor",
    });
    const result = sanitizeZone(world);
    expect(result.rooms["harbor"]!.boatMapX).toBeUndefined();
    expect(result.rooms["harbor"]!.boatMapY).toBeUndefined();
    expect(result.rooms["harbor"]!.boatRoutes).toBeUndefined();
  });

  it("drops empty-destination routes and floors negative fares", () => {
    const world = makeWorld({
      rooms: {
        harbor: {
          title: "Harbor",
          description: "A harbor",
          boatDock: true,
          boatRoutes: [
            { to: "  ", price: 50 },
            { to: "harbor2", price: -5 },
          ],
        },
        harbor2: { title: "Harbor Two", description: "Another harbor", boatDock: true },
      },
      startRoom: "harbor",
    });
    const result = sanitizeZone(world);
    expect(result.rooms["harbor"]!.boatRoutes).toEqual([{ to: "harbor2", price: 0 }]);
  });
});
