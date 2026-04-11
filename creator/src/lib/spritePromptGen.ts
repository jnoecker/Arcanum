import { invoke } from "@tauri-apps/api/core";
import { getStyleSuffix, parseLlmJson } from "./arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";
import { buildToneDirective, buildVisualStyleDirective } from "./loreGeneration";
import {
  DEFAULT_RACE_BODY_DESCRIPTIONS,
  DEFAULT_CLASS_OUTFIT_DESCRIPTIONS,
} from "./defaultSpriteData";

// Fallback art-direction when the world has no visualStyle defined.
// Kept lean — we never want project-specific aesthetic baked into code —
// but dense enough to stop FLUX drifting into its default painterly
// ranger-in-a-forest look on a minimal prompt.
const GENERIC_SPRITE_STYLE_FALLBACK =
  "Digital fantasy character illustration, painterly with clear readable silhouette, consistent world aesthetic. NOT a photograph, NOT a 3D render, NOT concept art.";

// ─── Types ───────────────────────────────────────────────────────────

export interface SpriteDimensions {
  race?: string;
  playerClass?: string;
  gender?: string;
}

export interface SpritePromptTemplate {
  raceDescriptions: Record<string, string>;
  classOutfits: Record<string, string>;
  generatedAt: string;
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

// ─── Prompt assembly ─────────────────────────────────────────────────

function resolveRaceFragment(
  race: string,
  template: SpritePromptTemplate | null,
): string {
  if (template?.raceDescriptions[race]) return `${race}, ${template.raceDescriptions[race]}`;
  return race;
}

function resolveClassFragment(
  cls: string,
  template: SpritePromptTemplate | null,
): string {
  if (template?.classOutfits[cls]) return template.classOutfits[cls];
  return cls;
}

export function buildSpritePrompt(
  dimensions: SpriteDimensions,
  template?: SpritePromptTemplate | null,
  extraContext?: string,
): string {
  const subject: string[] = [];

  if (dimensions.gender) subject.push(dimensions.gender);

  if (dimensions.race) {
    subject.push(extraContext?.trim()
      ? `${extraContext.trim()} (${dimensions.race})`
      : resolveRaceFragment(dimensions.race, template ?? null));
  } else if (extraContext?.trim()) {
    subject.push(extraContext.trim());
  }

  if (dimensions.playerClass) {
    subject.push(resolveClassFragment(dimensions.playerClass, template ?? null));
  } else {
    subject.push("wearing simple traveler's clothing");
  }

  // Wire world-defined visualStyle and tone into the prompt so sprites
  // respect the same aesthetic as portraits and world art. Without this,
  // FLUX ignores the world and falls back to its generic painterly
  // fantasy default.
  const visualStyle = buildVisualStyleDirective("worldbuilding");
  const toneDirective = buildToneDirective();
  const prefix = visualStyle
    ? `${visualStyle}. NOT a photograph, NOT a 3D render, NOT concept art.`
    : GENERIC_SPRITE_STYLE_FALLBACK;
  const toneLine = toneDirective ? `\n${toneDirective}\n` : "";

  const body = `1:1 square full-body character illustration, centered, clean neutral background. ${subject.join(", ")}`;

  return `${prefix}${toneLine}\n\n${body}\n\n${getStyleSuffix("worldbuilding")}`;
}

export function fillSpriteTemplate(
  template: SpritePromptTemplate,
  dimensions: SpriteDimensions,
): string {
  return buildSpritePrompt(dimensions, template);
}

// ─── Template generation ─────────────────────────────────────────────

export async function generateSpriteTemplate(
  races: string[],
  classes: string[],
  zoneVibe: string,
): Promise<SpritePromptTemplate> {
  const raceList = races
    .map((r) => `- ${r}: ${getRaceBodyDescription(r)}`)
    .join("\n");

  const classList = classes
    .filter((c) => c !== "base")
    .map((c) => `- ${c}: ${getClassOutfitDescription(c)}`)
    .join("\n");

  const toneDirective = buildToneDirective();
  const toneBlock = toneDirective
    ? `\n\nWorld context: ${toneDirective}\nDescriptions must match this tone.`
    : "";

  const systemPrompt = `You write short character descriptions for AI image generation. Keep each description to one concise phrase — just enough to identify the race or class visually. No prose, no storytelling.${toneBlock}

Produce a JSON object with two fields:

1. "raceDescriptions" — map each race key to a SHORT phrase describing physical appearance only (body type, skin, features). 10 words max. Only describe what makes this race visually distinct. For common races like "human", just use the race name.

2. "classOutfits" — map each class key to a SHORT phrase describing outfit and weapon. 10 words max. Just the gear, not the character.

Output ONLY valid JSON.`;

  const userPrompt = `Races:
${raceList}

Classes:
${classList}

Setting: ${zoneVibe}`;

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
  });

  const parsed = parseLlmJson<{
    raceDescriptions?: Record<string, string>;
    classOutfits?: Record<string, string>;
  }>(response, "sprite-prompt-gen");
  if (!parsed.raceDescriptions || !parsed.classOutfits) {
    throw new Error("Invalid template response: missing required fields (raceDescriptions, classOutfits)");
  }

  return {
    raceDescriptions: parsed.raceDescriptions,
    classOutfits: parsed.classOutfits,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Art direction generation ────────────────────────────────────────

export async function generateArtDirection(
  displayName: string,
  race?: string,
  playerClass?: string,
  gender?: string,
): Promise<string> {
  const toneDirective = buildToneDirective();
  const toneBlock = toneDirective
    ? `\nWorld tone: ${toneDirective}\nThe description must match this tone.`
    : "";

  const context: string[] = [`Sprite: ${displayName}`];
  if (gender) context.push(`Gender: ${gender}`);
  if (race) {
    const desc = getRaceBodyDescription(race);
    context.push(desc !== race ? `Race: ${race} — ${desc}` : `Race: ${race}`);
  }
  if (playerClass) {
    const desc = getClassOutfitDescription(playerClass);
    context.push(desc !== playerClass ? `Class: ${playerClass} — ${desc}` : `Class: ${playerClass}`);
  }

  const systemPrompt = `You are an expert visual art director for fantasy RPG character sprites. Given context about a sprite, write a concise visual description that an AI image generator can use to produce a compelling character portrait.${toneBlock}

Rules:
- Focus on visual appearance: body type, clothing, armor, weapons, magical effects, color palette, mood
- Be specific and vivid but concise (2-4 sentences)
- If gender is specified, make it a clear visual characteristic
- Output ONLY the visual description — no quotes, no explanation`;

  const result = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: context.join("\n"),
  });
  return result.trim();
}

