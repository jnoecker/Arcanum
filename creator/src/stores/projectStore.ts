import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { saveUIState, loadUIState } from "@/lib/uiPersistence";
import { type Island } from "@/lib/panelRegistry";
import { useSidebarStore } from "@/stores/sidebarStore";
import { clearImageCache } from "@/lib/useImageSrc";
import { clearRoomDataCache } from "@/lib/zoneToGraph";
import { clearLayoutCache } from "@/lib/dagreLayout";
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

/** What the active zone editor currently has selected, mirrored so the
 *  sidebar can highlight it. Only meaningful while that zone's tab is active. */
export interface ActiveSelection {
  zoneId: string;
  roomId?: string;
  entityKind?: string;
  entityId?: string;
}

interface ProjectStore {
  project: Project | null;
  tabs: Tab[];
  activeTabId: string | null;
  adminSubView: AdminSubView;
  adminContentSubView: AdminContentSubView;
  pendingNavigation: PendingNavigation | null;
  activeSelection: ActiveSelection | null;
  /** Global flag to show the MUD import wizard. Palette & sidebar both toggle this. */
  showMudImport: boolean;
  /** Global flag to show the zone YAML import dialog. */
  showImportZone: boolean;
  /** When non-null, the main area shows the world map / island view instead
   *  of the active tab. Cleared by openTab / setActiveTab. */
  mapView: MapView;
  /** True when the unified Settings modal is open. */
  settingsOpen: boolean;
  /** True when the lore chat assistant panel is open. */
  loreChatOpen: boolean;

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
  setActiveSelection: (selection: ActiveSelection | null) => void;
  setShowMudImport: (show: boolean) => void;
  setShowImportZone: (show: boolean) => void;
  /** Show the top-level world map (clears any open island detail). */
  openWorldMap: () => void;
  /** Drill into a specific island detail view. */
  openIsland: (island: Island) => void;
  /** Close the map overlay and return to the active tab. */
  closeMap: () => void;
  setSettingsOpen: (open: boolean) => void;
  setLoreChatOpen: (open: boolean) => void;
}

/**
 * Mirror the active tab into the sidebar's drill target so the sidebar
 * always matches what the user is editing — whether they got here via the
 * world map, the command palette, an inline link, or by switching tabs.
 * Uses setDrillTarget (not drillInto) so we don't force-expand the rail.
 */
function syncSidebarToTab(tab: Tab | undefined): void {
  if (!tab) return;
  if (tab.kind === "zone" || tab.kind === "zoneAtlas") {
    useSidebarStore.getState().setDrillTarget("zones");
    return;
  }
  if (tab.kind === "panel" && tab.panelId === "lore") {
    useSidebarStore.getState().setDrillTarget("articles");
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  tabs: [],
  activeTabId: null,
  adminSubView: "overview",
  adminContentSubView: "abilities",
  pendingNavigation: null,
  activeSelection: null,
  showMudImport: false,
  showImportZone: false,
  mapView: "world",
  settingsOpen: false,
  loreChatOpen: false,

  setProject: (project) => {
    // Drop project-scoped caches. Asset paths are absolute and a new project
    // resolves entirely different files, so the old cache contents are at
    // best wasteful and at worst stale.
    clearImageCache();
    clearRoomDataCache();
    clearLayoutCache();
    set({
      project,
      tabs: [],
      activeTabId: null,
      adminSubView: "overview",
      adminContentSubView: "abilities",
      mapView: "world",
      activeSelection: null,
    });
    // Tell the Rust backend which project is active so get_settings
    // automatically merges project-level settings (R2 credentials, etc.)
    invoke("set_active_project_dir", { projectDir: project.mudDir }).catch(() => {});
  },

  closeProject: () => {
    clearImageCache();
    clearRoomDataCache();
    clearLayoutCache();
    invoke("set_active_project_dir", { projectDir: null }).catch(() => {});
    set({ project: null, tabs: [], activeTabId: null, mapView: "world", activeSelection: null });
  },

  openTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeTabId: tab.id, mapView: null });
    } else {
      set({ tabs: [...tabs, tab], activeTabId: tab.id, mapView: null });
    }
    syncSidebarToTab(tab);
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

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId, mapView: null });
    syncSidebarToTab(get().tabs.find((t) => t.id === tabId));
  },

  restoreTabs: (tabs, activeTabId) => {
    set({ tabs, activeTabId, mapView: tabs.length > 0 ? null : "world" });
    if (activeTabId) syncSidebarToTab(tabs.find((t) => t.id === activeTabId));
  },
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
  setActiveSelection: (activeSelection) => set({ activeSelection }),
  setShowMudImport: (showMudImport) => set({ showMudImport }),
  setShowImportZone: (showImportZone) => set({ showImportZone }),

  openWorldMap: () => set({ mapView: "world" }),
  openIsland: (island) => set({ mapView: { island } }),
  closeMap: () => set({ mapView: null }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setLoreChatOpen: (loreChatOpen) => set({ loreChatOpen }),
}));

// ─── Debounced persistence ─────────────────────────────────────────
let persistTimer: ReturnType<typeof setTimeout> | null = null;

useProjectStore.subscribe((state) => {
  if (!state.project) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const existing = loadUIState();
    saveUIState({
      ...(existing ?? { recentProjects: [] }),
      lastProjectPath: state.project!.mudDir,
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    });
  }, 500);
});
