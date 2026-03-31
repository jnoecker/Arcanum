import { create } from "zustand";
import type { WorldLore, Article, ArticleTemplate, ColorLabel, LoreMap, MapPin, CalendarSystem, TimelineEvent } from "@/types/lore";

// Stable empty references for selectors (prevents infinite re-render loops)
const EMPTY_ARTICLES: Record<string, Article> = {};
const EMPTY_MAPS: LoreMap[] = [];
const EMPTY_CALENDARS: CalendarSystem[] = [];
const EMPTY_EVENTS: TimelineEvent[] = [];
const EMPTY_COLOR_LABELS: ColorLabel[] = [];

/** Safe selector: returns lore.articles or a stable empty object. */
export const selectArticles = (s: { lore: WorldLore | null }) => s.lore?.articles ?? EMPTY_ARTICLES;
/** Safe selector: returns lore.maps or a stable empty array. */
export const selectMaps = (s: { lore: WorldLore | null }) => s.lore?.maps ?? EMPTY_MAPS;
/** Safe selector: returns lore.calendarSystems or a stable empty array. */
export const selectCalendars = (s: { lore: WorldLore | null }) => s.lore?.calendarSystems ?? EMPTY_CALENDARS;
/** Safe selector: returns lore.timelineEvents or a stable empty array. */
export const selectEvents = (s: { lore: WorldLore | null }) => s.lore?.timelineEvents ?? EMPTY_EVENTS;
/** Safe selector: returns lore.colorLabels or a stable empty array. */
export const selectColorLabels = (s: { lore: WorldLore | null }) => s.lore?.colorLabels ?? EMPTY_COLOR_LABELS;

interface LoreStore {
  lore: WorldLore | null;
  dirty: boolean;
  selectedArticleId: string | null;
  selectedMapId: string | null;

  setLore: (lore: WorldLore) => void;
  createArticle: (article: Article) => void;
  updateArticle: (id: string, patch: Partial<Article>) => void;
  deleteArticle: (id: string) => void;
  moveArticle: (id: string, newParentId: string | undefined, sortOrder: number) => void;
  selectArticle: (id: string | null) => void;

  /** Bulk-replace all articles of a given template (used by legacy panel adapters). */
  replaceArticlesByTemplate: (
    template: ArticleTemplate,
    articles: Record<string, Article>,
  ) => void;

  // Color label operations
  addColorLabel: (label: ColorLabel) => void;
  updateColorLabel: (id: string, patch: Partial<ColorLabel>) => void;
  removeColorLabel: (id: string) => void;

  // Map operations
  createMap: (map: LoreMap) => void;
  updateMap: (id: string, patch: Partial<LoreMap>) => void;
  deleteMap: (id: string) => void;
  selectMap: (id: string | null) => void;
  addPin: (mapId: string, pin: MapPin) => void;
  updatePin: (mapId: string, pinId: string, patch: Partial<MapPin>) => void;
  removePin: (mapId: string, pinId: string) => void;

  // Calendar & timeline operations
  setCalendarSystems: (systems: CalendarSystem[]) => void;
  setTimelineEvents: (events: TimelineEvent[]) => void;
  addTimelineEvent: (event: TimelineEvent) => void;
  updateTimelineEvent: (id: string, patch: Partial<TimelineEvent>) => void;
  deleteTimelineEvent: (id: string) => void;

  markClean: () => void;
  clearLore: () => void;
}

export const useLoreStore = create<LoreStore>((set) => ({
  lore: null,
  dirty: false,
  selectedArticleId: null,
  selectedMapId: null,

  setLore: (lore) => set({ lore, dirty: false }),

  createArticle: (article) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        lore: {
          ...s.lore,
          articles: { ...s.lore.articles, [article.id]: article },
        },
        dirty: true,
      };
    }),

  updateArticle: (id, patch) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.articles[id];
      if (!existing) return s;
      return {
        lore: {
          ...s.lore,
          articles: {
            ...s.lore.articles,
            [id]: { ...existing, ...patch, updatedAt: new Date().toISOString() },
          },
        },
        dirty: true,
      };
    }),

  deleteArticle: (id) =>
    set((s) => {
      if (!s.lore || !s.lore.articles[id]) return s;
      const { [id]: _, ...rest } = s.lore.articles;
      return {
        lore: { ...s.lore, articles: rest },
        dirty: true,
        selectedArticleId: s.selectedArticleId === id ? null : s.selectedArticleId,
      };
    }),

  moveArticle: (id, newParentId, sortOrder) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.articles[id];
      if (!existing) return s;
      return {
        lore: {
          ...s.lore,
          articles: {
            ...s.lore.articles,
            [id]: { ...existing, parentId: newParentId, sortOrder, updatedAt: new Date().toISOString() },
          },
        },
        dirty: true,
      };
    }),

  selectArticle: (id) => set({ selectedArticleId: id }),

  replaceArticlesByTemplate: (template, articles) =>
    set((s) => {
      if (!s.lore) return s;
      // Remove all existing articles of this template, then add the new ones
      const kept: Record<string, Article> = {};
      for (const [id, a] of Object.entries(s.lore.articles)) {
        if (a.template !== template) kept[id] = a;
      }
      return {
        lore: { ...s.lore, articles: { ...kept, ...articles } },
        dirty: true,
      };
    }),

  // ─── Color label operations ────────────────────────────────────
  addColorLabel: (label) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        lore: { ...s.lore, colorLabels: [...(s.lore.colorLabels ?? []), label] },
        dirty: true,
      };
    }),

  updateColorLabel: (id, patch) =>
    set((s) => {
      if (!s.lore?.colorLabels) return s;
      return {
        lore: {
          ...s.lore,
          colorLabels: s.lore.colorLabels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        },
        dirty: true,
      };
    }),

  removeColorLabel: (id) =>
    set((s) => {
      if (!s.lore?.colorLabels) return s;
      return {
        lore: { ...s.lore, colorLabels: s.lore.colorLabels.filter((l) => l.id !== id) },
        dirty: true,
      };
    }),

  // ─── Map operations ────────────────────────────────────────────
  createMap: (map) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        lore: { ...s.lore, maps: [...(s.lore.maps ?? []), map] },
        dirty: true,
        selectedMapId: map.id,
      };
    }),

  updateMap: (id, patch) =>
    set((s) => {
      if (!s.lore?.maps) return s;
      return {
        lore: {
          ...s.lore,
          maps: s.lore.maps.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        },
        dirty: true,
      };
    }),

  deleteMap: (id) =>
    set((s) => {
      if (!s.lore?.maps) return s;
      return {
        lore: { ...s.lore, maps: s.lore.maps.filter((m) => m.id !== id) },
        dirty: true,
        selectedMapId: s.selectedMapId === id ? null : s.selectedMapId,
      };
    }),

  selectMap: (id) => set({ selectedMapId: id }),

  addPin: (mapId, pin) =>
    set((s) => {
      if (!s.lore?.maps) return s;
      return {
        lore: {
          ...s.lore,
          maps: s.lore.maps.map((m) =>
            m.id === mapId ? { ...m, pins: [...m.pins, pin] } : m,
          ),
        },
        dirty: true,
      };
    }),

  updatePin: (mapId, pinId, patch) =>
    set((s) => {
      if (!s.lore?.maps) return s;
      return {
        lore: {
          ...s.lore,
          maps: s.lore.maps.map((m) =>
            m.id === mapId
              ? { ...m, pins: m.pins.map((p) => (p.id === pinId ? { ...p, ...patch } : p)) }
              : m,
          ),
        },
        dirty: true,
      };
    }),

  removePin: (mapId, pinId) =>
    set((s) => {
      if (!s.lore?.maps) return s;
      return {
        lore: {
          ...s.lore,
          maps: s.lore.maps.map((m) =>
            m.id === mapId ? { ...m, pins: m.pins.filter((p) => p.id !== pinId) } : m,
          ),
        },
        dirty: true,
      };
    }),

  // ─── Calendar & timeline operations ────────────────────────────
  setCalendarSystems: (systems) =>
    set((s) => {
      if (!s.lore) return s;
      return { lore: { ...s.lore, calendarSystems: systems }, dirty: true };
    }),

  setTimelineEvents: (events) =>
    set((s) => {
      if (!s.lore) return s;
      return { lore: { ...s.lore, timelineEvents: events }, dirty: true };
    }),

  addTimelineEvent: (event) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        lore: { ...s.lore, timelineEvents: [...(s.lore.timelineEvents ?? []), event] },
        dirty: true,
      };
    }),

  updateTimelineEvent: (id, patch) =>
    set((s) => {
      if (!s.lore?.timelineEvents) return s;
      return {
        lore: {
          ...s.lore,
          timelineEvents: s.lore.timelineEvents.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        },
        dirty: true,
      };
    }),

  deleteTimelineEvent: (id) =>
    set((s) => {
      if (!s.lore?.timelineEvents) return s;
      return {
        lore: { ...s.lore, timelineEvents: s.lore.timelineEvents.filter((e) => e.id !== id) },
        dirty: true,
      };
    }),

  markClean: () => set({ dirty: false }),
  clearLore: () => set({ lore: null, dirty: false, selectedArticleId: null, selectedMapId: null }),
}));
