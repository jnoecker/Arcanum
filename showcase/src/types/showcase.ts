// Mirrors the ShowcaseData shape from creator/src/lib/exportShowcase.ts

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

export interface ArticleRelation {
  targetId: string;
  type: string;
  label?: string;
}

export interface ShowcaseArticle {
  id: string;
  template: ArticleTemplate;
  title: string;
  fields: Record<string, unknown>;
  contentHtml: string;
  tags: string[];
  relations: ArticleRelation[];
  imageUrl?: string;
  galleryUrls?: string[];
  createdAt: string;
  updatedAt: string;
  /** Pre-computed plain text for search (stripped HTML, lowercased). Added at load time. */
  searchText?: string;
}

export interface ShowcaseMap {
  id: string;
  title: string;
  imageUrl: string;
  width: number;
  height: number;
  pins: ShowcasePin[];
}

export interface ShowcasePin {
  id: string;
  articleId?: string;
  position: [number, number];
  label?: string;
  color?: string;
}

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

export interface ColorLabel {
  id: string;
  name: string;
  color: string;
}

export interface ShowcaseBranding {
  navLogoText?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerImage?: string;
  faviconUrl?: string;
  accentColor?: string;
  bgColor?: string;
  footerText?: string;
}

export type TitleCardStyle = "location" | "year" | "subtitle" | "character";

export interface ShowcaseScene {
  id: string;
  title: string;
  sortOrder: number;
  roomImageUrl?: string;
  narration?: string;
  narrationHtml?: string;
  transition?: { type: "crossfade" | "fade_black" };
  narrationSpeed?: "slow" | "normal" | "fast";
  entities: Array<{
    id: string;
    entityType: "mob" | "item" | "npc";
    entityId: string;
    name: string;
    imageUrl?: string;
    slot?: string;
    position?: { x: number; y: number };
    entrancePath?: string;
    exitPath?: string;
  }>;
  // ─── Lore links ──────────────────────────────────────────────────
  linkedArticleIds?: string[];
  linkedLocationArticleId?: string;
  linkedMapId?: string;
  linkedPinId?: string;
  linkedTimelineEventId?: string;
  // ─── Visual overlays ─────────────────────────────────────────────
  titleCard?: { text: string; style?: TitleCardStyle };
  effects?: { particles?: string; parallaxLayers?: number; parallaxDepth?: number };
}

export interface ShowcaseStory {
  id: string;
  title: string;
  zoneId: string;
  zoneName?: string;
  coverImageUrl?: string;
  sceneCount: number;
  scenes: ShowcaseScene[];
  narrationSpeed?: "slow" | "normal" | "fast";
  createdAt: string;
  updatedAt: string;
  // ─── Story metadata ──────────────────────────────────────────────
  synopsis?: string;
  tags?: string[];
  // ─── Story-level lore links ──────────────────────────────────────
  linkedArticleIds?: string[];
  featuredCharacterIds?: string[];
  primaryMapId?: string;
  primaryCalendarId?: string;
}

export interface ShowcaseData {
  meta: {
    worldName: string;
    tagline?: string;
    exportedAt: string;
    imageBaseUrl: string;
    showcase?: ShowcaseBranding;
  };
  articles: ShowcaseArticle[];
  maps: ShowcaseMap[];
  calendarSystems?: CalendarSystem[];
  timelineEvents?: TimelineEvent[];
  colorLabels?: ColorLabel[];
  stories?: ShowcaseStory[];
}
