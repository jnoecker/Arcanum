import { invoke } from "@tauri-apps/api/core";
import type { WorldLore, LoreMap, ZonePlan, ZonePlanRegion } from "@/types/lore";

// ─── Generation contract ────────────────────────────────────────────

export interface ZonePlanGenerationOptions {
  /** Target number of zones to break the world into. */
  targetCount?: number;
  /** Free-form tone/scope hint from the user. */
  toneHint?: string;
  /** Whether to feed existing world lore as context. */
  useLoreContext?: boolean;
}

/**
 * A single AI suggestion. Not yet committed to the store. The panel
 * stages these in local state so the user can accept/reject before
 * adding them to `lore.zonePlans`.
 */
export interface ZonePlanSuggestion {
  /** Local ephemeral id used while staged in the UI. */
  tempId: string;
  name: string;
  blurb: string;
  hooks: string[];
  /** Region in CRS.Simple coords (lat = Y from bottom, lng = X from left). */
  region: ZonePlanRegion;
  /** Names of bordering zones, resolved against other suggestions by name. */
  borderNames: string[];
}

// ─── Prompt construction ────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a world-building cartographer AI. You will be shown a world map image and asked to break it into a set of high-level zones suitable for a MUD game.

For each zone you propose, return:
- "name": a short evocative name (2-5 words)
- "blurb": a 1-2 sentence theme description capturing what this zone feels like and what's unique about it
- "hooks": 1-3 short bullet points seeding mob types, factions, or story hooks (each under 12 words)
- "x", "y", "w", "h": approximate bounding box of the zone in PIXEL coordinates within the map image, where x and y are the TOP-LEFT corner measured from the top-left of the image (x from left, y from top). w and h are width and height in pixels.
- "borders": an array of zone names (strings, must match other zones in this same response) that this zone borders or directly connects to. Use intuitive geography: zones that are adjacent on the map, or that are linked by passes / rivers / roads. Connections must be reciprocal in spirit (if A borders B, B should also list A).

Important rules:
- Pick zones that make geographic and narrative sense given the map.
- Zones should not overlap heavily; cover the map roughly.
- Prefer named regions on the map when text labels exist; otherwise infer from terrain.
- Output ONLY valid JSON, no markdown fences, no explanation. The response must be a JSON object of the form: { "zones": [ { ... }, ... ] }`;

function buildLoreContextBlock(lore: WorldLore): string {
  const articles = Object.values(lore.articles ?? {}).filter((a) => !a.draft);
  if (articles.length === 0) return "";

  // Prioritize world setting, locations, organizations, species, events.
  const priority: Record<string, number> = {
    world_setting: 0,
    location: 1,
    organization: 2,
    species: 3,
    event: 4,
  };
  const sorted = [...articles].sort(
    (a, b) => (priority[a.template] ?? 9) - (priority[b.template] ?? 9),
  );

  const lines: string[] = [];
  for (const a of sorted.slice(0, 30)) {
    // Strip TipTap JSON to a brief plaintext-ish snippet (best effort).
    const text = stripTipTap(a.content).slice(0, 240);
    lines.push(`- [${a.template}] ${a.title}${text ? ` — ${text}` : ""}`);
  }
  return `Existing world lore (use to keep zones thematically consistent):\n${lines.join("\n")}\n`;
}

/** Best-effort TipTap-JSON → plaintext extraction. Falls back to raw string. */
function stripTipTap(content: string): string {
  if (!content) return "";
  if (!content.startsWith("{")) return content.replace(/\s+/g, " ").trim();
  try {
    const doc = JSON.parse(content) as { content?: unknown };
    const out: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as { type?: string; text?: string; content?: unknown[] };
      if (typeof n.text === "string") out.push(n.text);
      if (Array.isArray(n.content)) n.content.forEach(walk);
    };
    walk(doc);
    return out.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

// ─── Main entry ─────────────────────────────────────────────────────

export async function generateZonePlans(
  map: LoreMap,
  imageDataUrl: string,
  lore: WorldLore,
  options: ZonePlanGenerationOptions = {},
): Promise<ZonePlanSuggestion[]> {
  const {
    targetCount,
    toneHint,
    useLoreContext = true,
  } = options;

  const contextBlock = useLoreContext ? buildLoreContextBlock(lore) : "";
  const countLine = targetCount
    ? `Target zone count: ${targetCount} (you may produce 1-2 fewer or more if the geography demands it).`
    : `Choose a sensible number of zones (typically 5-12) based on map complexity.`;
  const toneLine = toneHint?.trim()
    ? `Author guidance: ${toneHint.trim()}`
    : "";

  const userPrompt = [
    `Map: "${map.title}" (${map.width}×${map.height} pixels)`,
    "",
    countLine,
    toneLine,
    "",
    contextBlock,
    "Break this map into high-level zones now. Respond with JSON only.",
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");

  const response = await invoke<string>("llm_complete_with_vision", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    imageDataUrl,
  });

  return parseZoneResponse(response, map);
}

// ─── Response parsing ───────────────────────────────────────────────

export function parseZoneResponse(
  response: string,
  map: LoreMap,
): ZonePlanSuggestion[] {
  const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Some models wrap JSON in extra prose; try to extract the first {...} block.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }

  const root = parsed as { zones?: unknown };
  const zonesRaw = Array.isArray(root) ? root : root?.zones;
  if (!Array.isArray(zonesRaw)) return [];

  const out: ZonePlanSuggestion[] = [];
  zonesRaw.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const z = item as Record<string, unknown>;

    const name = String(z.name ?? "").trim();
    if (!name) return;

    const blurb = String(z.blurb ?? "").trim();

    const hooks: string[] = Array.isArray(z.hooks)
      ? (z.hooks as unknown[])
          .map((h) => String(h ?? "").trim())
          .filter((h) => h.length > 0)
      : [];

    // Coordinates: model emits top-left x/y in pixels (from top of image).
    // Convert to CRS.Simple where lat = height - y, lng = x.
    const px = Number(z.x ?? 0);
    const py = Number(z.y ?? 0);
    const pw = Number(z.w ?? 0);
    const ph = Number(z.h ?? 0);

    const region: ZonePlanRegion = {
      x: clamp(px, 0, map.width),
      y: clamp(map.height - py - ph, 0, map.height),
      w: clamp(pw, 1, map.width),
      h: clamp(ph, 1, map.height),
    };

    const borderNames: string[] = Array.isArray(z.borders)
      ? (z.borders as unknown[])
          .map((b) => String(b ?? "").trim())
          .filter((b) => b.length > 0)
      : [];

    out.push({
      tempId: `zp_temp_${idx}`,
      name,
      blurb,
      hooks,
      region,
      borderNames,
    });
  });

  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// ─── Suggestion → committed ZonePlan ────────────────────────────────

/**
 * Convert staged suggestions into committed ZonePlan objects, resolving
 * borderNames to ZonePlan ids by matching names within the batch.
 */
export function suggestionsToZonePlans(
  suggestions: ZonePlanSuggestion[],
  mapId: string,
  accept: (s: ZonePlanSuggestion) => boolean = () => true,
): ZonePlan[] {
  const now = new Date().toISOString();
  const accepted = suggestions.filter(accept);

  // Build a name → id map for the batch.
  const nameToId = new Map<string, string>();
  const ids = accepted.map((s, i) => {
    const id = makeZonePlanId(s.name, i);
    nameToId.set(s.name.toLowerCase(), id);
    return id;
  });

  return accepted.map((s, i) => {
    const borders = s.borderNames
      .map((n) => nameToId.get(n.toLowerCase()))
      .filter((id): id is string => Boolean(id) && id !== ids[i]);

    return {
      id: ids[i]!,
      name: s.name,
      blurb: s.blurb,
      hooks: s.hooks.length > 0 ? s.hooks : undefined,
      mapId,
      region: s.region,
      borders: borders.length > 0 ? borders : undefined,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function makeZonePlanId(name: string, idx: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return `zp_${slug || "zone"}_${Date.now().toString(36)}_${idx}`;
}
