import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseDocument, stringify } from "yaml";
import type { WorldFile } from "@/types/world";

const ZONE_DIR = join(__dirname, "fixtures/example-zones");

/** Get all YAML files from the example-zones directory */
function getZoneFiles(): string[] {
  return readdirSync(ZONE_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => join(ZONE_DIR, f));
}

describe("YAML round-trip", () => {
  const zoneFiles = getZoneFiles();

  it("should find example zone files", () => {
    expect(zoneFiles.length).toBeGreaterThan(0);
  });

  for (const filePath of zoneFiles) {
    const fileName = filePath.split(/[\\/]/).pop()!;

    it(`should parse ${fileName} without errors`, () => {
      const content = readFileSync(filePath, "utf-8");
      const doc = parseDocument(content);
      expect(doc.errors).toHaveLength(0);

      const data = doc.toJS() as Record<string, unknown>;
      expect(data).toBeDefined();
    });

    it(`should preserve all data through parse+serialize for ${fileName}`, () => {
      const content = readFileSync(filePath, "utf-8");
      const doc = parseDocument(content);
      const data = doc.toJS() as Record<string, unknown>;

      // Re-serialize and re-parse
      const serialized = stringify(data);
      const reparsed = parseDocument(serialized).toJS() as Record<string, unknown>;

      // Data should be identical
      expect(reparsed).toEqual(data);
    });
  }
});

describe("YAML zone structure", () => {
  const zoneFiles = getZoneFiles();

  for (const filePath of zoneFiles) {
    const fileName = filePath.split(/[\\/]/).pop()!;
    const content = readFileSync(filePath, "utf-8");
    const data = parseDocument(content).toJS() as Record<string, unknown>;

    // Skip non-zone files (e.g., achievements.yaml)
    if (!data.zone || !data.rooms) continue;

    const zone = data as unknown as WorldFile;

    it(`${fileName}: zone name should be non-blank`, () => {
      expect(zone.zone.trim().length).toBeGreaterThan(0);
    });

    it(`${fileName}: startRoom should exist in rooms`, () => {
      expect(zone.rooms).toHaveProperty(zone.startRoom);
    });

    it(`${fileName}: all rooms should have title and description`, () => {
      for (const [id, room] of Object.entries(zone.rooms)) {
        expect(room.title, `room ${id} missing title`).toBeTruthy();
        expect(room.description, `room ${id} missing description`).toBeTruthy();
      }
    });

    it(`${fileName}: all exit directions should be valid`, () => {
      const validDirs = new Set(["n", "s", "e", "w", "u", "d", "north", "south", "east", "west", "up", "down"]);
      for (const [roomId, room] of Object.entries(zone.rooms)) {
        if (!room.exits) continue;
        for (const dir of Object.keys(room.exits)) {
          expect(validDirs.has(dir.toLowerCase()), `room ${roomId} has invalid exit direction: ${dir}`).toBe(true);
        }
      }
    });

    it(`${fileName}: all mob room refs should resolve to local or cross-zone rooms`, () => {
      const mobs = zone.mobs ?? {};
      const localRooms = new Set(Object.keys(zone.rooms));
      for (const [mobId, mob] of Object.entries(mobs)) {
        // Accept either legacy shorthand `room` or the new `spawns` list.
        const roomRefs = mob.spawns?.map((s) => s.room) ?? (mob.room ? [mob.room] : []);
        for (const roomRef of roomRefs) {
          if (!roomRef.includes(":")) {
            expect(localRooms.has(roomRef), `mob ${mobId} references unknown room: ${roomRef}`).toBe(true);
          }
        }
      }
    });

    it(`${fileName}: all item room refs should resolve to local or cross-zone rooms`, () => {
      const items = zone.items ?? {};
      const localRooms = new Set(Object.keys(zone.rooms));
      for (const [itemId, item] of Object.entries(items)) {
        if (!item.room) continue;
        if (!item.room.includes(":")) {
          expect(localRooms.has(item.room), `item ${itemId} references unknown room: ${item.room}`).toBe(true);
        }
      }
    });

    it(`${fileName}: all mob drop itemIds should reference existing items`, () => {
      const mobs = zone.mobs ?? {};
      const localItems = new Set(Object.keys(zone.items ?? {}));
      for (const [mobId, mob] of Object.entries(mobs)) {
        for (const drop of mob.drops ?? []) {
          if (!drop.itemId.includes(":")) {
            expect(localItems.has(drop.itemId), `mob ${mobId} drop references unknown item: ${drop.itemId}`).toBe(true);
          }
        }
      }
    });

    if (zone.shops) {
      it(`${fileName}: all shop room refs should resolve`, () => {
        const localRooms = new Set(Object.keys(zone.rooms));
        for (const [shopId, shop] of Object.entries(zone.shops!)) {
          if (!shop.room.includes(":")) {
            expect(localRooms.has(shop.room), `shop ${shopId} references unknown room: ${shop.room}`).toBe(true);
          }
        }
      });
    }

    if (zone.gatheringNodes) {
      it(`${fileName}: gathering nodes should have valid skills`, () => {
        const validSkills = new Set(["MINING", "HERBALISM"]);
        for (const [nodeId, node] of Object.entries(zone.gatheringNodes!)) {
          expect(
            validSkills.has(node.skill.toUpperCase()),
            `gathering node ${nodeId} has invalid skill: ${node.skill}`,
          ).toBe(true);
        }
      });
    }

    if (zone.recipes) {
      it(`${fileName}: recipes should have valid skills`, () => {
        const validSkills = new Set(["SMITHING", "ALCHEMY"]);
        for (const [recipeId, recipe] of Object.entries(zone.recipes!)) {
          expect(
            validSkills.has(recipe.skill.toUpperCase()),
            `recipe ${recipeId} has invalid skill: ${recipe.skill}`,
          ).toBe(true);
        }
      });
    }
  }
});
