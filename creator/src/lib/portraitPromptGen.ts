import { invoke } from "@tauri-apps/api/core";
import { getStyleSuffix, parseLlmJson } from "./arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";
import { buildToneDirective, buildVisualStyleDirective } from "./loreGeneration";
import { DEFAULT_CLASS_SHOWCASE_RACES } from "./defaultSpriteData";
import { getRaceBodyDescription, getClassOutfitDescription } from "./spritePromptGen";

// ─── Types ───────────────────────────────────────────────────────────

export interface PortraitDimensions {
  portraitType: "race" | "class";
  key: string;
}

export interface PortraitPromptTemplate {
  raceTemplate: string;
  classTemplate: string;
  raceDescriptions: Record<string, string>;
  classOutfits: Record<string, string>;
  generatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const GENERIC_PORTRAIT_STYLE = "Digital fantasy illustration — painterly, detailed, atmospheric. NOT a photograph, NOT a 3D render, NOT concept art.";

const RACE_FORMAT_SPEC =
  "2:3 portrait orientation character portrait. Close-up to mid-shot framing, richly detailed painterly environment background with soft atmospheric depth";

const CLASS_FORMAT_SPEC =
  "2:3 portrait orientation action portrait of a fantasy race character (race varies per class). Mid-shot framing, dynamic or atmospheric pose, richly detailed painterly environment background";

function getPortraitPromptPrefix(): string {
  const vs = buildVisualStyleDirective("worldbuilding");
  if (vs) {
    return `${vs}. NOT a photograph, NOT a 3D render, NOT concept art. 2:3 portrait orientation.`;
  }
  return `${GENERIC_PORTRAIT_STYLE} 2:3 portrait orientation.`;
}

// ─── Data resolution ─────────────────────────────────────────────────

function getShowcaseRace(cls: string): string {
  const config = useConfigStore.getState().config;
  return config?.classes[cls]?.showcaseRace
    ?? DEFAULT_CLASS_SHOWCASE_RACES[cls]
    ?? "archae";
}

// ─── Template generation ─────────────────────────────────────────────

/**
 * Generate a portrait prompt template with a single LLM call.
 * Returns separate templates for race and class portraits.
 */
export async function generatePortraitTemplate(
  races: string[],
  classes: string[],
  zoneVibe: string,
): Promise<PortraitPromptTemplate> {
  const raceList = races
    .map((r) => `- ${r}: ${getRaceBodyDescription(r)}`)
    .join("\n");

  const classList = classes
    .map((c) => `- ${c}: ${getClassOutfitDescription(c)}`)
    .join("\n");

  const toneDirective = buildToneDirective();
  const visualStyle = buildVisualStyleDirective("worldbuilding");
  const toneBlock = toneDirective ? `\nWorld context: ${toneDirective}` : "";
  const styleBlock = visualStyle
    ? `\nWorld visual style: ${visualStyle}\nAll generated imagery must conform to this visual style.`
    : "";

  const systemPrompt = `You are an expert image prompt engineer for AI image generators.${toneBlock}${styleBlock}

These portraits appear on a character creation screen. They should be visually stunning and evocative — selling the fantasy of each race and class. They are 2:3 portrait orientation. NOT photorealistic, NOT a 3D render, NOT concept art.

Your task: produce a JSON object with these fields:

1. "raceTemplate" — a prompt template for RACE portraits using the placeholder {race_description}. The race portrait shows the race in a fitting atmospheric environment. Close-up to mid-shot framing. No class outfit — just the race's natural form.

2. "classTemplate" — a prompt template for CLASS portraits using placeholders {race_description} and {class_outfit}. Class portraits depict a character (race varies — described by {race_description}) wearing the class outfit in an atmospheric scene. Mid-shot framing.

3. "raceDescriptions" — an object mapping each race key to an optimized prompt-fragment for that race's appearance. Base these closely on the provided race descriptions. If a race has only a name (no description), invent an appearance that fits the world's tone.

4. "classOutfits" — an object mapping each class key to a vivid prompt-fragment for the class outfit, weapons, and magical effects at their most impressive (Legendary tier).

${visualStyle ? "IMPORTANT: The templates must include visual details consistent with the world's visual style described above." : "IMPORTANT: The templates should include painterly, atmospheric visual details to steer the image generator toward a high-quality illustrated look."}

Both templates, when filled, should produce complete image generation prompts (without the style suffix — it will be appended automatically).

Output ONLY valid JSON — no markdown fences, no commentary.`;

  const userPrompt = `Race portrait format: ${RACE_FORMAT_SPEC}
Class portrait format: ${CLASS_FORMAT_SPEC}

Races:
${raceList}

Classes:
${classList}

Zone atmosphere: ${zoneVibe}`;

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
  });

  const parsed = parseLlmJson(response, "portrait-prompt-gen");
  if (!parsed.raceTemplate || !parsed.classTemplate || !parsed.raceDescriptions || !parsed.classOutfits) {
    throw new Error("Invalid template response: missing required fields");
  }

  return {
    raceTemplate: parsed.raceTemplate as string,
    classTemplate: parsed.classTemplate as string,
    raceDescriptions: parsed.raceDescriptions as Record<string, string>,
    classOutfits: parsed.classOutfits as Record<string, string>,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Template filling ────────────────────────────────────────────────

/**
 * Fill a portrait template for a specific entity. Pure string substitution, no API call.
 */
export function fillPortraitTemplate(
  template: PortraitPromptTemplate,
  dimensions: PortraitDimensions,
): string {
  if (dimensions.portraitType === "race") {
    const raceDesc = getRaceBodyDescription(dimensions.key)
      || template.raceDescriptions[dimensions.key]
      || dimensions.key;

    const filled = template.raceTemplate
      .replace(/\{race\}/g, dimensions.key)
      .replace(/\{race_description\}/g, raceDesc);

    return `${getPortraitPromptPrefix()}\n\n${filled}\n\n${getStyleSuffix("worldbuilding")}`;
  }

  // Class portrait — uses a curated race for each class to showcase diversity
  const showcaseRace = getShowcaseRace(dimensions.key);
  const raceDesc = getRaceBodyDescription(showcaseRace) || "humanoid adventurer";
  const classOutfit = getClassOutfitDescription(dimensions.key)
    || template.classOutfits[dimensions.key]
    || dimensions.key;

  const filled = template.classTemplate
    .replace(/\{race\}/g, showcaseRace)
    .replace(/\{race_description\}/g, raceDesc)
    .replace(/\{class\}/g, dimensions.key)
    .replace(/\{class_outfit\}/g, classOutfit);

  return `${getPortraitPromptPrefix()}\n\n${filled}\n\n${getStyleSuffix("worldbuilding")}`;
}

/**
 * Build a portrait prompt without an LLM-generated template. Used as the
 * fallback when PortraitStudio opens fresh and there's no cached template.
 *
 * The legacy path (composePrompt with hardcoded arcanum/gentle_magic
 * templates) overrode the world visualStyle because those templates bake
 * their own palette into the positive prompt. This helper wraps a minimal
 * subject description with getPortraitPromptPrefix() and
 * getStyleSuffix("worldbuilding"), so the world's visualStyle (or the
 * generic portrait fallback) is the authoritative aesthetic.
 */
export function buildFallbackPortraitPrompt(dimensions: PortraitDimensions): string {
  const prefix = getPortraitPromptPrefix();
  const suffix = getStyleSuffix("worldbuilding");

  if (dimensions.portraitType === "race") {
    const raceDesc = getRaceBodyDescription(dimensions.key) || dimensions.key;
    const body = `${RACE_FORMAT_SPEC}. Subject: a ${dimensions.key} — ${raceDesc}. The race's natural form, no class outfit.`;
    return `${prefix}\n\n${body}\n\n${suffix}`;
  }

  const showcaseRace = getShowcaseRace(dimensions.key);
  const raceDesc = getRaceBodyDescription(showcaseRace) || "humanoid adventurer";
  const classOutfit = getClassOutfitDescription(dimensions.key) || dimensions.key;
  const body = `${CLASS_FORMAT_SPEC}. Subject: a ${showcaseRace} ${dimensions.key} — ${raceDesc}, ${classOutfit}.`;
  return `${prefix}\n\n${body}\n\n${suffix}`;
}
