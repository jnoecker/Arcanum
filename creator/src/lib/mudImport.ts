/**
 * MUD Zone Import — AI-assisted conversion of DikuMUD/CircleMUD/ROM/SMAUG area files
 * to Ambon YAML format. Supports both split files (.wld/.mob/.obj/.zon/.shp) and
 * combined .are files (ROM/SMAUG/Merc format with #ROOMS/#MOBILES/#OBJECTS sections).
 * Processes files in small batches to stay within LLM context limits.
 */
import { readDir } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import type {
  WorldFile,
  RoomFile,
  MobFile,
  ItemFile,
  ShopFile,
  ExitValue,
} from "@/types/world";

// ─── Types ─────────────────────────────────────────────────────────

export type MudFileType = "wld" | "mob" | "obj" | "zon" | "shp";

export interface MudFileInfo {
  type: MudFileType;
  path: string;
  filename: string;
  content: string;
  size: number;
}

export interface ConversionChunk {
  fileType: MudFileType;
  index: number;
  content: string;
  recordCount: number;
}

export interface ChunkResult {
  chunk: ConversionChunk;
  status: "pending" | "converting" | "done" | "error";
  data?: ConvertedRoom[] | ConvertedMob[] | ConvertedItem[] | ConvertedShop[];
  warnings?: string[];
  error?: string;
}

interface ConvertedRoom {
  id: string;
  title: string;
  description: string;
  exits?: Record<string, string | { to: string; door?: { closed?: boolean; locked?: boolean; key?: string } }>;
  _warnings?: string[];
}

interface ConvertedMob {
  id: string;
  name: string;
  description?: string;
  level?: number;
  hp?: number;
  minDamage?: number;
  maxDamage?: number;
  armor?: number;
  xpReward?: number;
  goldMin?: number;
  goldMax?: number;
  tier?: string;
  _warnings?: string[];
}

interface ConvertedItem {
  id: string;
  displayName: string;
  description?: string;
  keyword?: string;
  slot?: string;
  damage?: number;
  armor?: number;
  stats?: Record<string, number>;
  consumable?: boolean;
  onUse?: { healHp?: number };
  basePrice?: number;
  _warnings?: string[];
}

interface ConvertedShop {
  id: string;
  name: string;
  keeperMobId: string;
  items: string[];
  _warnings?: string[];
}

export interface ImportResult {
  worldFile: WorldFile;
  warnings: string[];
  stats: {
    rooms: number;
    mobs: number;
    items: number;
    shops: number;
  };
}

// ─── File Detection ────────────────────────────────────────────────

const MUD_EXTENSIONS: Record<string, MudFileType> = {
  wld: "wld",
  mob: "mob",
  obj: "obj",
  zon: "zon",
  shp: "shp",
};

/** Section markers in ROM/SMAUG/Merc .are files → MudFileType mapping */
const ARE_SECTION_MAP: Record<string, MudFileType> = {
  "#ROOMS": "wld",
  "#MOBILES": "mob",
  "#OBJECTS": "obj",
  "#RESETS": "zon",
  "#SHOPS": "shp",
};

/**
 * Split a ROM/SMAUG/Merc .are file into virtual MudFileInfo entries
 * by extracting each section into its own "file".
 */
function splitAreFile(content: string, filename: string, filePath: string): MudFileInfo[] {
  const files: MudFileInfo[] = [];

  // Extract #AREA header as zone metadata
  const areaMatch = content.match(/#AREA[^\n]*\n([\s\S]*?)(?=#[A-Z])/);
  if (areaMatch) {
    // Build a synthetic .zon-style header from the #AREA line
    // ROM format: #AREA\n{filename}~ {name}~ {levels} {vnum_lo} {vnum_hi}
    files.push({
      type: "zon",
      path: filePath,
      filename: filename.replace(/\.are$/i, ".zon"),
      content: areaMatch[0],
      size: areaMatch[0].length,
    });
  }

  // Extract each data section
  for (const [marker, fileType] of Object.entries(ARE_SECTION_MAP)) {
    const markerIdx = content.indexOf(marker);
    if (markerIdx === -1) continue;

    // Find the section body: from after the marker line to the next #SECTION or #$
    const bodyStart = content.indexOf("\n", markerIdx);
    if (bodyStart === -1) continue;

    // Find the next section marker or end-of-file marker
    const rest = content.slice(bodyStart + 1);
    const nextSection = rest.search(/^#[A-Z$]/m);
    const sectionBody = nextSection === -1 ? rest : rest.slice(0, nextSection);

    if (sectionBody.trim()) {
      // For resets, we already have the zone header above — append resets to it
      if (fileType === "zon" && files.length > 0 && files[0]!.type === "zon") {
        files[0]!.content += "\n" + sectionBody;
        files[0]!.size = files[0]!.content.length;
      } else {
        const ext = ({ wld: "wld", mob: "mob", obj: "obj", shp: "shp" } as Record<string, string>)[fileType] ?? fileType;
        files.push({
          type: fileType,
          path: filePath,
          filename: filename.replace(/\.are$/i, `.${ext}`),
          content: sectionBody,
          size: sectionBody.length,
        });
      }
    }
  }

  return files;
}

export async function detectMudFiles(dirPath: string): Promise<MudFileInfo[]> {
  const entries = await readDir(dirPath);
  const files: MudFileInfo[] = [];

  for (const entry of entries) {
    if (entry.isDirectory || !entry.name) continue;
    const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";

    // Handle .are files by splitting into virtual section files
    if (ext === "are") {
      const filePath = `${dirPath}/${entry.name}`;
      const content = await invoke<string>("read_text_file", { filePath });
      files.push(...splitAreFile(content, entry.name, filePath));
      continue;
    }

    const fileType = MUD_EXTENSIONS[ext];
    if (!fileType) continue;

    const filePath = `${dirPath}/${entry.name}`;
    const content = await invoke<string>("read_text_file", { filePath });
    files.push({
      type: fileType,
      path: filePath,
      filename: entry.name,
      content,
      size: content.length,
    });
  }

  return files.sort((a, b) => {
    const order: MudFileType[] = ["zon", "wld", "mob", "obj", "shp"];
    return order.indexOf(a.type) - order.indexOf(b.type);
  });
}

// ─── Chunking ──────────────────────────────────────────────────────

const RECORDS_PER_CHUNK: Record<MudFileType, number> = {
  wld: 8,
  mob: 8,
  obj: 12,
  zon: 1000, // process as single chunk
  shp: 1000, // process as single chunk
};

/**
 * Split a MUD file into chunks at record boundaries (#vnum markers).
 * Never splits mid-record.
 */
export function chunkMudFile(content: string, fileType: MudFileType): ConversionChunk[] {
  // .zon and .shp are typically small — single chunk
  if (fileType === "zon" || fileType === "shp") {
    return [{
      fileType,
      index: 0,
      content,
      recordCount: 1,
    }];
  }

  // Split at #vnum boundaries
  const records = splitAtVnumBoundaries(content);
  if (records.length === 0) return [];

  const perChunk = RECORDS_PER_CHUNK[fileType];
  const chunks: ConversionChunk[] = [];

  for (let i = 0; i < records.length; i += perChunk) {
    const slice = records.slice(i, i + perChunk);
    chunks.push({
      fileType,
      index: chunks.length,
      content: slice.join("\n"),
      recordCount: slice.length,
    });
  }

  return chunks;
}

function splitAtVnumBoundaries(content: string): string[] {
  const records: string[] = [];
  const lines = content.split("\n");
  let current: string[] = [];
  let inRecord = false;

  for (const line of lines) {
    if (/^#\d+/.test(line)) {
      if (inRecord && current.length > 0) {
        records.push(current.join("\n"));
      }
      current = [line];
      inRecord = true;
    } else if (inRecord) {
      current.push(line);
    }
    // Lines before first #vnum are header/comments — skip
  }

  if (inRecord && current.length > 0) {
    records.push(current.join("\n"));
  }

  return records;
}

// ─── LLM System Prompts ───────────────────────────────────────────

const ROOM_SYSTEM_PROMPT = `You convert CircleMUD/DikuMUD .wld room definitions to a JSON array.

Each input record starts with #vnum and contains: room name~, description~, zone number, room flags, sector type, then optional D (direction/exit) and E (extra description) fields, terminated by S.

Output a JSON array of room objects. Each object:
{
  "id": "<vnum as string>",
  "title": "<room name, cleaned up>",
  "description": "<room description, cleaned up, remove trailing tildes>",
  "exits": { "<dir>": "<target_vnum>" OR "<dir>": { "to": "<target_vnum>", "door": { "locked": true } } },
  "_warnings": ["<any unmapped fields or notes>"]
}

Exit direction mapping: D0=n, D1=e, D2=s, D3=w, D4=u, D5=d
Door flags in the direction field: 0=no door, 1=normal door (closed:true), 2=pickproof/locked door (locked:true)
The direction record format is: D<dir>\\n<description>~\\n<keywords>~\\n<door_flag> <key_vnum> <target_room>

Drop room bitvectors and sector types (no Ambon equivalent). Remove ~ delimiters from text.
Output ONLY the JSON array, no explanation.`;

const MOB_SYSTEM_PROMPT = `You convert CircleMUD/DikuMUD .mob mobile definitions to a JSON array.

Each record starts with #vnum, then: aliases~, short_desc~, long_desc~, detailed_desc~, action_flags affection_flags alignment, level thac0 ac max_hp bare_hand_dmg, gold xp, load_pos default_pos sex.

HP format is "XdY+Z" (e.g. "10d8+100" = avg ~145 HP). Calculate the average: X*(Y+1)/2+Z.
Damage format is "XdY+Z". Calculate average for minDamage (Z+X) and maxDamage (X*Y+Z).

Output a JSON array:
{
  "id": "<vnum as string>",
  "name": "<short_desc, cleaned, no tildes>",
  "description": "<detailed_desc if present, cleaned>",
  "level": <level number>,
  "hp": <average HP from XdY+Z>,
  "minDamage": <min from damage dice>,
  "maxDamage": <max from damage dice>,
  "armor": <convert AC: ambon_armor = (10 - ac) * 5>,
  "xpReward": <xp value>,
  "goldMin": <gold value>,
  "goldMax": <gold value>,
  "tier": "<derive from level: 1-10=weak, 11-20=standard, 21-30=elite, 31+=boss>",
  "_warnings": ["<unmapped flags, etc>"]
}

Drop action bitvectors and affection bitvectors (note them in _warnings).
Remove ~ delimiters from all text fields. Output ONLY the JSON array.`;

const ITEM_SYSTEM_PROMPT = `You convert CircleMUD/DikuMUD .obj object definitions to a JSON array.

Each record starts with #vnum, then: aliases~, short_desc~, long_desc~, action_desc~, type extra_flags wear_flags, val0 val1 val2 val3, weight cost rent_per_day. Optional A (affect) and E (extra desc) sections follow.

Wear flag to slot mapping: b(2)=finger, c(4)=neck, d(8)=body, e(16)=head, f(32)=legs, g(64)=feet, h(128)=hands, i(256)=arms, j(512)=shield, k(1024)=about, l(2048)=waist, m(4096)=wrist, n(8192)=weapon, o(16384)=held

Object type handling:
- Type 5 (WEAPON): damage = val1 * val2 average = val1*(val2+1)/2, slot = "weapon"
- Type 9 (ARMOR): armor = val0, determine slot from wear_flags
- Type 10 (POTION): consumable=true, onUse.healHp if it has a heal spell
- Type 19 (FOOD): consumable=true
- Type 18 (KEY): keyword="key"
- Type 1 (LIGHT): slot="held"

Affect (A lines) location mapping: 1=strength, 2=dexterity, 3=constitution, 4=intelligence, 5=wisdom, 6=charisma, 17=armor(as Ambon armor stat), 18=hitroll(as accuracy), 19=damroll(as damage)

Output a JSON array:
{
  "id": "<vnum as string>",
  "displayName": "<short_desc, cleaned>",
  "description": "<long_desc, cleaned>",
  "keyword": "<first alias word>",
  "slot": "<mapped slot or omit>",
  "damage": <weapon damage or omit>,
  "armor": <armor value or omit>,
  "stats": { "<stat>": <value> } or omit if empty,
  "consumable": true/false,
  "onUse": { "healHp": <value> } or omit,
  "basePrice": <cost value>,
  "_warnings": ["<unmapped fields>"]
}

Remove ~ delimiters. Output ONLY the JSON array.`;

const SHOP_SYSTEM_PROMPT = `You convert CircleMUD/DikuMUD .shp shop definitions to a JSON array.

Shop format: #shop_num~, then object vnums (-1 terminates list), profit margins, buy types, messages, then: temper bitvector shopkeeper_vnum, with_who, room vnums (-1 terminates), hours.

Output a JSON array:
{
  "id": "shop_<shop_num>",
  "name": "Shop <shop_num>",
  "keeperMobId": "<shopkeeper_vnum as string>",
  "items": ["<obj_vnum1>", "<obj_vnum2>", ...],
  "_warnings": ["<notes about buy types, hours, etc>"]
}

Output ONLY the JSON array.`;

const SYSTEM_PROMPTS: Record<MudFileType, string> = {
  wld: ROOM_SYSTEM_PROMPT,
  mob: MOB_SYSTEM_PROMPT,
  obj: ITEM_SYSTEM_PROMPT,
  shp: SHOP_SYSTEM_PROMPT,
  zon: "", // .zon is parsed deterministically
};

// ─── LLM Conversion ───────────────────────────────────────────────

export async function convertChunk(
  chunk: ConversionChunk,
): Promise<{ data: unknown[]; warnings: string[] }> {
  const systemPrompt = SYSTEM_PROMPTS[chunk.fileType];
  if (!systemPrompt) {
    throw new Error(`No conversion prompt for file type: ${chunk.fileType}`);
  }

  const result = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: chunk.content,
    maxTokens: 4096,
  });

  // Extract JSON from response (handle markdown code fences)
  const jsonStr = extractJson(result);
  const parsed = JSON.parse(jsonStr) as Array<Record<string, unknown>>;

  if (!Array.isArray(parsed)) {
    throw new Error("LLM response is not a JSON array");
  }

  const warnings: string[] = [];
  for (const item of parsed) {
    if (Array.isArray(item._warnings)) {
      for (const w of item._warnings) {
        warnings.push(`${item.id ?? "unknown"}: ${w}`);
      }
      delete item._warnings;
    }
  }

  return { data: parsed, warnings };
}

function extractJson(text: string): string {
  // Try to find JSON array in markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  // Try to find bare JSON array
  const bracketStart = text.indexOf("[");
  const bracketEnd = text.lastIndexOf("]");
  if (bracketStart !== -1 && bracketEnd > bracketStart) {
    return text.slice(bracketStart, bracketEnd + 1);
  }

  return text.trim();
}

// ─── Zone Reset Parsing (deterministic) ────────────────────────────

interface ZoneReset {
  command: string;
  mobVnum?: string;
  objVnum?: string;
  roomVnum?: string;
  maxExist?: number;
  equipPos?: number;
  exitDir?: number;
  doorState?: number;
}

export function parseZoneResets(content: string): ZoneReset[] {
  const resets: ZoneReset[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("*") || trimmed === "S") continue;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];

    switch (cmd) {
      case "M": // M if-flag mob_vnum max room_vnum
        if (parts.length >= 5) {
          resets.push({
            command: "M",
            mobVnum: parts[2]!,
            maxExist: parseInt(parts[3]!),
            roomVnum: parts[4]!,
          });
        }
        break;
      case "O": // O if-flag obj_vnum max room_vnum
        if (parts.length >= 5) {
          resets.push({
            command: "O",
            objVnum: parts[2]!,
            maxExist: parseInt(parts[3]!),
            roomVnum: parts[4]!,
          });
        }
        break;
      case "G": // G if-flag obj_vnum max (give to last mob)
        if (parts.length >= 4) {
          resets.push({
            command: "G",
            objVnum: parts[2]!,
            maxExist: parseInt(parts[3]!),
          });
        }
        break;
      case "E": // E if-flag obj_vnum max equip_pos
        if (parts.length >= 5) {
          resets.push({
            command: "E",
            objVnum: parts[2]!,
            maxExist: parseInt(parts[3]!),
            equipPos: parseInt(parts[4]!),
          });
        }
        break;
      case "D": // D if-flag room_vnum exit_dir state
        if (parts.length >= 5) {
          resets.push({
            command: "D",
            roomVnum: parts[2]!,
            exitDir: parseInt(parts[3]!),
            doorState: parseInt(parts[4]!),
          });
        }
        break;
    }
  }

  return resets;
}

const DIR_NAMES = ["n", "e", "s", "w", "u", "d"];

export function applyZoneResets(
  worldFile: WorldFile,
  resets: ZoneReset[],
): string[] {
  const warnings: string[] = [];
  let lastMobId: string | undefined;

  for (const reset of resets) {
    switch (reset.command) {
      case "M": {
        const mob = reset.mobVnum ? worldFile.mobs?.[reset.mobVnum] : undefined;
        if (reset.mobVnum && reset.roomVnum && mob) {
          mob.room = reset.roomVnum;
          lastMobId = reset.mobVnum;
        } else if (reset.mobVnum) {
          warnings.push(`Zone reset: mob ${reset.mobVnum} not found in converted data`);
          lastMobId = reset.mobVnum;
        }
        break;
      }

      case "O": {
        const item = reset.objVnum ? worldFile.items?.[reset.objVnum] : undefined;
        if (reset.objVnum && reset.roomVnum && item) {
          item.room = reset.roomVnum;
        }
        break;
      }

      case "G":
      case "E": {
        const eqItem = reset.objVnum ? worldFile.items?.[reset.objVnum] : undefined;
        if (reset.objVnum && lastMobId && eqItem) {
          eqItem.mob = lastMobId;
        }
        break;
      }

      case "D": {
        const room = reset.roomVnum ? worldFile.rooms[reset.roomVnum] : undefined;
        if (reset.roomVnum && reset.exitDir !== undefined && room) {
          const dir = DIR_NAMES[reset.exitDir];
          if (dir) {
            const exit = room.exits?.[dir];
            if (exit) {
              const target = typeof exit === "string" ? exit : exit.to;
              const doorState = reset.doorState ?? 0;
              if (doorState > 0) {
                room.exits![dir] = {
                  to: target,
                  door: {
                    closed: doorState >= 1,
                    locked: doorState >= 2,
                  },
                } satisfies ExitValue;
              }
            }
          }
        }
        break;
      }
    }
  }

  return warnings;
}

// ─── Zone Header Parsing ──────────────────────────────────────────

export function parseZoneHeader(content: string): { zoneId: string; zoneName: string; lifespan: number } {
  const lines = content.split("\n");
  let zoneId = "imported_zone";
  let zoneName = "Imported Zone";
  let lifespan = 0;

  // Detect ROM/SMAUG #AREA header: {filename}~ {area name}~ { levels } {vnum_lo} {vnum_hi}
  if (content.includes("#AREA")) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "#AREA" || trimmed.startsWith("#AREA")) continue;
      // ROM format: filename~ Area Name~ {lo hi} vnum_lo vnum_hi
      const tildes = trimmed.split("~").map((s) => s.trim()).filter(Boolean);
      if (tildes.length >= 2) {
        const fileToken = tildes[0]!;
        zoneName = tildes[1]!;
        // Derive zone ID from filename token (e.g. "midgaard.are" → "midgaard")
        zoneId = fileToken.replace(/\.are$/i, "").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
        break;
      }
    }
    return { zoneId, zoneName, lifespan };
  }

  // CircleMUD .zon format
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") && /^#\d+/.test(trimmed)) {
      zoneId = trimmed.replace("#", "").trim();
      continue;
    }
    // Line after #vnum is the zone name (tilde-terminated)
    if (zoneId !== "imported_zone" && trimmed.endsWith("~")) {
      zoneName = trimmed.replace(/~$/, "").trim();
      continue;
    }
    // Look for the line with top_room lifespan reset_mode
    const numMatch = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s*$/);
    if (numMatch?.[2]) {
      lifespan = parseInt(numMatch[2]) * 60000; // minutes → ms
      break;
    }
  }

  return { zoneId, zoneName, lifespan };
}

// ─── Assembly ─────────────────────────────────────────────────────

export function assembleWorldFile(
  zoneId: string,
  _zoneName: string,
  lifespan: number,
  rooms: ConvertedRoom[],
  mobs: ConvertedMob[],
  items: ConvertedItem[],
  shops: ConvertedShop[],
): WorldFile {
  const roomMap: Record<string, RoomFile> = {};
  for (const r of rooms) {
    roomMap[r.id] = {
      title: r.title,
      description: r.description,
      ...(r.exits && Object.keys(r.exits).length > 0 ? { exits: r.exits } : {}),
    };
  }

  const mobMap: Record<string, MobFile> = {};
  for (const m of mobs) {
    mobMap[m.id] = {
      name: m.name,
      room: "", // filled by zone resets
      ...(m.description ? { description: m.description } : {}),
      ...(m.level ? { level: m.level } : {}),
      ...(m.hp ? { hp: m.hp } : {}),
      ...(m.minDamage ? { minDamage: m.minDamage } : {}),
      ...(m.maxDamage ? { maxDamage: m.maxDamage } : {}),
      ...(m.armor ? { armor: m.armor } : {}),
      ...(m.xpReward ? { xpReward: m.xpReward } : {}),
      ...(m.goldMin ? { goldMin: m.goldMin } : {}),
      ...(m.goldMax ? { goldMax: m.goldMax } : {}),
      ...(m.tier ? { tier: m.tier } : {}),
    };
  }

  const itemMap: Record<string, ItemFile> = {};
  for (const it of items) {
    itemMap[it.id] = {
      displayName: it.displayName,
      ...(it.description ? { description: it.description } : {}),
      ...(it.keyword ? { keyword: it.keyword } : {}),
      ...(it.slot ? { slot: it.slot } : {}),
      ...(it.damage ? { damage: it.damage } : {}),
      ...(it.armor ? { armor: it.armor } : {}),
      ...(it.stats && Object.keys(it.stats).length > 0 ? { stats: it.stats } : {}),
      ...(it.consumable ? { consumable: it.consumable } : {}),
      ...(it.onUse ? { onUse: it.onUse } : {}),
      ...(it.basePrice ? { basePrice: it.basePrice } : {}),
    };
  }

  const shopMap: Record<string, ShopFile> = {};
  for (const s of shops) {
    shopMap[s.id] = {
      name: s.name,
      room: "", // will need to be set from mob's room
      ...(s.items?.length ? { items: s.items } : {}),
    };
  }

  // Derive shop rooms from keeper mob rooms
  for (const s of shops) {
    const keeper = s.keeperMobId ? mobMap[s.keeperMobId] : undefined;
    const shop = shopMap[s.id];
    if (keeper && shop) {
      shop.room = keeper.room;
    }
  }

  const firstRoom = rooms[0]?.id ?? "";

  const world: WorldFile = {
    zone: zoneId,
    startRoom: firstRoom,
    ...(lifespan > 0 ? { lifespan } : {}),
    rooms: roomMap,
    ...(Object.keys(mobMap).length > 0 ? { mobs: mobMap } : {}),
    ...(Object.keys(itemMap).length > 0 ? { items: itemMap } : {}),
    ...(Object.keys(shopMap).length > 0 ? { shops: shopMap } : {}),
  };

  return world;
}

// ─── Chunk Estimation ──────────────────────────────────────────────

export function estimateChunks(files: MudFileInfo[]): { total: number; byType: Record<MudFileType, number> } {
  const byType: Record<MudFileType, number> = { wld: 0, mob: 0, obj: 0, zon: 0, shp: 0 };
  let total = 0;

  for (const file of files) {
    const chunks = chunkMudFile(file.content, file.type);
    byType[file.type] = chunks.length;
    total += chunks.length;
  }

  return { total, byType };
}
