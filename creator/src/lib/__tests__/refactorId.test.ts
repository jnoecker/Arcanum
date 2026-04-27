import { describe, it, expect } from "vitest";
import { renameRoom, renameMob, renameItem, renameQuest, countReferences } from "../refactorId";
import type { WorldFile } from "@/types/world";

function makeWorld(overrides?: Partial<WorldFile>): WorldFile {
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
      rat: { name: "Rat", spawns: [{ room: "room1" }] },
    },
    items: {
      sword: { displayName: "Sword", room: "room1" },
    },
    shops: {
      vendor: { name: "Vendor", room: "room2", items: ["sword"] },
    },
    quests: {
      fetch: { name: "Fetch", giver: "rat", objectives: [] },
    },
    ...overrides,
  };
}

describe("renameRoom", () => {
  it("renames a room key and updates all references", () => {
    const world = makeWorld();
    const result = renameRoom(world, "room1", "tavern");

    expect(result.rooms["tavern"]).toBeDefined();
    expect(result.rooms["room1"]).toBeUndefined();
    expect(result.startRoom).toBe("tavern");
    expect(result.rooms["room2"]!.exits!["s"]).toBe("tavern");
    expect(result.mobs!["rat"]!.spawns).toEqual([{ room: "tavern" }]);
    expect(result.items!["sword"]!.room).toBe("tavern");
  });

  it("updates patrol route references", () => {
    const world = makeWorld({
      mobs: {
        guard: {
          name: "Guard",
          spawns: [{ room: "room1" }],
          behavior: {
            template: "patrol",
            params: { patrolRoute: ["room1", "room2", "room1"] },
          },
        },
      },
    });
    const result = renameRoom(world, "room1", "hall");
    expect(result.mobs!["guard"]!.behavior!.params!.patrolRoute).toEqual([
      "hall", "room2", "hall",
    ]);
  });

  it("returns unchanged world if IDs are the same", () => {
    const world = makeWorld();
    expect(renameRoom(world, "room1", "room1")).toBe(world);
  });
});

describe("renameMob", () => {
  it("renames a mob key and updates quest giver", () => {
    const world = makeWorld();
    const result = renameMob(world, "rat", "giant_rat");

    expect(result.mobs!["giant_rat"]).toBeDefined();
    expect(result.mobs!["rat"]).toBeUndefined();
    expect(result.quests!["fetch"]!.giver).toBe("giant_rat");
  });
});

describe("renameItem", () => {
  it("renames an item key and updates shop inventory", () => {
    const world = makeWorld();
    const result = renameItem(world, "sword", "iron_sword");

    expect(result.items!["iron_sword"]).toBeDefined();
    expect(result.items!["sword"]).toBeUndefined();
    expect(result.shops!["vendor"]!.items).toEqual(["iron_sword"]);
  });

  it("updates mob drops", () => {
    const world = makeWorld({
      mobs: {
        rat: {
          name: "Rat",
          spawns: [{ room: "room1" }],
          drops: [{ itemId: "sword", chance: 50 }],
        },
      },
    });
    const result = renameItem(world, "sword", "rusty_sword");
    expect(result.mobs!["rat"]!.drops![0]!.itemId).toBe("rusty_sword");
  });

  it("updates door key references", () => {
    const world = makeWorld({
      rooms: {
        room1: {
          title: "Room 1",
          description: "",
          exits: {
            n: { to: "room2", door: { locked: true, key: "sword" } },
          },
        },
        room2: { title: "Room 2", description: "" },
      },
    });
    const result = renameItem(world, "sword", "gold_key");
    const exit = result.rooms["room1"]!.exits!["n"];
    expect(typeof exit !== "string" && exit.door?.key).toBe("gold_key");
  });
});

describe("renameQuest", () => {
  it("renames a quest key and updates mob.quests", () => {
    const world = makeWorld({
      mobs: {
        rat: { name: "Rat", spawns: [{ room: "room1" }], quests: ["fetch"] },
      },
    });
    const result = renameQuest(world, "fetch", "retrieve");

    expect(result.quests!["retrieve"]).toBeDefined();
    expect(result.quests!["fetch"]).toBeUndefined();
    expect(result.mobs!["rat"]!.quests).toEqual(["retrieve"]);
  });
});

describe("countReferences", () => {
  it("counts room references", () => {
    const world = makeWorld();
    // room1 is: startRoom + exit target from room2 + mob.room + item.room = 4
    expect(countReferences(world, "room", "room1")).toBe(4);
  });

  it("counts item references", () => {
    const world = makeWorld();
    // sword is in shop inventory = 1
    expect(countReferences(world, "item", "sword")).toBe(1);
  });

  it("counts mob references", () => {
    const world = makeWorld();
    // rat is quest giver = 1
    expect(countReferences(world, "mob", "rat")).toBe(1);
  });
});
