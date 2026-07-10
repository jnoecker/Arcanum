import { describe, expect, it } from "vitest";
import { featureBackgroundContext, musicBoxKeepsakeContext } from "@/lib/entityPrompts";
import type { FeatureFile, WorldFile } from "@/types/world";

function makeWorld(): WorldFile {
  return {
    zone: "harbor",
    startRoom: "parlor",
    rooms: {
      parlor: {
        title: "The Velvet Parlor",
        description: "A candlelit parlor where a brass music box turns slowly on the mantel.",
        exits: {},
      },
    },
    mobs: {},
    items: {
      locket: { displayName: "a silver locket" },
      shell: { displayName: "a spiraled shell" },
    },
    shops: {},
  };
}

function makeSign(): FeatureFile {
  return {
    type: "SIGN",
    displayName: "a small lacquered placard beside the music box",
    keyword: "placard",
    text: "Wind me gently, and I will sing you the tide's own lullaby.",
  };
}

describe("featureBackgroundContext", () => {
  it("grounds a sign in its text, room, and zone vibe", () => {
    const ctx = featureBackgroundContext(makeWorld(), "parlor", "SIGN", makeSign(), "Sleepy seaside town, warm lantern light");
    expect(ctx).toContain("a small lacquered placard beside the music box");
    expect(ctx).toContain("the tide's own lullaby");
    expect(ctx).toMatch(/do NOT render it/i);
    expect(ctx).toContain('"The Velvet Parlor"');
    expect(ctx).toContain("brass music box turns slowly");
    expect(ctx).toContain("Sleepy seaside town, warm lantern light");
  });

  it("omits blank sign text and vibe", () => {
    const sign = { ...makeSign(), text: "   " };
    const ctx = featureBackgroundContext(makeWorld(), "parlor", "SIGN", sign, "  ");
    expect(ctx).not.toContain("will display this text");
    expect(ctx).not.toContain("Zone atmosphere");
  });

  it("survives an unknown room and falls back to the type label", () => {
    const sign = { ...makeSign(), displayName: "" };
    const ctx = featureBackgroundContext(makeWorld(), "nowhere", "SIGN", sign);
    expect(ctx).toContain("A backdrop for sign");
    expect(ctx).not.toContain("It stands in the room");
  });

  it("resolves container contents to display names", () => {
    const chest: FeatureFile = {
      type: "CONTAINER",
      displayName: "a barnacled sea chest",
      keyword: "chest",
      items: ["locket", "shell", "unknown_id"],
    };
    const ctx = featureBackgroundContext(makeWorld(), "parlor", "CONTAINER", chest);
    expect(ctx).toContain("a silver locket");
    expect(ctx).toContain("a spiraled shell");
    expect(ctx).toContain("unknown_id");
    expect(ctx).toMatch(/do NOT draw the items/i);
  });
});

describe("musicBoxKeepsakeContext", () => {
  it("names the song and artist", () => {
    const ctx = musicBoxKeepsakeContext("The Tide's Return", "Marisol");
    expect(ctx).toContain('"The Tide\'s Return"');
    expect(ctx).toContain("by Marisol");
    expect(ctx).toContain("inventory icon");
  });

  it("weaves the song's lyrics into the context for the LLM", () => {
    const ctx = musicBoxKeepsakeContext("Lantern Song", "Vael", [
      "Hold the lantern to the sea",
      "Wait for me, wait for me",
    ]);
    expect(ctx).toContain("Hold the lantern to the sea");
    expect(ctx).toContain("Wait for me, wait for me");
    // Lyrics should guide mood, not be rendered as legible text.
    expect(ctx).toMatch(/do not render them as legible body text/i);
  });

  it("drops blank and whitespace-only lyric lines", () => {
    const ctx = musicBoxKeepsakeContext("Hush", undefined, [
      "  ",
      "Soft now",
      "",
      "  the embers fade  ",
    ]);
    expect(ctx).toContain("Soft now");
    expect(ctx).toContain("the embers fade");
    expect(ctx).not.toMatch(/\n\s*\n\s*the embers/);
  });

  it("omits the lyrics block entirely when there are no lyrics", () => {
    const withNone = musicBoxKeepsakeContext("Quiet Tune", "Anon");
    const withEmpty = musicBoxKeepsakeContext("Quiet Tune", "Anon", []);
    const withBlankOnly = musicBoxKeepsakeContext("Quiet Tune", "Anon", ["", "   "]);
    expect(withNone).not.toContain("The song's lyrics");
    expect(withEmpty).toEqual(withNone);
    expect(withBlankOnly).toEqual(withNone);
  });
});
