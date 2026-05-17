import { create } from "zustand";

export type SidebarMode = "full" | "rail";
export type DrillTarget = "articles" | "zones" | null;

interface SidebarState {
  mode: SidebarMode;
  drillTarget: DrillTarget;
  setMode: (mode: SidebarMode) => void;
  toggleMode: () => void;
  setDrillTarget: (target: DrillTarget) => void;
  drillInto: (target: Exclude<DrillTarget, null>) => void;
  goBack: () => void;
}

const STORAGE_KEY = "arcanum.sidebar";

interface PersistedState {
  mode: SidebarMode;
  drillTarget: DrillTarget;
}

function readPersisted(): PersistedState {
  if (typeof window === "undefined") return { mode: "full", drillTarget: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: "full", drillTarget: null };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const mode = parsed.mode === "rail" ? "rail" : "full";
    const drillTarget = (parsed.drillTarget ?? null) as DrillTarget;
    return { mode, drillTarget };
  } catch {
    return { mode: "full", drillTarget: null };
  }
}

function writePersisted(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy errors
  }
}

const initial = readPersisted();

export const useSidebarStore = create<SidebarState>((set, get) => ({
  mode: initial.mode,
  drillTarget: initial.drillTarget,

  setMode: (mode) => {
    set({ mode });
    writePersisted({ mode, drillTarget: get().drillTarget });
  },

  toggleMode: () => {
    const next: SidebarMode = get().mode === "full" ? "rail" : "full";
    set({ mode: next });
    writePersisted({ mode: next, drillTarget: get().drillTarget });
  },

  setDrillTarget: (target) => {
    set({ drillTarget: target });
    writePersisted({ mode: get().mode, drillTarget: target });
  },

  drillInto: (target) => {
    set({ drillTarget: target, mode: "full" });
    writePersisted({ mode: "full", drillTarget: target });
  },

  goBack: () => {
    set({ drillTarget: null });
    writePersisted({ mode: get().mode, drillTarget: null });
  },
}));
