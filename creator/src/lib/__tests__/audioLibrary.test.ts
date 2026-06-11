import { describe, expect, it } from "vitest";
import { parseDocument, stringify } from "yaml";
import {
  buildAudioMetaIndex,
  buildUsageIndex,
  enrichJukeboxSongs,
  listAudioTracks,
  scanTrackUsage,
  setRoomTrack,
  setZoneDefaultTrack,
  trackLabel,
  usageSummary,
} from "@/lib/audioLibrary";
import { YAML_OPTS } from "@/lib/yamlOpts";
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
    description: "",
    lyrics: "",
    duration_seconds: 0,
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

  it("collapses content-addressed file names to an Untitled label", () => {
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(trackLabel(makeAsset({ file_name: `${hash}.mp3` }))).toBe("Untitled (e3b0c442…)");
  });

  it("collapses hash-like prompts to an Untitled label", () => {
    expect(trackLabel(makeAsset({ prompt: "Imported: deadbeefdeadbeefdeadbeef" }))).toBe(
      "Untitled (deadbeef…)",
    );
  });

  it("collapses full sha256 prompts despite the 48-char truncation", () => {
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(trackLabel(makeAsset({ prompt: `Imported: ${hash}` }))).toBe("Untitled (e3b0c442…)");
    expect(trackLabel(makeAsset({ prompt: `Imported: ${hash}.mp3` }))).toBe("Untitled (e3b0c442…)");
  });

  it("keeps short non-hash file names intact", () => {
    expect(trackLabel(makeAsset({ file_name: "abcdef.mp3" }))).toBe("abcdef.mp3");
  });

  it("display name wins even when the file is content-addressed", () => {
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(trackLabel(makeAsset({ display_name: "The Borrowed Song", file_name: `${hash}.mp3` }))).toBe(
      "The Borrowed Song",
    );
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
            parlor: {
              title: "Parlor",
              description: "",
              jukebox: { songs: [{ file: "theme.mp3" }, { file: "waltz.mp3" }, { file: "theme.mp3" }] },
            },
          } as WorldFile["rooms"],
        }),
      },
    ],
    [
      "village",
      {
        data: makeWorld({
          rooms: {
            inn: {
              title: "Inn",
              description: "",
              ambient: "crickets.mp3",
              jukebox: { songs: [{ file: "waltz.mp3" }] },
            },
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

  it("indexes jukebox references, deduped per room", () => {
    const index = buildUsageIndex(zones);
    expect(index.get("theme.mp3")!.jukeboxes).toEqual([
      { zoneId: "forest", roomId: "parlor", roomTitle: "Parlor" },
    ]);
    expect(index.get("waltz.mp3")!.jukeboxes).toEqual([
      { zoneId: "forest", roomId: "parlor", roomTitle: "Parlor" },
      { zoneId: "village", roomId: "inn", roomTitle: "Inn" },
    ]);
  });

  it("scanTrackUsage returns empty usage for unknown files", () => {
    expect(scanTrackUsage(zones, "nope.mp3")).toEqual({ zoneDefaults: [], rooms: [], jukeboxes: [] });
  });

  it("summarizes usage", () => {
    const index = buildUsageIndex(zones);
    expect(usageSummary(index.get("crickets.mp3")!)).toBe("1 zone default · 2 rooms in 2 zones");
    expect(usageSummary(index.get("waltz.mp3")!)).toBe("2 jukeboxes");
    expect(usageSummary(index.get("theme.mp3")!)).toBe("1 room in 1 zone · 1 jukebox");
    expect(usageSummary({ zoneDefaults: [], rooms: [], jukeboxes: [] })).toBe("Unused");
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

describe("buildAudioMetaIndex", () => {
  it("maps file names to label, metadata, and rounded duration", () => {
    const index = buildAudioMetaIndex([
      makeAsset({
        file_name: "song.mp3",
        display_name: "The Borrowed Song",
        description: "A waltz that remembers being hummed.",
        lyrics: "When the lanterns lean in low,\nthe teacups start to sway.",
        duration_seconds: 96.4,
      }),
      makeAsset({ id: "2", file_name: "raw.mp3" }),
    ]);
    expect(index.get("song.mp3")).toEqual({
      name: "The Borrowed Song",
      description: "A waltz that remembers being hummed.",
      lyrics: "When the lanterns lean in low,\nthe teacups start to sway.",
      durationSeconds: 96,
    });
    expect(index.get("raw.mp3")).toEqual({
      name: "raw.mp3",
      description: "",
      lyrics: "",
      durationSeconds: 0,
    });
  });
});

describe("enrichJukeboxSongs", () => {
  const meta = buildAudioMetaIndex([
    makeAsset({
      file_name: "song.mp3",
      display_name: "The Borrowed Song",
      description: "A waltz that remembers being hummed.",
      lyrics: "When the lanterns lean in low,\nthe teacups start to sway.",
      duration_seconds: 96.4,
    }),
    makeAsset({ id: "2", file_name: "bare.mp3", display_name: "Bare Bones" }),
  ]);

  it("rewrites library-known songs entirely from the index", () => {
    const world = makeWorld({
      rooms: {
        parlor: {
          title: "Parlor",
          description: "",
          jukebox: {
            songs: [{ file: "song.mp3", name: "Stale Name", description: "stale", lyrics: "stale lines" }],
          },
        },
      } as WorldFile["rooms"],
    });
    const next = enrichJukeboxSongs(world, meta);
    expect(next.rooms.parlor?.jukebox?.songs).toEqual([
      {
        file: "song.mp3",
        name: "The Borrowed Song",
        description: "A waltz that remembers being hummed.",
        lyrics: "When the lanterns lean in low,\nthe teacups start to sway.",
        durationSeconds: 96,
      },
    ]);
  });

  it("clears stale description and lyrics when the library fields are empty", () => {
    const world = makeWorld({
      rooms: {
        parlor: {
          title: "Parlor",
          description: "",
          jukebox: {
            songs: [{ file: "bare.mp3", description: "old blurb", lyrics: "old lines", durationSeconds: 30 }],
          },
        },
      } as WorldFile["rooms"],
    });
    const next = enrichJukeboxSongs(world, meta);
    expect(next.rooms.parlor?.jukebox?.songs).toEqual([{ file: "bare.mp3", name: "Bare Bones" }]);
  });

  it("preserves songs that are not in the library verbatim", () => {
    const foreign = {
      file: "elsewhere.mp3",
      name: "Foreign Tune",
      lyrics: "lines from another machine",
      durationSeconds: 42,
    };
    const world = makeWorld({
      rooms: {
        parlor: { title: "Parlor", description: "", jukebox: { songs: [foreign] } },
      } as WorldFile["rooms"],
    });
    const next = enrichJukeboxSongs(world, meta);
    expect(next.rooms.parlor?.jukebox?.songs?.[0]).toBe(foreign);
  });

  it("drops blank-file songs and the jukebox itself when nothing remains", () => {
    const world = makeWorld({
      rooms: {
        parlor: {
          title: "Parlor",
          description: "",
          jukebox: { songs: [{ file: "" }, { file: "   " }] },
        },
      } as WorldFile["rooms"],
    });
    const next = enrichJukeboxSongs(world, meta);
    expect(next.rooms.parlor?.jukebox).toBeUndefined();
  });

  it("preserves identity for untouched rooms and jukebox-free worlds", () => {
    const world = makeWorld({
      rooms: {
        glade: { title: "Glade", description: "" },
        parlor: { title: "Parlor", description: "", jukebox: { songs: [{ file: "song.mp3" }] } },
      } as WorldFile["rooms"],
    });
    const next = enrichJukeboxSongs(world, meta);
    expect(next).not.toBe(world);
    expect(next.rooms.glade).toBe(world.rooms.glade);

    const noJukebox = makeWorld({
      rooms: { glade: { title: "Glade", description: "" } } as WorldFile["rooms"],
    });
    expect(enrichJukeboxSongs(noJukebox, meta)).toBe(noJukebox);
  });
});

describe("jukebox YAML round-trip", () => {
  it("survives stringify + parse with songs deep-equal", () => {
    const world = makeWorld({
      rooms: {
        parlor: {
          title: "The Jukebox Parlor",
          description: "A parlor.",
          jukebox: {
            songs: [
              {
                file: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.mp3",
                name: "The Borrowed Song",
                description: "A waltz that remembers being hummed.",
                lyrics: "When the lanterns lean in low,\nthe teacups start to sway.\n",
                durationSeconds: 96,
              },
              { file: "plain.mp3", name: "Plain Tune" },
            ],
          },
        },
      } as WorldFile["rooms"],
    });
    const yaml = stringify(world, YAML_OPTS);
    const reparsed = parseDocument(yaml).toJS() as WorldFile;
    expect(reparsed.rooms.parlor?.jukebox).toEqual(world.rooms.parlor?.jukebox);
  });
});
