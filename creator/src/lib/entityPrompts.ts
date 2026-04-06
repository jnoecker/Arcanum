import type { RoomFile, MobFile, ItemFile, ShopFile, TrainerFile, WorldFile } from "@/types/world";
import { type ArtStyle, getPreamble, getStyleSuffix, FORMAT_BY_TYPE } from "./arcanumPrompts";

export type DefaultImageKind = "room" | "mob" | "item";

// ─── Context Builders ────────────────────────────────────────────
// These build rich entity descriptions for the LLM to work with.
// They are NOT image prompts — the LLM turns them into image prompts.

/** Build a context description for a room. */
export function roomContext(roomId: string, room: RoomFile): string {
  const parts = [`Room "${room.title}" (id: ${roomId})`];
  if (room.description) parts.push(`Description: ${room.description}`);
  if (room.station) parts.push(`Contains a ${room.station.toLowerCase()} crafting station`);
  parts.push("Composition: wide landscape, suitable for a game room background");
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
  parts.push("Composition: wide landscape, a marketplace scene");
  return parts.join("\n");
}

/** Dispatch to the right context builder by entity kind. */
export function entityContext(kind: string, id: string, entity: unknown): string {
  switch (kind) {
    case "room": return roomContext(id, entity as RoomFile);
    case "mob": return mobContext(id, entity as MobFile);
    case "item": return itemContext(id, entity as ItemFile);
    case "shop": return shopContext(id, entity as ShopFile);
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
// These are the original direct-to-image prompts, kept as fallbacks
// when no LLM is available. They include the style preamble + entity
// details in a format that works directly with FLUX.

/** Build a full prompt for a room image. */
export function roomPrompt(_roomId: string, room: RoomFile, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");
  const setting = room.description
    ? `A place called "${room.title}": ${room.description}.`
    : `A chamber known as "${room.title}".`;

  const station = room.station
    ? ` A ${room.station.toLowerCase()} crafting station is present.`
    : "";

  if (style === "gentle_magic") {
    return `${FORMAT_BY_TYPE.room}. ${preamble}

${setting}${station} Rendered as a dreamlike interior space — soft lavender and pale blue ambient light diffusing through gentle atmospheric haze, floating motes of warm light drifting lazily, organic curves and lived-in details, moss green and dusty rose accents on natural surfaces, soft gold highlights on magical elements, painterly, luminous, breathable

${getStyleSuffix("worldbuilding")}`;
  }

  return `${preamble}

${setting}${station} Rendered as a baroque cosmic interior — deep indigo shadows, aurum-gold light pooling at architectural details, rococo scrollwork framing the space, blue-violet atmospheric mist, painterly, luminous, extremely detailed, wide composition suitable for a game room background`;
}

/** Build a full prompt for a mob portrait. */
export function mobPrompt(_mobId: string, mob: MobFile, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");
  const tier = mob.tier ?? "standard";
  const level = mob.level ?? 1;
  const mobDesc = mob.description ? ` ${mob.description}.` : "";

  if (style === "gentle_magic") {
    const tierDesc: Record<string, string> = {
      weak: "a small, gentle creature",
      standard: "a quietly formidable creature",
      elite: "a powerful creature surrounded by softly swirling magical energy",
      boss: "an immense ancient being radiating gentle but overwhelming power",
    };
    const desc = tierDesc[tier] ?? tierDesc.standard;

    return `${FORMAT_BY_TYPE.mob}. ${preamble}

Portrait of ${desc} known as "${mob.name}", level ${level}.${mobDesc} Depicted with soft organic forms and gentle curves, ambient lavender and pale blue light diffusing around the figure, floating motes of warm gold light, subtle magical glow emanating naturally from within, dreamlike atmospheric haze, dusty rose and moss green accents, painterly, luminous

${getStyleSuffix("worldbuilding")}`;
  }

  const tierDesc: Record<string, string> = {
    weak: "a minor, diminished creature",
    standard: "a formidable creature",
    elite: "a powerful, commanding creature surrounded by crackling energy",
    boss: "a vast, terrifying entity of immense power, dominating the composition",
  };
  const desc = tierDesc[tier] ?? tierDesc.standard;

  return `${preamble}

Portrait of ${desc} known as "${mob.name}", level ${level}.${mobDesc} Rendered with aurum-gold highlights on key features, deep indigo background with blue-violet nebula wisps, baroque energy accents framing the figure, ornate frame edges dissolving into darkness, painterly, luminous, vertical portrait composition`;
}

/** Build a full prompt for an item image. */
export function itemPrompt(_itemId: string, item: ItemFile, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");
  const slotDesc = item.slot
    ? ` worn in the ${item.slot.toLowerCase()} slot`
    : "";
  const desc = item.description
    ? ` ${item.description}.`
    : "";

  const isWeapon = item.damage && item.damage > 0;
  const isArmor = item.armor && item.armor > 0;

  if (style === "gentle_magic") {
    const typeHint = isWeapon
      ? "a weapon with a soft magical glow"
      : isArmor
        ? "protective armor with gentle enchantment traces"
        : "a warmly glowing magical artifact";

    return `${FORMAT_BY_TYPE.item}. ${preamble}

Still life of ${typeHint} called "${item.displayName}"${slotDesc}.${desc} Rendered as a gently luminous object resting on a soft surface, ambient lavender and pale blue light diffusing around it, subtle floating motes of warm gold, soft atmospheric haze, organic gentle forms, dreamlike quality, painterly

${getStyleSuffix("worldbuilding")}`;
  }

  const typeHint = isWeapon
    ? "a weapon radiating aurum energy"
    : isArmor
      ? "protective armor traced with baroque scrollwork"
      : "a luminous artifact";

  return `${preamble}

Still life of ${typeHint} called "${item.displayName}"${slotDesc}.${desc} Rendered as a glowing object floating in deep cosmic indigo void, baroque energy threads curling around it, aurum-gold light emanating from its core, blue-violet ambient fill, ornate and detailed, painterly, centered composition suitable for an inventory icon`;
}

/** Build a full prompt for a shop image. */
export function shopPrompt(_shopId: string, shop: ShopFile, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");

  if (style === "gentle_magic") {
    return `${FORMAT_BY_TYPE.room}. ${preamble}

A gentle magical marketplace called "${shop.name}" — cozy shelves and display cases holding softly glowing artifacts, warm ambient light filtering through atmospheric haze, floating motes of gold drifting between items, lavender and pale blue tones in the shadows, dusty rose accents on wooden surfaces, a sense of wonder and quiet abundance, organic curves and lived-in warmth, painterly, luminous

${getStyleSuffix("worldbuilding")}`;
  }

  return `${preamble}

An arcane marketplace called "${shop.name}" — baroque display cases of glowing energy holding luminous artifacts, aurum-gold light pooling on shelves traced with rococo scrollwork, deep indigo shadows between alcoves, blue-violet atmospheric mist, a sense of abundance and ancient commerce, painterly, luminous, wide composition`;
}

/** Build a full prompt for a trainer image. */
export function trainerPrompt(_trainerId: string, trainer: TrainerFile, style: ArtStyle = "gentle_magic"): string {
  const preamble = getPreamble(style, "worldbuilding");
  const cls = trainer.class?.toLowerCase() ?? "warrior";

  if (style === "gentle_magic") {
    return `${FORMAT_BY_TYPE.mob}. ${preamble}

A gentle magical portrait of a ${cls} class trainer called "${trainer.name}" — a wise mentor figure in soft flowing robes or battle-worn attire appropriate for a ${cls}, warm ambient light, floating motes of gold, lavender and pale blue tones, a sense of knowledge and patient guidance, painterly, luminous

${getStyleSuffix("worldbuilding")}`;
  }

  return `${preamble}

An arcane portrait of a ${cls} class trainer called "${trainer.name}" — a powerful mentor in baroque armor or robes befitting a ${cls}, aurum-gold light illuminating their form, deep indigo background with traced energy patterns, blue-violet atmospheric mist, a sense of mastery and ancient knowledge, painterly, luminous`;
}

/** Dispatch to the right prompt builder by entity kind. */
export function entityPrompt(
  kind: string,
  id: string,
  entity: unknown,
  style: ArtStyle = "gentle_magic",
): string {
  switch (kind) {
    case "room":
      return roomPrompt(id, entity as RoomFile, style);
    case "mob":
      return mobPrompt(id, entity as MobFile, style);
    case "item":
      return itemPrompt(id, entity as ItemFile, style);
    case "shop":
      return shopPrompt(id, entity as ShopFile, style);
    case "trainer":
      return trainerPrompt(id, entity as TrainerFile, style);
    default: {
      const preamble = getPreamble(style, "worldbuilding");
      return style === "gentle_magic"
        ? `${preamble}\n\nDreamlike portrait of a ${kind} entity called "${id}", rendered in soft magical style, lavender and pale blue tones, gentle ambient glow, floating motes of warm light, painterly, luminous\n\n${getStyleSuffix("worldbuilding")}`
        : `${preamble}\n\nArcane portrait of a ${kind} entity called "${id}", rendered in baroque cosmic style, aurum-gold highlights, deep indigo background, painterly, luminous`;
    }
  }
}

export function defaultImagePrompt(
  kind: DefaultImageKind,
  world: WorldFile,
  zoneVibe: string,
  style: ArtStyle = "gentle_magic",
): string {
  const preamble = getPreamble(style, "worldbuilding");
  const zoneSummary = buildZoneSummary(world);
  const vibeSection = zoneVibe
    ? `Zone atmosphere: ${zoneVibe}`
    : "Zone atmosphere: soft magical fallback that reflects the zone's dominant mood and palette.";

  if (style === "gentle_magic") {
    switch (kind) {
      case "room":
        return `${FORMAT_BY_TYPE.room}. ${preamble}

Fallback room illustration for ${world.zone}. ${vibeSection}
${zoneSummary}

No named characters, no specific plot moment, and no readable text. Focus on an atmospheric establishing scene that can gracefully stand in for any unillustrated room in the zone. Painterly, luminous, softly enchanted, emotionally safe.

${getStyleSuffix("worldbuilding")}`;
      case "mob":
        return `${FORMAT_BY_TYPE.mob}. ${preamble}

Fallback mob portrait for ${world.zone}. ${vibeSection}
${zoneSummary}

Depict a generic inhabitant or creature archetype that feels native to the zone without representing any named NPC. The figure should feel characterful and approachable, with subtle magical details and a soft ambient glow.

${getStyleSuffix("worldbuilding")}`;
      case "item":
        return `${FORMAT_BY_TYPE.item}. ${preamble}

Fallback item icon for ${world.zone}. ${vibeSection}
${zoneSummary}

Depict a generic magical object or artifact that could plausibly belong anywhere in this zone. Keep the silhouette clear, the materials handcrafted, and the enchantment subtle but visible.

${getStyleSuffix("worldbuilding")}`;
    }
  }

  switch (kind) {
    case "room":
      return `${preamble}

Fallback room illustration for ${world.zone}. ${vibeSection}
${zoneSummary}

Wide atmospheric environment art suitable for any room in the zone.`;
    case "mob":
      return `${preamble}

Fallback creature portrait for ${world.zone}. ${vibeSection}
${zoneSummary}

Generic zone inhabitant portrait suitable for mobs without explicit art.`;
    case "item":
      return `${preamble}

Fallback item illustration for ${world.zone}. ${vibeSection}
${zoneSummary}

Generic zone-themed artifact icon suitable for items without explicit art.`;
  }
}
