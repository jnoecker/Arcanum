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
): Promise<RepairResult> {
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

  const parsed = parseZoneResponse(response, map);
  return repairZonePlanSuggestions(parsed, {
    width: map.width,
    height: map.height,
  });
}

// ─── Repair pass ────────────────────────────────────────────────────
//
// LLM output for spatial layouts is unreliable: borders are often
// non-reciprocal, names are sometimes duplicated, bboxes overlap or
// miss huge chunks of the map. This pass takes raw parsed suggestions
// and applies deterministic clean-up before they reach the user.

export interface MapDims {
  width: number;
  height: number;
}

export interface RepairResult {
  suggestions: ZonePlanSuggestion[];
  warnings: string[];
}

/**
 * Deterministic clean-up of LLM-generated zone suggestions.
 *
 * Pure function — no I/O, no LLM calls. Easy to unit-test.
 */
export function repairZonePlanSuggestions(
  raw: ZonePlanSuggestion[],
  map: MapDims,
): RepairResult {
  const warnings: string[] = [];

  // 1. Drop empties.
  let working = raw.filter((s) => s.name.trim().length > 0);

  // 2. Dedupe by case-insensitive name (keep first occurrence, merge borders).
  const byName = new Map<string, ZonePlanSuggestion>();
  for (const s of working) {
    const key = s.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...s, name: s.name.trim() });
      continue;
    }
    // Merge borders from the duplicate into the kept entry.
    const merged = new Set([...existing.borderNames, ...s.borderNames]);
    existing.borderNames = [...merged];
    if (s.hooks.length > existing.hooks.length) existing.hooks = s.hooks;
    if (s.blurb.length > existing.blurb.length) existing.blurb = s.blurb;
    warnings.push(`Merged duplicate zone "${s.name}".`);
  }
  working = [...byName.values()];

  // 3. Clip every region to map bounds and ensure positive size.
  working = working.map((s) => ({
    ...s,
    region: clipRegion(s.region, map),
  }));

  // 4. Drop borders that point at zones we don't have. Track survivors
  //    by lowercase name so cross-references stay consistent.
  const liveNames = new Set(working.map((s) => s.name.toLowerCase()));
  for (const s of working) {
    const filtered = s.borderNames.filter((b) =>
      liveNames.has(b.trim().toLowerCase()),
    );
    if (filtered.length !== s.borderNames.length) {
      warnings.push(
        `Dropped ${s.borderNames.length - filtered.length} unresolved border(s) on "${s.name}".`,
      );
    }
    s.borderNames = filtered;
  }

  // 5. Make borders reciprocal: if A → B, ensure B → A.
  const nameLookup = new Map<string, ZonePlanSuggestion>();
  for (const s of working) nameLookup.set(s.name.toLowerCase(), s);
  let addedReciprocal = 0;
  for (const a of working) {
    for (const bName of a.borderNames) {
      const b = nameLookup.get(bName.toLowerCase());
      if (!b) continue;
      const hasReverse = b.borderNames.some(
        (n) => n.toLowerCase() === a.name.toLowerCase(),
      );
      if (!hasReverse) {
        b.borderNames = [...b.borderNames, a.name];
        addedReciprocal++;
      }
    }
  }
  if (addedReciprocal > 0) {
    warnings.push(`Made ${addedReciprocal} border(s) reciprocal.`);
  }

  // 6. Drop self-borders.
  for (const s of working) {
    s.borderNames = s.borderNames.filter(
      (n) => n.toLowerCase() !== s.name.toLowerCase(),
    );
  }

  // 7. Coverage check (warning only — never silently mutate the layout).
  const mapArea = Math.max(1, map.width * map.height);
  const totalArea = working.reduce(
    (acc, s) => acc + s.region.w * s.region.h,
    0,
  );
  const coverage = totalArea / mapArea;
  if (coverage < 0.55) {
    warnings.push(
      `Zones cover only ${(coverage * 100).toFixed(0)}% of the map — large areas were skipped.`,
    );
  }

  // 8. Overlap check (warning only — overlap is sometimes intentional
  //    when zones are layered, so we don't auto-shrink).
  let overlapPairs = 0;
  for (let i = 0; i < working.length; i++) {
    for (let j = i + 1; j < working.length; j++) {
      const aRegion = working[i]!.region;
      const bRegion = working[j]!.region;
      const iou = intersectionOverUnion(aRegion, bRegion);
      if (iou > 0.5) overlapPairs++;
    }
  }
  if (overlapPairs > 0) {
    warnings.push(`${overlapPairs} pair(s) of zones heavily overlap.`);
  }

  return { suggestions: working, warnings };
}

function clipRegion(r: ZonePlanRegion, map: MapDims): ZonePlanRegion {
  const x = clamp(r.x, 0, map.width);
  const y = clamp(r.y, 0, map.height);
  const w = clamp(r.w, 1, map.width - x);
  const h = clamp(r.h, 1, map.height - y);
  return { x, y, w, h };
}

function intersectionOverUnion(
  a: ZonePlanRegion,
  b: ZonePlanRegion,
): number {
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.w, b.x + b.w);
  const iy2 = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const union = a.w * a.h + b.w * b.h - inter;
  if (union <= 0) return 0;
  return inter / union;
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
