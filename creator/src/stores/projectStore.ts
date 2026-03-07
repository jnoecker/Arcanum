import { create } from "zustand";
import { saveUIState } from "@/lib/uiPersistence";
import type { Project, Tab, ConfigSubTab } from "@/types/project";

interface ProjectStore {
  project: Project | null;
  tabs: Tab[];
  activeTabId: string | null;
  configSubTab: ConfigSubTab;

  setProject: (project: Project) => void;
  closeProject: () => void;

  openTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  /** Restore previously open tabs after project load. */
  restoreTabs: (tabs: Tab[], activeTabId: string | null) => void;
  setConfigSubTab: (subTab: ConfigSubTab) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  tabs: [],
  activeTabId: null,
  configSubTab: "server" as ConfigSubTab,

  setProject: (project) =>
    set({
      project,
      tabs: [{ id: "console", kind: "console", label: "Console" }],
      activeTabId: "console",
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
}));

// ─── Debounced persistence ─────────────────────────────────────────
let persistTimer: ReturnType<typeof setTimeout> | null = null;

useProjectStore.subscribe((state) => {
  if (!state.project) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveUIState({
      lastProjectPath: state.project!.mudDir,
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    });
  }, 500);
});
