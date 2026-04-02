import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { exists } from "@tauri-apps/plugin-fs";
import { parseDocument } from "yaml";
import type { WorldFile } from "@/types/world";
import type { AppConfig } from "@/types/config";
import type { Project } from "@/types/project";

/**
 * Load all zone YAML files from the world directory.
 */
export async function loadAllZones(
  mudDir: string,
): Promise<Record<string, { filePath: string; data: WorldFile }>> {
  const worldDir = `${mudDir}/src/main/resources/world`;
  const result: Record<string, { filePath: string; data: WorldFile }> = {};

  try {
    const entries = await readDir(worldDir);
    for (const entry of entries) {
      if (!entry.name?.endsWith(".yaml") && !entry.name?.endsWith(".yml")) {
        continue;
      }

      const filePath = `${worldDir}/${entry.name}`;
      try {
        const content = await readTextFile(filePath);
        const doc = parseDocument(content);
        const data = doc.toJS() as WorldFile;

        if (data.zone && data.rooms) {
          result[data.zone] = { filePath, data };
        }
      } catch (err) {
        console.error(`Failed to parse zone file ${filePath}:`, err);
      }
    }
  } catch (err) {
    console.error("Failed to read world directory:", err);
  }

  return result;
}

/**
 * Parse a monolithic application.yaml string into AppConfig.
 * Handles the ambonmud root + engine subtree structure.
 */
export function parseAppConfigYaml(content: string): AppConfig {
  const doc = parseDocument(content);
  const raw = doc.toJS() as Record<string, unknown>;

  // Navigate into the ambonmud root if present
  const root = (raw.ambonmud ?? raw) as Record<string, unknown>;
  const engine = (root.engine ?? {}) as Record<string, unknown>;
  const progression = (root.progression ?? {}) as Record<string, unknown>;

  return {
    server: parseServerConfig(root.server),
    admin: parseAdminConfig(root.admin),
    observability: parseObservabilityConfig(root.observability),
    logging: parseLoggingConfig(root.logging),
    world: parseWorldConfig(root.world),
    classStartRooms: parseClassStartRooms(engine.classStartRooms),
    stats: parseStatsConfig(engine.stats),
    abilities: parseMapSection(engine.abilities, "definitions"),
    statusEffects: parseMapSection(engine.statusEffects, "definitions"),
    combat: parseCombatConfig(engine.combat),
    mobTiers: parseMobTiersConfig(engine.mob),
    mobActionDelay: parseMobActionDelayConfig(engine.mob),
    progression: parseProgressionConfig(progression),
    economy: parseSimpleSection(engine.economy, { buyMultiplier: 1.0, sellMultiplier: 0.5 }),
    regen: parseRegenConfig(engine.regen),
    crafting: parseCraftingConfig(engine.crafting),
    navigation: parseNavigationConfig(engine.navigation),
    commands: parseMapSection(engine.commands, "entries"),
    group: parseSimpleSection(engine.group, { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 0.1 }),
    classes: parseMapSection(engine.classes, "definitions"),
    races: parseMapSection(engine.races, "definitions"),
    equipmentSlots: parseMapSection(engine.equipment, "slots"),
    characterCreation: parseCharacterCreationConfig(engine.characterCreation),
    genders: parseMapSection(engine, "genders"),
    achievementCategories: withDefaults(parseNestedMapSection(engine, "achievementCategories", "categories"), DEFAULT_ACHIEVEMENT_CATEGORIES),
    achievementCriterionTypes: withDefaults(parseNestedMapSection(engine, "achievementCriterionTypes", "types"), DEFAULT_CRITERION_TYPES),
    achievementDefs: parseAchievementDefs(engine.achievements ?? root.achievements),
    questObjectiveTypes: withDefaults(parseNestedMapSection(engine, "questObjectiveTypes", "types"), DEFAULT_QUEST_OBJECTIVE_TYPES),
    questCompletionTypes: withDefaults(parseNestedMapSection(engine, "questCompletionTypes", "types"), DEFAULT_QUEST_COMPLETION_TYPES),
    statusEffectTypes: parseMapSection(engine.effectTypes, "types"),
    stackBehaviors: parseMapSection(engine.stackBehaviors, "behaviors"),
    abilityTargetTypes: parseMapSection(engine.targetTypes, "types"),
    craftingSkills: parseMapSection(engine.craftingSkills, "skills"),
    craftingStationTypes: parseMapSection(engine.craftingStationTypes, "stationTypes"),
    housing: parseHousingConfig(engine.housing),
    pets: parsePetDefinitions(engine.pets),
    guild: parseGuildConfig(engine.guildRanks),
    guildRanks: parseMapSection(engine.guildRanks, "ranks"),
    friends: parseFriendsConfig(engine.friends),
    emotePresets: parseEmotePresetsConfig(engine.emotePresets),
    images: parseImagesConfig(root.images),
    globalAssets: parseGlobalAssets((root.images as Record<string, unknown> | undefined)?.globalAssets ?? root.globalAssets),
    playerTiers: parsePlayerTiers(root.playerTiers),
    rawSections: collectRawSections(root, engine),
  };
}

/**
 * Load and parse the application config.
 * Uses application-local.yaml (gitignored operator overrides) if it exists,
 * otherwise falls back to application.yaml (checked-in defaults).
 * Spring Boot uses first-source-wins at the map level, so the local file
 * replaces entire map sections — no per-entry merging.
 */
export async function loadAppConfig(
  mudDir: string,
): Promise<AppConfig | null> {
  const resourcesDir = `${mudDir}/src/main/resources`;
  const basePath = `${resourcesDir}/application.yaml`;
  const localPath = `${resourcesDir}/application-local.yaml`;

  try {
    // Local file takes precedence; fall back to base defaults
    const configPath = await exists(localPath) ? localPath : basePath;
    const content = await readTextFile(configPath);
    const config = parseAppConfigYaml(content);

    // Achievements live in a separate world file in legacy format
    const achievementsPath = `${resourcesDir}/world/achievements.yaml`;
    try {
      if (await exists(achievementsPath)) {
        const achContent = await readTextFile(achievementsPath);
        const achDoc = parseDocument(achContent);
        const achRaw = (achDoc.toJS() ?? {}) as Record<string, unknown>;
        config.achievementDefs = parseAchievementDefs(achRaw);
      }
    } catch {
      // achievements.yaml missing or unparseable — keep empty defaults
    }

    return config;
  } catch (err) {
    console.error("Failed to load application.yaml:", err);
    return null;
  }
}

// ─── Parsing helpers ────────────────────────────────────────────────

function parseServerConfig(raw: unknown): AppConfig["server"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    telnetPort: asNumber(s.telnetPort, 4000),
    webPort: asNumber(s.webPort, 8080),
  };
}

function parseAdminConfig(raw: unknown): AppConfig["admin"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: s.enabled === true,
    port: asNumber(s.port, 9091),
    token: asString(s.token, ""),
    basePath: asString(s.basePath, "/admin/"),
    grafanaUrl: asString(s.grafanaUrl, ""),
  };
}

function parseObservabilityConfig(raw: unknown): AppConfig["observability"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    metricsEnabled: s.metricsEnabled === true,
    metricsEndpoint: asString(s.metricsEndpoint, "/metrics"),
    metricsHttpPort: asNumber(s.metricsHttpPort, 9090),
  };
}

function parseLoggingConfig(raw: unknown): AppConfig["logging"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const packageLevels = (s.packageLevels ?? {}) as Record<string, unknown>;
  const parsed: Record<string, string> = {};
  for (const [k, v] of Object.entries(packageLevels)) {
    parsed[k] = String(v ?? "INFO");
  }
  return {
    level: asString(s.level, "INFO"),
    packageLevels: parsed,
  };
}

function parseWorldConfig(raw: unknown): AppConfig["world"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    startRoom: asString(s.startRoom, ""),
    resources: parseStringArray(s.resources, []),
  };
}

function parseClassStartRooms(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}

function parseStatsConfig(raw: unknown): AppConfig["stats"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const defs = (s.definitions ?? {}) as Record<string, Record<string, unknown>>;
  const bindings = (s.bindings ?? {}) as Record<string, unknown>;

  const definitions: AppConfig["stats"]["definitions"] = {};
  for (const [id, def] of Object.entries(defs)) {
    definitions[id] = {
      id,
      displayName: asString(def.displayName, id),
      abbreviation: asString(def.abbreviation, id),
      description: asString(def.description, ""),
      baseStat: asNumber(def.baseStat, 10),
    };
  }

  return {
    definitions,
    bindings: {
      meleeDamageStat: asString(bindings.meleeDamageStat, "STR"),
      meleeDamageDivisor: asNumber(bindings.meleeDamageDivisor, 3),
      dodgeStat: asString(bindings.dodgeStat, "DEX"),
      dodgePerPoint: asNumber(bindings.dodgePerPoint, 2),
      maxDodgePercent: asNumber(bindings.maxDodgePercent, 30),
      spellDamageStat: asString(bindings.spellDamageStat, "INT"),
      spellDamageDivisor: asNumber(bindings.spellDamageDivisor, 3),
      hpScalingStat: asString(bindings.hpScalingStat, "CON"),
      hpScalingDivisor: asNumber(bindings.hpScalingDivisor, 5),
      manaScalingStat: asString(bindings.manaScalingStat, "INT"),
      manaScalingDivisor: asNumber(bindings.manaScalingDivisor, 5),
      hpRegenStat: asString(bindings.hpRegenStat, "CON"),
      hpRegenMsPerPoint: asNumber(bindings.hpRegenMsPerPoint, 200),
      manaRegenStat: asString(bindings.manaRegenStat, "WIS"),
      manaRegenMsPerPoint: asNumber(bindings.manaRegenMsPerPoint, 200),
      xpBonusStat: asString(bindings.xpBonusStat, "CHA"),
      xpBonusPerPoint: asNumber(bindings.xpBonusPerPoint, 0.005),
    },
  };
}

function parseCombatConfig(raw: unknown): AppConfig["combat"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const feedback = (s.feedback ?? {}) as Record<string, unknown>;
  return {
    maxCombatsPerTick: asNumber(s.maxCombatsPerTick, 20),
    tickMillis: asNumber(s.tickMillis, 2000),
    minDamage: asNumber(s.minDamage, 1),
    maxDamage: asNumber(s.maxDamage, 4),
    feedback: {
      enabled: asBool(feedback.enabled, false),
      roomBroadcastEnabled: asBool(feedback.roomBroadcastEnabled, false),
    },
  };
}

function parseMobTiersConfig(raw: unknown): AppConfig["mobTiers"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const tiers = (s.tiers ?? {}) as Record<string, unknown>;
  const parseTier = (t: unknown, defaults: AppConfig["mobTiers"]["weak"]): AppConfig["mobTiers"]["weak"] => {
    const r = (t ?? {}) as Record<string, unknown>;
    return {
      baseHp: asNumber(r.baseHp, defaults.baseHp),
      hpPerLevel: asNumber(r.hpPerLevel, defaults.hpPerLevel),
      baseMinDamage: asNumber(r.baseMinDamage, defaults.baseMinDamage),
      baseMaxDamage: asNumber(r.baseMaxDamage, defaults.baseMaxDamage),
      damagePerLevel: asNumber(r.damagePerLevel, defaults.damagePerLevel),
      baseArmor: asNumber(r.baseArmor, defaults.baseArmor),
      baseXpReward: asNumber(r.baseXpReward, defaults.baseXpReward),
      xpRewardPerLevel: asNumber(r.xpRewardPerLevel, defaults.xpRewardPerLevel),
      baseGoldMin: asNumber(r.baseGoldMin, defaults.baseGoldMin),
      baseGoldMax: asNumber(r.baseGoldMax, defaults.baseGoldMax),
      goldPerLevel: asNumber(r.goldPerLevel, defaults.goldPerLevel),
    };
  };
  return {
    weak: parseTier(tiers.weak, { baseHp: 5, hpPerLevel: 2, baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0, baseArmor: 0, baseXpReward: 15, xpRewardPerLevel: 5, baseGoldMin: 1, baseGoldMax: 3, goldPerLevel: 1 }),
    standard: parseTier(tiers.standard, { baseHp: 10, hpPerLevel: 3, baseMinDamage: 1, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 0, baseXpReward: 30, xpRewardPerLevel: 10, baseGoldMin: 2, baseGoldMax: 8, goldPerLevel: 2 }),
    elite: parseTier(tiers.elite, { baseHp: 20, hpPerLevel: 5, baseMinDamage: 2, baseMaxDamage: 6, damagePerLevel: 1, baseArmor: 1, baseXpReward: 75, xpRewardPerLevel: 20, baseGoldMin: 10, baseGoldMax: 25, goldPerLevel: 5 }),
    boss: parseTier(tiers.boss, { baseHp: 50, hpPerLevel: 10, baseMinDamage: 3, baseMaxDamage: 8, damagePerLevel: 2, baseArmor: 3, baseXpReward: 200, xpRewardPerLevel: 50, baseGoldMin: 50, baseGoldMax: 100, goldPerLevel: 15 }),
  };
}

function parseMobActionDelayConfig(raw: unknown): AppConfig["mobActionDelay"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    minActionDelayMillis: asNumber(s.minActionDelayMillis, 8000),
    maxActionDelayMillis: asNumber(s.maxActionDelayMillis, 20000),
  };
}

function parseProgressionConfig(raw: unknown): AppConfig["progression"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const xp = (s.xp ?? {}) as Record<string, unknown>;
  const rewards = (s.rewards ?? {}) as Record<string, unknown>;
  return {
    maxLevel: asNumber(s.maxLevel, 50),
    xp: {
      baseXp: asNumber(xp.baseXp, 100),
      exponent: asNumber(xp.exponent, 2.0),
      linearXp: asNumber(xp.linearXp, 0),
      multiplier: asNumber(xp.multiplier, 1.0),
      defaultKillXp: asNumber(xp.defaultKillXp, 50),
    },
    rewards: {
      hpPerLevel: asNumber(rewards.hpPerLevel, 2),
      manaPerLevel: asNumber(rewards.manaPerLevel, 5),
      fullHealOnLevelUp: asBool(rewards.fullHealOnLevelUp, true),
      fullManaOnLevelUp: asBool(rewards.fullManaOnLevelUp, true),
      baseHp: asNumber(rewards.baseHp, 10),
      baseMana: asNumber(rewards.baseMana, 20),
    },
  };
}

function parseRegenConfig(raw: unknown): AppConfig["regen"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const mana = (s.mana ?? {}) as Record<string, unknown>;
  return {
    maxPlayersPerTick: asNumber(s.maxPlayersPerTick, 50),
    baseIntervalMillis: asNumber(s.baseIntervalMillis, 5000),
    minIntervalMillis: asNumber(s.minIntervalMillis, 1000),
    regenAmount: asNumber(s.regenAmount, 1),
    mana: {
      baseIntervalMillis: asNumber(mana.baseIntervalMillis, 3000),
      minIntervalMillis: asNumber(mana.minIntervalMillis, 1000),
      regenAmount: asNumber(mana.regenAmount, 1),
    },
  };
}

function parseCraftingConfig(raw: unknown): AppConfig["crafting"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    maxSkillLevel: asNumber(s.maxSkillLevel, 10),
    baseXpPerLevel: asNumber(s.baseXpPerLevel, 100),
    xpExponent: asNumber(s.xpExponent, 1.5),
    gatherCooldownMs: asNumber(s.gatherCooldownMs, 30000),
    stationBonusQuantity: asNumber(s.stationBonusQuantity, 1),
  };
}

function parseCharacterCreationConfig(raw: unknown): AppConfig["characterCreation"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    startingGold: asNumber(s.startingGold, 0),
    defaultRace: typeof s.defaultRace === "string" ? s.defaultRace : undefined,
    defaultClass: typeof s.defaultClass === "string" ? s.defaultClass : undefined,
    defaultGender: typeof s.defaultGender === "string" ? s.defaultGender : undefined,
  };
}

function parseEmotePresetsConfig(raw: unknown): AppConfig["emotePresets"] {
  if (!raw || typeof raw !== "object") return { presets: [] };
  const s = raw as Record<string, unknown>;
  const presets = Array.isArray(s.presets) ? s.presets : [];
  return {
    presets: presets
      .filter((p): p is Record<string, unknown> => p != null && typeof p === "object")
      .map((p) => ({
        label: asString(p.label, ""),
        emoji: asString(p.emoji, ""),
        action: asString(p.action, ""),
      })),
  };
}

function parseImagesConfig(raw: unknown): AppConfig["images"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const tiers = parseNumberArray(s.spriteLevelTiers, [50, 40, 30, 20, 10, 1]);
  return {
    baseUrl: asString(s.baseUrl, "/images/"),
    // Migrate legacy t0 base tier → t1 (MUD can't deserialize tier 0)
    spriteLevelTiers: tiers.map((t) => (t === 0 ? 1 : t)),
  };
}

function parseGlobalAssets(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}

function parsePlayerTiers(raw: unknown): Record<string, import("@/types/config").TierDefinitionConfig> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const result: Record<string, import("@/types/config").TierDefinitionConfig> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const tier = v as Record<string, unknown>;
      result[k] = {
        displayName: asString(tier.displayName, k),
        levels: asString(tier.levels, ""),
        visualDescription: asString(tier.visualDescription, ""),
      };
    }
  }
  // Migrate legacy t0 → t1 (MUD can't deserialize tier 0)
  if (result.t0 && !result.t1) {
    result.t1 = result.t0;
    delete result.t0;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseMapSection<T>(raw: unknown, key: string): Record<string, T> {
  if (!raw || typeof raw !== "object") return {};
  const section = (raw as Record<string, unknown>)[key];
  if (!section || typeof section !== "object") return {};
  return section as Record<string, T>;
}

function parseNestedMapSection<T>(
  raw: unknown,
  sectionKey: string,
  nestedKey: string,
): Record<string, T> {
  if (!raw || typeof raw !== "object") return {};
  const section = (raw as Record<string, unknown>)[sectionKey];
  if (!section || typeof section !== "object") return {};
  const nested = (section as Record<string, unknown>)[nestedKey];
  if (nested && typeof nested === "object") return nested as Record<string, T>;
  return section as Record<string, T>;
}

function parseAchievementDefs(raw: unknown): Record<string, import("@/types/config").AchievementDefFile> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const section = obj.achievements ?? raw;
  if (!section || typeof section !== "object") return {};
  return section as Record<string, import("@/types/config").AchievementDefFile>;
}

function parseSimpleSection<T>(raw: unknown, defaults: T): T {
  if (!raw || typeof raw !== "object") return defaults;
  return { ...defaults, ...(raw as Partial<T>) };
}

/** Collect any top-level or engine keys we don't explicitly parse */
function collectRawSections(
  root: Record<string, unknown>,
  engine: Record<string, unknown>,
): Record<string, unknown> {
  const knownRoot = new Set([
    "mode", "server", "engine", "progression", "images", "globalAssets", "playerTiers", "world", "persistence",
    "login", "transport", "demo", "observability", "admin",
    "logging", "database", "redis", "grpc", "gateway", "sharding",
    "videos", "audio",
  ]);
  const knownEngine = new Set([
    "stats", "abilities", "statusEffects", "combat", "mob",
    "regen", "economy", "crafting", "navigation", "commands",
    "group", "guild", "guildRanks", "classes",
    "races", "characterCreation", "equipment", "genders",
    "achievementCategories", "achievementCriterionTypes",
    "questObjectiveTypes", "questCompletionTypes",
    "effectTypes", "targetTypes", "stackBehaviors",
    "craftingSkills", "craftingStationTypes",
    "scheduler", "friends", "debug", "classStartRooms", "emotePresets", "housing", "pets",
  ]);

  const raw: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(root)) {
    if (!knownRoot.has(k)) {
      raw[`root.${k}`] = v;
    }
  }
  for (const [k, v] of Object.entries(engine)) {
    if (!knownEngine.has(k)) {
      raw[`engine.${k}`] = v;
    }
  }

  return raw;
}

function parseNavigationConfig(raw: unknown): AppConfig["navigation"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const recall = (s.recall ?? {}) as Record<string, unknown>;
  const msgs = (recall.messages ?? {}) as Record<string, unknown>;
  return {
    recall: {
      cooldownMs: asNumber(recall.cooldownMs, 300000),
      messages: {
        combatBlocked: asString(msgs.combatBlocked, "You are fighting for your life..."),
        cooldownRemaining: asString(msgs.cooldownRemaining, "You need to rest... ({seconds} seconds remaining)"),
        castBegin: asString(msgs.castBegin, "You close your eyes and whisper a prayer..."),
        unreachable: asString(msgs.unreachable, "Your recall point is unreachable."),
        departNotice: asString(msgs.departNotice, "vanishes in a flash of light."),
        arriveNotice: asString(msgs.arriveNotice, "appears in a flash of light."),
        arrival: asString(msgs.arrival, "You feel a familiar warmth..."),
      },
    },
  };
}

function parseGuildConfig(raw: unknown): AppConfig["guild"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    founderRank: asString(s.founderRank, "leader"),
    defaultRank: asString(s.defaultRank, "member"),
  };
}

function parseHousingConfig(raw: unknown): AppConfig["housing"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const templates: AppConfig["housing"]["templates"] = {};
  const rawTemplates = (s.templates ?? {}) as Record<string, Record<string, unknown>>;
  for (const [id, t] of Object.entries(rawTemplates)) {
    templates[id] = {
      title: asString(t.title, id),
      description: asString(t.description, ""),
      cost: asNumber(t.cost, 0),
      isEntry: t.isEntry === true ? true : undefined,
      image: typeof t.image === "string" ? t.image : undefined,
      maxDroppedItems: typeof t.maxDroppedItems === "number" ? t.maxDroppedItems : undefined,
      safe: t.safe === true ? true : undefined,
      station: typeof t.station === "string" ? t.station : undefined,
    };
  }
  return {
    enabled: asBool(s.enabled, false),
    entryExitDirection: asString(s.entryExitDirection, "SOUTH"),
    templates,
  };
}

function parsePetDefinitions(raw: unknown): Record<string, import("@/types/config").PetDefinitionConfig> {
  if (!raw || typeof raw !== "object") return {};
  const s = raw as Record<string, unknown>;
  const defs = (s.definitions ?? s) as Record<string, unknown>;
  if (!defs || typeof defs !== "object") return {};
  const result: Record<string, import("@/types/config").PetDefinitionConfig> = {};
  for (const [id, v] of Object.entries(defs)) {
    if (!v || typeof v !== "object") continue;
    const pet = v as Record<string, unknown>;
    result[id] = {
      name: asString(pet.name, "a pet"),
      description: typeof pet.description === "string" ? pet.description : undefined,
      hp: asNumber(pet.hp, 20),
      minDamage: asNumber(pet.minDamage, 1),
      maxDamage: asNumber(pet.maxDamage, 4),
      armor: asNumber(pet.armor, 0),
      image: typeof pet.image === "string" ? pet.image : undefined,
    };
  }
  return result;
}

function parseFriendsConfig(raw: unknown): AppConfig["friends"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    maxFriends: asNumber(s.maxFriends, 50),
  };
}

// ─── Type coercion helpers ──────────────────────────────────────────

function asNumber(val: unknown, fallback: number): number {
  return typeof val === "number" ? val : fallback;
}

function asString(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

function asBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

function parseNumberArray(val: unknown, fallback: number[]): number[] {
  if (!Array.isArray(val)) return fallback;
  return val.filter((v): v is number => typeof v === "number");
}

function parseStringArray(val: unknown, fallback: string[]): string[] {
  if (!Array.isArray(val)) return fallback;
  return val.filter((v): v is string => typeof v === "string");
}

// ─── Format-dispatching loaders ─────────────────────────────────────

/**
 * Load zones using the appropriate strategy for the project format.
 */
export async function loadProjectZones(
  project: Project,
): Promise<Record<string, { filePath: string; data: WorldFile }>> {
  return project.format === "standalone"
    ? loadStandaloneZones(project.mudDir)
    : loadAllZones(project.mudDir);
}

/**
 * Load config using the appropriate strategy for the project format.
 */
export async function loadProjectConfig(
  project: Project,
): Promise<AppConfig | null> {
  return project.format === "standalone"
    ? loadSplitConfig(project.mudDir)
    : loadAppConfig(project.mudDir);
}

// ─── Standalone zone loader ─────────────────────────────────────────

/**
 * Load zones from standalone directory structure: zones/<name>/zone.yaml
 */
async function loadStandaloneZones(
  projectDir: string,
): Promise<Record<string, { filePath: string; data: WorldFile }>> {
  const zonesDir = `${projectDir}/zones`;
  const result: Record<string, { filePath: string; data: WorldFile }> = {};

  try {
    const entries = await readDir(zonesDir);
    for (const entry of entries) {
      if (!entry.isDirectory || !entry.name) continue;

      const filePath = `${zonesDir}/${entry.name}/zone.yaml`;
      try {
        if (!(await exists(filePath))) continue;
        const content = await readTextFile(filePath);
        const doc = parseDocument(content);
        const data = doc.toJS() as WorldFile;

        if (data.zone && data.rooms) {
          result[data.zone] = { filePath, data };
        }
      } catch (err) {
        console.error(`Failed to parse zone ${entry.name}:`, err);
      }
    }
  } catch (err) {
    console.error("Failed to read zones directory:", err);
  }

  return result;
}

// ─── Split config loader ────────────────────────────────────────────

async function readYaml(path: string): Promise<Record<string, unknown>> {
  try {
    if (!(await exists(path))) return {};
    const content = await readTextFile(path);
    const doc = parseDocument(content);
    return (doc.toJS() ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Load config from 11 separate YAML files in config/ directory.
 */
async function loadSplitConfig(projectDir: string): Promise<AppConfig | null> {
  const dir = `${projectDir}/config`;

  try {
    const [
      classesRaw,
      racesRaw,
      abilitiesRaw,
      statusEffectsRaw,
      statsRaw,
      equipmentRaw,
      combatRaw,
      craftingRaw,
      progressionRaw,
      worldRaw,
      assetsRaw,
      petsRaw,
    ] = await Promise.all([
      readYaml(`${dir}/classes.yaml`),
      readYaml(`${dir}/races.yaml`),
      readYaml(`${dir}/abilities.yaml`),
      readYaml(`${dir}/status-effects.yaml`),
      readYaml(`${dir}/stats.yaml`),
      readYaml(`${dir}/equipment.yaml`),
      readYaml(`${dir}/combat.yaml`),
      readYaml(`${dir}/crafting.yaml`),
      readYaml(`${dir}/progression.yaml`),
      readYaml(`${dir}/world.yaml`),
      readYaml(`${dir}/assets.yaml`),
      readYaml(`${dir}/pets.yaml`),
    ]);

    // achievements.yaml lives at project root (not in config/)
    let achievementsRaw: Record<string, unknown> = {};
    try {
      const achPath = `${projectDir}/achievements.yaml`;
      if (await exists(achPath)) {
        achievementsRaw = await readYaml(achPath);
      }
    } catch { /* no achievements file yet */ }

    const config: AppConfig = {
      // world.yaml
      server: parseServerConfig(worldRaw.server),
      admin: parseAdminConfig(worldRaw.admin),
      observability: parseObservabilityConfig(worldRaw.observability),
      logging: parseLoggingConfig(worldRaw.logging),
      world: parseWorldConfig(worldRaw.world),
      classStartRooms: parseClassStartRooms(worldRaw.classStartRooms),
      navigation: parseNavigationConfig(worldRaw.navigation),
      commands: asRecord(worldRaw.commands),
      group: parseSimpleSection(worldRaw.group, { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 0.1 }),
      housing: parseHousingConfig(worldRaw.housing),
      pets: parsePetDefinitions(petsRaw),
      guild: parseGuildConfig(worldRaw.guildRanks),
      guildRanks: parseMapSection(worldRaw.guildRanks, "ranks"),
      friends: parseFriendsConfig(worldRaw.friends),
      genders: asRecord(worldRaw.genders),
      characterCreation: parseCharacterCreationConfig(worldRaw.characterCreation),
      emotePresets: parseEmotePresetsConfig(worldRaw.emotePresets),
      achievementCategories: withDefaults(asRecord((worldRaw.achievementCategories as Record<string, unknown> | undefined)?.categories ?? worldRaw.achievementCategories), DEFAULT_ACHIEVEMENT_CATEGORIES),
      achievementCriterionTypes: withDefaults(asRecord((worldRaw.achievementCriterionTypes as Record<string, unknown> | undefined)?.types ?? worldRaw.achievementCriterionTypes), DEFAULT_CRITERION_TYPES),
      achievementDefs: parseAchievementDefs(achievementsRaw),
      questObjectiveTypes: withDefaults(asRecord((worldRaw.questObjectiveTypes as Record<string, unknown> | undefined)?.types ?? worldRaw.questObjectiveTypes), DEFAULT_QUEST_OBJECTIVE_TYPES),
      questCompletionTypes: withDefaults(asRecord((worldRaw.questCompletionTypes as Record<string, unknown> | undefined)?.types ?? worldRaw.questCompletionTypes), DEFAULT_QUEST_COMPLETION_TYPES),

      // stats.yaml
      stats: parseStatsConfig(statsRaw),

      // abilities.yaml
      abilities: asRecord(abilitiesRaw.definitions ?? abilitiesRaw),

      // status-effects.yaml
      statusEffects: asRecord(statusEffectsRaw.definitions ?? statusEffectsRaw),
      statusEffectTypes: asRecord(statusEffectsRaw.effectTypes),
      stackBehaviors: asRecord(statusEffectsRaw.stackBehaviors),
      abilityTargetTypes: asRecord(statusEffectsRaw.targetTypes),

      // combat.yaml
      combat: parseCombatConfig(combatRaw.combat ?? combatRaw),
      mobTiers: parseMobTiersConfig(combatRaw.mob ?? combatRaw),
      mobActionDelay: parseMobActionDelayConfig(combatRaw.mob ?? combatRaw),

      // classes.yaml
      classes: asRecord(classesRaw.definitions ?? classesRaw),

      // races.yaml
      races: asRecord(racesRaw.definitions ?? racesRaw),

      // equipment.yaml
      equipmentSlots: asRecord(equipmentRaw.slots ?? equipmentRaw),

      // crafting.yaml
      crafting: parseCraftingConfig(craftingRaw.crafting ?? craftingRaw),
      craftingSkills: asRecord(craftingRaw.skills),
      craftingStationTypes: asRecord(craftingRaw.stationTypes),

      // progression.yaml
      progression: parseProgressionConfig(progressionRaw.progression ?? progressionRaw),
      economy: parseSimpleSection(progressionRaw.economy, { buyMultiplier: 1.0, sellMultiplier: 0.5 }),
      regen: parseRegenConfig(progressionRaw.regen),

      // assets.yaml
      images: parseImagesConfig(assetsRaw.images ?? assetsRaw),
      globalAssets: parseGlobalAssets((assetsRaw.images as Record<string, unknown> | undefined)?.globalAssets ?? assetsRaw.globalAssets),
      playerTiers: parsePlayerTiers(assetsRaw.playerTiers),

      rawSections: {},
    };

    return config;
  } catch (err) {
    console.error("Failed to load split config:", err);
    return null;
  }
}

function asRecord<T>(val: unknown): Record<string, T> {
  if (!val || typeof val !== "object") return {};
  return val as Record<string, T>;
}

// ─── Hoplite-compatible defaults ────────────────────────────────────
// The Kotlin server uses Hoplite for config loading, which merges YAML
// values with data class defaults. When YAML maps are empty ({}),
// Hoplite fills in the companion-object defaults. We replicate that
// behaviour here so Creator matches the running server.

function withDefaults<T>(parsed: Record<string, T>, defaults: Record<string, T>): Record<string, T> {
  return Object.keys(parsed).length > 0 ? parsed : defaults;
}

const DEFAULT_ACHIEVEMENT_CATEGORIES = {
  combat: { displayName: "Combat" },
  exploration: { displayName: "Exploration" },
  social: { displayName: "Social" },
  crafting: { displayName: "Crafting" },
  class: { displayName: "Class" },
};

const DEFAULT_CRITERION_TYPES = {
  kill: { displayName: "Kill", progressFormat: "{current}/{required}" },
  reach_level: { displayName: "Reach Level", progressFormat: "level {current}/{required}" },
  quest_complete: { displayName: "Quest Complete", progressFormat: "{current}/{required}" },
};

const DEFAULT_QUEST_OBJECTIVE_TYPES = {
  kill: { displayName: "Kill" },
  collect: { displayName: "Collect" },
};

const DEFAULT_QUEST_COMPLETION_TYPES = {
  auto: { displayName: "Automatic" },
  npc_turn_in: { displayName: "NPC Turn-In" },
};
