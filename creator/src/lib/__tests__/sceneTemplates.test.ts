import { describe, it, expect } from "vitest";
import {
  SCENE_TEMPLATE_PRESETS,
  applyTemplate,
  isSceneEmpty,
} from "../sceneTemplates";
import type { Scene } from "@/types/story";

// ─── Scene template preset tests ───────────────────────────────────

describe("SCENE_TEMPLATE_PRESETS", () => {
  it("contains all three template IDs", () => {
    expect(SCENE_TEMPLATE_PRESETS).toHaveProperty("establishing_shot");
    expect(SCENE_TEMPLATE_PRESETS).toHaveProperty("encounter");
    expect(SCENE_TEMPLATE_PRESETS).toHaveProperty("discovery");
  });

  it.each(["establishing_shot", "encounter", "discovery"] as const)(
    "%s has non-empty label, defaultTitle, badgeColor, and defaultNarration",
    (templateId) => {
      const preset = SCENE_TEMPLATE_PRESETS[templateId];
      expect(preset.label).toBeTruthy();
      expect(preset.defaultTitle).toBeTruthy();
      expect(preset.badgeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.defaultNarration).toBeTruthy();
    },
  );

  it.each(["establishing_shot", "encounter", "discovery"] as const)(
    "%s has valid TipTap JSON defaultNarration",
    (templateId) => {
      const preset = SCENE_TEMPLATE_PRESETS[templateId];
      const parsed = JSON.parse(preset.defaultNarration);
      expect(parsed.type).toBe("doc");
      expect(Array.isArray(parsed.content)).toBe(true);
      expect(parsed.content.length).toBeGreaterThan(0);
      expect(parsed.content[0].type).toBe("paragraph");
    },
  );

  it("establishing_shot has correct badge color", () => {
    expect(SCENE_TEMPLATE_PRESETS.establishing_shot.badgeColor).toBe("#15616d");
  });

  it("encounter has correct badge color", () => {
    expect(SCENE_TEMPLATE_PRESETS.encounter.badgeColor).toBe("#ff7d00");
  });

  it("discovery has correct badge color", () => {
    expect(SCENE_TEMPLATE_PRESETS.discovery.badgeColor).toBe("#ffb86b");
  });
});

describe("applyTemplate", () => {
  it("returns correct partial for establishing_shot", () => {
    const patch = applyTemplate("establishing_shot");
    expect(patch.title).toBe("The Scene Opens");
    expect(patch.template).toBe("establishing_shot");
    expect(patch.narration).toBeTruthy();
  });

  it("returns correct partial for encounter", () => {
    const patch = applyTemplate("encounter");
    expect(patch.title).toBe("A Confrontation");
    expect(patch.template).toBe("encounter");
    expect(patch.narration).toBeTruthy();
  });

  it("returns correct partial for discovery", () => {
    const patch = applyTemplate("discovery");
    expect(patch.title).toBe("What Lies Hidden");
    expect(patch.template).toBe("discovery");
    expect(patch.narration).toBeTruthy();
  });
});

describe("isSceneEmpty", () => {
  function makeScene(overrides: Partial<Scene> = {}): Scene {
    return {
      id: "scene_test",
      title: "",
      sortOrder: 0,
      ...overrides,
    };
  }

  it("returns true for a scene with empty title and no narration/dmNotes", () => {
    expect(isSceneEmpty(makeScene())).toBe(true);
  });

  it("returns true for a scene whose title matches a default template title", () => {
    expect(isSceneEmpty(makeScene({ title: "The Scene Opens" }))).toBe(true);
    expect(isSceneEmpty(makeScene({ title: "A Confrontation" }))).toBe(true);
    expect(isSceneEmpty(makeScene({ title: "What Lies Hidden" }))).toBe(true);
  });

  it("returns false for a scene with narration content", () => {
    expect(isSceneEmpty(makeScene({ narration: "Some narration" }))).toBe(false);
  });

  it("returns false for a scene with dmNotes", () => {
    expect(isSceneEmpty(makeScene({ dmNotes: "Some notes" }))).toBe(false);
  });

  it("returns false for a scene with a custom title", () => {
    expect(isSceneEmpty(makeScene({ title: "My Custom Title" }))).toBe(false);
  });
});
