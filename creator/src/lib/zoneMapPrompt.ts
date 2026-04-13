import type { WorldFile, ExitValue } from "@/types/world";
import { getStyleSuffix, FORMAT_BY_ASSET_TYPE, ASSET_TEMPLATES, type ArtStyle } from "./arcanumPrompts";

function exitTarget(exit: string | ExitValue): string {
  return typeof exit === "string" ? exit : exit.to;
}

const COMPASS_LABEL: Record<string, string> = {
  n: "north", s: "south", e: "east", w: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
  u: "above", d: "below",
};

/** Build a zone geography description from the WorldFile structure. */
function describeZoneGeography(world: WorldFile): string {
  const parts: string[] = [];
  const rooms = Object.entries(world.rooms);

  // Summarize room layout as a connected geography
  const locationDescriptions: string[] = [];
  for (const [_roomId, room] of rooms) {
    const desc: string[] = [];
    desc.push(`"${room.title}"`);
    if (room.description) {
      const short = room.description.length > 120
        ? room.description.slice(0, 120) + "..."
        : room.description;
      desc.push(`(${short})`);
    }

    // Connections
    const exits = Object.entries(room.exits ?? {});
    if (exits.length > 0) {
      const connections = exits
        .filter(([, v]) => !exitTarget(v).includes(":"))
        .map(([dir, v]) => {
          const target = exitTarget(v);
          const targetRoom = world.rooms[target];
          const dirLabel = COMPASS_LABEL[dir] ?? dir;
          return targetRoom ? `${dirLabel} to "${targetRoom.title}"` : null;
        })
        .filter(Boolean);
      if (connections.length > 0) {
        desc.push(`— connects ${connections.join(", ")}`);
      }
    }

    // Notable features
    const features: string[] = [];
    if (room.terrain) features.push(`${room.terrain} terrain`);
    if (room.bank) features.push("bank");
    if (room.tavern) features.push("tavern");
    if (room.auction) features.push("auction house");
    if (room.station) features.push(`${room.station} station`);
    if (room.dungeon) features.push("dungeon portal");
    if (features.length > 0) desc.push(`[${features.join(", ")}]`);

    locationDescriptions.push(desc.join(" "));
  }

  parts.push(`Locations (${rooms.length} total):\n${locationDescriptions.join("\n")}`);

  // Notable inhabitants and points of interest
  const mobNames = Object.values(world.mobs ?? {}).map((m) => m.name);
  if (mobNames.length > 0) {
    const shown = mobNames.slice(0, 8);
    const extra = mobNames.length > 8 ? ` and ${mobNames.length - 8} more` : "";
    parts.push(`Inhabitants: ${shown.join(", ")}${extra}`);
  }

  const shopNames = Object.values(world.shops ?? {}).map((s) => s.name);
  if (shopNames.length > 0) {
    parts.push(`Shops: ${shopNames.join(", ")}`);
  }

  const gatheringNodes = Object.values(world.gatheringNodes ?? {});
  if (gatheringNodes.length > 0) {
    const nodeNames = gatheringNodes.map((n) => n.displayName);
    parts.push(`Resources: ${nodeNames.join(", ")}`);
  }

  if (world.dungeon) {
    parts.push(`Contains dungeon: "${world.dungeon.name}"`);
  }

  return parts.join("\n\n");
}

/** Build the full image generation prompt for a zone map. */
export function buildZoneMapPrompt(
  world: WorldFile,
  vibe: string,
  artStyle: ArtStyle,
): string {
  const zoneName = world.zone || "Unknown Zone";
  const terrain = world.terrain ?? "";
  const geography = describeZoneGeography(world);

  const template = ASSET_TEMPLATES.zone_map.templates[artStyle]
    ?? ASSET_TEMPLATES.zone_map.templates.arcanum
    ?? "";

  const format = FORMAT_BY_ASSET_TYPE.zone_map ?? "";
  const styleSuffix = getStyleSuffix("worldbuilding");

  const promptParts = [
    `An illustrated fantasy map of the zone "${zoneName}".`,
    terrain ? `The overall terrain is ${terrain}.` : "",
    "",
    "Zone geography and key locations:",
    geography,
    "",
    vibe ? `Zone atmosphere: ${vibe}` : "",
    "",
    `Visual reference: ${template}`,
    "",
    format,
    "",
    styleSuffix,
    "",
    "IMPORTANT: Do NOT include any readable text, labels, words, or letters in the image. Represent location names through visual landmarks, architectural features, and terrain changes instead.",
  ];

  return promptParts.filter(Boolean).join("\n");
}

/** Build a short context summary for LLM prompt enhancement. */
export function buildZoneMapContext(world: WorldFile, vibe: string): string {
  const zoneName = world.zone || "Unknown Zone";
  const geography = describeZoneGeography(world);
  return [
    `Generate an illustrated fantasy map for the zone "${zoneName}".`,
    geography,
    vibe ? `\nZone atmosphere: ${vibe}` : "",
    "\nThe map should be a top-down or elevated perspective fantasy cartography illustration showing the zone's geography, key landmarks, and how locations connect to each other.",
    "Do NOT include readable text, labels, or words — use visual landmarks and terrain features to distinguish locations.",
  ].join("\n");
}
