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

export interface RequiredGlobalAsset {
  /** Lookup key written under `globalAssets` in application.yaml. */
  key: string;
  /** Canonical filename the MUD ships with — used as a hint when generating. */
  defaultFilename: string;
  /** Short label shown in the UI next to the key. */
  label: string;
  /** One-line description of where the asset appears in-game. */
  description: string;
}

export const REQUIRED_GLOBAL_ASSETS: readonly RequiredGlobalAsset[] = [
  {
    key: "video_available_indicator",
    defaultFilename: "video_available_indicator.png",
    label: "Video Available",
    description: "Marker shown on rooms or NPCs that have an associated cinematic.",
  },
  {
    key: "shop_kiosk",
    defaultFilename: "shop_kiosk.png",
    label: "Shop Kiosk",
    description: "Overlay placed on shopkeeper rooms to advertise the shop.",
  },
  {
    key: "dialog_indicator",
    defaultFilename: "dialog_indicator.png",
    label: "Dialog Indicator",
    description: "Speech-bubble marker for NPCs with conversation trees.",
  },
  {
    key: "aggro_indicator",
    defaultFilename: "aggro_indicator.png",
    label: "Aggro Indicator",
    description: "Warning glyph shown above hostile mobs.",
  },
  {
    key: "quest_available_indicator",
    defaultFilename: "quest_available_indicator.png",
    label: "Quest Available",
    description: "Marker on NPCs offering an unaccepted quest.",
  },
  {
    key: "quest_complete_indicator",
    defaultFilename: "quest_complete_indicator.png",
    label: "Quest Complete",
    description: "Marker on NPCs ready to turn in a finished quest.",
  },
  {
    key: "crafting_station",
    defaultFilename: "crafting_station.png",
    label: "Crafting Station",
    description: "Overlay placed on rooms with crafting stations.",
  },
  {
    key: "trainer_icon",
    defaultFilename: "trainer_icon.png",
    label: "Trainer",
    description: "Marker for class trainers and ability instructors.",
  },
  {
    key: "bank_vault",
    defaultFilename: "bank_vault.png",
    label: "Bank Vault",
    description: "Overlay placed on rooms that host a bank.",
  },
  {
    key: "tavern_icon",
    defaultFilename: "tavern_icon.png",
    label: "Tavern",
    description: "Marker for taverns and rest points.",
  },
  {
    key: "minimap_unexplored",
    defaultFilename: "minimap-unexplored.png",
    label: "Minimap — Unexplored",
    description: "Fog-of-war tile shown on the minimap for unvisited rooms.",
  },
  {
    key: "map_background",
    defaultFilename: "map_background.png",
    label: "Map Background",
    description: "Backdrop tile rendered behind the world map view.",
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
