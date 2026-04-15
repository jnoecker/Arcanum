import { describe, it, expect } from "vitest";
import { duplicateZone } from "../duplicateZone";
import type { WorldFile } from "@/types/world";

function sampleWorld(): WorldFile {
  return {
    zone: "old_zone",
    startRoom: "start",
    rooms: {
      start: {
        title: "Start",
        description: ".",
        exits: { n: "next", e: "other_zone:lobby" },
      },
      next: { title: "Next", description: ".", exits: { s: "start" } },
    },
    mobs: { goblin: { name: "Goblin", description: "g", room: "start", hp: 50 } },
    items: { sword: { displayName: "Sword", description: "s", room: "next", damage: 10 } },
    shops: {},
    quests: {},
    gatheringNodes: {},
    recipes: {},
  };
}

describe("duplicateZone", () => {
  it("replaces the zone label but preserves room/mob/item IDs", () => {
    const copy = duplicateZone(sampleWorld(), "new_zone");
    expect(copy.zone).toBe("new_zone");
    expect(Object.keys(copy.rooms)).toEqual(["start", "next"]);
    expect(copy.mobs?.goblin).toBeDefined();
    expect(copy.items?.sword).toBeDefined();
  });

  it("deep-clones so mutating the copy doesn't affect the source", () => {
    const src = sampleWorld();
    const copy = duplicateZone(src, "new_zone");
    copy.rooms.start!.title = "Mutated";
    copy.mobs!.goblin!.hp = 9999;
    expect(src.rooms.start!.title).toBe("Start");
    expect(src.mobs!.goblin!.hp).toBe(50);
  });

  it("preserves cross-zone exits untouched", () => {
    const copy = duplicateZone(sampleWorld(), "new_zone");
    expect(copy.rooms.start!.exits?.e).toBe("other_zone:lobby");
  });

  it("preserves numeric fields (stats, damage, hp)", () => {
    const copy = duplicateZone(sampleWorld(), "new_zone");
    expect(copy.mobs!.goblin!.hp).toBe(50);
    expect(copy.items!.sword!.damage).toBe(10);
  });
});
