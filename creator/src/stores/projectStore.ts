import { create } from "zustand";
import type { Project, Tab } from "@/types/project";

interface ProjectStore {
  project: Project | null;
  tabs: Tab[];
  activeTabId: string | null;

  setProject: (project: Project) => void;
  closeProject: () => void;

  openTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  tabs: [],
  activeTabId: null,

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
}));
