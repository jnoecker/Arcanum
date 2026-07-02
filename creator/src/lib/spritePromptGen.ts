import { invoke } from "@tauri-apps/api/core";
import {
  ENHANCED_PROMPT_TAIL,
  getEnhanceSystemPrompt,
  getFormatForAssetType,
  getPreamble,
  NO_TEXT_LINE,
  withSpriteSafety,
  type ArtStyle,
} from "./arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";
import { buildToneDirective } from "./loreGeneration";
import {
  DEFAULT_RACE_BODY_DESCRIPTIONS,
  DEFAULT_CLASS_OUTFIT_DESCRIPTIONS,
} from "./defaultSpriteData";
import { AI_ENABLED } from "@/lib/featureFlags";
import type { SpriteDefinition, SpriteRequirement } from "@/types/sprites";

// ─── Types ───────────────────────────────────────────────────────────

export interface SpriteDimensions {
  race?: string;
  playerClass?: string;
  gender?: string;
}

export interface SpritePromptArgs {
  displayName: string;
  dimensions: SpriteDimensions;
  /** Free-form steering text: artDirection, description, variant label. */
  notes?: string;
  style: ArtStyle;
  /** Model produces native transparency — use light framing rules instead of the lavender chroma-key. */
  nativeTransparency?: boolean;
  /** Run the LLM enhancement pass. When false, returns the composed base prompt. */
  enhance?: boolean;
}

// ─── Data resolution ─────────────────────────────────────────────────

/** Get the body description for a race — config > fallback constant > race key */
export function getRaceBodyDescription(race: string): string {
  const config = useConfigStore.getState().config;
  return config?.races[race]?.bodyDescription
    ?? DEFAULT_RACE_BODY_DESCRIPTIONS[race]
    ?? race;
}

/**
 * Returns the verbatim image-prompt directive authored on the race (e.g.
 * "NO FACE NO HUMAN FACE"), or null if none. Appended literally to sprite
 * prompts so it survives the LLM paraphrase that goes through the template.
 */
export function getRaceImagePromptDirective(race: string | undefined): string | null {
  if (!race) return null;
  const directive = useConfigStore.getState().config?.races[race]?.imagePromptDirective;
  return directive && directive.trim() ? directive.trim() : null;
}

/** Get the outfit description for a class — config > fallback constant > class key */
export function getClassOutfitDescription(cls: string): string {
  const config = useConfigStore.getState().config;
  return config?.classes[cls]?.outfitDescription
    ?? DEFAULT_CLASS_OUTFIT_DESCRIPTIONS[cls]
    ?? cls;
}

function findReq<T extends SpriteRequirement["type"]>(
  requirements: SpriteRequirement[],
  type: T,
): Extract<SpriteRequirement, { type: T }> | undefined {
  return requirements.find(
    (r): r is Extract<SpriteRequirement, { type: T }> => r.type === type,
  );
}

/** Resolve race/class/gender for a sprite definition from its requirements + gender. */
export function resolveSpriteDimensions(def: SpriteDefinition): SpriteDimensions {
  return {
    race: findReq(def.requirements, "race")?.race || undefined,
    playerClass: findReq(def.requirements, "class")?.playerClass || undefined,
    gender: def.gender || undefined,
  };
}

/** Free-text steering (art direction / description) for a sprite definition. */
export function spritePromptNotes(def: SpriteDefinition): string | undefined {
  const notes = def.artDirection?.trim() || def.description?.trim();
  return notes || undefined;
}

// ─── Prompt assembly ─────────────────────────────────────────────────

function spriteSubject(dimensions: SpriteDimensions): string {
  const parts: string[] = [];
  if (dimensions.gender) parts.push(dimensions.gender);
  if (dimensions.race) {
    const desc = getRaceBodyDescription(dimensions.race);
    parts.push(desc !== dimensions.race ? `${dimensions.race} (${desc})` : dimensions.race);
  } else {
    parts.push("adventurer");
  }
  if (dimensions.playerClass) {
    parts.push(getClassOutfitDescription(dimensions.playerClass));
  } else {
    parts.push("wearing simple traveler's clothing");
  }
  return parts.join(", ");
}

/**
 * Entity-context block fed to the prompt enhancer — same role as
 * `mobContext` in the zone batch pipeline.
 */
export function spriteContext(
  displayName: string,
  dimensions: SpriteDimensions,
  notes?: string,
): string {
  const parts = [
    `Player character sprite "${displayName}" — a full-body standing figure used as a "player is standing here" marker composited into room scenes at small sizes.`,
  ];
  if (dimensions.gender) parts.push(`Gender: ${dimensions.gender}`);
  if (dimensions.race) {
    const desc = getRaceBodyDescription(dimensions.race);
    parts.push(desc !== dimensions.race ? `Race: ${dimensions.race} — ${desc}` : `Race: ${dimensions.race}`);
  }
  if (dimensions.playerClass) {
    const desc = getClassOutfitDescription(dimensions.playerClass);
    parts.push(
      desc !== dimensions.playerClass
        ? `Class: ${dimensions.playerClass} — outfit: ${desc}`
        : `Class: ${dimensions.playerClass}`,
    );
  } else {
    parts.push("No class — wearing simple traveler's clothing");
  }
  const directive = getRaceImagePromptDirective(dimensions.race);
  if (directive) {
    parts.push(`Hard constraint for this race (must never be contradicted): ${directive}`);
  }
  if (notes?.trim()) parts.push(`Art direction: ${notes.trim()}`);
  return parts.join("\n");
}

/**
 * Composed base prompt — used directly when LLM enhancement is unavailable,
 * and handed to the enhancer as the reference style template. Mirrors the
 * `mobPrompt` shape from the zone batch pipeline.
 */
export function spriteBasePrompt(
  dimensions: SpriteDimensions,
  style: ArtStyle,
  notes?: string,
  nativeTransparency?: boolean,
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const tone = buildToneDirective({ imageContext: true });
  const toneLine = tone ? `\n${tone}\n` : "";
  const notesLine = notes?.trim() ? ` ${notes.trim()}.` : "";
  const directive = getRaceImagePromptDirective(dimensions.race);
  const directiveBlock = directive ? `\n\n${directive}` : "";

  const inner = `${getFormatForAssetType("player_sprite")}. ${preamble}${toneLine}

A full-body standing figure of a ${spriteSubject(dimensions)}.${notesLine} Relaxed confident standing pose, entire figure visible head to toe, clear readable silhouette.${directiveBlock}

${NO_TEXT_LINE}`;

  return withSpriteSafety(inner, "player_sprite", nativeTransparency);
}

/**
 * The single sprite prompt path — every generation surface (single
 * generate, prompt preview, Fill Gaps bulk) goes through here. Runs the
 * same per-entity LLM enhancement as the zone batch art pipeline; falls
 * back to the composed base prompt if the LLM is unavailable or errors.
 */
export async function buildEnhancedSpritePrompt(args: SpritePromptArgs): Promise<string> {
  const base = spriteBasePrompt(args.dimensions, args.style, args.notes, args.nativeTransparency);
  if (!args.enhance || !AI_ENABLED) return base;

  try {
    const systemPrompt = getEnhanceSystemPrompt(
      args.style,
      "player_sprite",
      "worldbuilding",
      args.nativeTransparency,
    );
    const context = spriteContext(args.displayName, args.dimensions, args.notes);
    const userPrompt = `Generate an image prompt for this entity:\n${context}\n\nReference style template (adapt but prioritize the entity description above):\n${base}`;
    let finalPrompt = await invoke<string>("llm_complete", { systemPrompt, userPrompt });

    // The enhancer already conforms the prompt to the style; only the
    // compact medium + no-text constraints need to ride along verbatim.
    if (!finalPrompt.includes("NO readable text")) {
      finalPrompt = `${finalPrompt}\n\n${ENHANCED_PROMPT_TAIL}`;
    }
    return finalPrompt;
  } catch (error) {
    console.warn("Sprite prompt enhancement failed, using base prompt.", error);
    return base;
  }
}

// ─── Art direction generation ────────────────────────────────────────

export async function generateArtDirection(
  displayName: string,
  race?: string,
  playerClass?: string,
  gender?: string,
): Promise<string> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const toneDirective = buildToneDirective({ imageContext: true });
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
  const directive = getRaceImagePromptDirective(race);
  if (directive) {
    context.push(`Hard constraint for this race (do not contradict): ${directive}`);
  }

  const systemPrompt = `You are an expert visual art director for fantasy RPG character sprites. Given context about a sprite, write a concise visual description that an AI image generator can use to produce a compelling character portrait.${toneBlock}

Rules:
- Focus on visual appearance: body type, clothing, armor, weapons, magical effects, color palette, mood
- Be specific and vivid but concise (2-4 sentences)
- If gender is specified, make it a clear visual characteristic
- If a "Hard constraint" is provided, your description must NEVER describe features that contradict it (e.g. don't mention eyes/face if the constraint says no face)
- Output ONLY the visual description — no quotes, no explanation`;

  const result = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: context.join("\n"),
  });
  return result.trim();
}
