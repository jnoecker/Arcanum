// ─── Required global assets ─────────────────────────────────────────
//
// The MUD looks up these keys under `ambonmud.images.globalAssets` for
// world-icon overlays (quest markers, shop kiosks, indicators, etc).
// Spring Boot replaces the entire map when the project provides any
// entries, so every key the MUD needs must be present in the project's
// config — there's no per-entry merge with the Kotlin defaults.
//
// Keep the lookup-key naming convention: snake_case identifier, no
// extension. The default filename may use hyphens (e.g. minimap key uses
// `minimap_unexplored` but the canonical filename is `minimap-unexplored.png`).

import type { AssetType } from "@/types/assets";

export interface RequiredGlobalAsset {
  /** Lookup key written under `globalAssets` in application.yaml. */
  key: string;
  /** Canonical filename the MUD ships with — used as a hint when generating. */
  defaultFilename: string;
  /** Short label shown in the UI next to the key. */
  label: string;
  /** One-line description of where the asset appears in-game. */
  description: string;
  /** Asset type bucket — drives gallery categorization and default dimensions. */
  assetType: AssetType;
  /** Sensible default prompt to seed the generator with. */
  defaultPrompt: string;
  /** Whether background removal should be enabled by default after generation. */
  transparent: boolean;
}

export const REQUIRED_GLOBAL_ASSETS: readonly RequiredGlobalAsset[] = [
  {
    key: "video_available_indicator",
    defaultFilename: "video_available_indicator.png",
    label: "Video Available",
    description: "Marker shown on rooms or NPCs that have an associated cinematic.",
    assetType: "ability_icon",
    defaultPrompt: "A single glowing play-button triangle inside a soft circle, centered.",
    transparent: true,
  },
  {
    key: "shop_kiosk",
    defaultFilename: "shop_kiosk.png",
    label: "Shop Kiosk",
    description: "Overlay placed on shopkeeper rooms to advertise the shop.",
    assetType: "ability_icon",
    defaultPrompt: "A single ornate coin-purse icon, centered, gold accents.",
    transparent: true,
  },
  {
    key: "puzzle_kiosk",
    defaultFilename: "puzzle_kiosk.png",
    label: "Puzzle Kiosk",
    description: "Overlay placed on rooms that host a puzzle; clicking opens the puzzle flow.",
    assetType: "ability_icon",
    defaultPrompt: "A single interlocking jigsaw piece icon, centered, soft glow.",
    transparent: true,
  },
  {
    key: "feature_door",
    defaultFilename: "feature_door.png",
    label: "Door Badge",
    description: "Overlay placed on room exits that have a door (open, closed, or locked).",
    assetType: "ability_icon",
    defaultPrompt: "A single weathered wooden door with iron banding, centered, soft outline.",
    transparent: true,
  },
  {
    key: "feature_container",
    defaultFilename: "feature_container.png",
    label: "Container Badge",
    description: "Overlay placed on rooms that contain a chest or other lootable container.",
    assetType: "ability_icon",
    defaultPrompt: "A single ornate closed treasure chest, centered, soft glow.",
    transparent: true,
  },
  {
    key: "feature_lever",
    defaultFilename: "feature_lever.png",
    label: "Lever Badge",
    description: "Overlay placed on rooms that have a lever players can pull.",
    assetType: "ability_icon",
    defaultPrompt: "A single iron lever on a mounting plate, centered, soft outline.",
    transparent: true,
  },
  {
    key: "dialog_indicator",
    defaultFilename: "dialog_indicator.png",
    label: "Dialog Indicator",
    description: "Speech-bubble marker for NPCs with conversation trees.",
    assetType: "ability_icon",
    defaultPrompt: "A single empty speech-bubble icon, centered, soft outline, no text inside.",
    transparent: true,
  },
  {
    key: "aggro_indicator",
    defaultFilename: "aggro_indicator.png",
    label: "Aggro Indicator",
    description: "Warning glyph shown above hostile mobs.",
    assetType: "ability_icon",
    defaultPrompt: "A single bold red exclamation mark glyph, centered.",
    transparent: true,
  },
  {
    key: "quest_available_indicator",
    defaultFilename: "quest_available_indicator.png",
    label: "Quest Available",
    description: "Marker on NPCs offering an unaccepted quest.",
    assetType: "ability_icon",
    defaultPrompt: "A single golden exclamation mark glyph, centered.",
    transparent: true,
  },
  {
    key: "quest_complete_indicator",
    defaultFilename: "quest_complete_indicator.png",
    label: "Quest Complete",
    description: "Marker on NPCs ready to turn in a finished quest.",
    assetType: "ability_icon",
    defaultPrompt: "A single golden question mark glyph, centered.",
    transparent: true,
  },
  {
    key: "crafting_station",
    defaultFilename: "crafting_station.png",
    label: "Crafting Station",
    description: "Overlay placed on rooms with crafting stations.",
    assetType: "ability_icon",
    defaultPrompt: "A single blacksmith hammer crossed with tongs, centered.",
    transparent: true,
  },
  {
    key: "trainer_icon",
    defaultFilename: "trainer_icon.png",
    label: "Trainer",
    description: "Marker for class trainers and ability instructors.",
    assetType: "ability_icon",
    defaultPrompt: "A single open book with a ribbon bookmark, centered.",
    transparent: true,
  },
  {
    key: "bank_vault",
    defaultFilename: "bank_vault.png",
    label: "Bank Vault",
    description: "Overlay placed on rooms that host a bank.",
    assetType: "ability_icon",
    defaultPrompt: "A single heavy vault door with a circular dial, centered.",
    transparent: true,
  },
  {
    key: "lottery_board_widget",
    defaultFilename: "lottery_board_widget.png",
    label: "Lottery Board",
    description: "Badge shown on tavern rooms to open the lottery / gambling kiosk.",
    assetType: "ability_icon",
    defaultPrompt: "A single ornate lottery wheel or spinning fortune wheel with golden spokes, centered.",
    transparent: true,
  },
  {
    key: "dungeon_portal_widget",
    defaultFilename: "dungeon_portal_widget.png",
    label: "Dungeon Portal",
    description: "Badge shown on rooms with dungeon portals to open the dungeon kiosk.",
    assetType: "ability_icon",
    defaultPrompt: "A single glowing arcane portal doorway with swirling energy, centered.",
    transparent: true,
  },
  {
    key: "auction_hall_widget",
    defaultFilename: "auction_hall_widget.png",
    label: "Auction Hall",
    description: "Badge shown on rooms hosting the auction house.",
    assetType: "ability_icon",
    defaultPrompt: "A single auctioneer's gavel on an ornate block, centered, golden accents.",
    transparent: true,
  },
  {
    key: "duel_arena_widget",
    defaultFilename: "duel_arena_widget.png",
    label: "Duel Arena",
    description: "Badge shown on rooms where players can initiate duels.",
    assetType: "ability_icon",
    defaultPrompt: "Two crossed swords over a circular arena emblem, centered.",
    transparent: true,
  },
  {
    key: "stylist_mirror",
    defaultFilename: "stylist_mirror.png",
    label: "Stylist Mirror",
    description: "Mirror shown in rooms with a stylist NPC who can change a player's race.",
    assetType: "ability_icon",
    defaultPrompt:
      "An ornate full-length standing mirror with a decorative metallic frame, a spectral silhouette reflected in its glowing glass, soft starlight sparkles on the surface, centered, transparent background.",
    transparent: true,
  },
  {
    key: "housing_broker",
    defaultFilename: "housing_broker.png",
    label: "Housing Broker",
    description: "Badge shown on rooms with a housing broker NPC where players can buy and manage housing.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single ornate Victorian-style house icon with teal coloring and warm glowing windows, centered, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_unexplored",
    defaultFilename: "minimap-unexplored.png",
    label: "Minimap — Unexplored",
    description: "Fog-of-war tile shown on the minimap for unvisited rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A flat square tile of uniform muted blue-grey fog, gentle subtle texture, no detail, no objects, no figures, fills the entire square frame edge to edge.",
    transparent: false,
  },
  {
    key: "map_background",
    defaultFilename: "map_background.png",
    label: "Map Background",
    description: "Backdrop tile rendered behind the world map view.",
    assetType: "background",
    defaultPrompt:
      "A wide aged parchment or weathered vellum backdrop with subtle cartographer's texture, faint compass-rose watermark, soft warm sepia tones with hints of muted indigo, no readable text, no figures, suitable as a backdrop for an overlaid world map",
    transparent: false,
  },
] as const;

/** Set of required keys for fast membership checks. */
export const REQUIRED_GLOBAL_ASSET_KEYS: ReadonlySet<string> = new Set(
  REQUIRED_GLOBAL_ASSETS.map((a) => a.key),
);

/** Returns the keys missing or unassigned (empty value) in the given map. */
export function missingRequiredGlobalAssets(
  assets: Record<string, string>,
): RequiredGlobalAsset[] {
  return REQUIRED_GLOBAL_ASSETS.filter((a) => !assets[a.key]?.trim());
}
