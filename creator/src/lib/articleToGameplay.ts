import { invoke } from "@tauri-apps/api/core";
import type { Article } from "@/types/lore";
import type { ClassDefinitionConfig, RaceDefinitionConfig } from "@/types/config";
import { tiptapToPlainText } from "@/lib/loreRelations";
import { getEffectiveSections } from "@/lib/loreSections";
import { buildToneDirective } from "@/lib/loreGeneration";
import { buildRagContext, type RetrievalDiagnostic } from "@/lib/rag/loreContext";
import { AI_ENABLED } from "@/lib/featureFlags";

// ─── Shared plumbing ────────────────────────────────────────────────

function articleBodyPlainText(article: Article): string {
  const sections = getEffectiveSections(article);
  const richtext = sections.filter((s) => s.type === "richtext" && !s.private);
  if (richtext.length === 0) return tiptapToPlainText(article.content);
  return richtext
    .map((s) => {
      const heading = s.title ? `## ${s.title}\n` : "";
      const body = tiptapToPlainText(("body" in s ? s.body : "") ?? "");
      return `${heading}${body}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

function articleFieldSummary(article: Article): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(article.fields)) {
    if (v == null || v === "") continue;
    const rendered = Array.isArray(v) ? v.join(", ") : String(v);
    if (rendered.length === 0) continue;
    out.push(`${k}: ${rendered}`);
  }
  return out.join("\n");
}

function idFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return base || "untitled";
}

function parseGameplayJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```json?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed ? trimmed : undefined;
}

function asNumber(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter((x) => x.length > 0);
}

function asStatMap(v: unknown): Record<string, number> {
  if (v == null || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = typeof val === "number" ? val : typeof val === "string" ? Number(val) : NaN;
    if (Number.isFinite(n) && n !== 0) {
      out[k.trim()] = Math.round(n);
    }
  }
  return out;
}

// ─── Class scaffold ─────────────────────────────────────────────────

export interface ClassScaffoldResult {
  id: string;
  config: ClassDefinitionConfig;
  /** Class-related abilities the model suggested. The user can fold these
   *  in via #240 (Talent generator) later; we surface them here so the
   *  proposal screen can hint at what to build next. */
  suggestedAbilities: string[];
  diagnostic: RetrievalDiagnostic;
  /** True when the article's title already collides with an existing class
   *  id or displayName — the proposal screen warns and disables Accept
   *  unless the user picks a different id. */
  collidesWithExisting: boolean;
}

interface ScaffoldClassOptions {
  article: Article;
  existingClassIds: Set<string>;
  existingClassDisplayNames: Set<string>;
}

export async function generateClassFromArticle(
  opts: ScaffoldClassOptions,
): Promise<ClassScaffoldResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const { article, existingClassIds, existingClassDisplayNames } = opts;
  const body = articleBodyPlainText(article);
  const fieldSummary = articleFieldSummary(article);
  const toneDirective = buildToneDirective();

  const { context: ragContext, diagnostic } = await buildRagContext({
    query: `${article.title} class — role, primary stat, resource, key abilities, magic system`,
    excludeSourceIds: [article.id],
    k: 12,
    maxChars: 6000,
    fallback: () => "",
  });

  const systemPrompt = `You are scaffolding a player CLASS for a fantasy MUD from a worldbuilding article. Output a JSON object the gameplay layer can consume directly. Do NOT invent claims absent from the article and lore context; instead, leave fields blank when the source doesn't support them.

JSON shape:
{
  "id": "snake_case_slug",
  "displayName": "Title Case",
  "description": "One short line shown in the class roster.",
  "backstory": "1-3 short paragraphs of in-world history grounded in the article.",
  "hpPerLevel": 8-20,
  "manaPerLevel": 0-20,
  "primaryStat": "strength | intelligence | wisdom | dexterity | constitution | charisma | <other>",
  "outfitDescription": "Iconic look — armor, garb, weapons, stance. For sprite generation.",
  "suggestedAbilities": ["ability name 1", "ability name 2", ...]
}

Rules:
- hp/mana per level pace classes against each other: a tank/martial archetype gets high hp (16-20) and low mana (0-4); a caster gets lower hp (8-12) and high mana (14-20); hybrids land in the middle.
- The id is the slug form of the title (lowercase, underscores, no punctuation).
- suggestedAbilities is a short list of 3-6 names — concrete enough that an ability designer can act on them, but not full definitions.
- Output ONLY valid JSON — no markdown fences, no preamble, no trailing commentary.${toneDirective ? `\n\nVoice directive for backstory and description:\n${toneDirective}` : ""}`;

  const userPromptParts: string[] = [
    `Article title: ${article.title}`,
    article.template === "class" ? "Article template: class (playable)" : `Article template: ${article.template}`,
  ];
  if (fieldSummary) userPromptParts.push("", "Article fields:", fieldSummary);
  if (body) userPromptParts.push("", "Article body:", body);
  if (ragContext) userPromptParts.push("", "Related lore context:", ragContext);
  userPromptParts.push("", "Output the JSON now.");

  const raw = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    maxTokens: 1536,
  });
  const parsed = parseGameplayJson(raw);

  const fallbackId = idFromTitle(article.title);
  const id = asString(parsed.id) ?? fallbackId;
  const displayName = asString(parsed.displayName) ?? article.title;

  const config: ClassDefinitionConfig = {
    displayName,
    description: asString(parsed.description),
    backstory: asString(parsed.backstory),
    hpPerLevel: asNumber(parsed.hpPerLevel, 12, 1, 50),
    manaPerLevel: asNumber(parsed.manaPerLevel, 10, 0, 50),
    primaryStat: asString(parsed.primaryStat),
    selectable: true,
    outfitDescription: asString(parsed.outfitDescription),
  };

  const collidesWithExisting =
    existingClassIds.has(id.toLowerCase()) ||
    existingClassDisplayNames.has(displayName.toLowerCase());

  return {
    id,
    config,
    suggestedAbilities: asStringArray(parsed.suggestedAbilities),
    diagnostic,
    collidesWithExisting,
  };
}

// ─── Race scaffold ──────────────────────────────────────────────────

export interface RaceScaffoldResult {
  id: string;
  config: RaceDefinitionConfig;
  diagnostic: RetrievalDiagnostic;
  collidesWithExisting: boolean;
}

interface ScaffoldRaceOptions {
  article: Article;
  existingRaceIds: Set<string>;
  existingRaceDisplayNames: Set<string>;
}

export async function generateRaceFromArticle(
  opts: ScaffoldRaceOptions,
): Promise<RaceScaffoldResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const { article, existingRaceIds, existingRaceDisplayNames } = opts;
  const body = articleBodyPlainText(article);
  const fieldSummary = articleFieldSummary(article);
  const toneDirective = buildToneDirective();

  const { context: ragContext, diagnostic } = await buildRagContext({
    query: `${article.title} ancestry — heritage, traits, stat tendencies, signature abilities, body description`,
    excludeSourceIds: [article.id],
    k: 12,
    maxChars: 6000,
    fallback: () => "",
  });

  const systemPrompt = `You are scaffolding a player RACE (ancestry) for a fantasy MUD from a worldbuilding article. Output a JSON object the gameplay layer can consume directly. Do NOT invent claims absent from the article and lore context; instead, leave fields blank when the source doesn't support them.

JSON shape:
{
  "id": "snake_case_slug",
  "displayName": "Title Case",
  "description": "One short line shown in the race roster.",
  "backstory": "1-3 short paragraphs of in-world heritage grounded in the article.",
  "traits": ["trait one", "trait two", ...],
  "abilities": ["signature ability name 1", ...],
  "statMods": { "strength": 1, "intelligence": -1, ... },
  "bodyDescription": "Concrete physical description suitable for sprite generation — body shape, proportions, distinguishing features. NO clothing or outfits."
}

Rules:
- statMods is small adjustments in the range -2..+2 against the standard stats (strength, intelligence, wisdom, dexterity, constitution, charisma). Use only the stats the article actually supports. Omit zero values.
- traits is short tag-style phrases (1-4 words each), not paragraphs.
- abilities is a short list of named signature abilities (3-6 entries) — concrete enough that an ability designer can act on them, but not full definitions.
- bodyDescription is physical only. No clothing, garb, or accessories — those belong on classes.
- The id is the slug form of the title (lowercase, underscores, no punctuation).
- Output ONLY valid JSON — no markdown fences, no preamble, no trailing commentary.${toneDirective ? `\n\nVoice directive for backstory and description:\n${toneDirective}` : ""}`;

  const userPromptParts: string[] = [
    `Article title: ${article.title}`,
    article.template === "ancestry" ? "Article template: ancestry (playable)" : `Article template: ${article.template}`,
  ];
  if (fieldSummary) userPromptParts.push("", "Article fields:", fieldSummary);
  if (body) userPromptParts.push("", "Article body:", body);
  if (ragContext) userPromptParts.push("", "Related lore context:", ragContext);
  userPromptParts.push("", "Output the JSON now.");

  const raw = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    maxTokens: 1536,
  });
  const parsed = parseGameplayJson(raw);

  const fallbackId = idFromTitle(article.title);
  const id = asString(parsed.id) ?? fallbackId;
  const displayName = asString(parsed.displayName) ?? article.title;

  const config: RaceDefinitionConfig = {
    displayName,
    description: asString(parsed.description),
    backstory: asString(parsed.backstory),
    traits: asStringArray(parsed.traits),
    abilities: asStringArray(parsed.abilities),
    statMods: asStatMap(parsed.statMods),
    bodyDescription: asString(parsed.bodyDescription),
    selectable: true,
  };

  const collidesWithExisting =
    existingRaceIds.has(id.toLowerCase()) ||
    existingRaceDisplayNames.has(displayName.toLowerCase());

  return {
    id,
    config,
    diagnostic,
    collidesWithExisting,
  };
}
