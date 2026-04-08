import { describe, expect, it } from "vitest";
import {
  BG_REMOVAL_ASSET_TYPES,
  SPRITE_SAFETY_DIRECTIVE,
  buildCustomAssetPrompt,
  getEnhanceSystemPrompt,
  needsBgRemovalSafety,
  withSpriteSafety,
} from "../arcanumPrompts";
import { mobPrompt } from "../entityPrompts";
import type { MobFile } from "@/types/world";

// ─── Sprite safety directive — see arcanumPrompts.ts for context ────
// Background removal (bg-removal worker) frequently clips wings and
// bleeds decorative backgrounds into sprites. These tests lock in the
// hard constraints that get injected into every prompt for asset types
// that will be matted out of their background.

describe("sprite safety directive", () => {
  it("tags all known bg-removable asset types as needing safety", () => {
    for (const type of BG_REMOVAL_ASSET_TYPES) {
      expect(needsBgRemovalSafety(type)).toBe(true);
    }
  });

  it("does not inject safety for scene/background asset types", () => {
    expect(needsBgRemovalSafety("room")).toBe(false);
    expect(needsBgRemovalSafety("background")).toBe(false);
    expect(needsBgRemovalSafety("zone_map")).toBe(false);
    expect(needsBgRemovalSafety("ability_icon")).toBe(false);
  });

  it("withSpriteSafety appends the directive for bg-removable types", () => {
    const base = "A fairy in flight";
    const wrapped = withSpriteSafety(base, "mob");
    expect(wrapped).toContain(base);
    expect(wrapped).toContain(SPRITE_SAFETY_DIRECTIVE);
  });

  it("withSpriteSafety is a no-op for non-sprite types", () => {
    const base = "A stone cottage at dusk";
    expect(withSpriteSafety(base, "room")).toBe(base);
    expect(withSpriteSafety(base, "background")).toBe(base);
  });

  it("directive explicitly addresses the single-wing failure mode", () => {
    expect(SPRITE_SAFETY_DIRECTIVE).toMatch(/wings/i);
    expect(SPRITE_SAFETY_DIRECTIVE).toMatch(/opaque/i);
    expect(SPRITE_SAFETY_DIRECTIVE).toMatch(/both/i);
  });

  it("directive bans decorative sticker-sheet backgrounds", () => {
    expect(SPRITE_SAFETY_DIRECTIVE).toMatch(/flat/i);
    expect(SPRITE_SAFETY_DIRECTIVE).toMatch(/scrollwork/i);
    expect(SPRITE_SAFETY_DIRECTIVE).toMatch(/quilt|sticker/i);
  });
});

describe("buildCustomAssetPrompt sprite safety", () => {
  it("injects the directive for mob asset type", () => {
    const prompt = buildCustomAssetPrompt("mob", "a glittering fae");
    expect(prompt).toContain(SPRITE_SAFETY_DIRECTIVE);
  });

  it("injects the directive for pet asset type", () => {
    const prompt = buildCustomAssetPrompt("pet", "a tiny dragon hatchling");
    expect(prompt).toContain(SPRITE_SAFETY_DIRECTIVE);
  });

  it("does not inject the directive for room asset type", () => {
    const prompt = buildCustomAssetPrompt("room", "a moonlit library");
    expect(prompt).not.toContain(SPRITE_SAFETY_DIRECTIVE);
  });
});

describe("mobPrompt sprite safety", () => {
  const fae: MobFile = {
    name: "Iridia",
    description: "a four-winged faerie with gossamer wings",
    level: 5,
    tier: "standard",
  } as MobFile;

  it("gentle_magic mob prompt contains the sprite safety directive", () => {
    const prompt = mobPrompt("iridia", fae, "gentle_magic");
    expect(prompt).toContain(SPRITE_SAFETY_DIRECTIVE);
  });

  it("arcanum mob prompt contains the sprite safety directive", () => {
    const prompt = mobPrompt("iridia", fae, "arcanum");
    expect(prompt).toContain(SPRITE_SAFETY_DIRECTIVE);
  });
});

describe("getEnhanceSystemPrompt sprite safety", () => {
  it("includes the sprite-safety enhancer block for bg-removable asset types", () => {
    const system = getEnhanceSystemPrompt("gentle_magic", "mob");
    expect(system).toMatch(/SPRITE SAFETY RULES/);
    expect(system).toMatch(/wings/i);
    expect(system).toMatch(/OPAQUE/);
  });

  it("omits the sprite-safety enhancer block for scene asset types", () => {
    const system = getEnhanceSystemPrompt("gentle_magic", "room");
    expect(system).not.toMatch(/SPRITE SAFETY RULES/);
  });
});
