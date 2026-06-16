import { describe, expect, it } from "vitest";
import { musicBoxKeepsakeContext } from "@/lib/entityPrompts";

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
