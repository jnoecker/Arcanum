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
  // Navigation compass: one glyph per movement direction for the buttons
  // surrounding the compass box.
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
  // Torn-parchment minimap: a paper sheet backdrop plus square ink stamps
  // drawn centered on each room node. The client clips the sheet to a torn
  // polygon and inks the frame, so the backdrop is a plain rectangular fill;
  // the room stamps are transparent so they sit on the paper.
  {
    key: "minimap_bg",
    defaultFilename: "minimap_bg.png",
    label: "Minimap — Parchment",
    description: "Aged-paper sheet behind the minimap. The client clips it to a torn polygon and inks the frame on top — supply a clean rectangular fill, no border.",
    assetType: "background",
    defaultPrompt:
      "A flat aged-paper texture filling the frame edge to edge — visible paper fibers, faint stains and discoloration, warm sepia tone, no border, no torn edge, no drawing, no figures, no readable text.",
    transparent: false,
    aspect: "landscape",
  },
  {
    key: "minimap_room",
    defaultFilename: "minimap_room.png",
    label: "Minimap — Room",
    description: "Stamp for an explored room. The workhorse — most of the map — so keep it calm and neutral.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single small hand-inked square room icon, pale paper-wash fill, thin sepia ink outline, slightly uneven hand-drawn edges, centered, with slight padding so the ink edges aren't clipped, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  // Per-terrain room stamps. The client resolves minimap_room_<terrain>
  // first and falls back to the generic minimap_room (then a procedural box)
  // when a terrain glyph isn't registered, so any subset is fine. Keep them
  // as bold silhouettes that read at node scale.
  {
    key: "minimap_room_inside",
    defaultFilename: "minimap_room_inside.png",
    label: "Minimap — Inside",
    description: "Terrain stamp for indoor rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked glyph of an open interior doorway or arch, pale paper-wash fill, sepia ink outline, simple silhouette that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_outside",
    defaultFilename: "minimap_room_outside.png",
    label: "Minimap — Outside",
    description: "Terrain stamp for open-air rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked glyph of a small sun rising over a horizon line, pale paper-wash fill, sepia ink outline, simple silhouette that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_forest",
    defaultFilename: "minimap_room_forest.png",
    label: "Minimap — Forest",
    description: "Terrain stamp for forest rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked pine-tree silhouette, pale paper-wash fill, sepia ink outline, simple shape that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_mountain",
    defaultFilename: "minimap_room_mountain.png",
    label: "Minimap — Mountain",
    description: "Terrain stamp for mountain rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked peaked-mountain silhouette, pale paper-wash fill, sepia ink outline, simple shape that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_underground",
    defaultFilename: "minimap_room_underground.png",
    label: "Minimap — Underground",
    description: "Terrain stamp for underground / cave rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked cave-mouth arch with a couple of stalactites, pale paper-wash fill, sepia ink outline, simple silhouette that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_underwater",
    defaultFilename: "minimap_room_underwater.png",
    label: "Minimap — Underwater",
    description: "Terrain stamp for underwater rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked glyph of a curling wave with a rising bubble, pale paper-wash fill, sepia ink outline, simple silhouette that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_desert",
    defaultFilename: "minimap_room_desert.png",
    label: "Minimap — Desert",
    description: "Terrain stamp for desert rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked glyph of sand dunes beneath a small sun, pale paper-wash fill, sepia ink outline, simple silhouette that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_swamp",
    defaultFilename: "minimap_room_swamp.png",
    label: "Minimap — Swamp",
    description: "Terrain stamp for swamp rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked glyph of marsh reeds and cattails over a water ripple, pale paper-wash fill, sepia ink outline, simple silhouette that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_urban",
    defaultFilename: "minimap_room_urban.png",
    label: "Minimap — Urban",
    description: "Terrain stamp for urban / settlement rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked silhouette of a cluster of rooftops and buildings, pale paper-wash fill, sepia ink outline, simple shape that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_sky",
    defaultFilename: "minimap_room_sky.png",
    label: "Minimap — Sky",
    description: "Terrain stamp for sky / aerial rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bold hand-inked cloud silhouette, pale paper-wash fill, sepia ink outline, simple shape that reads at small size, centered, with slight padding, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_current",
    defaultFilename: "minimap_room_current.png",
    label: "Minimap — Current Room",
    description: "\"You are here\" stamp. Most prominent — rendered larger than other rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single small hand-inked square room icon in sienna-red ink with a clear central marker (a filled dot or an X), pale paper-wash fill, slightly uneven hand-drawn edges, centered, with slight padding so the ink edges aren't clipped, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_unexplored",
    defaultFilename: "minimap-unexplored.png",
    label: "Minimap — Unexplored",
    description: "Faint stamp for an unvisited room — low contrast so explored rooms pop.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single faint, ghosted square room outline in pale washed-out sepia ink, very low contrast, an optional faint question mark in the center, slightly uneven hand-drawn edges, centered, with slight padding so the edges aren't clipped, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_room_housing",
    defaultFilename: "minimap_room_housing.png",
    label: "Minimap — Housing",
    description: "Stamp marking player housing on the minimap.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single small hand-inked house glyph with a peaked roof, pale paper-wash fill, thin sepia ink outline, slightly uneven hand-drawn edges, centered, with slight padding so the ink edges aren't clipped, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_quest",
    defaultFilename: "minimap_quest.png",
    label: "Minimap — Quest",
    description: "Overlay haloing a room with a quest objective. Drawn slightly larger than the room box and pulsed via opacity — keep it flat, no baked glow.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single flat amber ring or diamond marker, solid even color, no glow, no gradient, crisp clean edges, slightly uneven hand-drawn line, centered, with slight padding so the edges aren't clipped, isolated on a flat solid background, transparent background.",
    transparent: true,
  },
  {
    key: "minimap_expand",
    defaultFilename: "minimap_expand.png",
    label: "Minimap — Expand",
    description: "Corner button on the minimap that opens the full world map.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single expand-to-fullscreen glyph — four short arrows pointing outward to the corners of a square frame, centered, soft outline, transparent background.",
    transparent: true,
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
    key: "monster_manual_bg",
    defaultFilename: "monster_manual_bg.png",
    label: "Monster Manual Frame",
    description: "Painted parchment frame layered behind the monster-manual (mob inspect) card — ornate border plus a ribbon area in the top-right for the \"Favored\" tag. Falls back to procedural paper when absent.",
    assetType: "background",
    defaultPrompt:
      "A landscape aged-parchment page with an ornate hand-painted border of vines and flourishes framing the edges, warm sepia paper in the center, a small decorative ribbon banner in the top-right corner, jewel-toned accents, no readable text, no figures, suitable as a backdrop for an overlaid creature-codex card.",
    transparent: false,
    aspect: "landscape",
  },
  {
    key: "inventory_satchel_bg",
    defaultFilename: "inventory_satchel_bg.png",
    label: "Inventory Satchel Texture",
    description: "Leather texture layered over the procedural satchel inventory background. Falls back to procedural leather when absent.",
    assetType: "background",
    defaultPrompt:
      "A worn leather texture filling the frame edge to edge — supple tanned hide with subtle grain, faint stitching, and gentle wear, warm brown tones, no border, no objects, no figures, no readable text, suitable as a backdrop layered behind inventory pockets.",
    transparent: false,
  },
  {
    key: "equipment_bg",
    defaultFilename: "equipment_bg.png",
    label: "Equipment Backdrop",
    description: "Backdrop behind the equipment panel — the \"dark dressing room\". Falls back to the procedural panel when absent.",
    assetType: "background",
    defaultPrompt:
      "A dark, moody dressing-room backdrop — deep violet and midnight tones, soft ambient glow, subtle atmospheric depth, a faint suggestion of draped fabric or a tall mirror, no figures, no readable text, suitable as a backdrop behind a character equipment panel.",
    transparent: false,
    aspect: "landscape",
  },
  // HUD chrome frames. Transparent overlays the UI sits on, so they read as
  // ornaments (full-width frame element, not a centered icon).
  {
    key: "vitals_bar_bg",
    defaultFilename: "vitals_bar_bg.png",
    label: "Vitals Bar Branch",
    description: "Horizontal branch the HP/MP bar rests on. Transparent overlay spanning the top of the play area.",
    assetType: "ornament",
    defaultPrompt:
      "A long horizontal tree branch spanning the full width, gnarled bark wrapped in climbing vines, small blossoms, and tiny mushrooms with a few leaves, the ends tapering off cleanly; whimsical hand-painted storybook style; isolated on a flat solid background, transparent background, no scene.",
    transparent: true,
    aspect: "landscape",
  },
  {
    key: "room_sign_bg",
    defaultFilename: "room_sign_bg.png",
    label: "Room Name Sign",
    description: "Hand-carved wooden sign that hangs below the vitals branch and holds the room name. Transparent overlay; leave the face blank (the UI draws the name).",
    assetType: "ornament",
    defaultPrompt:
      "A small hand-carved wooden hanging sign, whimsical Disney-storybook style, a rounded weathered plank with a carved border and short hanging ropes or chains at the top, a couple of vines or tiny mushrooms at the corners, blank face with no text; isolated on a flat solid background, transparent background, no scene.",
    transparent: true,
    aspect: "landscape",
  },
  // Mob interaction action buttons. Tiny (~22px render), so bold silhouettes.
  {
    key: "action_attack",
    defaultFilename: "action_attack.png",
    label: "Action — Attack",
    description: "Icon on the Attack button in the mob interaction bar.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single small crossed-swords emblem, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_quest",
    defaultFilename: "action_quest.png",
    label: "Action — Quest",
    description: "Icon on the Quest / Turn In Quest button in the mob interaction bar.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single furled quest scroll, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_talk",
    defaultFilename: "action_talk.png",
    label: "Action — Talk",
    description: "Icon on the Talk button in the mob interaction bar.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single speech-bubble icon, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_shop",
    defaultFilename: "action_shop.png",
    label: "Action — Shop",
    description: "Icon on the Browse Shop button in the mob interaction bar.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single coin pouch with a few spilling coins, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_cinematic",
    defaultFilename: "action_cinematic.png",
    label: "Action — Cinematic",
    description: "Icon on the Cinematic button in the mob interaction bar.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single play-button triangle inside a soft circle, bold silhouette that reads at small size, centered, transparent background.",
    transparent: true,
  },
  {
    key: "action_possess",
    defaultFilename: "action_possess.png",
    label: "Action — Possess",
    description: "Icon on the Possess (staff) button in the mob interaction bar.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single wisp of spirit smoke with a small sparkle, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_close",
    defaultFilename: "action_close.png",
    label: "Action — Close",
    description: "Icon on the Close button in the mob interaction bar.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single left-pointing back chevron arrow, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_entry",
    defaultFilename: "action_entry.png",
    label: "Action — Entry",
    description: "Icon on the button that returns to the entry screen (mob description and image) from a sub-screen like Talk or Quest.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single open book with a portrait page, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_get",
    defaultFilename: "action_get.png",
    label: "Action — Get",
    description: "Icon on the Get / pick-up button for items.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single open grasping hand reaching for a small item, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_look",
    defaultFilename: "action_look.png",
    label: "Action — Look",
    description: "Icon on the Look / examine button for items.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single magnifying glass, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_use",
    defaultFilename: "action_use.png",
    label: "Action — Use",
    description: "Icon on the Use button for items.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single tilted potion bottle with a small rising sparkle, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_drop",
    defaultFilename: "action_drop.png",
    label: "Action — Drop",
    description: "Icon on the Drop button for items.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single open hand releasing a small item downward, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_equip",
    defaultFilename: "action_equip.png",
    label: "Action — Equip",
    description: "Icon on the Equip button for items.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single suit-of-armor breastplate, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_store",
    defaultFilename: "action_store.png",
    label: "Action — Store",
    description: "Icon on the Put / Store button for items (into a container).",
    assetType: "ability_icon",
    defaultPrompt:
      "A single open storage chest with a small downward arrow above it, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
  },
  {
    key: "action_unequip",
    defaultFilename: "action_unequip.png",
    label: "Action — Unequip",
    description: "Icon on the Unequip button for equipped items.",
    assetType: "ability_icon",
    defaultPrompt:
      "A single suit-of-armor breastplate with a small outward-pointing arrow, bold silhouette that reads at small size, centered, soft outline, transparent background.",
    transparent: true,
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
