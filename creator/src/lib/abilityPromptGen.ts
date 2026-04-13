import { invoke } from "@tauri-apps/api/core";
import { getStyleSuffix, parseLlmJson } from "./arcanumPrompts";
import { buildToneDirective } from "./loreGeneration";
import type { AbilityDefinitionConfig, StatusEffectDefinitionConfig } from "@/types/config";
import { AI_ENABLED } from "@/lib/featureFlags";

const FORMAT_SPEC =
  "1:1 square ability icon centered in frame, symbolic/iconic representation, solid pale lavender (#d8d0e8) background";

// ─── Class color palettes ────────────────────────────────────────────

const CLASS_PALETTES: Record<string, string> = {
  BULWARK: "warm golds (#bea873), amber, burnished bronze — stalwart shields, fortified barriers, golden radiance",
  WARDEN: "terracotta (#c4956a), warm earth tones, burnt sienna — natural protection, earthen strength, organic resilience",
  ARCANIST: "soft lavender (#a897d2), pale violet, crystalline whites — arcane geometry, shimmering runes, ethereal energy",
  FAEWEAVER: "moss green (#8da97b), verdant emerald, living wood — woven vines, sprouting magic, natural enchantment",
  NECROMANCER: "ghostly sage (#7a8a6e), pallid green-gray, spectral mist — soul wisps, bone motifs, deathly stillness",
  VEIL: "deep purple (#6e5a8a), midnight indigo, smoky shadow — hidden daggers, dissipating smoke, void rifts",
  BINDER: "amber-gold (#bea873), warm chain-links, luminous sigils — binding circles, golden chains, sealing runes",
  STORMBLADE: "pale blue (#8caec9), silver-white, electric frost — crackling arcs, frozen edges, storm winds",
  HERALD: "warm ivory-gold (#d4c8a0), soft radiance, sacred light — holy symbols, healing auras, divine warmth",
  STARWEAVER: "dusty rose (#b88faa), cosmic pink, starlight silver — celestial patterns, constellation threads, astral shimmer",
};

/** Get the palette description for a class key (case-insensitive match). */
function getClassPalette(classId: string | undefined): string {
  if (!classId) return "neutral fantasy tones, soft whites and pale blues";
  return CLASS_PALETTES[classId.toUpperCase()] ?? CLASS_PALETTES[classId] ?? `colors appropriate for ${classId}`;
}

// ─── Prompt generation system prompt ─────────────────────────────────

function getAbilitySystemPrompt(): string {
  const tone = buildToneDirective();
  const toneBlock = tone ? `\n\nWorld context: ${tone}` : "";
  return `You are an expert image prompt engineer for AI image generators. You create prompts for fantasy RPG ability/spell/status-effect icons in the Surreal Gentle Magic design system.${toneBlock}

Your task: given a game ability or status effect definition, create an image generation prompt for a symbolic icon. The icon should:
- Be a single centered symbolic/iconic illustration (NOT a scene, NOT a character portrait)
- Visually represent the ability's effect and flavor through symbolic imagery
- Use color cues matching the ability's class. Each class has a distinct color identity:
  - BULWARK: warm golds (#bea873), amber, burnished bronze — stalwart shields, fortified barriers, golden radiance
  - WARDEN: terracotta (#c4956a), warm earth tones, burnt sienna — natural protection, earthen strength, organic resilience
  - ARCANIST: soft lavender (#a897d2), pale violet, crystalline whites — arcane geometry, shimmering runes, ethereal energy
  - FAEWEAVER: moss green (#8da97b), verdant emerald, living wood — woven vines, sprouting magic, natural enchantment
  - NECROMANCER: ghostly sage (#7a8a6e), pallid green-gray, spectral mist — soul wisps, bone motifs, deathly stillness
  - VEIL: deep purple (#6e5a8a), midnight indigo, smoky shadow — hidden daggers, dissipating smoke, void rifts
  - BINDER: amber-gold (#bea873), warm chain-links, luminous sigils — binding circles, golden chains, sealing runes
  - STORMBLADE: pale blue (#8caec9), silver-white, electric frost — crackling arcs, frozen edges, storm winds
  - HERALD: warm ivory-gold (#d4c8a0), soft radiance, sacred light — holy symbols, healing auras, divine warmth
  - STARWEAVER: dusty rose (#b88faa), cosmic pink, starlight silver — celestial patterns, constellation threads, astral shimmer
- Effect type modifiers (combine with the class palette above):
  - Healing/regeneration: warm golden-white light, green life energy
  - Shields/protection: translucent barriers, dome shapes, soft glowing edges
  - Damage-over-time: smoldering embers, dripping venom, crackling energy
  - Stun/crowd-control: stars, shattered glass, frozen shards
  - Buffs: ascending arrows, radiant auras, empowering glows
  - Debuffs: descending spirals, dark mists, weakening auras
  - Area effects: radiating rings, expanding waves, ground sigils
  - Taunt/threat: blazing eye motifs, roaring silhouettes, magnetic pull
- Combine the class palette with the effect modifier — e.g., a Faeweaver heal uses living greens with golden-white life energy; a Veil damage-over-time uses deep indigos with smoldering shadow embers
- For abilities without a class, default to the effect type modifier colors above
- Status effects use moss green (#8da97b) as their base palette, with secondary colors reflecting the effect type
- AVOID depicting full characters, hands, or faces — keep it iconic and symbolic
- The icon should read clearly at small sizes (256x256)

Output ONLY the prompt text — no labels, no markdown, no commentary.`;
}

// ─── Single-ability prompt generation ────────────────────────────────

/**
 * Generate an image prompt for an ability/spell icon.
 */
export async function generateAbilityPrompt(
  ability: AbilityDefinitionConfig,
  _abilityId: string,
): Promise<string> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const userContent = `Format: ${FORMAT_SPEC}

Ability: ${ability.displayName}
${ability.description ? `Description: ${ability.description}` : ""}
${ability.requiredClass ? `Class: ${ability.requiredClass}` : ""}
Target: ${ability.targetType}
Effect type: ${ability.effect.type}
Level: ${ability.levelRequired}

Required style suffix (include verbatim at the end):
${getStyleSuffix("worldbuilding")}`;

  return invoke<string>("llm_complete", {
    systemPrompt: getAbilitySystemPrompt(),
    userPrompt: userContent,
  });
}

/**
 * Generate an image prompt for a status effect icon.
 */
export async function generateStatusEffectPrompt(
  effect: StatusEffectDefinitionConfig,
  _effectId: string,
): Promise<string> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const details = [
    `Effect type: ${effect.effectType}`,
    effect.durationMs ? `Duration: ${(effect.durationMs / 1000).toFixed(0)}s` : null,
    effect.shieldAmount ? `Shield amount: ${effect.shieldAmount}` : null,
    effect.tickMinValue != null ? `Tick damage/heal: ${effect.tickMinValue}-${effect.tickMaxValue}` : null,
    effect.stackBehavior ? `Stacking: ${effect.stackBehavior}` : null,
  ].filter(Boolean).join("\n");

  const userContent = `Format: ${FORMAT_SPEC}

Status Effect: ${effect.displayName}
${details}

Required style suffix (include verbatim at the end):
${getStyleSuffix("worldbuilding")}`;

  return invoke<string>("llm_complete", {
    systemPrompt: getAbilitySystemPrompt(),
    userPrompt: userContent,
  });
}

// ─── Template-based generation ───────────────────────────────────────

export interface AbilityPromptTemplate {
  template: string;
  effectTypeDescriptions: Record<string, string>;
  classIconStyles: Record<string, string>;
  generatedAt: string;
}

/**
 * Generate an ability icon template with a single LLM call.
 * Returns a template string with placeholders plus per-effect-type and per-class
 * icon style descriptions for filling.
 */
export async function generateAbilityTemplate(
  classes: string[],
  effectTypes: string[],
): Promise<AbilityPromptTemplate> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const classList = classes
    .map((c) => `- ${c}: ${getClassPalette(c)}`)
    .join("\n");

  const effectList = effectTypes
    .map((e) => `- ${e}`)
    .join("\n");

  const systemPrompt = `You are an expert image prompt engineer for AI image generators. You create prompts for fantasy RPG ability icons in the Surreal Gentle Magic aesthetic.

Your task: produce a JSON object with these fields:

1. "template" — a single image generation prompt template using these exact placeholders: {ability_name}, {ability_description}, {class_style}, {effect_visual}. The template should produce a symbolic ability icon. Icons should be single centered symbolic illustrations, NOT scenes, NOT character portraits. They must read clearly at 256x256.

2. "classIconStyles" — an object mapping each class key to a prompt-fragment describing that class's visual color palette and iconographic motifs for ability icons. Include a "general" key for classless abilities.

3. "effectTypeDescriptions" — an object mapping each effect type key to a prompt-fragment describing the visual treatment for that effect type (shapes, energy patterns, colors).

The template, when its placeholders are filled with the fragments above, should be a complete image generation prompt. Do NOT include the style suffix — it will be appended automatically.

Output ONLY valid JSON — no markdown fences, no commentary.`;

  const userPrompt = `Format: ${FORMAT_SPEC}

Classes:
${classList}

Effect types:
${effectList}`;

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
  });

  const parsed = parseLlmJson<{
    template?: string;
    effectTypeDescriptions?: Record<string, string>;
    classIconStyles?: Record<string, string>;
  }>(response, "ability-template-gen");

  if (!parsed.template || !parsed.effectTypeDescriptions || !parsed.classIconStyles) {
    throw new Error("Invalid template response: missing required fields (template, effectTypeDescriptions, classIconStyles)");
  }

  return {
    template: parsed.template,
    effectTypeDescriptions: parsed.effectTypeDescriptions,
    classIconStyles: parsed.classIconStyles,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Fill an ability template for a specific ability. Pure string substitution, no API call.
 */
export function fillAbilityTemplate(
  template: AbilityPromptTemplate,
  ability: AbilityDefinitionConfig,
): string {
  const classKey = ability.requiredClass || ability.classRestriction || "general";
  const classStyle = template.classIconStyles[classKey]
    ?? template.classIconStyles["general"]
    ?? getClassPalette(classKey);
  const effectVisual = template.effectTypeDescriptions[ability.effect.type]
    ?? `${ability.effect.type} energy`;

  const prompt = template.template
    .replace(/\{ability_name\}/g, ability.displayName)
    .replace(/\{ability_description\}/g, ability.description || ability.displayName)
    .replace(/\{class_style\}/g, classStyle)
    .replace(/\{effect_visual\}/g, effectVisual);

  return `${prompt}\n\n${getStyleSuffix("worldbuilding")}`;
}

/**
 * Fill a status effect template. Uses the ability template with status-effect-appropriate defaults.
 */
export function fillStatusEffectTemplate(
  template: AbilityPromptTemplate,
  effect: StatusEffectDefinitionConfig,
): string {
  const classStyle = template.classIconStyles["general"]
    ?? "moss green (#8da97b) palette, subtle glowing edges";
  const effectVisual = template.effectTypeDescriptions[effect.effectType]
    ?? `${effect.effectType} aura`;

  const prompt = template.template
    .replace(/\{ability_name\}/g, effect.displayName)
    .replace(/\{ability_description\}/g, effect.displayName)
    .replace(/\{class_style\}/g, classStyle)
    .replace(/\{effect_visual\}/g, effectVisual);

  return `${prompt}\n\n${getStyleSuffix("worldbuilding")}`;
}

// ─── Per-ability LLM enhancement ─────────────────────────────────────

/**
 * Refine an assembled ability icon prompt via LLM for better image generation results.
 * Falls back to the original prompt if the LLM call fails.
 */
export async function enhanceAbilityPrompt(rawPrompt: string): Promise<string> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const tone = buildToneDirective();
  const toneRule = tone ? `\n- Match the world's tone: ${tone}` : "";

  const systemPrompt = `You are an expert AI image prompt engineer. You receive a draft image generation prompt for a fantasy RPG ability icon and refine it into a stronger, more cohesive prompt.

Rules:
- Preserve ALL visual details from the original (color palette, effect type visuals, symbolic imagery)
- Tighten wording: remove redundancy, merge overlapping phrases, sharpen visual language
- Ensure the icon is SYMBOLIC — no characters, no hands, no faces
- Keep the icon readable at small sizes (256x256)
- Keep the solid pale lavender (#d8d0e8) background specification${toneRule}
- Do NOT add the style suffix — it will be appended automatically
- Output ONLY the refined prompt text — no quotes, no explanation, no preamble`;

  try {
    const enhanced = await invoke<string>("llm_complete", {
      systemPrompt,
      userPrompt: `Refine this ability icon generation prompt:\n\n${rawPrompt}`,
    });
    return `${enhanced.trim()}\n\n${getStyleSuffix("worldbuilding")}`;
  } catch {
    return rawPrompt;
  }
}
