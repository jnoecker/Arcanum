import { create } from "zustand";

export type SidebarMode = "full" | "rail";
export type DrillTarget = "articles" | "zones" | null;

interface SidebarState {
  mode: SidebarMode;
  drillTarget: DrillTarget;
  /** Zone tree rows the user has expanded in the Zones panel, by zone id. */
  expandedZones: Record<string, boolean>;
  /** Expanded entity categories, keyed `${zoneId}::${categoryKey}`. */
  expandedCats: Record<string, boolean>;
  setMode: (mode: SidebarMode) => void;
  toggleMode: () => void;
  setDrillTarget: (target: DrillTarget) => void;
  drillInto: (target: Exclude<DrillTarget, null>) => void;
  goBack: () => void;
  toggleZoneExpanded: (zoneId: string) => void;
  setZoneExpanded: (zoneId: string, expanded: boolean) => void;
  toggleCatExpanded: (zoneId: string, catKey: string) => void;
  setCatExpanded: (zoneId: string, catKey: string, expanded: boolean) => void;
}

export function catExpansionKey(zoneId: string, catKey: string): string {
  return `${zoneId}::${catKey}`;
}

const STORAGE_KEY = "arcanum.sidebar";

interface PersistedState {
  mode: SidebarMode;
  drillTarget: DrillTarget;
  expandedZones?: string[];
  expandedCats?: string[];
}

const VALID_DRILL_TARGETS = new Set<DrillTarget>(["articles", "zones"]);

function coerceDrillTarget(value: unknown): DrillTarget {
  return VALID_DRILL_TARGETS.has(value as DrillTarget) ? (value as DrillTarget) : null;
}

function coerceKeySet(value: unknown): Record<string, boolean> {
  if (!Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const key of value) {
    if (typeof key === "string") out[key] = true;
  }
  return out;
}

function readPersisted(): PersistedState {
  if (typeof window === "undefined") return { mode: "full", drillTarget: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: "full", drillTarget: null };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const mode = parsed.mode === "rail" ? "rail" : "full";
    return {
      mode,
      drillTarget: coerceDrillTarget(parsed.drillTarget),
      expandedZones: Array.isArray(parsed.expandedZones) ? parsed.expandedZones : [],
      expandedCats: Array.isArray(parsed.expandedCats) ? parsed.expandedCats : [],
    };
  } catch {
    return { mode: "full", drillTarget: null };
  }
}

function writePersisted(state: SidebarState) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedState = {
      mode: state.mode,
      drillTarget: state.drillTarget,
      expandedZones: Object.keys(state.expandedZones).filter((k) => state.expandedZones[k]),
      expandedCats: Object.keys(state.expandedCats).filter((k) => state.expandedCats[k]),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / privacy errors
  }
}

const initial = readPersisted();

export const useSidebarStore = create<SidebarState>((set, get) => {
  const apply = (partial: Partial<SidebarState>) => {
    set(partial);
    writePersisted(get());
  };

  return {
    mode: initial.mode,
    drillTarget: initial.drillTarget,
    expandedZones: coerceKeySet(initial.expandedZones),
    expandedCats: coerceKeySet(initial.expandedCats),

    setMode: (mode) => apply({ mode }),

    toggleMode: () => apply({ mode: get().mode === "full" ? "rail" : "full" }),

    setDrillTarget: (target) => apply({ drillTarget: target }),

    drillInto: (target) => apply({ drillTarget: target, mode: "full" }),

    goBack: () => apply({ drillTarget: null }),

    toggleZoneExpanded: (zoneId) => {
      const { expandedZones } = get();
      apply({ expandedZones: { ...expandedZones, [zoneId]: !expandedZones[zoneId] } });
    },

    setZoneExpanded: (zoneId, expanded) => {
      const { expandedZones } = get();
      if (!!expandedZones[zoneId] === expanded) return;
      apply({ expandedZones: { ...expandedZones, [zoneId]: expanded } });
    },

    toggleCatExpanded: (zoneId, catKey) => {
      const { expandedCats } = get();
      const key = catExpansionKey(zoneId, catKey);
      apply({ expandedCats: { ...expandedCats, [key]: !expandedCats[key] } });
    },

    setCatExpanded: (zoneId, catKey, expanded) => {
      const { expandedCats } = get();
      const key = catExpansionKey(zoneId, catKey);
      if (!!expandedCats[key] === expanded) return;
      apply({ expandedCats: { ...expandedCats, [key]: expanded } });
    },
  };
});
