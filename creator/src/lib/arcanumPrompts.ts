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
export const UNIVERSAL_NEGATIVE = `text, words, letters, runes, glyphs, watermarks, logos, signatures, modern technology, computers, user interfaces, neon colors, hot pink, electric blue, lime green, harsh shadows, hard edges, flat design, cartoon, anime, photorealism, studio lighting, stock photo aesthetic, horror elements, gore, nudity, nude, naked, bare chest, exposed breasts, cleavage, nsfw, topless, revealing, skimpy, sexualized`;

/** Get the preamble for a given art style */
export function getPreamble(style: ArtStyle): string {
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
  player_sprite: {
    label: "Player Sprite",
    templates: {
      arcanum: `A heroic fantasy character portrait against deep cosmic indigo void — the character stands in a confident adventuring pose, rendered with faithful anatomy and detailed equipment appropriate to their class and level, baroque aurum-gold energy scrollwork frames the figure as an ornate portrait border, warm golden light illuminates the character from a central point creating soft bloom, cool blue-violet atmospheric fill provides depth, the character's race and gender are clearly depicted with distinct physical features, equipment quality and ornamentation reflects their power tier, centered square portrait composition, painterly, luminous, extremely detailed, heroic`,
      gentle_magic: `A fantasy character portrait in a gentle enchanted setting — the character stands in a natural adventuring pose, rendered with faithful anatomy and detailed equipment appropriate to their class and level, soft ambient light in lavender and pale blue creates a dreamlike atmosphere, the character's race and gender are clearly depicted with warm approachable features, equipment has a handcrafted quality with subtle magical glow, floating motes of light and gentle atmospheric haze surround the figure, small organic details like moss or tiny flowers at their feet, centered square portrait composition, painterly, luminous, dreamlike, characterful`,
    },
  },
  race_portrait: {
    label: "Race Portrait",
    templates: {
      arcanum: `A full-body concept art portrait of a fantasy race representative standing in a dramatic heroic pose against deep cosmic indigo void, the figure rendered with faithful anatomy showcasing the race's distinctive physical features — build, skin tone, ears, height, musculature — wearing culturally distinct armor or garments that reflect their heritage, baroque aurum-gold energy scrollwork frames the figure as an ornate vertical portrait border, warm golden light illuminates the subject from a central point creating soft bloom on key features, cool blue-violet atmospheric fill provides depth, vertical portrait composition with the full figure visible head to toe, painterly, luminous, extremely detailed, archetypal and iconic`,
      gentle_magic: `A full-body concept art portrait of a fantasy race representative in a natural confident pose within a gentle enchanted setting, the figure rendered with faithful anatomy showcasing the race's distinctive physical features — build, skin tone, ears, height, musculature — wearing culturally distinct clothing that reflects their heritage and traditions, soft ambient light in lavender and pale blue creates a dreamlike atmosphere around the figure, small organic details like floating motes of light and gentle atmospheric haze frame the composition, the character feels approachable and dignified, vertical portrait composition with the full figure visible head to toe, painterly, luminous, dreamlike, characterful and iconic`,
    },
  },
  item: {
    label: "Item / Object",
    templates: {
      arcanum: `A single fantastical object floating against deep cosmic indigo void — the item rendered in fine detail with realistic materials and textures lit by concentrated aurum-gold light that pools and blooms around its form, baroque energy scrollwork curling subtly around the object as ornamental framing that dissolves into darkness at the edges, cool blue-violet atmospheric glow providing depth behind, the object casts no harsh shadow but sits within a soft halo of warm golden luminescence, centered square composition like a game inventory icon, painterly, luminous, extremely detailed, precious and significant`,
      gentle_magic: `A single fantastical object resting on a soft surface against deep mist-blue background — the item rendered with warm realistic detail and gentle ambient lighting, a subtle magical glow emanates from within in lavender or soft gold, small details suggest enchantment — faint light motes rising from the surface, a shimmer along an edge, tiny flowers or moss growing where the object meets the ground, soft diffused bloom around the brightest points, no harsh shadows, centered square composition like a game inventory icon, painterly, luminous, dreamlike, the object feels precious and handcrafted`,
    },
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
Text, words, letters, runes, glyphs, watermarks, logos, signatures, modern technology, computers, user interfaces, neon colors, harsh shadows, hard edges, flat design, cartoon, anime, photorealism, studio lighting, stock photo aesthetic, horror elements, gore

### Entity Portraits (exception to abstract style)
When the prompt describes a specific character, creature, or NPC, you MUST depict them faithfully based on their description. Use literal anatomy and appearance — do NOT reduce characters to abstract energy forms or symbolic shapes. A mob/NPC described as a woman should look like a woman. A goblin should look like a goblin. Apply the Arcanum palette and lighting to their actual physical form. Baroque ornamentation should frame or accent the character, not replace them.

## Your Task

When enhancing a prompt:
1. Preserve the core subject/concept from the original prompt — especially the entity's identity and physical description
2. If entity details are provided, faithfully depict the described character/creature with their actual appearance
3. Add specific Arcanum palette colors (deep indigo, aurum-gold, blue-violet)
4. Add baroque ornamentation details (scrollwork, energy threads, fractaline structures) as framing/accents
5. Add light behavior (aurum pooling, nebula mist, soft bloom)
6. Add composition and quality terms (painterly, luminous, extremely detailed)
7. Ensure the prompt avoids all absolute negatives
8. Output ONLY the enhanced prompt text — no explanation, no preamble, no formatting`;

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

### Entity Portraits (exception to abstract style)
When the prompt describes a specific character, creature, or NPC, you MUST depict them faithfully based on their description. Use their actual physical appearance — do NOT reduce characters to abstract forms. A mob/NPC described as a woman should look like a woman. A goblin should look like a goblin. Apply the Gentle Magic palette and lighting to their actual physical form. The dreamlike quality should enhance the character, not replace them.

## Your Task

When enhancing a prompt:
1. Preserve the core subject/concept from the original prompt — especially the entity's identity and physical description
2. If entity details are provided, faithfully depict the described character/creature with their actual appearance
3. Add Gentle Magic palette colors (lavender, pale blue, dusty rose, moss green, soft gold)
4. Add organic softness (gentle curves, atmospheric haze, floating motes)
5. Add light behavior (ambient diffusion, soft bloom, source-ambiguous glow)
6. Add quality terms (painterly, luminous, dreamlike, breathable)
7. Ensure the prompt avoids all absolute negatives
8. Output ONLY the enhanced prompt text — no explanation, no preamble, no formatting`;

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
  style: ArtStyle = "arcanum",
  customization?: string,
): string {
  const template = ASSET_TEMPLATES[assetType].templates[style];
  if (customization) {
    return `${template}, ${customization}`;
  }
  return template;
}
