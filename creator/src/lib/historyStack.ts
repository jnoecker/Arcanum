/**
 * Shared undo/redo history utilities.
 * Used by loreStore and storyStore for snapshot-based undo/redo.
 */

/** Push `current` onto the past stack, clearing the redo stack. */
export function snapshot<T>(past: T[], current: T, maxHistory: number): { past: T[]; future: T[] } {
  const newPast = [...past, current];
  if (newPast.length > maxHistory) newPast.shift();
  return { past: newPast, future: [] };
}

/** Pop the most recent entry from past, push current onto future. */
export function undo<T>(past: T[], current: T, future: T[]): { data: T; past: T[]; future: T[] } | null {
  if (past.length === 0) return null;
  const newPast = [...past];
  const prev = newPast.pop()!;
  return { data: prev, past: newPast, future: [current, ...future] };
}

/** Shift the next entry from future, push current onto past. */
export function redo<T>(past: T[], current: T, future: T[]): { data: T; past: T[]; future: T[] } | null {
  if (future.length === 0) return null;
  const newFuture = [...future];
  const next = newFuture.shift()!;
  return { data: next, past: [...past, current], future: newFuture };
}
