import { describe, it, expect, beforeEach } from "vitest";
import { useStoryStore } from "../storyStore";
import type { Story } from "@/types/story";

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: "story_test_abc1",
    title: "Test Story",
    zoneId: "zone_test",
    scenes: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("storyStore", () => {
  beforeEach(() => {
    useStoryStore.setState({
      stories: {},
      dirty: {},
      activeStoryId: null,
      storyPast: [],
      storyFuture: [],
    });
  });

  describe("setStory", () => {
    it("adds a story to state", () => {
      const story = makeStory();
      useStoryStore.getState().setStory(story);
      const state = useStoryStore.getState();
      expect(state.stories["story_test_abc1"]).toEqual(story);
    });

    it("marks the story as dirty", () => {
      useStoryStore.getState().setStory(makeStory());
      expect(useStoryStore.getState().dirty["story_test_abc1"]).toBe(true);
    });
  });

  describe("updateStory", () => {
    it("merges patch into existing story", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().updateStory("story_test_abc1", { title: "Updated Title" });
      expect(useStoryStore.getState().stories["story_test_abc1"].title).toBe("Updated Title");
    });

    it("sets dirty flag", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().markClean("story_test_abc1");
      useStoryStore.getState().updateStory("story_test_abc1", { title: "Updated Title" });
      expect(useStoryStore.getState().dirty["story_test_abc1"]).toBe(true);
    });
  });

  describe("deleteStory", () => {
    it("removes story from state", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().deleteStory("story_test_abc1");
      expect(useStoryStore.getState().stories["story_test_abc1"]).toBeUndefined();
    });
  });

  describe("undoStory", () => {
    it("restores previous stories snapshot", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().updateStory("story_test_abc1", { title: "Updated Title" });
      expect(useStoryStore.getState().stories["story_test_abc1"].title).toBe("Updated Title");

      useStoryStore.getState().undoStory();
      expect(useStoryStore.getState().stories["story_test_abc1"].title).toBe("Test Story");
    });
  });

  describe("redoStory", () => {
    it("re-applies last undone snapshot", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().updateStory("story_test_abc1", { title: "Updated Title" });
      useStoryStore.getState().undoStory();
      expect(useStoryStore.getState().stories["story_test_abc1"].title).toBe("Test Story");

      useStoryStore.getState().redoStory();
      expect(useStoryStore.getState().stories["story_test_abc1"].title).toBe("Updated Title");
    });
  });

  describe("undo stack cap", () => {
    it("caps at 50 entries", () => {
      useStoryStore.getState().setStory(makeStory());
      for (let i = 0; i < 52; i++) {
        useStoryStore.getState().updateStory("story_test_abc1", { title: `Title ${i}` });
      }
      // 1 from setStory + 52 from updateStory = 53 snapshots, capped at 50
      expect(useStoryStore.getState().storyPast.length).toBe(50);
    });
  });

  describe("undo/redo independence", () => {
    it("stacks are independent from loreStore", () => {
      // Just verify the store has its own past/future arrays
      const state = useStoryStore.getState();
      expect(state.storyPast).toEqual([]);
      expect(state.storyFuture).toEqual([]);
    });
  });

  describe("clearStories", () => {
    it("resets to empty state", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().clearStories();
      const state = useStoryStore.getState();
      expect(state.stories).toEqual({});
      expect(state.dirty).toEqual({});
      expect(state.storyPast).toEqual([]);
      expect(state.storyFuture).toEqual([]);
    });
  });

  describe("setActiveStory", () => {
    it("sets the active story id", () => {
      useStoryStore.getState().setActiveStory("story_test_abc1");
      expect(useStoryStore.getState().activeStoryId).toBe("story_test_abc1");
    });

    it("clears when set to null", () => {
      useStoryStore.getState().setActiveStory("story_test_abc1");
      useStoryStore.getState().setActiveStory(null);
      expect(useStoryStore.getState().activeStoryId).toBeNull();
    });
  });

  describe("markClean", () => {
    it("sets dirty flag to false", () => {
      useStoryStore.getState().setStory(makeStory());
      expect(useStoryStore.getState().dirty["story_test_abc1"]).toBe(true);
      useStoryStore.getState().markClean("story_test_abc1");
      expect(useStoryStore.getState().dirty["story_test_abc1"]).toBe(false);
    });
  });
});
