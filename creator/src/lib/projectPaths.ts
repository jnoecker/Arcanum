import type { Project } from "@/types/project";

/** Directory containing config files. */
export function configDir(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/config`
    : `${project.mudDir}/src/main/resources`;
}

/** Directory containing zones. */
export function zonesDir(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/zones`
    : `${project.mudDir}/src/main/resources/world`;
}

/** Path to a specific zone's YAML file. */
export function zoneFilePath(project: Project, zoneId: string): string {
  return project.format === "standalone"
    ? `${project.mudDir}/zones/${zoneId}/zone.yaml`
    : `${project.mudDir}/src/main/resources/world/${zoneId}.yaml`;
}

/** Path to the zone's assets directory (standalone only). */
export function zoneAssetsDir(project: Project, zoneId: string): string | null {
  return project.format === "standalone"
    ? `${project.mudDir}/zones/${zoneId}/assets`
    : null;
}

/**
 * Entity config files loaded by exact filename. Their top-level keys
 * (e.g. `definitions`) are file-scoped and collide across files, so they
 * are excluded from world-pool merging.
 */
export const ENTITY_CONFIG_FILES = [
  "classes",
  "races",
  "abilities",
  "status-effects",
  "stats",
  "equipment",
  "combat",
  "crafting",
  "progression",
  "assets",
  "pets",
] as const;

/**
 * Canonical homes for world-pool sections. Every other `.yaml` in config/
 * (including user-dropped files) is merged into the same pool by top-level
 * key, so a shared `commands.yaml` works as a drop-in.
 */
export const WORLD_POOL_FILES = [
  "server",
  "commands",
  "social",
  "economy",
  "quests",
  "world",
] as const;

export type WorldPoolFileName = (typeof WORLD_POOL_FILES)[number];

/** Names of the split config files used by standalone projects. */
export const CONFIG_FILES = [...ENTITY_CONFIG_FILES, ...WORLD_POOL_FILES] as const;

export type ConfigFileName = (typeof CONFIG_FILES)[number];

/**
 * Canonical file for each world-pool section. The saver groups sections
 * into files by this map; the loader gives the canonical file precedence
 * when a section appears in more than one pool file.
 */
export const WORLD_SECTION_HOMES = {
  // server.yaml — infra and ops, rarely touched by worldbuilders
  mode: "server",
  server: "server",
  admin: "server",
  observability: "server",
  logging: "server",
  persistence: "server",
  login: "server",
  transport: "server",
  demo: "server",
  database: "server",
  redis: "server",
  grpc: "server",
  gateway: "server",
  sharding: "server",

  // commands.yaml
  commands: "commands",

  // social.yaml
  group: "social",
  guildRanks: "social",
  friends: "social",
  genders: "social",
  characterCreation: "social",
  emotePresets: "social",

  // economy.yaml
  bank: "economy",
  currencies: "economy",
  lottery: "economy",
  gambling: "economy",
  stylist: "economy",
  respec: "economy",
  housing: "economy",
  guildHalls: "economy",

  // quests.yaml
  dailyQuests: "quests",
  autoQuests: "quests",
  globalQuests: "quests",
  questObjectiveTypes: "quests",
  questCompletionTypes: "quests",
  achievementCategories: "quests",
  achievementCriterionTypes: "quests",

  // world.yaml
  world: "world",
  classStartRooms: "world",
  navigation: "world",
  death: "world",
  worldTime: "world",
  season: "world",
  weather: "world",
  mobVariants: "world",
  environment: "world",
  worldEvents: "world",
  factions: "world",
  prestige: "world",
  leaderboard: "world",
  akathavae: "world",
  flight: "world",
  boat: "world",
} as const satisfies Record<string, WorldPoolFileName>;

export type WorldSectionKey = keyof typeof WORLD_SECTION_HOMES;
