/**
 * Reference Canon — project-level registry of canonical "design references."
 *
 * A reference subject stores a tight, reusable visual description for a
 * recurring entity (a named character, an ancestry, a city, a faction, …).
 * Entity descriptions can point at a subject with an `@token`; Arcanum expands
 * the token into the canonical appearance when building image prompts so the
 * same character/place renders consistently everywhere it appears, while the
 * game-facing text stays clean.
 */

export type ReferenceCategory =
  | "character"
  | "ancestry"
  | "location"
  | "faction"
  | "creature"
  | "item"
  | "custom";

export const REFERENCE_CATEGORIES: { id: ReferenceCategory; label: string; glyph: string }[] = [
  { id: "character", label: "Character", glyph: "\u{1F9D1}" },
  { id: "ancestry", label: "Ancestry", glyph: "\u{1F9EC}" },
  { id: "location", label: "Location", glyph: "\u{1F3DB}️" },
  { id: "faction", label: "Faction", glyph: "\u{1F6A9}" },
  { id: "creature", label: "Creature", glyph: "\u{1F409}" },
  { id: "item", label: "Item", glyph: "☄️" },
  { id: "custom", label: "Custom", glyph: "✧" },
];

export interface ReferenceSubject {
  id: string;
  /** Slug used for the `@token` form (no spaces). Lowercased on save. */
  token: string;
  /** Human display name. Also matchable via the `@[Display Name]` form. */
  name: string;
  category: ReferenceCategory;
  /** Canonical visual description injected into image prompts. */
  appearance: string;
  /** Author-facing notes; never sent to the image model. */
  notes?: string;
}

/** On-disk shape of `<project>/.arcanum/references.json`. */
export interface ReferenceFile {
  version: 1;
  subjects: ReferenceSubject[];
}

/**
 * Author-side annotation overlay. Maps `<zoneId>/<kind>/<entityId>` to the
 * tokenized description the author wrote. The YAML stores the clean,
 * sigil-stripped text; this remembers where the `@tokens` were so they can be
 * re-applied on load. Stored in `<project>/.arcanum/reference-annotations.json`.
 */
export interface ReferenceAnnotationFile {
  version: 1;
  annotations: Record<string, string>;
}
