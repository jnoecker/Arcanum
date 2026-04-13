import { invoke } from "@tauri-apps/api/core";
import type { WorldLore, LoreMap } from "@/types/lore";
import { AI_ENABLED } from "@/lib/featureFlags";

export interface MapFeatureSuggestion {
  label: string;
  x: number;
  y: number;
  matchedArticleId?: string;
  matchedArticleTitle?: string;
  suggestNewArticle: boolean;
  confidence: "high" | "medium" | "low";
}

const SYSTEM_PROMPT = `You are a cartographer AI analyzing a fantasy world map image. Your task is to identify labeled locations, notable geographic features, and points of interest.

For each feature you identify, estimate its pixel coordinates within the image. The image dimensions are provided — use them to estimate x (horizontal, from left) and y (vertical, from top) positions.

Also provided is a list of existing lore articles. Match identified features to article titles where possible.

Output a JSON array of objects with:
- "label": the name/label of the feature (as readable text from the map, or a descriptive name for unlabeled features)
- "x": estimated x pixel coordinate (from left edge)
- "y": estimated y pixel coordinate (from top edge)
- "matchedArticle": title of the matching lore article, or null if no match
- "confidence": "high" (clearly labeled text), "medium" (partially readable or geographic feature), "low" (inferred/uncertain)
- "type": "city", "region", "mountain", "river", "forest", "landmark", or "other"

Focus on:
1. Readable text labels on the map (highest priority)
2. Major geographic features (mountain ranges, rivers, coastlines, forests)
3. Notable structures or landmarks

Output ONLY valid JSON array — no markdown, no explanation.`;

export async function analyzeMap(
  map: LoreMap,
  imageDataUrl: string,
  lore: WorldLore,
): Promise<MapFeatureSuggestion[]> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const articleTitles = Object.values(lore.articles)
    .filter((a) => !a.draft)
    .map((a) => ({ id: a.id, title: a.title, template: a.template }));

  const existingPins = map.pins.map((p) => p.label ?? p.id).join(", ");

  const userPrompt = `Map: "${map.title}" (${map.width}×${map.height} pixels)

Existing pins: ${existingPins || "none"}

Lore articles to match against:
${articleTitles.map((a) => `- ${a.title} (${a.template})`).join("\n")}

Identify features on this map and estimate their pixel coordinates.`;

  const response = await invoke<string>("llm_complete_with_vision", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    imageDataUrl,
  });

  // Parse JSON response — strip markdown fences if present
  const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) return [];

  // Build title→id lookup (case-insensitive)
  const titleToId = new Map<string, string>();
  const titleToOriginal = new Map<string, string>();
  for (const a of articleTitles) {
    titleToId.set(a.title.toLowerCase(), a.id);
    titleToOriginal.set(a.title.toLowerCase(), a.title);
  }

  return parsed.map((item: Record<string, unknown>) => {
    const matchTitle =
      typeof item.matchedArticle === "string"
        ? item.matchedArticle.toLowerCase()
        : undefined;
    const matchId = matchTitle ? titleToId.get(matchTitle) : undefined;
    const matchOriginal = matchTitle
      ? titleToOriginal.get(matchTitle)
      : undefined;

    // Convert pixel coords to Leaflet CRS.Simple: lat = height - y, lng = x
    const lng = Number(item.x ?? 0);
    const lat = map.height - Number(item.y ?? 0);

    return {
      label: String(item.label ?? "Unknown"),
      x: lng,
      y: lat,
      matchedArticleId: matchId,
      matchedArticleTitle: matchOriginal,
      suggestNewArticle: !matchId,
      confidence: ["high", "medium", "low"].includes(
        item.confidence as string,
      )
        ? (item.confidence as "high" | "medium" | "low")
        : "medium",
    };
  });
}
