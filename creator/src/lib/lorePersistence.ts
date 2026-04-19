import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseDocument, stringify } from "yaml";
import { useLoreStore } from "@/stores/loreStore";
import { DEFAULT_WORLD_LORE } from "@/types/lore";
import type { WorldLore, WorldLoreV1, Article, ArticleRelation, ArticleTemplate, LoreDocument, TemplateOverrides, ShowcaseSettings, CustomTemplateDefinition, CustomSceneTemplate, ArtStyle, ZonePlan, ChatSession } from "@/types/lore";
import type { Project } from "@/types/project";
import { CODEX_CATEGORY_TO_TEMPLATE } from "@/lib/loreTemplates";
import { YAML_OPTS } from "@/lib/yamlOpts";

export function lorePath(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/lore.yaml`
    : `${project.mudDir}/src/main/resources/lore.yaml`;
}

export async function loadLore(project: Project): Promise<WorldLore> {
  const path = lorePath(project);
  try {
    if (!(await exists(path))) return { ...DEFAULT_WORLD_LORE };
    const content = await readTextFile(path);
    const doc = parseDocument(content);
    const raw = (doc.toJS() ?? {}) as Record<string, unknown>;

    // Detect format: v2 has a `version` field
    if (raw.version === 2 && raw.articles) {
      return {
        version: 2,
        articles: (raw.articles as Record<string, Article>) ?? {},
        colorLabels: Array.isArray(raw.colorLabels) ? (raw.colorLabels as WorldLore["colorLabels"]) : undefined,
        maps: Array.isArray(raw.maps) ? (raw.maps as WorldLore["maps"]) : undefined,
        calendarSystems: Array.isArray(raw.calendarSystems) ? (raw.calendarSystems as WorldLore["calendarSystems"]) : undefined,
        timelineEvents: Array.isArray(raw.timelineEvents) ? (raw.timelineEvents as WorldLore["timelineEvents"]) : undefined,
        documents: Array.isArray(raw.documents) ? (raw.documents as LoreDocument[]) : undefined,
        templateOverrides: raw.templateOverrides && typeof raw.templateOverrides === "object"
          ? (raw.templateOverrides as Partial<Record<ArticleTemplate, TemplateOverrides>>)
          : undefined,
        showcaseSettings: raw.showcaseSettings && typeof raw.showcaseSettings === "object"
          ? (raw.showcaseSettings as ShowcaseSettings)
          : undefined,
        customTemplates: Array.isArray(raw.customTemplates) ? (raw.customTemplates as CustomTemplateDefinition[]) : undefined,
        customSceneTemplates: Array.isArray(raw.customSceneTemplates) ? (raw.customSceneTemplates as CustomSceneTemplate[]) : undefined,
        artStyles: Array.isArray(raw.artStyles) ? (raw.artStyles as ArtStyle[]) : undefined,
        activeArtStyleId: typeof raw.activeArtStyleId === "string" ? raw.activeArtStyleId : undefined,
        zonePlans: Array.isArray(raw.zonePlans) ? (raw.zonePlans as ZonePlan[]) : undefined,
        chatSession: raw.chatSession && typeof raw.chatSession === "object" && Array.isArray((raw.chatSession as { messages?: unknown }).messages)
          ? (raw.chatSession as ChatSession)
          : undefined,
      };
    }

    // V1 format: migrate
    const v1: WorldLoreV1 = {
      setting: (raw.setting as WorldLoreV1["setting"]) ?? {},
      factions: (raw.factions as WorldLoreV1["factions"]) ?? {},
      codex: (raw.codex as WorldLoreV1["codex"]) ?? {},
    };
    return migrateV1toV2(v1);
  } catch {
    return { ...DEFAULT_WORLD_LORE };
  }
}

export async function saveLore(project: Project): Promise<void> {
  const state = useLoreStore.getState();
  const lore = state.lore;
  if (!lore) return;

  const path = lorePath(project);
  await writeTextFile(path, stringify(lore, YAML_OPTS));
  state.markClean();
}

// ─── V1 → V2 migration ─────────────────────────────────────────────

export function migrateV1toV2(v1: WorldLoreV1): WorldLore {
  const articles: Record<string, Article> = {};
  const now = new Date().toISOString();

  // Migrate WorldSetting → single "world_setting" article
  const s = v1.setting;
  if (s.name || s.overview || s.history || s.geography || s.magic || s.technology) {
    articles.world_setting = {
      id: "world_setting",
      template: "world_setting",
      title: s.name || "World Setting",
      fields: {
        name: s.name,
        tagline: s.tagline,
        era: s.era,
        themes: s.themes,
        geography: s.geography,
        magic: s.magic,
        technology: s.technology,
        history: s.history,
      },
      content: s.overview ?? "",
      tags: s.themes,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Migrate Factions → "organization" articles
  for (const [id, faction] of Object.entries(v1.factions)) {
    const relations: ArticleRelation[] = [];
    for (const ally of faction.allies ?? []) {
      relations.push({ targetId: ally, type: "ally" });
    }
    for (const rival of faction.rivals ?? []) {
      relations.push({ targetId: rival, type: "rival" });
    }
    articles[id] = {
      id,
      template: "organization",
      title: faction.displayName,
      fields: {
        motto: faction.motto,
        territory: faction.territory,
        leader: faction.leader,
        values: faction.values,
      },
      content: faction.description ?? "",
      image: faction.image,
      relations: relations.length > 0 ? relations : undefined,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Migrate CodexEntries → typed articles
  for (const [id, entry] of Object.entries(v1.codex)) {
    const template: ArticleTemplate =
      CODEX_CATEGORY_TO_TEMPLATE[entry.category ?? ""] ?? "freeform";
    const relations: ArticleRelation[] = (entry.relatedEntries ?? []).map(
      (targetId) => ({ targetId, type: "related" }),
    );
    articles[id] = {
      id,
      template,
      title: entry.title,
      fields: { category: entry.category },
      content: entry.content,
      tags: entry.tags,
      relations: relations.length > 0 ? relations : undefined,
      createdAt: now,
      updatedAt: now,
    };
  }

  return { version: 2, articles };
}
