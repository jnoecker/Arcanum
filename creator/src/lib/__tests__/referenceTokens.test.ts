import { describe, expect, it } from "vitest";
import {
  applyReferences,
  buildReferenceBlock,
  buildResolver,
  collectTokenSlots,
  detectMention,
  expandReferences,
  extractTokens,
  hasTokens,
  mapTokenSlots,
  slugifyToken,
  stripSigils,
} from "@/lib/referenceTokens";
import type { ReferenceSubject } from "@/types/reference";
import type { WorldFile } from "@/types/world";

const aineroia: ReferenceSubject = {
  id: "1",
  token: "aineroia",
  name: "Aineroia",
  category: "character",
  appearance: "a silver-haired elf in teal robes",
};
const archae: ReferenceSubject = {
  id: "2",
  token: "archae",
  name: "Archae",
  category: "ancestry",
  appearance: "tall, copper-skinned, four-eyed folk",
};
const court: ReferenceSubject = {
  id: "3",
  token: "crimson-court",
  name: "Crimson Court",
  category: "faction",
  appearance: "ornate scarlet-and-gold heraldry",
};

const subjects = [aineroia, archae, court];
const resolver = buildResolver(subjects);

describe("extractTokens", () => {
  it("finds bare and bracket tokens", () => {
    const found = extractTokens("A beautiful @Archae, @Aineroia and the @[Crimson Court]");
    expect(found.map((t) => t.inner)).toEqual(["Archae", "Aineroia", "Crimson Court"]);
  });

  it("ignores text without tokens", () => {
    expect(extractTokens("nothing here")).toEqual([]);
    expect(hasTokens("nothing here")).toBe(false);
    expect(hasTokens("a @ref here")).toBe(true);
  });
});

describe("slugifyToken", () => {
  it("lowercases and dashes", () => {
    expect(slugifyToken("Crimson Court")).toBe("crimson-court");
    expect(slugifyToken("  Aineroia ")).toBe("aineroia");
  });
});

describe("stripSigils", () => {
  it("removes the sigil, keeping authored text", () => {
    expect(stripSigils("A beautiful @Archae, @Aineroia stands here")).toBe(
      "A beautiful Archae, Aineroia stands here",
    );
    expect(stripSigils("guests of the @[Crimson Court]")).toBe("guests of the Crimson Court");
  });

  it("only strips known tokens when a known-set is supplied", () => {
    const known = new Set(["archae", "aineroia", "crimson court"]);
    expect(stripSigils("email me @support and meet @Archae", known)).toBe(
      "email me @support and meet Archae",
    );
  });
});

describe("expandReferences", () => {
  it("strips sigils and collects referenced subjects in order", () => {
    const r = expandReferences("A beautiful @Archae, @Aineroia stands here", resolver);
    expect(r.text).toBe("A beautiful Archae, Aineroia stands here");
    expect(r.used.map((s) => s.id)).toEqual(["2", "1"]);
    expect(r.unknown).toEqual([]);
  });

  it("dedupes repeated references", () => {
    const r = expandReferences("@Aineroia talks to @aineroia", resolver);
    expect(r.used).toHaveLength(1);
  });

  it("resolves the bracket form by display name", () => {
    const r = expandReferences("banners of the @[Crimson Court]", resolver);
    expect(r.used.map((s) => s.id)).toEqual(["3"]);
    expect(r.text).toBe("banners of the Crimson Court");
  });

  it("reports unknown tokens but still strips them", () => {
    const r = expandReferences("the @nobody walks", resolver);
    expect(r.unknown).toEqual(["nobody"]);
    expect(r.text).toBe("the nobody walks");
  });
});

describe("buildReferenceBlock / applyReferences", () => {
  it("formats canonical appearances", () => {
    const block = buildReferenceBlock([aineroia, archae]);
    expect(block).toContain("Aineroia: a silver-haired elf in teal robes");
    expect(block).toContain("Archae: tall, copper-skinned, four-eyed folk");
  });

  it("omits subjects without an appearance", () => {
    expect(buildReferenceBlock([{ ...aineroia, appearance: "" }])).toBe("");
  });

  it("appends the block to the cleaned prompt", () => {
    const { prompt, used } = applyReferences("A beautiful @Archae stands here", resolver);
    expect(prompt).toContain("A beautiful Archae stands here");
    expect(prompt).toContain("Canonical appearance references");
    expect(prompt).toContain("tall, copper-skinned");
    expect(used).toHaveLength(1);
  });

  it("leaves token-free prompts untouched", () => {
    const { prompt } = applyReferences("just a plain prompt", resolver);
    expect(prompt).toBe("just a plain prompt");
  });
});

describe("detectMention (autocomplete)", () => {
  it("detects a bare token in progress at the caret", () => {
    const text = "A stern @arc warrior";
    const caret = "A stern @arc".length;
    expect(detectMention(text, caret)).toEqual({ start: 8, query: "arc" });
  });

  it("detects an empty query right after @", () => {
    expect(detectMention("meet @", 6)).toEqual({ start: 5, query: "" });
  });

  it("detects the bracket form with spaces", () => {
    const text = "banners of the @[Crimson";
    expect(detectMention(text, text.length)).toEqual({ start: 15, query: "Crimson" });
  });

  it("ignores @ that is not word-initial (e.g. emails)", () => {
    const text = "email me@arc now";
    expect(detectMention(text, "email me@arc".length)).toBeNull();
  });

  it("returns null once the token is closed by a space", () => {
    const text = "@archae stands";
    expect(detectMention(text, text.length)).toBeNull();
  });

  it("only matches the run ending at the caret, not earlier tokens", () => {
    const text = "@aineroia and @arc";
    expect(detectMention(text, text.length)).toEqual({ start: 14, query: "arc" });
  });
});

describe("world token-slot traversal", () => {
  const world = {
    zone: "test",
    rooms: {
      r1: { title: "Hall", description: "A beautiful @Aineroia stands here" },
      r2: { title: "Void", description: "empty" },
    },
    mobs: {
      m1: { name: "Guard", description: "a stern @Archae warrior", spawns: [] },
    },
    items: {
      i1: { displayName: "Banner", description: "bears the @[Crimson Court] crest" },
    },
  } as unknown as WorldFile;

  it("collects every art-bearing description and name", () => {
    const keys = collectTokenSlots(world).map((s) => s.key).sort();
    expect(keys).toEqual([
      "item/i1",
      "item/i1/name",
      "mob/m1",
      "mob/m1/name",
      "room/r1",
      "room/r1/name",
      "room/r2",
      "room/r2/name",
    ]);
  });

  it("maps descriptions and only reallocates changed entities", () => {
    const known = new Set(["aineroia", "archae", "crimson court"]);
    const stripped = mapTokenSlots(world, (_k, text) => stripSigils(text, known));
    expect(stripped.rooms.r1.description).toBe("A beautiful Aineroia stands here");
    expect(stripped.items!.i1.description).toBe("bears the Crimson Court crest");
    // Unchanged room keeps its identity.
    expect(stripped.rooms.r2).toBe(world.rooms.r2);
  });

  it("maps name fields under their own slot keys", () => {
    const tokenWorld = {
      zone: "test",
      rooms: { r1: { title: "Throne of @Aineroia", description: "grand" } },
      mobs: { m1: { name: "Herald of the @[Crimson Court]", description: "regal", spawns: [] } },
      items: { i1: { displayName: "Banner of @archae", description: "woven" } },
    } as unknown as WorldFile;
    const known = new Set(["aineroia", "archae", "crimson court"]);
    const stripped = mapTokenSlots(tokenWorld, (_k, text) => stripSigils(text, known));
    expect(stripped.rooms.r1.title).toBe("Throne of Aineroia");
    expect(stripped.mobs!.m1.name).toBe("Herald of the Crimson Court");
    expect(stripped.items!.i1.displayName).toBe("Banner of archae");
    // Descriptions without tokens keep their text.
    expect(stripped.rooms.r1.description).toBe("grand");
  });

  it("round-trips: strip then re-detect matches", () => {
    const known = new Set(["aineroia"]);
    const annotated = "A beautiful @Aineroia stands here";
    expect(stripSigils(annotated, known)).toBe("A beautiful Aineroia stands here");
  });
});
