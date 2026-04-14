import { create } from "zustand";
import type { Story, Scene } from "@/types/story";
import { snapshot as histSnapshot, undo as histUndo, redo as histRedo } from "@/lib/historyStack";
import { HISTORY_DEPTHS } from "@/lib/historyDepths";

const MAX_STORY_HISTORY = HISTORY_DEPTHS.STORY;

// Stable empty reference for selectors (prevents infinite re-render loops)
const EMPTY_STORIES: Record<string, Story> = {};

/** Generate a unique scene ID with scene_ prefix + 6-char random suffix. */
export const generateSceneId = (): string =>
  "scene_" + Math.random().toString(36).substring(2, 8);

/** Snapshot the current stories onto the undo stack, clearing the redo stack. */
function snapshotStory(state: StoryState): Pick<StoryState, "storyPast" | "storyFuture"> {
  const { past, future } = histSnapshot(state.storyPast, structuredClone(state.stories), MAX_STORY_HISTORY);
  return { storyPast: past, storyFuture: future };
}

interface StoryState {
  stories: Record<string, Story>;
  dirty: Record<string, boolean>;
  activeStoryId: string | null;
  activeSceneId: string | null;
  storyPast: Record<string, Story>[];
  storyFuture: Record<string, Story>[];
}

interface StoryStore extends StoryState {
  setStory: (story: Story) => void;
  updateStory: (id: string, patch: Partial<Story>) => void;
  deleteStory: (id: string) => void;
  setActiveStory: (id: string | null) => void;
  undoStory: () => void;
  redoStory: () => void;
  markClean: (id: string) => void;
  clearStories: () => void;
  // Scene-level CRUD operations
  addScene: (storyId: string, scene: Scene) => void;
  removeScene: (storyId: string, sceneId: string) => void;
  reorderScenes: (storyId: string, sceneIds: string[]) => void;
  updateScene: (storyId: string, sceneId: string, patch: Partial<Scene>) => void;
  duplicateScene: (storyId: string, sceneId: string) => void;
  setActiveScene: (id: string | null) => void;
}

const initialState: StoryState = {
  stories: {},
  dirty: {},
  activeStoryId: null,
  activeSceneId: null,
  storyPast: [],
  storyFuture: [],
};

export const useStoryStore = create<StoryStore>()((set) => ({
  ...initialState,

  setStory: (story) =>
    set((s) => ({
      ...snapshotStory(s),
      stories: { ...s.stories, [story.id]: story },
      dirty: { ...s.dirty, [story.id]: true },
    })),

  updateStory: (id, patch) =>
    set((s) => {
      const existing = s.stories[id];
      if (!existing) return s;
      return {
        ...snapshotStory(s),
        stories: {
          ...s.stories,
          [id]: { ...existing, ...patch, updatedAt: new Date().toISOString() },
        },
        dirty: { ...s.dirty, [id]: true },
      };
    }),

  deleteStory: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.stories;
      const { [id]: _dirtyRemoved, ...dirtyRest } = s.dirty;
      return {
        ...snapshotStory(s),
        stories: rest,
        dirty: dirtyRest,
      };
    }),

  setActiveStory: (id) => set({ activeStoryId: id }),

  undoStory: () =>
    set((s) => {
      const result = histUndo(s.storyPast, structuredClone(s.stories), s.storyFuture);
      if (!result) return s;
      return { storyPast: result.past, storyFuture: result.future, stories: result.data };
    }),

  redoStory: () =>
    set((s) => {
      const result = histRedo(s.storyPast, structuredClone(s.stories), s.storyFuture);
      if (!result) return s;
      return { storyPast: result.past, storyFuture: result.future, stories: result.data };
    }),

  markClean: (id) =>
    set((s) => ({
      dirty: { ...s.dirty, [id]: false },
    })),

  clearStories: () => set(initialState),

  // ─── Scene-level CRUD operations ─────────────────────────────────

  addScene: (storyId, scene) =>
    set((s) => {
      const existing = s.stories[storyId];
      if (!existing) return s;
      const newScene = { ...scene, sortOrder: existing.scenes.length };
      return {
        ...snapshotStory(s),
        stories: {
          ...s.stories,
          [storyId]: {
            ...existing,
            scenes: [...existing.scenes, newScene],
            updatedAt: new Date().toISOString(),
          },
        },
        dirty: { ...s.dirty, [storyId]: true },
        // Always focus the newly added scene so the user is editing
        // the thing they just created. (Was previously gated to "first
        // scene only", which led to silent edits on the old active
        // scene when adding more.)
        activeSceneId: scene.id,
      };
    }),

  removeScene: (storyId, sceneId) =>
    set((s) => {
      const existing = s.stories[storyId];
      if (!existing) return s;
      const oldIndex = existing.scenes.findIndex((sc) => sc.id === sceneId);
      if (oldIndex === -1) return s;
      const filtered = existing.scenes
        .filter((sc) => sc.id !== sceneId)
        .map((sc, i) => ({ ...sc, sortOrder: i }));
      // Auto-select logic: if removed scene was active, pick adjacent
      let newActiveSceneId = s.activeSceneId;
      if (s.activeSceneId === sceneId) {
        if (filtered.length === 0) {
          newActiveSceneId = null;
        } else {
          const clampedIndex = Math.min(oldIndex, filtered.length - 1);
          newActiveSceneId = filtered[clampedIndex]?.id ?? null;
        }
      }
      return {
        ...snapshotStory(s),
        stories: {
          ...s.stories,
          [storyId]: {
            ...existing,
            scenes: filtered,
            updatedAt: new Date().toISOString(),
          },
        },
        dirty: { ...s.dirty, [storyId]: true },
        activeSceneId: newActiveSceneId,
      };
    }),

  reorderScenes: (storyId, sceneIds) =>
    set((s) => {
      const existing = s.stories[storyId];
      if (!existing) return s;
      const sceneMap = new Map(existing.scenes.map((sc) => [sc.id, sc]));
      const reordered = sceneIds
        .map((id) => sceneMap.get(id))
        .filter((sc): sc is Scene => sc !== undefined)
        .map((sc, i) => ({ ...sc, sortOrder: i }));
      return {
        ...snapshotStory(s),
        stories: {
          ...s.stories,
          [storyId]: {
            ...existing,
            scenes: reordered,
            updatedAt: new Date().toISOString(),
          },
        },
        dirty: { ...s.dirty, [storyId]: true },
      };
    }),

  updateScene: (storyId, sceneId, patch) =>
    set((s) => {
      const existing = s.stories[storyId];
      if (!existing) return s;
      const sceneIndex = existing.scenes.findIndex((sc) => sc.id === sceneId);
      if (sceneIndex === -1) return s;
      const updatedScenes = existing.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, ...patch } : sc,
      );
      return {
        ...snapshotStory(s),
        stories: {
          ...s.stories,
          [storyId]: {
            ...existing,
            scenes: updatedScenes,
            updatedAt: new Date().toISOString(),
          },
        },
        dirty: { ...s.dirty, [storyId]: true },
      };
    }),

  duplicateScene: (storyId, sceneId) =>
    set((s) => {
      const existing = s.stories[storyId];
      if (!existing) return s;
      const originalIndex = existing.scenes.findIndex((sc) => sc.id === sceneId);
      if (originalIndex === -1) return s;
      const original = existing.scenes[originalIndex]!;
      const newId = generateSceneId();
      const clone: Scene = { ...original, id: newId };
      const newScenes = [...existing.scenes];
      newScenes.splice(originalIndex + 1, 0, clone);
      const renumbered = newScenes.map((sc, i) => ({ ...sc, sortOrder: i }));
      return {
        ...snapshotStory(s),
        stories: {
          ...s.stories,
          [storyId]: {
            ...existing,
            scenes: renumbered,
            updatedAt: new Date().toISOString(),
          },
        },
        dirty: { ...s.dirty, [storyId]: true },
        activeSceneId: newId,
      };
    }),

  setActiveScene: (id) => set({ activeSceneId: id }),
}));

/** Safe selector: returns stories or a stable empty object. */
export const selectStories = (s: StoryState) => s.stories ?? EMPTY_STORIES;

/** Safe selector: returns the active story or undefined. */
export const selectActiveStory = (s: StoryState) =>
  s.activeStoryId ? s.stories[s.activeStoryId] : undefined;

/** Safe selector: returns the active scene or undefined. */
export const selectActiveScene = (s: StoryState) => {
  if (!s.activeSceneId || !s.activeStoryId) return undefined;
  const story = s.stories[s.activeStoryId];
  return story?.scenes.find((sc) => sc.id === s.activeSceneId);
};
