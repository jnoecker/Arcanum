import { describe, it, expect } from "vitest";
import { buildLoreChatPrompt, parseChatSegments } from "../loreChatContext";
import type { Article, WorldLore } from "@/types/lore";

function mkArticle(partial: Partial<Article> & { id: string; title: string }): Article {
  return {
    template: "freeform",
    fields: {},
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function mkLore(articles: Article[]): WorldLore {
  return {
    version: 2,
    articles: Object.fromEntries(articles.map((a) => [a.id, a])),
  };
}

describe("buildLoreChatPrompt", () => {
  it("includes every article in small-world mode", () => {
    const lore = mkLore([
      mkArticle({ id: "a", title: "Alpha", content: "First entry." }),
      mkArticle({ id: "b", title: "Beta", content: "Second entry." }),
    ]);
    const { systemPrompt, articlesUsed } = buildLoreChatPrompt(lore, "What's here?");
    expect(articlesUsed.sort()).toEqual(["a", "b"]);
    expect(systemPrompt).toContain("[Alpha]");
    expect(systemPrompt).toContain("[Beta]");
  });

  it("keyword-filters in large-world mode and expands via relations", () => {
    const many: Article[] = [];
    for (let i = 0; i < 45; i++) {
      many.push(mkArticle({ id: `f${i}`, title: `Filler ${i}`, content: "nothing relevant" }));
    }
    many.push(
      mkArticle({
        id: "dragon",
        title: "Obsidian Dragon",
        content: "A fearsome wyrm.",
        relations: [{ targetId: "lair", type: "dwells in" }],
      }),
    );
    many.push(mkArticle({ id: "lair", title: "Ashen Caldera", content: "Volcanic ruin." }));
    const lore = mkLore(many);

    const { articlesUsed, systemPrompt } = buildLoreChatPrompt(lore, "tell me about the dragon");
    expect(articlesUsed).toContain("dragon");
    // Relation expansion pulls in the lair even though the query didn't mention it
    expect(articlesUsed).toContain("lair");
    expect(systemPrompt).toContain("[Obsidian Dragon]");
    expect(systemPrompt).toContain("[Ashen Caldera]");
    // Filler articles with no keyword match should not appear
    expect(articlesUsed).not.toContain("f0");
  });

  it("embeds history and new question into user prompt", () => {
    const lore = mkLore([mkArticle({ id: "a", title: "Alpha" })]);
    const { userPrompt } = buildLoreChatPrompt(
      lore,
      "Second question?",
      [
        { role: "user", content: "First question?" },
        { role: "assistant", content: "A prior answer." },
      ],
    );
    expect(userPrompt).toContain("User: First question?");
    expect(userPrompt).toContain("Archivist: A prior answer.");
    expect(userPrompt).toContain("User: Second question?");
    expect(userPrompt.trimEnd().endsWith("Archivist:")).toBe(true);
  });

  it("emits citation instructions in the system prompt", () => {
    const lore = mkLore([mkArticle({ id: "a", title: "Alpha" })]);
    const { systemPrompt } = buildLoreChatPrompt(lore, "x");
    expect(systemPrompt.toLowerCase()).toContain("cite");
    expect(systemPrompt).toMatch(/\[[^\]]+\]/);
  });

  it("handles an empty world gracefully", () => {
    const lore = mkLore([]);
    const { systemPrompt, articlesUsed } = buildLoreChatPrompt(lore, "anything?");
    expect(articlesUsed).toEqual([]);
    expect(systemPrompt).toContain("No articles yet");
  });
});

describe("parseChatSegments", () => {
  const articles = {
    dragon: {
      id: "dragon",
      template: "freeform" as const,
      title: "Obsidian Dragon",
      fields: {},
      content: "",
      createdAt: "",
      updatedAt: "",
    },
  };

  it("splits text and citations, linking known titles case-insensitively", () => {
    const segs = parseChatSegments(
      "The [obsidian dragon] sleeps beneath the mountain.",
      articles,
    );
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ kind: "text", text: "The " });
    expect(segs[1]).toEqual({ kind: "citation", text: "obsidian dragon", articleId: "dragon" });
    expect(segs[2]).toEqual({ kind: "text", text: " sleeps beneath the mountain." });
  });

  it("leaves unknown bracketed titles as literal text", () => {
    const segs = parseChatSegments("Beware the [Unknown Thing] at dusk.", articles);
    expect(segs.map((s) => s.kind)).toEqual(["text", "text", "text"]);
    expect(segs[1]).toEqual({ kind: "text", text: "[Unknown Thing]" });
  });

  it("returns a single text segment when there are no brackets", () => {
    const segs = parseChatSegments("plain answer", articles);
    expect(segs).toEqual([{ kind: "text", text: "plain answer" }]);
  });
});
