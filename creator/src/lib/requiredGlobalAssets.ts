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
    defaultPrompt:
      "A glowing film-reel or play-button icon hovering as a small magical sigil, centered, soft luminous bloom, no text, no figures, simple iconic shape, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "shop_kiosk",
    defaultFilename: "shop_kiosk.png",
    label: "Shop Kiosk",
    description: "Overlay placed on shopkeeper rooms to advertise the shop.",
    assetType: "ability_icon",
    defaultPrompt:
      "A small ornate coin-purse or merchant-scale icon, glowing softly, suggesting commerce and trade, centered, simple iconic shape, no text, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "dialog_indicator",
    defaultFilename: "dialog_indicator.png",
    label: "Dialog Indicator",
    description: "Speech-bubble marker for NPCs with conversation trees.",
    assetType: "ability_icon",
    defaultPrompt:
      "A softly glowing speech-bubble or whisper-glyph icon suggesting conversation, centered, simple iconic shape, no text inside the bubble, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "aggro_indicator",
    defaultFilename: "aggro_indicator.png",
    label: "Aggro Indicator",
    description: "Warning glyph shown above hostile mobs.",
    assetType: "ability_icon",
    defaultPrompt:
      "A warning glyph — a stylized exclamation mark or jagged warning sigil glowing in warm amber-red light, centered, simple iconic shape, no text, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "quest_available_indicator",
    defaultFilename: "quest_available_indicator.png",
    label: "Quest Available",
    description: "Marker on NPCs offering an unaccepted quest.",
    assetType: "ability_icon",
    defaultPrompt:
      "A bright golden exclamation-mark sigil glowing softly, suggesting an offered quest, centered, simple iconic shape, no text, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "quest_complete_indicator",
    defaultFilename: "quest_complete_indicator.png",
    label: "Quest Complete",
    description: "Marker on NPCs ready to turn in a finished quest.",
    assetType: "ability_icon",
    defaultPrompt:
      "A golden question-mark sigil glowing softly, suggesting a quest ready to be turned in, centered, simple iconic shape, no text, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "crafting_station",
    defaultFilename: "crafting_station.png",
    label: "Crafting Station",
    description: "Overlay placed on rooms with crafting stations.",
    assetType: "ability_icon",
    defaultPrompt:
      "A small icon depicting a hammer crossed with tongs or a glowing forge sigil, suggesting crafting and creation, centered, simple iconic shape, no text, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "trainer_icon",
    defaultFilename: "trainer_icon.png",
    label: "Trainer",
    description: "Marker for class trainers and ability instructors.",
    assetType: "ability_icon",
    defaultPrompt:
      "A small icon depicting an open book with a glowing ribbon or a mentor's staff, suggesting teaching and skill mastery, centered, simple iconic shape, no text, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "bank_vault",
    defaultFilename: "bank_vault.png",
    label: "Bank Vault",
    description: "Overlay placed on rooms that host a bank.",
    assetType: "ability_icon",
    defaultPrompt:
      "A small icon depicting a heavy vault door with an ornate keyhole or stacked coins behind a magical seal, suggesting secure storage, centered, simple iconic shape, no text, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "tavern_icon",
    defaultFilename: "tavern_icon.png",
    label: "Tavern",
    description: "Marker for taverns and rest points.",
    assetType: "ability_icon",
    defaultPrompt:
      "A small icon depicting a foaming tankard or a warm hearth flame, suggesting rest and refreshment, centered, simple iconic shape, no text, no figures, isolated on a flat solid background for compositing",
    transparent: true,
  },
  {
    key: "minimap_unexplored",
    defaultFilename: "minimap-unexplored.png",
    label: "Minimap — Unexplored",
    description: "Fog-of-war tile shown on the minimap for unvisited rooms.",
    assetType: "ability_icon",
    defaultPrompt:
      "A square fog-of-war tile — soft swirling mist in muted blue-grey tones, suggesting an unexplored region, no detail, no figures, no text, fills the entire square frame edge to edge",
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
