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
  setExitDoor,
  removeExitDoor,
  addFeature,
  updateFeature,
  removeFeature,
  renameFeature,
  reorderFeatures,
  defaultFeature,
  generateFeatureId,
  addPuzzle,
  updatePuzzle,
  deletePuzzle,
  defaultPuzzle,
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

describe("updateMob — dialogue", () => {
  it("sets dialogue on a mob", () => {
    const world = makeWorld();
    const next = updateMob(world, "rat", {
      dialogue: {
        root: {
          text: "Hello!",
          choices: [{ text: "Hi", next: "greeting" }],
        },
        greeting: { text: "Nice day." },
      },
    });
    expect(Object.keys(next.mobs!.rat.dialogue!)).toEqual([
      "root",
      "greeting",
    ]);
    expect(next.mobs!.rat.dialogue!.root.choices).toHaveLength(1);
  });

  it("clears dialogue when set to undefined", () => {
    let world = makeWorld();
    world = updateMob(world, "rat", {
      dialogue: { root: { text: "Hi" } },
    });
    expect(world.mobs!.rat.dialogue).toBeDefined();
    world = updateMob(world, "rat", { dialogue: undefined });
    expect(world.mobs!.rat.dialogue).toBeUndefined();
  });
});

describe("deleteMob", () => {
  it("removes the mob", () => {
    const world = makeWorld();
    const next = deleteMob(world, "rat");
    expect(next.mobs?.rat).toBeUndefined();
  });

  it("clears quest giver references pointing to the deleted mob", () => {
    let world = makeWorld();
    world = addQuest(world, "quest1", {
      name: "Kill Rats",
      giver: "rat",
    });
    const next = deleteMob(world, "rat");
    expect(next.quests?.quest1?.giver).toBe("");
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

  it("allows adding an item without a room", () => {
    const world = makeWorld();
    const next = addItem(world, "gem", { displayName: "Gem" });
    expect(next.items?.gem?.displayName).toBe("Gem");
  });

  it("throws if room does not exist", () => {
    const world = makeWorld();
    expect(() =>
      addItem(world, "shield", { displayName: "Shield", room: "no_room" }),
    ).toThrow("does not exist");
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

// ─── Exit doors ─────────────────────────────────────────────────────

describe("setExitDoor", () => {
  it("converts a string exit into an object form with door", () => {
    const world = makeWorld();
    const next = setExitDoor(world, "room1", "n", { initialState: "closed" });
    const exit = next.rooms.room1.exits?.n;
    expect(typeof exit).toBe("object");
    expect((exit as any).to).toBe("room2");
    expect((exit as any).door.initialState).toBe("closed");
  });

  it("merges a door patch with existing door fields", () => {
    let world = makeWorld();
    world = setExitDoor(world, "room1", "n", {
      initialState: "locked",
      keyItemId: "sword",
    });
    world = setExitDoor(world, "room1", "n", { keyConsumed: true });
    const exit = world.rooms.room1.exits?.n as any;
    expect(exit.door.initialState).toBe("locked");
    expect(exit.door.keyItemId).toBe("sword");
    expect(exit.door.keyConsumed).toBe(true);
  });

  it("throws when the exit does not exist", () => {
    const world = makeWorld();
    expect(() => setExitDoor(world, "room1", "w", { initialState: "closed" })).toThrow(
      "does not exist",
    );
  });
});

describe("removeExitDoor", () => {
  it("collapses the object form back to the shorthand string", () => {
    let world = makeWorld();
    world = setExitDoor(world, "room1", "n", { initialState: "locked", keyItemId: "sword" });
    world = removeExitDoor(world, "room1", "n");
    expect(world.rooms.room1.exits?.n).toBe("room2");
  });

  it("is a no-op on shorthand exits", () => {
    const world = makeWorld();
    const next = removeExitDoor(world, "room1", "n");
    expect(next.rooms.room1.exits?.n).toBe("room2");
  });
});

// ─── Room features ──────────────────────────────────────────────────

describe("addFeature", () => {
  it("adds a feature to a room that had none", () => {
    const world = makeWorld();
    const next = addFeature(world, "room1", "vault_lever", defaultFeature("LEVER", "vault_lever"));
    expect(next.rooms.room1.features?.vault_lever?.type).toBe("LEVER");
    expect(next.rooms.room1.features?.vault_lever?.initialState).toBe("up");
  });

  it("throws when the feature ID is already in use", () => {
    let world = makeWorld();
    world = addFeature(world, "room1", "vault_lever", defaultFeature("LEVER", "vault_lever"));
    expect(() =>
      addFeature(world, "room1", "vault_lever", defaultFeature("LEVER", "vault_lever")),
    ).toThrow("already exists");
  });

  it("strips type-inappropriate fields on add", () => {
    const world = makeWorld();
    const next = addFeature(world, "room1", "sign1", {
      type: "SIGN",
      displayName: "a weathered sign",
      keyword: "sign",
      text: "Beware the deep.",
      items: ["sword"], // Not valid for SIGN
      initialState: "closed", // Not valid for SIGN
    });
    const f = next.rooms.room1.features?.sign1;
    expect(f?.text).toBe("Beware the deep.");
    expect(f?.items).toBeUndefined();
    expect(f?.initialState).toBeUndefined();
  });
});

describe("updateFeature", () => {
  it("patches feature fields and preserves type cleanliness", () => {
    let world = makeWorld();
    world = addFeature(world, "room1", "chest", defaultFeature("CONTAINER", "chest"));
    world = updateFeature(world, "room1", "chest", { items: ["sword"], keyItemId: "sword" });
    const f = world.rooms.room1.features?.chest;
    expect(f?.items).toEqual(["sword"]);
    expect(f?.keyItemId).toBe("sword");
  });
});

describe("removeFeature", () => {
  it("removes the feature and clears the features map when empty", () => {
    let world = makeWorld();
    world = addFeature(world, "room1", "lever", defaultFeature("LEVER", "lever"));
    world = removeFeature(world, "room1", "lever");
    expect(world.rooms.room1.features).toBeUndefined();
  });
});

describe("renameFeature", () => {
  it("renames preserving the feature's value and ordering", () => {
    let world = makeWorld();
    world = addFeature(world, "room1", "a", defaultFeature("LEVER", "a"));
    world = addFeature(world, "room1", "b", defaultFeature("LEVER", "b"));
    world = addFeature(world, "room1", "c", defaultFeature("LEVER", "c"));
    world = renameFeature(world, "room1", "b", "middle");
    const keys = Object.keys(world.rooms.room1.features!);
    expect(keys).toEqual(["a", "middle", "c"]);
  });

  it("throws if the new ID collides", () => {
    let world = makeWorld();
    world = addFeature(world, "room1", "a", defaultFeature("LEVER", "a"));
    world = addFeature(world, "room1", "b", defaultFeature("LEVER", "b"));
    expect(() => renameFeature(world, "room1", "a", "b")).toThrow("already exists");
  });
});

describe("reorderFeatures", () => {
  it("reorders the features map to match the supplied order", () => {
    let world = makeWorld();
    world = addFeature(world, "room1", "a", defaultFeature("LEVER", "a"));
    world = addFeature(world, "room1", "b", defaultFeature("LEVER", "b"));
    world = addFeature(world, "room1", "c", defaultFeature("LEVER", "c"));
    world = reorderFeatures(world, "room1", ["c", "a", "b"]);
    expect(Object.keys(world.rooms.room1.features!)).toEqual(["c", "a", "b"]);
  });
});

describe("generateFeatureId", () => {
  it("picks a unique key per feature type", () => {
    let world = makeWorld();
    const first = generateFeatureId(world, "room1", "LEVER");
    world = addFeature(world, "room1", first, defaultFeature("LEVER", first));
    const second = generateFeatureId(world, "room1", "LEVER");
    expect(second).not.toBe(first);
  });
});

// ─── Puzzles ────────────────────────────────────────────────────────

describe("addPuzzle", () => {
  it("adds a riddle puzzle to an empty puzzles map", () => {
    const world = makeWorld();
    const next = addPuzzle(world, "riddle1", defaultPuzzle("room1", "riddle"));
    expect(next.puzzles?.riddle1?.type).toBe("riddle");
    expect(next.puzzles?.riddle1?.roomId).toBe("room1");
  });

  it("adds a sequence puzzle with empty steps", () => {
    const world = makeWorld();
    const next = addPuzzle(world, "seq1", defaultPuzzle("room1", "sequence"));
    expect(next.puzzles?.seq1?.type).toBe("sequence");
    expect(next.puzzles?.seq1?.steps).toEqual([]);
  });

  it("throws when the puzzle's room does not exist", () => {
    const world = makeWorld();
    expect(() => addPuzzle(world, "oops", defaultPuzzle("missing_room", "riddle"))).toThrow(
      "does not exist",
    );
  });

  it("throws on duplicate puzzle IDs", () => {
    let world = makeWorld();
    world = addPuzzle(world, "p1", defaultPuzzle("room1", "riddle"));
    expect(() => addPuzzle(world, "p1", defaultPuzzle("room1", "riddle"))).toThrow("already exists");
  });
});

describe("updatePuzzle", () => {
  it("patches puzzle fields", () => {
    let world = makeWorld();
    world = addPuzzle(world, "p1", defaultPuzzle("room1", "riddle"));
    world = updatePuzzle(world, "p1", { question: "What has keys but cannot open locks?" });
    expect(world.puzzles?.p1?.question).toBe("What has keys but cannot open locks?");
  });
});

describe("deletePuzzle", () => {
  it("removes a puzzle by ID", () => {
    let world = makeWorld();
    world = addPuzzle(world, "p1", defaultPuzzle("room1", "riddle"));
    world = deletePuzzle(world, "p1");
    expect(world.puzzles?.p1).toBeUndefined();
  });
});

describe("deleteRoom cascades to puzzles", () => {
  it("removes puzzles whose roomId matches the deleted room", () => {
    let world = makeWorld();
    world = addPuzzle(world, "p1", defaultPuzzle("room2", "riddle"));
    world = deleteRoom(world, "room2");
    expect(world.puzzles?.p1).toBeUndefined();
  });
});
