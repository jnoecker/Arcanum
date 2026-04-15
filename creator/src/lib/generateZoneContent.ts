import { invoke } from "@tauri-apps/api/core";
import type { WorldFile, RoomFile, MobFile, ItemFile } from "@/types/world";
import { buildToneDirective } from "./loreGeneration";
import { OPPOSITE } from "./zoneEdits";
import { AI_ENABLED } from "@/lib/featureFlags";
import { generateGridLayout } from "./gridGenerator";

// ─── Types ──────────────────────────────────────────────────────

export interface ZoneGenerationParams {
  zoneName: string;
  zoneTheme: string;
  /** Optional free-form background context (e.g. "follows from the cathedral") */
  backgroundContext?: string;
  worldTheme: string;
  roomCount: number;
  mobCount: number;
  itemCount: number;
  statNames: string[];
  equipmentSlots: string[];
  classNames: string[];
}

/** A caller-supplied layout. When present, the LLM flavors these rooms instead of inventing its own. */
export interface FixedLayout {
  rooms: FixedLayoutRoom[];
}

export interface FixedLayoutRoom {
  /** Final room ID (already sanitized). */
  id: string;
  /** Optional label from a sketch — used as a hint for the LLM. */
  hint?: string | null;
  /** Pre-built exits for this room (snake-case direction → target room ID). */
  exits: Record<string, string>;
}

export interface ExtendZoneParams extends ZoneGenerationParams {
  /** Rooms that already exist in the target zone — used to match style. */
  existingRoomSamples: Array<{ id: string; title: string; description: string }>;
  /** Existing zone vibe text (from vibeStore), if any. */
  existingVibe?: string;
}

// ─── Parsed LLM response shape ──────────────────────────────────

interface LlmRoom {
  id: string;
  title: string;
  description: string;
  exits?: Record<string, string>;
}

interface LlmMob {
  id: string;
  name: string;
  description: string;
  tier: string;
  room: string;
}

interface LlmItem {
  id: string;
  displayName: string;
  description: string;
  slot?: string;
  damage?: number;
  armor?: number;
  stats?: Record<string, number>;
  room?: string;
}

interface GeneratedZoneContent {
  rooms: LlmRoom[];
  mobs: LlmMob[];
  items: LlmItem[];
}

// ─── Fixed room topologies (≤ 8 rooms) ──────────────────────────
// For small zones these hand-authored layouts render very cleanly under dagre.
// Larger zones let the LLM author their own exits.

interface ExitLink {
  from: number;
  to: number;
  dir: string;
  reverse: string;
}

const TOPOLOGIES: Record<number, ExitLink[]> = {
  3: [
    { from: 0, to: 1, dir: "n", reverse: "s" },
    { from: 1, to: 2, dir: "n", reverse: "s" },
  ],
  4: [
    { from: 0, to: 1, dir: "n", reverse: "s" },
    { from: 0, to: 2, dir: "w", reverse: "e" },
    { from: 0, to: 3, dir: "e", reverse: "w" },
  ],
  5: [
    { from: 0, to: 1, dir: "n", reverse: "s" },
    { from: 0, to: 2, dir: "s", reverse: "n" },
    { from: 0, to: 3, dir: "w", reverse: "e" },
    { from: 0, to: 4, dir: "e", reverse: "w" },
  ],
  6: [
    { from: 0, to: 1, dir: "e", reverse: "w" },
    { from: 1, to: 2, dir: "e", reverse: "w" },
    { from: 1, to: 4, dir: "s", reverse: "n" },
    { from: 3, to: 4, dir: "e", reverse: "w" },
    { from: 4, to: 5, dir: "e", reverse: "w" },
  ],
  7: [
    { from: 0, to: 1, dir: "e", reverse: "w" },
    { from: 1, to: 2, dir: "e", reverse: "w" },
    { from: 1, to: 4, dir: "s", reverse: "n" },
    { from: 3, to: 4, dir: "e", reverse: "w" },
    { from: 4, to: 5, dir: "e", reverse: "w" },
    { from: 4, to: 6, dir: "s", reverse: "n" },
  ],
  8: [
    { from: 0, to: 1, dir: "e", reverse: "w" },
    { from: 1, to: 2, dir: "e", reverse: "w" },
    { from: 0, to: 3, dir: "s", reverse: "n" },
    { from: 2, to: 5, dir: "s", reverse: "n" },
    { from: 3, to: 6, dir: "s", reverse: "n" },
    { from: 6, to: 7, dir: "e", reverse: "w" },
    { from: 4, to: 7, dir: "s", reverse: "n" },
    { from: 4, to: 1, dir: "n", reverse: "s" },
  ],
};

const SMALL_TOPOLOGY_LIMIT = 8;

function applyHandTopology(rooms: LlmRoom[]): Record<string, RoomFile> {
  const topology = TOPOLOGIES[rooms.length] ?? [];
  const result: Record<string, RoomFile> = {};

  for (const room of rooms) {
    result[room.id] = {
      title: room.title,
      description: room.description,
      exits: {},
    };
  }

  for (const link of topology) {
    const fromRoom = rooms[link.from];
    const toRoom = rooms[link.to];
    if (!fromRoom || !toRoom) continue;
    result[fromRoom.id]!.exits![link.dir] = toRoom.id;
    result[toRoom.id]!.exits![link.reverse] = fromRoom.id;
  }

  // Fallback: linear chain if no hand-authored topology for this size
  if (rooms.length >= 2 && rooms.length < 3) {
    result[rooms[0]!.id]!.exits!["e"] = rooms[1]!.id;
    result[rooms[1]!.id]!.exits!["w"] = rooms[0]!.id;
  }

  return result;
}

// ─── Graph repair for LLM-authored exits ────────────────────────
// The LLM may produce dangling exits, non-bidirectional pairs, or leave rooms
// disconnected. We repair the graph so every room is reachable from the start.

const DIR_OFFSET_2D: Record<string, [number, number]> = {
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0],
  ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1],
};

function repairExitGraph(rooms: LlmRoom[]): Record<string, RoomFile> {
  if (rooms.length === 0) return {};

  const result: Record<string, RoomFile> = {};
  const roomIds = new Set(rooms.map((r) => r.id));

  for (const room of rooms) {
    result[room.id] = {
      title: room.title,
      description: room.description,
      exits: {},
    };
  }

  // Trial grid for geometric consistency. An exit A→dir→B is only accepted
  // if the cell it implies for B is either empty or already occupied by B.
  // u/d are exempt: they don't participate in 2D placement.
  const gridPos = new Map<string, [number, number]>();
  const gridCell = new Map<string, string>();
  if (rooms[0]) {
    gridPos.set(rooms[0].id, [0, 0]);
    gridCell.set("0,0", rooms[0].id);
  }

  function tryPlace(parentId: string, dir: string, childId: string): boolean {
    const offset = DIR_OFFSET_2D[dir];
    if (!offset) return true; // u/d: not grid-embedded, always allowed
    const parentPos = gridPos.get(parentId);
    if (!parentPos) return true; // parent not yet placed; skip consistency check
    const [px, py] = parentPos;
    const cx = px + offset[0];
    const cy = py + offset[1];
    const key = `${cx},${cy}`;
    const existing = gridPos.get(childId);
    if (existing) {
      return existing[0] === cx && existing[1] === cy;
    }
    const occupant = gridCell.get(key);
    if (occupant && occupant !== childId) return false;
    gridPos.set(childId, [cx, cy]);
    gridCell.set(key, childId);
    return true;
  }

  // Phase 1 — prioritize cardinals, then diagonals, then vertical, so the
  // most load-bearing directions pin the trial grid first.
  const DIR_PRIORITY: Record<string, number> = {
    n: 0, s: 0, e: 0, w: 0,
    ne: 1, nw: 1, se: 1, sw: 1,
    u: 2, d: 2,
  };
  type Candidate = { from: string; dir: string; to: string; priority: number };
  const candidates: Candidate[] = [];
  for (const room of rooms) {
    if (!room.exits) continue;
    for (const [rawDir, target] of Object.entries(room.exits)) {
      const dir = rawDir.toLowerCase();
      if (!OPPOSITE[dir]) continue;
      if (!roomIds.has(target)) continue;
      if (target === room.id) continue;
      candidates.push({
        from: room.id,
        dir,
        to: target,
        priority: DIR_PRIORITY[dir] ?? 99,
      });
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);

  for (const { from, dir, to } of candidates) {
    if (result[from]!.exits![dir]) continue;
    const rev = OPPOSITE[dir]!;
    const existingRev = result[to]!.exits![rev];
    if (existingRev && existingRev !== from) continue;
    if (!tryPlace(from, dir, to)) continue;
    result[from]!.exits![dir] = to;
    result[to]!.exits![rev] = from;
  }

  // Phase 2 — check connectivity from first room, attach orphans
  const visited = new Set<string>();
  const queue: string[] = [rooms[0]!.id];
  visited.add(rooms[0]!.id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const exits = result[current]?.exits ?? {};
    for (const rawTarget of Object.values(exits)) {
      // We only ever write string exits in this function, but the type union
      // includes ExitValue — narrow here.
      const target = typeof rawTarget === "string" ? rawTarget : rawTarget.to;
      if (!visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }

  const orphans = rooms.filter((r) => !visited.has(r.id));
  if (orphans.length === 0) return result;

  // Attach each orphan to a room in the connected set via a cardinal that
  // leaves the trial grid geometrically consistent.
  const CARDINALS = ["n", "s", "e", "w"];
  const connected = [...visited];
  for (const orphan of orphans) {
    let attached = false;
    for (const anchorId of connected) {
      const anchor = result[anchorId]!;
      for (const dir of CARDINALS) {
        if (anchor.exits![dir]) continue;
        const rev = OPPOSITE[dir]!;
        if (result[orphan.id]!.exits![rev]) continue;
        if (!tryPlace(anchorId, dir, orphan.id)) continue;
        anchor.exits![dir] = orphan.id;
        result[orphan.id]!.exits![rev] = anchorId;
        connected.push(orphan.id);
        attached = true;
        break;
      }
      if (attached) break;
    }
    if (!attached) {
      // Vertical fallback: u/d don't touch the trial grid.
      const first = result[rooms[0]!.id]!;
      if (!first.exits!["u"]) {
        first.exits!["u"] = orphan.id;
        result[orphan.id]!.exits!["d"] = rooms[0]!.id;
        connected.push(orphan.id);
      } else if (!first.exits!["d"]) {
        first.exits!["d"] = orphan.id;
        result[orphan.id]!.exits!["u"] = rooms[0]!.id;
        connected.push(orphan.id);
      }
    }
  }

  return result;
}

// ─── Apply caller-supplied fixed layout (from a sketch) ─────────

function applyFixedLayout(
  rooms: LlmRoom[],
  layout: FixedLayout,
): Record<string, RoomFile> {
  const result: Record<string, RoomFile> = {};
  const layoutById = new Map(layout.rooms.map((r) => [r.id, r]));

  for (const room of rooms) {
    const layoutRoom = layoutById.get(room.id);
    result[room.id] = {
      title: room.title,
      description: room.description,
      exits: layoutRoom ? { ...layoutRoom.exits } : {},
    };
  }

  return result;
}

// ─── LLM prompts ────────────────────────────────────────────────

const ROOM_DESCRIPTION_GUIDANCE =
  "Room descriptions should be 1-2 sentences, vivid and atmospheric, giving the player something to picture without dumping exposition.";

const SYSTEM_PROMPT_SMALL = `You are a creative game content designer for a text-based MUD (Multi-User Dungeon). Generate zone content as structured JSON.

Rules:
- Room IDs must be snake_case, short and descriptive (e.g. "town_square", "dark_cave")
- Do NOT include exits in rooms — exits will be added automatically
- The first room in the list is the start/hub room
- Mob tiers: "weak", "standard", "elite", or "boss"
- Mob IDs and item IDs must be snake_case
- Mob "room" must be one of the room IDs you generate
- Item slots must come from the provided equipment slots list, or be omitted for non-equipment items
- Item stat bonuses should use the provided stat names
- ${ROOM_DESCRIPTION_GUIDANCE}
- Match the world and zone themes in tone and content

Respond with ONLY valid, strict JSON (no trailing commas, no comments, all property names double-quoted) matching this schema:
{
  "rooms": [{ "id": string, "title": string, "description": string }],
  "mobs": [{ "id": string, "name": string, "description": string, "tier": string, "room": string }],
  "items": [{ "id": string, "displayName": string, "description": string, "slot"?: string, "damage"?: number, "armor"?: number, "stats"?: { statId: number }, "room"?: string }]
}`;

const SYSTEM_PROMPT_SKETCH = `You are a creative game content designer for a text-based MUD (Multi-User Dungeon). The player has sketched a zone layout and you will write flavor for each of its pre-defined rooms.

Rules:
- You will be given a list of room IDs with optional hints from the sketch
- Return one entry per room, using the SAME room ID (do not rename, do not invent new rooms)
- Do NOT include exits — the layout is already fixed
- Use the hint (if any) to inform the room's title and description
- Mob tiers: "weak", "standard", "elite", or "boss"
- Mob IDs and item IDs must be snake_case
- Mob "room" must be one of the provided room IDs
- Item slots must come from the provided equipment slots list, or be omitted for non-equipment items
- ${ROOM_DESCRIPTION_GUIDANCE}
- Match the world and zone themes in tone and content

Respond with ONLY valid, strict JSON (no trailing commas, no comments, all property names double-quoted) matching this schema:
{
  "rooms": [{ "id": string, "title": string, "description": string }],
  "mobs": [{ "id": string, "name": string, "description": string, "tier": string, "room": string }],
  "items": [{ "id": string, "displayName": string, "description": string, "slot"?: string, "damage"?: number, "armor"?: number, "stats"?: { statId: number }, "room"?: string }]
}`;

const SYSTEM_PROMPT_EXTEND = `You are a creative game content designer for a text-based MUD (Multi-User Dungeon). You are adding new rooms to an EXISTING zone, so your output must match the style, tone, and vocabulary of the existing rooms.

Rules:
- Room IDs must be snake_case and must NOT collide with the existing room IDs you are given
- Do NOT include exits — the caller will wire them up
- The first room in your list will be connected to the existing zone
- Match the existing rooms' description length, voice, and level of detail as closely as you can
- Mob tiers: "weak", "standard", "elite", or "boss"
- Mob IDs and item IDs must be snake_case
- Mob "room" must be one of the new room IDs you generate
- Item slots must come from the provided equipment slots list, or be omitted for non-equipment items
- ${ROOM_DESCRIPTION_GUIDANCE}

Respond with ONLY valid, strict JSON (no trailing commas, no comments, all property names double-quoted) matching this schema:
{
  "rooms": [{ "id": string, "title": string, "description": string }],
  "mobs": [{ "id": string, "name": string, "description": string, "tier": string, "room": string }],
  "items": [{ "id": string, "displayName": string, "description": string, "slot"?: string, "damage"?: number, "armor"?: number, "stats"?: { statId: number }, "room"?: string }]
}`;

function buildCommonContext(params: ZoneGenerationParams): string[] {
  return [
    `World theme: ${params.worldTheme || "A classic fantasy world"}`,
    `Zone theme: ${params.zoneTheme || "A starting area for adventurers"}`,
    ...(params.backgroundContext
      ? [`Background context: ${params.backgroundContext}`]
      : []),
    ``,
    `Available stats for item bonuses: ${params.statNames.join(", ") || "STR, DEX, CON, INT, WIS, CHA"}`,
    `Available equipment slots: ${params.equipmentSlots.join(", ") || "HEAD, CHEST, LEGS, FEET, HANDS, MAIN_HAND, OFF_HAND, RING, NECK"}`,
    `Character classes in this world: ${params.classNames.join(", ") || "Warrior, Mage, Cleric, Rogue"}`,
  ];
}

function buildUserPrompt(params: ZoneGenerationParams): string {
  const parts = [
    `Generate content for a MUD zone called "${params.zoneName}".`,
    ``,
    ...buildCommonContext(params),
    ``,
    `Generate exactly:`,
    `- ${params.roomCount} rooms (the first room should be the starting room)`,
    `- ${params.mobCount} mobs (assigned to rooms by room ID, spread across the zone)`,
    `- ${params.itemCount} items (some as equipment, some as ground items in rooms)`,
  ];
  return parts.join("\n");
}

function buildSketchUserPrompt(
  params: ZoneGenerationParams,
  layout: FixedLayout,
): string {
  const parts = [
    `Write flavor for a MUD zone called "${params.zoneName}" whose layout has already been sketched.`,
    ``,
    ...buildCommonContext(params),
    ``,
    `Room IDs (with optional hints from the sketch):`,
  ];
  for (const room of layout.rooms) {
    parts.push(`- ${room.id}${room.hint ? ` — ${room.hint}` : ""}`);
  }
  parts.push(``);
  parts.push(`Generate exactly:`);
  parts.push(`- One entry per room above, using the same IDs`);
  parts.push(`- ${params.mobCount} mobs spread across the rooms`);
  parts.push(`- ${params.itemCount} items (some as equipment, some as ground items)`);
  return parts.join("\n");
}

function buildExtendUserPrompt(params: ExtendZoneParams): string {
  const parts = [
    `Add ${params.roomCount} new rooms to an EXISTING MUD zone called "${params.zoneName}".`,
    ``,
    ...buildCommonContext(params),
  ];
  if (params.existingVibe) {
    parts.push(``, `Existing zone vibe: ${params.existingVibe}`);
  }
  parts.push(``, `Existing room IDs already in the zone (do NOT reuse these):`);
  parts.push(params.existingRoomSamples.map((r) => r.id).join(", "));
  parts.push(``, `Sample rooms from the existing zone — match this voice:`);
  for (const sample of params.existingRoomSamples.slice(0, 5)) {
    parts.push(`- "${sample.title}" (${sample.id}): ${sample.description}`);
  }
  parts.push(``);
  parts.push(`Generate exactly:`);
  parts.push(`- ${params.roomCount} new rooms`);
  parts.push(`- ${params.mobCount} mobs placed in the new rooms`);
  parts.push(`- ${params.itemCount} items in the new rooms`);
  return parts.join("\n");
}

// ─── JSON extraction & parsing ──────────────────────────────────

function extractJson(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (fenceMatch) {
    text = fenceMatch[1]!;
  }

  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in LLM response");

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\") i++;
        i++;
      }
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) throw new Error("Unterminated JSON object in LLM response");

  let json = text.slice(start, end + 1);
  json = json.replace(/,\s*([}\]])/g, "$1");

  return json;
}

function parseGeneratedContent(raw: string): GeneratedZoneContent {
  const json = extractJson(raw);
  const parsed = JSON.parse(json);

  if (
    !parsed.rooms ||
    !Array.isArray(parsed.rooms) ||
    parsed.rooms.length === 0
  ) {
    throw new Error("Generated content missing rooms array");
  }

  return {
    rooms: parsed.rooms,
    mobs: parsed.mobs ?? [],
    items: parsed.items ?? [],
  };
}

// ─── WorldFile construction ─────────────────────────────────────

function buildMobs(
  mobs: LlmMob[],
  roomIds: Set<string>,
  fallbackRoomId: string,
): Record<string, MobFile> {
  const result: Record<string, MobFile> = {};
  for (const mob of mobs) {
    if (!mob.id) continue;
    result[mob.id] = {
      name: mob.name,
      description: mob.description,
      tier: mob.tier || "standard",
      room: roomIds.has(mob.room) ? mob.room : fallbackRoomId,
    };
  }
  return result;
}

function buildItems(
  items: LlmItem[],
  roomIds: Set<string>,
): Record<string, ItemFile> {
  const result: Record<string, ItemFile> = {};
  for (const item of items) {
    if (!item.id) continue;
    const file: ItemFile = {
      displayName: item.displayName,
      description: item.description,
    };
    if (item.slot) file.slot = item.slot;
    if (item.damage && item.damage > 0) file.damage = item.damage;
    if (item.armor && item.armor > 0) file.armor = item.armor;
    if (item.stats && Object.keys(item.stats).length > 0) file.stats = item.stats;
    if (item.room && roomIds.has(item.room)) file.room = item.room;
    result[item.id] = file;
  }
  return result;
}

function contentToWorldFile(
  zoneName: string,
  content: GeneratedZoneContent,
): WorldFile {
  const useHandTopology = content.rooms.length <= SMALL_TOPOLOGY_LIMIT;
  const rooms = useHandTopology
    ? applyHandTopology(content.rooms)
    : repairExitGraph(content.rooms);

  const roomIds = new Set(Object.keys(rooms));
  const fallback = content.rooms[0]?.id || "start";

  return {
    zone: zoneName,
    lifespan: 30,
    startRoom: fallback,
    rooms,
    mobs: buildMobs(content.mobs, roomIds, fallback),
    items: buildItems(content.items, roomIds),
    shops: {},
    quests: {},
    gatheringNodes: {},
    recipes: {},
  };
}

// ─── Rename rooms from titles ───────────────────────────────────

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug;
}

/**
 * Rewrite room IDs to match their titles. Preserves exits, startRoom, and
 * mob/item room refs. Rooms with empty or unusable titles keep their original
 * IDs. Collisions get numeric suffixes (`forest_path_2`).
 */
function renameRoomsByTitle(world: WorldFile): WorldFile {
  const remap = new Map<string, string>();
  const taken = new Set<string>();

  for (const [oldId, room] of Object.entries(world.rooms)) {
    const base = slugifyTitle(room.title || "");
    if (!base) {
      remap.set(oldId, oldId);
      taken.add(oldId);
      continue;
    }
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) candidate = `${base}_${n++}`;
    remap.set(oldId, candidate);
    taken.add(candidate);
  }

  const remapTarget = (target: string): string => {
    if (target.includes(":")) return target;
    return remap.get(target) ?? target;
  };

  const newRooms: Record<string, RoomFile> = {};
  for (const [oldId, room] of Object.entries(world.rooms)) {
    const newId = remap.get(oldId)!;
    const newExits: Record<string, string | { to: string; door?: unknown }> = {};
    for (const [dir, exitVal] of Object.entries(room.exits ?? {})) {
      if (typeof exitVal === "string") {
        newExits[dir] = remapTarget(exitVal);
      } else {
        newExits[dir] = { ...exitVal, to: remapTarget(exitVal.to) };
      }
    }
    newRooms[newId] = { ...room, exits: newExits as RoomFile["exits"] };
  }

  const newMobs: Record<string, MobFile> = {};
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    newMobs[id] = { ...mob, room: remap.get(mob.room) ?? mob.room };
  }

  const newItems: Record<string, ItemFile> = {};
  for (const [id, item] of Object.entries(world.items ?? {})) {
    const out: ItemFile = { ...item };
    if (item.room) out.room = remap.get(item.room) ?? item.room;
    newItems[id] = out;
  }

  return {
    ...world,
    startRoom: remap.get(world.startRoom) ?? world.startRoom,
    rooms: newRooms,
    mobs: newMobs,
    items: newItems,
  };
}

// ─── Public API ─────────────────────────────────────────────────

function buildSystemPrompt(base: string): string {
  const tone = buildToneDirective();
  return tone ? `${base}\n\nWorld context: ${tone}` : base;
}

function scaleMaxTokens(entityCount: number): number {
  return Math.max(2048, Math.min(entityCount * 350, 16000));
}

/**
 * Generate a fresh zone from scratch.
 *
 * For zones larger than `SMALL_TOPOLOGY_LIMIT` we now place rooms on a grid
 * *first* with a deterministic random-walk, then ask the LLM to flavor the
 * fixed layout (title + description per room). This replaces the old flow
 * where the LLM invented free-form compass exits — which routinely produced
 * geometrically impossible graphs and messy layouts after grid embedding.
 */
export async function generateZoneContent(
  params: ZoneGenerationParams,
): Promise<WorldFile> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  if (params.roomCount > SMALL_TOPOLOGY_LIMIT) {
    const layout = generateGridLayout({
      count: params.roomCount,
      seed: `${params.zoneName}|${params.zoneTheme}`,
    });
    const flavored = await generateZoneFromSketch(params, layout);
    return renameRoomsByTitle(flavored);
  }

  const userPrompt = buildUserPrompt(params);
  const systemPrompt = buildSystemPrompt(SYSTEM_PROMPT_SMALL);
  const maxTokens = scaleMaxTokens(
    params.roomCount + params.mobCount + params.itemCount,
  );

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
    maxTokens,
  });

  const content = parseGeneratedContent(response);
  return contentToWorldFile(params.zoneName, content);
}

/**
 * Generate a zone where the layout (rooms + exits) is already fixed,
 * typically from a user-provided sketch. The LLM only writes flavor.
 */
export async function generateZoneFromSketch(
  params: ZoneGenerationParams,
  layout: FixedLayout,
): Promise<WorldFile> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  if (layout.rooms.length === 0) {
    throw new Error("Sketch layout has no rooms");
  }

  const userPrompt = buildSketchUserPrompt(params, layout);
  const systemPrompt = buildSystemPrompt(SYSTEM_PROMPT_SKETCH);
  const maxTokens = scaleMaxTokens(
    layout.rooms.length + params.mobCount + params.itemCount,
  );

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
    maxTokens,
  });

  const parsed = parseGeneratedContent(response);

  // Enforce: one entry per layout room, use layout's fixed exits.
  // Match LLM rooms back to layout by ID; if missing, synthesize a stub.
  const llmById = new Map(parsed.rooms.map((r) => [r.id, r]));
  const rooms: LlmRoom[] = layout.rooms.map((layoutRoom) => {
    const llm = llmById.get(layoutRoom.id);
    if (llm) {
      return { ...llm, id: layoutRoom.id };
    }
    // Fallback: use the hint (or derived title) if the LLM didn't return this room
    const title =
      layoutRoom.hint ||
      layoutRoom.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      id: layoutRoom.id,
      title,
      description: "An unfamiliar place waiting to be described.",
    };
  });

  const roomFiles = applyFixedLayout(rooms, layout);
  const roomIds = new Set(Object.keys(roomFiles));
  const fallback = layout.rooms[0]!.id;

  return {
    zone: params.zoneName,
    lifespan: 30,
    startRoom: fallback,
    rooms: roomFiles,
    mobs: buildMobs(parsed.mobs, roomIds, fallback),
    items: buildItems(parsed.items, roomIds),
    shops: {},
    quests: {},
    gatheringNodes: {},
    recipes: {},
  };
}

/** Partial content returned when extending an existing zone. */
export interface ExtendZoneResult {
  newRooms: Record<string, RoomFile>;
  newMobs: Record<string, MobFile>;
  newItems: Record<string, ItemFile>;
  /** The ID of the first new room — the one the caller should attach to the existing zone. */
  entryRoomId: string;
}

/**
 * Generate new rooms to extend an existing zone. The LLM is primed with the
 * existing zone's voice so new rooms match style. Returns the new content
 * without any cross-zone exits — the caller decides how to wire them up.
 */
export async function extendZoneContent(
  params: ExtendZoneParams,
): Promise<ExtendZoneResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const userPrompt = buildExtendUserPrompt(params);
  const systemPrompt = buildSystemPrompt(SYSTEM_PROMPT_EXTEND);
  const maxTokens = scaleMaxTokens(
    params.roomCount + params.mobCount + params.itemCount,
  );

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
    maxTokens,
  });

  const parsed = parseGeneratedContent(response);

  // Drop any rooms whose IDs collide with existing ones, dedupe new ones.
  const existing = new Set(params.existingRoomSamples.map((r) => r.id));
  const seen = new Set<string>();
  const uniqueRooms: LlmRoom[] = [];
  for (const room of parsed.rooms) {
    if (!room.id || existing.has(room.id) || seen.has(room.id)) continue;
    seen.add(room.id);
    uniqueRooms.push(room);
  }

  if (uniqueRooms.length === 0) {
    throw new Error("LLM returned no new rooms to add");
  }

  let newRooms: Record<string, RoomFile>;
  if (uniqueRooms.length <= SMALL_TOPOLOGY_LIMIT) {
    newRooms = applyHandTopology(uniqueRooms);
  } else {
    // Grid-based extension: produce a clean spanning-tree layout and remap
    // the positional IDs onto the LLM-named rooms in order.
    const layout = generateGridLayout({
      count: uniqueRooms.length,
      seed: `${params.zoneName}|extend|${uniqueRooms[0]!.id}`,
    });
    const idRemap = new Map<string, string>();
    layout.rooms.forEach((layoutRoom, idx) => {
      idRemap.set(layoutRoom.id, uniqueRooms[idx]!.id);
    });
    newRooms = {};
    for (const room of uniqueRooms) {
      newRooms[room.id] = {
        title: room.title,
        description: room.description,
        exits: {},
      };
    }
    layout.rooms.forEach((layoutRoom) => {
      const realId = idRemap.get(layoutRoom.id)!;
      for (const [dir, target] of Object.entries(layoutRoom.exits)) {
        const realTarget = idRemap.get(target);
        if (realTarget) newRooms[realId]!.exits![dir] = realTarget;
      }
    });
  }

  const newRoomIds = new Set(Object.keys(newRooms));
  const entryRoomId = uniqueRooms[0]!.id;

  return {
    newRooms,
    newMobs: buildMobs(parsed.mobs, newRoomIds, entryRoomId),
    newItems: buildItems(parsed.items, newRoomIds),
    entryRoomId,
  };
}

/** Create a minimal fallback zone when no LLM is available. */
export function createFallbackZone(
  zoneName: string,
  roomCount: number,
): WorldFile {
  const stubRooms: LlmRoom[] = Array.from({ length: roomCount }, (_, i) => ({
    id: i === 0 ? "start" : `room_${i + 1}`,
    title: i === 0 ? "Starting Area" : `Room ${i + 1}`,
    description: "A nondescript area waiting to be described.",
  }));

  let rooms: Record<string, RoomFile>;
  if (stubRooms.length <= SMALL_TOPOLOGY_LIMIT) {
    rooms = applyHandTopology(stubRooms);
  } else {
    const layout = generateGridLayout({ count: stubRooms.length, seed: zoneName });
    rooms = {};
    for (const stub of stubRooms) {
      rooms[stub.id] = {
        title: stub.title,
        description: stub.description,
        exits: {},
      };
    }
    const idRemap = new Map<string, string>();
    layout.rooms.forEach((layoutRoom, idx) => {
      idRemap.set(layoutRoom.id, stubRooms[idx]!.id);
    });
    layout.rooms.forEach((layoutRoom) => {
      const realId = idRemap.get(layoutRoom.id)!;
      for (const [dir, target] of Object.entries(layoutRoom.exits)) {
        const realTarget = idRemap.get(target);
        if (realTarget) rooms[realId]!.exits![dir] = realTarget;
      }
    });
  }

  return {
    zone: zoneName,
    lifespan: 30,
    startRoom: stubRooms[0]!.id,
    rooms,
    mobs: {},
    items: {},
    shops: {},
    quests: {},
    gatheringNodes: {},
    recipes: {},
  };
}

// ─── Test-only exports ──────────────────────────────────────────

export const __test__ = {
  repairExitGraph,
  applyHandTopology,
  extractJson,
  parseGeneratedContent,
  renameRoomsByTitle,
  slugifyTitle,
};
