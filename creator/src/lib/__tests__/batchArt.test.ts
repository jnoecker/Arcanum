import { describe, it, expect } from "vitest";
import type { WorldFile } from "@/types/world";
import type { AudioTrackMeta } from "@/lib/audioLibrary";
import { collectTargets, getTargetPrompt, getTargetContext, assetTypeForKind, applyImageToWorld } from "@/lib/batchArt";

function makeWorld(rooms: WorldFile["rooms"]): WorldFile {
  return { zone: "parlor_zone", startRoom: "parlor_a", rooms };
}

const meta: Map<string, AudioTrackMeta> = new Map([
  [
    "lullaby.mp3",
    { name: "Scuttlefish's Lullaby", artist: "Scuttlefish", description: "", lyrics: "", durationSeconds: 60 },
  ],
]);

describe("collectTargets — music box keepsakes", () => {
  it("adds a keepsake target per music box, resolving the song from the audio library", () => {
    const world = makeWorld({
      parlor_a: { title: "Parlor A", description: "", musicBox: { file: "lullaby.mp3" } },
      parlor_b: { title: "Parlor B", description: "", musicBox: { file: "waltz.mp3", image: "items/sheet.png" } },
      study: { title: "Study", description: "" },
      ghost: { title: "Ghost", description: "", musicBox: { file: "   " } },
    });

    const keepsakes = collectTargets(world, meta).filter((t) => t.kind === "musicBoxKeepsake");
    expect(keepsakes.map((t) => t.id)).toEqual(["parlor_a", "parlor_b"]);

    const a = keepsakes.find((t) => t.id === "parlor_a")!;
    // Library metadata names the keepsake and seeds the prompt.
    expect(a.label).toBe("Keepsake: Scuttlefish's Lullaby");
    expect(a.song).toEqual({ title: "Scuttlefish's Lullaby", artist: "Scuttlefish" });
    // No authored image yet → selected by default as "missing".
    expect(a.hasExisting).toBe(false);
    expect(a.checked).toBe(true);

    const b = keepsakes.find((t) => t.id === "parlor_b")!;
    // Not in the library → label falls back to the filename, and an existing
    // image means it isn't selected by default.
    expect(b.label).toBe("Keepsake: waltz.mp3");
    expect(b.hasExisting).toBe(true);
    expect(b.checked).toBe(false);
  });

  it("falls back to the authored title when the library has no entry", () => {
    const world = makeWorld({
      parlor: { title: "Parlor", description: "", musicBox: { file: "waltz.mp3", title: "A Borrowed Waltz" } },
    });
    const keepsake = collectTargets(world).find((t) => t.kind === "musicBoxKeepsake")!;
    expect(keepsake.label).toBe("Keepsake: A Borrowed Waltz");
    expect(keepsake.song?.title).toBe("A Borrowed Waltz");
  });

  it("routes keepsake prompt/context through the lyric-sheet helpers", () => {
    const world = makeWorld({
      parlor_a: { title: "Parlor A", description: "", musicBox: { file: "lullaby.mp3" } },
    });
    const target = collectTargets(world, meta).find((t) => t.kind === "musicBoxKeepsake")!;
    expect(getTargetPrompt(target, world, "gentle_magic")).toContain("Scuttlefish's Lullaby");
    expect(getTargetContext(target, world)).toContain("Scuttlefish's Lullaby");
    expect(assetTypeForKind("musicBoxKeepsake")).toBe("item");
  });
});

describe("applyImageToWorld", () => {
  it("assigns a room image without mutating the input", () => {
    const world = makeWorld({ parlor_a: { title: "Parlor A", description: "" } });
    const next = applyImageToWorld(world, "room", "parlor_a", "rooms/parlor.png");
    expect(next.rooms.parlor_a!.image).toBe("rooms/parlor.png");
    expect(world.rooms.parlor_a!.image).toBeUndefined();
    expect(next).not.toBe(world);
  });

  it("assigns a music box keepsake image under the room's musicBox", () => {
    const world = makeWorld({
      parlor_a: { title: "Parlor A", description: "", musicBox: { file: "lullaby.mp3" } },
    });
    const next = applyImageToWorld(world, "musicBoxKeepsake", "parlor_a", "items/sheet.png");
    expect(next.rooms.parlor_a!.musicBox!.image).toBe("items/sheet.png");
    expect(next.rooms.parlor_a!.musicBox!.file).toBe("lullaby.mp3");
  });

  it("assigns a collection entity image (mob)", () => {
    const world: WorldFile = {
      ...makeWorld({}),
      mobs: { goblin: { name: "Goblin" } as WorldFile["mobs"][string] },
    };
    const next = applyImageToWorld(world, "mob", "goblin", "mobs/goblin.png");
    expect(next.mobs!.goblin!.image).toBe("mobs/goblin.png");
  });

  it("is a no-op when the target entity is missing", () => {
    const world = makeWorld({ parlor_a: { title: "Parlor A", description: "" } });
    expect(applyImageToWorld(world, "room", "ghost", "x.png")).toBe(world);
    expect(applyImageToWorld(world, "mob", "absent", "x.png")).toBe(world);
  });
});
