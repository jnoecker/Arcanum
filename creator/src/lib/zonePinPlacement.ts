import { compassLayout, getLayoutBounds } from "@/lib/dagreLayout";
import { llmCompleteWithVision } from "@/lib/llmVision";
import { zoneToGraph } from "@/lib/zoneToGraph";
import type { WorldFile } from "@/types/world";
import type { LoreMap, MapPin } from "@/types/lore";

export const ZONE_LORE_MAP_WIDTH = 1920;
export const ZONE_LORE_MAP_HEIGHT = 1080;

/**
 * Generate `count` distinct, parchment-friendly pin colors by walking the hue
 * wheel with the golden-angle increment (137.5°). Saturation/lightness held
 * fixed so swatches pop against the map without clashing.
 */
function distinctPinColors(count: number): string[] {
  const out: string[] = [];
  const goldenAngle = 137.508;
  const startHue = 22; // start near ember to harmonize with the default accent
  for (let i = 0; i < count; i++) {
    const hue = (startHue + i * goldenAngle) % 360;
    const sat = 78;
    const light = 52;
    out.push(hslToHex(hue, sat, light));
  }
  return out;
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = lN - c / 2;
  const to8 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to8(r)}${to8(g)}${to8(b)}`;
}

const SYSTEM_PROMPT = `You are a cartographer locating rooms on an illustrated fantasy zone map.

You will receive:
- The map image (one painted scene depicting a single zone).
- A numbered list of rooms with titles and short descriptions.

Each room corresponds to one painted area on the map: a building, chamber, garden, courtyard, archway, etc. Pick the single most plausible spot for each room and return its center as a normalized coordinate.

Coordinate system:
- Use a 0–1000 grid covering the entire visible image, regardless of pixel size.
- "x" = horizontal position from the LEFT edge of the image (0 = left edge, 1000 = right edge).
- "y" = vertical position from the TOP edge of the image (0 = top edge, 1000 = bottom edge).
- Use the FULL range. Rooms drawn near the right edge should have x close to 1000; rooms near the bottom should have y close to 1000. Do not bias toward the center.

Output rules:
- Return ONLY a JSON array. No markdown, no prose.
- One object per room you can confidently place. Skip rooms you cannot locate — do not guess.
- Each object: { "id": <room id string>, "x": <int 0..1000>, "y": <int 0..1000>, "confidence": "high" | "medium" | "low" }
- A pin should land roughly on the visual center of the painted feature for that room.`;

export interface VisionPinResult {
  pins: MapPin[];
  placed: number;
  skipped: string[];
}

/**
 * Ask the vision LLM to locate each room on the painted zone map and return
 * MapPin entries in Leaflet CRS.Simple coordinates.
 */
export async function placeRoomPinsWithVision(
  world: WorldFile,
  imageDataUrl: string,
  imgWidth: number,
  imgHeight: number,
): Promise<VisionPinResult> {
  const rooms = Object.entries(world.rooms).map(([id, room]) => ({
    id,
    title: room.title,
    description: room.description,
  }));

  if (rooms.length === 0) return { pins: [], placed: 0, skipped: [] };

  const roomList = rooms
    .map((r, i) => {
      const desc = (r.description ?? "").trim().replace(/\s+/g, " ").slice(0, 240);
      return `${i + 1}. id="${r.id}" — ${r.title}${desc ? `: ${desc}` : ""}`;
    })
    .join("\n");

  const userPrompt = `Zone: "${world.zone}"

Rooms (${rooms.length}):
${roomList}

Locate each room on the map. Use the full 0–1000 coordinate range — do not cluster pins in any one region of the image. Return JSON as specified.`;

  const response = await llmCompleteWithVision({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    imageDataUrl,
  });

  const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return { pins: [], placed: 0, skipped: rooms.map((r) => r.id) };

  const placedIds = new Set<string>();
  const pins: MapPin[] = [];

  for (const item of parsed) {
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : null;
    if (!id || !world.rooms[id] || placedIds.has(id)) continue;

    const xNorm = Number(rec.x);
    const yNorm = Number(rec.y);
    if (!Number.isFinite(xNorm) || !Number.isFinite(yNorm)) continue;

    const clampedXNorm = Math.max(0, Math.min(1000, xNorm));
    const clampedYNorm = Math.max(0, Math.min(1000, yNorm));
    const px = (clampedXNorm / 1000) * imgWidth;
    const py = (clampedYNorm / 1000) * imgHeight;
    const lat = imgHeight - py;
    const lng = px;

    pins.push({
      id: `pin_${id}`,
      label: world.rooms[id]!.title,
      position: [lat, lng],
    });
    placedIds.add(id);
  }

  const skipped = rooms.map((r) => r.id).filter((id) => !placedIds.has(id));
  return { pins, placed: pins.length, skipped };
}

/** Pin placement from the abstract compass/dagre layout. Used as a fallback. */
export function placeRoomPinsFromLayout(
  world: WorldFile,
  imgWidth: number,
  imgHeight: number,
): MapPin[] {
  const { nodes } = zoneToGraph(world);
  const realNodes = nodes.filter((n) => !n.id.startsWith("xzone:"));
  const laid = compassLayout(realNodes, world);
  const bounds = getLayoutBounds(laid);
  if (!bounds || bounds.width === 0 || bounds.height === 0) return [];

  const pad = 0.08;
  const usableW = imgWidth * (1 - 2 * pad);
  const usableH = imgHeight * (1 - 2 * pad);
  const scaleX = usableW / bounds.width;
  const scaleY = usableH / bounds.height;

  return laid
    .filter((n) => world.rooms[n.id])
    .map((n) => {
      const room = world.rooms[n.id]!;
      const nx = (n.position.x - bounds.x) * scaleX + imgWidth * pad;
      const ny = (n.position.y - bounds.y) * scaleY + imgHeight * pad;
      const lat = imgHeight - ny;
      const lng = nx;
      return {
        id: `pin_${n.id}`,
        label: room.title,
        position: [lat, lng] as [number, number],
      };
    });
}

export interface CreateLoreMapFromZoneArgs {
  world: WorldFile;
  zoneId: string;
  /** Painted zone-map image as a data URL. Required for vision placement. */
  imageDataUrl: string | null;
  /** Whether an LLM key is configured for vision calls. */
  hasLlmKey: boolean;
}

export interface CreateLoreMapFromZoneResult {
  map: LoreMap;
  note: string;
}

/**
 * Build a LoreMap from a zone's painted zone-map asset, placing one pin per
 * room. Uses vision when possible; falls back to the abstract layout grid.
 * Caller is responsible for wiring the returned map into the lore store.
 */
export async function createLoreMapFromZone(
  args: CreateLoreMapFromZoneArgs,
): Promise<CreateLoreMapFromZoneResult> {
  const { world, zoneId, imageDataUrl, hasLlmKey } = args;
  const mapAsset = world.image?.zoneMap;
  if (!mapAsset) throw new Error("Zone has no zoneMap image to base the lore map on.");

  const totalRooms = Object.keys(world.rooms).length;
  let pins: MapPin[] = [];
  let note: string;

  if (hasLlmKey && imageDataUrl) {
    try {
      const result = await placeRoomPinsWithVision(
        world,
        imageDataUrl,
        ZONE_LORE_MAP_WIDTH,
        ZONE_LORE_MAP_HEIGHT,
      );
      if (result.placed === 0) {
        pins = placeRoomPinsFromLayout(world, ZONE_LORE_MAP_WIDTH, ZONE_LORE_MAP_HEIGHT);
        note = "Vision placement returned no pins — used layout grid instead.";
      } else {
        pins = result.pins;
        note =
          result.skipped.length > 0
            ? `Placed ${result.placed} of ${totalRooms} pins by vision (${result.skipped.length} skipped).`
            : `Placed ${result.placed} pins by vision.`;
      }
    } catch (e) {
      pins = placeRoomPinsFromLayout(world, ZONE_LORE_MAP_WIDTH, ZONE_LORE_MAP_HEIGHT);
      note = `Vision placement failed (${String(e)}); used layout grid instead.`;
    }
  } else {
    pins = placeRoomPinsFromLayout(world, ZONE_LORE_MAP_WIDTH, ZONE_LORE_MAP_HEIGHT);
    note = hasLlmKey
      ? "Map image unavailable — pins placed by layout grid."
      : "No LLM key — pins placed by layout grid. Configure an LLM provider for vision-based placement.";
  }

  const palette = distinctPinColors(pins.length);
  pins = pins.map((pin, i) => ({ ...pin, color: palette[i] }));

  const map: LoreMap = {
    id: `map_zone_${zoneId}_${Date.now()}`,
    title: `${world.zone || zoneId} Map`,
    imageAsset: mapAsset,
    width: ZONE_LORE_MAP_WIDTH,
    height: ZONE_LORE_MAP_HEIGHT,
    pins,
  };

  return { map, note };
}
