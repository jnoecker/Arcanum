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
 * Curated race for each class portrait — empty.
 * Project-specific showcase races belong in the project's config (classes[cls].showcaseRace).
 */
export const DEFAULT_CLASS_SHOWCASE_RACES: Record<string, string> = {};
