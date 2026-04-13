// ─── Arcanum UI icons ───────────────────────────────────────────────
//
// Small icons used throughout the creator UI for visual clarity.
// Resized from originals to their target display dimensions.

// Role icons (20×20) — room role checkboxes + zone map badges
import roleAuction from "./role_auction.png";
import roleBank from "./role_bank.png";
import roleDungeon from "./role_dungeon.png";
import roleStation from "./role_station.png";
import roleHousingBroker from "./role_housing_broker.png";
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

// Getting-started step icons (24×24) — onboarding checklist
import gsWorldMap from "./gs_world_map.png";
import gsZone from "./gs_zone.png";
import gsCharacters from "./gs_characters.png";
import gsArt from "./gs_art.png";
import gsLore from "./gs_lore.png";
import gsConfig from "./gs_config.png";
import gsPublish from "./gs_publish.png";
import gsCompass from "./gs_compass.png";

// Toolbar icons (40×40 for 2× density) — top-bar buttons
import tbWorldMap from "./tb_world_map.png";
import tbCompass from "./tb_compass.png";
import tbSettings from "./tb_settings.png";

// Panel sidebar icons (24×24) — navigation glyphs
import panelMedia from "./panel_media.png";
import panelIcons from "./panel_icons.png";
import panelSprites from "./panel_sprites.png";
import panelClasses from "./panel_classes.png";
import panelRaces from "./panel_races.png";
import panelCreation from "./panel_creation.png";
import panelEquipment from "./panel_equipment.png";
import panelStats from "./panel_stats.png";
import panelAbilities from "./panel_abilities.png";
import panelConditions from "./panel_conditions.png";
import panelServer from "./panel_server.png";
import panelInfra from "./panel_infra.png";
import panelCommands from "./panel_commands.png";
import panelCurrencies from "./panel_currencies.png";
import panelScroll from "./panel_scroll.png";
import panelEnchanting from "./panel_enchanting.png";
import panelGuilds from "./panel_guilds.png";
import panelHousing from "./panel_housing.png";
import panelEmotes from "./panel_emotes.png";
import panelPets from "./panel_pets.png";
import panelSeasons from "./panel_seasons.png";
import panelAchievements from "./panel_achievements.png";
import panelCosmos from "./panel_cosmos.png";
import panelHourglass from "./panel_hourglass.png";
import panelRelations from "./panel_relations.png";
import panelDocuments from "./panel_documents.png";
import panelHub from "./panel_hub.png";
import panelShowcase from "./panel_showcase.png";
import panelTemplates from "./panel_templates.png";
import panelScenes from "./panel_scenes.png";
import panelKey from "./panel_key.png";
import panelCloud from "./panel_cloud.png";
import panelDeploy from "./panel_deploy.png";
import panelChest from "./panel_chest.png";
import panelNotepad from "./panel_notepad.png";
import panelBranch from "./panel_branch.png";
import panelConsole from "./panel_console.png";
import panelCrown from "./panel_crown.png";

// Miscellaneous icons
import miscCoin from "./misc_coin.png";
import miscNoImage from "./misc_no_image.png";

/** Room role key → icon URL. */
export const ROLE_ICONS: Record<string, string> = {
  bank: roleBank,
  tavern: roleTavern,
  dungeon: roleDungeon,
  auction: roleAuction,
  station: roleStation,
  stylist: roleStylist,
  housingBroker: roleHousingBroker,
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

/** Getting-started step icons (keyed by step id). */
export const GS_ICONS: Record<string, string> = {
  "world-map": gsWorldMap,
  zone: gsZone,
  characters: gsCharacters,
  art: gsArt,
  lore: gsLore,
  config: gsConfig,
  publish: gsPublish,
};

/** Getting-started toolbar compass icon. */
export const GS_COMPASS = gsCompass;

/** Toolbar button icons. */
export const TB_WORLD_MAP = tbWorldMap;
export const TB_COMPASS = tbCompass;
export const TB_SETTINGS = tbSettings;

/** Panel ID → icon URL. Used by sidebar, settings overlay, and command palette. */
export const PANEL_ICONS: Record<string, string> = {
  art: gsArt,
  artStyle: gsArt,
  media: panelMedia,
  portraits: gsCharacters,
  studioAbilities: panelIcons,
  sprites: panelSprites,
  classes: panelClasses,
  races: panelRaces,
  creation: panelCreation,
  equipment: panelEquipment,
  stats: panelStats,
  abilityDesigner: panelAbilities,
  conditions: panelConditions,
  tuningWizard: gsConfig,
  world: gsWorldMap,
  serverConfig: panelServer,
  infrastructure: panelInfra,
  commands: panelCommands,
  currencies: panelCurrencies,
  crafting: panelScroll,
  enchanting: panelEnchanting,
  guilds: panelGuilds,
  guildHalls: panelHousing,
  factions: panelGuilds,
  emotes: panelEmotes,
  housing: panelHousing,
  pets: panelPets,
  worldEvents: panelSeasons,
  weatherEnvironment: panelSeasons,
  achievements: panelAchievements,
  quests: panelScroll,
  lore: panelScroll,
  worldSetting: panelCosmos,
  loreMaps: gsZone,
  loreTimeline: panelHourglass,
  loreRelations: panelRelations,
  loreDocuments: panelDocuments,
  hubSettings: panelHub,
  showcaseSettings: panelShowcase,
  templates: panelTemplates,
  sceneTemplates: panelScenes,
  storyEditor: panelScenes,
  appearance: gsArt,
  services: panelKey,
  r2Settings: panelCloud,
  deployment: panelDeploy,
  sharedAssets: panelChest,
  rawYaml: panelNotepad,
  versionControl: panelBranch,
  console: panelConsole,
  admin: panelCrown,
};

/** Fallback coin icon for currencies without a custom glyph. */
export const MISC_COIN = miscCoin;

/** Empty-state placeholder for asset browser when no image is generated. */
export const MISC_NO_IMAGE = miscNoImage;
