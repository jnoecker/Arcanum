import { describe, expect, it } from "vitest";
import { lineKey, sha8 } from "@/types/voiceover";

describe("sha8 (voice-over contract hash)", () => {
  // Must match Rust `elevenlabs::text_sha8` and the AmbonMUD engine.
  it("matches the SHA-256 empty-string vector", async () => {
    expect(await sha8("")).toBe("e3b0c442");
  });

  it("returns 8 hex chars", async () => {
    const h = await sha8("Greetings, traveler.");
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is sensitive to surrounding whitespace (raw text, no trim)", async () => {
    expect(await sha8("hello")).not.toBe(await sha8(" hello "));
  });

  it("is deterministic", async () => {
    expect(await sha8("root line")).toBe(await sha8("root line"));
  });
});

describe("lineKey", () => {
  it("composes a stable identity from zone/template/node", () => {
    expect(lineKey("tutorial_glade", "headmaster_aldric", "root")).toBe(
      "tutorial_glade headmaster_aldric root",
    );
  });
});
