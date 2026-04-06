import { invoke } from "@tauri-apps/api/core";
import { STYLE_SUFFIX, parseLlmJson } from "./arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";
import { buildToneDirective } from "./loreGeneration";
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

const PORTRAIT_STYLE_PREAMBLE =
  "Digital fantasy painting in the Surreal Gentle Magic style — dreamy storybook illustration with visible painterly brushwork and soft textured rendering throughout. Soft lavender and pale blue undertones, ambient diffused lighting with NO clear source point, gentle atmospheric haze with floating motes of light. Gentle curves over hard angles, slightly elongated organic forms. FORBIDDEN: photorealism, 3D render look, neon colors, high contrast, harsh edges, sharp shadows, spotlight effects.";

const RACE_FORMAT_SPEC =
  `2:3 portrait orientation character portrait. ${PORTRAIT_STYLE_PREAMBLE} Close-up to mid-shot framing, richly detailed painterly environment background with soft atmospheric depth`;

const CLASS_FORMAT_SPEC =
  `2:3 portrait orientation action portrait of a fantasy race character (race varies per class). ${PORTRAIT_STYLE_PREAMBLE} Mid-shot framing, dynamic or atmospheric pose, richly detailed painterly environment background`;

/**
 * Style preamble prepended to every filled portrait prompt to ensure
 * the image generator receives strong style steering at the very start.
 */
const PORTRAIT_PROMPT_PREFIX =
  "Digital fantasy painting in the Surreal Gentle Magic style (surreal_softmagic_v1), dreamy storybook illustration with visible soft painterly brushwork and textured rendering throughout, soft lavender and pale blue undertones, ambient diffused magical lighting with no clear source, gentle atmospheric haze with floating motes of light. NOT a photograph, NOT a 3D render, NOT concept art. 2:3 portrait orientation.";

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
  const toneBlock = toneDirective
    ? `\n\n## World Context\n${toneDirective}\nAll generated descriptions must match this world's tone. Do not add dark, grimdark, horror, or violent imagery unless the world's tone explicitly calls for it.`
    : "";

  const systemPrompt = `You are an expert image prompt engineer for AI image generators. You work EXCLUSIVELY within the Surreal Gentle Magic (surreal_softmagic_v1) design system.${toneBlock}

## CRITICAL STYLE RULES — every portrait MUST follow these:
- DIGITAL FANTASY PAINTING — visible painterly brushwork, soft textured rendering. Think dreamy storybook illustration.
- NEVER photorealistic, NEVER 3D-rendered, NEVER concept art, NEVER anime/manga
- Soft lavender and pale blue undertones suffusing every surface — cool undertones dominate
- Ambient diffused lighting with NO clear source point — light feels magical and source-ambiguous
- Gentle atmospheric haze with floating motes of light and faint magical particles
- Gentle curves over hard angles, slightly elongated organic forms, micro-warping on edges
- NO neon colors, NO saturated primaries, NO pure black, NO high contrast
- NO harsh shadows, NO spotlight effects, NO rim lighting, NO chiaroscuro
- Every scene must feel: gentle, breathable, enchanted, emotionally safe, welcoming
- Color palette: lavender #a897d2, pale blue #8caec9, dusty rose #b88faa, moss green #8da97b, soft gold #bea873

These portraits appear on a character creation screen. They should be visually stunning and evocative — selling the fantasy of each race and class. They are 2:3 portrait orientation. The overall feeling must be DREAMY and PAINTERLY, like an illustrated fantasy book cover, NOT like a video game screenshot or CGI render.

Your task: produce a JSON object with these fields:

1. "raceTemplate" — a prompt template for RACE portraits using the placeholder {race_description}. The template MUST begin with "Digital fantasy painting in the Surreal Gentle Magic style, dreamy storybook illustration with visible painterly brushwork," followed by the portrait description. The race portrait shows the race in a fitting atmospheric environment. Close-up to mid-shot framing. No class outfit — just the race's natural form.

2. "classTemplate" — a prompt template for CLASS portraits using placeholders {race_description} and {class_outfit}. The template MUST begin with "Digital fantasy painting in the Surreal Gentle Magic style, dreamy storybook illustration with visible painterly brushwork," followed by the portrait description. Class portraits depict a character (race varies — described by {race_description}) wearing the class outfit in an atmospheric scene. Mid-shot framing.

3. "raceDescriptions" — an object mapping each race key to an optimized prompt-fragment for that race's appearance. Base these closely on the provided race descriptions. If a race has only a name (no description), invent an appearance that fits the world's tone.

4. "classOutfits" — an object mapping each class key to a vivid prompt-fragment for the class outfit, weapons, and magical effects at their most impressive (Legendary tier).

IMPORTANT: The templates must explicitly include phrases like "soft ambient diffused lighting", "gentle atmospheric haze", "painterly brushwork", "dreamy softly luminous" to steer the image generator toward the right aesthetic. Do NOT leave style enforcement to the suffix alone.

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

    return `${PORTRAIT_PROMPT_PREFIX}\n\n${filled}\n\n${STYLE_SUFFIX}`;
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

  return `${PORTRAIT_PROMPT_PREFIX}\n\n${filled}\n\n${STYLE_SUFFIX}`;
}
