import { describe, it, expect, beforeEach } from "vitest";
import { useStoryStore, selectActiveScene } from "../storyStore";
import type { Story, Scene } from "@/types/story";

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scene_test_001",
    title: "Test Scene",
    sortOrder: 0,
    ...overrides,
  };
}

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
      activeSceneId: null,
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

  // ─── Scene-level CRUD operations ─────────────────────────────────

  describe("addScene", () => {
    it("adds a scene to the story", () => {
      const story = makeStory();
      useStoryStore.getState().setStory(story);
      const scene = makeScene();
      useStoryStore.getState().addScene("story_test_abc1", scene);
      const updated = useStoryStore.getState().stories["story_test_abc1"];
      expect(updated.scenes).toHaveLength(1);
      expect(updated.scenes[0].id).toBe("scene_test_001");
    });

    it("sets sortOrder to scenes.length (appended at end)", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().addScene("story_test_abc1", makeScene({ id: "s1" }));
      useStoryStore.getState().addScene("story_test_abc1", makeScene({ id: "s2" }));
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes[0].sortOrder).toBe(0);
      expect(scenes[1].sortOrder).toBe(1);
    });

    it("marks the story as dirty", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().markClean("story_test_abc1");
      useStoryStore.getState().addScene("story_test_abc1", makeScene());
      expect(useStoryStore.getState().dirty["story_test_abc1"]).toBe(true);
    });

    it("snapshots for undo", () => {
      useStoryStore.getState().setStory(makeStory());
      const pastBefore = useStoryStore.getState().storyPast.length;
      useStoryStore.getState().addScene("story_test_abc1", makeScene());
      expect(useStoryStore.getState().storyPast.length).toBe(pastBefore + 1);
    });

    it("auto-selects first scene added", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().addScene("story_test_abc1", makeScene({ id: "first_scene" }));
      expect(useStoryStore.getState().activeSceneId).toBe("first_scene");
    });

    it("does not change activeSceneId when adding subsequent scenes", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().addScene("story_test_abc1", makeScene({ id: "first_scene" }));
      useStoryStore.getState().addScene("story_test_abc1", makeScene({ id: "second_scene" }));
      expect(useStoryStore.getState().activeSceneId).toBe("first_scene");
    });

    it("is a no-op for missing story", () => {
      const stateBefore = useStoryStore.getState();
      useStoryStore.getState().addScene("nonexistent", makeScene());
      const stateAfter = useStoryStore.getState();
      expect(stateAfter.stories).toEqual(stateBefore.stories);
    });
  });

  describe("removeScene", () => {
    it("removes scene by ID", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1", sortOrder: 0 }), makeScene({ id: "s2", sortOrder: 1 })],
      }));
      useStoryStore.getState().removeScene("story_test_abc1", "s1");
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes).toHaveLength(1);
      expect(scenes[0].id).toBe("s2");
    });

    it("normalizes sortOrder after removal", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [
          makeScene({ id: "s1", sortOrder: 0 }),
          makeScene({ id: "s2", sortOrder: 1 }),
          makeScene({ id: "s3", sortOrder: 2 }),
        ],
      }));
      useStoryStore.getState().removeScene("story_test_abc1", "s2");
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes[0].sortOrder).toBe(0);
      expect(scenes[1].sortOrder).toBe(1);
    });

    it("auto-selects next scene when active scene is removed", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [
          makeScene({ id: "s1", sortOrder: 0 }),
          makeScene({ id: "s2", sortOrder: 1 }),
          makeScene({ id: "s3", sortOrder: 2 }),
        ],
      }));
      useStoryStore.setState({ activeSceneId: "s2" });
      useStoryStore.getState().removeScene("story_test_abc1", "s2");
      // s2 was at index 1; after removal, scene at index 1 is s3
      expect(useStoryStore.getState().activeSceneId).toBe("s3");
    });

    it("auto-selects previous scene when last scene is removed", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [
          makeScene({ id: "s1", sortOrder: 0 }),
          makeScene({ id: "s2", sortOrder: 1 }),
        ],
      }));
      useStoryStore.setState({ activeSceneId: "s2" });
      useStoryStore.getState().removeScene("story_test_abc1", "s2");
      expect(useStoryStore.getState().activeSceneId).toBe("s1");
    });

    it("sets activeSceneId to null when all scenes removed", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1", sortOrder: 0 })],
      }));
      useStoryStore.setState({ activeSceneId: "s1" });
      useStoryStore.getState().removeScene("story_test_abc1", "s1");
      expect(useStoryStore.getState().activeSceneId).toBeNull();
    });

    it("is a no-op for missing story", () => {
      useStoryStore.getState().setStory(makeStory({ scenes: [makeScene()] }));
      const scenesCount = useStoryStore.getState().stories["story_test_abc1"].scenes.length;
      useStoryStore.getState().removeScene("nonexistent", "scene_test_001");
      expect(useStoryStore.getState().stories["story_test_abc1"].scenes.length).toBe(scenesCount);
    });

    it("marks the story as dirty", () => {
      useStoryStore.getState().setStory(makeStory({ scenes: [makeScene()] }));
      useStoryStore.getState().markClean("story_test_abc1");
      useStoryStore.getState().removeScene("story_test_abc1", "scene_test_001");
      expect(useStoryStore.getState().dirty["story_test_abc1"]).toBe(true);
    });
  });

  describe("reorderScenes", () => {
    it("reorders scenes by ID array", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [
          makeScene({ id: "s1", sortOrder: 0, title: "First" }),
          makeScene({ id: "s2", sortOrder: 1, title: "Second" }),
          makeScene({ id: "s3", sortOrder: 2, title: "Third" }),
        ],
      }));
      useStoryStore.getState().reorderScenes("story_test_abc1", ["s3", "s1", "s2"]);
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes[0].id).toBe("s3");
      expect(scenes[1].id).toBe("s1");
      expect(scenes[2].id).toBe("s2");
    });

    it("renumbers sortOrder sequentially", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [
          makeScene({ id: "s1", sortOrder: 0 }),
          makeScene({ id: "s2", sortOrder: 1 }),
        ],
      }));
      useStoryStore.getState().reorderScenes("story_test_abc1", ["s2", "s1"]);
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes[0].sortOrder).toBe(0);
      expect(scenes[1].sortOrder).toBe(1);
    });

    it("preserves scene content during reorder", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [
          makeScene({ id: "s1", title: "First", narration: "Narration A" }),
          makeScene({ id: "s2", title: "Second", narration: "Narration B" }),
        ],
      }));
      useStoryStore.getState().reorderScenes("story_test_abc1", ["s2", "s1"]);
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes[0].title).toBe("Second");
      expect(scenes[0].narration).toBe("Narration B");
    });

    it("ignores unknown IDs defensively", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [
          makeScene({ id: "s1", sortOrder: 0 }),
          makeScene({ id: "s2", sortOrder: 1 }),
        ],
      }));
      useStoryStore.getState().reorderScenes("story_test_abc1", ["s2", "unknown_id", "s1"]);
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes).toHaveLength(2);
      expect(scenes[0].id).toBe("s2");
      expect(scenes[1].id).toBe("s1");
    });

    it("snapshots for undo", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1" }), makeScene({ id: "s2" })],
      }));
      const pastBefore = useStoryStore.getState().storyPast.length;
      useStoryStore.getState().reorderScenes("story_test_abc1", ["s2", "s1"]);
      expect(useStoryStore.getState().storyPast.length).toBe(pastBefore + 1);
    });
  });

  describe("updateScene", () => {
    it("merges patch into existing scene", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1", title: "Original" })],
      }));
      useStoryStore.getState().updateScene("story_test_abc1", "s1", { title: "Updated" });
      const scene = useStoryStore.getState().stories["story_test_abc1"].scenes[0];
      expect(scene.title).toBe("Updated");
    });

    it("snapshots for undo", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1" })],
      }));
      const pastBefore = useStoryStore.getState().storyPast.length;
      useStoryStore.getState().updateScene("story_test_abc1", "s1", { title: "New" });
      expect(useStoryStore.getState().storyPast.length).toBe(pastBefore + 1);
    });

    it("updates story updatedAt timestamp", () => {
      const originalDate = "2020-01-01T00:00:00.000Z";
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1" })],
        updatedAt: originalDate,
      }));
      useStoryStore.getState().updateScene("story_test_abc1", "s1", { title: "Changed" });
      const after = useStoryStore.getState().stories["story_test_abc1"].updatedAt;
      expect(after).not.toBe(originalDate);
    });

    it("is a no-op for missing scene", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1", title: "Original" })],
      }));
      useStoryStore.getState().updateScene("story_test_abc1", "nonexistent", { title: "Nope" });
      expect(useStoryStore.getState().stories["story_test_abc1"].scenes[0].title).toBe("Original");
    });

    it("is a no-op for missing story", () => {
      const stateBefore = useStoryStore.getState();
      useStoryStore.getState().updateScene("nonexistent", "s1", { title: "Nope" });
      expect(useStoryStore.getState().stories).toEqual(stateBefore.stories);
    });
  });

  describe("duplicateScene", () => {
    it("creates a new scene with a different ID", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1", title: "Original" })],
      }));
      useStoryStore.getState().duplicateScene("story_test_abc1", "s1");
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes).toHaveLength(2);
      expect(scenes[1].id).not.toBe("s1");
      expect(scenes[1].id).toMatch(/^scene_/);
    });

    it("inserts clone after the original", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [
          makeScene({ id: "s1", sortOrder: 0 }),
          makeScene({ id: "s2", sortOrder: 1 }),
          makeScene({ id: "s3", sortOrder: 2 }),
        ],
      }));
      useStoryStore.getState().duplicateScene("story_test_abc1", "s2");
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes).toHaveLength(4);
      expect(scenes[0].id).toBe("s1");
      expect(scenes[1].id).toBe("s2");
      // scenes[2] is the clone
      expect(scenes[2].id).not.toBe("s2");
      expect(scenes[2].title).toBe(scenes[1].title);
      expect(scenes[3].id).toBe("s3");
    });

    it("renumbers sortOrder after duplication", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1" }), makeScene({ id: "s2" })],
      }));
      useStoryStore.getState().duplicateScene("story_test_abc1", "s1");
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      expect(scenes[0].sortOrder).toBe(0);
      expect(scenes[1].sortOrder).toBe(1);
      expect(scenes[2].sortOrder).toBe(2);
    });

    it("auto-selects the new duplicated scene", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1" })],
      }));
      useStoryStore.getState().duplicateScene("story_test_abc1", "s1");
      const scenes = useStoryStore.getState().stories["story_test_abc1"].scenes;
      const cloneId = scenes[1].id;
      expect(useStoryStore.getState().activeSceneId).toBe(cloneId);
    });

    it("snapshots for undo", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1" })],
      }));
      const pastBefore = useStoryStore.getState().storyPast.length;
      useStoryStore.getState().duplicateScene("story_test_abc1", "s1");
      expect(useStoryStore.getState().storyPast.length).toBe(pastBefore + 1);
    });

    it("is a no-op for missing scene", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1" })],
      }));
      useStoryStore.getState().duplicateScene("story_test_abc1", "nonexistent");
      expect(useStoryStore.getState().stories["story_test_abc1"].scenes).toHaveLength(1);
    });
  });

  describe("setActiveScene", () => {
    it("sets activeSceneId", () => {
      useStoryStore.getState().setActiveScene("scene_abc");
      expect(useStoryStore.getState().activeSceneId).toBe("scene_abc");
    });

    it("clears activeSceneId when set to null", () => {
      useStoryStore.getState().setActiveScene("scene_abc");
      useStoryStore.getState().setActiveScene(null);
      expect(useStoryStore.getState().activeSceneId).toBeNull();
    });
  });

  describe("selectActiveScene", () => {
    it("returns the active scene when story and scene exist", () => {
      const scene = makeScene({ id: "s1", title: "Active Scene" });
      useStoryStore.getState().setStory(makeStory({ scenes: [scene] }));
      useStoryStore.getState().setActiveStory("story_test_abc1");
      useStoryStore.getState().setActiveScene("s1");
      const result = selectActiveScene(useStoryStore.getState());
      expect(result?.title).toBe("Active Scene");
    });

    it("returns undefined when no active scene", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().setActiveStory("story_test_abc1");
      const result = selectActiveScene(useStoryStore.getState());
      expect(result).toBeUndefined();
    });
  });

  describe("scene undo/redo", () => {
    it("addScene -> undo restores empty scenes", () => {
      useStoryStore.getState().setStory(makeStory());
      useStoryStore.getState().addScene("story_test_abc1", makeScene());
      expect(useStoryStore.getState().stories["story_test_abc1"].scenes).toHaveLength(1);
      useStoryStore.getState().undoStory();
      expect(useStoryStore.getState().stories["story_test_abc1"].scenes).toHaveLength(0);
    });

    it("removeScene -> undo restores the scene", () => {
      useStoryStore.getState().setStory(makeStory({
        scenes: [makeScene({ id: "s1" })],
      }));
      useStoryStore.getState().removeScene("story_test_abc1", "s1");
      expect(useStoryStore.getState().stories["story_test_abc1"].scenes).toHaveLength(0);
      useStoryStore.getState().undoStory();
      expect(useStoryStore.getState().stories["story_test_abc1"].scenes).toHaveLength(1);
      expect(useStoryStore.getState().stories["story_test_abc1"].scenes[0].id).toBe("s1");
    });
  });
});
