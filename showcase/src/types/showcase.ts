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
  | "freeform";

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
}
