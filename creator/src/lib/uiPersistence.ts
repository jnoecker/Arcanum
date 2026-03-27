import type { Tab } from "@/types/project";

const STORAGE_KEY = "ambon-arcanum-ui";
const MAX_RECENT = 10;

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export interface PersistedUI {
  lastProjectPath: string;
  tabs: Tab[];
  activeTabId: string | null;
  recentProjects: RecentProject[];
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
