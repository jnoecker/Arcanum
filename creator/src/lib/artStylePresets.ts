import type { ArtStyle } from "@/types/lore";

// ─── Built-in art style presets ─────────────────────────────────────
//
// These are offered as starting points in the "Create style" menu.
// Users can pick a preset, rename it, then edit freely. The base prompts
// are extracted from the legacy ARCANUM_PREAMBLE and GENTLE_MAGIC_PREAMBLE
// constants in arcanumPrompts.ts so no aesthetic is lost in migration.

export interface ArtStylePresetTemplate {
  /** Stable id for UI selection — not used as the ArtStyle id. */
  key: string;
  name: string;
  description: string;
  basePrompt: string;
  worldbuilding: string;
  lore: string;
}

/** The two starter presets available in the "Create style" menu. */
export const ART_STYLE_PRESETS: ArtStylePresetTemplate[] = [
  {
    key: "arcanum",
    name: "Arcanum",
    description: "Baroque cosmic gold-and-indigo — the Creator's instrument",
    basePrompt: `Digital fantasy painting with deep cosmic indigo and abyssal navy backgrounds, baroque rococo light scrollwork rendered as glowing energy threads, warm aurum-gold as the primary accent against cool blue-violet atmospheric fill, sweeping spiral arms of light, fractaline structures, slow cosmological scale.

Color and light:
- Deep cosmic indigo (#080c1c to #1a2040) and abyssal navy as primary backgrounds
- Warm aurum-gold (#c8972e, #e2bc6a) as the primary accent — concentrated light with 20-40px feathered bloom
- Cool blue-violet atmospheric fill in shadows and ambient spaces
- No harsh shadows, no spotlights — light dissolves gradually into darkness

Shape and form:
- Baroque C-curves and S-curves — borders and ornaments terminate in curls, never hard stops
- Acanthus-leaf spirals, flowing filigree of light, fractaline structures
- Cosmological scale — slow, vast, contemplative

Visible painterly oil-painting texture throughout. NO runes, text, or neon colors.`,
    worldbuilding: `For sprites, items, and icons: centered compositions, clear silhouettes readable at small sizes, aurum-gold highlights on key features, solid dark indigo backgrounds. For room backgrounds: wide landscape framing, baroque architectural silhouettes dissolving at the edges.`,
    lore: `For portraits and lore article illustrations: depict subjects faithfully with literal anatomy and appearance. Frame figures with baroque ornamentation — scrollwork borders, spiral light-threads — without obscuring the subject. Dramatic chiaroscuro lighting with aurum-gold rim-light, deep indigo shadow fill. Oil-painting technique, jewel-like detail.`,
  },
  {
    key: "gentle_magic",
    name: "Surreal Gentle Magic",
    description: "Soft dreamlike lavender — emotionally safe storybook illustration",
    basePrompt: `Digital fantasy painting in the style of a dreamy storybook illustration. Soft lavender and pale blue undertones suffusing every surface, ambient diffused lighting with NO clear source point — light feels source-ambiguous and magical, never like realistic sunlight or artificial lamps. Gentle atmospheric haze with floating motes of light and faint magical particles drifting in the air.

Color and light:
- Cool undertones dominate — lavender, pale blue, dusty rose, moss green
- Warm accents (dusty rose, soft gold) used sparingly for balance
- Soft bloom around windows and light sources, ground-level magical glow (glowing moss, luminous plants)

Shape and form:
- Gentle curves over hard angles — nothing perfectly straight, micro-warping on all edges
- Slightly elongated organic forms (trees, towers, figures, architecture, furniture)
- Organic lived-in quality — nothing feels industrial, nothing feels mechanical

Visible painterly brushwork with soft textured rendering throughout. NO photorealism, neon colors, harsh edges, or readable text.`,
    worldbuilding: `For sprites, items, and icons: gently curved silhouettes against solid pale lavender (#d8d0e8) backgrounds, soft bloom around edges, dusty rose and moss green accents. For room backgrounds: wide dreamy landscapes with atmospheric haze, floating light motes, slightly elongated organic architecture.`,
    lore: `For portraits and lore article illustrations: depict subjects faithfully — the dreamlike quality enhances the character, it doesn't replace them. Soft ambient light with no harsh shadows, faint halo of pale golden glow, floating motes of light in the atmosphere. Slightly elongated proportions give an ethereal quality. The image should feel kind, approachable, and emotionally warm.`,
  },
];

/** Build an ArtStyle object from a preset template. */
export function artStyleFromPreset(preset: ArtStylePresetTemplate): ArtStyle {
  const now = new Date().toISOString();
  return {
    id: `style_${preset.key}_${Date.now().toString(36)}`,
    name: preset.name,
    description: preset.description,
    basePrompt: preset.basePrompt,
    surfaces: {
      worldbuilding: preset.worldbuilding,
      lore: preset.lore,
    },
    createdAt: now,
    updatedAt: now,
  };
}
