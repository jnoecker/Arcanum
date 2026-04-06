import type { TierDefinitionConfig } from "@/types/config";

/**
 * Default race body descriptions — empty; races are described by their config bodyDescription
 * or just their name. Project-specific descriptions belong in the project's config, not in code.
 */
export const DEFAULT_RACE_BODY_DESCRIPTIONS: Record<string, string> = {};

/**
 * Default class outfit descriptions — empty; classes are described by their config outfitDescription
 * or just their name. Project-specific descriptions belong in the project's config, not in code.
 */
export const DEFAULT_CLASS_OUTFIT_DESCRIPTIONS: Record<string, string> = {};

/**
 * Default tier definitions — used as fallbacks when config.playerTiers is not set.
 * Ported from AmbonMUD-Visualize.
 */
export const DEFAULT_TIER_DEFINITIONS: Record<string, TierDefinitionConfig> = {
  t1: {
    displayName: "Base",
    levels: "1–9",
    visualDescription:
      "Simple wrapped linen clothing, no armor, no weapons, no magical effects. A new arrival in Ambon. Race identity only.",
  },
  t10: {
    displayName: "Awakened",
    levels: "10–24",
    visualDescription:
      "Basic class-defining outfit and simple weapon. Functional gear, nothing ornate. First signs of class identity.",
  },
  t25: {
    displayName: "Ascended",
    levels: "25–49",
    visualDescription:
      "Upgraded quality materials, subtle magical effects — faint enchanted glow on weapon edges, improved armor. Class fantasy clearly realized.",
  },
  t50: {
    displayName: "Legendary",
    levels: "50",
    visualDescription:
      "Peak class fantasy. Legendary-tier gear with dramatic magical auras, glowing weapons, elaborate cloaks and accessories. Unmistakably powerful.",
  },
  tstaff: {
    displayName: "Staff",
    levels: "—",
    visualDescription:
      "Game administrator. Distinct cosmic prismatic aura, celestial crown or halo, unique iridescent color treatment. Clearly not a player character — a being of authority.",
  },
};

/**
 * Per-race full prompt overrides for staff (tstaff) tier — empty.
 * Project-specific staff prompts belong in the project's config (races[race].staffPrompt).
 */
export const DEFAULT_STAFF_RACE_PROMPTS: Record<string, string> = {};

/**
 * Curated race for each class portrait — empty.
 * Project-specific showcase races belong in the project's config (classes[cls].showcaseRace).
 */
export const DEFAULT_CLASS_SHOWCASE_RACES: Record<string, string> = {};

/** Ordered tier keys for display. */
export const TIER_ORDER: string[] = ["t1", "t10", "t25", "t50", "tstaff"];

/** Ordered race keys for display — derived from config at runtime. */
export const RACE_ORDER: string[] = [];

/** Ordered class keys for display — derived from config at runtime. */
export const CLASS_ORDER: string[] = [];
