import type { RoomFile, MobFile, ItemFile, ShopFile, GatheringNodeFile, WorldFile, DungeonFile, DungeonRoomTemplate } from "@/types/world";
import type { GuildHallRoomTemplate, HousingTemplateDefinition } from "@/types/config";
import { getTrainerPrimaryClass } from "@/lib/trainers";
import {
  type ArtStyle,
  FORMAT_BY_TYPE,
  getPreamble,
  withSpriteSafety,
} from "./arcanumPrompts";

export type DefaultImageKind = "room" | "mob" | "item";

/**
 * Directive appended to room/shop/location contexts to keep living figures
 * out of background art. Mobs and NPCs are rendered as separate sprites on top
 * of the room background, so any figures baked into the background produce
 * visible duplication.
 */
export const EMPTY_SCENE_DIRECTIVE = `IMPORTANT — empty environment only: depict the space itself with NO people, NO characters, NO creatures, NO humanoids, NO NPCs, and NO figures of any kind. Any inhabitants mentioned above are atmospheric context only — do not draw them. Mobs and NPCs will be composited on top as separate sprites, so any figures in the background cause visible duplication. If a person or creature is central to the scene's identity, represent them indirectly through belongings, an empty seat, tools mid-use, footprints, or a trail of light — never the figure itself.`;

// Compact constraint lines for the direct-to-image fallback prompts below.
// Image models do well with just the art style and the entity's details, so
// the direct prompts stay terse; the LLM enhancement contexts keep the full
// EMPTY_SCENE_DIRECTIVE.
const NO_TEXT_LINE = `NO readable text, words, or lettering in the image.`;

const EMPTY_SCENE_LINE = `Empty scene — NO people, creatures, or figures of any kind; any inhabitants mentioned are context only and are composited separately as sprites.`;

// ─── Context Builders ────────────────────────────────────────────
// These build rich entity descriptions for the LLM to work with.
// They are NOT image prompts — the LLM turns them into image prompts.

/** Build a context description for a room. */
export function roomContext(roomId: string, room: RoomFile): string {
  const parts = [`Room "${room.title}" (id: ${roomId})`];
  if (room.description) parts.push(`Description: ${room.description}`);
  if (room.station) parts.push(`Contains a ${room.station.toLowerCase()} crafting station`);
  parts.push("Composition: wide landscape, suitable for a game room background");
  parts.push(EMPTY_SCENE_DIRECTIVE);
  return parts.join("\n");
}

/** Build a context description for a mob. */
export function mobContext(mobId: string, mob: MobFile): string {
  const parts = [`Mob "${mob.name}" (id: ${mobId})`];
  if (mob.description) parts.push(`Description: ${mob.description}`);
  parts.push(`Tier: ${mob.tier ?? "standard"}, Level: ${mob.level ?? 1}`);
  if (mob.hp) parts.push(`HP: ${mob.hp}`);
  if (mob.behavior?.template) parts.push(`Behavior: ${mob.behavior.template}`);
  if (mob.drops && mob.drops.length > 0) {
    parts.push(`Drops: ${mob.drops.map((d) => d.itemId).join(", ")}`);
  }
  parts.push("Composition: vertical portrait of the creature");
  return parts.join("\n");
}

/** Build a context description for an item. */
export function itemContext(itemId: string, item: ItemFile): string {
  const parts = [`Item "${item.displayName}" (id: ${itemId})`];
  if (item.description) parts.push(`Description: ${item.description}`);
  if (item.slot) parts.push(`Slot: ${item.slot}`);
  if (item.damage && item.damage > 0) parts.push(`Weapon — damage: ${item.damage}`);
  if (item.armor && item.armor > 0) parts.push(`Armor — defense: ${item.armor}`);
  if (item.consumable) parts.push("Consumable item");
  parts.push("Composition: centered, suitable for an inventory icon");
  return parts.join("\n");
}

/** Build a context description for a shop. */
export function shopContext(shopId: string, shop: ShopFile): string {
  const parts = [`Shop "${shop.name}" (id: ${shopId})`];
  if (shop.items && shop.items.length > 0) {
    parts.push(`Sells: ${shop.items.join(", ")}`);
  }
  parts.push("Composition: wide landscape, an empty marketplace interior — storefront, shelves, wares, and architecture only");
  parts.push(EMPTY_SCENE_DIRECTIVE);
  return parts.join("\n");
}

/** Build a context description for a dungeon template. */
export function dungeonContext(dungeon: DungeonFile, zoneName: string): string {
  const parts = [`Dungeon "${dungeon.name}" in the "${zoneName}" zone`];
  if (dungeon.description) parts.push(`Description: ${dungeon.description}`);
  const min = dungeon.roomCountMin ?? 20;
  const max = dungeon.roomCountMax ?? 25;
  parts.push(`A procedurally assembled dungeon instance of ${min}–${max} rooms`);
  if (dungeon.minLevel) parts.push(`Minimum player level: ${dungeon.minLevel}`);
  const roomTypes = Object.keys(dungeon.roomTemplates ?? {});
  if (roomTypes.length > 0) parts.push(`Room types present: ${roomTypes.join(", ")}`);
  parts.push(
    "Composition: dramatic wide establishing shot of the dungeon's entrance or signature space — sense of scale, atmospheric depth, a threshold the player is about to cross",
  );
  parts.push(EMPTY_SCENE_DIRECTIVE);
  return parts.join("\n");
}

/** Build a context description for a single dungeon room template. */
export function dungeonRoomTemplateContext(
  category: string,
  tpl: DungeonRoomTemplate,
  dungeon: DungeonFile,
): string {
  const parts = [`Room template (type: ${category}) for dungeon "${dungeon.name}"`];
  if (tpl.title) parts.push(`Title: ${tpl.title}`);
  if (tpl.description) parts.push(`Description: ${tpl.description}`);
  if (dungeon.description) parts.push(`Dungeon context: ${dungeon.description}`);
  parts.push(`Purpose: one of many ${category} variants the server picks from when assembling an instance`);
  parts.push("Composition: wide landscape, suitable for a game room background");
  parts.push(EMPTY_SCENE_DIRECTIVE);
  return parts.join("\n");
}

/** Build a full prompt for a dungeon hero image. */
export function dungeonPrompt(dungeon: DungeonFile, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");
  const setting = dungeon.description
    ? `A dungeon called "${dungeon.name}": ${dungeon.description}.`
    : `A dungeon known as "${dungeon.name}".`;

  return `${FORMAT_BY_TYPE.room}. ${preamble}

${setting} A dramatic establishing shot of its entrance or signature space.

${EMPTY_SCENE_LINE} ${NO_TEXT_LINE}`;
}

/** Build a full prompt for a single dungeon room template. */
export function dungeonRoomTemplatePrompt(
  category: string,
  tpl: DungeonRoomTemplate,
  style: ArtStyle = "gentle_magic",
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const title = tpl.title || `dungeon ${category}`;
  const setting = tpl.description
    ? `A dungeon ${category} called "${title}": ${tpl.description}.`
    : `A dungeon ${category} known as "${title}".`;

  return `${FORMAT_BY_TYPE.room}. ${preamble}

${setting}

${EMPTY_SCENE_LINE} ${NO_TEXT_LINE}`;
}

/** Build a context description for a gathering node. */
export function gatheringNodeContext(nodeId: string, node: GatheringNodeFile): string {
  const parts = [`Gathering node "${node.displayName}" (id: ${nodeId})`];
  parts.push(`Skill: ${node.skill}${node.skillRequired ? ` (requires level ${node.skillRequired})` : ""}`);
  const yieldNames = (node.yields ?? []).map((y) => y.itemId).filter(Boolean);
  if (yieldNames.length > 0) {
    parts.push(`Yields: ${yieldNames.join(", ")}`);
  }
  const rareNames = (node.rareYields ?? []).map((y) => y.itemId).filter(Boolean);
  if (rareNames.length > 0) {
    parts.push(`Rare yields: ${rareNames.join(", ")}`);
  }
  parts.push("Composition: a single grounded interactable resource node sprite that a player walks up to and gathers from. NO characters, NO hands, NO UI.");
  return parts.join("\n");
}

/** Build a context description for a housing room template. */
export function housingRoomContext(id: string, template: HousingTemplateDefinition): string {
  const parts = [`Housing room "${template.title}" (id: ${id})`];
  if (template.description) parts.push(`Description: ${template.description}`);
  if (template.station) parts.push(`Contains a ${template.station.toLowerCase()} crafting station`);
  if (template.isEntry) parts.push("This is the entry room — the first room players see when they enter their home");
  if (template.safe) parts.push("This room is a safe zone where combat cannot occur");
  if (template.maxDroppedItems && template.maxDroppedItems > 0) parts.push(`Has a vault storing up to ${template.maxDroppedItems} items`);
  parts.push("Composition: wide landscape, a personal dwelling interior — cozy, lived-in, a place of comfort and rest");
  parts.push(EMPTY_SCENE_DIRECTIVE);
  return parts.join("\n");
}

/** Build a full prompt for a housing room template image. */
export function housingRoomPrompt(_id: string, template: HousingTemplateDefinition, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");
  const setting = template.description
    ? `A housing room called "${template.title}": ${template.description}.`
    : `A personal dwelling room known as "${template.title}".`;

  const station = template.station
    ? ` A ${template.station.toLowerCase()} crafting station is present.`
    : "";

  return `${FORMAT_BY_TYPE.room}. ${preamble}

${setting}${station} A cozy, lived-in personal dwelling interior — a sense of home and safety.

${EMPTY_SCENE_LINE} ${NO_TEXT_LINE}`;
}

function guildHallRoomTitle(template: GuildHallRoomTemplate, id: string): string {
  return template.title || template.displayName || id;
}

/** Build a context description for a guild hall room template. */
export function guildHallRoomContext(id: string, template: GuildHallRoomTemplate): string {
  const title = guildHallRoomTitle(template, id);
  const parts = [`Guild hall room "${title}" (id: ${id})`];
  if (template.description) parts.push(`Description: ${template.description}`);
  if (template.hasStorage) parts.push("Houses shared guild storage / vault.");
  parts.push(
    "Composition: wide landscape, a shared communal hall room — guild banner energy, evidence of many members using the space, communal not personal.",
  );
  parts.push(EMPTY_SCENE_DIRECTIVE);
  return parts.join("\n");
}

/** Build a full prompt for a guild hall room template image. */
export function guildHallRoomPrompt(
  id: string,
  template: GuildHallRoomTemplate,
  style: ArtStyle = "gentle_magic",
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const title = guildHallRoomTitle(template, id);
  const setting = template.description
    ? `A guild hall room called "${title}": ${template.description}.`
    : `A communal guild hall chamber known as "${title}".`;

  const storage = template.hasStorage
    ? " Vault chests, ledger stands, and shared storage are visible."
    : "";

  return `${FORMAT_BY_TYPE.room}. ${preamble}

${setting}${storage} A shared communal guild hall interior — banners and crests, long tables scaled for many members, a sense of fellowship.

${EMPTY_SCENE_LINE} ${NO_TEXT_LINE}`;
}

/** Dispatch to the right context builder by entity kind. */
export function entityContext(kind: string, id: string, entity: unknown): string {
  switch (kind) {
    case "room": return roomContext(id, entity as RoomFile);
    case "mob": return mobContext(id, entity as MobFile);
    case "item": return itemContext(id, entity as ItemFile);
    case "shop": return shopContext(id, entity as ShopFile);
    case "gatheringNode": return gatheringNodeContext(id, entity as GatheringNodeFile);
    default: return `${kind} entity "${id}"`;
  }
}

function buildZoneSummary(world: WorldFile): string {
  const roomTitles = Object.values(world.rooms)
    .map((room) => room.title)
    .filter(Boolean)
    .slice(0, 6);

  return [
    `Zone "${world.zone}"`,
    `${Object.keys(world.rooms).length} rooms`,
    `${Object.keys(world.mobs ?? {}).length} mobs`,
    `${Object.keys(world.items ?? {}).length} items`,
    roomTitles.length > 0 ? `Representative rooms: ${roomTitles.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

export function defaultImageContext(kind: DefaultImageKind, world: WorldFile): string {
  const base = buildZoneSummary(world);

  switch (kind) {
    case "room":
      return `${base}\nCreate the fallback environment illustration used when a room in this zone has no specific image.`;
    case "mob":
      return `${base}\nCreate the fallback creature or NPC portrait used when a mob in this zone has no specific image.`;
    case "item":
      return `${base}\nCreate the fallback item icon used when an item in this zone has no specific image.`;
  }
}

// ─── Fallback Prompt Builders ────────────────────────────────────
// These are the direct-to-image prompts, used when no LLM is available
// to enhance. Kept deliberately terse: format + art style preamble +
// entity details + compact safety constraints. Image models handle this
// well, and anything more (palette words, render directives) duplicates
// the preamble and fights world-defined visual styles.

/** Build a full prompt for a room image. */
export function roomPrompt(
  _roomId: string,
  room: RoomFile,
  style: ArtStyle = "gentle_magic",
  _zoneVibe?: string | null,
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const setting = room.description
    ? `A place called "${room.title}": ${room.description}.`
    : `A chamber known as "${room.title}".`;

  const station = room.station
    ? ` A ${room.station.toLowerCase()} crafting station is present.`
    : "";

  return `${FORMAT_BY_TYPE.room}. ${preamble}

${setting}${station}

${EMPTY_SCENE_LINE} ${NO_TEXT_LINE}`;
}

/** Build a full prompt for a mob portrait. */
export function mobPrompt(
  _mobId: string,
  mob: MobFile,
  style: ArtStyle = "gentle_magic",
  _zoneVibe?: string | null,
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const tier = mob.tier ?? "standard";
  const level = mob.level ?? 1;
  const mobDesc = mob.description ? ` ${mob.description}.` : "";

  const tierDesc: Record<string, string> = {
    weak: "a small creature",
    standard: "a formidable creature",
    elite: "a powerful creature with a visible magical aura",
    boss: "an immense ancient being radiating overwhelming power",
  };
  const desc = tierDesc[tier] ?? tierDesc.standard;

  const inner = `${FORMAT_BY_TYPE.mob}. ${preamble}

Portrait of ${desc} known as "${mob.name}", level ${level}.${mobDesc}

${NO_TEXT_LINE}`;

  return withSpriteSafety(inner, "mob");
}

/** Build a full prompt for an item image. */
export function itemPrompt(
  _itemId: string,
  item: ItemFile,
  style: ArtStyle = "gentle_magic",
  _zoneVibe?: string | null,
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const slotDesc = item.slot
    ? ` worn in the ${item.slot.toLowerCase()} slot`
    : "";
  const desc = item.description
    ? ` ${item.description}.`
    : "";

  const isWeapon = item.damage && item.damage > 0;
  const isArmor = item.armor && item.armor > 0;
  const typeHint = isWeapon
    ? "a weapon"
    : isArmor
      ? "a piece of protective armor"
      : "a magical artifact";

  return `${FORMAT_BY_TYPE.item}. ${preamble}

Still life of ${typeHint} called "${item.displayName}"${slotDesc}.${desc}

${NO_TEXT_LINE}`;
}

/** Build a context description for a music box's lyric-sheet keepsake. */
export function musicBoxKeepsakeContext(title: string, artist?: string, lyrics?: string[]): string {
  const named = title.trim() ? `"${title.trim()}"` : "an untitled tune";
  const by = artist && artist.trim() ? ` by ${artist.trim()}` : "";
  const parts = [
    `Lyric-sheet keepsake — a collectible souvenir of the song ${named}${by}, minted when a player winds the room's music box.`,
    "A single printed sheet bearing the song's title and lyrics, kept as a memento.",
  ];
  const lines = (lyrics ?? []).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    parts.push(
      `The song's lyrics — let their mood, imagery, and themes shape the sheet's palette, ornamentation, and marginalia (do not render them as legible body text):\n${lines.join("\n")}`,
    );
  }
  parts.push("Composition: centered, suitable for an inventory icon");
  return parts.join("\n");
}

/** Build a full prompt for a music box's lyric-sheet keepsake image. */
export function musicBoxKeepsakePrompt(
  title: string,
  artist?: string,
  style: ArtStyle = "gentle_magic",
  _zoneVibe?: string | null,
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const named = title.trim() ? `"${title.trim()}"` : "an old tune";
  const by = artist && artist.trim() ? ` by ${artist.trim()}` : "";
  const subject = `a single lyric sheet — a worn sheet of paper printed with the title and lyrics of the song ${named}${by}, the keepsake a player keeps after winding a music box`;

  return `${FORMAT_BY_TYPE.item}. ${preamble}

Still life of ${subject}.

${NO_TEXT_LINE}`;
}

/** Build a full prompt for a shop image. */
export function shopPrompt(_shopId: string, shop: ShopFile, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");

  return `${FORMAT_BY_TYPE.room}. ${preamble}

A marketplace interior called "${shop.name}" — storefront, shelves, display cases, and wares.

${EMPTY_SCENE_LINE} ${NO_TEXT_LINE}`;
}

/**
 * Build a full prompt for a trainer mob image. Same shape as mobPrompt but
 * leans the description on the trainer's primary class so the portrait reads
 * as a mentor figure rather than a generic NPC.
 */
export function trainerPrompt(_mobId: string, mob: MobFile, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");
  const cls = getTrainerPrimaryClass(mob)?.toLowerCase() ?? "warrior";

  return withSpriteSafety(
    `${FORMAT_BY_TYPE.mob}. ${preamble}

Portrait of a ${cls} class trainer called "${mob.name}" — a wise mentor figure in attire befitting a ${cls}.

${NO_TEXT_LINE}`,
    "mob",
  );
}

/** Build a full prompt for a gathering node sprite. */
export function gatheringNodePrompt(
  _nodeId: string,
  node: GatheringNodeFile,
  style: ArtStyle = "gentle_magic",
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const skillHint = node.skill ? ` harvested via ${node.skill}` : "";
  const yieldHint = (node.yields ?? []).length > 0
    ? ` Yields ${(node.yields ?? []).map((y) => y.itemId).filter(Boolean).join(", ")}.`
    : "";

  return `${FORMAT_BY_TYPE.gathering_node}. ${preamble}

A single interactable resource node called "${node.displayName}"${skillHint}.${yieldHint} Clearly readable as something a player would walk up to and gather from. NO characters, NO hands, NO UI.

${NO_TEXT_LINE}`;
}

/** Dispatch to the right prompt builder by entity kind. */
export function entityPrompt(
  kind: string,
  id: string,
  entity: unknown,
  style: ArtStyle = "gentle_magic",
  zoneVibe?: string | null,
): string {
  switch (kind) {
    case "room":
      return roomPrompt(id, entity as RoomFile, style, zoneVibe);
    case "mob":
      return mobPrompt(id, entity as MobFile, style, zoneVibe);
    case "item":
      return itemPrompt(id, entity as ItemFile, style, zoneVibe);
    case "shop":
      return shopPrompt(id, entity as ShopFile, style);
    case "gatheringNode":
      return gatheringNodePrompt(id, entity as GatheringNodeFile, style);
    default: {
      const preamble = getPreamble(style, "worldbuilding");
      return `${preamble}

Portrait of a ${kind} entity called "${id}".

${NO_TEXT_LINE}`;
    }
  }
}

export function defaultImagePrompt(
  kind: DefaultImageKind,
  world: WorldFile,
  _zoneVibe: string,
  style: ArtStyle = "gentle_magic",
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const zoneSummary = buildZoneSummary(world);

  switch (kind) {
    case "room":
      return `${FORMAT_BY_TYPE.room}. ${preamble}

Fallback room illustration for ${world.zone} — an atmospheric establishing scene that can stand in for any unillustrated room in the zone.
${zoneSummary}

${EMPTY_SCENE_LINE} ${NO_TEXT_LINE}`;
    case "mob":
      return `${FORMAT_BY_TYPE.mob}. ${preamble}

Fallback mob portrait for ${world.zone} — a generic inhabitant or creature archetype native to the zone, not any named NPC.
${zoneSummary}

${NO_TEXT_LINE}`;
    case "item":
      return `${FORMAT_BY_TYPE.item}. ${preamble}

Fallback item icon for ${world.zone} — a generic magical object with a clear silhouette that could belong anywhere in the zone.
${zoneSummary}

${NO_TEXT_LINE}`;
  }
}
