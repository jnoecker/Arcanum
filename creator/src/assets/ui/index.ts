// ─── Arcanum UI icons ───────────────────────────────────────────────
//
// Small icons used throughout the creator UI for visual clarity.
// Resized from originals to their target display dimensions.

// Role icons (20×20) — room role checkboxes + zone map badges
import roleAuction from "./role_auction.png";
import roleBank from "./role_bank.png";
import roleDungeon from "./role_dungeon.png";
import roleStation from "./role_station.png";
import roleStylist from "./role_stylist.png";
import roleTavern from "./role_tavern.png";

// Feature type icons (16×16) — room feature badges
import featureContainer from "./feature_container.png";
import featureDoor from "./feature_door.png";
import featureLever from "./feature_lever.png";

// Terrain swatches (20×20) — terrain selector thumbnails
import terrainDesert from "./terrain_desert.png";
import terrainForest from "./terrain_forest.png";
import terrainInside from "./terrain_inside.png";
import terrainMountain from "./terrain_mountain.png";
import terrainOutside from "./terrain_outside.png";
import terrainSwamp from "./terrain_swamp.png";
import terrainUnderground from "./terrain_underground.png";
import terrainUnderwater from "./terrain_underwater.png";
import terrainUrban from "./terrain_urban.png";
import terrainSky from "./terrain_sky.png";

// Mob category icons (20×20) — mob editor category selector
import catAberration from "./cat_aberration.png";
import catBeast from "./cat_beast.png";
import catConstruct from "./cat_construct.png";
import catHumanoid from "./cat_humanoid.png";
import catElemental from "./cat_elemental.png";
import catUndead from "./cat_undead.png";

// Entity list icons (16×16) — room panel entity list items
import entityGather from "./entity_gather.png";
import entityItem from "./entity_item.png";
import entityMob from "./entity_mob.png";
import entityPuzzle from "./entity_puzzle.png";
import entityQuest from "./entity_quest.png";
import entityShop from "./entity_shop.png";
import entityTrainer from "./entity_trainer.png";

/** Room role key → icon URL. */
export const ROLE_ICONS: Record<string, string> = {
  bank: roleBank,
  tavern: roleTavern,
  dungeon: roleDungeon,
  auction: roleAuction,
  station: roleStation,
  stylist: roleStylist,
};

/** Feature type (lowercase) → icon URL. */
export const FEATURE_ICONS: Record<string, string> = {
  container: featureContainer,
  door: featureDoor,
  lever: featureLever,
};

/** Terrain value → swatch URL. */
export const TERRAIN_ICONS: Record<string, string> = {
  inside: terrainInside,
  outside: terrainOutside,
  forest: terrainForest,
  mountain: terrainMountain,
  underground: terrainUnderground,
  underwater: terrainUnderwater,
  desert: terrainDesert,
  swamp: terrainSwamp,
  urban: terrainUrban,
  sky: terrainSky,
};

/** Mob category value → icon URL. */
export const CATEGORY_ICONS: Record<string, string> = {
  humanoid: catHumanoid,
  beast: catBeast,
  undead: catUndead,
  elemental: catElemental,
  construct: catConstruct,
  aberration: catAberration,
};

/** Entity kind → icon URL. */
export const ENTITY_ICONS: Record<string, string> = {
  mob: entityMob,
  item: entityItem,
  shop: entityShop,
  trainer: entityTrainer,
  gatheringNode: entityGather,
  quest: entityQuest,
  puzzle: entityPuzzle,
};
