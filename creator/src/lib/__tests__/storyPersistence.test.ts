import { describe, it, expect } from "vitest";
import { storiesDir, storyPath } from "../storyPersistence";
import type { Story } from "@/types/story";
import type { Project } from "@/types/project";

function makeProject(format: "standalone" | "legacy" = "standalone"): Project {
  return {
    version: 1,
    name: "Test Project",
    mudDir: "/test/project",
    format,
    openZones: [],
  };
}

function makeFullStory(): Story {
  return {
    id: "story_round_trip",
    title: "Round Trip Story",
    zoneId: "zone_castle",
    coverImage: "abc123.png",
    scenes: [
      {
        id: "s1",
        title: "Scene 1",
        sortOrder: 0,
        roomId: "room_throne",
        narration: '{"type":"doc","content":[]}',
        dmNotes: "The king is secretly a dragon.",
        template: "establishing_shot",
        entities: [
          {
            id: "e1",
            entityType: "mob",
            entityId: "mob_king",
            position: { x: 100, y: 200 },
            entrancePath: "enter-from-left",
            exitPath: "exit-stage-left",
          },
        ],
        transition: { type: "crossfade" },
        effects: { particles: "sparks", parallaxLayers: 3, parallaxDepth: 0.5 },
      },
      {
        id: "s2",
        title: "Scene 2",
        sortOrder: 1,
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-15T12:30:00.000Z",
  };
}

describe("storyPersistence", () => {
  describe("storiesDir", () => {
    it("returns correct path for standalone format", () => {
      const project = makeProject("standalone");
      expect(storiesDir(project)).toBe("/test/project/stories");
    });

    it("returns correct path for legacy format", () => {
      const project = makeProject("legacy");
      expect(storiesDir(project)).toBe("/test/project/src/main/resources/stories");
    });
  });

  describe("storyPath", () => {
    it("returns correct path for a story", () => {
      const project = makeProject("standalone");
      expect(storyPath(project, "my_story")).toBe("/test/project/stories/my_story.json");
    });
  });

  describe("JSON serialization", () => {
    it("serializes Story to JSON with 2-space indent", () => {
      const story = makeFullStory();
      const json = JSON.stringify(story, null, 2);
      expect(json).toContain('"coverImage": "abc123.png"');
      expect(json).toContain('"title": "Scene 1"');
      // Verify it starts with 2-space indentation (not tabs)
      const lines = json.split("\n");
      expect(lines[1]).toMatch(/^ {2}"/);
    });

    it("deserializes JSON back to Story with all fields intact", () => {
      const story = makeFullStory();
      const json = JSON.stringify(story, null, 2);
      const parsed = JSON.parse(json) as Story;
      expect(parsed.id).toBe("story_round_trip");
      expect(parsed.title).toBe("Round Trip Story");
      expect(parsed.zoneId).toBe("zone_castle");
      expect(parsed.scenes).toHaveLength(2);
      expect(parsed.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(parsed.updatedAt).toBe("2026-01-15T12:30:00.000Z");
    });

    it("handles coverImage field round-trip", () => {
      const story = makeFullStory();
      const json = JSON.stringify(story, null, 2);
      const parsed = JSON.parse(json) as Story;
      expect(parsed.coverImage).toBe("abc123.png");
    });

    it("round-trips all optional fields", () => {
      const story = makeFullStory();
      const json = JSON.stringify(story, null, 2);
      const parsed = JSON.parse(json) as Story;

      // Scene 1 has all optional fields
      const scene = parsed.scenes[0];
      expect(scene.roomId).toBe("room_throne");
      expect(scene.narration).toBe('{"type":"doc","content":[]}');
      expect(scene.dmNotes).toBe("The king is secretly a dragon.");
      expect(scene.template).toBe("establishing_shot");
      expect(scene.entities).toHaveLength(1);
      expect(scene.entities![0].entityType).toBe("mob");
      expect(scene.entities![0].position).toEqual({ x: 100, y: 200 });
      expect(scene.entities![0].entrancePath).toBe("enter-from-left");
      expect(scene.entities![0].exitPath).toBe("exit-stage-left");
      expect(scene.transition).toEqual({ type: "crossfade" });
      expect(scene.effects).toEqual({ particles: "sparks", parallaxLayers: 3, parallaxDepth: 0.5 });

      // Scene 2 has only required fields
      const scene2 = parsed.scenes[1];
      expect(scene2.id).toBe("s2");
      expect(scene2.title).toBe("Scene 2");
      expect(scene2.sortOrder).toBe(1);
      expect(scene2.roomId).toBeUndefined();
    });
  });

  describe("storyId validation", () => {
    it("validates storyId format", () => {
      // The STORY_ID_PATTERN regex should match valid IDs
      const validIds = ["my_story", "story_01", "a", "abc123"];
      const invalidIds = ["../escape", "path/traversal", "with spaces", "CAPS"];
      const pattern = /^[a-z0-9_]+$/;
      for (const id of validIds) {
        expect(pattern.test(id), `Expected "${id}" to be valid`).toBe(true);
      }
      for (const id of invalidIds) {
        expect(pattern.test(id), `Expected "${id}" to be invalid`).toBe(false);
      }
    });
  });
});
