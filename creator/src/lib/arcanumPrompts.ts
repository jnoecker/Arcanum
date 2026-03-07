import type { AssetType } from "@/types/assets";

// ─── Art Style System ─────────────────────────────────────────────

export type ArtStyle = "arcanum" | "gentle_magic";

export const ART_STYLE_LABELS: Record<ArtStyle, string> = {
  arcanum: "Arcanum",
  gentle_magic: "Gentle Magic",
};

export const ART_STYLE_DESCRIPTIONS: Record<ArtStyle, string> = {
  arcanum: "Baroque cosmic gold-and-indigo — the Creator's instrument",
  gentle_magic: "Surreal soft magic — dreamlike, enchanted, emotionally safe",
};

// ─── Arcanum v1 ───────────────────────────────────────────────────

/** Arcanum v1 style preamble — prepended to all art prompts */
export const ARCANUM_PREAMBLE = `Ambon Arcanum style (arcanum_v1): deep cosmic indigo and abyssal navy backgrounds, baroque rococo light scrollwork rendered as glowing energy threads, warm aurum-gold as the primary accent color against cool blue-violet atmospheric fill, sweeping spiral arms of light, fractaline structures, slow cosmological scale, no runes or text, no humanoid figures, no neon colors, no harsh edges`;

// ─── Surreal Gentle Magic v1 ──────────────────────────────────────

/** Gentle Magic style preamble — for MUD world assets */
export const GENTLE_MAGIC_PREAMBLE = `Surreal Gentle Magic style (surreal_softmagic_v1): soft lavender and pale blue undertones, ambient diffused lighting with no harsh shadows or spotlighting, gentle atmospheric haze with floating motes of light, subtle magical glow integrated naturally into the environment, slightly elongated organic forms, dreamy breathable emotionally safe aesthetic, no neon colors, no high contrast, no harsh edges, painterly and luminous`;

/** Universal negative prompt — appended to all generations */
export const UNIVERSAL_NEGATIVE = `text, words, letters, runes, glyphs, watermarks, logos, signatures, humanoid figures, faces, bodies, animals, modern technology, computers, user interfaces, neon colors, hot pink, electric blue, lime green, harsh shadows, hard edges, flat design, cartoon, anime, photorealism, studio lighting, stock photo aesthetic, horror elements, gore`;

/** Get the preamble for a given art style */
export function getPreamble(style: ArtStyle): string {
  return style === "arcanum" ? ARCANUM_PREAMBLE : GENTLE_MAGIC_PREAMBLE;
}

/** Per-asset-type prompt templates */
export const ASSET_TEMPLATES: Record<AssetType, { label: string; template: string }> = {
  background: {
    label: "Background",
    template: `Vast cosmic observatory floating in deep space, baroque architectural elements rendered in flowing light — sweeping rococo scrollwork of glowing blue-violet and gold energy forming grand archways and spiral colonnades, a colossal golden spiral galaxy visible through open arched windows, deep indigo and abyssal navy void beyond, fractaline structures branching into the distance like crystalline trees made of light, warm aurum-amber luminescence pooling at architectural nodes, cool nebula-violet atmospheric mist drifting between pillars, ultra-wide panoramic composition, painterly oil technique, extremely detailed`,
  },
  ornament: {
    label: "Panel Ornament",
    template: `Intricate baroque energy scrollwork border, symmetrical horizontal composition, glowing aurum-gold rococo flourishes and acanthus-leaf spirals rendered as threads of light against deep cosmic indigo, cool blue-violet glow fills the spaces between curls, the scrollwork dissolves to transparency at both horizontal ends, extremely detailed filigree of light, jewelry-like precision, wide aspect ratio banner format`,
  },
  status_art: {
    label: "Server Status Art",
    template: `A cosmic engine in full operation — a grand mechanical orrery made entirely of light, baroque golden rings and spiral armatures rotating slowly in deep indigo space, warm aurum energy flowing along the curved spokes like luminous oil, smaller fractal orreries visible in the distance like satellites, blue-violet atmospheric fill between components, a sense of vast power operating at perfect equilibrium, painterly, glowing, majestic`,
  },
  empty_state: {
    label: "Empty State",
    template: `An empty cosmic void beginning to stir — deep abyssal navy space with the faint suggestion of energy not yet shaped into form, a single point of warm aurum-gold light at the center casting the first illumination into darkness, baroque energy tendrils beginning to curl outward from that center point as if the act of creation is just beginning, blue-violet nebula mist drifting at the periphery, vast and serene, the moment before the world exists, painterly, luminous`,
  },
  entity_portrait: {
    label: "Entity Portrait",
    template: `Baroque cosmic portrait frame rendered in glowing aurum-gold scrollwork, deep indigo background with blue-violet nebula wisps, the subject depicted as an archetypal symbol rendered in flowing light rather than literal form, ornate frame edges curl and dissolve into darkness, warm golden light emanates from the center, painterly, luminous`,
  },
  ability_sprite: {
    label: "Ability Sprite",
    template: `A single iconic ability symbol rendered as flowing energy against deep cosmic indigo void, baroque scrollwork frame dissolving at edges, the central icon glows with concentrated aurum-gold light and soft bloom, blue-violet atmospheric fill behind, centered square composition like a game ability icon, painterly, luminous, extremely detailed, no text, no figures`,
  },
  zone_map: {
    label: "Zone Map",
    template: `Celestial cartography from above, a glowing world map rendered in baroque light threads on a deep cosmic indigo void, landmasses formed from swirling aurum-gold energy lines that curl and flourish at coastlines and mountain ranges in rococo scrollwork style, rivers traced as flowing silver-blue light, zone boundaries marked by gentle violet-glowing arcs, concentric circles of faint stardust suggesting scale and depth, fractal detail increasing toward the edges, bird's-eye perspective, painterly, luminous`,
  },
  splash_hero: {
    label: "Splash / Welcome",
    template: `A grand cosmic portal at the threshold of creation — an immense baroque archway of glowing aurum-gold scrollwork stands at the center of deep cosmic indigo void, its pillars formed from intertwined spirals of golden light and blue-violet energy, through the arch a breathtaking view of a nascent universe unfolds with spiral galaxies and nebula clouds in warm amber and cool violet, the portal radiates concentrated aurum light outward in soft bloom, rococo acanthus-leaf finials crown the arch, the floor is a mirror-dark reflective plane catching the golden glow, sweeping ultra-wide cinematic composition, painterly oil technique, extremely detailed, majestic and inviting`,
  },
  loading_vignette: {
    label: "Loading Vignette",
    template: `A single baroque golden orrery mechanism suspended in deep cosmic indigo void — three concentric rings of aurum-gold light slowly orbiting a bright central point, the rings are ornate with rococo scrollwork filigree rendered as energy threads, blue-violet nebula mist drifts between the rings giving depth, tiny fractaline satellite structures orbit at the periphery like jeweled clockwork, the whole mechanism radiates a gentle warm glow with soft bloom, centered square composition on transparent-feeling dark background, painterly, luminous, meditative`,
  },
  panel_header: {
    label: "Panel Header Bar",
    template: `An ultra-wide thin horizontal decorative banner — symmetrical baroque scrollwork of glowing aurum-gold energy rendered as delicate filigree threads on deep cosmic indigo, a central diamond-shaped medallion radiates warm golden light outward, flanked by sweeping C-curve and S-curve acanthus spirals that extend to both edges and dissolve to transparency at the ends, blue-violet ambient glow fills the spaces between the gold threads, extremely thin tall aspect ratio like a decorative rule line, no text, no figures, painterly, luminous, jewelry-like precision`,
  },
};

// ─── Enhance System Prompts ───────────────────────────────────────

const ENHANCE_SYSTEM_PROMPT_ARCANUM = `You are a prompt engineer specializing in FLUX image generation models. Your task is to enhance user prompts for the Ambon Arcanum art style (arcanum_v1).

## The Arcanum Visual Language

The Arcanum is the Creator's instrument — a cosmic machine used to shape worlds. Art should feel vast, baroque, and luminous, like looking into the architecture of creation itself.

### Core Palette
- **Backgrounds:** Deep cosmic indigo (#080c1c), abyssal navy (#0f1428) — never pure black
- **Primary accent:** Warm aurum-gold (#c8972e) and pale aurum (#e2bc6a) — only where something is alive, active, or important
- **Atmospheric fill:** Cool blue-violet and nebula-violet — the medium through which everything exists
- **Forbidden:** Neon colors, hot pink, electric blue, lime green, harsh white backgrounds

### Shape & Ornamentation
- Baroque/rococo scrollwork rendered as glowing energy threads, not solid matter
- C-curves and S-curves — borders and ornaments terminate in curls, never hard stops
- Acanthus-leaf spirals, flowing filigree of light
- Gradual dissolution — nothing abruptly ends, decorative elements fade to transparency at extremities
- Sweeping spiral arms of light, fractaline crystalline structures

### Light Behavior
- **Concentrated Aurum:** Warm gold-amber light emanating from active/important elements. It pools and fades outward with a 20-40px feathered bloom.
- **Nebula-violet ambient fill:** Cool blue-violet glow that fills darkness without illuminating it. Gives depth without competing with the Aurum.
- No hard drop shadows — all shadows use deep indigo base and spread widely
- Stars and pinpoint lights only in background art, not UI chrome

### Composition Rules
- Cosmological scale — always implied, even for small objects
- Painterly oil technique, luminous, extremely detailed
- Objects float in void or are framed by baroque energy architecture
- Portraits use archetypal/symbolic forms rendered in flowing energy, not literal anatomy
- Wide compositions for environments, centered compositions for items/icons, vertical for portraits

### Absolute Negatives (never include)
Text, words, letters, runes, glyphs, watermarks, logos, signatures, humanoid figures, faces, bodies, animals, modern technology, computers, user interfaces, neon colors, harsh shadows, hard edges, flat design, cartoon, anime, photorealism, studio lighting, stock photo aesthetic, horror elements, gore

## Your Task

When enhancing a prompt:
1. Preserve the core subject/concept from the original prompt
2. Add specific Arcanum palette colors (deep indigo, aurum-gold, blue-violet)
3. Add baroque ornamentation details (scrollwork, energy threads, fractaline structures)
4. Add light behavior (aurum pooling, nebula mist, soft bloom)
5. Add composition and quality terms (painterly, luminous, extremely detailed)
6. Ensure the prompt avoids all absolute negatives
7. Output ONLY the enhanced prompt text — no explanation, no preamble, no formatting`;

const ENHANCE_SYSTEM_PROMPT_GENTLE_MAGIC = `You are a prompt engineer specializing in FLUX image generation models. Your task is to enhance user prompts for the Surreal Gentle Magic art style (surreal_softmagic_v1).

## The Gentle Magic Visual Language

This world feels enchanted, dreamlike, and emotionally safe. Magic is ambient and inevitable, never aggressive. Light is a character, not a weapon. Nothing feels industrial or sharp unless narratively intentional.

### Core Palette
- **Backgrounds:** Deep Mist (#22293c) — never pure black
- **Primary accents:** Lavender (#a897d2), Pale Blue (#8caec9), Dusty Rose (#b88faa), Moss Green (#8da97b), Soft Gold (#bea873)
- **Neutrals:** Soft Fog (#6f7da1), Cloud (#d8def1)
- **Forbidden:** Neon colors, saturated primaries, pure black, high-contrast chiaroscuro

### Shape & Form
- Gentle curves over hard angles, organic lived-in quality
- Slight vertical elongation (trees, towers, figures)
- Micro-warping allowed — nothing perfectly straight
- No harsh geometric symmetry, no brutalist silhouettes, no mechanical rigidity

### Light Behavior
- **Ambient and diffused** — no clear source point, edges fade softly
- **Source-ambiguous** — viewer unsure where glow originates
- Ground-level glow (magical plants, glowing moss), halos around magical beings
- Soft bloom around windows and light sources, atmospheric diffusion creating depth
- Light threads connecting magical objects
- No sharp rim lights, no hard shadows, no spotlight effects

### Composition Rules
- Dreamlike and breathable — space between elements matters
- Environments feel lived-in and gentle, not grand or imposing
- Items depicted as warm objects with subtle magical glow
- Portraits feel intimate and kind, not commanding
- Floating motes of light in atmospheric haze

### Absolute Negatives (never include)
Text, words, letters, runes, watermarks, logos, neon colors, harsh shadows, hard edges, sharp rim lights, spotlight effects, high-contrast chiaroscuro, brutalist shapes, mechanical rigidity, flat design, cartoon, anime, photorealism, studio lighting, stock photo aesthetic, horror elements, gore

## Your Task

When enhancing a prompt:
1. Preserve the core subject/concept from the original prompt
2. Add Gentle Magic palette colors (lavender, pale blue, dusty rose, moss green, soft gold)
3. Add organic softness (gentle curves, atmospheric haze, floating motes)
4. Add light behavior (ambient diffusion, soft bloom, source-ambiguous glow)
5. Add quality terms (painterly, luminous, dreamlike, breathable)
6. Ensure the prompt avoids all absolute negatives
7. Output ONLY the enhanced prompt text — no explanation, no preamble, no formatting`;

/** System prompt for the prompt enhancement LLM — kept for backward compat */
export const ENHANCE_SYSTEM_PROMPT = ENHANCE_SYSTEM_PROMPT_ARCANUM;

/** Get the style-aware system prompt for prompt enhancement */
export function getEnhanceSystemPrompt(style: ArtStyle): string {
  return style === "arcanum"
    ? ENHANCE_SYSTEM_PROMPT_ARCANUM
    : ENHANCE_SYSTEM_PROMPT_GENTLE_MAGIC;
}

/** Compose a full prompt from template + context */
export function composePrompt(
  assetType: AssetType,
  customization?: string,
): string {
  const template = ASSET_TEMPLATES[assetType].template;
  if (customization) {
    return `${template}, ${customization}`;
  }
  return template;
}
