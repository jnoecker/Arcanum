import { invoke } from "@tauri-apps/api/core";
import { useLoreStore } from "@/stores/loreStore";
import { AI_ENABLED } from "@/lib/featureFlags";
import { buildToneDirective } from "@/lib/loreGeneration";
import { buildRagContext, type RetrievalDiagnostic } from "@/lib/rag/loreContext";
import type { CalendarEra, CalendarSystem, TimelineEvent } from "@/types/lore";

export interface DeriveSource {
  id: string;
  kind: string;
  title: string;
  score: number;
}

export interface DeriveResult {
  /** Plain-text prose suitable for the `worldSetting.history` field. */
  content: string;
  /** Articles / events pulled in as context, top first. */
  sources: DeriveSource[];
  /** Number of timeline events included in the chronology. */
  eventCount: number;
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
