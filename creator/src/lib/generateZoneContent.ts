import { invoke } from "@tauri-apps/api/core";
import type { WorldFile, RoomFile, MobFile, ItemFile } from "@/types/world";
import { buildToneDirective } from "./loreGeneration";
import { OPPOSITE } from "./zoneEdits";

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

  // Phase 1 — copy exits that point to valid rooms, ensure bidirectional links
  for (const room of rooms) {
    if (!room.exits) continue;
    for (const [rawDir, target] of Object.entries(room.exits)) {
      const dir = rawDir.toLowerCase();
      if (!OPPOSITE[dir]) continue; // unknown direction
      if (!roomIds.has(target)) continue; // dangling
      if (target === room.id) continue; // self-loop
      // Skip if this room's exit slot is already taken by a bidi pair
      if (result[room.id]!.exits![dir]) continue;
      // Skip if the target already has the reverse exit pointing somewhere else
      const rev = OPPOSITE[dir]!;
      const existingRev = result[target]!.exits![rev];
      if (existingRev && existingRev !== room.id) continue;
      result[room.id]!.exits![dir] = target;
      result[target]!.exits![rev] = room.id;
    }
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

  // Attach each orphan to a room in the connected set that has a free cardinal direction
  const CARDINALS = ["n", "s", "e", "w"];
  const connected = [...visited];
  for (const orphan of orphans) {
    let attached = false;
    for (const anchorId of connected) {
      const anchor = result[anchorId]!;
      const free = CARDINALS.find((d) => !anchor.exits![d]);
      if (!free) continue;
      const rev = OPPOSITE[free]!;
      if (result[orphan.id]!.exits![rev]) continue;
      anchor.exits![free] = orphan.id;
      result[orphan.id]!.exits![rev] = anchorId;
      connected.push(orphan.id);
      attached = true;
      break;
    }
    // Last-resort fallback: attach to first room via "up"/"down" extradimensional exit
    if (!attached) {
      const first = result[rooms[0]!.id]!;
      if (!first.exits!["u"]) {
        first.exits!["u"] = orphan.id;
        result[orphan.id]!.exits!["d"] = rooms[0]!.id;
      } else if (!first.exits!["d"]) {
        first.exits!["d"] = orphan.id;
        result[orphan.id]!.exits!["u"] = rooms[0]!.id;
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

const SYSTEM_PROMPT_LARGE = `You are a creative game content designer for a text-based MUD (Multi-User Dungeon). Generate a full zone layout as structured JSON.

Rules:
- Room IDs must be snake_case, short and descriptive (e.g. "town_square", "cathedral_nave")
- The first room in the list is the starting room (often a hub or entrance)
- Every room must include an "exits" object mapping direction → target room ID
- Valid directions: "n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"
- The exit graph must be CONNECTED — every room reachable from the first room
- Exits should be roughly bidirectional: if A has exit "n" to B, then B should have exit "s" to A
- Aim for an interesting topology: clusters, loops, dead-ends, and a clear spine. Avoid a pure linear chain
- Most rooms should have 2-4 exits; hubs can have more, dead-ends have 1
- Mob tiers: "weak", "standard", "elite", or "boss"
- Mob IDs and item IDs must be snake_case
- Mob "room" must be one of the room IDs you generate
- Item slots must come from the provided equipment slots list, or be omitted for non-equipment items
- ${ROOM_DESCRIPTION_GUIDANCE}
- Match the world and zone themes in tone and content

Respond with ONLY valid, strict JSON (no trailing commas, no comments, all property names double-quoted) matching this schema:
{
  "rooms": [{ "id": string, "title": string, "description": string, "exits": { "direction": "target_room_id" } }],
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

// ─── Public API ─────────────────────────────────────────────────

function buildSystemPrompt(base: string): string {
  const tone = buildToneDirective();
  return tone ? `${base}\n\nWorld context: ${tone}` : base;
}

function scaleMaxTokens(entityCount: number): number {
  return Math.max(2048, Math.min(entityCount * 350, 16000));
}

/** Generate a fresh zone from scratch using the LLM. */
export async function generateZoneContent(
  params: ZoneGenerationParams,
): Promise<WorldFile> {
  const userPrompt = buildUserPrompt(params);
  const systemBase =
    params.roomCount > SMALL_TOPOLOGY_LIMIT
      ? SYSTEM_PROMPT_LARGE
      : SYSTEM_PROMPT_SMALL;
  const systemPrompt = buildSystemPrompt(systemBase);
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

  const useHandTopology = uniqueRooms.length <= SMALL_TOPOLOGY_LIMIT;
  const newRooms = useHandTopology
    ? applyHandTopology(uniqueRooms)
    : repairExitGraph(uniqueRooms);

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

  const rooms =
    stubRooms.length <= SMALL_TOPOLOGY_LIMIT
      ? applyHandTopology(stubRooms)
      : repairExitGraph(
          // Synthesize a simple chain so repair has something to work with
          stubRooms.map((r, i): LlmRoom => {
            const exits: Record<string, string> = {};
            if (i < stubRooms.length - 1) {
              exits["e"] = stubRooms[i + 1]!.id;
            }
            return { ...r, exits };
          }),
        );

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
};
