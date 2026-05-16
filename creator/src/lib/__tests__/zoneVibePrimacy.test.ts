import { describe, expect, it } from "vitest";
import {
  buildCustomAssetPrompt,
  buildZoneVibeBlock,
  buildZoneVibeReiteration,
  getPreamble,
  getStyleSuffix,
} from "../arcanumPrompts";
import { roomPrompt, mobPrompt, itemPrompt, entityPrompt } from "../entityPrompts";
import type { ItemFile, MobFile, RoomFile } from "@/types/world";

const NIGHTMARE_VIBE = `Twilight realm of warped childhood spaces. Palette: Deep Mist #22293c + Soft Fog #6f7da1 + bruised purples + diseased gold.`;

const SAMPLE_ROOM: RoomFile = {
  title: "padded corridor",
  description: "A long quilted hallway lit by a sickly lamp.",
  exits: {},
};

const SAMPLE_MOB: MobFile = {
  name: "a tattered toy",
  spawns: [{ room: "room_1" }],
  tier: "weak",
  level: 1,
};

const SAMPLE_ITEM: ItemFile = {
  displayName: "Tarnished Block",
  slot: "weapon",
  damage: 3,
};

// Palette words that should disappear from prompt bodies when a zone vibe
// owns palette. We don't want the LLM/image-model to be told "lavender"
// when the zone is Nightmare Alley.
const GENTLE_PALETTE_WORDS = ["lavender", "dusty rose", "moss green", "moss-green"];
const ARCANUM_PALETTE_WORDS = ["aurum-gold", "indigo", "blue-violet"];

describe("zone vibe primacy", () => {
  describe("buildZoneVibeBlock / Reiteration", () => {
    it("wraps the vibe as a high-priority override directive", () => {
      const block = buildZoneVibeBlock(NIGHTMARE_VIBE);
      expect(block).toMatch(/ZONE ART DIRECTION/);
      expect(block).toMatch(/primary authority/);
      expect(block).toContain(NIGHTMARE_VIBE);
    });

    it("the reiteration restates the vibe at the end of the prompt", () => {
      const tail = buildZoneVibeReiteration(NIGHTMARE_VIBE);
      expect(tail).toMatch(/ZONE PALETTE OVERRIDE/);
      expect(tail).toContain(NIGHTMARE_VIBE);
    });
  });

  describe("getPreamble / getStyleSuffix paletteAuthority", () => {
    it("returns composition-only preamble when paletteAuthority is zone-vibe", () => {
      const gm = getPreamble("gentle_magic", "worldbuilding", { paletteAuthority: "zone-vibe" });
      for (const word of GENTLE_PALETTE_WORDS) {
        expect(gm.toLowerCase(), `gentle_magic no-palette preamble should not contain "${word}"`).not.toContain(word.toLowerCase());
      }
      const arc = getPreamble("arcanum", "worldbuilding", { paletteAuthority: "zone-vibe" });
      for (const word of ARCANUM_PALETTE_WORDS) {
        expect(arc.toLowerCase(), `arcanum no-palette preamble should not contain "${word}"`).not.toContain(word.toLowerCase());
      }
    });

    it("returns composition-only suffix when paletteAuthority is zone-vibe", () => {
      const suffix = getStyleSuffix("worldbuilding", { paletteAuthority: "zone-vibe" });
      expect(suffix.toLowerCase()).not.toContain("lavender");
      expect(suffix.toLowerCase()).not.toContain("aurum");
      expect(suffix).toMatch(/ZONE ART DIRECTION/);
    });
  });

  describe("roomPrompt", () => {
    it("contains the zone vibe block when vibe is provided", () => {
      const p = roomPrompt("r1", SAMPLE_ROOM, "gentle_magic", NIGHTMARE_VIBE);
      expect(p).toMatch(/ZONE ART DIRECTION/);
      expect(p).toMatch(/ZONE PALETTE OVERRIDE/);
      expect(p).toContain(NIGHTMARE_VIBE);
    });

    it("strips gentle_magic palette words from the body when vibe is set", () => {
      const p = roomPrompt("r1", SAMPLE_ROOM, "gentle_magic", NIGHTMARE_VIBE).toLowerCase();
      for (const word of GENTLE_PALETTE_WORDS) {
        // The vibe itself may contain palette words (it does — "Soft Fog", etc.),
        // so we only check that the *style template body* doesn't leak gentle_magic
        // defaults. We do this by looking at the substring AFTER the vibe block.
        const afterVibe = p.split(NIGHTMARE_VIBE.toLowerCase())[2] ?? p;
        expect(afterVibe, `room body should not contain "${word}" after vibe block`).not.toContain(word.toLowerCase());
      }
    });

    it("keeps the gentle_magic palette body when no vibe is provided", () => {
      const p = roomPrompt("r1", SAMPLE_ROOM, "gentle_magic").toLowerCase();
      // At least one of the original palette words should still be present.
      const hasPalette = GENTLE_PALETTE_WORDS.some((w) => p.includes(w.toLowerCase()));
      expect(hasPalette).toBe(true);
    });
  });

  describe("mobPrompt + itemPrompt + entityPrompt", () => {
    it("mob prompt embeds vibe block when set", () => {
      const p = mobPrompt("m1", SAMPLE_MOB, "gentle_magic", NIGHTMARE_VIBE);
      expect(p).toMatch(/ZONE ART DIRECTION/);
      expect(p).toContain(NIGHTMARE_VIBE);
    });

    it("item prompt embeds vibe block when set", () => {
      const p = itemPrompt("i1", SAMPLE_ITEM, "gentle_magic", NIGHTMARE_VIBE);
      expect(p).toMatch(/ZONE ART DIRECTION/);
      expect(p).toContain(NIGHTMARE_VIBE);
    });

    it("entityPrompt dispatch threads vibe to room/mob/item children", () => {
      const r = entityPrompt("room", "r1", SAMPLE_ROOM, "gentle_magic", NIGHTMARE_VIBE);
      const m = entityPrompt("mob", "m1", SAMPLE_MOB, "gentle_magic", NIGHTMARE_VIBE);
      const i = entityPrompt("item", "i1", SAMPLE_ITEM, "gentle_magic", NIGHTMARE_VIBE);
      for (const p of [r, m, i]) {
        expect(p).toMatch(/ZONE ART DIRECTION/);
      }
    });

    it("entityPrompt unknown kind still wraps with vibe", () => {
      const p = entityPrompt("strange", "x", { name: "x" }, "gentle_magic", NIGHTMARE_VIBE);
      expect(p).toMatch(/ZONE ART DIRECTION/);
    });

    it("prompts without vibe do not include the override directive", () => {
      const p = roomPrompt("r1", SAMPLE_ROOM, "gentle_magic");
      expect(p).not.toMatch(/ZONE ART DIRECTION/);
      expect(p).not.toMatch(/ZONE PALETTE OVERRIDE/);
    });
  });

  describe("buildCustomAssetPrompt", () => {
    it("wraps custom-asset prompts with vibe primacy when vibe is set", () => {
      const p = buildCustomAssetPrompt("background", "A rocking chair", NIGHTMARE_VIBE);
      expect(p).toMatch(/ZONE ART DIRECTION/);
      expect(p).toMatch(/ZONE PALETTE OVERRIDE/);
    });

    it("does not include the directive when vibe is absent or empty", () => {
      expect(buildCustomAssetPrompt("background", "A rocking chair")).not.toMatch(/ZONE ART DIRECTION/);
      expect(buildCustomAssetPrompt("background", "A rocking chair", "")).not.toMatch(/ZONE ART DIRECTION/);
      expect(buildCustomAssetPrompt("background", "A rocking chair", "   ")).not.toMatch(/ZONE ART DIRECTION/);
    });
  });
});
