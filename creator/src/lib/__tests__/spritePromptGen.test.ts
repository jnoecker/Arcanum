import { afterEach, describe, expect, it } from "vitest";
import {
  buildEnhancedSpritePrompt,
  spriteBasePrompt,
  spriteContext,
} from "../spritePromptGen";
import {
  SPRITE_FRAMING_DIRECTIVE,
  SPRITE_SAFETY_DIRECTIVE,
} from "../arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";
import type { ApplicationConfig } from "@/types/config";

const TEST_CONFIG = {
  races: {
    emberkin: {
      bodyDescription: "small flame-wreathed humanoid with obsidian skin",
      imagePromptDirective: "NO HUMAN FACE",
    },
  },
  classes: {
    warden: { outfitDescription: "rust-red leather armor with a curved hunting bow" },
  },
} as unknown as ApplicationConfig;

afterEach(() => {
  useConfigStore.setState({ config: null });
});

describe("spriteContext", () => {
  it("describes the sprite's purpose and dimensions", () => {
    const context = spriteContext("Emberkin Warden", {
      race: "emberkin",
      playerClass: "warden",
      gender: "female",
    });
    expect(context).toContain('"Emberkin Warden"');
    expect(context).toMatch(/standing/i);
    expect(context).toContain("Gender: female");
    expect(context).toContain("Race: emberkin");
    expect(context).toContain("Class: warden");
  });

  it("includes config descriptions and the race hard constraint", () => {
    useConfigStore.setState({ config: TEST_CONFIG });
    const context = spriteContext("Emberkin Warden", {
      race: "emberkin",
      playerClass: "warden",
    });
    expect(context).toContain("flame-wreathed humanoid");
    expect(context).toContain("rust-red leather armor");
    expect(context).toContain("NO HUMAN FACE");
  });

  it("falls back to traveler's clothing when no class is set", () => {
    const context = spriteContext("Wanderer", { race: "emberkin" });
    expect(context).toMatch(/traveler's clothing/);
  });

  it("appends free-form notes as art direction", () => {
    const context = spriteContext("Hero", {}, "wields a flaming greatsword");
    expect(context).toContain("Art direction: wields a flaming greatsword");
  });
});

describe("spriteBasePrompt", () => {
  it("uses the standing full-body sprite format with bg-removal safety", () => {
    const prompt = spriteBasePrompt({ race: "emberkin", gender: "male" }, "gentle_magic");
    expect(prompt).toMatch(/full-body character sprite/i);
    expect(prompt).toMatch(/standing pose/i);
    expect(prompt).toContain(SPRITE_SAFETY_DIRECTIVE);
  });

  it("uses light framing rules for native-transparency models", () => {
    const prompt = spriteBasePrompt({ race: "emberkin" }, "gentle_magic", undefined, true);
    expect(prompt).toContain(SPRITE_FRAMING_DIRECTIVE);
    expect(prompt).not.toContain(SPRITE_SAFETY_DIRECTIVE);
  });

  it("carries the race image-prompt directive verbatim", () => {
    useConfigStore.setState({ config: TEST_CONFIG });
    const prompt = spriteBasePrompt({ race: "emberkin" }, "arcanum");
    expect(prompt).toContain("NO HUMAN FACE");
  });
});

describe("buildEnhancedSpritePrompt", () => {
  it("returns the composed base prompt without an LLM when enhancement is off", async () => {
    const prompt = await buildEnhancedSpritePrompt({
      displayName: "Emberkin Warden",
      dimensions: { race: "emberkin", playerClass: "warden" },
      style: "gentle_magic",
      enhance: false,
    });
    expect(prompt).toBe(spriteBasePrompt({ race: "emberkin", playerClass: "warden" }, "gentle_magic"));
  });
});
