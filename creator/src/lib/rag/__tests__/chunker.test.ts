import { describe, it, expect } from "vitest";
import { chunkLore } from "../chunker";
import type { Article, WorldLore } from "@/types/lore";

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: "a1",
    template: "freeform",
    title: "Untitled",
    fields: {},
    content: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function loreWith(articles: Record<string, Article>, extra: Partial<WorldLore> = {}): WorldLore {
  return {
    version: 2,
    articles,
    ...extra,
  };
}

const tipTapDoc = (nodes: unknown[]) => JSON.stringify({ type: "doc", content: nodes });
const heading = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

describe("chunkLore", () => {
  it("splits article body on H2 sections", () => {
    const article = makeArticle({
      id: "ar_one",
      title: "Ar One",
      sections: [
        {
          id: "s1",
          type: "richtext",
          title: "Overview",
          body: tipTapDoc([
            heading(2, "Origins"),
            paragraph("Born in fire."),
            heading(2, "Legacy"),
            paragraph("Remembered in song."),
          ]),
        },
      ],
    });
    const chunks = chunkLore({
      lore: loreWith({ ar_one: article }),
      config: null,
      zones: [],
    });
    const articleChunks = chunks.filter((c) => c.kind === "article");
    expect(articleChunks.length).toBeGreaterThanOrEqual(2);
    const sections = articleChunks.map((c) => c.section);
    expect(sections).toContain("Origins");
    expect(sections).toContain("Legacy");
    const origins = articleChunks.find((c) => c.section === "Origins")!;
    expect(origins.body).toContain("Born in fire.");
    expect(origins.source_id).toBe("ar_one");
    expect(origins.id).toMatch(/^article:ar_one:section:/);
  });

  it("produces a single chunk for an article with no H2 headings", () => {
    const article = makeArticle({
      id: "ar_two",
      title: "Plain",
      sections: [
        {
          id: "s1",
          type: "richtext",
          title: "Overview",
          body: tipTapDoc([paragraph("Just a paragraph.")]),
        },
      ],
    });
    const chunks = chunkLore({
      lore: loreWith({ ar_two: article }),
      config: null,
      zones: [],
    });
    const articleChunks = chunks.filter((c) => c.kind === "article");
    expect(articleChunks).toHaveLength(1);
    expect(articleChunks[0]!.body).toContain("Just a paragraph.");
  });

  it("skips articles with empty bodies", () => {
    const article = makeArticle({ id: "empty", title: "Empty", content: "" });
    const chunks = chunkLore({
      lore: loreWith({ empty: article }),
      config: null,
      zones: [],
    });
    expect(chunks.filter((c) => c.kind === "article")).toHaveLength(0);
  });

  it("tags draft articles in metadata", () => {
    const article = makeArticle({
      id: "draft_one",
      title: "Draft",
      draft: true,
      sections: [
        {
          id: "s1",
          type: "richtext",
          title: "Body",
          body: tipTapDoc([paragraph("WIP content.")]),
        },
      ],
    });
    const chunks = chunkLore({
      lore: loreWith({ draft_one: article }),
      config: null,
      zones: [],
    });
    const draftChunk = chunks.find((c) => c.source_id === "draft_one");
    expect(draftChunk).toBeDefined();
    expect(draftChunk!.metadata.draft).toBe(true);
  });

  it("shapes timeline event chunks with date + era + description", () => {
    const lore = loreWith(
      {},
      {
        calendarSystems: [
          {
            id: "cal1",
            name: "Reckoning",
            eras: [{ id: "first", name: "First Age", startYear: 0 }],
          },
        ],
        timelineEvents: [
          {
            id: "ev1",
            calendarId: "cal1",
            eraId: "first",
            year: 142,
            title: "The Founding",
            description: "Walls rise.",
            importance: "major",
          },
        ],
      },
    );
    const chunks = chunkLore({ lore, config: null, zones: [] });
    const event = chunks.find((c) => c.kind === "event")!;
    expect(event.id).toBe("event:ev1");
    expect(event.title).toBe("The Founding");
    expect(event.body).toContain("142");
    expect(event.body).toContain("First Age");
    expect(event.body).toContain("Walls rise.");
    expect(event.metadata.era).toBe("First Age");
  });

  it("humanizes relationship types and skips trivial mentions", () => {
    const articles: Record<string, Article> = {
      a1: makeArticle({
        id: "a1",
        title: "Aria",
        relations: [
          { targetId: "a2", type: "child_of" },
          { targetId: "a3", type: "mentions" },
        ],
      }),
      a2: makeArticle({ id: "a2", title: "Mira" }),
      a3: makeArticle({ id: "a3", title: "Other" }),
    };
    const chunks = chunkLore({
      lore: loreWith(articles),
      config: null,
      zones: [],
    });
    const rels = chunks.filter((c) => c.kind === "relationship");
    expect(rels).toHaveLength(1);
    expect(rels[0]!.body).toContain("child of");
    expect(rels[0]!.body).toContain("Aria");
    expect(rels[0]!.body).toContain("Mira");
    expect(rels[0]!.id).toBe("rel:a1:a2:child_of");
  });

  it("produces entity chunks from config races/classes/abilities and zone mobs/items", () => {
    const chunks = chunkLore({
      lore: null,
      config: {
        races: {
          elf: {
            displayName: "Elf",
            backstory: "Ancient kin.",
            bodyDescription: "Tall and lithe.",
          },
        },
        classes: {
          mage: { displayName: "Mage", description: "Wields arcane fire.", hpScalingRate: 1.08, manaScalingRate: 1.12 },
        },
        abilities: {
          firebolt: {
            displayName: "Firebolt",
            description: "Hurls flame.",
            manaCost: 5,
            cooldownMs: 1000,
            levelRequired: 1,
            targetType: "single",
            effect: { type: "damage" },
          },
        },
      } as never,
      zones: [
        {
          zoneId: "ashfen",
          data: {
            zone: "ashfen",
            rooms: {},
            mobs: { goblin: { name: "Goblin", description: "Mean little thing." } },
            items: { sword: { displayName: "Sword", description: "Sharp." } },
          } as never,
        },
      ],
    });
    const kinds = chunks.map((c) => `${c.kind}:${c.metadata.entityKind}:${c.metadata.fieldName}`);
    expect(kinds).toContain("entity:race:backstory");
    expect(kinds).toContain("entity:race:bodyDescription");
    expect(kinds).toContain("entity:class:description");
    expect(kinds).toContain("entity:ability:description");
    expect(kinds).toContain("entity:mob:description");
    expect(kinds).toContain("entity:item:description");
    const mob = chunks.find((c) => c.metadata.entityKind === "mob")!;
    expect(mob.id).toBe("entity:mob:ashfen:goblin:description");
    expect(mob.metadata.zoneId).toBe("ashfen");
  });
});
