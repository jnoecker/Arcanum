import { describe, it, expect } from "vitest";
import {
  computeBackgroundFit,
  computeEntityRect,
  computeSceneFrameLayout,
  type LayoutEntityInfo,
} from "../storyFrameLayout";
import type { Scene, SceneEntity } from "@/types/story";

// ─── Fixture helpers ─────────────────────────────────────────────

function sceneFixture(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "s1",
    title: "Scene 1",
    sortOrder: 0,
    entities: [],
    ...overrides,
  };
}

function entityFixture(overrides: Partial<SceneEntity> = {}): SceneEntity {
  return {
    id: "e1",
    entityType: "mob",
    entityId: "m1",
    slot: "front-center",
    ...overrides,
  };
}

// ─── computeBackgroundFit ─────────────────────────────────────────

describe("computeBackgroundFit - fit strategy", () => {
  it("same aspect: full source, full target", () => {
    const { src, dst } = computeBackgroundFit(1920, 1080, 1920, 1080, "fit");
    expect(src).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(dst).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("wider source into 16:9 target: pillarboxes top/bottom", () => {
    // 2000x500 (4:1) into 1920x1080 (16:9)
    const { src, dst } = computeBackgroundFit(2000, 500, 1920, 1080, "fit");
    expect(src).toEqual({ x: 0, y: 0, width: 2000, height: 500 });
    expect(dst.width).toBe(1920);
    expect(dst.height).toBe(Math.round(1920 / (2000 / 500)));
    // Centered vertically
    expect(dst.y).toBe(Math.round((1080 - dst.height) / 2));
    expect(dst.x).toBe(0);
  });

  it("taller source into 16:9 target: letterboxes left/right", () => {
    // 500x1000 (1:2) into 1920x1080 (16:9)
    const { src, dst } = computeBackgroundFit(500, 1000, 1920, 1080, "fit");
    expect(src).toEqual({ x: 0, y: 0, width: 500, height: 1000 });
    expect(dst.height).toBe(1080);
    expect(dst.width).toBe(Math.round(1080 * (500 / 1000)));
    // Centered horizontally
    expect(dst.x).toBe(Math.round((1920 - dst.width) / 2));
    expect(dst.y).toBe(0);
  });

  it("16:9 source into 9:16 (vertical) target: letterboxes left/right narrowly", () => {
    const { src, dst } = computeBackgroundFit(1920, 1080, 1080, 1920, "fit");
    expect(src).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    // Source wider (16:9 > 9:16), so fit to width → pillarbox
    expect(dst.width).toBe(1080);
    expect(dst.height).toBeLessThan(1920);
  });
});

describe("computeBackgroundFit - fill/crop_center strategies", () => {
  it("same aspect: full source, full target (no cropping needed)", () => {
    const { src, dst } = computeBackgroundFit(1920, 1080, 1920, 1080, "fill");
    expect(src.width).toBe(1920);
    expect(dst).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("wider source into 16:9 target: crops source left/right", () => {
    // 3000x1080 (2.78:1) into 1920x1080 (16:9, 1.78:1)
    const { src, dst } = computeBackgroundFit(3000, 1080, 1920, 1080, "fill");
    expect(dst).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(src.height).toBe(1080);
    expect(src.width).toBe(Math.round(1080 * (1920 / 1080)));
    // Cropped from center
    expect(src.x).toBe(Math.round((3000 - src.width) / 2));
  });

  it("taller source into 16:9 target: crops source top/bottom", () => {
    // 1920x2500 (0.77:1) into 1920x1080 (16:9)
    const { src, dst } = computeBackgroundFit(1920, 2500, 1920, 1080, "fill");
    expect(dst).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(src.width).toBe(1920);
    expect(src.height).toBe(Math.round(1920 / (1920 / 1080)));
    expect(src.y).toBe(Math.round((2500 - src.height) / 2));
  });

  it("16:9 source into 9:16 target with fill: crops source sides heavily", () => {
    // The 16:9 room art cropped to fit a 9:16 vertical frame
    const { src, dst } = computeBackgroundFit(1920, 1080, 1080, 1920, "fill");
    expect(dst).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
    expect(src.height).toBe(1080);
    // Source width is narrow (roughly 1080/1920 × 1080)
    expect(src.width).toBeLessThan(1920);
    expect(src.x).toBeGreaterThan(0); // Cropped from center
  });
});

// ─── computeEntityRect ────────────────────────────────────────────

describe("computeEntityRect - anchor positioning", () => {
  it("front-center sprite is bottom-center anchored at (50%, 72%)", () => {
    const entity = entityFixture({ slot: "front-center" });
    const rect = computeEntityRect(
      entity,
      { width: 100, height: 120 }, // 5:6 aspect
      1920,
      1080,
    );
    const anchorX = Math.round(0.5 * 1920);
    const anchorY = Math.round(0.72 * 1080);
    // Bottom-center of rect sits at anchor
    expect(rect.x + Math.round(rect.width / 2)).toBeCloseTo(anchorX, 0);
    expect(rect.y + rect.height).toBe(anchorY);
  });

  it("width scales with target viewport width, not absolute pixels", () => {
    const entity = entityFixture({ slot: "front-center" });
    const small = computeEntityRect(entity, { width: 100, height: 100 }, 1280, 720);
    const large = computeEntityRect(entity, { width: 100, height: 100 }, 1920, 1080);
    expect(large.width).toBeGreaterThan(small.width);
    // Ratio should match the preset width ratio
    expect(large.width / small.width).toBeCloseTo(1920 / 1280, 1);
  });

  it("back-row sprites are 0.78x smaller than front-row", () => {
    const back = computeEntityRect(
      entityFixture({ slot: "back-center" }),
      { width: 100, height: 100 },
      1920,
      1080,
    );
    const front = computeEntityRect(
      entityFixture({ slot: "front-center" }),
      { width: 100, height: 100 },
      1920,
      1080,
    );
    expect(back.width).toBeCloseTo(front.width * 0.78, 0);
  });

  it("sprite height follows natural image aspect", () => {
    const tall = computeEntityRect(
      entityFixture(),
      { width: 100, height: 200 }, // 1:2 portrait
      1920,
      1080,
    );
    const square = computeEntityRect(
      entityFixture(),
      { width: 100, height: 100 }, // 1:1
      1920,
      1080,
    );
    // Same width, but tall one is 2x taller
    expect(tall.width).toBe(square.width);
    expect(tall.height).toBeCloseTo(square.height * 2, 0);
  });

  it("uses default aspect when imageSize is undefined", () => {
    const rect = computeEntityRect(entityFixture(), undefined, 1920, 1080);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    // Default aspect is 1/1.2, so height should be taller than width
    expect(rect.height).toBeGreaterThan(rect.width);
  });

  it("custom position overrides slot", () => {
    const entity = entityFixture({
      slot: undefined,
      position: { x: 25, y: 50 },
    });
    const rect = computeEntityRect(entity, { width: 100, height: 100 }, 1920, 1080);
    // Bottom-center of rect at (25%, 50%)
    expect(rect.x + Math.round(rect.width / 2)).toBe(Math.round(0.25 * 1920));
    expect(rect.y + rect.height).toBe(Math.round(0.5 * 1080));
  });
});

// ─── computeSceneFrameLayout ──────────────────────────────────────

describe("computeSceneFrameLayout", () => {
  const entities: LayoutEntityInfo[] = [
    {
      entity: entityFixture({ id: "front", slot: "front-center" }),
      name: "Front Mob",
      imageSize: { width: 100, height: 120 },
    },
    {
      entity: entityFixture({ id: "back", slot: "back-left" }),
      name: "Back Mob",
      imageSize: { width: 100, height: 100 },
    },
  ];

  it("populates width and height from target dims", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      entities,
      { width: 1920, height: 1080 },
      1920,
      1080,
    );
    expect(layout.width).toBe(1920);
    expect(layout.height).toBe(1080);
  });

  it("background is null when no room image is provided", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      [],
      undefined,
      1920,
      1080,
    );
    expect(layout.background).toBeNull();
  });

  it("background uses the fit strategy for letterboxing", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      [],
      { width: 1920, height: 1080 },
      1080,
      1920,
      { fit: "fit" },
    );
    expect(layout.background).not.toBeNull();
    expect(layout.background!.fillColor).toBe("#000000");
    expect(layout.background!.dst.width).toBe(1080);
    // 16:9 source pillarboxed into 9:16 frame
    expect(layout.background!.dst.height).toBeLessThan(1920);
  });

  it("background fillColor is null for fill strategy", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      [],
      { width: 1920, height: 1080 },
      1080,
      1920,
      { fit: "fill" },
    );
    expect(layout.background).not.toBeNull();
    expect(layout.background!.fillColor).toBeNull();
    // fill covers the full frame
    expect(layout.background!.dst).toEqual({
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
    });
  });

  it("splits entities into back and front row layers", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      entities,
      { width: 1920, height: 1080 },
      1920,
      1080,
    );
    expect(layout.backRowEntities).toHaveLength(1);
    expect(layout.frontRowEntities).toHaveLength(1);
    expect(layout.backRowEntities[0]!.entityId).toBe("back");
    expect(layout.frontRowEntities[0]!.entityId).toBe("front");
  });

  it("back row entities get reduced opacity", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      entities,
      undefined,
      1920,
      1080,
    );
    expect(layout.backRowEntities[0]!.opacity).toBeLessThan(1);
    expect(layout.frontRowEntities[0]!.opacity).toBe(1);
  });

  it("marks hasImage = false for entities without imageSize", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      [
        {
          entity: entityFixture({ id: "nopic" }),
          name: "No Image",
        },
      ],
      undefined,
      1920,
      1080,
    );
    expect(layout.frontRowEntities[0]!.hasImage).toBe(false);
  });

  it("emits titleCard when scene has a title card with non-empty text", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture({ titleCard: { text: "Act One", style: "subtitle" } }),
      [],
      undefined,
      1920,
      1080,
    );
    expect(layout.titleCard).not.toBeNull();
    expect(layout.titleCard!.text).toBe("Act One");
    expect(layout.titleCard!.rect.width).toBeGreaterThan(0);
    expect(layout.titleCard!.rect.height).toBeGreaterThan(0);
  });

  it("omits titleCard for whitespace-only text", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture({ titleCard: { text: "   " } }),
      [],
      undefined,
      1920,
      1080,
    );
    expect(layout.titleCard).toBeNull();
  });

  it("captionArea is positioned in the lower third", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      [],
      undefined,
      1920,
      1080,
    );
    // Lower third: y should be well below the midline
    expect(layout.captionArea.rect.y).toBeGreaterThan(1080 / 2);
    // Width should be narrower than full frame (centered with padding)
    expect(layout.captionArea.rect.width).toBeLessThan(1920);
    // Horizontally centered
    expect(
      layout.captionArea.rect.x + Math.round(layout.captionArea.rect.width / 2),
    ).toBeCloseTo(1920 / 2, 0);
  });

  it("supports custom fillColor option", () => {
    const layout = computeSceneFrameLayout(
      sceneFixture(),
      [],
      { width: 1920, height: 1080 },
      1080,
      1920,
      { fit: "fit", fillColor: "#1a2040" },
    );
    expect(layout.background!.fillColor).toBe("#1a2040");
  });
});
