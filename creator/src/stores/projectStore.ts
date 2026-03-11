import { create } from "zustand";
import { saveUIState, loadUIState } from "@/lib/uiPersistence";
import type { Project, Tab, ConfigSubTab } from "@/types/project";

/** Navigation target for sidebar -> zone editor entity selection. */
export interface PendingNavigation {
  zoneId: string;
  roomId?: string;
  entityKind?: string;
  entityId?: string;
}

interface ProjectStore {
  project: Project | null;
  tabs: Tab[];
  activeTabId: string | null;
  configSubTab: ConfigSubTab;
  pendingNavigation: PendingNavigation | null;

  setProject: (project: Project) => void;
  closeProject: () => void;

  openTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  /** Restore previously open tabs after project load. */
  restoreTabs: (tabs: Tab[], activeTabId: string | null) => void;
  setConfigSubTab: (subTab: ConfigSubTab) => void;
  navigateTo: (nav: PendingNavigation) => void;
  consumeNavigation: () => PendingNavigation | null;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  tabs: [],
  activeTabId: null,
  configSubTab: "server" as ConfigSubTab,
  pendingNavigation: null,

  setProject: (project) =>
    set({
      project,
      tabs: [{ id: "studio", kind: "studio", label: "Studio" }],
      activeTabId: "studio",
    }),

  closeProject: () =>
    set({ project: null, tabs: [], activeTabId: null }),

  openTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeTabId: tab.id });
    } else {
      set({ tabs: [...tabs, tab], activeTabId: tab.id });
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

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  restoreTabs: (tabs, activeTabId) => set({ tabs, activeTabId }),
  setConfigSubTab: (subTab) => set({ configSubTab: subTab }),

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
