import { invoke } from "@tauri-apps/api/core";
import type { WorldFile, RoomFile, MobFile, ItemFile } from "@/types/world";

interface ZoneGenerationParams {
  zoneName: string;
  zoneTheme: string;
  worldTheme: string;
  roomCount: number;
  mobCount: number;
  itemCount: number;
  statNames: string[];
  equipmentSlots: string[];
  classNames: string[];
}

interface GeneratedZoneContent {
  rooms: { id: string; title: string; description: string }[];
  mobs: {
    id: string;
    name: string;
    description: string;
    tier: string;
    room: string;
  }[];
  items: {
    id: string;
    displayName: string;
    description: string;
    slot?: string;
    damage?: number;
    armor?: number;
    stats?: Record<string, number>;
    room?: string;
  }[];
}

// ─── Fixed room topologies ──────────────────────────────────────
// Each topology defines exit connections between room slots (by index).
// The key is direction from slot A → slot B.

interface ExitLink {
  from: number;
  to: number;
  dir: string;
  reverse: string;
}

// Topologies are designed to look good when laid out by dagre.
//
// 3 rooms: linear north-south
//   0 -- n --> 1 -- n --> 2
//
// 4 rooms: T-shape (center with 3 branches)
//        1
//        |
//   2 -- 0 -- 3
//
// 5 rooms: cross
//        1
//        |
//   3 -- 0 -- 4
//        |
//        2
//
// 6 rooms: H-shape
//   0 -- 1 -- 2
//        |
//   3 -- 4 -- 5
//
// 7 rooms: H + extra
//   0 -- 1 -- 2
//        |
//   3 -- 4 -- 5
//        |
//        6
//
// 8 rooms: grid ring
//   0 -- 1 -- 2
//   |         |
//   3    4    5
//   |   / \   |
//   6 -- 7    |
//        \----/

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

function getTopology(count: number): ExitLink[] {
  if (TOPOLOGIES[count]) return TOPOLOGIES[count];
  // Fallback: linear chain
  const links: ExitLink[] = [];
  for (let i = 0; i < count - 1; i++) {
    links.push({
      from: i,
      to: i + 1,
      dir: i % 2 === 0 ? "n" : "e",
      reverse: i % 2 === 0 ? "s" : "w",
    });
  }
  return links;
}

function applyTopology(
  rooms: { id: string; title: string; description: string }[],
): Record<string, RoomFile> {
  const topology = getTopology(rooms.length);
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

    result[fromRoom.id]!.exits = {
      ...result[fromRoom.id]!.exits,
      [link.dir]: toRoom.id,
    };
    result[toRoom.id]!.exits = {
      ...result[toRoom.id]!.exits,
      [link.reverse]: fromRoom.id,
    };
  }

  return result;
}

// ─── LLM prompt ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a creative game content designer for a text-based MUD (Multi-User Dungeon). Generate zone content as structured JSON.

Rules:
- Room IDs must be snake_case, short and descriptive (e.g. "town_square", "dark_cave")
- Do NOT include exits in rooms — exits will be added automatically
- The first room in the list is the start/hub room
- Mob tiers: "weak", "standard", "elite", or "boss"
- Mob IDs and item IDs must be snake_case
- Mob "room" must be one of the room IDs you generate
- Item slots must come from the provided equipment slots list, or be omitted for non-equipment items
- Item stat bonuses should use the provided stat names
- Descriptions should be exactly 1 sentence, vivid and atmospheric
- Match the world and zone themes in tone and content

Respond with ONLY valid, strict JSON (no trailing commas, no comments, all property names double-quoted) matching this schema:
{
  "rooms": [{ "id": string, "title": string, "description": string }],
  "mobs": [{ "id": string, "name": string, "description": string, "tier": string, "room": string }],
  "items": [{ "id": string, "displayName": string, "description": string, "slot"?: string, "damage"?: number, "armor"?: number, "stats"?: { statId: number }, "room"?: string }]
}`;

function buildUserPrompt(params: ZoneGenerationParams): string {
  const parts = [
    `Generate content for a MUD zone called "${params.zoneName}".`,
    ``,
    `World theme: ${params.worldTheme || "A classic fantasy world"}`,
    `Zone theme: ${params.zoneTheme || "A starting area for adventurers"}`,
    ``,
    `Generate exactly:`,
    `- ${params.roomCount} rooms (the first room should be the central hub)`,
    `- ${params.mobCount} mobs (assigned to rooms by room ID)`,
    `- ${params.itemCount} items (some as equipment, some as ground items in rooms)`,
    ``,
    `Available stats for item bonuses: ${params.statNames.join(", ") || "STR, DEX, CON, INT, WIS, CHA"}`,
    `Available equipment slots: ${params.equipmentSlots.join(", ") || "HEAD, CHEST, LEGS, FEET, HANDS, MAIN_HAND, OFF_HAND, RING, NECK"}`,
    `Character classes in this world: ${params.classNames.join(", ") || "Warrior, Mage, Cleric, Rogue"}`,
  ];
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

function contentToWorldFile(
  zoneName: string,
  content: GeneratedZoneContent,
): WorldFile {
  // Apply fixed topology — rooms get exits stamped by position
  const rooms = applyTopology(content.rooms);

  const roomIds = new Set(Object.keys(rooms));

  const mobs: Record<string, MobFile> = {};
  for (const mob of content.mobs) {
    mobs[mob.id] = {
      name: mob.name,
      description: mob.description,
      tier: mob.tier || "standard",
      // Ensure mob room references a valid room
      room: roomIds.has(mob.room)
        ? mob.room
        : content.rooms[0]?.id || "start",
    };
  }

  const items: Record<string, ItemFile> = {};
  for (const item of content.items) {
    const itemFile: ItemFile = {
      displayName: item.displayName,
      description: item.description,
    };
    if (item.slot) itemFile.slot = item.slot;
    if (item.damage && item.damage > 0) itemFile.damage = item.damage;
    if (item.armor && item.armor > 0) itemFile.armor = item.armor;
    if (item.stats && Object.keys(item.stats).length > 0)
      itemFile.stats = item.stats;
    if (item.room && roomIds.has(item.room)) itemFile.room = item.room;
    items[item.id] = itemFile;
  }

  return {
    zone: zoneName,
    lifespan: 30,
    startRoom: content.rooms[0]?.id || "start",
    rooms,
    mobs,
    items,
    shops: {},
    quests: {},
    gatheringNodes: {},
    recipes: {},
  };
}

// ─── Public API ─────────────────────────────────────────────────

export async function generateZoneContent(
  params: ZoneGenerationParams,
): Promise<WorldFile> {
  const userPrompt = buildUserPrompt(params);

  // Scale token budget with content size
  const entityCount = params.roomCount + params.mobCount + params.itemCount;
  const maxTokens = Math.max(2048, entityCount * 300);

  const response = await invoke<string>("llm_complete", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens,
  });

  const content = parseGeneratedContent(response);
  return contentToWorldFile(params.zoneName, content);
}

/** Create a minimal fallback zone when no LLM is available */
export function createFallbackZone(
  zoneName: string,
  roomCount: number,
): WorldFile {
  const stubRooms = Array.from({ length: roomCount }, (_, i) => ({
    id: i === 0 ? "start" : `room_${i + 1}`,
    title: i === 0 ? "Starting Area" : `Room ${i + 1}`,
    description: "A nondescript area waiting to be described.",
  }));

  const rooms = applyTopology(stubRooms);

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
