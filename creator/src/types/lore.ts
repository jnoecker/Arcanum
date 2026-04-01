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
  | "profession"
  | "ability"
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
  privateNotes?: string;
  tags?: string[];
  relations?: ArticleRelation[];
  image?: string;
  draft?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Color labels (reusable named colors for pins, races, etc.) ───

export interface ColorLabel {
  id: string;
  name: string;
  color: string;
}

// ─── Maps ──────────────────────────────────────────────────────────

export interface MapPin {
  id: string;
  articleId?: string;
  position: [number, number];
  label?: string;
  color?: string;
}

export interface LoreMap {
  id: string;
  title: string;
  imageAsset: string;
  width: number;
  height: number;
  pins: MapPin[];
}

// ─── Calendars & Timelines ─────────────────────────────────────────

export interface CalendarEra {
  id: string;
  name: string;
  startYear: number;
  color?: string;
}

export interface CalendarSystem {
  id: string;
  name: string;
  eras: CalendarEra[];
}

export interface TimelineEvent {
  id: string;
  articleId?: string;
  calendarId: string;
  eraId: string;
  year: number;
  title: string;
  description?: string;
  importance: "minor" | "major" | "legendary";
}

// ─── Documents (internal notes, lore bibles) ─────────────────────

export interface LoreDocument {
  id: string;
  title: string;
  content: string;
  filename?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Template metadata overrides ──────────────────────────────────

export interface TemplateOverrides {
  description?: string;
  aiDescription?: string;
}

// ─── Top-level lore container ──────────────────────────────────────

export interface WorldLore {
  version: 2;
  articles: Record<string, Article>;
  colorLabels?: ColorLabel[];
  maps?: LoreMap[];
  calendarSystems?: CalendarSystem[];
  timelineEvents?: TimelineEvent[];
  documents?: LoreDocument[];
  templateOverrides?: Partial<Record<ArticleTemplate, TemplateOverrides>>;
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
