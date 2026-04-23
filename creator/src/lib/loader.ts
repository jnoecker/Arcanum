import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { exists } from "@tauri-apps/plugin-fs";
import { parseDocument } from "yaml";
import type { WorldFile } from "@/types/world";
import type { AppConfig } from "@/types/config";
import type { Project } from "@/types/project";
import { normalizeExitDirections } from "@/lib/zoneEdits";
import {
  DEFAULT_ACHIEVEMENT_CATEGORIES,
  DEFAULT_ACHIEVEMENT_CRITERION_TYPES,
  DEFAULT_QUEST_OBJECTIVE_TYPES,
  DEFAULT_QUEST_COMPLETION_TYPES,
  DEFAULT_STATUS_EFFECT_TYPES,
  DEFAULT_STACK_BEHAVIORS,
  DEFAULT_ABILITY_TARGET_TYPES,
  DEFAULT_STATUS_EFFECTS,
  DEFAULT_COMMANDS,
  DEFAULT_EMOTE_PRESETS,
  DEFAULT_WEATHER_TYPES,
  DEFAULT_ENVIRONMENT_CONFIG,
  DEFAULT_ENVIRONMENT_THEME,
} from "@/lib/configDefaults";

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
          normalizeExitDirections(data);
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
    mode: parseDeploymentMode(root.mode),
    server: parseServerConfig(root.server),
    admin: parseAdminConfig(root.admin),
    observability: parseObservabilityConfig(root.observability),
    logging: parseLoggingConfig(root.logging),
    world: parseWorldConfig(root.world),
    classStartRooms: parseClassStartRooms(engine.classStartRooms),
    stats: parseStatsConfig(engine.stats),
    abilities: parseMapSection(engine.abilities, "definitions"),
    statusEffects: withDefaults(parseMapSection(engine.statusEffects, "definitions"), DEFAULT_STATUS_EFFECTS),
    combat: parseCombatConfig(engine.combat),
    mobTiers: parseMobTiersConfig(engine.mob),
    mobActionDelay: parseMobActionDelayConfig(engine.mob),
    progression: parseProgressionConfig(progression),
    economy: parseSimpleSection(engine.economy, { buyMultiplier: 1.0, sellMultiplier: 0.5 }),
    regen: parseRegenConfig(engine.regen),
    crafting: parseCraftingConfig(engine.crafting),
    navigation: parseNavigationConfig(engine.navigation),
    commands: withDefaults(parseMapSection(engine.commands, "entries"), DEFAULT_COMMANDS),
    group: parseSimpleSection(engine.group, { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 0.1 }),
    classes: parseMapSection(engine.classes, "definitions"),
    races: parseMapSection(engine.races, "definitions"),
    equipmentSlots: normalizeEquipmentSlotKeys(parseMapSection(engine.equipment, "slots")),
    characterCreation: parseCharacterCreationConfig(engine.characterCreation),
    genders: parseMapSection(engine, "genders"),
    achievementCategories: withDefaults(parseNestedMapSection(engine, "achievementCategories", "categories"), DEFAULT_ACHIEVEMENT_CATEGORIES),
    achievementCriterionTypes: withDefaults(parseNestedMapSection(engine, "achievementCriterionTypes", "types"), DEFAULT_ACHIEVEMENT_CRITERION_TYPES),
    achievementDefs: parseAchievementDefs(engine.achievements ?? root.achievements),
    questObjectiveTypes: withDefaults(parseNestedMapSection(engine, "questObjectiveTypes", "types"), DEFAULT_QUEST_OBJECTIVE_TYPES),
    questCompletionTypes: withDefaults(parseNestedMapSection(engine, "questCompletionTypes", "types"), DEFAULT_QUEST_COMPLETION_TYPES),
    statusEffectTypes: withDefaults(parseMapSection(engine.effectTypes, "types"), DEFAULT_STATUS_EFFECT_TYPES),
    stackBehaviors: withDefaults(parseMapSection(engine.stackBehaviors, "behaviors"), DEFAULT_STACK_BEHAVIORS),
    abilityTargetTypes: withDefaults(parseMapSection(engine.targetTypes, "types"), DEFAULT_ABILITY_TARGET_TYPES),
    craftingSkills: parseMapSection(engine.craftingSkills, "skills"),
    craftingStationTypes: parseMapSection(engine.craftingStationTypes, "stationTypes"),
    housing: parseHousingConfig(engine.housing),
    enchanting: parseEnchantingConfig(engine.enchanting),
    skillPoints: parseSkillPointsConfig(engine.skillPoints),
    multiclass: parseMulticlassConfig(engine.multiclass),
    bank: parseBankConfig(engine.bank),
    worldTime: parseWorldTimeConfig(engine.worldTime),
    weather: (() => { const w = parseWeatherConfig(engine.weather); return { ...w, types: withDefaults(w.types, DEFAULT_WEATHER_TYPES) }; })(),
    environment: parseEnvironmentConfig(engine.environment),
    worldEvents: parseWorldEventsConfig(engine.worldEvents),
    pets: parsePetDefinitions(engine.pets),
    guild: parseGuildConfig(engine.guildRanks),
    guildRanks: parseMapSection(engine.guildRanks, "ranks"),
    friends: parseFriendsConfig(engine.friends),
    emotePresets: withEmotePresetDefaults(parseEmotePresetsConfig(engine.emotePresets)),
    images: parseImagesConfig(root.images),
    globalAssets: parseGlobalAssets((root.images as Record<string, unknown> | undefined)?.globalAssets ?? root.globalAssets),
    defaultAssets: parseGlobalAssets((root.images as Record<string, unknown> | undefined)?.defaultAssets ?? root.defaultAssets),
    lottery: parseLotteryConfig(engine.lottery),
    gambling: parseGamblingConfig(engine.gambling),
    stylist: parseStylistConfig(engine.stylist),
    respec: parseRespecConfig(engine.respec),
    prestige: engine.prestige as AppConfig["prestige"],
    dailyQuests: parseDailyQuestsConfig(engine.dailyQuests),
    autoQuests: parseAutoQuestsConfig(engine.autoQuests),
    globalQuests: parseGlobalQuestsConfig(engine.globalQuests),
    guildHalls: parseGuildHallsConfig(engine.guildHalls),
    factions: engine.factions as AppConfig["factions"],
    leaderboard: engine.leaderboard as AppConfig["leaderboard"],
    currencies: parseCurrenciesConfig(engine.currencies),
    persistence: parsePersistenceConfig(root.persistence),
    login: parseLoginConfig(root.login),
    transport: parseTransportConfig(root.transport),
    demo: parseDemoConfig(root.demo),
    database: parseDatabaseConfig(root.database),
    redis: parseRedisConfig(root.redis),
    grpc: parseGrpcConfig(root.grpc),
    gateway: parseGatewayConfig(root.gateway),
    sharding: parseShardingConfig(root.sharding),
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

function parseDeploymentMode(raw: unknown): AppConfig["mode"] {
  const val = typeof raw === "string" ? raw.toUpperCase() : "";
  if (val === "ENGINE" || val === "GATEWAY") return val;
  return "STANDALONE";
}

function parseServerConfig(raw: unknown): AppConfig["server"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    telnetPort: asNumber(s.telnetPort, 4000),
    webPort: asNumber(s.webPort, 8080),
    productionMode: asBool(s.productionMode, false),
    inboundChannelCapacity: asNumber(s.inboundChannelCapacity, 10000),
    outboundChannelCapacity: asNumber(s.outboundChannelCapacity, 10000),
    sessionOutboundQueueCapacity: asNumber(s.sessionOutboundQueueCapacity, 200),
    maxInboundEventsPerTick: asNumber(s.maxInboundEventsPerTick, 1000),
    tickMillis: asNumber(s.tickMillis, 100),
    inboundBudgetMs: asNumber(s.inboundBudgetMs, 30),
  };
}

function parsePersistenceConfig(raw: unknown): AppConfig["persistence"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const worker = (s.worker ?? {}) as Record<string, unknown>;
  return {
    backend: s.backend === "POSTGRES" ? "POSTGRES" : "YAML",
    rootDir: asString(s.rootDir, "data/players"),
    worker: {
      enabled: asBool(worker.enabled, true),
      flushIntervalMs: asNumber(worker.flushIntervalMs, 5000),
    },
  };
}

function parseLoginConfig(raw: unknown): AppConfig["login"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    maxWrongPasswordRetries: asNumber(s.maxWrongPasswordRetries, 3),
    maxFailedAttemptsBeforeDisconnect: asNumber(s.maxFailedAttemptsBeforeDisconnect, 3),
    maxConcurrentLogins: asNumber(s.maxConcurrentLogins, 50),
    authThreads: asNumber(s.authThreads, 8),
  };
}

function parseTransportConfig(raw: unknown): AppConfig["transport"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const telnet = (s.telnet ?? {}) as Record<string, unknown>;
  const ws = (s.websocket ?? {}) as Record<string, unknown>;
  return {
    telnet: {
      maxLineLen: asNumber(telnet.maxLineLen, 1024),
      maxNonPrintablePerLine: asNumber(telnet.maxNonPrintablePerLine, 32),
      socketBacklog: asNumber(telnet.socketBacklog, 256),
      maxConnections: asNumber(telnet.maxConnections, 5000),
    },
    websocket: {
      host: asString(ws.host, "0.0.0.0"),
      stopGraceMillis: asNumber(ws.stopGraceMillis, 1000),
      stopTimeoutMillis: asNumber(ws.stopTimeoutMillis, 2000),
    },
    maxInboundBackpressureFailures: asNumber(s.maxInboundBackpressureFailures, 3),
  };
}

function parseDemoConfig(raw: unknown): AppConfig["demo"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    autoLaunchBrowser: asBool(s.autoLaunchBrowser, false),
    webClientHost: asString(s.webClientHost, "localhost"),
    webClientUrl: typeof s.webClientUrl === "string" ? s.webClientUrl : null,
  };
}

function parseDatabaseConfig(raw: unknown): AppConfig["database"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    jdbcUrl: asString(s.jdbcUrl, "jdbc:postgresql://localhost:5432/ambonmud"),
    username: asString(s.username, "ambon"),
    password: asString(s.password, "ambon"),
    maxPoolSize: asNumber(s.maxPoolSize, 5),
    minimumIdle: asNumber(s.minimumIdle, 1),
  };
}

function parseRedisConfig(raw: unknown): AppConfig["redis"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const bus = (s.bus ?? {}) as Record<string, unknown>;
  return {
    enabled: asBool(s.enabled, false),
    uri: asString(s.uri, "redis://localhost:6379"),
    cacheTtlSeconds: asNumber(s.cacheTtlSeconds, 3600),
    bus: {
      enabled: asBool(bus.enabled, false),
      inboundChannel: asString(bus.inboundChannel, "ambon:inbound"),
      outboundChannel: asString(bus.outboundChannel, "ambon:outbound"),
      instanceId: asString(bus.instanceId, ""),
      sharedSecret: asString(bus.sharedSecret, ""),
    },
  };
}

function parseGrpcConfig(raw: unknown): AppConfig["grpc"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const server = (s.server ?? {}) as Record<string, unknown>;
  const client = (s.client ?? {}) as Record<string, unknown>;
  return {
    server: {
      port: asNumber(server.port, 9090),
      controlPlaneSendTimeoutMs: asNumber(server.controlPlaneSendTimeoutMs, 2000),
    },
    client: {
      engineHost: asString(client.engineHost, "localhost"),
      enginePort: asNumber(client.enginePort, 9090),
    },
    sharedSecret: asString(s.sharedSecret, ""),
    allowPlaintext: asBool(s.allowPlaintext, true),
    timestampToleranceMs: asNumber(s.timestampToleranceMs, 30000),
  };
}

function parseGatewayConfig(raw: unknown): AppConfig["gateway"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const snowflake = (s.snowflake ?? {}) as Record<string, unknown>;
  const reconnect = (s.reconnect ?? {}) as Record<string, unknown>;
  return {
    id: asNumber(s.id, 0),
    snowflake: {
      idLeaseTtlSeconds: asNumber(snowflake.idLeaseTtlSeconds, 300),
    },
    reconnect: {
      maxAttempts: asNumber(reconnect.maxAttempts, 10),
      initialDelayMs: asNumber(reconnect.initialDelayMs, 1000),
      maxDelayMs: asNumber(reconnect.maxDelayMs, 30000),
      jitterFactor: asNumber(reconnect.jitterFactor, 0.2),
      streamVerifyMs: asNumber(reconnect.streamVerifyMs, 2000),
    },
    engines: Array.isArray(s.engines) ? s.engines as AppConfig["gateway"]["engines"] : [],
    startZone: asString(s.startZone, ""),
  };
}

function parseShardingConfig(raw: unknown): AppConfig["sharding"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  const registry = (s.registry ?? {}) as Record<string, unknown>;
  const handoff = (s.handoff ?? {}) as Record<string, unknown>;
  const playerIndex = (s.playerIndex ?? {}) as Record<string, unknown>;
  const instancing = (s.instancing ?? {}) as Record<string, unknown>;
  const autoScale = (instancing.autoScale ?? {}) as Record<string, unknown>;
  return {
    enabled: asBool(s.enabled, false),
    engineId: asString(s.engineId, "engine-1"),
    zones: Array.isArray(s.zones) ? s.zones as string[] : [],
    registry: {
      type: asString(registry.type, "STATIC"),
      leaseTtlSeconds: asNumber(registry.leaseTtlSeconds, 30),
      assignments: Array.isArray(registry.assignments) ? registry.assignments as string[] : [],
    },
    handoff: {
      ackTimeoutMs: asNumber(handoff.ackTimeoutMs, 2000),
    },
    advertiseHost: asString(s.advertiseHost, "localhost"),
    advertisePort: typeof s.advertisePort === "number" ? s.advertisePort : null,
    playerIndex: {
      enabled: asBool(playerIndex.enabled, false),
      heartbeatMs: asNumber(playerIndex.heartbeatMs, 10000),
    },
    instancing: {
      enabled: asBool(instancing.enabled, false),
      defaultCapacity: asNumber(instancing.defaultCapacity, 200),
      loadReportIntervalMs: asNumber(instancing.loadReportIntervalMs, 5000),
      startZoneMinInstances: asNumber(instancing.startZoneMinInstances, 1),
      autoScale: {
        enabled: asBool(autoScale.enabled, false),
        evaluationIntervalMs: asNumber(autoScale.evaluationIntervalMs, 30000),
        scaleUpThreshold: asNumber(autoScale.scaleUpThreshold, 0.8),
        scaleDownThreshold: asNumber(autoScale.scaleDownThreshold, 0.2),
        cooldownMs: asNumber(autoScale.cooldownMs, 60000),
      },
    },
  };
}

function parseAdminConfig(raw: unknown): AppConfig["admin"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: s.enabled === true,
    port: asNumber(s.port, 9091),
    token: asString(s.token, ""),
    basePath: asString(s.basePath, "/"),
    grafanaUrl: asString(s.grafanaUrl, ""),
    corsOrigins: parseStringArray(s.corsOrigins, []),
  };
}

function parseObservabilityConfig(raw: unknown): AppConfig["observability"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    metricsEnabled: s.metricsEnabled === true,
    metricsEndpoint: asString(s.metricsEndpoint, "/metrics"),
    metricsHttpPort: asNumber(s.metricsHttpPort, 9099),
    metricsHttpHost: asString(s.metricsHttpHost, "0.0.0.0"),
    staticTags: parseStringMap(s.staticTags),
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

function parseDiminishingXp(raw: unknown): AppConfig["progression"]["xp"]["diminishing"] {
  if (raw == null) return undefined;
  const s = (raw ?? {}) as Record<string, unknown>;
  const rawThresholds = Array.isArray(s.thresholds) ? s.thresholds : [];
  const thresholds = rawThresholds
    .map((t) => {
      const row = (t ?? {}) as Record<string, unknown>;
      return {
        levelsBelow: asNumber(row.levelsBelow, 0),
        multiplier: asNumber(row.multiplier, 1.0),
      };
    })
    .filter((t) => Number.isFinite(t.levelsBelow) && Number.isFinite(t.multiplier));
  return {
    enabled: asBool(s.enabled, false),
    thresholds,
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
      diminishing: parseDiminishingXp(xp.diminishing),
    },
    rewards: {
      hpPerLevel: asNumber(rewards.hpPerLevel, 2),
      manaPerLevel: asNumber(rewards.manaPerLevel, 5),
      fullHealOnLevelUp: asBool(rewards.fullHealOnLevelUp, true),
      fullManaOnLevelUp: asBool(rewards.fullManaOnLevelUp, true),
      baseHp: asNumber(rewards.baseHp, 10),
      baseMana: asNumber(rewards.baseMana, 20),
    },
    quests: parseQuestXpConfig(s.quests),
  };
}

function parseQuestXpConfig(raw: unknown): AppConfig["progression"]["quests"] {
  if (raw == null) return undefined;
  const s = raw as Record<string, unknown>;
  const baseline = (s.baseline ?? {}) as Record<string, unknown>;
  const tiersRaw = (s.tiers ?? {}) as Record<string, unknown>;
  const tiers: Partial<Record<import("@/types/config").QuestDifficulty, number>> = {};
  for (const [key, value] of Object.entries(tiersRaw)) {
    const normalized = key.toLowerCase() as import("@/types/config").QuestDifficulty;
    if (["trivial", "easy", "standard", "hard", "epic"].includes(normalized) && typeof value === "number") {
      tiers[normalized] = value;
    }
  }
  return {
    baseline: {
      baseXp: asNumber(baseline.baseXp, 50),
      xpPerLevel: asNumber(baseline.xpPerLevel, 20),
    },
    tiers,
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
    specializationXpBonus: typeof s.specializationXpBonus === "number" ? s.specializationXpBonus : undefined,
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
  return {
    baseUrl: asString(s.baseUrl, "/images/"),
  };
}

function parseLotteryConfig(raw: unknown): AppConfig["lottery"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  return {
    enabled: asBool(s.enabled, true),
    ticketCost: asNumber(s.ticketCost, 100),
    drawingIntervalMs: asNumber(s.drawingIntervalMs, 3_600_000),
    jackpotSeedGold: asNumber(s.jackpotSeedGold, asNumber(s.jackpotBase, 500)),
    jackpotPercentFromTickets: asNumber(s.jackpotPercentFromTickets, 80),
    maxTicketsPerPlayer: asNumber(s.maxTicketsPerPlayer, 10),
    jackpotBase: typeof s.jackpotBase === "number" ? s.jackpotBase : undefined,
  };
}

function parseGamblingConfig(raw: unknown): AppConfig["gambling"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  return {
    enabled: asBool(s.enabled, true),
    diceMinBet: asNumber(s.diceMinBet, asNumber(s.minBet, 10)),
    diceMaxBet: asNumber(s.diceMaxBet, asNumber(s.maxBet, 10_000)),
    diceWinChance: asNumber(s.diceWinChance, asNumber(s.winChance, 0.45)),
    diceWinMultiplier: asNumber(s.diceWinMultiplier, asNumber(s.winMultiplier, 2.0)),
    cooldownMs: asNumber(s.cooldownMs, 5_000),
    minBet: typeof s.minBet === "number" ? s.minBet : undefined,
    maxBet: typeof s.maxBet === "number" ? s.maxBet : undefined,
    winChance: typeof s.winChance === "number" ? s.winChance : undefined,
    winMultiplier: typeof s.winMultiplier === "number" ? s.winMultiplier : undefined,
  };
}

function parseStylistConfig(raw: unknown): AppConfig["stylist"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  return {
    feeGold: asNumber(s.feeGold, 500),
  };
}

function parseRespecConfig(raw: unknown): AppConfig["respec"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  return {
    enabled: asBool(s.enabled, true),
    goldCost: asNumber(s.goldCost, 1000),
    cooldownMs: asNumber(s.cooldownMs, 3_600_000),
  };
}

function parseCurrenciesConfig(raw: unknown): AppConfig["currencies"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const definitions: NonNullable<AppConfig["currencies"]>["definitions"] = {};
  for (const [id, def] of Object.entries(asRecord<Record<string, unknown>>(s.definitions))) {
    definitions[id] = {
      displayName: asString(def.displayName, id),
      abbreviation: typeof def.abbreviation === "string" ? def.abbreviation : undefined,
      description: typeof def.description === "string" ? def.description : undefined,
      maxAmount: typeof def.maxAmount === "number" ? def.maxAmount : undefined,
    };
  }
  return {
    definitions,
    honorPerPvpKill: asNumber(s.honorPerPvpKill, 10),
    tokensPerCraft: asNumber(s.tokensPerCraft, 1),
  };
}

function parseDailyQuestDefinitions(raw: unknown): import("@/types/config").DailyQuestDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => entry != null && typeof entry === "object")
    .map((entry) => ({
      type: asString(entry.type, "kill"),
      targetCount: typeof entry.targetCount === "number" ? entry.targetCount : undefined,
      description: typeof entry.description === "string" ? entry.description : undefined,
      goldReward: typeof entry.goldReward === "number" ? entry.goldReward : undefined,
      xpReward: typeof entry.xpReward === "number" ? entry.xpReward : undefined,
    }));
}

function parseDailyQuestsConfig(raw: unknown): AppConfig["dailyQuests"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  let resetHourUtc: number | undefined;
  if (typeof s.resetHourUtc === "number") {
    resetHourUtc = s.resetHourUtc;
  } else if (typeof s.resetTimeUtc === "string") {
    const match = s.resetTimeUtc.match(/^(\d{1,2})/);
    if (match) resetHourUtc = Number.parseInt(match[1]!, 10);
  }
  return {
    enabled: asBool(s.enabled, false),
    resetHourUtc,
    dailySlots: asNumber(s.dailySlots, 3),
    weeklySlots: asNumber(s.weeklySlots, 1),
    streakBonusPercent: asNumber(s.streakBonusPercent, 10),
    streakMaxDays: asNumber(s.streakMaxDays, 7),
    dailyPool: parseDailyQuestDefinitions(s.dailyPool),
    weeklyPool: parseDailyQuestDefinitions(s.weeklyPool),
    resetTimeUtc: typeof s.resetTimeUtc === "string" ? s.resetTimeUtc : undefined,
    pools: typeof s.pools === "object" && s.pools != null ? (s.pools as Record<string, string[]>) : undefined,
  };
}

function parseAutoQuestsConfig(raw: unknown): AppConfig["autoQuests"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  return {
    enabled: asBool(s.enabled, true),
    timeLimitMs: asNumber(s.timeLimitMs, 600_000),
    cooldownMs: asNumber(s.cooldownMs, 60_000),
    rewardGoldBase: asNumber(s.rewardGoldBase, 50),
    rewardGoldPerLevel: asNumber(s.rewardGoldPerLevel, 10),
    rewardXpBase: asNumber(s.rewardXpBase, 100),
    rewardXpPerLevel: asNumber(s.rewardXpPerLevel, 25),
    killCountMin: asNumber(s.killCountMin, 3),
    killCountMax: asNumber(s.killCountMax, 8),
    rewardScaling: typeof s.rewardScaling === "number" ? s.rewardScaling : undefined,
  };
}

function parseGlobalQuestObjectives(raw: unknown): import("@/types/config").GlobalQuestObjectiveConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => entry != null && typeof entry === "object")
    .map((entry) => ({
      type: asString(entry.type, "kill"),
      targetCount: typeof entry.targetCount === "number" ? entry.targetCount : undefined,
      description: typeof entry.description === "string" ? entry.description : undefined,
    }));
}

function parseGlobalQuestsConfig(raw: unknown): AppConfig["globalQuests"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  return {
    enabled: asBool(s.enabled, true),
    intervalMs: asNumber(s.intervalMs, 7_200_000),
    durationMs: asNumber(s.durationMs, 1_800_000),
    announceIntervalMs: asNumber(s.announceIntervalMs, 300_000),
    minPlayersOnline: asNumber(s.minPlayersOnline, 2),
    rewardGoldFirst: asNumber(s.rewardGoldFirst, 2000),
    rewardGoldSecond: asNumber(s.rewardGoldSecond, 1000),
    rewardGoldThird: asNumber(s.rewardGoldThird, 500),
    rewardXpFirst: asNumber(s.rewardXpFirst, 5000),
    rewardXpSecond: asNumber(s.rewardXpSecond, 2500),
    rewardXpThird: asNumber(s.rewardXpThird, 1000),
    objectives: parseGlobalQuestObjectives(s.objectives),
    rewards: typeof s.rewards === "object" && s.rewards != null ? (s.rewards as Record<string, unknown>) : undefined,
  };
}

function parseGuildHallsConfig(raw: unknown): AppConfig["guildHalls"] {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const rawTemplates = asRecord<Record<string, unknown>>(s.templates ?? s.roomTemplates);
  const templates: NonNullable<AppConfig["guildHalls"]>["templates"] = {};
  for (const [id, template] of Object.entries(rawTemplates)) {
    templates[id] = {
      title: asString(template.title ?? template.displayName, id),
      displayName: typeof template.displayName === "string" ? template.displayName : undefined,
      description: asString(template.description, ""),
      cost: typeof template.cost === "number" ? template.cost : undefined,
      hasStorage: asBool(template.hasStorage, false),
    };
  }
  return {
    enabled: asBool(s.enabled, true),
    purchaseCost: asNumber(s.purchaseCost, asNumber(s.baseCost, 50_000)),
    roomCost: asNumber(s.roomCost, 10_000),
    maxRooms: asNumber(s.maxRooms, 10),
    templates,
    baseCost: typeof s.baseCost === "number" ? s.baseCost : undefined,
    roomTemplates: typeof s.roomTemplates === "object" && s.roomTemplates != null
      ? (s.roomTemplates as Record<string, import("@/types/config").GuildHallRoomTemplate>)
      : undefined,
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

function parseStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const parsed: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") parsed[k] = v;
  }
  return parsed;
}

/** Collect any top-level or engine keys we don't explicitly parse */
function collectRawSections(
  root: Record<string, unknown>,
  engine: Record<string, unknown>,
): Record<string, unknown> {
  const knownRoot = new Set([
    "mode", "server", "engine", "progression", "images", "globalAssets", "defaultAssets", "world",
    "persistence", "login", "transport", "demo", "observability", "admin",
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
    "scheduler", "friends", "debug", "classStartRooms", "emotePresets", "housing", "pets", "enchanting", "bank",
    "worldTime", "weather", "worldEvents", "environment", "skillPoints", "multiclass",
    "lottery", "gambling", "stylist", "respec", "prestige", "dailyQuests", "autoQuests", "globalQuests",
    "guildHalls", "factions", "leaderboard", "currencies",
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

function parseWorldTimeConfig(raw: unknown): import("@/types/config").WorldTimeConfig {
  if (!raw || typeof raw !== "object") return { cycleLengthMs: 3600000, dawnHour: 5, dayHour: 8, duskHour: 18, nightHour: 21 };
  const s = raw as Record<string, unknown>;
  return {
    cycleLengthMs: asNumber(s.cycleLengthMs, 3600000),
    dawnHour: asNumber(s.dawnHour, 5),
    dayHour: asNumber(s.dayHour, 8),
    duskHour: asNumber(s.duskHour, 18),
    nightHour: asNumber(s.nightHour, 21),
  };
}

function parseWeatherConfig(raw: unknown): import("@/types/config").WeatherConfig {
  if (!raw || typeof raw !== "object") return { minTransitionMs: 300000, maxTransitionMs: 900000, types: {} };
  const s = raw as Record<string, unknown>;
  return {
    minTransitionMs: asNumber(s.minTransitionMs, 300000),
    maxTransitionMs: asNumber(s.maxTransitionMs, 900000),
    types: parseWeatherTypes(s.types),
  };
}

function parseWeatherTypes(raw: unknown): Record<string, import("@/types/config").WeatherTypeDefinition> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, import("@/types/config").WeatherTypeDefinition> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const t = v as Record<string, unknown>;
    out[id] = {
      displayName: asString(t.displayName, id),
      description: typeof t.description === "string" ? t.description : undefined,
      weight: asNumber(t.weight, 1.0),
      particleHint: typeof t.particleHint === "string" ? t.particleHint : undefined,
      icon: typeof t.icon === "string" ? t.icon : undefined,
    };
  }
  return out;
}

function parseEnvironmentConfig(raw: unknown): import("@/types/config").EnvironmentConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_ENVIRONMENT_CONFIG;
  const s = raw as Record<string, unknown>;
  return {
    defaultTheme: parseEnvironmentTheme(s.defaultTheme) ?? DEFAULT_ENVIRONMENT_THEME,
    zones: parseEnvironmentZones(s.zones),
  };
}

function parseEnvironmentTheme(raw: unknown): import("@/types/config").EnvironmentTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  return {
    moteColors: parseMoteColors(s.moteColors),
    skyGradients: parseSkyGradients(s.skyGradients),
    transitionColors: parseStringArray(s.transitionColors, []),
    weatherParticleOverrides: asStringRecord(s.weatherParticleOverrides),
  };
}

function parseMoteColors(raw: unknown): import("@/types/config").MoteColor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      core: typeof v.core === "string" ? v.core : "#ffffff",
      glow: typeof v.glow === "string" ? v.glow : "#ffffff",
    }));
}

function parseSkyGradients(raw: unknown): Partial<Record<import("@/types/config").TimePeriod, import("@/types/config").SkyGradient>> {
  if (!raw || typeof raw !== "object") return {};
  const s = raw as Record<string, unknown>;
  const out: Partial<Record<import("@/types/config").TimePeriod, import("@/types/config").SkyGradient>> = {};
  for (const period of ["DAWN", "DAY", "DUSK", "NIGHT"] as const) {
    const v = s[period];
    if (v && typeof v === "object") {
      const g = v as Record<string, unknown>;
      out[period] = {
        top: typeof g.top === "string" ? g.top : "#000000",
        bottom: typeof g.bottom === "string" ? g.bottom : "#000000",
      };
    }
  }
  return out;
}

function asStringRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function parseEnvironmentZones(raw: unknown): Record<string, Partial<import("@/types/config").EnvironmentTheme>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Partial<import("@/types/config").EnvironmentTheme>> = {};
  for (const [zoneId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const s = v as Record<string, unknown>;
    const theme: Partial<import("@/types/config").EnvironmentTheme> = {};
    const mc = parseMoteColors(s.moteColors);
    if (mc.length > 0) theme.moteColors = mc;
    const sg = parseSkyGradients(s.skyGradients);
    if (Object.keys(sg).length > 0) theme.skyGradients = sg;
    const tc = parseStringArray(s.transitionColors, []);
    if (tc.length > 0) theme.transitionColors = tc;
    const wpo = asStringRecord(s.weatherParticleOverrides);
    if (Object.keys(wpo).length > 0) theme.weatherParticleOverrides = wpo;
    if (Object.keys(theme).length > 0) out[zoneId] = theme;
  }
  return out;
}

function parseWorldEventsConfig(raw: unknown): import("@/types/config").WorldEventsConfig {
  if (!raw || typeof raw !== "object") return { definitions: {} };
  const s = raw as Record<string, unknown>;
  const defs = (s.definitions ?? {}) as Record<string, unknown>;
  const parsed: Record<string, import("@/types/config").WorldEventDefinitionConfig> = {};
  for (const [id, v] of Object.entries(defs)) {
    if (!v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    parsed[id] = {
      displayName: asString(e.displayName, ""),
      description: typeof e.description === "string" ? e.description : undefined,
      startDate: typeof e.startDate === "string" ? e.startDate : undefined,
      endDate: typeof e.endDate === "string" ? e.endDate : undefined,
      flags: Array.isArray(e.flags) ? (e.flags as string[]) : undefined,
      startMessage: typeof e.startMessage === "string" ? e.startMessage : undefined,
      endMessage: typeof e.endMessage === "string" ? e.endMessage : undefined,
    };
  }
  return { definitions: parsed };
}

function parseSkillPointsConfig(raw: unknown): import("@/types/config").SkillPointsConfig {
  if (!raw || typeof raw !== "object") return { interval: 2 };
  const s = raw as Record<string, unknown>;
  return { interval: asNumber(s.interval, 2) };
}

function parseMulticlassConfig(raw: unknown): import("@/types/config").MulticlassConfig {
  if (!raw || typeof raw !== "object") return { minLevel: 10, goldCost: 500 };
  const s = raw as Record<string, unknown>;
  return {
    minLevel: asNumber(s.minLevel, 10),
    goldCost: asNumber(s.goldCost, 500),
  };
}

function parseBankConfig(raw: unknown): import("@/types/config").BankConfig {
  if (!raw || typeof raw !== "object") return { maxItems: 50 };
  const s = raw as Record<string, unknown>;
  return { maxItems: asNumber(s.maxItems, 50) };
}

function parseEnchantingConfig(raw: unknown): import("@/types/config").EnchantingConfig {
  if (!raw || typeof raw !== "object") return { maxEnchantmentsPerItem: 1, definitions: {} };
  const s = raw as Record<string, unknown>;
  const defs = (s.definitions ?? {}) as Record<string, unknown>;
  const parsed: Record<string, import("@/types/config").EnchantmentDefinitionConfig> = {};
  for (const [id, v] of Object.entries(defs)) {
    if (!v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    const materials = Array.isArray(e.materials)
      ? (e.materials as Record<string, unknown>[]).map((m) => ({
          itemId: asString(m.itemId, ""),
          quantity: asNumber(m.quantity, 1),
        }))
      : [];
    const statBonuses: Record<string, number> = {};
    if (e.statBonuses && typeof e.statBonuses === "object") {
      for (const [stat, val] of Object.entries(e.statBonuses as Record<string, unknown>)) {
        if (typeof val === "number") statBonuses[stat] = val;
      }
    }
    parsed[id] = {
      displayName: asString(e.displayName, ""),
      skill: asString(e.skill, "enchanting"),
      skillRequired: asNumber(e.skillRequired, 1),
      materials,
      statBonuses: Object.keys(statBonuses).length > 0 ? statBonuses : undefined,
      damageBonus: typeof e.damageBonus === "number" ? e.damageBonus : undefined,
      armorBonus: typeof e.armorBonus === "number" ? e.armorBonus : undefined,
      targetSlots: Array.isArray(e.targetSlots) ? (e.targetSlots as string[]) : undefined,
      xpReward: asNumber(e.xpReward, 30),
    };
  }
  return {
    maxEnchantmentsPerItem: asNumber(s.maxEnchantmentsPerItem, 1),
    definitions: parsed,
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
          normalizeExitDirections(data);
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
      mode: parseDeploymentMode(worldRaw.mode),
      server: parseServerConfig(worldRaw.server),
      admin: parseAdminConfig(worldRaw.admin),
      observability: parseObservabilityConfig(worldRaw.observability),
      logging: parseLoggingConfig(worldRaw.logging),
      world: parseWorldConfig(worldRaw.world),
      classStartRooms: parseClassStartRooms(worldRaw.classStartRooms),
      navigation: parseNavigationConfig(worldRaw.navigation),
      commands: withDefaults(asRecord(worldRaw.commands), DEFAULT_COMMANDS),
      group: parseSimpleSection(worldRaw.group, { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 0.1 }),
      housing: parseHousingConfig(worldRaw.housing),
      bank: parseBankConfig(worldRaw.bank),
      worldTime: parseWorldTimeConfig(worldRaw.worldTime),
      weather: (() => { const w = parseWeatherConfig(worldRaw.weather); return { ...w, types: withDefaults(w.types, DEFAULT_WEATHER_TYPES) }; })(),
      environment: parseEnvironmentConfig(worldRaw.environment),
      worldEvents: parseWorldEventsConfig(worldRaw.worldEvents),
      pets: parsePetDefinitions(petsRaw),
      guild: parseGuildConfig(worldRaw.guildRanks),
      guildRanks: parseMapSection(worldRaw.guildRanks, "ranks"),
      friends: parseFriendsConfig(worldRaw.friends),
      genders: asRecord(worldRaw.genders),
      characterCreation: parseCharacterCreationConfig(worldRaw.characterCreation),
      emotePresets: withEmotePresetDefaults(parseEmotePresetsConfig(worldRaw.emotePresets)),
      achievementCategories: withDefaults(asRecord((worldRaw.achievementCategories as Record<string, unknown> | undefined)?.categories ?? worldRaw.achievementCategories), DEFAULT_ACHIEVEMENT_CATEGORIES),
      achievementCriterionTypes: withDefaults(asRecord((worldRaw.achievementCriterionTypes as Record<string, unknown> | undefined)?.types ?? worldRaw.achievementCriterionTypes), DEFAULT_ACHIEVEMENT_CRITERION_TYPES),
      achievementDefs: parseAchievementDefs(achievementsRaw),
      questObjectiveTypes: withDefaults(asRecord((worldRaw.questObjectiveTypes as Record<string, unknown> | undefined)?.types ?? worldRaw.questObjectiveTypes), DEFAULT_QUEST_OBJECTIVE_TYPES),
      questCompletionTypes: withDefaults(asRecord((worldRaw.questCompletionTypes as Record<string, unknown> | undefined)?.types ?? worldRaw.questCompletionTypes), DEFAULT_QUEST_COMPLETION_TYPES),

      // stats.yaml
      stats: parseStatsConfig(statsRaw),

      // abilities.yaml
      abilities: asRecord(abilitiesRaw.definitions ?? abilitiesRaw),

      // status-effects.yaml
      statusEffects: withDefaults(
        asRecord(statusEffectsRaw.definitions ?? statusEffectsRaw),
        DEFAULT_STATUS_EFFECTS,
      ),
      statusEffectTypes: withDefaults(asRecord(statusEffectsRaw.effectTypes), DEFAULT_STATUS_EFFECT_TYPES),
      stackBehaviors: withDefaults(asRecord(statusEffectsRaw.stackBehaviors), DEFAULT_STACK_BEHAVIORS),
      abilityTargetTypes: withDefaults(asRecord(statusEffectsRaw.targetTypes), DEFAULT_ABILITY_TARGET_TYPES),

      // combat.yaml
      combat: parseCombatConfig(combatRaw.combat ?? combatRaw),
      mobTiers: parseMobTiersConfig(combatRaw.mob ?? combatRaw),
      mobActionDelay: parseMobActionDelayConfig(combatRaw.mob ?? combatRaw),

      // classes.yaml
      classes: asRecord(classesRaw.definitions ?? classesRaw),

      // races.yaml
      races: asRecord(racesRaw.definitions ?? racesRaw),

      // equipment.yaml
      equipmentSlots: normalizeEquipmentSlotKeys(asRecord(equipmentRaw.slots ?? equipmentRaw)),

      // crafting.yaml
      crafting: parseCraftingConfig(craftingRaw.crafting ?? craftingRaw),
      craftingSkills: asRecord(craftingRaw.skills),
      craftingStationTypes: asRecord(craftingRaw.stationTypes),
      enchanting: parseEnchantingConfig(craftingRaw.enchanting),
      skillPoints: parseSkillPointsConfig(combatRaw.skillPoints ?? worldRaw.skillPoints),
      multiclass: parseMulticlassConfig(combatRaw.multiclass ?? worldRaw.multiclass),

      // progression.yaml
      progression: parseProgressionConfig(progressionRaw.progression ?? progressionRaw),
      economy: parseSimpleSection(progressionRaw.economy, { buyMultiplier: 1.0, sellMultiplier: 0.5 }),
      regen: parseRegenConfig(progressionRaw.regen),

      // assets.yaml
      images: parseImagesConfig(assetsRaw.images ?? assetsRaw),
      globalAssets: parseGlobalAssets((assetsRaw.images as Record<string, unknown> | undefined)?.globalAssets ?? assetsRaw.globalAssets),
      defaultAssets: parseGlobalAssets((assetsRaw.images as Record<string, unknown> | undefined)?.defaultAssets ?? assetsRaw.defaultAssets),
      lottery: parseLotteryConfig(worldRaw.lottery),
      gambling: parseGamblingConfig(worldRaw.gambling),
      stylist: parseStylistConfig(worldRaw.stylist),
      respec: parseRespecConfig(worldRaw.respec),
      prestige: worldRaw.prestige as AppConfig["prestige"],
      dailyQuests: parseDailyQuestsConfig(worldRaw.dailyQuests),
      autoQuests: parseAutoQuestsConfig(worldRaw.autoQuests),
      globalQuests: parseGlobalQuestsConfig(worldRaw.globalQuests),
      guildHalls: parseGuildHallsConfig(worldRaw.guildHalls),
      factions: worldRaw.factions as AppConfig["factions"],
      leaderboard: worldRaw.leaderboard as AppConfig["leaderboard"],
      currencies: parseCurrenciesConfig(worldRaw.currencies),

      persistence: parsePersistenceConfig(worldRaw.persistence),
      login: parseLoginConfig(worldRaw.login),
      transport: parseTransportConfig(worldRaw.transport),
      demo: parseDemoConfig(worldRaw.demo),
      database: parseDatabaseConfig(worldRaw.database),
      redis: parseRedisConfig(worldRaw.redis),
      grpc: parseGrpcConfig(worldRaw.grpc),
      gateway: parseGatewayConfig(worldRaw.gateway),
      sharding: parseShardingConfig(worldRaw.sharding),

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

/**
 * Lowercase + trim equipment slot keys to match the MUD's validation rule
 * (matches the server's validateEngineEquipment). Auto-heals
 * legacy projects whose templates wrote uppercase keys like "HEAD". On
 * collision (e.g. both "HEAD" and "head"), the last entry wins.
 */
export function normalizeEquipmentSlotKeys<T>(slots: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, slot] of Object.entries(slots)) {
    const key = id.trim().toLowerCase();
    if (key) out[key] = slot;
  }
  return out;
}

// ─── Hoplite-compatible defaults ────────────────────────────────────
// The Kotlin server uses Hoplite for config loading, which merges YAML
// values with data class defaults. When YAML maps are empty ({}),
// Hoplite fills in the companion-object defaults. We replicate that
// behaviour here so Creator matches the running server. Default data
// lives in configDefaults.ts so exportMud.ts can share it.

function withDefaults<T>(parsed: Record<string, T>, defaults: Record<string, T>): Record<string, T> {
  return Object.keys(parsed).length > 0 ? parsed : defaults;
}

/** Return the MUD canonical emote preset set if the parsed list is empty. */
function withEmotePresetDefaults(parsed: AppConfig["emotePresets"]): AppConfig["emotePresets"] {
  return parsed.presets.length > 0 ? parsed : DEFAULT_EMOTE_PRESETS;
}
