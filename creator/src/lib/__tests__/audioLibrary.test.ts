import { describe, expect, it } from "vitest";
import {
  buildUsageIndex,
  listAudioTracks,
  scanTrackUsage,
  setRoomTrack,
  setZoneDefaultTrack,
  trackLabel,
  usageSummary,
} from "@/lib/audioLibrary";
import type { AssetEntry } from "@/types/assets";
import type { WorldFile } from "@/types/world";

function makeAsset(overrides: Partial<AssetEntry>): AssetEntry {
  return {
    id: "id",
    hash: "hash",
    prompt: "",
    enhanced_prompt: "",
    model: "imported",
    asset_type: "music",
    context: { zone: "", entity_type: "audio_library", entity_id: "music" },
    created_at: "2026-01-01T00:00:00Z",
    file_name: "abc.mp3",
    width: 0,
    height: 0,
    sync_status: "local",
    variant_group: "",
    is_active: false,
    display_name: "",
    ...overrides,
  };
}

function makeWorld(overrides: Partial<WorldFile>): WorldFile {
  return {
    zone: "Test Zone",
    startRoom: "start",
    rooms: {},
    ...overrides,
  } as WorldFile;
}

describe("listAudioTracks", () => {
  it("filters by lane and audio extension", () => {
    const assets = [
      makeAsset({ id: "1", asset_type: "music", file_name: "a.mp3" }),
      makeAsset({ id: "2", asset_type: "ambient", file_name: "b.ogg" }),
      makeAsset({ id: "3", asset_type: "audio", file_name: "c.wav" }),
      makeAsset({ id: "4", asset_type: "music", file_name: "d.png" }),
      makeAsset({ id: "5", asset_type: "room", file_name: "e.mp3" }),
    ];
    expect(listAudioTracks(assets, "music").map((a) => a.id)).toEqual(["1"]);
    // Legacy untyped "audio" imports surface in the ambient lane
    expect(listAudioTracks(assets, "ambient").map((a) => a.id).sort()).toEqual(["2", "3"]);
  });

  it("sorts by display label", () => {
    const assets = [
      makeAsset({ id: "1", file_name: "a.mp3", display_name: "Zither Waltz" }),
      makeAsset({ id: "2", file_name: "b.mp3", display_name: "Crickets" }),
    ];
    expect(listAudioTracks(assets, "music").map((a) => a.display_name)).toEqual([
      "Crickets",
      "Zither Waltz",
    ]);
  });
});

describe("trackLabel", () => {
  it("prefers display name, then prompt, then file name", () => {
    expect(trackLabel(makeAsset({ display_name: "Crickets" }))).toBe("Crickets");
    expect(trackLabel(makeAsset({ prompt: "Imported: night sounds" }))).toBe("night sounds");
    expect(trackLabel(makeAsset({ file_name: "abc123.mp3" }))).toBe("abc123.mp3");
  });
});

describe("usage scanning", () => {
  const zones: [string, { data: WorldFile }][] = [
    [
      "forest",
      {
        data: makeWorld({
          audio: { ambient: "crickets.mp3" },
          rooms: {
            glade: { title: "Glade", description: "", music: "theme.mp3" },
            brook: { title: "Brook", description: "", ambient: "crickets.mp3" },
          } as WorldFile["rooms"],
        }),
      },
    ],
    [
      "village",
      {
        data: makeWorld({
          rooms: {
            inn: { title: "Inn", description: "", ambient: "crickets.mp3" },
          } as WorldFile["rooms"],
        }),
      },
    ],
  ];

  it("indexes zone defaults and room references", () => {
    const index = buildUsageIndex(zones);
    const crickets = index.get("crickets.mp3")!;
    expect(crickets.zoneDefaults).toEqual([{ zoneId: "forest", kind: "ambient" }]);
    expect(crickets.rooms).toHaveLength(2);
    const theme = index.get("theme.mp3")!;
    expect(theme.rooms).toEqual([
      { zoneId: "forest", roomId: "glade", roomTitle: "Glade", kind: "music" },
    ]);
  });

  it("scanTrackUsage returns empty usage for unknown files", () => {
    expect(scanTrackUsage(zones, "nope.mp3")).toEqual({ zoneDefaults: [], rooms: [] });
  });

  it("summarizes usage", () => {
    const index = buildUsageIndex(zones);
    expect(usageSummary(index.get("crickets.mp3")!)).toBe("1 zone default · 2 rooms in 2 zones");
    expect(usageSummary({ zoneDefaults: [], rooms: [] })).toBe("Unused");
  });
});

describe("assignment helpers", () => {
  it("sets and clears zone defaults, dropping empty audio blocks", () => {
    const world = makeWorld({});
    const withMusic = setZoneDefaultTrack(world, "music", "theme.mp3");
    expect(withMusic.audio).toEqual({ music: "theme.mp3" });
    const cleared = setZoneDefaultTrack(withMusic, "music", undefined);
    expect(cleared.audio).toBeUndefined();
  });

  it("preserves the other slot when clearing one", () => {
    const world = makeWorld({ audio: { music: "theme.mp3", ambient: "crickets.mp3" } });
    const cleared = setZoneDefaultTrack(world, "music", undefined);
    expect(cleared.audio).toEqual({ music: undefined, ambient: "crickets.mp3" });
  });

  it("sets room tracks immutably and ignores missing rooms", () => {
    const world = makeWorld({
      rooms: { glade: { title: "Glade", description: "" } } as WorldFile["rooms"],
    });
    const next = setRoomTrack(world, "glade", "ambient", "crickets.mp3");
    expect(next.rooms.glade?.ambient).toBe("crickets.mp3");
    expect(world.rooms.glade?.ambient).toBeUndefined();
    expect(setRoomTrack(world, "missing", "music", "x.mp3")).toBe(world);
  });
});
