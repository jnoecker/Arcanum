import type { AssetType } from "@/types/assets";
import { buildToneDirective, buildVisualStyleDirective, type ArtStyleSurface } from "./loreGeneration";

// ─── Art Style System ─────────────────────────────────────────────

export type ArtStyle = "arcanum" | "gentle_magic";

export const ART_STYLE_LABELS: Record<ArtStyle, string> = {
  arcanum: "Arcanum",
  gentle_magic: "Surreal Gentle Magic",
};

export const ART_STYLE_DESCRIPTIONS: Record<ArtStyle, string> = {
  arcanum: "Baroque cosmic gold-and-indigo — the Creator's instrument",
  gentle_magic: "Surreal Gentle Magic — dreamlike, enchanted, emotionally safe",
};

// ─── Arcanum v1 ───────────────────────────────────────────────────

/** Arcanum v1 style preamble — prepended to all art prompts */
export const ARCANUM_PREAMBLE = `Arcanum style (arcanum_v1): deep cosmic indigo and abyssal navy backgrounds, baroque rococo light scrollwork rendered as glowing energy threads, warm aurum-gold as the primary accent color against cool blue-violet atmospheric fill, sweeping spiral arms of light, fractaline structures, slow cosmological scale, no runes or text, no humanoid figures, no neon colors, no harsh edges`;

// ─── Surreal Gentle Magic v1 ──────────────────────────────────────

/**
 * Condensed Surreal Gentle Magic design system reference, derived from
 * the STYLE_GUIDE.md. Included in Claude system prompts so it can
 * actively shape prompts toward the aesthetic. Kept terse — this ships
 * with every enhancement call, so every word here is a per-image cost.
 */
export const STYLE_GUIDE_REFERENCE = `# Surreal Gentle Magic (surreal_softmagic_v1) — Style Reference

Philosophy: enchanted not explosive, dreamlike not chaotic, softly luminous never harsh, otherworldly but emotionally safe. Nothing industrial, nothing sharp unless narratively intentional.

Shapes: gentle curves over hard angles, slight vertical elongation, organic lived-in quality, micro-warping (nothing perfectly straight). Never harsh geometric symmetry, perfect 90° realism, brutalist silhouettes, or mechanical rigidity.

Palette: Lavender #a897d2, Pale Blue #8caec9, Dusty Rose #b88faa, Moss Green #8da97b, Soft Gold #bea873 over neutrals Deep Mist #22293c, Soft Fog #6f7da1, Cloud #d8def1. No neon, no saturated primaries, no pure black; cool undertones dominate with warm accents; contrast moderate, never stark.

Light: ambient, diffused, source-ambiguous. Ground-level glow, halos around magical beings, soft bloom at windows and light sources, atmospheric diffusion for depth. Never sharp rim lights, hard shadows, spotlights, or high-contrast chiaroscuro.

Text: AI image generators cannot render readable text — replace ALL signs, labels, plaques, inscriptions, and writing with glowing runes, arcane glyphs, or indecipherable magical sigils.

Every image must feel gentle, breathable, enchanted but safe, welcoming.`;

/** Gentle Magic style preamble — for MUD world assets */
export const GENTLE_MAGIC_PREAMBLE = `Surreal Gentle Magic style (surreal_softmagic_v1): soft lavender and pale blue undertones, ambient diffused lighting with no harsh shadows or spotlighting, gentle atmospheric haze with floating motes of light, subtle magical glow integrated naturally into the environment, slightly elongated organic forms, dreamy breathable emotionally safe aesthetic, no neon colors, no high contrast, no harsh edges, painterly and luminous`;

const GENERIC_STYLE_FALLBACK = `Rendered as a digital fantasy illustration — painterly, detailed, atmospheric. NOT a photograph, NOT a 3D render. Visible brushwork with textured rendering throughout. NO readable text, words, letters, or legible writing in the image.`;

/**
 * Composition-only fallback used when a zone vibe owns the palette. Drops
 * the world-style color/lighting directive so the vibe's palette doesn't
 * have to fight it. Format/safety rules ("no readable text") stay.
 */
const COMPOSITION_ONLY_FALLBACK = `Rendered as a digital fantasy illustration — painterly, atmospheric, with visible brushwork. NOT a photograph, NOT a 3D render. The color palette and lighting character must follow the ZONE ART DIRECTION above. NO readable text, words, letters, or legible writing in the image.`;

export interface PromptPaletteOptions {
  /**
   * Where the palette/atmosphere should come from.
   * - `"global"` (default): world visualStyle if defined, else the built-in style.
   * - `"zone-vibe"`: caller has provided a zone-level art direction that owns
   *   palette and atmosphere; preamble/suffix should yield composition only.
   */
  paletteAuthority?: "global" | "zone-vibe";
}

/**
 * Dynamic style suffix — uses the active art style (optionally with a per-surface
 * override) if defined, otherwise falls back to a minimal generic fantasy
 * illustration style. Appended to all image generation prompts.
 *
 * When `paletteAuthority` is `"zone-vibe"`, the world's palette directive is
 * dropped and the suffix only enforces composition + format rules. The caller
 * is responsible for providing a `ZONE ART DIRECTION` block earlier in the
 * prompt (see `buildZoneVibeBlock`).
 */
export function getStyleSuffix(
  surface?: ArtStyleSurface,
  opts: PromptPaletteOptions = {},
): string {
  if (opts.paletteAuthority === "zone-vibe") {
    return COMPOSITION_ONLY_FALLBACK;
  }
  const visualStyle = buildVisualStyleDirective(surface);
  if (visualStyle) {
    return `Rendered in the following visual style: ${visualStyle}\n\nNO readable text, words, letters, or legible writing in the image.`;
  }
  return GENERIC_STYLE_FALLBACK;
}

/**
 * Zone vibe no longer influences image prompts — the room/entity description
 * plus the world's art style provide enough direction, and folding vibe in
 * tended to override the writer's intent across larger, varied zones. Kept
 * as no-op stubs so downstream callers don't need updating in lockstep.
 */
export function buildZoneVibeBlock(_zoneVibe: string): string {
  return "";
}

export function buildZoneVibeReiteration(_zoneVibe: string): string {
  return "";
}

/** Format specification per entity type for image generation */
export const FORMAT_BY_TYPE: Record<string, string> = {
  room: "16:9 landscape background illustration, wide establishing shot, no characters in foreground",
  mob: "1:1 square character portrait centered in frame, full body visible, clean simple background",
  item: "1:1 square item icon centered in frame, floating on a clean simple background, no hands or characters",
  gathering_node: "1:1 square interactable resource node sprite, 3/4 isometric perspective view of an in-world harvest point grounded on the floor, full silhouette visible, clean simple background, no hands, no characters, no UI",
  ability_icon: "1:1 square ability icon centered in frame, symbolic/iconic representation",
  status_effect_icon: "1:1 square status effect icon centered in frame, symbolic/iconic representation",
  player_sprite: "1:1 square full-body character sprite, the entire figure visible head to toe in a relaxed confident standing pose, facing the viewer, centered with padding on all sides, clean simple background, clear readable silhouette at small sizes",
  race_portrait: "3:2 landscape orientation character portrait, close-up to mid-shot framing, richly detailed painterly environment background",
  class_portrait: "3:2 landscape orientation action portrait, mid-shot framing, dynamic or atmospheric pose, richly detailed painterly environment background",
  faction_emblem: "1:1 square heraldic sigil centered in frame, single iconic emblem fills most of the canvas, dark uniform background suitable for a circular badge, no text, no scenery, no characters",
};

export const FORMAT_BY_ASSET_TYPE: Partial<Record<AssetType, string>> = {
  background: FORMAT_BY_TYPE.room,
  ornament: "ultra-wide decorative horizontal ornament, elegant isolated composition, no readable text",
  status_art: "16:9 atmospheric illustration with a clear focal subject and room for UI overlay",
  empty_state: "16:9 atmospheric illustration with open negative space and a calm focal point",
  entity_portrait: FORMAT_BY_TYPE.mob,
  ability_sprite: FORMAT_BY_TYPE.ability_icon,
  ability_icon: FORMAT_BY_TYPE.ability_icon,
  status_effect_icon: FORMAT_BY_TYPE.status_effect_icon,
  racial_ability_icon: FORMAT_BY_TYPE.ability_icon,
  zone_map: "16:9 illustrated fantasy map or cartographic overview, top-down or elevated perspective, no readable labels",
  showcase_banner: "21:9 ultra-wide cinematic hero banner, sweeping establishing vista, strong negative space in upper and lower thirds for title text overlay, no readable text",
  showcase_favicon: "1:1 square world logo icon, bold centered emblem filling most of the frame, high-contrast silhouette that reads at tiny sizes, no text, no fine detail",
  splash_hero: "ultra-wide cinematic hero illustration, sweeping composition, welcoming focal vista",
  loading_vignette: "1:1 square atmospheric vignette, centered focal subject, meditative composition",
  panel_header: "4:1 ultra-wide horizontal header illustration, decorative and panoramic, readable text forbidden",
  room: FORMAT_BY_TYPE.room,
  mob: FORMAT_BY_TYPE.mob,
  pet: FORMAT_BY_TYPE.mob,
  item: FORMAT_BY_TYPE.item,
  gathering_node: FORMAT_BY_TYPE.gathering_node,
  lever_plate: "1:1 square sprite of a single lever mounting plate viewed straight head-on, centered, the whole plate in frame with padding, no handle arm, no wall, no characters, clean flat background",
  lever_handle: "1:1 square sprite of a single lever handle/arm oriented vertically pointing straight up, centered, the pivot end at the bottom and the grip at the top, the whole handle in frame with padding, no mounting plate, no wall, no characters, clean flat background",
  door_frame: "2:3 portrait sprite of a single empty doorway frame viewed straight head-on, the opening hollow and empty (no door panel inside), centered with padding, no door leaf, no wall around it, no characters, clean flat background",
  door_leaf: "2:3 portrait sprite of a single closed door panel/leaf viewed straight head-on, the whole leaf in frame with padding, no surrounding frame, no wall, no characters, clean flat background",
  player_sprite: FORMAT_BY_TYPE.player_sprite,
  race_portrait: FORMAT_BY_TYPE.race_portrait,
  class_portrait: FORMAT_BY_TYPE.class_portrait,
  faction_emblem: FORMAT_BY_TYPE.faction_emblem,
};

export function getFormatForAssetType(assetType: AssetType): string {
  return FORMAT_BY_ASSET_TYPE[assetType] ?? "illustrated fantasy image composition";
}

/** Universal negative prompt — appended to all generations */
export const UNIVERSAL_NEGATIVE = `text, words, letters, runes, glyphs, watermarks, logos, signatures, modern technology, computers, user interfaces, neon colors, hot pink, electric blue, lime green, saturated primaries, pure black, harsh shadows, hard edges, sharp rim lights, spotlight effects, high-contrast chiaroscuro, brutalist shapes, mechanical rigidity, flat design, cartoon, anime, photorealism, studio lighting, stock photo aesthetic, horror elements, gore, nudity, nude, naked, bare chest, exposed breasts, cleavage, nsfw, topless, revealing, skimpy, sexualized`;

// ─── Sprite safety (for bg-removal pipeline) ───────────────────────
//
// Assets in BG_REMOVAL_ASSET_TYPES have their backgrounds algorithmically
// cut out after generation (see `useBackgroundRemoval.ts`). That matting
// step has two recurring failure modes:
//
//   1. Decorative "sticker sheet" backgrounds — baroque frames, cosmic
//      scrollwork, quilt patterns, nebula wisps — confuse the segmenter
//      and leave halos or chunks of background baked into the sprite.
//   2. Semi-transparent wings, tails, membranes, and gauzy cloaks get
//      classified as background and deleted. Faeries end up with one
//      wing, dragons lose their tail tip, etc.
//
// SPRITE_SAFETY_DIRECTIVE is hard language injected into every prompt for
// bg-removable asset types to force a flat background and fully opaque
// appendages. Keep it explicit and repetitive — the LLM enhancer strips
// soft language like "preferably" or "try to".

/** Asset types that undergo background removal after generation.
 *  Single source of truth — `useBackgroundRemoval.ts` imports from here.
 *
 *  race_portrait / class_portrait are intentionally excluded: those render
 *  as lore-style cards in-game with their painterly environment intact, so
 *  they must keep their background (and skip the flat-lavender directive). */
export const BG_REMOVAL_ASSET_TYPES: ReadonlySet<string> = new Set([
  "mob",
  "item",
  "pet",
  "entity_portrait",
  "gathering_node",
  "lever_plate",
  "lever_handle",
  "door_frame",
  "door_leaf",
  "ability_sprite",
  "player_sprite",
]);

/** True if the asset type's final image will have its background removed. */
export function needsBgRemovalSafety(assetType: string): boolean {
  return BG_REMOVAL_ASSET_TYPES.has(assetType);
}

/** Hard constraints appended to prompts for assets that will be matted out
 *  of their background. See comment block above for failure-mode context. */
export const SPRITE_SAFETY_DIRECTIVE = `HARD CONSTRAINTS FOR ISOLATED SPRITE SUBJECT (this image will be algorithmically cut out from its background, so these rules are non-negotiable and OVERRIDE any conflicting style guidance above):

1. BACKGROUND: a single completely flat, uniform, solid pale lavender (#d8d0e8) field. Featureless empty color and NOTHING else. NO decorative borders, NO baroque frames, NO ornamental scrollwork, NO filigree, NO rococo curls, NO nebula wisps, NO cosmic mist, NO atmospheric haze, NO floating light motes, NO particles, NO sparkles, NO ground plane, NO moss or flowers, NO quilt pattern, NO sticker-sheet grid, NO vignette, NO gradient. The background is empty flat color — a chroma key, not a scene.

2. FULL SILHOUETTE WITHIN FRAME: the subject's entire silhouette — including EVERY appendage (wings, tails, horns, antlers, extra limbs, ears, cloaks, robes, hair, staves, wands, weapons, floating accessories) — must be fully contained within the image with clear empty padding on all four sides. Nothing touches or exits the image edges. Do not crop any part of the figure.

3. WINGS AND APPENDAGES MUST BE FULLY OPAQUE: wings, fins, membranes, gossamer insect wings, gauzy veils, spectral trails, and every winged or membranous feature must be rendered as FULLY OPAQUE solid-colored shapes with clearly visible outlines against the background. NOT translucent. NOT semi-transparent. NOT gauzy. NOT see-through. NOT motion-blurred. NOT dissolving into particles. Every wing has a crisp, dark, continuous outline.

4. SYMMETRIC PAIRS COMPLETE: if the creature has paired features (two wings, two horns, two antennae, two ears), BOTH members of the pair must be clearly visible, anatomically attached to the body, and equally well-defined. No single-winged faeries. No half-visible tails disappearing behind the torso.

5. CONNECTED FIGURE: the subject is a single connected silhouette. No detached floating parts, no dispersing sparkle clouds that blend into the background, no parts of the body rendered as energy trails or particle effects.`;

/** Light framing guidance for models that generate native transparency.
 *  No lavender background or opacity rules — just keep the figure in frame. */
export const SPRITE_FRAMING_DIRECTIVE = `FRAMING RULES FOR ISOLATED SPRITE:
- The subject's entire figure — including all appendages (wings, tails, horns, weapons, cloaks) — must be fully contained within the image with padding on all sides. Do not crop any part.
- If the creature has paired features (two wings, two horns), both must be visible.
- The subject should be a single connected figure. No detached floating parts or particle trails that break the silhouette.`;

/** Append sprite constraints to a prompt. Uses full lavender-bg rules for
 *  BG-removal models, light framing for native-transparency models. */
export function withSpriteSafety(prompt: string, assetType: string, nativeTransparency?: boolean): string {
  if (!needsBgRemovalSafety(assetType)) return prompt;
  const directive = nativeTransparency ? SPRITE_FRAMING_DIRECTIVE : SPRITE_SAFETY_DIRECTIVE;
  return `${prompt}\n\n${directive}`;
}

/**
 * Additional negative terms for empty-scene backgrounds (rooms, shops, locations).
 * Keeps living figures out of environment art so mob/NPC sprites composited on top
 * don't produce creepy doubles of inhabitants baked into the background.
 */
export const EMPTY_SCENE_NEGATIVE = `person, people, human, humans, humanoid, humanoids, character, characters, figure, figures, silhouette, silhouettes, man, woman, men, women, child, children, face, faces, portrait, crowd, crowds, creature, creatures, beast, beasts, monster, monsters, npc, merchant, shopkeeper, guard, villager, adventurer, traveler, customer, patron, worker`;

/**
 * Pick a negative prompt for the given asset type. Backgrounds/rooms/shops get
 * additional exclusions for living figures.
 */
export function getNegativePrompt(assetType?: string): string {
  if (assetType === "background") {
    return `${UNIVERSAL_NEGATIVE}, ${EMPTY_SCENE_NEGATIVE}`;
  }
  return UNIVERSAL_NEGATIVE;
}

/** Compact no-text constraint shared by direct prompts and enhanced-prompt tails. */
export const NO_TEXT_LINE = `NO readable text, words, or lettering in the image.`;

/**
 * Compact tail appended to LLM-enhanced prompts. The enhancer's system
 * prompt already embeds the full style (or world visual style) directive
 * and demands conformance, so re-appending the style suffix to its output
 * only stated the style twice — this keeps just the medium + no-text
 * constraints the image model still needs verbatim.
 */
export const ENHANCED_PROMPT_TAIL = `Painterly digital fantasy illustration — NOT a photograph, NOT a 3D render. ${NO_TEXT_LINE}`;

/**
 * Composition-only preamble used when a zone vibe owns the palette.
 * Keeps the rendering-technique language ("painterly", "atmospheric", "no
 * readable text") and drops palette/lighting content.
 */
const COMPOSITION_ONLY_PREAMBLE: Record<ArtStyle, string> = {
  arcanum: `Digital fantasy painting with painterly oil-painting texture. Baroque C-curves and S-curves; ornaments terminate in curls, never hard stops. Acanthus-leaf spirals, flowing filigree, fractaline structures. Cosmological scale — slow, vast, contemplative. NOT a photograph, NOT a 3D render.`,
  gentle_magic: `Digital fantasy painting in the style of a dreamy storybook illustration. Visible painterly brushwork with soft textured rendering throughout. Gentle curves over hard angles; nothing perfectly straight; micro-warping on edges. Slightly elongated organic forms. Organic lived-in quality — nothing industrial, nothing mechanical. NOT a photograph, NOT a 3D render.`,
};

/** Get the preamble for image prompts — uses world visual style if defined, falls back to art style constant. */
export function getPreamble(
  style: ArtStyle,
  surface?: ArtStyleSurface,
  opts: PromptPaletteOptions = {},
): string {
  if (opts.paletteAuthority === "zone-vibe") {
    return COMPOSITION_ONLY_PREAMBLE[style];
  }
  const visualStyle = buildVisualStyleDirective(surface);
  if (visualStyle) return visualStyle;
  return style === "arcanum" ? ARCANUM_PREAMBLE : GENTLE_MAGIC_PREAMBLE;
}

/** Per-asset-type prompt templates, keyed by art style */
export const ASSET_TEMPLATES: Record<AssetType, { label: string; templates: Record<ArtStyle, string> }> = {
  background: {
    label: "Background",
    templates: {
      arcanum: `Vast cosmic observatory floating in deep space, baroque architectural elements rendered in flowing light — sweeping rococo scrollwork of glowing blue-violet and gold energy forming grand archways and spiral colonnades, a colossal golden spiral galaxy visible through open arched windows, deep indigo and abyssal navy void beyond, fractaline structures branching into the distance like crystalline trees made of light, warm aurum-amber luminescence pooling at architectural nodes, cool nebula-violet atmospheric mist drifting between pillars, ultra-wide panoramic composition, painterly oil technique, extremely detailed`,
      gentle_magic: `A quiet enchanted landscape stretching wide — rolling meadows of pale silver-green grass blending into soft lavender hills on the horizon, a winding stream of pale blue water glowing faintly from within, scattered wildflowers in dusty rose and soft gold catching ambient light that has no clear source, ancient trees with slightly elongated trunks and canopies of luminous moss-green leaves, floating motes of warm light drifting through atmospheric haze, a distant tower of weathered stone wrapped in gentle ivy, the sky a gradient of deep mist blues and cloud-pale lavender, dreamlike, breathable, painterly, luminous`,
    },
  },
  ornament: {
    label: "Panel Ornament",
    templates: {
      arcanum: `Intricate baroque energy scrollwork border, symmetrical horizontal composition, glowing aurum-gold rococo flourishes and acanthus-leaf spirals rendered as threads of light against deep cosmic indigo, cool blue-violet glow fills the spaces between curls, the scrollwork dissolves to transparency at both horizontal ends, extremely detailed filigree of light, jewelry-like precision, wide aspect ratio banner format`,
      gentle_magic: `A delicate horizontal vine border of intertwining botanical forms — soft lavender wisteria blossoms and pale blue morning glories woven through slender moss-green stems, faintly glowing from within with source-ambiguous light, dusty rose buds and tiny soft-gold seed pods nestled along the vine, the tendrils curl gently at both ends dissolving into atmospheric haze, floating motes of warm light scattered between the flowers, wide aspect ratio banner format, painterly, luminous, organic, dreamlike`,
    },
  },
  status_art: {
    label: "Server Status Art",
    templates: {
      arcanum: `A cosmic engine in full operation — a grand mechanical orrery made entirely of light, baroque golden rings and spiral armatures rotating slowly in deep indigo space, warm aurum energy flowing along the curved spokes like luminous oil, smaller fractal orreries visible in the distance like satellites, blue-violet atmospheric fill between components, a sense of vast power operating at perfect equilibrium, painterly, glowing, majestic`,
      gentle_magic: `A gentle magical hearth in a cozy tower room — a softly glowing crystal orb rests on an old wooden table, casting ambient lavender and pale blue light across shelves of worn books and glass bottles, a small fireplace burns with soft-gold flames that seem to breathe rather than flicker, floating motes of warm light drift lazily through the room, moss grows in the cracks of stone walls adding moss-green accents, a cat sleeps curled near the warmth, the whole scene radiates quiet contentment and living magic, painterly, luminous, dreamlike, intimate`,
    },
  },
  empty_state: {
    label: "Empty State",
    templates: {
      arcanum: `An empty cosmic void beginning to stir — deep abyssal navy space with the faint suggestion of energy not yet shaped into form, a single point of warm aurum-gold light at the center casting the first illumination into darkness, baroque energy tendrils beginning to curl outward from that center point as if the act of creation is just beginning, blue-violet nebula mist drifting at the periphery, vast and serene, the moment before the world exists, painterly, luminous`,
      gentle_magic: `A still forest clearing just before dawn — pale atmospheric haze fills the space between tall slender trees, the ground is soft dark earth with a few tiny luminous mushrooms casting faint lavender glow, a single firefly of soft gold light hovers at the center of the clearing as if waiting, dew drops on spider silk catch and scatter pale blue ambient light, the canopy above filters deep mist-blue sky through moss-green leaves, everything is quiet and expectant — a place where something gentle is about to begin, painterly, luminous, dreamlike, serene`,
    },
  },
  entity_portrait: {
    label: "Entity Portrait",
    templates: {
      arcanum: `Baroque cosmic portrait frame rendered in glowing aurum-gold scrollwork, deep indigo background with blue-violet nebula wisps, the subject depicted as an archetypal symbol rendered in flowing light rather than literal form, ornate frame edges curl and dissolve into darkness, warm golden light emanates from the center, painterly, luminous`,
      gentle_magic: `A warm intimate portrait with a soft organic frame of flowering vines in dusty rose and moss green, the background a gentle gradient of deep mist-blue to lavender, the subject bathed in soft ambient light with no harsh shadows, faint halo of pale golden glow around the head, floating motes of light in the atmosphere, the portrait feels kind and approachable, slightly elongated proportions giving an ethereal quality, painterly, luminous, dreamlike`,
    },
  },
  ability_sprite: {
    label: "Ability Sprite",
    templates: {
      arcanum: `A single iconic ability symbol rendered as flowing energy against deep cosmic indigo void, baroque scrollwork frame dissolving at edges, the central icon glows with concentrated aurum-gold light and soft bloom, blue-violet atmospheric fill behind, centered square composition like a game ability icon, painterly, luminous, extremely detailed, no text, no figures`,
      gentle_magic: `A single iconic ability symbol as a softly glowing natural form against deep mist-blue background, the icon rendered as living magic — perhaps a crystallized flower, a swirl of luminous water, or a gentle flame — radiating pale lavender and soft gold light with diffused bloom, framed by a subtle circle of floating light motes, centered square composition like a game ability icon, organic shapes, no harsh edges, painterly, luminous, dreamlike, no text, no figures`,
    },
  },
  zone_map: {
    label: "Zone Map",
    templates: {
      arcanum: `Celestial cartography from above, a glowing world map rendered in baroque light threads on a deep cosmic indigo void, landmasses formed from swirling aurum-gold energy lines that curl and flourish at coastlines and mountain ranges in rococo scrollwork style, rivers traced as flowing silver-blue light, zone boundaries marked by gentle violet-glowing arcs, concentric circles of faint stardust suggesting scale and depth, fractal detail increasing toward the edges, bird's-eye perspective, painterly, luminous`,
      gentle_magic: `A hand-painted world map on aged parchment with a magical quality — landmasses rendered in soft watercolor washes of moss green and dusty rose, coastlines traced with faintly glowing pale blue lines, mountains depicted as gentle lavender-shadowed bumps, forests as clusters of tiny luminous green dots, rivers flowing in soft gold ink that seems to shimmer, zone boundaries marked by wreaths of tiny painted flowers, the parchment edges curl naturally and small motes of light hover above magical locations, bird's-eye perspective, painterly, luminous, dreamlike, warm`,
    },
  },
  splash_hero: {
    label: "Splash / Welcome",
    templates: {
      arcanum: `A grand cosmic portal at the threshold of creation — an immense baroque archway of glowing aurum-gold scrollwork stands at the center of deep cosmic indigo void, its pillars formed from intertwined spirals of golden light and blue-violet energy, through the arch a breathtaking view of a nascent universe unfolds with spiral galaxies and nebula clouds in warm amber and cool violet, the portal radiates concentrated aurum light outward in soft bloom, rococo acanthus-leaf finials crown the arch, the floor is a mirror-dark reflective plane catching the golden glow, sweeping ultra-wide cinematic composition, painterly oil technique, extremely detailed, majestic and inviting`,
      gentle_magic: `A welcoming gateway into an enchanted world — a natural stone archway overgrown with luminous flowering vines in lavender and dusty rose, the arch opens onto a breathtaking vista of rolling emerald hills under a sky of soft gradient blues and pale gold, a winding path of warm stone leads from the viewer through the archway into the distance, floating motes of gentle light drift through the opening like seeds on a breeze, ancient trees with moss-green canopies frame either side, the ground is carpeted in tiny glowing wildflowers, sweeping ultra-wide composition, painterly, luminous, dreamlike, inviting and emotionally warm`,
    },
  },
  loading_vignette: {
    label: "Loading Vignette",
    templates: {
      arcanum: `A single baroque golden orrery mechanism suspended in deep cosmic indigo void — three concentric rings of aurum-gold light slowly orbiting a bright central point, the rings are ornate with rococo scrollwork filigree rendered as energy threads, blue-violet nebula mist drifts between the rings giving depth, tiny fractaline satellite structures orbit at the periphery like jeweled clockwork, the whole mechanism radiates a gentle warm glow with soft bloom, centered square composition on transparent-feeling dark background, painterly, luminous, meditative`,
      gentle_magic: `A gentle magical phenomenon suspended in soft deep-mist blue space — three luminous butterflies of pale lavender, soft gold, and dusty rose circling slowly around a tiny glowing seed of warm light at the center, their wings leave faint trails of dissolving light motes in the air, atmospheric haze creates depth and softness, the whole scene feels like a quiet moment of natural magic caught in amber, centered square composition on a dark but warm background, painterly, luminous, dreamlike, meditative`,
    },
  },
  panel_header: {
    label: "Panel Header Bar",
    templates: {
      arcanum: `An ultra-wide thin horizontal decorative banner — symmetrical baroque scrollwork of glowing aurum-gold energy rendered as delicate filigree threads on deep cosmic indigo, a central diamond-shaped medallion radiates warm golden light outward, flanked by sweeping C-curve and S-curve acanthus spirals that extend to both edges and dissolve to transparency at the ends, blue-violet ambient glow fills the spaces between the gold threads, extremely thin tall aspect ratio like a decorative rule line, no text, no figures, painterly, luminous, jewelry-like precision`,
      gentle_magic: `An ultra-wide thin horizontal decorative banner — a delicate garland of soft-glowing botanical forms on deep mist-blue background, a central cluster of tiny lavender flowers radiates gentle pale light outward, flanked by trailing vines of moss green with dusty rose buds and soft gold seed pods that extend to both edges and dissolve into atmospheric haze, floating motes of warm light scattered along the length, extremely thin tall aspect ratio like a natural decorative rule, no text, no figures, painterly, luminous, organic, dreamlike`,
    },
  },
  room: {
    label: "Room Scene",
    templates: {
      arcanum: `Interior of a fantastical chamber viewed from within — vaulted ceilings supported by columns of baroque scrollwork rendered as glowing aurum-gold energy threads, deep cosmic indigo shadows filling the upper vaults, cool blue-violet nebula mist drifting at floor level, warm amber luminescence pooling from ornate wall sconces and crystalline fixtures, doorways visible as darker arched openings framed by rococo filigree of light, the floor a dark polished surface reflecting golden glows, environmental details suggesting function and history, wide landscape composition as if the viewer stands inside the room, painterly oil technique, extremely detailed, atmospheric`,
      gentle_magic: `Interior of a cozy enchanted room viewed from within — warm weathered stone walls softened by trailing ivy and small luminous flowers in lavender and dusty rose, a worn wooden floor with a woven rug in muted earth tones, soft ambient light filtering through a leaded-glass window casting pale blue and soft gold patterns, furniture of dark aged wood with gentle curves, floating motes of warm light drifting near the ceiling, a fireplace or lantern providing a gentle source-ambiguous glow, the room feels lived-in and safe with small magical details — a glowing jar, a levitating book, mushrooms growing from a crack, wide landscape composition, painterly, luminous, dreamlike, intimate`,
    },
  },
  mob: {
    label: "Creature / NPC",
    templates: {
      arcanum: `A fantastical creature or character standing in a dramatic pose against deep cosmic indigo void, baroque aurum-gold energy scrollwork framing the figure like an ornate portrait border, the subject rendered with faithful anatomy and physical detail — armor, fur, scales, or clothing depicted realistically with Arcanum palette lighting, warm aurum-gold light illuminating the figure from a central point creating soft bloom and highlighting key features, cool blue-violet atmospheric fill providing depth behind the subject, fractaline energy details accenting weapons or magical elements, the figure occupies the center of a square portrait composition, painterly, luminous, extremely detailed, heroic and imposing`,
      gentle_magic: `A fantastical creature or character in a relaxed natural pose within a gentle environment, the subject rendered with faithful anatomy and physical detail — armor, fur, scales, or clothing depicted with soft ambient lighting in the Gentle Magic palette, lavender and pale blue atmospheric haze surrounds the figure creating depth, soft gold light highlights key features without harsh shadows, small magical details accent the character — glowing eyes, luminous trinkets, faintly shimmering fabric, floating motes of light nearby, moss or small flowers growing at their feet, the figure occupies the center of a square portrait composition, the overall feeling is approachable and characterful rather than threatening, painterly, luminous, dreamlike`,
    },
  },
  pet: {
    label: "Pet Companion",
    templates: {
      arcanum: `A fantastical pet companion creature in a dynamic pose against deep cosmic indigo void, baroque aurum-gold energy scrollwork framing the creature like an ornate portrait border, the pet rendered with faithful anatomy and expressive features — fur, scales, feathers, or magical body depicted realistically with Arcanum palette lighting, warm aurum-gold light illuminating the creature from a central point creating soft bloom, cool blue-violet atmospheric glow providing depth, fractaline energy details accenting magical traits — glowing eyes, luminous markings, ethereal wisps, the creature occupies the center of a square portrait composition, painterly, luminous, extremely detailed, endearing yet magical`,
      gentle_magic: `A fantastical pet companion creature in a playful relaxed pose within a gentle enchanted environment, the pet rendered with faithful anatomy and expressive charming features — fur, scales, feathers, or magical body depicted with soft ambient lighting in the Gentle Magic palette, lavender and pale blue atmospheric haze surrounds the creature creating depth, soft gold light highlights key features, small magical details accent the pet — glowing eyes, luminous markings, faintly shimmering coat, floating motes of light nearby, moss or small flowers at their feet, the creature occupies the center of a square portrait composition, the overall feeling is endearing and magical, painterly, luminous, dreamlike`,
    },
  },
  player_sprite: {
    label: "Player Sprite",
    templates: {
      arcanum: `A full-body fantasy adventurer rendered as an isolated game sprite — the entire figure visible from head to toe in a relaxed confident standing pose, weight settled naturally, facing the viewer, rendered with faithful anatomy and detailed class-defining equipment depicted realistically with Arcanum palette lighting, warm aurum-gold light catching armor edges and fabric folds with soft bloom, cool blue-violet tones in the shadows, the character's race clearly depicted with distinct physical features, a clear strong silhouette that reads instantly even at small sizes, centered square composition with padding on all sides, painterly, luminous, extremely detailed`,
      gentle_magic: `A full-body fantasy adventurer rendered as an isolated game sprite — the entire figure visible from head to toe in a relaxed natural standing pose, facing the viewer, rendered with faithful anatomy and handcrafted class-defining equipment with a subtle magical glow, soft ambient lighting in the Gentle Magic palette with lavender and pale blue undertones and soft gold highlights, no harsh shadows, the character's race clearly depicted with warm approachable features, a clear gentle silhouette that reads instantly even at small sizes, centered square composition with padding on all sides, painterly, luminous, dreamlike, characterful`,
    },
  },
  class_portrait: {
    label: "Class Portrait",
    templates: {
      arcanum: `A concept art portrait of a fantasy class archetype standing in a dramatic heroic pose against deep cosmic indigo void, the figure rendered with faithful anatomy wearing iconic class-defining armor and equipment — a warrior in plate with greatsword, a mage in flowing robes with arcane focus, a rogue in leather with daggers — baroque aurum-gold energy scrollwork frames the figure as an ornate portrait border, warm golden light illuminates the subject from a central point creating soft bloom on key features, cool blue-violet atmospheric fill provides depth, the character's posture and gear instantly communicate their combat role, wide landscape composition with mid-shot framing from the waist up and the figure centered, painterly, luminous, extremely detailed, archetypal and iconic`,
      gentle_magic: `A concept art portrait of a fantasy class archetype in a natural confident pose within a gentle enchanted setting, the figure rendered with faithful anatomy wearing iconic class-defining armor and equipment — a warrior in plate with greatsword, a mage in flowing robes with arcane focus, a rogue in leather with daggers — soft ambient light in lavender and pale blue creates a dreamlike atmosphere around the figure, small organic details like floating motes of light and gentle atmospheric haze frame the composition, the character's posture and gear instantly communicate their combat role, the figure feels approachable and heroic, wide landscape composition with mid-shot framing from the waist up and the figure centered, painterly, luminous, dreamlike, characterful and iconic`,
    },
  },
  race_portrait: {
    label: "Race Portrait",
    templates: {
      arcanum: `A concept art portrait of a fantasy race representative standing in a dramatic heroic pose against deep cosmic indigo void, the figure rendered with faithful anatomy showcasing the race's distinctive physical features — build, skin tone, ears, height, musculature — wearing culturally distinct armor or garments that reflect their heritage, baroque aurum-gold energy scrollwork frames the figure as an ornate portrait border, warm golden light illuminates the subject from a central point creating soft bloom on key features, cool blue-violet atmospheric fill provides depth, wide landscape composition with mid-shot framing from the waist up and the figure centered, painterly, luminous, extremely detailed, archetypal and iconic`,
      gentle_magic: `A concept art portrait of a fantasy race representative in a natural confident pose within a gentle enchanted setting, the figure rendered with faithful anatomy showcasing the race's distinctive physical features — build, skin tone, ears, height, musculature — wearing culturally distinct clothing that reflects their heritage and traditions, soft ambient light in lavender and pale blue creates a dreamlike atmosphere around the figure, small organic details like floating motes of light and gentle atmospheric haze frame the composition, the character feels approachable and dignified, wide landscape composition with mid-shot framing from the waist up and the figure centered, painterly, luminous, dreamlike, characterful and iconic`,
    },
  },
  item: {
    label: "Item / Object",
    templates: {
      arcanum: `A single fantastical object floating against deep cosmic indigo void — the item rendered in fine detail with realistic materials and textures lit by concentrated aurum-gold light that pools and blooms around its form, baroque energy scrollwork curling subtly around the object as ornamental framing that dissolves into darkness at the edges, cool blue-violet atmospheric glow providing depth behind, the object casts no harsh shadow but sits within a soft halo of warm golden luminescence, centered square composition like a game inventory icon, painterly, luminous, extremely detailed, precious and significant`,
      gentle_magic: `A single fantastical object resting on a soft surface against deep mist-blue background — the item rendered with warm realistic detail and gentle ambient lighting, a subtle magical glow emanates from within in lavender or soft gold, small details suggest enchantment — faint light motes rising from the surface, a shimmer along an edge, tiny flowers or moss growing where the object meets the ground, soft diffused bloom around the brightest points, no harsh shadows, centered square composition like a game inventory icon, painterly, luminous, dreamlike, the object feels precious and handcrafted`,
    },
  },
  gathering_node: {
    label: "Gathering Node",
    templates: {
      arcanum: `A solitary interactable resource node grounded on a dark cosmic-stone floor — perhaps an aurum-veined ore outcrop, a cluster of luminous crystalline herbs, a glowing tide-pool, or a hollow at the base of an ancient tree — rendered with faithful material detail in the Arcanum palette, warm aurum-gold light pooling on the harvestable surfaces with soft bloom, baroque energy filaments curling from the node like delicate scrollwork tendrils, deep cosmic indigo and abyssal navy void surrounding it, blue-violet atmospheric mist drifting around the base, the silhouette is clearly readable as something a player would walk up to and gather from, centered square composition with the node grounded at the lower third of the frame, painterly oil technique, extremely detailed, no characters, no hands, no UI`,
      gentle_magic: `A solitary interactable resource node resting on a soft mossy patch of ground — perhaps a pale silver ore vein in a weathered stone, a cluster of luminous lavender mushrooms, a small herb patch with dusty rose blossoms, or a calm reflective pool flecked with soft gold — rendered with warm gentle detail in the Gentle Magic palette, source-ambiguous diffused light with no harsh shadows, faint floating motes of warm gold drifting upward from the harvestable surfaces, pale blue and lavender atmospheric haze fading to deep mist behind, tiny moss-green tufts and dusty rose buds at the base, the silhouette is clearly readable as something a player would walk up to and gather from, centered square composition with the node grounded at the lower third of the frame, painterly, luminous, dreamlike, no characters, no hands, no UI`,
    },
  },
  lever_handle: {
    label: "Lever Handle",
    templates: {
      arcanum: `A single ornate lever handle rendered as an isolated game sprite, oriented vertically and pointing straight up in a neutral upright pose — a slender polished shaft of dark metal chased with aurum-gold filigree rising from a rounded pivot knuckle at its base, crowned by a gripable orb finial at the top, warm aurum-gold light pooling along the shaft with soft bloom, cool blue-violet accents in the shadows, NO mounting plate, NO wall, NO floor, NO other hardware — only the handle arm itself, centered upright with the pivot end at the bottom, painterly, luminous, extremely detailed`,
      gentle_magic: `A single charming lever handle rendered as an isolated game sprite, oriented vertically and pointing straight up in a neutral upright pose — a gently curved shaft of weathered brass or carved wood rising from a smooth rounded pivot knuckle at its base, topped by a rounded gripable knob, soft source-ambiguous light with a faint warm glow, lavender and pale-gold undertones, NO mounting plate, NO wall, NO floor, NO other hardware — only the handle arm itself, centered upright with the pivot end at the bottom, painterly, luminous, dreamlike`,
    },
  },
  lever_plate: {
    label: "Lever Plate",
    templates: {
      arcanum: `A single lever mounting plate rendered as an isolated game sprite, viewed straight head-on — an ornate circular or shield-shaped backing plate of dark metal with aurum-gold baroque scrollwork around its rim and a central pivot socket at its middle where a handle would attach, warm golden bloom around the socket, cool blue-violet ambient fill in the recesses, NO handle, NO arm, NO lever shaft present, NO wall, NO floor, only the plate, centered with padding on all sides, painterly, luminous, extremely detailed`,
      gentle_magic: `A single lever mounting plate rendered as an isolated game sprite, viewed straight head-on — a gently rounded backing plate of weathered brass or carved wood with soft decorative trim and a central pivot socket at its middle where a handle would attach, faint warm inner glow, lavender and pale-gold undertones, NO handle, NO arm, NO lever shaft present, NO wall, NO floor, only the plate, centered with padding on all sides, painterly, luminous, dreamlike`,
    },
  },
  door_leaf: {
    label: "Door Leaf",
    templates: {
      arcanum: `A single closed door panel rendered as an isolated game sprite, viewed straight head-on — a tall slab of dark timber bound with aurum-gold iron banding and studs, a chased filigree handle and a faint warded keyhole, warm aurum-gold light pooling along the metalwork with soft bloom, cool blue-violet accents in the grain, NO surrounding frame, NO doorway arch, NO wall, NO floor, only the door leaf itself, centered upright with padding on all sides, painterly, luminous, extremely detailed`,
      gentle_magic: `A single closed door panel rendered as an isolated game sprite, viewed straight head-on — a tall plank of weathered wood with gentle grain, soft rounded iron bands, a simple rounded handle and a small keyhole, faint source-ambiguous warm glow, lavender and pale-gold undertones, NO surrounding frame, NO doorway arch, NO wall, NO floor, only the door leaf itself, centered upright with padding on all sides, painterly, luminous, dreamlike`,
    },
  },
  door_frame: {
    label: "Door Frame",
    templates: {
      arcanum: `A single empty doorway frame rendered as an isolated game sprite, viewed straight head-on — an ornate arched portal of dark cosmic stone edged with aurum-gold baroque scrollwork, the opening hollow and empty with nothing inside it, warm golden bloom tracing the inner edge, cool blue-violet ambient fill in the recesses, NO door panel, NO leaf, NO wall around it, NO floor, only the frame, centered with even padding, painterly, luminous, extremely detailed`,
      gentle_magic: `A single empty doorway frame rendered as an isolated game sprite, viewed straight head-on — a gently arched portal of weathered stone or carved wood with soft decorative trim, the opening hollow and empty with nothing inside it, faint warm inner glow tracing the edge, lavender and pale-gold undertones, NO door panel, NO leaf, NO wall around it, NO floor, only the frame, centered with even padding, painterly, luminous, dreamlike`,
    },
  },
  faction_emblem: {
    label: "Faction Emblem",
    templates: {
      arcanum: `A single heraldic faction sigil rendered as a bold iconic emblem against deep cosmic indigo void, the central symbol forged in aurum-gold and blue-violet — a beast, weapon, sun, tree, crown, or abstract glyph that captures the faction's spirit — surrounded by a subtle baroque scrollwork ring that dissolves into darkness at the edges, soft warm bloom haloing the central form, centered square composition reading clearly at small sizes, painterly, luminous, no text, no characters, no scenery`,
      gentle_magic: `A single heraldic faction sigil rendered as a soft iconic emblem against deep mist-blue background, the central symbol — a beast, weapon, leaf, sun, hand, or abstract glyph that captures the faction's spirit — drawn with warm muted colors and a gentle inner glow in lavender or pale gold, surrounded by a faint ring of floating light motes, centered square composition reading clearly at small sizes, painterly, luminous, dreamlike, no text, no characters, no scenery`,
    },
  },
  ability_icon: {
    label: "Ability Icon",
    templates: {
      arcanum: `A single iconic ability symbol rendered as flowing energy against deep cosmic indigo void, baroque scrollwork frame dissolving at edges, the central icon glows with concentrated aurum-gold light and soft bloom, blue-violet atmospheric fill behind, centered square composition like a game ability icon, painterly, luminous, extremely detailed, no text, no figures`,
      gentle_magic: `A single iconic ability symbol as a softly glowing natural form against deep mist-blue background, the icon rendered as living magic — perhaps a crystallized flower, a swirl of luminous water, or a gentle flame — radiating pale lavender and soft gold light with diffused bloom, framed by a subtle circle of floating light motes, centered square composition like a game ability icon, organic shapes, no harsh edges, painterly, luminous, dreamlike, no text, no figures`,
    },
  },
  status_effect_icon: {
    label: "Status Effect Icon",
    templates: {
      arcanum: `A single iconic status effect symbol rendered as flowing energy against deep cosmic indigo void, baroque scrollwork frame dissolving at edges, the central icon glows with concentrated light — shields in steel-blue, buffs in warm gold, debuffs in sickly green, DoTs in smoldering ember-red — soft bloom, centered square composition like a game status icon, painterly, luminous, extremely detailed, no text, no figures`,
      gentle_magic: `A single iconic status effect symbol as a softly glowing natural form against deep mist-blue background, the icon rendered as living magic — shields as crystalline domes, buffs as gentle auras, debuffs as wilting tendrils, DoTs as slow-burning embers — radiating pale lavender and contextual color light with diffused bloom, framed by a subtle circle of floating light motes, centered square composition like a game status icon, organic shapes, no harsh edges, painterly, luminous, dreamlike, no text, no figures`,
    },
  },
  racial_ability_icon: {
    label: "Racial Ability Icon",
    templates: {
      arcanum: `A single iconic emblem for an innate racial passive power rendered as flowing ancestral energy against deep cosmic indigo void, baroque scrollwork frame dissolving at edges, the central symbol glows with concentrated aurum-gold light and soft bloom evoking the bloodline's signature force — flame, time, light, stone, spore, reversal, beast-call, draconic wrath, or aetheric phase — blue-violet atmospheric fill behind, centered square composition like a game ability icon, painterly, luminous, extremely detailed, no text, no figures`,
      gentle_magic: `A single iconic emblem for an innate racial passive power as a softly glowing natural form against deep mist-blue background, the icon rendered as living ancestral magic that captures the bloodline's signature force — a gentle flame, a swirl of luminous time, drifting motes of light, weathered stone, blooming spores, or a curling phase-shimmer — radiating pale lavender and warm gold light with diffused bloom, framed by a subtle circle of floating light motes, centered square composition like a game ability icon, organic shapes, no harsh edges, painterly, luminous, dreamlike, no text, no figures`,
    },
  },
  music: {
    label: "Music Track",
    templates: {
      arcanum: `Ambient orchestral music — cosmic and majestic, with sweeping strings and deep reverberating brass`,
      gentle_magic: `Gentle atmospheric music — dreamy harp, soft strings, and distant chimes creating a warm enchanted mood`,
    },
  },
  ambient: {
    label: "Ambient Sound",
    templates: {
      arcanum: `Environmental soundscape — deep resonant hums, distant mechanical echoes, cosmic wind`,
      gentle_magic: `Environmental soundscape — gentle rustling leaves, soft flowing water, distant birdsong, magical chimes`,
    },
  },
  audio: {
    label: "Audio Cue",
    templates: {
      arcanum: `A short atmospheric audio cue - resonant tones, distant cosmic echoes, and soft reverberant energy`,
      gentle_magic: `A short atmospheric audio cue - soft natural texture, subtle magical shimmer, and gentle environmental motion`,
    },
  },
  video: {
    label: "Video Cinematic",
    templates: {
      arcanum: `Slow cinematic camera movement through a cosmic baroque space — golden light drifting, energy threads pulsing`,
      gentle_magic: `Slow dreamlike camera drift through an enchanted scene — floating motes, gently swaying foliage, soft ambient glow`,
    },
  },
  lore_character: {
    label: "Lore Character Portrait",
    templates: {
      arcanum: `2:3 portrait of a fantasy character — dramatic lighting from above in deep indigo and aurum-gold, baroque ornamental frame elements at edges, rich oil-painting texture, the figure emerges from cosmic darkness with luminous detail`,
      gentle_magic: `2:3 portrait of a fantasy character — soft diffused lighting in pale lavender and warm gold, dreamlike atmosphere, gentle painterly brushstrokes, luminous skin and fabric, motes of light drifting around the figure`,
    },
  },
  lore_location: {
    label: "Lore Location Vista",
    templates: {
      arcanum: `16:9 landscape establishing shot of a fantasy location — deep indigo sky with golden celestial phenomena, baroque architectural silhouettes, atmospheric perspective with layers of cosmic mist, oil-painting technique, extremely detailed`,
      gentle_magic: `16:9 landscape of a fantasy location — soft pastel skies in lavender and pale blue, gentle ambient lighting, dreamy atmospheric haze, luminous foliage and water, painterly and serene`,
    },
  },
  lore_organization: {
    label: "Lore Organization Banner",
    templates: {
      arcanum: `1:1 heraldic banner or crest design — deep indigo background, golden baroque scrollwork frame, symbolic motif at center rendered in luminous aurum and cool violet, ornamental filigree, regal and imposing`,
      gentle_magic: `1:1 heraldic emblem or banner — soft lavender background, gentle floral frame, symbolic motif in warm gold and pale rose, luminous and elegant, dreamlike quality`,
    },
  },
  lore_species: {
    label: "Lore Species Portrait",
    templates: {
      arcanum: `1:1 creature portrait — deep cosmic background, the creature rendered in dramatic chiaroscuro with golden rim lighting, baroque detail in scales or fur or plumage, luminous eyes, oil-painting technique`,
      gentle_magic: `1:1 creature portrait — soft ambient background of pale greens and lavender, the creature rendered gently with luminous detail, warm expression, painterly and approachable`,
    },
  },
  lore_item: {
    label: "Lore Item Icon",
    templates: {
      arcanum: `1:1 item icon floating on deep indigo void — the object rendered with golden baroque filigree detail, luminous energy emanating from within, dramatic lighting, jewel-like precision`,
      gentle_magic: `1:1 item icon floating on soft lavender background — the object rendered with gentle luminosity, warm gold accents, painterly texture, dreamy ambient glow`,
    },
  },
  lore_event: {
    label: "Lore Historical Scene",
    templates: {
      arcanum: `16:9 dramatic historical scene — deep cosmic backdrop, figures silhouetted against golden cataclysmic light, baroque composition with sweeping diagonals, oil-painting grandeur, epic scale`,
      gentle_magic: `16:9 historical scene — soft atmospheric lighting, figures in a landscape of gentle wonder, luminous details, dreamy and painterly, emotionally resonant rather than dramatic`,
    },
  },
  lore_map: {
    label: "Lore Map",
    templates: {
      arcanum: `Top-down fantasy map illustration — parchment-toned with deep indigo ocean, golden coastline details, baroque cartouche borders, mountain ranges and forests rendered in rich oil-painting technique`,
      gentle_magic: `Top-down fantasy map illustration — soft watercolor style on cream parchment, gentle pastel terrain coloring, dreamy cloud-like borders, luminous compass rose`,
    },
  },
  showcase_banner: {
    label: "Showcase Banner",
    templates: {
      arcanum: `Ultra-wide cinematic hero banner for a worldbuilding website — a sweeping establishing vista of this fantasy world rendered in deep cosmic indigo and warm aurum-gold, baroque scrollwork of glowing energy threads tracing the horizon, layered atmospheric depth from distant silhouettes to luminous foreground, strong negative space in the upper and lower thirds to leave room for title text overlay, painterly oil technique, majestic and inviting, no characters in close foreground`,
      gentle_magic: `Ultra-wide cinematic hero banner for a worldbuilding website — a sweeping dreamlike vista of this fantasy world in soft lavender and pale blue undertones, gentle atmospheric haze, warm gold sunlight diffusing through floating motes of light, slightly elongated organic silhouettes in the distance, strong negative space in the upper and lower thirds for title text overlay, painterly and luminous, emotionally warm and inviting, no characters in close foreground`,
    },
  },
  showcase_favicon: {
    label: "Showcase Favicon",
    templates: {
      arcanum: `A bold centered emblem for a world logo icon — a single iconic symbol representing this world's essence, rendered in concentrated aurum-gold light against a deep cosmic indigo background, baroque filigree curling inward toward the symbol, high contrast so the silhouette remains legible even at tiny sizes, centered square composition with the symbol filling most of the frame, painterly but simplified, no fine detail that would disappear when scaled down, no text`,
      gentle_magic: `A bold centered emblem for a world logo icon — a single iconic symbol representing this world's essence, rendered as a softly glowing natural form in warm gold and dusty rose against a deep mist-blue background, gentle diffused bloom, high contrast so the silhouette remains legible even at tiny sizes, centered square composition with the symbol filling most of the frame, painterly but simplified, no fine detail that would disappear when scaled down, no text`,
    },
  },
};

// ─── Enhance System Prompts ───────────────────────────────────────

/** Shared output-length rule for all enhancer system prompts. Enhanced
 *  prompts are billed as image-model input tokens on every generation, so
 *  the cap is a direct per-image cost control. */
const ENHANCE_LENGTH_RULE = `Keep the finished prompt under 100 words — every phrase must add concrete visual information; no filler, no repeated style language.`;

const ENHANCE_SYSTEM_PROMPT_ARCANUM = `You are a prompt engineer for AI image generation models. Enhance user prompts for the Arcanum art style (arcanum_v1) — vast, baroque, luminous, like looking into the architecture of creation.

Palette: deep cosmic indigo (#080c1c) and abyssal navy (#0f1428) backgrounds, never pure black; warm aurum-gold (#c8972e, #e2bc6a) accents only where something is alive, active, or important; cool blue-violet nebula fill as the medium everything exists in. No neon, no harsh white.
Shape: baroque/rococo scrollwork rendered as glowing energy threads, C- and S-curves terminating in curls, acanthus-leaf spirals, fractaline structures, decorative elements dissolving to transparency at their ends.
Light: concentrated aurum glow pooling with soft feathered bloom; nebula-violet ambient fill; no hard shadows. Cosmological scale, painterly oil technique, extremely detailed. Wide compositions for environments, centered for items/icons, vertical for portraits.
Never include: text, words, letters, runes, glyphs, watermarks, logos, modern technology, user interfaces, neon colors, harsh shadows, hard edges, flat design, cartoon, anime, photorealism, studio lighting, horror, gore.

Entity portraits: when the prompt describes a specific character, creature, or NPC, depict them faithfully with literal anatomy and appearance — never reduced to abstract energy forms. Apply the Arcanum palette and lighting to their actual physical form; ornamentation frames the character, never replaces them.

When enhancing:
1. Preserve the core subject and any described physical details.
2. Weave in Arcanum palette, ornamentation, and light behavior.
3. ${ENHANCE_LENGTH_RULE}
4. Output ONLY the enhanced prompt text — no explanation, no preamble, no formatting.`;

const ENHANCE_SYSTEM_PROMPT_GENTLE_MAGIC = `You are an expert image prompt engineer for AI image generators. You work exclusively within the Surreal Gentle Magic design system.

${STYLE_GUIDE_REFERENCE}

Given an entity from a fantasy MUD zone, write a single optimized image generation prompt. Actively transform the scene toward the aesthetic, even if the source sounds modern, industrial, or mundane: replace harsh/artificial lighting with ambient source-ambiguous glow, straight geometric surfaces and industrial materials with gently curved organic or enchanted equivalents (weathered stone, living wood, crystal), and any readable text with glowing runes or arcane glyphs; add subtle magic — floating motes, luminous vegetation, atmospheric haze — and keep the approved palette. Every scene must feel like a softly luminous storybook illustration.

Entity portraits: when the prompt describes a specific character, creature, or NPC, depict them faithfully with their actual physical appearance — never reduced to abstract forms. The dreamlike quality enhances the character, never replaces them.

${ENHANCE_LENGTH_RULE}
Output ONLY the enhanced prompt text — no explanation, no preamble, no formatting.`;

const CUSTOM_ASSET_SYSTEM_PROMPT_GENTLE_MAGIC = `You are an expert image prompt engineer for AI image generators. You work exclusively within the Surreal Gentle Magic design system.

${STYLE_GUIDE_REFERENCE}

The user will provide a free-form description of an asset they want generated for a fantasy worldbuilding tool. Transform it into an optimized image generation prompt that fully conforms to the Surreal Gentle Magic aesthetic.

Rules:
- Preserve the user's core subject, purpose, and mood
- Replace harsh, industrial, or mundane details with soft magical equivalents; add subtle magic (floating motes, atmospheric haze, glowing vegetation) within the approved palette
- Replace any readable text, signage, labels, or inscriptions with glowing runes or arcane glyphs
- Respect the requested format/composition exactly
- ${ENHANCE_LENGTH_RULE}

Output ONLY the finished prompt text — no explanation, no labels, no markdown.`;

/** Per-class palette descriptors for ability and status effect icon generation,
 *  keyed by the built-in Ambon class name (lowercased for matching). */
const CLASS_PALETTE_LINES: Record<string, string> = {
  bulwark: "- Bulwark (defensive tank): warm golds, burnished steel, shield shapes, fortress silhouettes, heavy metallic tones",
  warden: "- Warden (aggressive fighter): warm amber, rust reds, earthy brown, sharp weapon motifs, fur and leather textures",
  arcanist: "- Arcanist (scholarly mage): deep purples, electric blues, crystalline whites, arcane sigils, glowing tomes",
  faeweaver: "- Faeweaver (nature mage): living greens, floral pinks, vine tendrils, petal formations, budding flowers",
  necromancer: "- Necromancer (death + clockwork): sickly greens, clockwork brass, bone whites, ghostly teal, gear motifs",
  veil: "- Veil (shadow assassin): deep indigos, midnight purples, smoky grays, dagger silhouettes, living shadow wisps",
  binder: "- Binder (anti-magic enforcer): blazing amber, golden chains, rune circles, suppression barriers, dissolving spell fragments",
  stormblade: "- Stormblade (lightning warrior): electric blues, white lightning, storm grays, zig-zag energy streaks, crackling arcs",
  herald: "- Herald (divine cleric): warm whites, soft golds, holy radiance, sacred symbols, gentle divine glow",
  starweaver: "- Starweaver (cosmic mage): cosmic purples, nebula pinks, stellar whites, constellation patterns, swirling galaxies",
};

const EFFECT_COLOR_MODIFIERS = `EFFECT COLOR MODIFIERS:
- Healing/regeneration: warm golden-white light, green life energy
- Shields/protection: translucent barriers, dome shapes, soft glowing edges
- Damage-over-time: smoldering embers, dripping venom, crackling energy
- Stun/crowd-control: stars, shattered glass, frozen shards
- Buffs: ascending arrows, radiant auras, empowering glows
- Debuffs: descending spirals, dark mists, weakening auras`;

/** Full class color palette reference (all classes). Used when the relevant
 *  class is unknown — e.g. cross-class status effects, or custom-class worlds
 *  whose class names don't match the built-in palettes. */
export const CLASS_COLOR_PALETTES = `
CLASS COLOR PALETTES (use when generating ability or status effect icons):
${Object.values(CLASS_PALETTE_LINES).join("\n")}

${EFFECT_COLOR_MODIFIERS}`;

/** Palette block for an ability/status icon prompt. When the icon's class is
 *  known and matches a built-in palette, emit only that class's line plus the
 *  shared effect modifiers (instead of all ten palettes); otherwise fall back
 *  to the full reference. */
export function buildClassPalettes(iconClass?: string): string {
  const line = CLASS_PALETTE_LINES[iconClass?.trim().toLowerCase() ?? ""];
  if (!line) return CLASS_COLOR_PALETTES;
  return `
CLASS COLOR PALETTE (use for this ability/status effect icon):
${line}

${EFFECT_COLOR_MODIFIERS}`;
}

/** Full sprite safety block for BG-removal models (FLUX etc.) */
const SPRITE_SAFETY_ENHANCER_BLOCK = `

SPRITE SAFETY RULES (this asset will be algorithmically matted out of its background — non-negotiable, they OVERRIDE conflicting style guidance and the word cap; state them in the output compactly, as hard requirements, never softened with "preferably"):
- The background is a flat uniform pale lavender (#d8d0e8) field, empty and featureless. Strip any decorative frames, scrollwork, nebula, mist, motes, particles, ground planes, or sticker-sheet patterns from the source prompt.
- Wings, tails, fins, membranes, cloaks, and all appendages are FULLY OPAQUE solid shapes with clear outlines — never translucent, gauzy, dissolving into light, or trailing particles. Paired features (two wings, two horns, two ears) must BOTH be fully visible and anatomically attached.
- The full figure fits within the frame with padding on all sides — never crop — as a single connected silhouette with no detached floating parts.`;

/** Light framing block for native-transparency models (GPT Image, OpenAI) */
const SPRITE_FRAMING_ENHANCER_BLOCK = `

SPRITE FRAMING (rendered on a transparent background):
- The full figure including all appendages (wings, tails, horns, weapons, cloaks) fits within the frame with padding on all sides — never crop. Paired features (two wings, two horns) both fully visible.
- A single connected figure with a clear silhouette.
- Do NOT describe a background — the model generates transparency automatically.`;

/** Room/location scene block — keeps the image confined to THIS room, not neighbors. */
const ROOM_SCENE_ENHANCER_BLOCK = `

ROOM SCENE RULES (depict ONLY the current room):
- MUD room descriptions often mention what lies beyond the exits ("to the north a meadow rolls away", "a door leads down into the cellar"). Those are navigation cues — do NOT render the neighboring meadow, ocean, cellar, or chamber. Exits may appear as doorways, archways, windows, or paths, but show only the threshold, never the scene beyond it.
- Do not paint named far-off zones or landmarks into the scene unless the room IS that landmark.`;

/** Asset types that depict a room/location scene and need the "don't show neighbors" rule. */
function isRoomScene(assetType: string | undefined): boolean {
  return assetType === "room" || assetType === "background" || assetType === "lore_location";
}

/** Get the system prompt for prompt enhancement — defers to world visual style when defined.
 *  Pass `nativeTransparency` to use lighter framing rules instead of full BG-removal safety. */
export function getEnhanceSystemPrompt(style: ArtStyle, assetType?: string, surface?: ArtStyleSurface, nativeTransparency?: boolean, iconClass?: string): string {
  const visualStyle = buildVisualStyleDirective(surface);
  const tone = buildToneDirective({ imageContext: true });
  const spriteSafety = assetType && needsBgRemovalSafety(assetType)
    ? (nativeTransparency ? SPRITE_FRAMING_ENHANCER_BLOCK : SPRITE_SAFETY_ENHANCER_BLOCK)
    : "";
  const roomScene = isRoomScene(assetType) ? ROOM_SCENE_ENHANCER_BLOCK : "";

  // If the world defines a visual style, use a generic enhancer that defers to it
  if (visualStyle || tone) {
    const toneBlock = tone ? `\n\nWorld context: ${tone}` : "";
    const styleBlock = visualStyle
      ? `\n\nWorld visual style: ${visualStyle}\nAll enhanced prompts must conform to this visual style.`
      : "";
    const palettes = (assetType === "ability_icon" || assetType === "status_effect_icon" || assetType === "ability_sprite")
      ? `\n\n${buildClassPalettes(iconClass)}`
      : "";

    return `You are an expert image prompt engineer for AI image generators.${toneBlock}${styleBlock}

When enhancing a prompt:
1. The article TITLE is the subject — build a single iconic portrait/illustration OF that subject in their characteristic form and setting. Appearance fields and description are supporting visual context, NOT scenes to choose from.
2. Do not build an action scene out of events recounted in the description ("X was betrayed by Y and killed by W" still yields a portrait of X), and leave other named characters, items, relationships, and plot events out of the visual unless the subject's defining identity requires them (a smith and their forge). Exception: for "event" or "story" articles the recounted moment IS the subject.
3. Depict the subject's described form faithfully — body, materials, scale, environment. Do not give non-humanoid subjects a humanoid form, and do not invent an unstated species, race, or category.
4. The visual style governs palette, lighting, and rendering technique — NOT subject identity. Surface framing examples are defaults for generic subjects; when they conflict with the subject's form or scale, follow the subject.
5. Replace any readable text, signs, or inscriptions with abstract symbols or glowing runes — AI cannot render legible text. Avoid photorealism, modern technology, flat design, cartoon, anime.
6. ${ENHANCE_LENGTH_RULE}
7. Output ONLY the enhanced prompt text — no explanation, no preamble, no formatting.${palettes}${spriteSafety}${roomScene}`;
  }

  // No world style defined — fall back to the legacy style-specific prompts
  const base = style === "arcanum"
    ? ENHANCE_SYSTEM_PROMPT_ARCANUM
    : ENHANCE_SYSTEM_PROMPT_GENTLE_MAGIC;
  const palettes = (assetType === "ability_icon" || assetType === "status_effect_icon" || assetType === "ability_sprite")
    ? `\n\n${buildClassPalettes(iconClass)}`
    : "";
  return `${base}${palettes}${spriteSafety}${roomScene}`;
}

const CUSTOM_ASSET_SYSTEM_PROMPT_ARCANUM = `You are an expert image prompt engineer for AI image generators. You work exclusively within the Arcanum art style (arcanum_v1).

Core palette: deep cosmic indigo and abyssal navy backgrounds, warm aurum-gold as the primary accent, cool blue-violet atmospheric fill, baroque rococo scrollwork rendered as glowing energy threads, fractaline structures, sweeping spiral arms of light.
Shape language: C-curves and S-curves, acanthus-leaf spirals, gradual dissolution at extremities, cosmological scale, no hard stops.
Light: concentrated aurum glow with feathered bloom, nebula-violet ambient fill, no hard shadows.
Forbidden: neon colors, harsh white, flat design, cartoon, anime, photorealism, readable text or words.

The user will provide a free-form description of an asset they want generated for a fantasy worldbuilding tool. Transform it into an optimized image generation prompt that fully conforms to the Arcanum aesthetic.

Rules:
- Preserve the user's core subject, purpose, and mood
- Weave in Arcanum palette (deep indigo, aurum-gold, blue-violet), baroque ornamentation as framing/accents, and light behavior (aurum pooling, nebula mist, soft bloom)
- Replace any readable text, signage, labels, or inscriptions with glowing runes or arcane glyphs
- Respect the requested format/composition exactly
- ${ENHANCE_LENGTH_RULE}

Output ONLY the finished prompt text — no explanation, no labels, no markdown.`;

export function getCustomAssetSystemPrompt(style: ArtStyle, surface?: ArtStyleSurface): string {
  const visualStyle = buildVisualStyleDirective(surface);
  const tone = buildToneDirective({ imageContext: true });

  if (visualStyle || tone) {
    const toneBlock = tone ? `\n\nWorld context: ${tone}` : "";
    const styleBlock = visualStyle
      ? `\n\nWorld visual style: ${visualStyle}\nAll generated prompts must conform to this visual style.`
      : "";

    return `You are an expert image prompt engineer for AI image generators.${toneBlock}${styleBlock}

The user will provide a free-form description of an asset they want generated for a fantasy worldbuilding tool. Transform it into an optimized image generation prompt that matches the world's visual style.

Rules:
- Preserve the user's core subject, purpose, and mood
- Enhance the description with compositional and quality details appropriate to the visual style
- Replace any readable text, signage, labels, or inscriptions with abstract symbols or glowing runes
- Respect the requested format/composition exactly
- ${ENHANCE_LENGTH_RULE}

Output ONLY the finished prompt text — no explanation, no labels, no markdown.`;
  }

  // No world style defined — fall back to legacy style-specific prompts
  const base = style === "arcanum"
    ? CUSTOM_ASSET_SYSTEM_PROMPT_ARCANUM
    : CUSTOM_ASSET_SYSTEM_PROMPT_GENTLE_MAGIC;
  return base;
}

export function buildCustomAssetPrompt(
  assetType: AssetType,
  description: string,
  _zoneVibe?: string | null,
  style: ArtStyle = "gentle_magic",
  surface?: ArtStyleSurface,
): string {
  const formatSpec = getFormatForAssetType(assetType);
  const preamble = getPreamble(style, surface);

  const base = `${formatSpec}. ${preamble}

User brief: ${description}

${NO_TEXT_LINE}`;

  return withSpriteSafety(base, assetType);
}

/** Compose a full prompt from template + context */
export function composePrompt(
  assetType: AssetType,
  style: ArtStyle = "gentle_magic",
  customization?: string,
): string {
  const template = ASSET_TEMPLATES[assetType].templates[style];
  if (customization) {
    return `${template}, ${customization}`;
  }
  return template;
}

// ─── LLM JSON parsing ────────────────────────────────────────────

/**
 * Parse a JSON response from the LLM, stripping markdown code fences
 * and fixing common formatting issues (e.g. unescaped newlines in strings).
 */
export function parseLlmJson<T = Record<string, unknown>>(raw: string, label = "LLM"): T {
  const text = raw.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fallback: fix unescaped newlines inside JSON string values and retry
    const fixed = text.replace(/(?<=:\s*"(?:[^"\\]|\\.)*?)(\r?\n)(?=[^"]*")/g, "\\n");
    try {
      return JSON.parse(fixed) as T;
    } catch (e) {
      console.error(`[${label}] Failed to parse JSON response. Raw text:`, text.slice(0, 500));
      throw new Error(`Failed to parse ${label} JSON: ${(e as Error).message}. Try regenerating.`);
    }
  }
}
