import { invoke } from "@tauri-apps/api/core";
import { useLoreStore } from "@/stores/loreStore";
import { AI_ENABLED } from "@/lib/featureFlags";
import { buildToneDirective } from "@/lib/loreGeneration";
import { buildRagContext, type RetrievalDiagnostic } from "@/lib/rag/loreContext";
import { resolveImageDataUrl } from "@/lib/useImageSrc";
import { llmCompleteWithVision } from "@/lib/llmVision";
import type {
  CalendarEra,
  CalendarSystem,
  LoreMap,
  TimelineEvent,
} from "@/types/lore";

export interface DeriveSource {
  id: string;
  kind: string;
  title: string;
  score: number;
}

export interface DeriveResult {
  /** Plain-text prose. The caller decides whether to write it directly to a
   *  string field or wrap it in TipTap JSON via `plainTextToTiptap`. */
  content: string;
  /** Articles / events pulled in as context, top first. */
  sources: DeriveSource[];
  /** Number of timeline events included (History only). Omitted otherwise. */
  eventCount?: number;
  /** Did RAG retrieval succeed (vs. falling back to legacy summary)? */
  usedRag: boolean;
}

const MAX_EVENTS = 100;
const EVENT_DESC_CAP = 220;

/**
 * Synthesize a world-history narrative from the lore corpus.
 *
 * Events are pulled deterministically and sorted chronologically (so the
 * narrative covers them all in order). Article and entity context is
 * pulled via RAG, biased toward the events themselves so retrieved
 * material is temporally adjacent.
 */
export async function deriveWorldHistory(): Promise<DeriveResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const lore = useLoreStore.getState().lore;
  if (!lore) throw new Error("No lore loaded.");

  const calendars = lore.calendarSystems ?? [];
  const events = lore.timelineEvents ?? [];

  const sortedEvents = [...events]
    .sort((a, b) => a.year - b.year)
    .slice(0, MAX_EVENTS);

  const eventLines = sortedEvents
    .map((e) => formatEventLine(e, calendars))
    .filter(Boolean)
    .join("\n");

  const eventTitles = sortedEvents.map((e) => e.title).filter(Boolean);

  // Bias RAG retrieval toward history / events. The query is broad enough
  // to pull dynasties, wars, founding articles even when no timeline
  // events exist; specific enough to skip random character bios.
  const query = [
    "world history — eras, ages, foundings, wars, dynasties, turning points",
    ...eventTitles.slice(0, 12),
  ].join("\n");

  const { context: ragContext, diagnostic } = await buildRagContext({
    query,
    k: 16,
    maxChars: 10000,
    fallback: () => "",
  });

  const tone = buildToneDirective();

  const systemPrompt = `You are a worldbuilding wiki editor synthesizing a fantasy world's recorded history.

Output a 3-6 paragraph world-history narrative suitable for the History section of a worldbuilding wiki. Rules:
- Synthesize ONLY from the provided timeline events and lore context. Do NOT invent events, names, or claims not present in the source material.
- Move chronologically from earliest to latest. Group adjacent events under their shared era where natural.
- Where you reference an event, person, place, or organisation that appears in the source artefacts, cite it inline in square brackets using its title — e.g. [Emberfell], [Tessikar].
- Voice should be evocative but grounded — a wiki overview, not a sales pitch. No second-person address ("you"), no editorial framing ("In this section…").
- Output plain prose. No markdown headings, no bullet points, no JSON, no preamble or trailing commentary.${tone ? `\n\nVoice directive:\n${tone}` : ""}`;

  const userPromptParts = [
    `Timeline events (chronological, ${sortedEvents.length} total):`,
    eventLines || "(no timeline events recorded yet)",
  ];
  if (ragContext) {
    userPromptParts.push("", "Related lore context:", ragContext);
  }
  userPromptParts.push("", "---", "Write the world history.");

  const result = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    maxTokens: 2048,
  });

  return {
    content: result.trim(),
    sources: summariseSources(diagnostic),
    eventCount: sortedEvents.length,
    usedRag: diagnostic.usedRag,
  };
}

function formatEventLine(
  event: TimelineEvent,
  calendars: CalendarSystem[],
): string {
  const era = findEra(event, calendars);
  const eraLabel = era ? ` (${era.name})` : "";
  const desc = event.description?.trim();
  const descBit = desc
    ? ` — ${desc.length > EVENT_DESC_CAP ? `${desc.slice(0, EVENT_DESC_CAP)}…` : desc}`
    : "";
  return `- Year ${event.year}${eraLabel}: ${event.title}${descBit}`;
}

function findEra(
  event: TimelineEvent,
  calendars: CalendarSystem[],
): CalendarEra | undefined {
  for (const c of calendars) {
    if (c.id !== event.calendarId) continue;
    const era = c.eras.find((e) => e.id === event.eraId);
    if (era) return era;
  }
  return undefined;
}

function summariseSources(diagnostic: RetrievalDiagnostic): DeriveSource[] {
  return diagnostic.sources.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    score: s.score,
  }));
}

interface FacetOptions {
  /** What the model is writing (e.g. "world overview", "magic system"). */
  facet: string;
  /** Single-sentence brief describing the target prose. */
  brief: string;
  /** Length guidance baked into the prompt. */
  lengthGuidance: string;
  /** Extra retrieval-bias terms (besides the structured world facts). */
  queryHints: string[];
  /** maxTokens for the LLM call. */
  maxTokens: number;
}

/**
 * Shared scaffolding for World Setting field derivations. Stitches the
 * structured world_setting fields (name/tagline/tone/era/themes) into a
 * deterministic header, biases RAG retrieval toward the facet, and asks
 * the LLM to synthesize prose without inventing facts.
 */
async function deriveWorldFacet(opts: FacetOptions): Promise<DeriveResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const lore = useLoreStore.getState().lore;
  if (!lore) throw new Error("No lore loaded.");

  const ws = Object.values(lore.articles).find((a) => a.template === "world_setting");
  const fields = ws?.fields ?? {};
  const name = typeof fields.name === "string" ? fields.name : "";
  const tagline = typeof fields.tagline === "string" ? fields.tagline : "";
  const tone = typeof fields.tone === "string" ? fields.tone : "";
  const era = typeof fields.era === "string" ? fields.era : "";
  const themes = Array.isArray(fields.themes)
    ? fields.themes.filter((t): t is string => typeof t === "string")
    : [];

  const headerLines: string[] = [];
  if (name) headerLines.push(`World name: ${name}`);
  if (tagline) headerLines.push(`Tagline: ${tagline}`);
  if (tone) headerLines.push(`Tone: ${tone}`);
  if (era) headerLines.push(`Current era: ${era}`);
  if (themes.length) headerLines.push(`Themes: ${themes.join(", ")}`);
  const worldHeader = headerLines.join("\n");

  const query = [opts.brief, name, tagline, ...themes, ...opts.queryHints]
    .filter(Boolean)
    .join("\n");

  const { context: ragContext, diagnostic } = await buildRagContext({
    query,
    k: 14,
    maxChars: 9000,
    fallback: () => "",
  });

  const toneDirective = buildToneDirective();

  const systemPrompt = `You are a worldbuilding wiki editor writing the ${opts.facet} section for a fantasy world.

${opts.brief}. ${opts.lengthGuidance}

Rules:
- Synthesize from the provided world facts and lore context. Do NOT invent peoples, places, factions, or claims absent from the source material.
- Where you reference a specific person, place, organisation, or event that appears in the source artefacts, cite it inline in square brackets — e.g. [Tessikar], [Emberfell].
- Voice should be evocative but grounded. No second-person address ("you"), no editorial framing ("In this section…"), no marketing puff.
- Output plain prose. No markdown headings, no bullet points, no JSON, no preamble.${toneDirective ? `\n\nVoice directive:\n${toneDirective}` : ""}`;

  const userPromptParts: string[] = [];
  if (worldHeader) {
    userPromptParts.push("Core world facts:", worldHeader);
  }
  if (ragContext) {
    userPromptParts.push("", "Related lore context:", ragContext);
  }
  if (!worldHeader && !ragContext) {
    userPromptParts.push("(No structured world facts or lore context available yet.)");
  }
  userPromptParts.push("", "---", `Write the ${opts.facet}.`);

  const result = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    maxTokens: opts.maxTokens,
  });

  return {
    content: result.trim(),
    sources: summariseSources(diagnostic),
    usedRag: diagnostic.usedRag,
  };
}

/** 1–3 paragraph elevator pitch synthesized across the lore corpus. */
export function deriveWorldOverview(): Promise<DeriveResult> {
  return deriveWorldFacet({
    facet: "world overview",
    brief:
      "Write the elevator-pitch overview for a worldbuilding wiki — defining features, peoples, conflicts, geography, magic, factions, tone",
    lengthGuidance:
      "Output 1-3 paragraphs. The first sentence should anchor what kind of world this is; subsequent sentences expand on tone, geography, factions, magic, and conflict.",
    queryHints: [
      "world overview defining features peoples conflicts geography magic factions",
    ],
    maxTokens: 1024,
  });
}

/** 2–4 paragraph synthesis of the world's magic system. */
export function deriveWorldMagicSystem(): Promise<DeriveResult> {
  return deriveWorldFacet({
    facet: "magic system",
    brief:
      "Describe how magic works in this world — its sources, costs, limits, who can wield it, the schools and traditions, and its place in society",
    lengthGuidance:
      "Output 2-4 paragraphs covering source / cost / limits, practitioners and traditions, and social attitudes toward magic.",
    queryHints: [
      "magic spells abilities schools traditions deities artefacts rituals magical sources costs limits",
    ],
    maxTokens: 1536,
  });
}

/**
 * Vision-backed synthesis of the world's geography. Sends the primary map
 * image to the vision LLM along with its pin metadata and a RAG-retrieved
 * slice of geography-tagged lore. The model is asked to reconcile what's
 * visible on the map with what's described in the articles — and to flag
 * contradictions inline rather than silently picking one.
 */
export async function deriveWorldGeography(): Promise<DeriveResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const lore = useLoreStore.getState().lore;
  if (!lore) throw new Error("No lore loaded.");

  const map = (lore.maps ?? [])[0];
  if (!map) {
    throw new Error(
      "No world map found. Add a map in the Maps panel before deriving Geography.",
    );
  }

  const imageDataUrl = await resolveImageDataUrl(map.imageAsset);
  if (!imageDataUrl) {
    throw new Error(
      `Could not load map image "${map.imageAsset}" — check that the file exists in your asset cache.`,
    );
  }

  const pinSummary = summarisePins(map, lore.articles ?? {});

  const ws = Object.values(lore.articles ?? {}).find(
    (a) => a.template === "world_setting",
  );
  const fields = ws?.fields ?? {};
  const name = typeof fields.name === "string" ? fields.name : "";
  const themes = Array.isArray(fields.themes)
    ? fields.themes.filter((t): t is string => typeof t === "string")
    : [];

  const query = [
    "world geography — continents, biomes, climate, regions, coastlines, landmarks, settlements",
    map.title,
    name,
    ...themes,
    ...pinSummary.titles.slice(0, 8),
  ]
    .filter(Boolean)
    .join("\n");

  const { context: ragContext, diagnostic } = await buildRagContext({
    query,
    k: 14,
    maxChars: 8000,
    fallback: () => "",
  });

  const toneDirective = buildToneDirective();

  const systemPrompt = `You are a worldbuilding wiki editor writing the Geography section for a fantasy world, using a world map image as primary visual reference plus textual lore as context.

Output 2-4 paragraphs covering the major continents and regions, the climate variation across them, and the notable landmarks and settlements. Rules:
- Reconcile what's visible on the map with what's stated in the lore. If the two disagree (e.g. an article calls a region "northern tundra" but its pin sits in the south-east), call it out inline as a flagged contradiction rather than picking a side.
- Synthesize only from the visual map and the provided lore context. Do NOT invent regions, peoples, or features absent from both.
- Where you reference a labelled location, region, or settlement that appears in the source artefacts, cite it inline in square brackets — e.g. [Kaerinlith], [Emberfell].
- Voice should be evocative but grounded. No second-person address ("you"), no editorial framing.
- Output plain prose. No markdown headings, no bullet points, no JSON, no preamble.${toneDirective ? `\n\nVoice directive:\n${toneDirective}` : ""}`;

  const userPromptParts: string[] = [
    `Primary map: "${map.title}" (${map.width}×${map.height} pixels)`,
  ];
  if (pinSummary.lines) {
    userPromptParts.push("", "Pinned features on this map:", pinSummary.lines);
  } else {
    userPromptParts.push("", "(No pins on this map yet.)");
  }
  if (ragContext) {
    userPromptParts.push("", "Geography-relevant lore context:", ragContext);
  }
  userPromptParts.push("", "---", "Write the world geography.");

  const result = await llmCompleteWithVision({
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    imageDataUrl,
    maxTokens: 1536,
  });

  return {
    content: result.trim(),
    sources: summariseSources(diagnostic),
    usedRag: diagnostic.usedRag,
  };
}

interface PinSummary {
  lines: string;
  titles: string[];
}

function summarisePins(
  map: LoreMap,
  articles: Record<string, { title: string }>,
): PinSummary {
  const titles: string[] = [];
  const lines = map.pins
    .map((p) => {
      const articleTitle = p.articleId ? articles[p.articleId]?.title : undefined;
      const label = p.label || articleTitle || p.id;
      if (articleTitle) titles.push(articleTitle);
      else if (p.label) titles.push(p.label);
      // Convert Leaflet CRS.Simple [lat, lng] → pixel coords (x from left, y from top).
      const lng = p.position[1];
      const lat = p.position[0];
      const px = Math.round(lng);
      const py = Math.round(map.height - lat);
      const linkBit = articleTitle && articleTitle !== label ? ` → ${articleTitle}` : "";
      return `- ${label} (px ${px},${py})${linkBit}`;
    })
    .join("\n");
  return { lines, titles };
}

/** 2–4 paragraph synthesis of the world's technology and civilisation. */
export function deriveWorldTechCiv(): Promise<DeriveResult> {
  return deriveWorldFacet({
    facet: "technology and civilisation",
    brief:
      "Describe the world's technological tier, social organisation, economic structure, and cultural shape of its peoples",
    lengthGuidance:
      "Output 2-4 paragraphs covering tech level (and how it interacts with magic if relevant), governance and economy, and the texture of daily life across the cultures present.",
    queryHints: [
      "civilisation culture technology craft trade governance economy settlement faction guild order",
    ],
    maxTokens: 1536,
  });
}
