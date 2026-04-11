import type { Tab } from "@/types/project";

const STORAGE_KEY = "arcanum-ui";
const MAX_RECENT = 10;

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export interface AtlasPosition {
  x: number;
  y: number;
}

export interface PersistedUI {
  lastProjectPath: string;
  tabs: Tab[];
  activeTabId: string | null;
  recentProjects: RecentProject[];
  workspace?: "worldmaker" | "lore";
  collapsedSidebarSections?: string[];
  artSubTab?: "direction" | "assets" | "custom";
  collapsedZoneAssetSections?: Record<string, string[]>;
  /**
   * Atlas cluster positions, keyed first by project path, then by zone id.
   * Populated when the user drags a cluster in the World Atlas view.
   */
  atlasClusterPositions?: Record<string, Record<string, AtlasPosition>>;
}

export function saveUIState(state: PersistedUI): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable or full — silently ignore
  }
}

export function loadUIState(): PersistedUI | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.lastProjectPath !== "string") return null;
    // Migration: seed recentProjects from lastProjectPath if empty
    if (!parsed.recentProjects || !Array.isArray(parsed.recentProjects)) {
      parsed.recentProjects = [];
    }
    if (parsed.recentProjects.length === 0 && parsed.lastProjectPath) {
      const name = parsed.lastProjectPath.split(/[\\/]/).pop() ?? "AmbonMUD";
      parsed.recentProjects = [
        { path: parsed.lastProjectPath, name, lastOpened: Date.now() },
      ];
    }
    // Migration: drop tabs with removed kinds (studio, config)
    const VALID_KINDS = new Set(["panel", "zone", "console", "sprites", "admin"]);
    if (Array.isArray(parsed.tabs)) {
      parsed.tabs = parsed.tabs.filter((t: any) => VALID_KINDS.has(t.kind));
      // Migration: convert old command-kind tabs to panel-kind tabs
      const COMMAND_TAB_MAP: Record<string, string> = { console: "console", sprites: "sprites", admin: "admin" };
      parsed.tabs = parsed.tabs.map((t: any) => {
        const panelId = COMMAND_TAB_MAP[t.kind];
        if (panelId) {
          return { id: `panel:${panelId}`, kind: "panel", label: t.label, panelId };
        }
        return t;
      });
      // Fix activeTabId if it was a command tab
      if (parsed.activeTabId && COMMAND_TAB_MAP[parsed.activeTabId]) {
        parsed.activeTabId = `panel:${parsed.activeTabId}`;
      }
    }
    return parsed as PersistedUI;
  } catch {
    return null;
  }
}

export function clearUIState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function addRecentProject(path: string, name: string): void {
  const state = loadUIState();
  const recent = state?.recentProjects ?? [];
  const filtered = recent.filter((p) => p.path !== path);
  filtered.unshift({ path, name, lastOpened: Date.now() });
  if (filtered.length > MAX_RECENT) filtered.length = MAX_RECENT;
  const updated: PersistedUI = {
    lastProjectPath: state?.lastProjectPath ?? path,
    tabs: state?.tabs ?? [],
    activeTabId: state?.activeTabId ?? null,
    recentProjects: filtered,
  };
  saveUIState(updated);
}

export function removeRecentProject(path: string): void {
  const state = loadUIState();
  if (!state) return;
  const filtered = (state.recentProjects ?? []).filter((p) => p.path !== path);
  saveUIState({ ...state, recentProjects: filtered });
}

export function saveWorkspace(workspace: "worldmaker" | "lore"): void {
  const state = loadUIState();
  if (state) {
    saveUIState({ ...state, workspace });
  } else {
    saveUIState({
      lastProjectPath: "",
      tabs: [],
      activeTabId: null,
      recentProjects: [],
      workspace,
    });
  }
}

export function loadWorkspace(): "worldmaker" | "lore" {
  return loadUIState()?.workspace ?? "worldmaker";
}

export function saveCollapsedSections(sections: string[]): void {
  const state = loadUIState();
  if (state) {
    saveUIState({ ...state, collapsedSidebarSections: sections });
  }
}

export function loadCollapsedSections(): string[] {
  return loadUIState()?.collapsedSidebarSections ?? [];
}

export function saveCollapsedZoneAssetSections(zoneId: string, sections: string[]): void {
  const state = loadUIState();
  if (!state) return;
  const existing = state.collapsedZoneAssetSections ?? {};
  const next: Record<string, string[]> = { ...existing };
  if (sections.length === 0) {
    delete next[zoneId];
  } else {
    next[zoneId] = sections;
  }
  saveUIState({ ...state, collapsedZoneAssetSections: next });
}

export function loadCollapsedZoneAssetSections(zoneId: string): string[] {
  return loadUIState()?.collapsedZoneAssetSections?.[zoneId] ?? [];
}

export function saveArtSubTab(tab: "direction" | "assets" | "custom"): void {
  const state = loadUIState();
  if (state) {
    saveUIState({ ...state, artSubTab: tab });
  }
}

export function loadArtSubTab(): "direction" | "assets" | "custom" {
  return loadUIState()?.artSubTab ?? "direction";
}

// ─── Atlas cluster positions ────────────────────────────────────────

export function loadAtlasClusterPositions(
  projectPath: string,
): Record<string, AtlasPosition> {
  if (!projectPath) return {};
  return loadUIState()?.atlasClusterPositions?.[projectPath] ?? {};
}

export function saveAtlasClusterPosition(
  projectPath: string,
  zoneId: string,
  position: AtlasPosition,
): void {
  if (!projectPath || !zoneId) return;
  const state = loadUIState();
  if (!state) return;
  const all = state.atlasClusterPositions ?? {};
  const forProject = { ...(all[projectPath] ?? {}) };
  forProject[zoneId] = { x: position.x, y: position.y };
  saveUIState({
    ...state,
    atlasClusterPositions: { ...all, [projectPath]: forProject },
  });
}

export function clearAtlasClusterPositions(projectPath: string): void {
  if (!projectPath) return;
  const state = loadUIState();
  if (!state?.atlasClusterPositions) return;
  if (!(projectPath in state.atlasClusterPositions)) return;
  const { [projectPath]: _removed, ...rest } = state.atlasClusterPositions;
  saveUIState({ ...state, atlasClusterPositions: rest });
}
