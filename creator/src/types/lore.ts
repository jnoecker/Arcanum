// ─── Lore & World Building ──────────────────────────────────────────
// Creator-only data model. Not deployed to the MUD server.

// ─── Article system (v2) ────────────────────────────────────────────

export type ArticleTemplate =
  | "world_setting"
  | "character"
  | "location"
  | "organization"
  | "item"
  | "species"
  | "event"
  | "language"
  | "freeform";

export interface ArticleRelation {
  targetId: string;
  type: string;
  label?: string;
}

export interface Article {
  id: string;
  template: ArticleTemplate;
  title: string;
  parentId?: string;
  sortOrder?: number;
  fields: Record<string, unknown>;
  content: string;
  tags?: string[];
  relations?: ArticleRelation[];
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorldLore {
  version: 2;
  articles: Record<string, Article>;
}

export const DEFAULT_WORLD_LORE: WorldLore = {
  version: 2,
  articles: {},
};

// ─── V1 interfaces (for migration only) ────────────────────────────

export interface WorldSettingV1 {
  name?: string;
  tagline?: string;
  overview?: string;
  history?: string;
  themes?: string[];
  era?: string;
  geography?: string;
  magic?: string;
  technology?: string;
}

export interface FactionV1 {
  displayName: string;
  description?: string;
  motto?: string;
  territory?: string;
  allies?: string[];
  rivals?: string[];
  leader?: string;
  values?: string[];
  image?: string;
}

export interface CodexEntryV1 {
  title: string;
  category?: string;
  content: string;
  tags?: string[];
  relatedEntries?: string[];
}

export interface WorldLoreV1 {
  setting: WorldSettingV1;
  factions: Record<string, FactionV1>;
  codex: Record<string, CodexEntryV1>;
}
