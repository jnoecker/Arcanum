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
  /** Generation aspect ratio. Defaults to "square" (1024×1024) when omitted. */
  aspect?: "square" | "landscape" | "portrait";
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
    key: "inn_widget",
    defaultFilename: "inn_widget.png",
    label: "Inn",
    description: "Badge shown on inn rooms where players can rest and set their recall point.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single cozy curtained bed with a warm glowing lantern beside it, centered, soft outline, transparent background.",
    transparent: true,
  },
  // Persistent player-UI navigation buttons rendered down the left edge of
  // every room canvas (unlike the room-feature badges above, which only
  // appear on rooms that host the corresponding feature).
  {
    key: "character_widget",
    defaultFilename: "character_widget.png",
    label: "Character Panel",
    description: "Left-edge nav button that opens the character sheet.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single human bust silhouette portrait icon, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "inventory_widget",
    defaultFilename: "inventory_widget.png",
    label: "Inventory Panel",
    description: "Left-edge nav button that opens the inventory.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single open satchel or backpack icon, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "equipment_widget",
    defaultFilename: "equipment_widget.png",
    label: "Equipment Panel",
    description: "Left-edge nav button that opens the equipment / worn-gear screen.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single suit-of-armor breastplate icon, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "spellbook_widget",
    defaultFilename: "spellbook_widget.png",
    label: "Spellbook Panel",
    description: "Left-edge nav button that opens the spellbook / abilities screen.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single closed spellbook with an arcane rune on the cover, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "quests_widget",
    defaultFilename: "quests_widget.png",
    label: "Quests Panel",
    description: "Left-edge nav button that opens the active-quests journal.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single furled quest scroll icon, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "combat_log_widget",
    defaultFilename: "combat_log_widget.png",
    label: "Combat Log Panel",
    description: "Left-edge nav button that opens the combat log.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single crossed-swords emblem over a small lined parchment, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "social_widget",
    defaultFilename: "social_widget.png",
    label: "Social Panel",
    description: "Left-edge nav button that opens the social / chat / party screen.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single pair of overlapping speech-bubble icons, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "crafting_widget",
    defaultFilename: "crafting_widget.png",
    label: "Crafting Panel",
    description: "Left-edge nav button that opens the crafting screen.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single blacksmith hammer crossed with tongs, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "auction_widget",
    defaultFilename: "auction_widget.png",
    label: "Auction Panel",
    description: "Left-edge nav button that opens the auction house screen.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single auctioneer's gavel on an ornate block, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "mail_widget",
    defaultFilename: "mail_widget.png",
    label: "Mail Panel",
    description: "Left-edge nav button that opens the in-game mail screen.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single sealed envelope icon, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "help_widget",
    defaultFilename: "help_widget.png",
    label: "Help Panel",
    description: "Left-edge nav button that opens the help / documentation screen.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single question mark inside a circle icon, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "terminal_widget",
    defaultFilename: "terminal_widget.png",
    label: "Terminal",
    description: "Left-edge nav button that opens the text-based game terminal.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single retro command-line terminal window with a blinking prompt cursor, centered, soft outline, transparent background.",
    transparent: true,
  },
  // Navigation compass: a central rose that fills the compass box, plus one
  // glyph per movement direction for the surrounding buttons.
  {
    key: "compass_widget",
    defaultFilename: "compass_widget.png",
    label: "Compass Rose",
    description: "Central compass rose that fills the navigation compass box.",
    assetType: "ability_icon",
    defaultPrompt:
      "An ornate golden eight-point compass rose star with fine engraved detail and a small central hub, dark navy backdrop, centered, transparent background.",
    transparent: true,
  },
  {
    key: "compass_north",
    defaultFilename: "compass_north.png",
    label: "Compass — North",
    description: "Glyph for the North movement button on the navigation compass.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single upward-pointing ornate golden arrow glyph, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "compass_south",
    defaultFilename: "compass_south.png",
    label: "Compass — South",
    description: "Glyph for the South movement button on the navigation compass.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single downward-pointing ornate golden arrow glyph, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "compass_east",
    defaultFilename: "compass_east.png",
    label: "Compass — East",
    description: "Glyph for the East movement button on the navigation compass.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single right-pointing ornate golden arrow glyph, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "compass_west",
    defaultFilename: "compass_west.png",
    label: "Compass — West",
    description: "Glyph for the West movement button on the navigation compass.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single left-pointing ornate golden arrow glyph, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "compass_up",
    defaultFilename: "compass_up.png",
    label: "Compass — Up",
    description: "Glyph for the Up (ascend) movement button on the navigation compass.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single golden double-chevron pointing up, suggesting ascent, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "compass_down",
    defaultFilename: "compass_down.png",
    label: "Compass — Down",
    description: "Glyph for the Down (descend) movement button on the navigation compass.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single golden double-chevron pointing down, suggesting descent, centered, soft outline, transparent background.",
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
  // Optional client backdrops. Each is layered under a legibility scrim and
  // falls back to the solid/floating look when the asset is absent.
  {
    key: "room_panel_bg",
    defaultFilename: "room_panel_bg.png",
    label: "Room Panel Background",
    description: "Backdrop behind the whole room box (description + compass), under a dark legibility scrim.",
    assetType: "background",
    defaultPrompt:
      "A dark atmospheric decorative backdrop with subtle magical texture, deep midnight-teal tones, faint ambient detail, no figures, no readable text, suitable beneath a panel of readable body text.",
    transparent: false,
    aspect: "landscape",
  },
  {
    key: "compass_bg",
    defaultFilename: "compass_bg.png",
    label: "Compass Background",
    description: "Backdrop behind the compass rose (rounded square). No scrim — the rose and letters sit on top.",
    assetType: "background",
    defaultPrompt:
      "A decorative rounded-square backdrop tile with a subtle starfield and faint aged-parchment texture, warm muted gold and indigo tones, no readable text, suitable behind a compass rose.",
    transparent: false,
  },
  {
    key: "action_bar_bg",
    defaultFilename: "action_bar_bg.png",
    label: "Action Bar Background",
    description: "Backdrop for the bottom dock (panel buttons / skill bar), under a dark legibility scrim.",
    assetType: "background",
    defaultPrompt:
      "A wide horizontal decorative backdrop strip with subtle texture, deep midnight tones with faint ember accents, no figures, no readable text, suitable beneath a row of icon buttons.",
    transparent: false,
    aspect: "landscape",
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
