const STORAGE_KEY = "arcanum-getting-started";

export interface GettingStartedState {
  completed: string[];
  dismissed: boolean;
  introSeen: boolean;
}

export function loadGettingStarted(): GettingStartedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: [], dismissed: false, introSeen: false };
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      dismissed: !!parsed.dismissed,
      introSeen: !!parsed.introSeen,
    };
  } catch {
    return { completed: [], dismissed: false, introSeen: false };
  }
}

export function saveGettingStarted(state: GettingStartedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable or full
  }
}

export function markStepCompleted(stepId: string): void {
  const state = loadGettingStarted();
  if (!state.completed.includes(stepId)) {
    state.completed.push(stepId);
    saveGettingStarted(state);
  }
}

export function markIntroSeen(): void {
  const state = loadGettingStarted();
  if (!state.introSeen) {
    saveGettingStarted({ ...state, introSeen: true });
  }
}

export function dismissGettingStarted(): void {
  const state = loadGettingStarted();
  saveGettingStarted({ ...state, dismissed: true });
}

export function reopenGettingStarted(): void {
  const state = loadGettingStarted();
  saveGettingStarted({ ...state, dismissed: false });
}

export function resetGettingStarted(): void {
  saveGettingStarted({ completed: [], dismissed: false, introSeen: false });
}
