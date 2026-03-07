import { describe, it, expect } from "vitest";
import {
  addRoom,
  deleteRoom,
  updateRoom,
  addExit,
  deleteExit,
  generateRoomId,
  addMob,
  updateMob,
  deleteMob,
  addItem,
  updateItem,
  deleteItem,
  addShop,
  updateShop,
  deleteShop,
  addQuest,
  updateQuest,
  deleteQuest,
  addGatheringNode,
  updateGatheringNode,
  deleteGatheringNode,
  addRecipe,
  updateRecipe,
  deleteRecipe,
  generateEntityId,
} from "../zoneEdits";
import type { WorldFile } from "@/types/world";

function makeWorld(): WorldFile {
  return {
    zone: "test",
    startRoom: "room1",
    rooms: {
      room1: {
        title: "Room 1",
        description: "The first room",
        exits: { n: "room2" },
      },
      room2: {
        title: "Room 2",
        description: "The second room",
        exits: { s: "room1" },
      },
    },
    mobs: {
      rat: { name: "Rat", room: "room1", level: 1 },
    },
    items: {
      sword: { displayName: "Sword", room: "room1" },
    },
    shops: {
      vendor: { name: "Vendor", room: "room2", items: ["sword"] },
    },
  };
}

describe("addRoom", () => {
  it("adds a new room to the world", () => {
    const world = makeWorld();
    const next = addRoom(world, "room3", {
      title: "Room 3",
      description: "A new room",
    });
    expect(next.rooms.room3).toBeDefined();
    expect(next.rooms.room3.title).toBe("Room 3");
    // Original is unchanged
    expect(world.rooms.room3).toBeUndefined();
  });

  it("throws if room already exists", () => {
    const world = makeWorld();
    expect(() =>
      addRoom(world, "room1", { title: "Dup", description: "" }),
    ).toThrow("already exists");
  });
});

describe("deleteRoom", () => {
  it("removes the room and cleans up exits pointing to it", () => {
    const world = makeWorld();
    const next = deleteRoom(world, "room2");
    expect(next.rooms.room2).toBeUndefined();
    // Exit from room1 to room2 should be removed
    expect(next.rooms.room1.exits?.n).toBeUndefined();
  });

  it("removes entities in the deleted room", () => {
    const world = makeWorld();
    const next = deleteRoom(world, "room2");
    expect(next.shops?.vendor).toBeUndefined();
  });

  it("throws when deleting the start room", () => {
    const world = makeWorld();
    expect(() => deleteRoom(world, "room1")).toThrow("start room");
  });

  it("does not mutate the original", () => {
    const world = makeWorld();
    deleteRoom(world, "room2");
    expect(world.rooms.room2).toBeDefined();
  });
});

describe("updateRoom", () => {
  it("patches room fields", () => {
    const world = makeWorld();
    const next = updateRoom(world, "room1", { title: "Updated" });
    expect(next.rooms.room1.title).toBe("Updated");
    expect(next.rooms.room1.description).toBe("The first room");
  });

  it("throws for non-existent room", () => {
    const world = makeWorld();
    expect(() =>
      updateRoom(world, "room99", { title: "X" }),
    ).toThrow("does not exist");
  });
});

describe("addExit", () => {
  it("adds a bidirectional exit by default", () => {
    const world = makeWorld();
    const next = addExit(world, "room1", "e", "room2");
    expect(next.rooms.room1.exits?.e).toBe("room2");
    expect(next.rooms.room2.exits?.w).toBe("room1");
  });

  it("adds a one-way exit when bidirectional=false", () => {
    const world = makeWorld();
    const next = addExit(world, "room1", "e", "room2", false);
    expect(next.rooms.room1.exits?.e).toBe("room2");
    // Room2 should not get a west exit (besides existing south)
    expect(next.rooms.room2.exits?.w).toBeUndefined();
  });

  it("throws for non-existent source", () => {
    const world = makeWorld();
    expect(() => addExit(world, "room99", "n", "room1")).toThrow(
      "Source room",
    );
  });
});

describe("deleteExit", () => {
  it("removes a bidirectional exit pair", () => {
    const world = makeWorld();
    const next = deleteExit(world, "room1", "n");
    expect(next.rooms.room1.exits?.n).toBeUndefined();
    expect(next.rooms.room2.exits?.s).toBeUndefined();
  });

  it("removes only the one-way exit when bidirectional=false", () => {
    const world = makeWorld();
    const next = deleteExit(world, "room1", "n", false);
    expect(next.rooms.room1.exits?.n).toBeUndefined();
    expect(next.rooms.room2.exits?.s).toBe("room1");
  });

  it("handles ExitValue objects with doors", () => {
    const world = makeWorld();
    // Replace the string exit with an ExitValue that has a door
    world.rooms.room1.exits = {
      n: { to: "room2", door: { locked: true, key: "iron_key" } },
    };
    world.rooms.room2.exits = { s: "room1" };
    const next = deleteExit(world, "room1", "n");
    expect(next.rooms.room1.exits?.n).toBeUndefined();
    expect(next.rooms.room2.exits?.s).toBeUndefined();
  });

  it("throws for non-existent exit", () => {
    const world = makeWorld();
    expect(() => deleteExit(world, "room1", "w")).toThrow("does not exist");
  });
});

describe("generateRoomId", () => {
  it("generates a unique ID based on zone name", () => {
    const world = makeWorld();
    const id = generateRoomId(world);
    expect(id).toMatch(/^test_room\d+$/);
    expect(world.rooms[id]).toBeUndefined();
  });
});

// ─── Mob CRUD ─────────────────────────────────────────────────────────

describe("addMob", () => {
  it("adds a mob to the world", () => {
    const world = makeWorld();
    const next = addMob(world, "goblin", { name: "Goblin", room: "room1" });
    expect(next.mobs?.goblin?.name).toBe("Goblin");
    expect(world.mobs?.goblin).toBeUndefined();
  });

  it("throws if mob already exists", () => {
    const world = makeWorld();
    expect(() =>
      addMob(world, "rat", { name: "Rat2", room: "room1" }),
    ).toThrow("already exists");
  });

  it("throws if room does not exist", () => {
    const world = makeWorld();
    expect(() =>
      addMob(world, "goblin", { name: "Goblin", room: "no_room" }),
    ).toThrow("does not exist");
  });
});

describe("updateMob", () => {
  it("patches mob fields immutably", () => {
    const world = makeWorld();
    const next = updateMob(world, "rat", { name: "Giant Rat", level: 5 });
    expect(next.mobs?.rat?.name).toBe("Giant Rat");
    expect(next.mobs?.rat?.level).toBe(5);
    expect(world.mobs?.rat?.name).toBe("Rat");
  });
});

describe("deleteMob", () => {
  it("removes the mob", () => {
    const world = makeWorld();
    const next = deleteMob(world, "rat");
    expect(next.mobs?.rat).toBeUndefined();
  });
});

// ─── Item CRUD ────────────────────────────────────────────────────────

describe("addItem", () => {
  it("adds an item to the world", () => {
    const world = makeWorld();
    const next = addItem(world, "shield", {
      displayName: "Shield",
      room: "room1",
    });
    expect(next.items?.shield?.displayName).toBe("Shield");
  });
});

describe("deleteItem", () => {
  it("removes item and cleans up shop inventories and mob drops", () => {
    const world = makeWorld();
    world.mobs!.rat.drops = [{ itemId: "sword", chance: 50 }];
    const next = deleteItem(world, "sword");
    expect(next.items?.sword).toBeUndefined();
    expect(next.shops?.vendor?.items).toEqual([]);
    expect(next.mobs?.rat?.drops).toEqual([]);
  });
});

// ─── Shop CRUD ────────────────────────────────────────────────────────

describe("addShop", () => {
  it("adds a shop", () => {
    const world = makeWorld();
    const next = addShop(world, "market", { name: "Market", room: "room1" });
    expect(next.shops?.market?.name).toBe("Market");
  });
});

describe("deleteShop", () => {
  it("removes the shop", () => {
    const world = makeWorld();
    const next = deleteShop(world, "vendor");
    expect(next.shops?.vendor).toBeUndefined();
  });
});

// ─── Quest CRUD ───────────────────────────────────────────────────────

describe("quest CRUD", () => {
  it("adds, updates, and deletes a quest", () => {
    let world = makeWorld();
    world = addQuest(world, "quest1", {
      name: "Kill Rats",
      giver: "rat",
      objectives: [{ type: "KILL", targetKey: "rat", count: 5 }],
    });
    expect(world.quests?.quest1?.name).toBe("Kill Rats");

    world = updateQuest(world, "quest1", { name: "Kill More Rats" });
    expect(world.quests?.quest1?.name).toBe("Kill More Rats");

    // Assign quest to mob
    world = updateMob(world, "rat", { quests: ["quest1"] });

    // Delete quest should clean up mob references
    world = deleteQuest(world, "quest1");
    expect(world.quests?.quest1).toBeUndefined();
    expect(world.mobs?.rat?.quests).toEqual([]);
  });
});

// ─── GatheringNode CRUD ─────────────────────────────────────────────

describe("gathering node CRUD", () => {
  it("adds and deletes a gathering node", () => {
    let world = makeWorld();
    world = addGatheringNode(world, "ore1", {
      displayName: "Iron Ore",
      keyword: "ore",
      skill: "MINING",
      yields: [{ itemId: "iron_ore" }],
      room: "room1",
    });
    expect(world.gatheringNodes?.ore1?.displayName).toBe("Iron Ore");

    world = deleteGatheringNode(world, "ore1");
    expect(world.gatheringNodes?.ore1).toBeUndefined();
  });

  it("throws if room does not exist", () => {
    const world = makeWorld();
    expect(() =>
      addGatheringNode(world, "ore1", {
        displayName: "Ore",
        keyword: "ore",
        skill: "MINING",
        yields: [],
        room: "no_room",
      }),
    ).toThrow("does not exist");
  });
});

// ─── Recipe CRUD ────────────────────────────────────────────────────

describe("recipe CRUD", () => {
  it("adds, updates, and deletes a recipe", () => {
    let world = makeWorld();
    world = addRecipe(world, "recipe1", {
      displayName: "Iron Sword",
      skill: "SMITHING",
      materials: [{ itemId: "iron_ore", quantity: 3 }],
      outputItemId: "sword",
    });
    expect(world.recipes?.recipe1?.displayName).toBe("Iron Sword");

    world = updateRecipe(world, "recipe1", { xpReward: 50 });
    expect(world.recipes?.recipe1?.xpReward).toBe(50);

    world = deleteRecipe(world, "recipe1");
    expect(world.recipes?.recipe1).toBeUndefined();
  });
});

// ─── generateEntityId ────────────────────────────────────────────────

describe("generateEntityId", () => {
  it("generates unique IDs for each collection", () => {
    const world = makeWorld();
    expect(generateEntityId(world, "mobs")).toMatch(/^test_mob\d+$/);
    expect(generateEntityId(world, "items")).toMatch(/^test_item\d+$/);
    expect(generateEntityId(world, "shops")).toMatch(/^test_shop\d+$/);
    expect(generateEntityId(world, "quests")).toMatch(/^test_quest\d+$/);
    expect(generateEntityId(world, "gatheringNodes")).toMatch(/^test_node\d+$/);
    expect(generateEntityId(world, "recipes")).toMatch(/^test_recipe\d+$/);
  });
});
