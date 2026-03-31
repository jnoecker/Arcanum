import { describe, it, expect } from "vitest";
import { migrateV1toV2 } from "../lorePersistence";
import type { WorldLoreV1 } from "@/types/lore";

describe("migrateV1toV2", () => {
  it("returns empty articles for empty v1 lore", () => {
    const v1: WorldLoreV1 = { setting: {}, factions: {}, codex: {} };
    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
    expect(Object.keys(v2.articles)).toHaveLength(0);
  });

  it("migrates world setting to a world_setting article", () => {
    const v1: WorldLoreV1 = {
      setting: {
        name: "Ambon",
        tagline: "Where the veil is thin",
        era: "Age of Fractures",
        themes: ["dark fantasy", "cosmic horror"],
        overview: "A world between worlds.",
        history: "Long ago...",
        geography: "Mountains and seas.",
        magic: "Arcane and divine.",
        technology: "Medieval.",
      },
      factions: {},
      codex: {},
    };

    const v2 = migrateV1toV2(v1);
    const ws = v2.articles.world_setting;
    expect(ws).toBeDefined();
    expect(ws!.template).toBe("world_setting");
    expect(ws!.title).toBe("Ambon");
    expect(ws!.content).toBe("A world between worlds.");
    expect(ws!.fields.name).toBe("Ambon");
    expect(ws!.fields.tagline).toBe("Where the veil is thin");
    expect(ws!.fields.era).toBe("Age of Fractures");
    expect(ws!.fields.themes).toEqual(["dark fantasy", "cosmic horror"]);
    expect(ws!.fields.history).toBe("Long ago...");
    expect(ws!.fields.geography).toBe("Mountains and seas.");
    expect(ws!.fields.magic).toBe("Arcane and divine.");
    expect(ws!.fields.technology).toBe("Medieval.");
  });

  it("migrates factions to organization articles with relations", () => {
    const v1: WorldLoreV1 = {
      setting: {},
      factions: {
        silver_order: {
          displayName: "The Silver Order",
          description: "Holy knights.",
          motto: "Light prevails",
          territory: "The Citadel",
          leader: "Commander Aldric",
          values: ["honor", "duty"],
          allies: ["dawn_guard"],
          rivals: ["shadow_court"],
          image: "silver_order.png",
        },
        dawn_guard: {
          displayName: "Dawn Guard",
          description: "Rangers of the frontier.",
        },
      },
      codex: {},
    };

    const v2 = migrateV1toV2(v1);

    const so = v2.articles.silver_order;
    expect(so).toBeDefined();
    expect(so!.template).toBe("organization");
    expect(so!.title).toBe("The Silver Order");
    expect(so!.content).toBe("Holy knights.");
    expect(so!.fields.motto).toBe("Light prevails");
    expect(so!.fields.territory).toBe("The Citadel");
    expect(so!.fields.leader).toBe("Commander Aldric");
    expect(so!.fields.values).toEqual(["honor", "duty"]);
    expect(so!.image).toBe("silver_order.png");
    expect(so!.relations).toEqual([
      { targetId: "dawn_guard", type: "ally" },
      { targetId: "shadow_court", type: "rival" },
    ]);

    const dg = v2.articles.dawn_guard;
    expect(dg).toBeDefined();
    expect(dg!.template).toBe("organization");
    expect(dg!.title).toBe("Dawn Guard");
    expect(dg!.relations).toBeUndefined();
  });

  it("migrates codex entries with category-based template inference", () => {
    const v1: WorldLoreV1 = {
      setting: {},
      factions: {},
      codex: {
        dragon_peak: {
          title: "Dragon Peak",
          category: "places",
          content: "A volcanic mountain.",
          tags: ["dangerous", "remote"],
          relatedEntries: ["fire_drake"],
        },
        fire_drake: {
          title: "Fire Drake",
          category: "creatures",
          content: "A lesser dragon.",
          tags: ["beast"],
        },
        old_legend: {
          title: "The Lost King",
          category: "legends",
          content: "Once upon a time...",
        },
        iron_ore: {
          title: "Iron Ore",
          category: "materials",
          content: "Common crafting material.",
        },
        no_category: {
          title: "Miscellaneous",
          content: "Some freeform lore.",
        },
      },
    };

    const v2 = migrateV1toV2(v1);

    expect(v2.articles.dragon_peak!.template).toBe("location");
    expect(v2.articles.dragon_peak!.tags).toEqual(["dangerous", "remote"]);
    expect(v2.articles.dragon_peak!.relations).toEqual([
      { targetId: "fire_drake", type: "related" },
    ]);

    expect(v2.articles.fire_drake!.template).toBe("species");
    expect(v2.articles.old_legend!.template).toBe("freeform");
    expect(v2.articles.iron_ore!.template).toBe("item");
    expect(v2.articles.no_category!.template).toBe("freeform");
  });

  it("migrates a full v1 lore file with all sections", () => {
    const v1: WorldLoreV1 = {
      setting: { name: "Testworld", overview: "A test." },
      factions: { guild: { displayName: "The Guild" } },
      codex: { place: { title: "A Place", category: "places", content: "Here." } },
    };

    const v2 = migrateV1toV2(v1);
    expect(Object.keys(v2.articles)).toHaveLength(3);
    expect(v2.articles.world_setting).toBeDefined();
    expect(v2.articles.guild).toBeDefined();
    expect(v2.articles.place).toBeDefined();
  });
});
