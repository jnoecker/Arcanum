import { invoke } from "@tauri-apps/api/core";
import type { ArtStyle } from "@/types/lore";
import { buildToneDirective } from "./loreGeneration";
import { parseLlmJson } from "./arcanumPrompts";
import { AI_ENABLED } from "@/lib/featureFlags";

// ─── AI-assisted art style generation ───────────────────────────────
//
// One-shot: user types a theme ("surreal gentle magic", "cyberpunk noir",
// "watercolor storybook"), LLM returns a fully-populated ArtStyle with a
// name, description, base prompt, and both surface overrides.

const SYSTEM_PROMPT = `You are an expert AI art director specializing in crafting visual style guides for fantasy worldbuilding tools. Your job is to take a short theme prompt and turn it into a rich, specific, actionable style guide that an image generation AI can use to produce consistent art.

A "style guide" in this context has four parts:

1. **name**: A short, memorable name for the style (2-5 words). E.g. "Surreal Gentle Magic", "Arcanum", "Obsidian Bloom".

2. **description**: A one-line hook describing the style's emotional feel and dominant palette. Max 12 words. E.g. "Baroque cosmic gold-and-indigo — the Creator's instrument".

3. **basePrompt**: A 100-300 word paragraph describing the visual language the image generator should use. Cover color palette (specific hex codes when useful), lighting behavior, shape language, texture, and compositional rules. Include forbidden elements. This paragraph is appended to EVERY image generation prompt, so it must feel self-contained. Use concrete, actionable language — no vague adjectives. Do NOT include surface-specific rules here.

4. **surfaces**: Two short additional directives, each 1-3 sentences:
   - **worldbuilding**: Extra rules for game-facing art — sprites, item icons, ability icons, room backgrounds, entity portraits. Focus on readability-at-small-sizes, silhouette clarity, and in-game asset conventions.
   - **lore**: Extra rules for codex/lore-book illustrations — character portraits, lore article hero images, encyclopedia-style artwork. Focus on faithful subject depiction, compositional framing, and narrative evocativeness.

These surface directives should LAYER on top of the basePrompt — they give surface-specific guidance without contradicting the base style.

Output ONLY valid JSON with this exact shape — no markdown fences, no commentary:
{
  "name": "string",
  "description": "string",
  "basePrompt": "string",
  "worldbuilding": "string",
  "lore": "string"
}`;

/**
 * Generate a complete ArtStyle from a short theme prompt.
 * Uses the world tone directive (if any) as context so the style stays on-theme.
 */
export async function generateArtStyle(themePrompt: string): Promise<ArtStyle> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const tone = buildToneDirective({ imageContext: true });
  const toneBlock = tone ? `\n\nWorld context (stay consistent with this):\n${tone}` : "";

  const userPrompt = `Design a visual style guide for this theme: "${themePrompt}"${toneBlock}

Output the JSON now.`;

  const response = await invoke<string>("llm_complete", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2048,
  });

  const parsed = parseLlmJson(response, "art-style-generation") as {
    name?: unknown;
    description?: unknown;
    basePrompt?: unknown;
    worldbuilding?: unknown;
    lore?: unknown;
  };

  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  const basePrompt = typeof parsed.basePrompt === "string" ? parsed.basePrompt.trim() : "";
  if (!name || !basePrompt) {
    throw new Error("AI response missing required fields (name and basePrompt).");
  }

  const now = new Date().toISOString();
  return {
    id: `style_${Date.now().toString(36)}`,
    name,
    description: typeof parsed.description === "string" ? parsed.description.trim() : undefined,
    basePrompt,
    surfaces: {
      worldbuilding: typeof parsed.worldbuilding === "string" ? parsed.worldbuilding.trim() : undefined,
      lore: typeof parsed.lore === "string" ? parsed.lore.trim() : undefined,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Rewrite/refine an existing ArtStyle based on a user instruction.
 * Returns a patch that can be passed to updateArtStyle.
 */
export async function refineArtStyle(
  style: ArtStyle,
  instruction: string,
): Promise<Partial<ArtStyle>> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const tone = buildToneDirective({ imageContext: true });
  const toneBlock = tone ? `\n\nWorld context (preserve consistency with this):\n${tone}` : "";

  const userPrompt = `Existing style:
Name: ${style.name}
Description: ${style.description ?? ""}
Base prompt: ${style.basePrompt}
Worldbuilding override: ${style.surfaces?.worldbuilding ?? ""}
Lore override: ${style.surfaces?.lore ?? ""}

User instruction: ${instruction}${toneBlock}

Rewrite the style per the instruction. Output the JSON now with all five fields — include fields unchanged if the instruction doesn't touch them.`;

  const response = await invoke<string>("llm_complete", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2048,
  });

  const parsed = parseLlmJson(response, "art-style-refinement") as {
    name?: unknown;
    description?: unknown;
    basePrompt?: unknown;
    worldbuilding?: unknown;
    lore?: unknown;
  };

  const patch: Partial<ArtStyle> = {};
  if (typeof parsed.name === "string" && parsed.name.trim()) patch.name = parsed.name.trim();
  if (typeof parsed.description === "string") patch.description = parsed.description.trim() || undefined;
  if (typeof parsed.basePrompt === "string" && parsed.basePrompt.trim()) patch.basePrompt = parsed.basePrompt.trim();

  const surfaces: ArtStyle["surfaces"] = { ...style.surfaces };
  let surfacesChanged = false;
  if (typeof parsed.worldbuilding === "string") {
    surfaces.worldbuilding = parsed.worldbuilding.trim() || undefined;
    surfacesChanged = true;
  }
  if (typeof parsed.lore === "string") {
    surfaces.lore = parsed.lore.trim() || undefined;
    surfacesChanged = true;
  }
  if (surfacesChanged) patch.surfaces = surfaces;

  return patch;
}
