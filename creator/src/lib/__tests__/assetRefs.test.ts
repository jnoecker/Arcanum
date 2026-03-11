import { describe, expect, it } from "vitest";
import { normalizeAssetRef, normalizeGlobalAssetMap, normalizeWorldAssetRefs } from "../assetRefs";

describe("normalizeAssetRef", () => {
  it("strips local filesystem paths down to file names", () => {
    expect(normalizeAssetRef("C:/Users/test/AppData/Roaming/assets/images/example.png")).toBe("example.png");
    expect(normalizeAssetRef("C:\\Users\\test\\AppData\\Roaming\\assets\\images\\example.png")).toBe("example.png");
    expect(normalizeAssetRef("/tmp/assets/images/example.png")).toBe("example.png");
  });

  it("preserves runtime-safe refs", () => {
    expect(normalizeAssetRef("https://assets.ambon.dev/example.png")).toBe("https://assets.ambon.dev/example.png");
    expect(normalizeAssetRef("/images/global_assets/minimap-unexplored.png")).toBe("/images/global_assets/minimap-unexplored.png");
    expect(normalizeAssetRef("global_assets/compass_rose.png")).toBe("global_assets/compass_rose.png");
    expect(normalizeAssetRef("abc123.png")).toBe("abc123.png");
  });
});

describe("normalizeGlobalAssetMap", () => {
  it("drops empty values and normalizes local refs", () => {
    expect(normalizeGlobalAssetMap({
      compass_rose: "C:\\cache\\abc123.png",
      empty: "",
    })).toEqual({
      compass_rose: "abc123.png",
    });
  });
});

describe("normalizeWorldAssetRefs", () => {
  it("normalizes zone and entity media refs for serialization", () => {
    const world = normalizeWorldAssetRefs({
      zone: "tutorial_glade",
      startRoom: "entrance",
      image: {
        room: "C:\\assets\\images\\room_default.png",
      },
      rooms: {
        entrance: {
          title: "Entrance",
          description: "",
          image: "C:/assets/images/entrance.png",
          music: "C:/assets/audio/theme.mp3",
        },
      },
      mobs: {
        guide: {
          name: "Guide",
          room: "entrance",
          image: "/images/mobs/guide.png",
        },
      },
    });

    expect(world.image?.room).toBe("room_default.png");
    expect(world.rooms.entrance?.image).toBe("entrance.png");
    expect(world.rooms.entrance?.music).toBe("theme.mp3");
    expect(world.mobs?.guide?.image).toBe("/images/mobs/guide.png");
  });
});
