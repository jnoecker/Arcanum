import { describe, it, expect } from "vitest";
import { migrateLegacyTemplates } from "../loreMigrate";
import type { Article, WorldLore } from "@/types/lore";
import type { AppConfig } from "@/types/config";

function mkArticle(partial: Partial<Article> & { id: string; title: string; template: Article["template"] }): Article {
  return {
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

function mkConfig(opts: { races?: Record<string, string>; classes?: Record<string, string> }): AppConfig {
  const races: AppConfig["races"] = {};
  for (const [id, name] of Object.entries(opts.races ?? {})) {
    races[id] = { displayName: name };
  }
  const classes: AppConfig["classes"] = {};
  for (const [id, name] of Object.entries(opts.classes ?? {})) {
    classes[id] = { displayName: name, hpPerLevel: 10, manaPerLevel: 10 };
  }
  return { races, classes } as AppConfig;
}

describe("migrateLegacyTemplates", () => {
  it("reroutes species matching a gameplay race to ancestry", () => {
    const lore = mkLore([
      mkArticle({ id: "elf", title: "Sylflorae", template: "species" }),
      mkArticle({ id: "dragon", title: "Obsidian Wyrm", template: "species" }),
    ]);
    const config = mkConfig({ races: { sylflorae: "Sylflorae" } });

    const result = migrateLegacyTemplates(lore, config);
    expect(result.lore.articles.elf!.template).toBe("ancestry");
    expect(result.lore.articles.dragon!.template).toBe("bestiary");
    expect(result.speciesToAncestry).toBe(1);
    expect(result.speciesToBestiary).toBe(1);
  });

  it("matches against race id as well as displayName, case-insensitively", () => {
    const lore = mkLore([
      mkArticle({ id: "a", title: "SYLFLORAE", template: "species" }),
    ]);
    const config = mkConfig({ races: { sylflorae: "Sylflorae" } });

    const result = migrateLegacyTemplates(lore, config);
    expect(result.lore.articles.a!.template).toBe("ancestry");
  });

  it("reroutes profession matching a gameplay class to class, others to occupation", () => {
    const lore = mkLore([
      mkArticle({ id: "wiz", title: "Wizard", template: "profession" }),
      mkArticle({ id: "smith", title: "Blacksmith", template: "profession" }),
    ]);
    const config = mkConfig({ classes: { wizard: "Wizard" } });

    const result = migrateLegacyTemplates(lore, config);
    expect(result.lore.articles.wiz!.template).toBe("class");
    expect(result.lore.articles.smith!.template).toBe("occupation");
    expect(result.professionToClass).toBe(1);
    expect(result.professionToOccupation).toBe(1);
  });

  it("defaults to playable variants when the project has no gameplay races/classes (lore-first flow)", () => {
    const lore = mkLore([
      mkArticle({ id: "elf", title: "Sylflorae", template: "species" }),
      mkArticle({ id: "dragon", title: "Obsidian Wyrm", template: "species" }),
      mkArticle({ id: "wiz", title: "Wizard", template: "profession" }),
      mkArticle({ id: "smith", title: "Blacksmith", template: "profession" }),
    ]);

    const result = migrateLegacyTemplates(lore, null);
    // Lore-first: everything goes playable so the user can keep flowing
    // into gameplay scaffolding. They can flip individual entries (e.g. the
    // wyrm, the blacksmith) back to bestiary/occupation via the Inspector.
    expect(result.lore.articles.elf!.template).toBe("ancestry");
    expect(result.lore.articles.dragon!.template).toBe("ancestry");
    expect(result.lore.articles.wiz!.template).toBe("class");
    expect(result.lore.articles.smith!.template).toBe("class");
  });

  it("only routes non-matches to bestiary/occupation when gameplay races/classes do exist", () => {
    const lore = mkLore([
      mkArticle({ id: "elf", title: "Sylflorae", template: "species" }),
      mkArticle({ id: "dragon", title: "Obsidian Wyrm", template: "species" }),
    ]);
    const config = mkConfig({ races: { sylflorae: "Sylflorae" } });

    const result = migrateLegacyTemplates(lore, config);
    expect(result.lore.articles.elf!.template).toBe("ancestry");
    expect(result.lore.articles.dragon!.template).toBe("bestiary");
  });

  it("leaves non-legacy templates untouched and returns the same lore reference when nothing changes", () => {
    const lore = mkLore([
      mkArticle({ id: "a", title: "Astriel", template: "character" }),
      mkArticle({ id: "p", title: "Veilspire", template: "location" }),
    ]);
    const config = mkConfig({});

    const result = migrateLegacyTemplates(lore, config);
    expect(result.lore).toBe(lore);
    expect(result.speciesToAncestry).toBe(0);
    expect(result.professionToClass).toBe(0);
  });

  it("reroutes ability articles linked to a class via profession ref to talent", () => {
    const lore = mkLore([
      mkArticle({ id: "wiz", title: "Wizard", template: "profession" }),
      mkArticle({
        id: "fireball",
        title: "Fireball",
        template: "ability",
        fields: { profession: "wiz" },
      }),
      mkArticle({
        id: "draconic_roar",
        title: "Draconic Roar",
        template: "ability",
        fields: {},
      }),
    ]);
    const config = mkConfig({ classes: { wizard: "Wizard" } });

    const result = migrateLegacyTemplates(lore, config);
    // profession ref points at an article that migrates to class → talent
    expect(result.lore.articles.fireball!.template).toBe("talent");
    // no class ref, project has gameplay classes → creature_power
    expect(result.lore.articles.draconic_roar!.template).toBe("creature_power");
    expect(result.abilityToTalent).toBe(1);
    expect(result.abilityToCreaturePower).toBe(1);
  });

  it("defaults orphan ability articles to talent in lore-first mode", () => {
    const lore = mkLore([
      mkArticle({ id: "spark", title: "Cantrip Spark", template: "ability", fields: {} }),
    ]);

    const result = migrateLegacyTemplates(lore, null);
    expect(result.lore.articles.spark!.template).toBe("talent");
    expect(result.abilityToTalent).toBe(1);
  });
});
