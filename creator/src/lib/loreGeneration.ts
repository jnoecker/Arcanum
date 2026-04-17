import { invoke } from "@tauri-apps/api/core";
import { useLoreStore } from "@/stores/loreStore";
import type { Article, ArticleTemplate, CalendarSystem, CalendarEra, TimelineEvent } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { tiptapToPlainText } from "@/lib/loreRelations";
import { AI_ENABLED } from "@/lib/featureFlags";

// ─── World context builder ──────────────────────────────────────────

/**
 * Build a lightweight tone directive for AI system prompts.
 * Returns world name + tone + themes in ~50 words.
 * Injected into EVERY AI system prompt.
 *
 * Pass `imageContext: true` for prompts that build English image-model
 * prompts (sprites, portraits, art style descriptors). Those must stay
 * in English because image models are trained predominantly on English
 * captions. For regular text generation (lore prose, articles, zone
 * descriptions), leave the option off so the world's output-language
 * preference is honored.
 */
export function buildToneDirective(opts?: { imageContext?: boolean }): string {
  const lore = useLoreStore.getState().lore;
  if (!lore) return "";

  const ws = Object.values(lore.articles).find((a) => a.template === "world_setting");
  if (!ws) return "";

  const name = typeof ws.fields.name === "string" ? ws.fields.name : "";
  const tone = typeof ws.fields.tone === "string" ? ws.fields.tone : "";
  const tagline = typeof ws.fields.tagline === "string" ? ws.fields.tagline : "";
  const themes = Array.isArray(ws.fields.themes) ? ws.fields.themes.join(", ") : "";

  const parts: string[] = [];
  if (name) parts.push(`World: ${name}.`);
  if (tagline) parts.push(tagline);
  if (tone) parts.push(`Tone: ${tone}.`);
  if (themes) parts.push(`Themes: ${themes}.`);
  if (parts.length > 0) {
    parts.push("All generated content must match this world's tone and themes.");
  }

  if (!opts?.imageContext) {
    const lang = buildLanguageDirective();
    if (lang) parts.push(lang);
  }

  return parts.join(" ");
}

/**
 * Return the world's "write lore in this language" instruction, or ""
 * if no language is configured (English is the default and needs no
 * directive). Used standalone by callers that want fine control over
 * placement, and appended automatically by buildToneDirective().
 *
 * The instruction explicitly preserves JSON keys, template names, and
 * tag slugs in English so the data model stays consistent regardless
 * of the prose language — field keys like "tagline" and template IDs
 * like "character" are identifiers, not user-facing copy.
 */
export function buildLanguageDirective(): string {
  const lore = useLoreStore.getState().lore;
  if (!lore) return "";
  const ws = Object.values(lore.articles).find((a) => a.template === "world_setting");
  if (!ws) return "";
  const raw = typeof ws.fields.language === "string" ? ws.fields.language.trim() : "";
  if (!raw || raw === "other") return "";
  return (
    `Write all prose, titles, and descriptions in ${raw}. ` +
    `Keep JSON field keys, template identifiers, tag slugs, and URL-safe IDs in English.`
  );
}

/** Which surface an image is being generated for. Controls which per-surface override is appended. */
export type ArtStyleSurface = "worldbuilding" | "lore";

/**
 * Build a visual style directive for AI image generation prompts.
 *
 * Resolution order:
 *   1. The active ArtStyle's basePrompt (+ optional surface override)
 *   2. The legacy `world_setting.visualStyle` field (fallback for pre-art-style worlds)
 *   3. Empty string (callers fall back to a generic style)
 *
 * Pass `surface` when the call site knows which kind of art is being generated —
 * "worldbuilding" for sprites/rooms/entities/abilities/icons, "lore" for portraits
 * and lore article illustrations. Omit for surface-neutral callers.
 */
export function buildVisualStyleDirective(surface?: ArtStyleSurface): string {
  const lore = useLoreStore.getState().lore;
  if (!lore) return "";

  // Prefer the active ArtStyle
  const active = (lore.artStyles ?? []).find((s) => s.id === lore.activeArtStyleId);
  if (active) {
    const base = active.basePrompt.trim();
    const override = surface ? active.surfaces?.[surface]?.trim() : "";
    if (base && override) return `${base}\n\n${override}`;
    if (base) return base;
    if (override) return override;
  }

  // Legacy fallback: world_setting.visualStyle
  const ws = Object.values(lore.articles).find((a) => a.template === "world_setting");
  if (!ws) return "";
  const visualStyle = typeof ws.fields.visualStyle === "string" ? ws.fields.visualStyle.trim() : "";
  return visualStyle;
}

/**
 * Build a rich world context summary for AI generation.
 * Includes world setting, key articles grouped by template with
 * brief summaries, template AI descriptions, and timeline highlights.
 * Shared by article generation, inline writing, and related-article generation.
 */
export function buildWorldContext(): string {
  const lore = useLoreStore.getState().lore;
  if (!lore) return "A fantasy MUD game world";

  const articles = lore.articles;
  const overrides = lore.templateOverrides ?? {};
  const parts: string[] = [];

  // ── Tone directive (always first) ──
  const toneDirective = buildToneDirective();
  if (toneDirective) parts.push(toneDirective);

  // ── World setting ──
  const ws = Object.values(articles).find((a) => a.template === "world_setting");
  if (ws) {
    const name = typeof ws.fields.name === "string" ? ws.fields.name : "";
    const tagline = typeof ws.fields.tagline === "string" ? ws.fields.tagline : "";
    const tone = typeof ws.fields.tone === "string" ? ws.fields.tone : "";
    const era = typeof ws.fields.era === "string" ? ws.fields.era : "";
    const themes = Array.isArray(ws.fields.themes) ? ws.fields.themes.join(", ") : "";
    const magic = typeof ws.fields.magic === "string" ? ws.fields.magic : "";

    if (name && !toneDirective) parts.push(`World: ${name}`);
    if (tagline && !toneDirective) parts.push(tagline);
    if (tone && !toneDirective) parts.push(`Tone: ${tone}`);
    if (era) parts.push(`Current era: ${era}`);
    if (themes && !toneDirective) parts.push(`Themes: ${themes}`);
    if (magic) parts.push(`Magic: ${magic.slice(0, 300)}`);

    const prose = tiptapToPlainText(ws.content);
    if (prose) parts.push(`\nWorld overview:\n${prose.slice(0, 800)}`);
  }

  // ── Articles grouped by template with summaries ──
  const byTemplate = new Map<ArticleTemplate, Article[]>();
  for (const a of Object.values(articles)) {
    if (a.template === "world_setting") continue;
    const list = byTemplate.get(a.template) ?? [];
    list.push(a);
    byTemplate.set(a.template, list);
  }

  for (const [template, list] of byTemplate) {
    const schema = TEMPLATE_SCHEMAS[template];
    const label = schema?.pluralLabel ?? template;
    const aiDesc = overrides[template]?.aiDescription ?? schema?.aiDescription;

    const lines: string[] = [];
    lines.push(`\n## ${label} (${list.length})`);
    if (aiDesc) lines.push(`[Guide: ${aiDesc}]`);

    // Include brief summaries for up to 10 articles per template
    for (const a of list.slice(0, 10)) {
      const prose = tiptapToPlainText(a.content);
      const snippet = prose ? prose.slice(0, 150).replace(/\n/g, " ") : "";
      const fieldBits: string[] = [];
      // Pull a few key fields for context
      for (const [k, v] of Object.entries(a.fields)) {
        if (typeof v === "string" && v.length > 0 && v.length < 80) {
          fieldBits.push(`${k}: ${v}`);
        }
        if (fieldBits.length >= 3) break;
      }
      const meta = fieldBits.length > 0 ? ` (${fieldBits.join(", ")})` : "";
      lines.push(`- ${a.title}${meta}${snippet ? ` — ${snippet}` : ""}`);
    }
    if (list.length > 10) lines.push(`  ...and ${list.length - 10} more`);

    parts.push(lines.join("\n"));
  }

  // ── Timeline highlights ──
  const events = lore.timelineEvents ?? [];
  const legendaryEvents = events.filter((e) => e.importance === "legendary");
  if (legendaryEvents.length > 0) {
    parts.push("\n## Key historical events");
    for (const e of legendaryEvents.slice(0, 5)) {
      parts.push(`- ${e.title}${e.description ? `: ${e.description.slice(0, 100)}` : ""}`);
    }
  }

  return parts.join("\n") || "A fantasy MUD game world";
}

/** @deprecated Use buildWorldContext() instead */
function worldContextSummary(): string {
  return buildWorldContext();
}

function getArticleGenSystem(): string {
  const tone = buildToneDirective();
  const toneBlock = tone ? `\n${tone}\n` : "";
  return `You are a world-building assistant for a fantasy MUD game.${toneBlock}
Generate a complete article as JSON. The JSON must match this exact shape:
{
  "title": "string",
  "fields": { ... template-specific key/value pairs ... },
  "content": "string (the main prose body, multiple paragraphs)",
  "tags": ["string", ...]
}

Output ONLY valid JSON — no markdown fences, no explanation, no preamble.
The content field should be rich, evocative prose suitable for a game world bible.
Template-specific fields should be filled with concrete, specific values (not generic placeholders).`;
}

function getWorldSeedSystem(): string {
  const lang = buildLanguageDirective();
  const langBlock = lang ? `\n${lang}\n` : "";
  return `You are a world-building assistant for a fantasy MUD game.${langBlock}
Given a concept paragraph, generate a complete starter world as JSON with this exact shape:
{
  "worldSetting": {
    "title": "string",
    "fields": { "name": "string", "tagline": "string", "tone": "string (e.g. whimsical, grimdark, heroic, cozy, surreal)", "visualStyle": "string (art direction for generated images, e.g. 'dreamy watercolor storybook' or 'gritty dark fantasy oil painting')", "era": "string", "themes": ["string"], "geography": "string", "magic": "string", "technology": "string", "history": "string" },
    "content": "string (world overview prose)"
  },
  "organizations": [
    { "title": "string", "fields": { "motto": "string", "territory": "string", "leader": "string", "values": ["string"] }, "content": "string", "tags": ["string"] }
  ],
  "locations": [
    { "title": "string", "fields": { "locationType": "string", "climate": "string", "population": "string", "government": "string", "resources": ["string"] }, "content": "string", "tags": ["string"] }
  ],
  "characters": [
    { "title": "string", "fields": { "fullName": "string", "title": "string", "race": "string", "class": "string", "personality": "string", "appearance": "string" }, "content": "string", "tags": ["string"] }
  ],
  "calendar": {
    "name": "string",
    "eras": [ { "name": "string", "startYear": 0 } ]
  },
  "events": [
    { "title": "string", "eraIndex": 0, "year": 0, "importance": "minor|major|legendary", "description": "string" }
  ]
}

Generate 3-5 organizations, 5-8 locations, 5-10 characters, 1 calendar with 2-4 eras, and 5-10 events.
Content fields should be 2-4 paragraphs of rich, evocative prose.
Output ONLY valid JSON — no markdown fences, no explanation.`;
}

// ─── Article generation ─────────────────────────────────────────────

export interface GenerateArticleOptions {
  template: ArticleTemplate;
  concept: string;
}

export async function generateArticle(opts: GenerateArticleOptions): Promise<Article> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const schema = TEMPLATE_SCHEMAS[opts.template];
  const fieldDesc = schema?.fields.map((f) => `  "${f.key}": ${f.type}`).join(",\n") ?? "";

  const userPrompt = `Generate a ${schema?.label ?? opts.template} article.
Concept: ${opts.concept}

Template fields to fill:
{
${fieldDesc}
}

World context:
${worldContextSummary()}`;

  const result = await invoke<string>("llm_complete", {
    systemPrompt: getArticleGenSystem(),
    userPrompt,
    maxTokens: 2048,
  });

  console.log("[ArticleGen] Raw LLM response:", result.slice(0, 1000));

  const parsed = parseJsonResponse(result);
  if (Object.keys(parsed).length === 0) {
    console.warn("[ArticleGen] JSON parsing failed. Full response:", result);
    throw new Error("The AI response could not be parsed as JSON. Try a simpler concept.");
  }
  const now = new Date().toISOString();
  const id = (parsed.title as string ?? opts.concept)
    .toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 40);

  return {
    id: `${id}_${Date.now().toString(36)}`,
    template: opts.template,
    title: (parsed.title as string) ?? opts.concept,
    fields: (parsed.fields as Record<string, unknown>) ?? {},
    content: (parsed.content as string) ?? "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Multi-article generation ───────────────────────────────────────

export interface GenerateRelatedOptions {
  sourceArticle: Article;
  count: number;
  relationType: string;
}

export async function generateRelatedArticles(opts: GenerateRelatedOptions): Promise<Article[]> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const userPrompt = `Given this existing article:
Title: ${opts.sourceArticle.title}
Type: ${opts.sourceArticle.template}
Content: ${opts.sourceArticle.content.slice(0, 500)}

Generate ${opts.count} related articles (relation: "${opts.relationType}").
Return a JSON array of articles, each with: { "title", "template", "fields", "content", "tags" }
Valid templates: character, location, organization, item, species, event, language, profession, ability, freeform.

World context:
${worldContextSummary()}`;

  const result = await invoke<string>("llm_complete", {
    systemPrompt: getArticleGenSystem().replace("Generate a complete article as JSON", "Generate an array of articles as JSON"),
    userPrompt,
    maxTokens: 4096,
  });

  const parsed = parseJsonResponse(result);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  const now = new Date().toISOString();

  return arr.map((item: Record<string, unknown>) => {
    const title = (item.title as string) ?? "Untitled";
    const id = title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 40);
    const template = (item.template as ArticleTemplate) ?? "freeform";
    return {
      id: `${id}_${Date.now().toString(36)}`,
      template: TEMPLATE_SCHEMAS[template] ? template : "freeform",
      title,
      fields: (item.fields as Record<string, unknown>) ?? {},
      content: (item.content as string) ?? "",
      tags: Array.isArray(item.tags) ? item.tags : undefined,
      relations: [{ targetId: opts.sourceArticle.id, type: opts.relationType }],
      createdAt: now,
      updatedAt: now,
    };
  });
}

// ─── World seed generation ──────────────────────────────────────────

export interface WorldSeedResult {
  articles: Article[];
  calendar?: CalendarSystem;
  events?: TimelineEvent[];
}

export async function generateWorldSeed(concept: string): Promise<WorldSeedResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const result = await invoke<string>("llm_complete", {
    systemPrompt: getWorldSeedSystem(),
    userPrompt: `World concept:\n${concept}`,
    maxTokens: 16384,
  });

  console.log("[WorldSeed] Raw LLM response length:", result.length);
  console.log("[WorldSeed] Raw LLM response (first 2000 chars):", result.slice(0, 2000));

  const parsed = parseJsonResponse(result);
  const parsedKeys = Object.keys(parsed);
  console.log("[WorldSeed] Parsed keys:", parsedKeys);
  if (parsedKeys.length === 0) {
    console.warn("[WorldSeed] JSON parsing produced empty object. Full response:", result);
    throw new Error(
      "The AI response could not be parsed as JSON. This usually means the response was too long and got truncated, or the AI returned prose instead of JSON. Try a shorter concept.",
    );
  }
  const now = new Date().toISOString();
  const articles: Article[] = [];

  // World setting
  if (parsed.worldSetting) {
    const ws = parsed.worldSetting as Record<string, unknown>;
    articles.push({
      id: "world_setting",
      template: "world_setting",
      title: (ws.title as string) ?? "World Setting",
      fields: (ws.fields as Record<string, unknown>) ?? {},
      content: (ws.content as string) ?? "",
      tags: Array.isArray(ws.tags) ? ws.tags : undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Organizations
  for (const org of asArray(parsed.organizations)) {
    const title = (org.title as string) ?? "Organization";
    const id = makeId(title);
    articles.push({
      id, template: "organization", title,
      fields: (org.fields as Record<string, unknown>) ?? {},
      content: (org.content as string) ?? "",
      tags: Array.isArray(org.tags) ? org.tags : undefined,
      createdAt: now, updatedAt: now,
    });
  }

  // Locations
  for (const loc of asArray(parsed.locations)) {
    const title = (loc.title as string) ?? "Location";
    const id = makeId(title);
    articles.push({
      id, template: "location", title,
      fields: (loc.fields as Record<string, unknown>) ?? {},
      content: (loc.content as string) ?? "",
      tags: Array.isArray(loc.tags) ? loc.tags : undefined,
      createdAt: now, updatedAt: now,
    });
  }

  // Characters
  for (const ch of asArray(parsed.characters)) {
    const title = (ch.title as string) ?? "Character";
    const id = makeId(title);
    articles.push({
      id, template: "character", title,
      fields: (ch.fields as Record<string, unknown>) ?? {},
      content: (ch.content as string) ?? "",
      tags: Array.isArray(ch.tags) ? ch.tags : undefined,
      createdAt: now, updatedAt: now,
    });
  }

  // Calendar
  let calendar: CalendarSystem | undefined;
  if (parsed.calendar && typeof parsed.calendar === "object") {
    const cal = parsed.calendar as Record<string, unknown>;
    const eras: CalendarEra[] = asArray(cal.eras).map((e, i) => ({
      id: `era_${i}`,
      name: (e.name as string) ?? `Era ${i + 1}`,
      startYear: (e.startYear as number) ?? i * 100,
    }));
    calendar = {
      id: "main_calendar",
      name: (cal.name as string) ?? "World Calendar",
      eras,
    };
  }

  // Events
  let events: TimelineEvent[] | undefined;
  if (calendar && Array.isArray(parsed.events)) {
    events = parsed.events.map((e: Record<string, unknown>, i: number) => {
      const eraIdx = (e.eraIndex as number) ?? 0;
      const era = calendar!.eras[eraIdx] ?? calendar!.eras[0];
      return {
        id: `evt_seed_${i}`,
        calendarId: calendar!.id,
        eraId: era?.id ?? "",
        year: (e.year as number) ?? 0,
        title: (e.title as string) ?? `Event ${i + 1}`,
        description: (e.description as string) ?? undefined,
        importance: validateImportance(e.importance),
      };
    });
  }

  console.log(`[WorldSeed] Generated ${articles.length} articles, calendar: ${!!calendar}, events: ${events?.length ?? 0}`);
  return { articles, calendar, events };
}

// ─── Helpers ────────────────────────────────────────────────────────

function parseJsonResponse(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON in the response
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    // Try to repair truncated JSON by closing open brackets/braces
    const repaired = repairTruncatedJson(cleaned);
    if (repaired) {
      try {
        console.log("[JSON Repair] Successfully repaired truncated JSON");
        return JSON.parse(repaired);
      } catch { /* fall through */ }
    }
    return {};
  }
}

/**
 * Attempt to repair JSON that was truncated mid-stream.
 * Finds the last valid position and closes all open brackets/braces.
 */
function repairTruncatedJson(raw: string): string | null {
  // Find the start of JSON
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let json = raw.slice(start);

  // Remove any trailing incomplete string (find last complete value)
  // Trim back to the last comma, closing bracket, or complete value
  json = json.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, "");
  json = json.replace(/,\s*\{[^}]*$/, "");
  json = json.replace(/,\s*"[^"]*$/, "");

  // Count open vs close brackets
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of json) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // Close all remaining open brackets
  if (stack.length > 0) {
    json += stack.reverse().join("");
    return json;
  }

  return json;
}

function makeId(title: string): string {
  const base = title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 40);
  return `${base}_${Date.now().toString(36)}`;
}

function asArray(val: unknown): Record<string, unknown>[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is Record<string, unknown> => v != null && typeof v === "object");
}

function validateImportance(val: unknown): "minor" | "major" | "legendary" {
  if (val === "major" || val === "legendary") return val;
  return "minor";
}
