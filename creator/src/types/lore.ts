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
  | "freeform"
  | "story";

/** Custom template ID — any string not in the built-in set */
export type CustomTemplateId = string;

/** Union of built-in and custom template identifiers */
export type TemplateId = ArticleTemplate | CustomTemplateId;

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
  gallery?: string[];
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

// ─── Custom template definitions ─────────────────────────────────

export interface CustomFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "tags" | "number";
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export interface CustomTemplateDefinition {
  id: string;
  displayName: string;
  pluralName: string;
  color: string;
  icon?: string;
  description?: string;
  aiDescription?: string;
  fields: CustomFieldDef[];
}

// ─── Showcase branding settings ────────────────────────────────────

export interface ShowcaseSettings {
  navLogoText?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerImage?: string;
  faviconUrl?: string;
  accentColor?: string;
  bgColor?: string;
  footerText?: string;
}

// ─── Custom scene templates ────────────────────────────────────────

/**
 * User-defined scene template. Mirrors the built-in scene template presets
 * (creator/src/lib/sceneTemplates.ts) but is editable from the lore tools.
 * The narration field stores TipTap JSON as a string.
 */
export interface CustomSceneTemplate {
  id: string;
  label: string;
  badgeColor: string;
  defaultTitle: string;
  defaultNarration: string;
}

// ─── Art styles ────────────────────────────────────────────────────

/** Per-surface prompt overrides appended after the base prompt. */
export interface ArtStyleSurfaces {
  /** Appended when generating worldbuilding art (sprites, rooms, entities, abilities, icons). */
  worldbuilding?: string;
  /** Appended when generating lore art (portraits, lore article illustrations). */
  lore?: string;
}

/**
 * A named, reusable art style definition. The active style's base prompt is
 * appended to every image generation prompt via `buildVisualStyleDirective()`,
 * with the matching surface override appended when a surface is provided.
 */
export interface ArtStyle {
  id: string;
  name: string;
  /** Short one-line summary, shown in the list. */
  description?: string;
  /** The core style prose. Appended to every image generation prompt. */
  basePrompt: string;
  /** Optional per-surface directives layered on top of basePrompt. */
  surfaces?: ArtStyleSurfaces;
  createdAt: string;
  updatedAt: string;
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
  showcaseSettings?: ShowcaseSettings;
  customTemplates?: CustomTemplateDefinition[];
  customSceneTemplates?: CustomSceneTemplate[];
  artStyles?: ArtStyle[];
  activeArtStyleId?: string;
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
