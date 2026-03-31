import { invoke } from "@tauri-apps/api/core";
import { useLoreStore } from "@/stores/loreStore";
import type { Article, ArticleTemplate, CalendarSystem, CalendarEra, TimelineEvent } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";

// ─── Prompts ────────────────────────────────────────────────────────

function worldContextSummary(): string {
  const articles = useLoreStore.getState().lore?.articles ?? {};
  const ws = Object.values(articles).find((a) => a.template === "world_setting");
  const parts: string[] = [];
  if (ws) {
    const name = typeof ws.fields.name === "string" ? ws.fields.name : "";
    if (name) parts.push(`World: ${name}`);
    const tagline = typeof ws.fields.tagline === "string" ? ws.fields.tagline : "";
    if (tagline) parts.push(tagline);
    if (ws.content) parts.push(ws.content.slice(0, 500));
  }
  // Summarize existing articles
  const existing = Object.values(articles)
    .filter((a) => a.template !== "world_setting")
    .slice(0, 20)
    .map((a) => `- ${TEMPLATE_SCHEMAS[a.template]?.label ?? a.template}: ${a.title}`)
    .join("\n");
  if (existing) parts.push(`\nExisting articles:\n${existing}`);
  return parts.join("\n") || "A fantasy MUD game world";
}

const ARTICLE_GEN_SYSTEM = `You are a world-building assistant for a fantasy MUD game.
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

const WORLD_SEED_SYSTEM = `You are a world-building assistant for a fantasy MUD game.
Given a concept paragraph, generate a complete starter world as JSON with this exact shape:
{
  "worldSetting": {
    "title": "string",
    "fields": { "name": "string", "tagline": "string", "era": "string", "themes": ["string"], "geography": "string", "magic": "string", "technology": "string", "history": "string" },
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

// ─── Article generation ─────────────────────────────────────────────

export interface GenerateArticleOptions {
  template: ArticleTemplate;
  concept: string;
}

export async function generateArticle(opts: GenerateArticleOptions): Promise<Article> {
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
    systemPrompt: ARTICLE_GEN_SYSTEM,
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
    systemPrompt: ARTICLE_GEN_SYSTEM.replace("Generate a complete article as JSON", "Generate an array of articles as JSON"),
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
  const result = await invoke<string>("llm_complete", {
    systemPrompt: WORLD_SEED_SYSTEM,
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
