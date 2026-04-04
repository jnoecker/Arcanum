import { invoke } from "@tauri-apps/api/core";
import { STYLE_SUFFIX, parseLlmJson } from "./arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";
import {
  DEFAULT_RACE_BODY_DESCRIPTIONS,
  DEFAULT_CLASS_OUTFIT_DESCRIPTIONS,
  DEFAULT_TIER_DEFINITIONS,
  DEFAULT_STAFF_RACE_PROMPTS,
} from "./defaultSpriteData";
import type { TierDefinitionConfig } from "@/types/config";

const FORMAT_SPEC =
  "1:1 square character portrait, full body front-facing neutral standing pose, centered on 512x512 canvas, head to feet visible with padding, solid pale lavender (#d8d0e8) background, character sheet even lighting from front";

const FALLBACK_TEMPLATE =
  `${FORMAT_SPEC}. {race_description}, wearing {class_outfit}, presenting {tier_visual}, ` +
  "androgynous fantasy adventurer, full body visible, front-facing neutral standing pose, centered composition, readable silhouette, clean separation from the pale lavender background";

// ─── Types ───────────────────────────────────────────────────────────

export interface SpriteDimensions {
  race: string;
  playerClass: string;
  tier: string;
}

export interface SpritePromptTemplate {
  template: string;
  tierDescriptions: Record<string, string>;
  raceDescriptions: Record<string, string>;
  classOutfits: Record<string, string>;
  generatedAt: string;
}

function fallbackSpriteTemplate(): SpritePromptTemplate {
  const tierDefinitions = getTierDefinitions();
  const tierDescriptions = Object.fromEntries(
    Object.entries(tierDefinitions).map(([key, value]) => [key, value.visualDescription]),
  );

  return {
    template: FALLBACK_TEMPLATE,
    tierDescriptions,
    raceDescriptions: { ...DEFAULT_RACE_BODY_DESCRIPTIONS },
    classOutfits: { ...DEFAULT_CLASS_OUTFIT_DESCRIPTIONS },
    generatedAt: "fallback",
  };
}

// ─── Data resolution ─────────────────────────────────────────────────

/** Get the body description for a race — config > fallback constant > race key */
export function getRaceBodyDescription(race: string): string {
  const config = useConfigStore.getState().config;
  return config?.races[race]?.bodyDescription
    ?? DEFAULT_RACE_BODY_DESCRIPTIONS[race]
    ?? race;
}

/** Get the outfit description for a class — config > fallback constant > class key */
export function getClassOutfitDescription(cls: string): string {
  const config = useConfigStore.getState().config;
  return config?.classes[cls]?.outfitDescription
    ?? DEFAULT_CLASS_OUTFIT_DESCRIPTIONS[cls]
    ?? cls;
}

/** Get the tier visual description — config > fallback constant > tier key */
export function getTierVisualDescription(tier: string): string {
  const config = useConfigStore.getState().config;
  const configTiers = config?.playerTiers;
  return configTiers?.[tier]?.visualDescription
    ?? DEFAULT_TIER_DEFINITIONS[tier]?.visualDescription
    ?? tier;
}

/** Get the tier definitions — derived from spriteLevelTiers breakpoints, enriched by playerTiers/defaults. */
export function getTierDefinitions(): Record<string, TierDefinitionConfig> {
  const config = useConfigStore.getState().config;
  if (!config) return DEFAULT_TIER_DEFINITIONS;

  const breakpoints = [...config.images.spriteLevelTiers].sort((a, b) => a - b);
  const result: Record<string, TierDefinitionConfig> = {};
  for (const level of breakpoints) {
    const key = `t${level}`;
    const nextLevel = breakpoints[breakpoints.indexOf(level) + 1];
    result[key] = config.playerTiers?.[key]
      ?? DEFAULT_TIER_DEFINITIONS[key]
      ?? { displayName: `Tier ${level}`, levels: nextLevel ? `${level}–${nextLevel - 1}` : `${level}`, visualDescription: "" };
  }
  result.tstaff = config.playerTiers?.tstaff
    ?? DEFAULT_TIER_DEFINITIONS.tstaff
    ?? { displayName: "Staff", levels: "—", visualDescription: "Game administrator." };
  return result;
}

/** Get the staff prompt override for a race — config > fallback constant > null */
export function getStaffPrompt(race: string): string | undefined {
  const config = useConfigStore.getState().config;
  return config?.races[race]?.staffPrompt
    ?? DEFAULT_STAFF_RACE_PROMPTS[race]
    ?? undefined;
}

// ─── Template generation ─────────────────────────────────────────────

/**
 * Generate a sprite prompt template with a single LLM call.
 * Returns a template string with {race_description}, {class_outfit}, {tier_visual} placeholders,
 * plus per-race, per-class, and per-tier description strings.
 */
export async function generateSpriteTemplate(
  races: string[],
  classes: string[],
  tiers: string[],
  zoneVibe: string,
): Promise<SpritePromptTemplate> {
  const raceList = races
    .map((r) => `- ${r}: ${getRaceBodyDescription(r)}`)
    .join("\n");

  const classList = classes
    .filter((c) => c !== "base")
    .map((c) => `- ${c}: ${getClassOutfitDescription(c)}`)
    .join("\n");

  const tierList = tiers
    .map((t) => `- ${t}: ${getTierVisualDescription(t)}`)
    .join("\n");

  const systemPrompt = `You are an expert image prompt engineer for AI image generators. You create prompts for fantasy RPG character sprites in the Surreal Gentle Magic aesthetic.

Your task: produce a JSON object with these fields:

1. "template" — a single image generation prompt template using these exact placeholders: {race_description}, {class_outfit}, {tier_visual}. The template should produce a fantasy character portrait. All figures must be ANDROGYNOUS — no gender signifiers (no breasts, no beards, no gendered body shapes). The body is defined entirely by the race, the outfit by the class, and the power level by the tier.

For the "base" class (staff tier), {class_outfit} will be "simple wrapped linen clothing, no armor, no weapons" — the template must work with this too.

2. "raceDescriptions" — an object mapping each race key to an optimized prompt-fragment describing that race's body. Lean into the alien/fantastical aspects. All descriptions must be androgynous. For humanoid races (archae, kitsarae, lustriae), explicitly describe narrow shoulders, no chest definition, smooth featureless torso, ageless angular face.

3. "classOutfits" — an object mapping each class key to a prompt-fragment describing that class's signature outfit, weapons, and accessories. Include "base" as a key with simple wrapped linen clothing (used for staff sprites).

4. "tierDescriptions" — an object mapping each tier key (t1, t10, t25, t50, tstaff) to a prompt-fragment describing the power level, material quality, and magical effects appropriate for that tier.

The template, when its placeholders are filled with the fragments above, should be a complete image generation prompt. Do NOT include the style suffix — it will be appended automatically.

Output ONLY valid JSON — no markdown fences, no commentary.`;

  const userPrompt = `Format: ${FORMAT_SPEC}

Races:
${raceList}

Classes:
- base: simple wrapped linen clothing, no armor, no weapons, new arrival
${classList}

Tier progression:
${tierList}

Zone atmosphere: ${zoneVibe}`;

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
  });

  const parsed = parseLlmJson<{
    template?: string;
    tierDescriptions?: Record<string, string>;
    raceDescriptions?: Record<string, string>;
    classOutfits?: Record<string, string>;
  }>(response, "sprite-prompt-gen");
  if (!parsed.template || !parsed.tierDescriptions || !parsed.raceDescriptions || !parsed.classOutfits) {
    throw new Error("Invalid template response: missing required fields (template, raceDescriptions, classOutfits, tierDescriptions)");
  }

  return {
    template: parsed.template,
    tierDescriptions: parsed.tierDescriptions,
    raceDescriptions: parsed.raceDescriptions,
    classOutfits: parsed.classOutfits,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Template filling ────────────────────────────────────────────────

/**
 * Fill a sprite template for a specific race/class/tier. Pure string substitution, no API call.
 */
export function fillSpriteTemplate(
  template: SpritePromptTemplate,
  dimensions: SpriteDimensions,
): string {
  return `${resolveSpritePromptBody(template, dimensions)}\n\n${STYLE_SUFFIX}`;
}

function resolveSpritePromptBody(
  template: SpritePromptTemplate,
  dimensions: SpriteDimensions,
): string {
  // Staff tier uses unique per-race god-tier prompts, bypassing the template entirely.
  if (dimensions.tier === "tstaff") {
    const staffPrompt = getStaffPrompt(dimensions.race);
    if (staffPrompt) {
      return `${FORMAT_SPEC}. ${staffPrompt}`;
    }
  }

  // Canonical race descriptions always win — they're curated,
  // while Claude's template versions may drift or soften the descriptions.
  const raceDesc = getRaceBodyDescription(dimensions.race)
    || template.raceDescriptions[dimensions.race]
    || dimensions.race;

  // Canonical class outfits always win for the same reason.
  const classOutfit = (dimensions.playerClass === "base"
    ? template.classOutfits["base"]
    : getClassOutfitDescription(dimensions.playerClass))
    || template.classOutfits[dimensions.playerClass]
    || "simple wrapped linen clothing";

  const tierVisual = template.tierDescriptions[dimensions.tier]
    || getTierVisualDescription(dimensions.tier)
    || "adventurer";

  const prompt = template.template
    .replace(/\{race\}/g, dimensions.race)
    .replace(/\{race_description\}/g, raceDesc)
    .replace(/\{class\}/g, dimensions.playerClass)
    .replace(/\{class_outfit\}/g, classOutfit)
    .replace(/\{tier\}/g, dimensions.tier)
    .replace(/\{tier_visual\}/g, tierVisual);

  return prompt;
}

export function buildSpritePrompt(
  dimensions: SpriteDimensions,
  template?: SpritePromptTemplate | null,
  extraContext?: string,
): string {
  const resolvedTemplate = template ?? fallbackSpriteTemplate();
  const promptBody = resolveSpritePromptBody(resolvedTemplate, dimensions);
  const context = extraContext?.trim();

  return context
    ? `${promptBody}. ${context}\n\n${STYLE_SUFFIX}`
    : `${promptBody}\n\n${STYLE_SUFFIX}`;
}
