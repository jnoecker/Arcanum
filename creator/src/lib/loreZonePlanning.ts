import { invoke } from "@tauri-apps/api/core";
import type { WorldLore, LoreMap, ZonePlan, ZonePlanRegion } from "@/types/lore";
import {
  cellRangeToPixelBox,
  chooseGridSpec,
  renderGridOverlay,
  type GridSpec,
} from "./gridOverlay";

// ─── Generation contract ────────────────────────────────────────────

export interface ZonePlanGenerationOptions {
  /** Target number of zones to break the world into. */
  targetCount?: number;
  /** Free-form tone/scope hint from the user. */
  toneHint?: string;
  /** Whether to feed existing world lore as context. */
  useLoreContext?: boolean;
  /**
   * Pre-render a labeled grid onto the map before sending it to the
   * vision model, then ask the model for grid-cell coordinates instead
   * of raw pixels. Dramatically improves spatial accuracy. Default: true.
   */
  useGridOverlay?: boolean;
  /**
   * After the main generation, run an additional LLM call asking the
   * model to verify and correct its own proposal against the image.
   * Costs one extra API call. Default: false.
   */
  selfCheck?: boolean;
  /**
   * Split generation into two LLM calls: first decide WHAT zones exist
   * and how they connect (text-only structure with cardinal direction
   * hints), then in a second call place those named zones onto the
   * grid. More reliable for complex maps but doubles cost. Default: false.
   */
  twoPass?: boolean;
}

/** Cardinal hint produced by the structure pass. */
type CardinalHint =
  | "NW" | "N" | "NE"
  | "W"  | "C" | "E"
  | "SW" | "S" | "SE";

interface StructureItem {
  name: string;
  blurb: string;
  hooks: string[];
  cardinal: CardinalHint;
  borderNames: string[];
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

function buildGridSystemPrompt(spec: GridSpec): string {
  const lastCol = String.fromCharCode(64 + spec.cols);
  return `You are a world-building cartographer AI. You will be shown a map image with a labeled grid overlay drawn on top of it. Use the grid to break the map into a set of high-level zones suitable for a MUD game.

The grid has ${spec.cols} columns labeled A through ${lastCol} and ${spec.rows} rows labeled 1 through ${spec.rows}. Each cell label appears in the top-left corner of its cell on the image. Refer to cells like "A1" (top-left), "${lastCol}${spec.rows}" (bottom-right), etc.

For each zone you propose, return:
- "name": a short evocative name (2-5 words)
- "blurb": a 1-2 sentence theme description capturing what this zone feels like and what's unique about it
- "hooks": 1-3 short bullet points seeding mob types, factions, or story hooks (each under 12 words)
- "colStart", "colEnd": the LEFTMOST and RIGHTMOST columns of the zone's bounding cells, as letters (e.g. "A", "C"). Both inclusive.
- "rowStart", "rowEnd": the TOPMOST and BOTTOMMOST rows of the zone's bounding cells, as integers 1-${spec.rows}. Both inclusive.
- "borders": an array of zone names (strings) that this zone borders or directly connects to. Each name MUST exactly match another zone in this same response. Borders must be reciprocal: if A lists B, B must list A.

Spatial rules — read carefully, this is the part models get wrong:
1. Use the grid you can see on the image. Identify the cells the zone occupies, then report the bounding cell range.
2. Spread zones across the map. Most maps want at least one zone in each populated quadrant — top-left, top-right, bottom-left, bottom-right, and the centre.
3. Together, the zones should cover roughly 70-95% of the map cells. It is fine to skip open ocean or impassable wastes.
4. Zones should not heavily overlap. Brief overlap at borders is okay; one zone fully contained inside another is not.
5. Use natural barriers (mountain ranges, rivers, coasts, forests) as zone boundaries when present. A zone should rarely cross a major mountain range or wide river.
6. Prefer existing labelled regions on the map. If a name appears on the map, use it.
7. Borders correspond to physical adjacency or named connections (passes, bridges, roads). A zone in column A should not border a zone in column ${lastCol} unless something on the map explicitly links them.

Author voice rules:
- Each zone should feel distinct from its neighbours. Avoid two zones with nearly the same theme.
- Hooks should be specific and evocative, not generic.

Output format:
- Output ONLY valid JSON, no markdown fences, no explanation, no trailing commentary.
- The response must be a single JSON object: { "zones": [ { ... }, ... ] }

Example output for a fictional ${spec.cols}-column × ${spec.rows}-row map:
{
  "zones": [
    {
      "name": "Frostspire Peaks",
      "blurb": "A jagged mountain range walling off the northern wastes. Snow never melts above the treeline.",
      "hooks": ["frost giants stir in deep crevasses", "abandoned dwarven holds"],
      "colStart": "B", "colEnd": "${spec.cols >= 5 ? "E" : lastCol}", "rowStart": 1, "rowEnd": 2,
      "borders": ["Verdant Plains"]
    },
    {
      "name": "Verdant Plains",
      "blurb": "Rolling grasslands south of the peaks, dotted with farming hamlets and standing stones.",
      "hooks": ["wandering wagon caravans", "harvest festivals turning sinister"],
      "colStart": "A", "colEnd": "${spec.cols >= 5 ? "D" : lastCol}", "rowStart": 3, "rowEnd": 4,
      "borders": ["Frostspire Peaks"]
    }
  ]
}`;
}

const SYSTEM_PROMPT = `You are a world-building cartographer AI. You will be shown a world map image and asked to break it into a set of high-level zones suitable for a MUD game.

For each zone you propose, return:
- "name": a short evocative name (2-5 words)
- "blurb": a 1-2 sentence theme description capturing what this zone feels like and what's unique about it
- "hooks": 1-3 short bullet points seeding mob types, factions, or story hooks (each under 12 words)
- "x", "y", "w", "h": approximate bounding box of the zone in PIXEL coordinates within the map image. (x, y) is the TOP-LEFT corner of the box measured from the top-left of the image — x grows rightward, y grows downward. w and h are width and height in pixels. All four values are non-negative integers.
- "borders": an array of zone names (strings) that this zone borders or directly connects to. Each name MUST exactly match another zone in this same response. Borders must be reciprocal: if A lists B, B must list A.

Spatial rules — read carefully, this is the part models get wrong:
1. The map has a finite width and height; you will be told them. Bboxes must stay inside (x + w ≤ width, y + h ≤ height).
2. Do not place every zone at (0,0) or near the centre. Spread the zones to cover the map. Consider the four quadrants and the centre — most maps want at least one zone in each populated quadrant.
3. Together, the zones should cover roughly 70-95% of the map area. It is fine to leave open ocean or impassable wastes uncovered, but do not leave large populated regions empty.
4. Zones should not heavily overlap. Brief overlap at borders is okay; one zone fully contained inside another is not.
5. Use natural barriers (mountain ranges, rivers, coasts, forests) as zone boundaries when present. A zone should rarely cross a major mountain range or wide river.
6. Prefer existing labelled regions on the map. If a name appears on the map, use it.
7. Borders correspond to physical adjacency or named connections (passes, bridges, roads). A zone in the far north should NOT border a zone in the far south unless something on the map explicitly links them.

Author voice rules:
- Each zone should feel distinct from its neighbours. Avoid two zones with nearly the same theme.
- Hooks should be specific and evocative, not generic ("displaced merchants peddling cursed relics", not "some merchants").

Output format:
- Output ONLY valid JSON, no markdown fences, no explanation, no trailing commentary.
- The response must be a single JSON object: { "zones": [ { ... }, ... ] }

Example output for a small fictional map (1000×800 pixels):
{
  "zones": [
    {
      "name": "Frostspire Peaks",
      "blurb": "A jagged mountain range walling off the northern wastes. Snow never melts above the treeline.",
      "hooks": ["frost giants stir in deep crevasses", "abandoned dwarven holds", "ice druids guard the high passes"],
      "x": 100, "y": 0, "w": 600, "h": 220,
      "borders": ["Verdant Plains", "Stormwood"]
    },
    {
      "name": "Verdant Plains",
      "blurb": "Rolling grasslands south of the peaks, dotted with farming hamlets and standing stones.",
      "hooks": ["wandering wagon caravans", "harvest festivals turning sinister", "stone circles humming at dusk"],
      "x": 100, "y": 220, "w": 500, "h": 280,
      "borders": ["Frostspire Peaks", "Stormwood", "Sunken Marsh"]
    },
    {
      "name": "Stormwood",
      "blurb": "A dense, perpetually overcast forest pressed against the eastern coast.",
      "hooks": ["lightning-blessed druids", "shipwreck salvagers on the shore", "treants that walk only at night"],
      "x": 600, "y": 100, "w": 400, "h": 400,
      "borders": ["Frostspire Peaks", "Verdant Plains", "Sunken Marsh"]
    },
    {
      "name": "Sunken Marsh",
      "blurb": "Brackish wetlands at the southern delta where two rivers meet the sea.",
      "hooks": ["lizardfolk tribes", "drowned temple ruins", "smuggler's poling boats"],
      "x": 200, "y": 500, "w": 700, "h": 300,
      "borders": ["Verdant Plains", "Stormwood"]
    }
  ]
}`;

/**
 * Build an anchor block from the map's existing pins. Pins are stored
 * in CRS.Simple coords (lat = height - y); convert back to top-left
 * pixel space so the model sees the same coordinate frame as its output.
 *
 * Anchors give the model concrete reference points to triangulate
 * against, which dramatically improves the rest of the placements.
 */
function buildAnchorBlock(map: LoreMap): string {
  if (!map.pins || map.pins.length === 0) return "";
  const lines: string[] = [];
  for (const pin of map.pins) {
    const label = (pin.label ?? "").trim();
    if (!label) continue;
    const [lat, lng] = pin.position;
    const x = Math.round(lng);
    const y = Math.round(map.height - lat);
    lines.push(`- "${label}" is at approximately (x=${x}, y=${y})`);
  }
  if (lines.length === 0) return "";
  return [
    "Known reference points on this map (use these as anchors when placing zones):",
    ...lines,
    "",
  ].join("\n");
}

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

// ─── Two-pass: structure pass ───────────────────────────────────────

const STRUCTURE_SYSTEM_PROMPT = `You are a world-building cartographer AI. You will be shown a world map image. Your job is the FIRST of two passes: identify the high-level zones the map should be broken into, but do NOT yet place them in coordinates. A separate placement pass will handle that.

For each zone, return:
- "name": a short evocative name (2-5 words)
- "blurb": a 1-2 sentence theme description
- "hooks": 1-3 short bullet points seeding mob types, factions, or story hooks
- "cardinal": which part of the map the zone occupies, one of: "NW", "N", "NE", "W", "C", "E", "SW", "S", "SE" (compass region)
- "borders": an array of zone names this one borders, must match other zone names in the response. Borders must be reciprocal.

Spatial reasoning rules:
- Spread zones across the map. Most maps want at least one zone in each populated compass region.
- Each zone should feel distinct from its neighbours.
- Borders correspond to physical adjacency. A zone in NW should not border a zone in SE unless something on the map links them.
- Use natural barriers and labelled regions when present.

Output ONLY valid JSON: { "zones": [ { "name": "...", "blurb": "...", "hooks": ["..."], "cardinal": "NW", "borders": ["..."] }, ... ] }`;

async function runStructurePass(
  map: LoreMap,
  imageDataUrl: string,
  lore: WorldLore,
  options: ZonePlanGenerationOptions,
): Promise<StructureItem[]> {
  const contextBlock = options.useLoreContext !== false
    ? buildLoreContextBlock(lore)
    : "";
  const countLine = options.targetCount
    ? `Target zone count: ${options.targetCount}.`
    : `Choose 5-12 zones based on map complexity.`;
  const toneLine = options.toneHint?.trim()
    ? `Author guidance: ${options.toneHint.trim()}`
    : "";

  const userPrompt = [
    `Map: "${map.title}"`,
    "",
    countLine,
    toneLine,
    "",
    contextBlock,
    "Identify the zones and their cardinal regions. JSON only.",
  ].join("\n");

  const response = await invoke<string>("llm_complete_with_vision", {
    systemPrompt: STRUCTURE_SYSTEM_PROMPT,
    userPrompt,
    imageDataUrl,
  });

  return parseStructureResponse(response);
}

function parseStructureResponse(response: string): StructureItem[] {
  const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try { parsed = JSON.parse(match[0]); } catch { return []; }
  }

  const root = parsed as { zones?: unknown };
  const zonesRaw = Array.isArray(root) ? root : root?.zones;
  if (!Array.isArray(zonesRaw)) return [];

  const valid: CardinalHint[] = ["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"];
  const out: StructureItem[] = [];
  for (const item of zonesRaw) {
    if (!item || typeof item !== "object") continue;
    const z = item as Record<string, unknown>;
    const name = String(z.name ?? "").trim();
    if (!name) continue;
    const cardinal = String(z.cardinal ?? "C").trim().toUpperCase() as CardinalHint;
    out.push({
      name,
      blurb: String(z.blurb ?? "").trim(),
      hooks: Array.isArray(z.hooks)
        ? (z.hooks as unknown[]).map((h) => String(h ?? "").trim()).filter(Boolean)
        : [],
      cardinal: valid.includes(cardinal) ? cardinal : "C",
      borderNames: Array.isArray(z.borders)
        ? (z.borders as unknown[]).map((b) => String(b ?? "").trim()).filter(Boolean)
        : [],
    });
  }
  return out;
}

// ─── Two-pass: placement pass ───────────────────────────────────────

async function runPlacementPass(
  structure: StructureItem[],
  gridDataUrl: string,
  spec: GridSpec,
): Promise<ZonePlanSuggestion[]> {
  const lastCol = String.fromCharCode(64 + spec.cols);
  const zoneList = structure
    .map((s) => `- "${s.name}" (cardinal hint: ${s.cardinal}) — ${s.blurb}`)
    .join("\n");

  const systemPrompt = `You are placing already-named zones onto a labeled grid map. The image shows a ${spec.cols}×${spec.rows} grid (columns A-${lastCol}, rows 1-${spec.rows}). Each cell label is drawn in the cell's top-left corner.

Place EVERY zone in the input list onto the grid by reporting its bounding cell range. Use the cardinal hint to guide your initial placement, then refine to fit terrain. Do not invent new zones. Do not skip any zones.

For each zone, return:
- "name": copy from the input exactly
- "colStart", "colEnd": leftmost/rightmost column letters (inclusive)
- "rowStart", "rowEnd": topmost/bottommost row numbers (inclusive)

Spatial rules:
- Together the zones should cover roughly 70-95% of the populated map cells.
- Zones should not heavily overlap.
- Respect natural barriers (mountains, rivers, coasts).
- A NW-cardinal zone should occupy the top-left quadrant; SE the bottom-right; etc.

Output ONLY valid JSON: { "zones": [ { "name": "...", "colStart": "A", "colEnd": "C", "rowStart": 1, "rowEnd": 3 }, ... ] }`;

  const userPrompt = [
    `Place these zones on the map:`,
    zoneList,
    "",
    `Reminder: place every one of the ${structure.length} zones. JSON only.`,
  ].join("\n");

  const response = await invoke<string>("llm_complete_with_vision", {
    systemPrompt,
    userPrompt,
    imageDataUrl: gridDataUrl,
  });

  // Parse cell ranges; merge with names + structure metadata.
  const placed = parseGridZoneResponse(response, spec);
  const placedByName = new Map<string, ZonePlanSuggestion>();
  for (const p of placed) placedByName.set(p.name.toLowerCase(), p);

  // Re-emit in structure order so missing placements stay missing
  // (and missing ones get a centred fallback so the user can see them).
  const out: ZonePlanSuggestion[] = [];
  structure.forEach((s, idx) => {
    const placement = placedByName.get(s.name.toLowerCase());
    if (placement) {
      // Take coords from placement, but blurb/hooks/borders from structure.
      out.push({
        ...placement,
        tempId: `zp_temp_${idx}`,
        name: s.name,
        blurb: s.blurb,
        hooks: s.hooks,
        borderNames: s.borderNames,
      });
    } else {
      // Fallback: place by cardinal hint as a coarse rectangle.
      out.push({
        tempId: `zp_temp_${idx}`,
        name: s.name,
        blurb: s.blurb,
        hooks: s.hooks,
        region: cardinalToRegion(s.cardinal, spec),
        borderNames: s.borderNames,
      });
    }
  });
  return out;
}

/** Coarse fallback bbox derived from a cardinal hint. */
function cardinalToRegion(cardinal: CardinalHint, spec: GridSpec): ZonePlanRegion {
  const cellW = spec.imageWidth / spec.cols;
  const cellH = spec.imageHeight / spec.rows;
  const third = (n: number) => Math.max(1, Math.floor(n / 3));
  const cThird = third(spec.cols);
  const rThird = third(spec.rows);

  let cMin = 0, cMax = cThird - 1, rMin = 0, rMax = rThird - 1;
  switch (cardinal) {
    case "N":  cMin = cThird; cMax = 2 * cThird - 1; rMin = 0; rMax = rThird - 1; break;
    case "NE": cMin = 2 * cThird; cMax = spec.cols - 1; rMin = 0; rMax = rThird - 1; break;
    case "W":  cMin = 0; cMax = cThird - 1; rMin = rThird; rMax = 2 * rThird - 1; break;
    case "C":  cMin = cThird; cMax = 2 * cThird - 1; rMin = rThird; rMax = 2 * rThird - 1; break;
    case "E":  cMin = 2 * cThird; cMax = spec.cols - 1; rMin = rThird; rMax = 2 * rThird - 1; break;
    case "SW": cMin = 0; cMax = cThird - 1; rMin = 2 * rThird; rMax = spec.rows - 1; break;
    case "S":  cMin = cThird; cMax = 2 * cThird - 1; rMin = 2 * rThird; rMax = spec.rows - 1; break;
    case "SE": cMin = 2 * cThird; cMax = spec.cols - 1; rMin = 2 * rThird; rMax = spec.rows - 1; break;
    case "NW":
    default:   cMin = 0; cMax = cThird - 1; rMin = 0; rMax = rThird - 1; break;
  }
  const x = Math.round(cMin * cellW);
  const yTop = Math.round(rMin * cellH);
  const w = Math.round((cMax - cMin + 1) * cellW);
  const h = Math.round((rMax - rMin + 1) * cellH);
  return {
    x,
    y: spec.imageHeight - yTop - h, // CRS.Simple
    w,
    h,
  };
}

// ─── Self-check refinement ──────────────────────────────────────────

const SELF_CHECK_SYSTEM_PROMPT = `You are reviewing your own previous proposal of map zones. You will be shown the same map image and your previous JSON output. Verify it against the image and return a CORRECTED version in the same format.

Things to check and fix:
- Are all border references reciprocal?
- Are any zones obviously misplaced (in the wrong quadrant of the image)?
- Are there large areas of the populated map left uncovered?
- Are any zones heavily overlapping when they shouldn't be?
- Does any border cross an impassable barrier (mountain range, wide sea)?

Return the same JSON format you used originally. Make minimal changes — only fix actual problems. Output JSON only.`;

async function runSelfCheckPass(
  suggestions: ZonePlanSuggestion[],
  imageDataUrl: string,
  mapOrSpec: { kind: "grid"; spec: GridSpec } | { kind: "raw"; map: LoreMap },
): Promise<ZonePlanSuggestion[]> {
  if (suggestions.length === 0) return suggestions;

  let payload: string;
  if (mapOrSpec.kind === "grid") {
    const spec = mapOrSpec.spec;
    const cellW = spec.imageWidth / spec.cols;
    const cellH = spec.imageHeight / spec.rows;
    const items = suggestions.map((s) => {
      const xTop = s.region.x;
      const yTop = spec.imageHeight - s.region.y - s.region.h;
      const c0 = Math.max(0, Math.min(spec.cols - 1, Math.floor(xTop / cellW)));
      const c1 = Math.max(0, Math.min(spec.cols - 1, Math.floor((xTop + s.region.w - 1) / cellW)));
      const r0 = Math.max(0, Math.min(spec.rows - 1, Math.floor(yTop / cellH)));
      const r1 = Math.max(0, Math.min(spec.rows - 1, Math.floor((yTop + s.region.h - 1) / cellH)));
      return {
        name: s.name,
        colStart: String.fromCharCode(65 + c0),
        colEnd: String.fromCharCode(65 + c1),
        rowStart: r0 + 1,
        rowEnd: r1 + 1,
        borders: s.borderNames,
      };
    });
    payload = JSON.stringify({ zones: items }, null, 2);
  } else {
    const map = mapOrSpec.map;
    const items = suggestions.map((s) => ({
      name: s.name,
      x: Math.round(s.region.x),
      y: Math.round(map.height - s.region.y - s.region.h),
      w: Math.round(s.region.w),
      h: Math.round(s.region.h),
      borders: s.borderNames,
    }));
    payload = JSON.stringify({ zones: items }, null, 2);
  }

  const userPrompt = [
    "Here is your previous proposal. Review it against the map and return a corrected version.",
    "",
    payload,
    "",
    "Output the corrected JSON only.",
  ].join("\n");

  const response = await invoke<string>("llm_complete_with_vision", {
    systemPrompt: SELF_CHECK_SYSTEM_PROMPT,
    userPrompt,
    imageDataUrl,
  });

  if (mapOrSpec.kind === "grid") {
    return parseGridZoneResponse(response, mapOrSpec.spec);
  } else {
    return parseZoneResponse(response, mapOrSpec.map);
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
    useGridOverlay = true,
    twoPass = false,
    selfCheck = false,
  } = options;

  // ─── Two-pass mode ──────────────────────────────────────────────
  // Topology first (text-only), then placement against the gridded map.
  // Always uses grid overlay for the placement pass since that's the
  // entire point — better spatial accuracy for known names.
  if (twoPass) {
    const structure = await runStructurePass(map, imageDataUrl, lore, options);
    if (structure.length === 0) {
      return { suggestions: [], warnings: ["Structure pass returned no zones."] };
    }
    const spec = chooseGridSpec(map.width, map.height);
    const overlay = await renderGridOverlay(imageDataUrl, spec);
    let placed = await runPlacementPass(structure, overlay.dataUrl, spec);
    if (selfCheck) {
      try {
        placed = await runSelfCheckPass(placed, overlay.dataUrl, { kind: "grid", spec });
      } catch (err) {
        console.warn("[zone-planner] self-check failed, keeping original:", err);
      }
    }
    return repairZonePlanSuggestions(placed, {
      width: map.width,
      height: map.height,
    });
  }

  const contextBlock = useLoreContext ? buildLoreContextBlock(lore) : "";
  const countLine = targetCount
    ? `Target zone count: ${targetCount} (you may produce 1-2 fewer or more if the geography demands it).`
    : `Choose a sensible number of zones (typically 5-12) based on map complexity.`;
  const toneLine = toneHint?.trim()
    ? `Author guidance: ${toneHint.trim()}`
    : "";

  // ─── Grid mode (single pass) ────────────────────────────────────
  if (useGridOverlay) {
    const spec = chooseGridSpec(map.width, map.height);
    const overlay = await renderGridOverlay(imageDataUrl, spec);
    const lastCol = String.fromCharCode(64 + spec.cols);

    const userPrompt = [
      `Map: "${map.title}"`,
      `The image has a labeled ${spec.cols}×${spec.rows} grid overlay (columns A-${lastCol}, rows 1-${spec.rows}).`,
      "",
      countLine,
      toneLine,
      "",
      buildAnchorBlockGrid(map, spec),
      contextBlock,
      "Identify the zones from the map, then for each zone report the bounding cell range using the visible grid labels. Respond with JSON only.",
    ].join("\n");

    const response = await invoke<string>("llm_complete_with_vision", {
      systemPrompt: buildGridSystemPrompt(spec),
      userPrompt,
      imageDataUrl: overlay.dataUrl,
    });

    let parsed = parseGridZoneResponse(response, spec);
    if (selfCheck && parsed.length > 0) {
      try {
        parsed = await runSelfCheckPass(parsed, overlay.dataUrl, { kind: "grid", spec });
      } catch (err) {
        console.warn("[zone-planner] self-check failed, keeping original:", err);
      }
    }
    return repairZonePlanSuggestions(parsed, {
      width: map.width,
      height: map.height,
    });
  }

  // ─── Legacy raw-pixel mode ──────────────────────────────────────
  const anchorBlock = buildAnchorBlock(map);
  const userPrompt = [
    `Map: "${map.title}"`,
    `Image dimensions: ${map.width} pixels wide × ${map.height} pixels tall.`,
    "",
    countLine,
    toneLine,
    "",
    anchorBlock,
    contextBlock,
    "Before answering, mentally divide the map into thirds vertically and horizontally so you can spread zones across all populated regions. Then respond with JSON only.",
  ].join("\n");

  const response = await invoke<string>("llm_complete_with_vision", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    imageDataUrl,
  });

  let parsed = parseZoneResponse(response, map);
  if (selfCheck && parsed.length > 0) {
    try {
      parsed = await runSelfCheckPass(parsed, imageDataUrl, { kind: "raw", map });
    } catch (err) {
      console.warn("[zone-planner] self-check failed, keeping original:", err);
    }
  }
  return repairZonePlanSuggestions(parsed, {
    width: map.width,
    height: map.height,
  });
}

// ─── Grid-mode helpers ──────────────────────────────────────────────

/**
 * Anchor block phrased in terms of grid cells. We translate each pin's
 * pixel position into the cell that contains it so the model can
 * reference anchors in the same vocabulary as its output.
 */
function buildAnchorBlockGrid(map: LoreMap, spec: GridSpec): string {
  if (!map.pins || map.pins.length === 0) return "";
  const cellW = map.width / spec.cols;
  const cellH = map.height / spec.rows;
  const lines: string[] = [];
  for (const pin of map.pins) {
    const label = (pin.label ?? "").trim();
    if (!label) continue;
    const [lat, lng] = pin.position;
    const x = lng;
    const y = map.height - lat;
    const c = Math.max(0, Math.min(spec.cols - 1, Math.floor(x / cellW)));
    const r = Math.max(0, Math.min(spec.rows - 1, Math.floor(y / cellH)));
    const cellLabel = `${String.fromCharCode(65 + c)}${r + 1}`;
    lines.push(`- "${label}" sits in cell ${cellLabel}`);
  }
  if (lines.length === 0) return "";
  return [
    "Known reference points on this map (use these as anchors):",
    ...lines,
    "",
  ].join("\n");
}

/**
 * Parse a grid-mode JSON response into ZonePlanSuggestions, translating
 * cell ranges into pixel bboxes (CRS.Simple coords).
 */
export function parseGridZoneResponse(
  response: string,
  spec: GridSpec,
): ZonePlanSuggestion[] {
  const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
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
      ? (z.hooks as unknown[]).map((h) => String(h ?? "").trim()).filter(Boolean)
      : [];

    const colStart = String(z.colStart ?? z.col_start ?? "").trim();
    const colEnd = String(z.colEnd ?? z.col_end ?? colStart).trim();
    const rowStart = Number(z.rowStart ?? z.row_start ?? 0);
    const rowEnd = Number(z.rowEnd ?? z.row_end ?? rowStart);

    const pixelBox = cellRangeToPixelBox(
      { colStart, colEnd, rowStart, rowEnd },
      spec,
    );
    if (!pixelBox) return;

    // Convert top-left pixel box to CRS.Simple (lat = height - y - h).
    const region: ZonePlanRegion = {
      x: pixelBox.x,
      y: spec.imageHeight - pixelBox.y - pixelBox.h,
      w: pixelBox.w,
      h: pixelBox.h,
    };

    const borderNames: string[] = Array.isArray(z.borders)
      ? (z.borders as unknown[]).map((b) => String(b ?? "").trim()).filter(Boolean)
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
