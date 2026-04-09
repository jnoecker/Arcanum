import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { saveUIState, loadUIState } from "@/lib/uiPersistence";
import type { Island } from "@/lib/panelRegistry";
import type {
  Project,
  Tab,
  AdminSubView,
  AdminContentSubView,
} from "@/types/project";

/** Which surface the main area is showing. `null` means "the active tab". */
export type MapView = "world" | { island: Island } | null;

/** Navigation target for sidebar -> zone editor entity selection. */
export interface PendingNavigation {
  zoneId: string;
  roomId?: string;
  entityKind?: string;
  entityId?: string;
  /** Switch the zone editor to a specific view mode (e.g. "dungeon"). */
  view?: string;
}

interface ProjectStore {
  project: Project | null;
  tabs: Tab[];
  activeTabId: string | null;
  adminSubView: AdminSubView;
  adminContentSubView: AdminContentSubView;
  pendingNavigation: PendingNavigation | null;
  /** Global flag to show the MUD import wizard. Palette & sidebar both toggle this. */
  showMudImport: boolean;
  /** When non-null, the main area shows the world map / island view instead
   *  of the active tab. Cleared by openTab / setActiveTab. */
  mapView: MapView;
  /** True when the unified Settings modal is open. */
  settingsOpen: boolean;

  setProject: (project: Project) => void;
  closeProject: () => void;

  openTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;

  /** Restore previously open tabs after project load. */
  restoreTabs: (tabs: Tab[], activeTabId: string | null) => void;
  setAdminSubView: (subView: AdminSubView) => void;
  setAdminContentSubView: (subView: AdminContentSubView) => void;
  navigateTo: (nav: PendingNavigation) => void;
  consumeNavigation: () => PendingNavigation | null;
  setShowMudImport: (show: boolean) => void;
  /** Show the top-level world map (clears any open island detail). */
  openWorldMap: () => void;
  /** Drill into a specific island detail view. */
  openIsland: (island: Island) => void;
  /** Close the map overlay and return to the active tab. */
  closeMap: () => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  tabs: [],
  activeTabId: null,
  adminSubView: "overview",
  adminContentSubView: "abilities",
  pendingNavigation: null,
  showMudImport: false,
  mapView: "world",
  settingsOpen: false,

  setProject: (project) => {
    set({
      project,
      tabs: [],
      activeTabId: null,
      adminSubView: "overview",
      adminContentSubView: "abilities",
      mapView: "world",
    });
    // Tell the Rust backend which project is active so get_settings
    // automatically merges project-level settings (R2 credentials, etc.)
    invoke("set_active_project_dir", { projectDir: project.mudDir }).catch(() => {});
  },

  closeProject: () => {
    invoke("set_active_project_dir", { projectDir: null }).catch(() => {});
    set({ project: null, tabs: [], activeTabId: null, mapView: "world" });
  },

  openTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeTabId: tab.id, mapView: null });
    } else {
      set({ tabs: [...tabs, tab], activeTabId: tab.id, mapView: null });
    }
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const filtered = tabs.filter((t) => t.id !== tabId);
    const newActive =
      activeTabId === tabId
        ? (filtered[filtered.length - 1]?.id ?? null)
        : activeTabId;
    set({ tabs: filtered, activeTabId: newActive });
  },

  closeAllTabs: () => set({ tabs: [], activeTabId: null, mapView: "world" }),

  setActiveTab: (tabId) => set({ activeTabId: tabId, mapView: null }),

  restoreTabs: (tabs, activeTabId) =>
    set({ tabs, activeTabId, mapView: tabs.length > 0 ? null : "world" }),
  setAdminSubView: (adminSubView) => set({ adminSubView }),
  setAdminContentSubView: (adminContentSubView) => set({ adminContentSubView }),

  navigateTo: (nav) => {
    const tab: Tab = { id: `zone:${nav.zoneId}`, kind: "zone", label: nav.zoneId };
    get().openTab(tab);
    set({ pendingNavigation: nav });
  },
  consumeNavigation: () => {
    const nav = get().pendingNavigation;
    if (nav) set({ pendingNavigation: null });
    return nav;
  },
  setShowMudImport: (showMudImport) => set({ showMudImport }),

  openWorldMap: () => set({ mapView: "world" }),
  openIsland: (island) => set({ mapView: { island } }),
  closeMap: () => set({ mapView: null }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));

// ─── Debounced persistence ─────────────────────────────────────────
let persistTimer: ReturnType<typeof setTimeout> | null = null;

useProjectStore.subscribe((state) => {
  if (!state.project) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const existing = loadUIState();
    saveUIState({
      lastProjectPath: state.project!.mudDir,
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      recentProjects: existing?.recentProjects ?? [],
    });
  }, 500);
});
