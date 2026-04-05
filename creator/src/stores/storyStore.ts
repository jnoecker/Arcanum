import { create } from "zustand";
import type { Story } from "@/types/story";

const MAX_STORY_HISTORY = 50;

// Stable empty reference for selectors (prevents infinite re-render loops)
const EMPTY_STORIES: Record<string, Story> = {};

/** Snapshot the current stories onto the undo stack, clearing the redo stack. */
function snapshotStory(state: StoryState): Pick<StoryState, "storyPast" | "storyFuture"> {
  const past = [...state.storyPast, structuredClone(state.stories)];
  if (past.length > MAX_STORY_HISTORY) past.shift();
  return { storyPast: past, storyFuture: [] };
}

interface StoryState {
  stories: Record<string, Story>;
  dirty: Record<string, boolean>;
  activeStoryId: string | null;
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
}

const initialState: StoryState = {
  stories: {},
  dirty: {},
  activeStoryId: null,
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
      if (s.storyPast.length === 0) return s;
      const past = [...s.storyPast];
      const previous = past.pop()!;
      return {
        storyPast: past,
        storyFuture: [structuredClone(s.stories), ...s.storyFuture],
        stories: previous,
      };
    }),

  redoStory: () =>
    set((s) => {
      if (s.storyFuture.length === 0) return s;
      const future = [...s.storyFuture];
      const next = future.shift()!;
      return {
        storyFuture: future,
        storyPast: [...s.storyPast, structuredClone(s.stories)],
        stories: next,
      };
    }),

  markClean: (id) =>
    set((s) => ({
      dirty: { ...s.dirty, [id]: false },
    })),

  clearStories: () => set(initialState),
}));

/** Safe selector: returns stories or a stable empty object. */
export const selectStories = (s: StoryState) => s.stories ?? EMPTY_STORIES;

/** Safe selector: returns the active story or undefined. */
export const selectActiveStory = (s: StoryState) =>
  s.activeStoryId ? s.stories[s.activeStoryId] : undefined;
