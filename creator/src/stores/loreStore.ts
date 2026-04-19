import { create } from "zustand";
import type { WorldLore, Article, ArticleTemplate, ColorLabel, LoreMap, MapPin, CalendarSystem, TimelineEvent, LoreDocument, TemplateOverrides, ShowcaseSettings, CustomTemplateDefinition, CustomSceneTemplate, ArtStyle, ZonePlan, ChatMessage } from "@/types/lore";
import { snapshot as histSnapshot, undo as histUndo, redo as histRedo } from "@/lib/historyStack";
import { HISTORY_DEPTHS } from "@/lib/historyDepths";

const MAX_LORE_HISTORY = HISTORY_DEPTHS.LORE;

// Stable empty references for selectors (prevents infinite re-render loops)
const EMPTY_ARTICLES: Record<string, Article> = {};
const EMPTY_MAPS: LoreMap[] = [];
const EMPTY_CALENDARS: CalendarSystem[] = [];
const EMPTY_EVENTS: TimelineEvent[] = [];
const EMPTY_COLOR_LABELS: ColorLabel[] = [];
const EMPTY_DOCUMENTS: LoreDocument[] = [];
const EMPTY_ZONE_PLANS: ZonePlan[] = [];

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
export const selectDocuments = (s: { lore: WorldLore | null }) => s.lore?.documents ?? EMPTY_DOCUMENTS;
/** Safe selector: returns lore.zonePlans or a stable empty array. */
export const selectZonePlans = (s: { lore: WorldLore | null }) => s.lore?.zonePlans ?? EMPTY_ZONE_PLANS;
/** Selector: count of lore articles (returns a primitive). */
export const selectArticleCount = (s: { lore: WorldLore | null }) => Object.keys(s.lore?.articles ?? EMPTY_ARTICLES).length;

/** Snapshot the current lore onto the undo stack, clearing the redo stack. */
function snapshotLore(state: LoreState): Pick<LoreState, "lorePast" | "loreFuture"> {
  if (!state.lore) return { lorePast: state.lorePast, loreFuture: state.loreFuture };
  const { past, future } = histSnapshot(state.lorePast, structuredClone(state.lore), MAX_LORE_HISTORY);
  return { lorePast: past, loreFuture: future };
}

interface LoreState {
  lore: WorldLore | null;
  dirty: boolean;
  lorePast: WorldLore[];
  loreFuture: WorldLore[];
  selectedArticleId: string | null;
  selectedMapId: string | null;
  selectedArticleIds: Set<string>;
}

interface LoreStore extends LoreState {
  setLore: (lore: WorldLore) => void;
  createArticle: (article: Article) => void;
  updateArticle: (id: string, patch: Partial<Article>) => void;
  renameArticle: (oldId: string, newId: string) => void;
  deleteArticle: (id: string) => void;
  duplicateArticle: (id: string) => void;
  moveArticle: (id: string, newParentId: string | undefined, sortOrder: number) => void;
  selectArticle: (id: string | null) => void;

  // Multi-select operations
  toggleArticleSelection: (id: string) => void;
  selectAllArticles: () => void;
  clearArticleSelection: () => void;

  // Bulk mutation operations
  bulkDelete: (ids: string[]) => void;
  bulkSetDraft: (ids: string[], draft: boolean) => void;
  bulkAddTags: (ids: string[], tags: string[]) => void;
  bulkRemoveTags: (ids: string[], tags: string[]) => void;
  bulkReparent: (ids: string[], parentId: string | undefined) => void;
  bulkChangeTemplate: (ids: string[], newTemplate: string) => void;

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

  // Document operations
  createDocument: (doc: LoreDocument) => void;
  updateDocument: (id: string, patch: Partial<LoreDocument>) => void;
  deleteDocument: (id: string) => void;

  // Template overrides
  updateTemplateOverrides: (template: ArticleTemplate, patch: Partial<TemplateOverrides>) => void;

  // Showcase settings
  updateShowcaseSettings: (patch: Partial<ShowcaseSettings>) => void;

  // Custom template operations
  addCustomTemplate: (template: CustomTemplateDefinition) => void;
  updateCustomTemplate: (id: string, template: CustomTemplateDefinition) => void;
  deleteCustomTemplate: (id: string) => void;

  // Custom scene template operations
  addCustomSceneTemplate: (template: CustomSceneTemplate) => void;
  updateCustomSceneTemplate: (id: string, patch: Partial<CustomSceneTemplate>) => void;
  deleteCustomSceneTemplate: (id: string) => void;

  // Zone plan operations
  createZonePlan: (plan: ZonePlan) => void;
  updateZonePlan: (id: string, patch: Partial<ZonePlan>) => void;
  deleteZonePlan: (id: string) => void;
  /** Replace all zone plans (used by AI generation accept-all). */
  replaceZonePlans: (plans: ZonePlan[]) => void;
  /** Append a batch (used by AI generation accept-individual). */
  addZonePlans: (plans: ZonePlan[]) => void;

  // Art style operations
  createArtStyle: (style: ArtStyle) => void;
  updateArtStyle: (id: string, patch: Partial<ArtStyle>) => void;
  deleteArtStyle: (id: string) => void;
  setActiveArtStyle: (id: string | null) => void;

  // Lore chat assistant
  appendChatMessage: (message: ChatMessage) => void;
  clearChatSession: () => void;

  // Undo/redo
  undoLore: () => void;
  redoLore: () => void;
  canUndoLore: () => boolean;
  canRedoLore: () => boolean;

  markClean: () => void;
  clearLore: () => void;
}

export const useLoreStore = create<LoreStore>((set, get) => ({
  lore: null,
  dirty: false,
  lorePast: [],
  loreFuture: [],
  selectedArticleId: null,
  selectedMapId: null,
  selectedArticleIds: new Set(),

  setLore: (lore) => set({ lore, dirty: false, lorePast: [], loreFuture: [], selectedArticleIds: new Set() }),

  createArticle: (article) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        ...snapshotLore(s),
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
        ...snapshotLore(s),
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

  renameArticle: (oldId, newId) =>
    set((s) => {
      if (!s.lore || !s.lore.articles[oldId] || s.lore.articles[newId]) return s;
      const article = { ...s.lore.articles[oldId], id: newId };
      const { [oldId]: _, ...rest } = s.lore.articles;

      // Update references across all articles (parentId, relations, @mentions in content)
      const articles: Record<string, Article> = { ...rest, [newId]: article };
      for (const [aid, a] of Object.entries(articles)) {
        let changed = false;
        let patched = { ...a };
        if (a.parentId === oldId) {
          patched = { ...patched, parentId: newId };
          changed = true;
        }
        if (a.relations?.some((r) => r.targetId === oldId)) {
          patched = { ...patched, relations: a.relations!.map((r) => r.targetId === oldId ? { ...r, targetId: newId } : r) };
          changed = true;
        }
        // Update @mentions in TipTap JSON content
        if (a.content.includes(oldId)) {
          patched = { ...patched, content: a.content.replaceAll(`"id":"${oldId}"`, `"id":"${newId}"`) };
          changed = true;
        }
        if (changed) articles[aid] = patched;
      }

      // Update map pin articleId references
      const maps = s.lore.maps?.map((m) => ({
        ...m,
        pins: m.pins.map((p) => p.articleId === oldId ? { ...p, articleId: newId } : p),
      }));

      // Update timeline event articleId references
      const timelineEvents = s.lore.timelineEvents?.map((e) =>
        e.articleId === oldId ? { ...e, articleId: newId } : e,
      );

      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles, maps, timelineEvents },
        dirty: true,
        selectedArticleId: s.selectedArticleId === oldId ? newId : s.selectedArticleId,
      };
    }),

  deleteArticle: (id) =>
    set((s) => {
      if (!s.lore || !s.lore.articles[id]) return s;
      const { [id]: _, ...rest } = s.lore.articles;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles: rest },
        dirty: true,
        selectedArticleId: s.selectedArticleId === id ? null : s.selectedArticleId,
      };
    }),

  duplicateArticle: (id) =>
    set((s) => {
      if (!s.lore) return s;
      const source = s.lore.articles[id];
      if (!source) return s;

      // Generate a unique ID: id_copy, id_copy2, id_copy3, ...
      let newId = `${id}_copy`;
      let counter = 2;
      while (s.lore.articles[newId]) {
        newId = `${id}_copy${counter}`;
        counter++;
      }

      const now = new Date().toISOString();
      const clone: Article = {
        id: newId,
        template: source.template,
        title: `${source.title} (Copy)`,
        fields: JSON.parse(JSON.stringify(source.fields)),
        content: source.content,
        privateNotes: source.privateNotes,
        tags: source.tags ? [...source.tags] : undefined,
        relations: source.relations ? [...source.relations] : undefined,
        image: source.image,
        gallery: source.gallery ? [...source.gallery] : undefined,
        parentId: source.parentId,
        sortOrder: (source.sortOrder ?? 0) + 1,
        draft: true,
        createdAt: now,
        updatedAt: now,
      };

      return {
        ...snapshotLore(s),
        lore: {
          ...s.lore,
          articles: { ...s.lore.articles, [newId]: clone },
        },
        selectedArticleId: newId,
        dirty: true,
      };
    }),

  moveArticle: (id, newParentId, sortOrder) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.articles[id];
      if (!existing) return s;
      return {
        ...snapshotLore(s),
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

  // ─── Multi-select operations ──────────────────────────────────
  toggleArticleSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedArticleIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedArticleIds: next };
    }),

  selectAllArticles: () =>
    set((s) => ({
      selectedArticleIds: new Set(Object.keys(s.lore?.articles ?? {})),
    })),

  clearArticleSelection: () => set({ selectedArticleIds: new Set() }),

  // ─── Bulk mutation operations ─────────────────────────────────
  bulkDelete: (ids) =>
    set((s) => {
      if (!s.lore) return s;
      const articles = { ...s.lore.articles };
      for (const id of ids) delete articles[id];
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles },
        dirty: true,
        selectedArticleIds: new Set(),
        selectedArticleId:
          ids.includes(s.selectedArticleId ?? "") ? null : s.selectedArticleId,
      };
    }),

  bulkSetDraft: (ids, draft) =>
    set((s) => {
      if (!s.lore) return s;
      const articles = { ...s.lore.articles };
      const now = new Date().toISOString();
      for (const id of ids) {
        const a = articles[id];
        if (a) articles[id] = { ...a, draft, updatedAt: now };
      }
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles },
        dirty: true,
      };
    }),

  bulkAddTags: (ids, tags) =>
    set((s) => {
      if (!s.lore) return s;
      const articles = { ...s.lore.articles };
      const now = new Date().toISOString();
      for (const id of ids) {
        const a = articles[id];
        if (a) {
          const existing = new Set(a.tags ?? []);
          for (const t of tags) existing.add(t);
          articles[id] = { ...a, tags: [...existing], updatedAt: now };
        }
      }
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles },
        dirty: true,
      };
    }),

  bulkRemoveTags: (ids, tags) =>
    set((s) => {
      if (!s.lore) return s;
      const articles = { ...s.lore.articles };
      const now = new Date().toISOString();
      const tagSet = new Set(tags);
      for (const id of ids) {
        const a = articles[id];
        if (a && a.tags) {
          articles[id] = {
            ...a,
            tags: a.tags.filter((t) => !tagSet.has(t)),
            updatedAt: now,
          };
        }
      }
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles },
        dirty: true,
      };
    }),

  bulkReparent: (ids, parentId) =>
    set((s) => {
      if (!s.lore) return s;
      const articles = { ...s.lore.articles };
      const now = new Date().toISOString();
      // Find the max sortOrder among existing children of the target parent
      let maxSort = 0;
      for (const a of Object.values(articles)) {
        if (a.parentId === parentId && (a.sortOrder ?? 0) > maxSort) {
          maxSort = a.sortOrder ?? 0;
        }
      }
      for (const id of ids) {
        const a = articles[id];
        if (a) {
          maxSort++;
          articles[id] = { ...a, parentId, sortOrder: maxSort, updatedAt: now };
        }
      }
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles },
        dirty: true,
      };
    }),

  bulkChangeTemplate: (ids, newTemplate) =>
    set((s) => {
      if (!s.lore) return s;
      const articles = { ...s.lore.articles };
      for (const id of ids) {
        const article = articles[id];
        if (article) {
          articles[id] = {
            ...article,
            template: newTemplate as any,
            updatedAt: new Date().toISOString(),
          };
        }
      }
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles },
        dirty: true,
      };
    }),

  replaceArticlesByTemplate: (template, articles) =>
    set((s) => {
      if (!s.lore) return s;
      // Remove all existing articles of this template, then add the new ones
      const kept: Record<string, Article> = {};
      for (const [id, a] of Object.entries(s.lore.articles)) {
        if (a.template !== template) kept[id] = a;
      }
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, articles: { ...kept, ...articles } },
        dirty: true,
      };
    }),

  // ─── Color label operations ────────────────────────────────────
  addColorLabel: (label) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, colorLabels: [...(s.lore.colorLabels ?? []), label] },
        dirty: true,
      };
    }),

  updateColorLabel: (id, patch) =>
    set((s) => {
      if (!s.lore?.colorLabels) return s;
      return {
        ...snapshotLore(s),
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
        ...snapshotLore(s),
        lore: { ...s.lore, colorLabels: s.lore.colorLabels.filter((l) => l.id !== id) },
        dirty: true,
      };
    }),

  // ─── Map operations ────────────────────────────────────────────
  createMap: (map) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, maps: [...(s.lore.maps ?? []), map] },
        dirty: true,
        selectedMapId: map.id,
      };
    }),

  updateMap: (id, patch) =>
    set((s) => {
      if (!s.lore?.maps) return s;
      return {
        ...snapshotLore(s),
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
        ...snapshotLore(s),
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
        ...snapshotLore(s),
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
        ...snapshotLore(s),
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
        ...snapshotLore(s),
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
      return { ...snapshotLore(s), lore: { ...s.lore, calendarSystems: systems }, dirty: true };
    }),

  setTimelineEvents: (events) =>
    set((s) => {
      if (!s.lore) return s;
      return { ...snapshotLore(s), lore: { ...s.lore, timelineEvents: events }, dirty: true };
    }),

  addTimelineEvent: (event) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, timelineEvents: [...(s.lore.timelineEvents ?? []), event] },
        dirty: true,
      };
    }),

  updateTimelineEvent: (id, patch) =>
    set((s) => {
      if (!s.lore?.timelineEvents) return s;
      return {
        ...snapshotLore(s),
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
        ...snapshotLore(s),
        lore: { ...s.lore, timelineEvents: s.lore.timelineEvents.filter((e) => e.id !== id) },
        dirty: true,
      };
    }),

  // ─── Document operations ──────────────────────────────────────────

  createDocument: (doc) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, documents: [...(s.lore.documents ?? []), doc] },
        dirty: true,
      };
    }),

  updateDocument: (id, patch) =>
    set((s) => {
      if (!s.lore?.documents) return s;
      return {
        ...snapshotLore(s),
        lore: {
          ...s.lore,
          documents: s.lore.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        },
        dirty: true,
      };
    }),

  deleteDocument: (id) =>
    set((s) => {
      if (!s.lore?.documents) return s;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, documents: s.lore.documents.filter((d) => d.id !== id) },
        dirty: true,
      };
    }),

  // ─── Template overrides ─────────────────────────────────────────

  updateTemplateOverrides: (template, patch) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.templateOverrides ?? {};
      return {
        ...snapshotLore(s),
        lore: {
          ...s.lore,
          templateOverrides: {
            ...existing,
            [template]: { ...(existing[template] ?? {}), ...patch },
          },
        },
        dirty: true,
      };
    }),

  // ─── Showcase settings ────────────────────────────────────────────

  updateShowcaseSettings: (patch) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        ...snapshotLore(s),
        lore: {
          ...s.lore,
          showcaseSettings: { ...(s.lore.showcaseSettings ?? {}), ...patch },
        },
        dirty: true,
      };
    }),

  // ─── Custom template operations ──────────────────────────────────

  addCustomTemplate: (template) =>
    set((s) => {
      if (!s.lore) return s;
      const templates = [...(s.lore.customTemplates ?? []), template];
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, customTemplates: templates },
        dirty: true,
      };
    }),

  updateCustomTemplate: (id, template) =>
    set((s) => {
      if (!s.lore) return s;
      const templates = (s.lore.customTemplates ?? []).map((t) =>
        t.id === id ? template : t,
      );
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, customTemplates: templates },
        dirty: true,
      };
    }),

  deleteCustomTemplate: (id) =>
    set((s) => {
      if (!s.lore) return s;
      const templates = (s.lore.customTemplates ?? []).filter((t) => t.id !== id);
      // Convert articles using this template to freeform
      const articles = { ...s.lore.articles };
      for (const [aid, article] of Object.entries(articles)) {
        if (article.template === id) {
          articles[aid] = { ...article, template: "freeform" as any };
        }
      }
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, customTemplates: templates, articles },
        dirty: true,
      };
    }),

  // ─── Custom scene template operations ───────────────────────────

  addCustomSceneTemplate: (template) =>
    set((s) => {
      if (!s.lore) return s;
      const templates = [...(s.lore.customSceneTemplates ?? []), template];
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, customSceneTemplates: templates },
        dirty: true,
      };
    }),

  updateCustomSceneTemplate: (id, patch) =>
    set((s) => {
      if (!s.lore) return s;
      const templates = (s.lore.customSceneTemplates ?? []).map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      );
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, customSceneTemplates: templates },
        dirty: true,
      };
    }),

  deleteCustomSceneTemplate: (id) =>
    set((s) => {
      if (!s.lore) return s;
      const templates = (s.lore.customSceneTemplates ?? []).filter((t) => t.id !== id);
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, customSceneTemplates: templates },
        dirty: true,
      };
    }),

  // ─── Zone plan operations ────────────────────────────────────────

  createZonePlan: (plan) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.zonePlans ?? [];
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, zonePlans: [...existing, plan] },
        dirty: true,
      };
    }),

  updateZonePlan: (id, patch) =>
    set((s) => {
      if (!s.lore) return s;
      const plans = (s.lore.zonePlans ?? []).map((p) =>
        p.id === id
          ? { ...p, ...patch, updatedAt: new Date().toISOString() }
          : p,
      );
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, zonePlans: plans },
        dirty: true,
      };
    }),

  deleteZonePlan: (id) =>
    set((s) => {
      if (!s.lore) return s;
      const plans = (s.lore.zonePlans ?? []).filter((p) => p.id !== id);
      // Also strip this id from any other plan's borders list.
      const cleaned = plans.map((p) =>
        p.borders?.includes(id)
          ? { ...p, borders: p.borders.filter((b) => b !== id) }
          : p,
      );
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, zonePlans: cleaned },
        dirty: true,
      };
    }),

  replaceZonePlans: (plans) =>
    set((s) => {
      if (!s.lore) return s;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, zonePlans: plans },
        dirty: true,
      };
    }),

  addZonePlans: (plans) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.zonePlans ?? [];
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, zonePlans: [...existing, ...plans] },
        dirty: true,
      };
    }),

  // ─── Art style operations ────────────────────────────────────────

  createArtStyle: (style) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.artStyles ?? [];
      const styles = [...existing, style];
      // Auto-activate the first style created
      const activeArtStyleId = s.lore.activeArtStyleId ?? style.id;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, artStyles: styles, activeArtStyleId },
        dirty: true,
      };
    }),

  updateArtStyle: (id, patch) =>
    set((s) => {
      if (!s.lore) return s;
      const styles = (s.lore.artStyles ?? []).map((style) =>
        style.id === id
          ? { ...style, ...patch, updatedAt: new Date().toISOString() }
          : style,
      );
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, artStyles: styles },
        dirty: true,
      };
    }),

  deleteArtStyle: (id) =>
    set((s) => {
      if (!s.lore) return s;
      const styles = (s.lore.artStyles ?? []).filter((style) => style.id !== id);
      const activeArtStyleId = s.lore.activeArtStyleId === id
        ? styles[0]?.id
        : s.lore.activeArtStyleId;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, artStyles: styles, activeArtStyleId },
        dirty: true,
      };
    }),

  setActiveArtStyle: (id) =>
    set((s) => {
      if (!s.lore) return s;
      if (id !== null && !(s.lore.artStyles ?? []).some((style) => style.id === id)) return s;
      return {
        ...snapshotLore(s),
        lore: { ...s.lore, activeArtStyleId: id ?? undefined },
        dirty: true,
      };
    }),

  // ─── Lore chat assistant ─────────────────────────────────────────
  // Chat messages are persisted with lore but excluded from undo/redo —
  // conversation turns aren't content edits.

  appendChatMessage: (message) =>
    set((s) => {
      if (!s.lore) return s;
      const now = new Date().toISOString();
      const prev = s.lore.chatSession?.messages ?? [];
      return {
        lore: {
          ...s.lore,
          chatSession: { messages: [...prev, message], updatedAt: now },
        },
        dirty: true,
      };
    }),

  clearChatSession: () =>
    set((s) => {
      if (!s.lore) return s;
      if (!s.lore.chatSession) return s;
      const { chatSession: _drop, ...rest } = s.lore;
      return { lore: rest, dirty: true };
    }),

  // ─── Undo / Redo ─────────────────────────────────────────────────

  undoLore: () =>
    set((s) => {
      if (!s.lore) return s;
      const result = histUndo(s.lorePast, s.lore, s.loreFuture);
      if (!result) return s;
      return { lore: result.data, dirty: true, lorePast: result.past, loreFuture: result.future };
    }),

  redoLore: () =>
    set((s) => {
      if (!s.lore) return s;
      const result = histRedo(s.lorePast, s.lore, s.loreFuture);
      if (!result) return s;
      return { lore: result.data, dirty: true, lorePast: result.past, loreFuture: result.future };
    }),

  canUndoLore: () => get().lorePast.length > 0,
  canRedoLore: () => get().loreFuture.length > 0,

  markClean: () => set({ dirty: false }),
  clearLore: () => set({ lore: null, dirty: false, lorePast: [], loreFuture: [], selectedArticleId: null, selectedMapId: null, selectedArticleIds: new Set() }),
}));
