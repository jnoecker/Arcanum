import { invoke } from "@tauri-apps/api/core";
import type { WorldLore, Article } from "@/types/lore";
import { tiptapToPlainText } from "@/lib/loreRelations";
import { AI_ENABLED } from "@/lib/featureFlags";

export interface TimelineSuggestion {
  title: string;
  year: number;
  eraId: string;
  eraName: string;
  importance: "minor" | "major" | "legendary";
  articleId: string;
  articleTitle: string;
  evidence: string;
}

const SYSTEM_PROMPT = `You are a timeline analyst for a fantasy world-building tool. Given articles from a lore corpus and a calendar system, extract temporal references and suggest timeline events.

For each temporal reference found, output a JSON array of objects with:
- "title": short event title (max 60 chars)
- "year": numeric year in the calendar
- "eraId": which era this belongs to (from the provided era list)
- "importance": "minor", "major", or "legendary"
- "articleId": ID of the source article
- "evidence": the exact quote or paraphrase that indicates this temporal reference (max 100 chars)

Rules:
- Only extract events with specific or inferable dates/years
- For vague references like "during the Third Age", use the era's start year + a small offset
- For relative dates like "200 years before X", resolve against known events if possible, otherwise estimate
- Skip references that are too vague to place on a timeline
- Do NOT invent events — only extract what's in the text
- Output ONLY valid JSON array — no markdown, no explanation`;

export interface InferenceProgress {
  batch: number;
  totalBatches: number;
}

export async function inferTimelineEvents(
  lore: WorldLore,
  articleIds?: string[],
  onProgress?: (progress: InferenceProgress) => void,
): Promise<TimelineSuggestion[]> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const articles: Article[] = articleIds
    ? articleIds.reduce<Article[]>((acc, id) => {
        const a = lore.articles[id];
        if (a) acc.push(a);
        return acc;
      }, [])
    : Object.values(lore.articles).filter((a) => !a.draft);

  if (articles.length === 0) return [];

  const calendars = lore.calendarSystems ?? [];
  const existingEvents = lore.timelineEvents ?? [];

  // Build calendar context
  const calendarContext =
    calendars.length > 0
      ? calendars
          .map(
            (c) =>
              `Calendar: ${c.name}\nEras: ${c.eras.map((e) => `${e.name} (id: ${e.id}, starts year ${e.startYear})`).join(", ")}`,
          )
          .join("\n\n")
      : "No calendar system defined. Use year numbers directly and eraId 'unknown'.";

  // Build existing events context (so AI doesn't suggest duplicates)
  const existingContext =
    existingEvents.length > 0
      ? `\n\nExisting timeline events (do NOT suggest duplicates):\n${existingEvents.map((e) => `- Year ${e.year}: ${e.title}`).join("\n")}`
      : "";

  // Process in batches of 10 articles
  const batchSize = 10;
  const totalBatches = Math.ceil(articles.length / batchSize);
  const allSuggestions: TimelineSuggestion[] = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize) + 1;
    onProgress?.({ batch: batchIndex, totalBatches });

    const batch = articles.slice(i, i + batchSize);
    const articleContext = batch
      .map((a) => {
        const plainContent = tiptapToPlainText(a.content);
        const fields = Object.entries(a.fields)
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("\n");
        return `--- Article: ${a.title} (id: ${a.id}, template: ${a.template}) ---\nFields:\n${fields}\n\nContent:\n${plainContent.slice(0, 1000)}`;
      })
      .join("\n\n");

    const userPrompt = `${calendarContext}${existingContext}\n\n${articleContext}`;

    try {
      const response = await invoke<string>("llm_complete", {
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });

      // Parse JSON response — strip markdown fences if present
      const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const article = batch.find((a) => a.id === item.articleId);
          allSuggestions.push({
            title: String(item.title ?? ""),
            year: Number(item.year ?? 0),
            eraId: String(item.eraId ?? ""),
            eraName:
              calendars
                .flatMap((c) => c.eras)
                .find((e) => e.id === item.eraId)?.name ?? item.eraId,
            importance: ["minor", "major", "legendary"].includes(
              item.importance,
            )
              ? item.importance
              : "minor",
            articleId: String(item.articleId ?? ""),
            articleTitle: article?.title ?? item.articleId,
            evidence: String(item.evidence ?? ""),
          });
        }
      }
    } catch (err) {
      console.warn(`Timeline inference batch failed:`, err);
    }
  }

  // Dedup against existing events
  const existingKeys = new Set(
    existingEvents.map((e) => `${e.year}:${e.title.toLowerCase()}`),
  );
  return allSuggestions.filter(
    (s) => !existingKeys.has(`${s.year}:${s.title.toLowerCase()}`),
  );
}
