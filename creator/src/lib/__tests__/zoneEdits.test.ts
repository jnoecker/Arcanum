import { describe, it, expect } from "vitest";
import {
  addRoom,
  deleteRoom,
  updateRoom,
  addExit,
  deleteExit,
  generateRoomId,
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
