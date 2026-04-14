/**
 * Central constants for undo/redo history depths across stores.
 * Keep these aligned so users see consistent undo behavior regardless
 * of which editor they're in.
 */
export const HISTORY_DEPTHS = {
  ZONE: 100,
  LORE: 100,
  STORY: 100,
  CONFIG: 100,
} as const;
