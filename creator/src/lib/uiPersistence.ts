import type { Tab } from "@/types/project";

const STORAGE_KEY = "ambon-creator-ui";

interface PersistedUI {
  lastProjectPath: string;
  tabs: Tab[];
  activeTabId: string | null;
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
