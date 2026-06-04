import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { lineKey, sha8 } from "@/types/voiceover";

describe("sha8 (voice-over contract hash)", () => {
  // Must match Rust `elevenlabs::text_sha8` and the AmbonMUD engine.
  it("matches the SHA-256 empty-string vector", async () => {
    expect(await sha8("")).toBe("e3b0c442");
  });

  // Cross-repo reference vectors shared with AmbonMUD's GmcpEmitter.sha8.
  it("matches the contract reference vectors", async () => {
    expect(await sha8("Hello!")).toBe("334d016f");
    expect(await sha8("Hello there!")).toBe("89b8b8e4");
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

// Parser-parity boundary with AmbonMUD (PR #1203 @ bd7f56d5). The engine
// hashes the dialogue text its WorldLoader (Jackson + SnakeYAML) produces; we
// hash what our `yaml` package produces. Block scalars are the only place the
// two could diverge (trailing-newline chomping), so we pin the exact bytes a
// real `|` / `|-` block parses to — through the same parseDocument().toJS()
// path the dialogue loader uses — and the resulting hash.
describe("block-scalar parity (cross-repo)", () => {
  function nodeText(blockYaml: string): string {
    const doc = `mobs:\n  sage:\n    name: Sage\n    dialogue:\n      n:\n        text: ${blockYaml}`;
    return parseDocument(doc).toJS().mobs.sage.dialogue.n.text as string;
  }

  it("`|` literal block clips to exactly one trailing newline", () => {
    const text = nodeText("|\n          Hello there!\n          Stay a while.\n");
    expect(text).toBe("Hello there!\nStay a while.\n");
  });

  it("`|` literal block hashes to the engine's reference vector", async () => {
    const text = nodeText("|\n          Hello there!\n          Stay a while.\n");
    expect(await sha8(text)).toBe("df658e4d");
  });

  it("`|-` strip block drops the trailing newline and hashes differently", async () => {
    const strip = nodeText("|-\n          Hello there!\n          Stay a while.\n");
    expect(strip).toBe("Hello there!\nStay a while.");
    expect(await sha8(strip)).not.toBe("df658e4d");
  });
});

describe("lineKey", () => {
  it("composes a stable identity from zone/template/node", () => {
    expect(lineKey("tutorial_glade", "headmaster_aldric", "root")).toBe(
      "tutorial_glade headmaster_aldric root",
    );
  });
});
