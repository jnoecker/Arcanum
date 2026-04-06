// ─── Story-level AI prompts ─────────────────────────────────────────
// Used by StoryAIToolbar to drive Outline, Next-scene, and Synopsis tools.

import { buildToneDirective } from "./loreGeneration";
import { tiptapToPlainText } from "./loreRelations";
import type { Story, Scene } from "@/types/story";

function toneBlock(): string {
  const directive = buildToneDirective();
  return directive ? ` ${directive}` : "";
}

// ─── Outline a story from a synopsis ───────────────────────────────

export interface OutlineScene {
  title: string;
  narration: string;
}

export function getStoryOutlineSystemPrompt(): string {
  return (
    "You are a cinematic storyteller for a fantasy MUD." +
    toneBlock() +
    " Given a story synopsis, produce a structured outline of 4-7 scenes. " +
    "Each scene must have: a short evocative title (2-6 words) and a brief " +
    "narration paragraph (2-4 sentences) written in second-person, present tense, " +
    "vivid and atmospheric. Output ONLY a JSON array with this exact shape: " +
    `[{"title": "...", "narration": "..."}, ...] — no markdown fences, no explanation.`
  );
}

export function buildStoryOutlineUserPrompt(story: Story): string {
  const parts: string[] = [];
  parts.push(`Story title: ${story.title || "Untitled"}`);
  if (story.synopsis) parts.push(`Synopsis: ${story.synopsis}`);
  if (story.tags && story.tags.length > 0) parts.push(`Tags: ${story.tags.join(", ")}`);
  parts.push("\nProduce the JSON outline now.");
  return parts.join("\n");
}

/** Parse the outline LLM response, tolerating common formatting issues. */
export function parseOutlineResponse(raw: string): OutlineScene[] {
  // Strip code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  // Find first [ and last ] in case the model added explanatory prose
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is { title: unknown; narration: unknown } => !!s && typeof s === "object")
      .map((s) => ({
        title: typeof s.title === "string" ? s.title : "",
        narration: typeof s.narration === "string" ? s.narration : "",
      }))
      .filter((s) => s.title || s.narration);
  } catch {
    return [];
  }
}

// ─── Next scene continuation ───────────────────────────────────────

export function getNextSceneSystemPrompt(): string {
  return (
    "You are a cinematic storyteller for a fantasy MUD." +
    toneBlock() +
    " Given a story's existing scenes (in order), generate the NEXT scene that " +
    "naturally continues the narrative arc. Maintain voice, tone, and pacing. " +
    "Output ONLY a JSON object with this exact shape: " +
    `{"title": "...", "narration": "..."} — no markdown fences, no explanation. ` +
    "Narration should be 2-4 sentences, second-person present tense."
  );
}

export function buildNextSceneUserPrompt(story: Story, priorScenes: Scene[]): string {
  const parts: string[] = [];
  if (story.synopsis) parts.push(`Story synopsis: ${story.synopsis}`);
  parts.push(`Story title: ${story.title || "Untitled"}`);
  parts.push("\nExisting scenes (in order):");
  priorScenes.forEach((s, i) => {
    const text = tiptapToPlainText(s.narration ?? "").trim();
    parts.push(`\n${i + 1}. ${s.title || "Untitled"}`);
    if (text) parts.push(`   ${text}`);
  });
  parts.push("\nGenerate the next scene as JSON now.");
  return parts.join("\n");
}

export function parseNextSceneResponse(raw: string): { title: string; narration: string } | null {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as { title?: unknown; narration?: unknown };
    const title = typeof obj.title === "string" ? obj.title : "";
    const narration = typeof obj.narration === "string" ? obj.narration : "";
    if (!title && !narration) return null;
    return { title, narration };
  } catch {
    return null;
  }
}

// ─── Synopsis from scenes ──────────────────────────────────────────

export function getSynopsisSystemPrompt(): string {
  return (
    "You are a story editor for a fantasy MUD." +
    toneBlock() +
    " Read the following scene-by-scene narration and produce a single concise " +
    "synopsis paragraph (3-5 sentences) capturing the story's arc, stakes, and " +
    "tone. Output ONLY the synopsis — no quotes, no preamble, no markdown."
  );
}

export function buildSynopsisUserPrompt(story: Story, scenes: Scene[]): string {
  const parts: string[] = [];
  parts.push(`Story title: ${story.title || "Untitled"}`);
  parts.push("\nScenes (in order):");
  scenes.forEach((s, i) => {
    const text = tiptapToPlainText(s.narration ?? "").trim();
    parts.push(`\n${i + 1}. ${s.title || "Untitled"}`);
    if (text) parts.push(`   ${text}`);
  });
  parts.push("\nWrite the synopsis paragraph now.");
  return parts.join("\n");
}
