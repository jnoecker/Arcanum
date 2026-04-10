// ─── Required default assets ────────────────────────────────────────
//
// The MUD looks up these keys under `ambonmud.images.defaultAssets` for
// fallback artwork when a zone entity has no custom image assigned.
// Terrain backgrounds tile behind rooms by sector type; mob/item/entity
// sprites appear as placeholder portraits or icons in the client.
//
// Spring Boot replaces the entire map when the project provides any
// entries, so every key the MUD needs must be present in the project's
// config — there's no per-entry merge with the Kotlin defaults.

import type { AssetType } from "@/types/assets";

export interface RequiredDefaultAsset {
  /** Lookup key written under `defaultAssets` in application.yaml. */
  key: string;
  /** Canonical filename the MUD ships with — used as a hint when generating. */
  defaultFilename: string;
  /** Short label shown in the UI next to the key. */
  label: string;
  /** One-line description of where the asset appears in-game. */
  description: string;
  /** Grouping category for UI organization. */
  category: "terrain" | "mob" | "item" | "entity";
  /** Asset type bucket — drives gallery categorization and prompt style. */
  assetType: AssetType;
  /** Sensible default prompt to seed the generator with. */
  defaultPrompt: string;
  /** Whether background removal should be enabled by default after generation. */
  transparent: boolean;
  /** Target width in pixels. */
  width: number;
  /** Target height in pixels. */
  height: number;
}

// ─── Category metadata ──────────────────────────────────────────────

export const DEFAULT_ASSET_CATEGORIES = [
  {
    id: "terrain",
    label: "Terrain Backgrounds",
    description: "Tileable room backgrounds keyed by sector type.",
  },
  {
    id: "mob",
    label: "Mob Sprites",
    description: "Fallback portraits for mob creature categories.",
  },
  {
    id: "item",
    label: "Item Sprites",
    description: "Fallback icons for item types and equipment slots.",
  },
  {
    id: "entity",
    label: "Entity Sprites",
    description: "Fallback sprites for players and abilities.",
  },
] as const;

// ─── Asset definitions ──────────────────────────────────────────────

export const REQUIRED_DEFAULT_ASSETS: readonly RequiredDefaultAsset[] = [
  // ── Terrain backgrounds (128×128) ─────────────────────────────────
  {
    key: "default_bg_inside",
    defaultFilename: "bg_inside.png",
    label: "Inside",
    description: "Default background for indoor rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Warm torch-lit stone interior, arched walls, tileable dungeon floor texture, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_outside",
    defaultFilename: "bg_outside.png",
    label: "Outside",
    description: "Default background for outdoor rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Sunlit grassy clearing with scattered wildflowers, tileable meadow texture, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_forest",
    defaultFilename: "bg_forest.png",
    label: "Forest",
    description: "Default background for forest rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Dense canopy of ancient trees, dappled light through leaves, tileable forest floor, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_mountain",
    defaultFilename: "bg_mountain.png",
    label: "Mountain",
    description: "Default background for mountain rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Craggy grey stone and sparse alpine shrubs, tileable rocky mountain terrain, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_underground",
    defaultFilename: "bg_underground.png",
    label: "Underground",
    description: "Default background for underground and cave rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Dark cavern with faint bioluminescent crystals, tileable rough cave floor, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_underwater",
    defaultFilename: "bg_underwater.png",
    label: "Underwater",
    description: "Default background for underwater rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Deep blue ocean floor with swaying kelp and coral, tileable underwater seabed, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_desert",
    defaultFilename: "bg_desert.png",
    label: "Desert",
    description: "Default background for desert rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Sun-baked golden sand dunes with wind-swept ripples, tileable arid desert texture, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_swamp",
    defaultFilename: "bg_swamp.png",
    label: "Swamp",
    description: "Default background for swamp rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Murky green marshland with moss-covered roots and still water, tileable swamp floor, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_urban",
    defaultFilename: "bg_urban.png",
    label: "Urban",
    description: "Default background for city and town rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Worn cobblestone street with mortar seams and drain grate, tileable city pavement, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },
  {
    key: "default_bg_sky",
    defaultFilename: "bg_sky.png",
    label: "Sky",
    description: "Default background for aerial and sky rooms.",
    category: "terrain",
    assetType: "background",
    defaultPrompt: "Open sky with wisps of cloud and faint stars, tileable ethereal atmosphere texture, top-down.",
    transparent: false,
    width: 128,
    height: 128,
  },

  // ── Mob category sprites (64×64) ──────────────────────────────────
  {
    key: "default_mob_humanoid",
    defaultFilename: "mob_humanoid.png",
    label: "Humanoid",
    description: "Fallback portrait for humanoid mobs.",
    category: "mob",
    assetType: "entity_portrait",
    defaultPrompt: "Dark silhouette of a cloaked humanoid figure, iconic stance, centered on transparent background.",
    transparent: true,
    width: 64,
    height: 64,
  },
  {
    key: "default_mob_beast",
    defaultFilename: "mob_beast.png",
    label: "Beast",
    description: "Fallback portrait for beast and animal mobs.",
    category: "mob",
    assetType: "entity_portrait",
    defaultPrompt: "Dark silhouette of a prowling wolf-like beast, centered on transparent background.",
    transparent: true,
    width: 64,
    height: 64,
  },
  {
    key: "default_mob_undead",
    defaultFilename: "mob_undead.png",
    label: "Undead",
    description: "Fallback portrait for undead mobs.",
    category: "mob",
    assetType: "entity_portrait",
    defaultPrompt: "Dark silhouette of a shambling skeletal figure with glowing eye sockets, centered on transparent background.",
    transparent: true,
    width: 64,
    height: 64,
  },
  {
    key: "default_mob_elemental",
    defaultFilename: "mob_elemental.png",
    label: "Elemental",
    description: "Fallback portrait for elemental mobs.",
    category: "mob",
    assetType: "entity_portrait",
    defaultPrompt: "Swirling elemental vortex of fire and stone, iconic sprite, centered on transparent background.",
    transparent: true,
    width: 64,
    height: 64,
  },
  {
    key: "default_mob_construct",
    defaultFilename: "mob_construct.png",
    label: "Construct",
    description: "Fallback portrait for construct and golem mobs.",
    category: "mob",
    assetType: "entity_portrait",
    defaultPrompt: "Dark silhouette of a hulking stone golem with glowing runes, centered on transparent background.",
    transparent: true,
    width: 64,
    height: 64,
  },
  {
    key: "default_mob_aberration",
    defaultFilename: "mob_aberration.png",
    label: "Aberration",
    description: "Fallback portrait for aberration and eldritch mobs.",
    category: "mob",
    assetType: "entity_portrait",
    defaultPrompt: "Dark silhouette of a tentacled eldritch horror, unsettling shape, centered on transparent background.",
    transparent: true,
    width: 64,
    height: 64,
  },

  // ── Item type sprites (48×48) ─────────────────────────────────────
  {
    key: "default_item_weapon",
    defaultFilename: "item_weapon.png",
    label: "Weapon",
    description: "Fallback icon for weapon-slot items.",
    category: "item",
    assetType: "ability_icon",
    defaultPrompt: "A single gleaming longsword with ornate crossguard, centered, iconic sprite.",
    transparent: true,
    width: 48,
    height: 48,
  },
  {
    key: "default_item_head",
    defaultFilename: "item_head.png",
    label: "Head Armor",
    description: "Fallback icon for head-slot equipment.",
    category: "item",
    assetType: "ability_icon",
    defaultPrompt: "A single steel helm with a narrow visor slit, centered, iconic sprite.",
    transparent: true,
    width: 48,
    height: 48,
  },
  {
    key: "default_item_body",
    defaultFilename: "item_body.png",
    label: "Body Armor",
    description: "Fallback icon for body-slot equipment.",
    category: "item",
    assetType: "ability_icon",
    defaultPrompt: "A single chainmail hauberk on an invisible stand, centered, iconic sprite.",
    transparent: true,
    width: 48,
    height: 48,
  },
  {
    key: "default_item_hand",
    defaultFilename: "item_hand.png",
    label: "Hand Armor",
    description: "Fallback icon for hand-slot equipment.",
    category: "item",
    assetType: "ability_icon",
    defaultPrompt: "A pair of armored gauntlets with riveted knuckles, centered, iconic sprite.",
    transparent: true,
    width: 48,
    height: 48,
  },
  {
    key: "default_item_consumable",
    defaultFilename: "item_consumable.png",
    label: "Consumable",
    description: "Fallback icon for potions and consumable items.",
    category: "item",
    assetType: "ability_icon",
    defaultPrompt: "A single glowing potion flask with a cork stopper, centered, iconic sprite.",
    transparent: true,
    width: 48,
    height: 48,
  },
  {
    key: "default_item_generic",
    defaultFilename: "item_generic.png",
    label: "Generic Item",
    description: "Fallback icon for miscellaneous items with no specific slot.",
    category: "item",
    assetType: "ability_icon",
    defaultPrompt: "A single cloth-wrapped bundle tied with twine, centered, iconic sprite.",
    transparent: true,
    width: 48,
    height: 48,
  },

  // ── Entity sprites ────────────────────────────────────────────────
  {
    key: "default_player",
    defaultFilename: "player.png",
    label: "Player",
    description: "Default avatar shown for players with no custom portrait.",
    category: "entity",
    assetType: "entity_portrait",
    defaultPrompt: "A hooded adventurer silhouette holding a lantern, centered on transparent background.",
    transparent: true,
    width: 64,
    height: 64,
  },
  {
    key: "default_ability",
    defaultFilename: "ability.png",
    label: "Ability",
    description: "Default icon shown for abilities with no custom artwork.",
    category: "entity",
    assetType: "ability_icon",
    defaultPrompt: "A single swirling arcane rune circle with soft glow, centered, iconic sprite.",
    transparent: true,
    width: 48,
    height: 48,
  },
] as const;

/** Set of required keys for fast membership checks. */
export const REQUIRED_DEFAULT_ASSET_KEYS: ReadonlySet<string> = new Set(
  REQUIRED_DEFAULT_ASSETS.map((a) => a.key),
);

/** Returns the entries missing or unassigned (empty value) in the given map. */
export function missingRequiredDefaultAssets(
  assets: Record<string, string>,
): RequiredDefaultAsset[] {
  return REQUIRED_DEFAULT_ASSETS.filter((a) => !assets[a.key]?.trim());
}
