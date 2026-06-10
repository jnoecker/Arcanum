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
import roleInn from "./role_inn.png";
import roleStylist from "./role_stylist.png";
import roleTavern from "./role_tavern.png";
// Placeholder: reuses the scroll panel icon until a bespoke role_akathavae_shrine.png is generated.
import roleAkathavaeShrine from "./panel_scroll.png";

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

// Panel sidebar icons (24×24) — only the ones still used after the
// island-themed icon set replaced most generic panel icons.
import panelHub from "./panel_hub.png";
import panelShowcase from "./panel_showcase.png";
import panelTemplates from "./panel_templates.png";
import panelScenes from "./panel_scenes.png";
import panelKey from "./panel_key.png";
import panelCloud from "./panel_cloud.png";
import panelNotepad from "./panel_notepad.png";
import panelBranch from "./panel_branch.png";

// Miscellaneous icons
import miscCoin from "./misc_coin.png";
import miscNoImage from "./misc_no_image.png";

// ─── Island sidebar icons ───────────────────────────────────────────
// 8 top-level entries (6 islands + Articles + Zones), plus a back arrow.
import islandArcanum from "./island_arcanum.webp";
import islandForge from "./island_forge.webp";
import islandLoom from "./island_loom.webp";
import islandOrrery from "./island_orrery.webp";
import islandLivingWorld from "./island_living_world.webp";
import islandSpire from "./island_spire.webp";
import islandArticles from "./island_articles.webp";
import islandZones from "./island_zones.webp";
import uiArrow from "./ui_arrow.webp";

// Themed panel icons — replace the generic panel_*.png entries below
// for panels that have a per-island themed version.
import forgeArt from "./forge_art.webp";
import forgeArtStyle from "./forge_art_style.webp";
import forgeIcons from "./forge_icons.webp";
import forgeMedia from "./forge_media.webp";
import forgePlayerSprites from "./forge_player_sprites.webp";
import forgePlaytest from "./forge_playtest.webp";
import forgePortraits from "./forge_portraits.webp";
import loomAbilities from "./loom_abilities.webp";
import loomClasses from "./loom_classes.webp";
import loomCommands from "./loom_commands.webp";
import loomEquipment from "./loom_equipment.webp";
import loomPets from "./loom_pets.webp";
import loomRaces from "./loom_races.webp";
import loomStatus from "./loom_status.webp";
import orreryAchievements from "./orrery_achievements.webp";
import orreryCharacters from "./orrery_characters.webp";
import orreryCrafting from "./orrery_crafting.webp";
import orreryEnchanting from "./orrery_enchanting.webp";
import orreryFactions from "./orrery_factions.webp";
import orreryHousing from "./orrery_housing.webp";
import orreryInfrastructure from "./orrery_infrastructure.webp";
import orreryTuningWizard from "./orrery_tuning_wizard.webp";
import orreryWorld from "./orrery_world.webp";
import livingWorldCurrencies from "./living_world_currencies.webp";
import livingWorldEmotes from "./living_world_emotes.webp";
import livingWorldEvents from "./living_world_events.webp";
import livingWorldGuildHalls from "./living_world_guild_halls.webp";
import livingWorldGuilds from "./living_world_guilds.webp";
import livingWorldQuests from "./living_world_quests.webp";
import livingWorldSharedAssets from "./living_world_shared_assets.webp";
import livingWorldWeatherEnvironment from "./living_world_weather_environment.webp";
import arcanumDocuments from "./arcanum_documents.webp";
import arcanumMaps from "./arcanum_maps.webp";
import arcanumRelationships from "./arcanum_relationships.webp";
import arcanumStoryEditor from "./arcanum_story_editor.webp";
import arcanumTimeline from "./arcanum_timeline.webp";
import arcanumWorldSetting from "./arcanum_world_setting.webp";
import spireAdmin from "./spire_admin.webp";
import spireConsole from "./spire_console.webp";
import spireDeployment from "./spire_deployment.webp";
import spireServerConfig from "./spire_server_config.webp";
import spireStats from "./spire_stats.webp";

/** Room role key → icon URL. */
export const ROLE_ICONS: Record<string, string> = {
  bank: roleBank,
  tavern: roleTavern,
  dungeon: roleDungeon,
  auction: roleAuction,
  station: roleStation,
  stylist: roleStylist,
  housingBroker: roleHousingBroker,
  inn: roleInn,
  akathavaeShrine: roleAkathavaeShrine,
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
  // Forge
  art: forgeArt,
  artStyle: forgeArtStyle,
  media: forgeMedia,
  portraits: forgePortraits,
  studioAbilities: forgeIcons,
  sprites: forgePlayerSprites,
  playtest: forgePlaytest,
  // Loom
  classes: loomClasses,
  races: loomRaces,
  equipment: loomEquipment,
  abilityDesigner: loomAbilities,
  conditions: loomStatus,
  commands: loomCommands,
  pets: loomPets,
  // Orrery
  creation: orreryCharacters,
  world: orreryWorld,
  infrastructure: orreryInfrastructure,
  crafting: orreryCrafting,
  enchanting: orreryEnchanting,
  factions: orreryFactions,
  housing: orreryHousing,
  achievements: orreryAchievements,
  tuningWizard: orreryTuningWizard,
  // Living World
  currencies: livingWorldCurrencies,
  guilds: livingWorldGuilds,
  guildHalls: livingWorldGuildHalls,
  emotes: livingWorldEmotes,
  worldEvents: livingWorldEvents,
  weatherEnvironment: livingWorldWeatherEnvironment,
  quests: livingWorldQuests,
  sharedAssets: livingWorldSharedAssets,
  // Arcanum
  lore: islandArticles,
  worldSetting: arcanumWorldSetting,
  loreMaps: arcanumMaps,
  loreTimeline: arcanumTimeline,
  loreRelations: arcanumRelationships,
  loreDocuments: arcanumDocuments,
  storyEditor: arcanumStoryEditor,
  // Spire
  serverConfig: spireServerConfig,
  stats: spireStats,
  console: spireConsole,
  admin: spireAdmin,
  deployment: spireDeployment,
  // Settings / Operations panels — keep generic icons (no themed art yet)
  hubSettings: panelHub,
  showcaseSettings: panelShowcase,
  templates: panelTemplates,
  sceneTemplates: panelScenes,
  appearance: gsArt,
  services: panelKey,
  r2Settings: panelCloud,
  rawYaml: panelNotepad,
  versionControl: panelBranch,
};

/** Top-level sidebar entry → icon URL. */
export const ISLAND_ICONS: Record<string, string> = {
  orrery: islandOrrery,
  loom: islandLoom,
  forge: islandForge,
  livingWorld: islandLivingWorld,
  arcanum: islandArcanum,
  spire: islandSpire,
  articles: islandArticles,
  zones: islandZones,
};

/** Decorative arrow used by the sidebar for back / expand chevrons. */
export const UI_ARROW = uiArrow;

/** Fallback coin icon for currencies without a custom glyph. */
export const MISC_COIN = miscCoin;

/** Empty-state placeholder for asset browser when no image is generated. */
export const MISC_NO_IMAGE = miscNoImage;
