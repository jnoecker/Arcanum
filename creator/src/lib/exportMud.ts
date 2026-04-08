import { writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { stringify } from "yaml";
import { normalizeAssetRef, normalizeConfigAssetRefs, normalizeGlobalAssetMap } from "@/lib/assetRefs";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore, type ZoneState } from "@/stores/zoneStore";
import { serializeZone } from "@/lib/saveZone";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import type { AppConfig } from "@/types/config";
import {
  DEFAULT_ACHIEVEMENT_CATEGORIES,
  DEFAULT_ACHIEVEMENT_CRITERION_TYPES,
  DEFAULT_QUEST_OBJECTIVE_TYPES,
  DEFAULT_QUEST_COMPLETION_TYPES,
  DEFAULT_STATUS_EFFECT_TYPES,
  DEFAULT_STACK_BEHAVIORS,
  DEFAULT_ABILITY_TARGET_TYPES,
} from "@/lib/configDefaults";

export type SlotPositionMap = Record<string, { x: number; y: number }>;

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withFallbackMap<T>(
  value: Record<string, T>,
  fallback: Record<string, T>,
): Record<string, T> {
  return Object.keys(value).length > 0 ? value : cloneRecord(fallback);
}

function normalizeBaseUrl(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function siblingMediaBaseUrl(imagesBaseUrl: string, folder: "videos" | "audio"): string {
  const normalized = normalizeBaseUrl(imagesBaseUrl, "/images/");
  if (/^https?:\/\//i.test(normalized) && !/\/images\/?$/i.test(normalized)) {
    return normalized;
  }
  return normalized.replace(/\/images\/?$/i, `/${folder}/`);
}

function sanitizeAdminConfigForRuntime(admin: AppConfig["admin"] | undefined): AppConfig["admin"] {
  return {
    enabled: admin?.enabled ?? false,
    port: admin?.port ?? 9091,
    // The runtime token is injected by the mud deployment layer via env/SSM.
    // Arcanum should never persist it into project config.
    token: "",
    basePath: admin?.basePath ?? "/",
    grafanaUrl: admin?.grafanaUrl ?? "",
    corsOrigins: admin?.corsOrigins,
  };
}

function applyRawSections(target: Record<string, unknown>, rawSections: AppConfig["rawSections"]): void {
  for (const [key, value] of Object.entries(rawSections)) {
    if (key === "root.mode") {
      continue;
    }
    if (key.startsWith("root.")) {
      target[key.slice(5)] = value;
    } else if (key.startsWith("engine.")) {
      const engine = (target.engine ??= {}) as Record<string, unknown>;
      engine[key.slice(7)] = value;
    }
  }
}

function resolveRoomId(
  rawId: string,
  zones: Map<string, ZoneState>,
  fallbackZone?: string | null,
): string {
  const trimmed = rawId.trim();
  if (!trimmed || trimmed.includes(":")) return trimmed;

  const matches: string[] = [];
  for (const [zoneId, zone] of zones) {
    if (zone.data.rooms && Object.prototype.hasOwnProperty.call(zone.data.rooms, trimmed)) {
      matches.push(zoneId);
    }
  }

  if (matches.length === 1) return `${matches[0]}:${trimmed}`;
  if (fallbackZone && matches.includes(fallbackZone)) return `${fallbackZone}:${trimmed}`;
  if (matches.length > 1) return trimmed;
  if (fallbackZone) return `${fallbackZone}:${trimmed}`;
  return trimmed;
}

function findFallbackZone(config: AppConfig, zones: Map<string, ZoneState>): string | null {
  if (config.world.startRoom?.includes(":")) {
    return config.world.startRoom.split(":", 1)[0] ?? null;
  }

  for (const roomId of Object.values(config.classStartRooms)) {
    const resolved = resolveRoomId(roomId, zones, null);
    if (resolved.includes(":")) return resolved.split(":", 1)[0] ?? null;
  }

  return zones.size > 0 ? zones.keys().next().value ?? null : null;
}

function normalizeClassStartRooms(
  config: AppConfig,
  zones: Map<string, ZoneState>,
): Record<string, string> {
  const fallbackZone = findFallbackZone(config, zones);
  const result: Record<string, string> = {};
  for (const [classId, roomId] of Object.entries(config.classStartRooms)) {
    const resolved = resolveRoomId(roomId, zones, fallbackZone);
    if (resolved) result[classId] = resolved;
  }
  return result;
}

function normalizeStatusEffectTypeId(effectType: string): string {
  const normalized = effectType.trim().toLowerCase();
  if (!normalized) return normalized;

  switch (normalized) {
    case "buff":
      return "stat_buff";
    case "debuff":
      return "stat_debuff";
    default:
      return normalized;
  }
}

function normalizedStatusEffectTypes(config: AppConfig): AppConfig["statusEffectTypes"] {
  const merged = {
    ...cloneRecord(DEFAULT_STATUS_EFFECT_TYPES),
    ...config.statusEffectTypes,
  };

  for (const effect of Object.values(config.statusEffects)) {
    const normalized = normalizeStatusEffectTypeId(effect.effectType);
    if (normalized in merged) continue;

    if (normalized === "silence") {
      merged[normalized] = { displayName: "Silence" };
    } else if (normalized === "slow") {
      merged[normalized] = { displayName: "Slow" };
    } else {
      merged[normalized] = { displayName: effect.effectType.trim() || normalized };
    }
  }

  return merged;
}

export function normalizeLotteryConfig(config?: AppConfig["lottery"]): AppConfig["lottery"] | undefined {
  if (!config) return undefined;
  return {
    enabled: config.enabled,
    ticketCost: config.ticketCost,
    drawingIntervalMs: config.drawingIntervalMs,
    jackpotSeedGold: config.jackpotSeedGold ?? config.jackpotBase ?? 500,
    jackpotPercentFromTickets: config.jackpotPercentFromTickets ?? 80,
    maxTicketsPerPlayer: config.maxTicketsPerPlayer ?? 10,
  };
}

export function normalizeGamblingConfig(config?: AppConfig["gambling"]): AppConfig["gambling"] | undefined {
  if (!config) return undefined;
  return {
    enabled: config.enabled,
    diceMinBet: config.diceMinBet ?? config.minBet ?? 10,
    diceMaxBet: config.diceMaxBet ?? config.maxBet ?? 10_000,
    diceWinChance: config.diceWinChance ?? config.winChance ?? 0.45,
    diceWinMultiplier: config.diceWinMultiplier ?? config.winMultiplier ?? 2.0,
    cooldownMs: config.cooldownMs ?? 5_000,
  };
}

export function normalizeRespecConfig(config?: AppConfig["respec"]): AppConfig["respec"] | undefined {
  if (!config) return undefined;
  return {
    enabled: config.enabled ?? true,
    goldCost: config.goldCost,
    cooldownMs: config.cooldownMs,
  };
}

export function normalizeCurrenciesConfig(config?: AppConfig["currencies"]): AppConfig["currencies"] | undefined {
  if (!config) return undefined;
  return {
    definitions: mapEntries(config.definitions, (def) => ({
      displayName: def.displayName,
      abbreviation: def.abbreviation ?? "",
      description: def.description ?? "",
    })) as AppConfig["currencies"]["definitions"],
    honorPerPvpKill: config.honorPerPvpKill ?? 10,
    tokensPerCraft: config.tokensPerCraft ?? 1,
  };
}

export function normalizeDailyQuestsConfig(config?: AppConfig["dailyQuests"]): AppConfig["dailyQuests"] | undefined {
  if (!config) return undefined;
  return {
    enabled: config.enabled,
    resetHourUtc: config.resetHourUtc ?? 0,
    dailySlots: config.dailySlots ?? 3,
    weeklySlots: config.weeklySlots ?? 1,
    streakBonusPercent: config.streakBonusPercent,
    streakMaxDays: config.streakMaxDays ?? 7,
    dailyPool: config.dailyPool ?? [],
    weeklyPool: config.weeklyPool ?? [],
  };
}

export function normalizeAutoQuestsConfig(config?: AppConfig["autoQuests"]): AppConfig["autoQuests"] | undefined {
  if (!config) return undefined;
  return {
    enabled: config.enabled,
    timeLimitMs: config.timeLimitMs,
    cooldownMs: config.cooldownMs,
    rewardGoldBase: config.rewardGoldBase ?? 50,
    rewardGoldPerLevel: config.rewardGoldPerLevel ?? 10,
    rewardXpBase: config.rewardXpBase ?? 100,
    rewardXpPerLevel: config.rewardXpPerLevel ?? 25,
    killCountMin: config.killCountMin ?? 3,
    killCountMax: config.killCountMax ?? 8,
  };
}

export function normalizeGlobalQuestsConfig(config?: AppConfig["globalQuests"]): AppConfig["globalQuests"] | undefined {
  if (!config) return undefined;
  return {
    enabled: config.enabled,
    intervalMs: config.intervalMs,
    durationMs: config.durationMs,
    announceIntervalMs: config.announceIntervalMs ?? 300_000,
    minPlayersOnline: config.minPlayersOnline ?? 2,
    rewardGoldFirst: config.rewardGoldFirst ?? 2000,
    rewardGoldSecond: config.rewardGoldSecond ?? 1000,
    rewardGoldThird: config.rewardGoldThird ?? 500,
    rewardXpFirst: config.rewardXpFirst ?? 5000,
    rewardXpSecond: config.rewardXpSecond ?? 2500,
    rewardXpThird: config.rewardXpThird ?? 1000,
    objectives: config.objectives ?? [],
  };
}

export function normalizeGuildHallsConfig(config?: AppConfig["guildHalls"]): AppConfig["guildHalls"] | undefined {
  if (!config) return undefined;
  const sourceTemplates = config.templates ?? config.roomTemplates ?? {};
  const templates = mapEntries(sourceTemplates, (template) => ({
    title: template.title ?? template.displayName ?? "",
    description: template.description ?? "",
    hasStorage: template.hasStorage ?? false,
  })) as NonNullable<AppConfig["guildHalls"]>["templates"];
  return {
    enabled: config.enabled,
    purchaseCost: config.purchaseCost ?? config.baseCost ?? 50_000,
    roomCost: config.roomCost ?? 10_000,
    maxRooms: config.maxRooms ?? 10,
    templates,
  };
}

export function buildMonolithicConfigObject(
  config?: AppConfig | null,
  zones?: Map<string, ZoneState>,
  slotPositions?: SlotPositionMap,
): Record<string, unknown> {
  const rawConfig = config ?? useConfigStore.getState().config;
  const c = rawConfig ? normalizeConfigAssetRefs(rawConfig) : rawConfig;
  if (!c) throw new Error("No config loaded");

  const loadedZones = zones ?? useZoneStore.getState().zones;
  const imageBaseUrl = normalizeBaseUrl(c.images.baseUrl, "/images/");
  const fallbackZone = findFallbackZone(c, loadedZones);
  const classStartRooms = normalizeClassStartRooms(c, loadedZones);
  const adminConfig = sanitizeAdminConfigForRuntime(c.admin);

  const engine: Record<string, unknown> = {
    scheduler: { maxActionsPerTick: 100 },
    guild: { maxSize: 50, inviteTimeoutMs: 60000 },
    debug: { enableSwarmClass: false },
  };

  // Stats
  engine.stats = {
    definitions: mapEntries(c.stats.definitions, (def) => ({
      displayName: def.displayName,
      abbreviation: def.abbreviation,
      description: def.description,
      baseStat: def.baseStat,
    })),
    bindings: c.stats.bindings,
  };

  // Abilities
  engine.abilities = {
    definitions: mapEntries(c.abilities, abilityToPlain),
  };

  // Status Effects
  engine.statusEffects = {
    definitions: mapEntries(c.statusEffects, statusEffectToPlain),
  };

  engine.effectTypes = { types: normalizedStatusEffectTypes(c) };
  engine.stackBehaviors = { behaviors: withFallbackMap(c.stackBehaviors, DEFAULT_STACK_BEHAVIORS) };
  engine.targetTypes = { types: withFallbackMap(c.abilityTargetTypes, DEFAULT_ABILITY_TARGET_TYPES) };

  engine.combat = c.combat;
  engine.mob = {
    minActionDelayMillis: c.mobActionDelay.minActionDelayMillis,
    maxActionDelayMillis: c.mobActionDelay.maxActionDelayMillis,
    tiers: c.mobTiers,
  };
  engine.economy = c.economy;
  engine.regen = c.regen;
  engine.crafting = c.crafting;

  if (Object.keys(c.craftingSkills).length > 0) {
    engine.craftingSkills = { skills: c.craftingSkills };
  }
  if (Object.keys(c.craftingStationTypes).length > 0) {
    engine.craftingStationTypes = { stationTypes: c.craftingStationTypes };
  }

  engine.navigation = c.navigation;
  engine.commands = { entries: c.commands };
  engine.group = c.group;
  engine.guildRanks = {
    founderRank: c.guild.founderRank,
    defaultRank: c.guild.defaultRank,
    ranks: c.guildRanks,
  };
  engine.friends = c.friends;
  engine.classes = {
    definitions: mapEntries(c.classes, (cls) =>
      classToPlain({
        ...cls,
        startRoom: cls.startRoom ? resolveRoomId(cls.startRoom, loadedZones, fallbackZone) : cls.startRoom,
      })),
  };
  engine.races = {
    definitions: mapEntries(c.races, raceToPlain),
  };
  engine.equipment = {
    slots: mapEntries(c.equipmentSlots, (s, id) => {
      const pos = slotPositions?.[id];
      return {
        displayName: s.displayName,
        order: s.order,
        x: pos?.x ?? 50,
        y: pos?.y ?? 50,
      };
    }),
  };
  engine.characterCreation = c.characterCreation;
  engine.genders = c.genders;
  if (c.emotePresets?.presets?.length > 0) {
    engine.emotePresets = c.emotePresets;
  }

  // Bank
  if (c.bank.maxItems !== 50) {
    engine.bank = { maxItems: c.bank.maxItems };
  }

  // World Time
  engine.worldTime = c.worldTime;

  // Weather
  engine.weather = c.weather;

  // World Events
  if (Object.keys(c.worldEvents.definitions).length > 0) {
    engine.worldEvents = { definitions: c.worldEvents.definitions };
  }

  // Enchanting
  if (Object.keys(c.enchanting.definitions).length > 0 || c.enchanting.maxEnchantmentsPerItem !== 1) {
    engine.enchanting = {
      maxEnchantmentsPerItem: c.enchanting.maxEnchantmentsPerItem,
      definitions: mapEntries(c.enchanting.definitions, enchantmentToPlain),
    };
  }

  // Pets
  if (Object.keys(c.pets ?? {}).length > 0) {
    engine.pets = {
      definitions: mapEntries(c.pets, petToPlain),
    };
  }

  // Skill Points
  engine.skillPoints = { interval: c.skillPoints.interval };

  // Multiclass
  engine.multiclass = {
    minLevel: c.multiclass.minLevel,
    goldCost: c.multiclass.goldCost,
  };

  // Housing
  if (c.housing.enabled || Object.keys(c.housing.templates).length > 0) {
    engine.housing = housingToPlain(c.housing);
  }
  engine.classStartRooms = classStartRooms;

  // Optional engine subsystems — pass through as-is
  if (c.lottery) engine.lottery = normalizeLotteryConfig(c.lottery);
  if (c.gambling) engine.gambling = normalizeGamblingConfig(c.gambling);
  if (c.respec) engine.respec = normalizeRespecConfig(c.respec);
  if (c.prestige) engine.prestige = c.prestige;
  if (c.dailyQuests) engine.dailyQuests = normalizeDailyQuestsConfig(c.dailyQuests);
  if (c.autoQuests) engine.autoQuests = normalizeAutoQuestsConfig(c.autoQuests);
  if (c.globalQuests) engine.globalQuests = normalizeGlobalQuestsConfig(c.globalQuests);
  if (c.guildHalls) engine.guildHalls = normalizeGuildHallsConfig(c.guildHalls);
  if (c.factions) engine.factions = c.factions;
  if (c.leaderboard) engine.leaderboard = c.leaderboard;
  if (c.currencies) engine.currencies = normalizeCurrenciesConfig(c.currencies);

  engine.achievementCategories = { categories: withFallbackMap(c.achievementCategories, DEFAULT_ACHIEVEMENT_CATEGORIES) };
  engine.achievementCriterionTypes = { types: withFallbackMap(c.achievementCriterionTypes, DEFAULT_ACHIEVEMENT_CRITERION_TYPES) };
  engine.questObjectiveTypes = { types: withFallbackMap(c.questObjectiveTypes, DEFAULT_QUEST_OBJECTIVE_TYPES) };
  engine.questCompletionTypes = { types: withFallbackMap(c.questCompletionTypes, DEFAULT_QUEST_COMPLETION_TYPES) };

  const ambonmud: Record<string, unknown> = {
    mode: "STANDALONE",
    sharding: {
      enabled: false,
      engineId: "engine-1",
      zones: [],
      advertiseHost: "localhost",
      registry: { type: "STATIC", leaseTtlSeconds: 30, assignments: [] },
      handoff: { ackTimeoutMs: 2000 },
      playerIndex: { enabled: false, heartbeatMs: 10000 },
      instancing: {
        enabled: false,
        defaultCapacity: 200,
        loadReportIntervalMs: 5000,
        startZoneMinInstances: 1,
        autoScale: {
          enabled: false,
          evaluationIntervalMs: 30000,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.2,
          cooldownMs: 60000,
        },
      },
    },
    grpc: {
      server: { port: 9090 },
      client: { engineHost: "localhost", enginePort: 9090 },
    },
    gateway: {
      id: 0,
      snowflake: { idLeaseTtlSeconds: 300 },
      reconnect: {
        maxAttempts: 10,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        jitterFactor: 0.2,
        streamVerifyMs: 2000,
      },
      startZone: "",
      engines: [],
    },
    server: {
      telnetPort: c.server.telnetPort,
      webPort: c.server.webPort,
      productionMode: c.server.productionMode ?? false,
      inboundChannelCapacity: 10000,
      outboundChannelCapacity: 10000,
      sessionOutboundQueueCapacity: 200,
      maxInboundEventsPerTick: 1000,
      tickMillis: 100,
      inboundBudgetMs: 30,
    },
    world: {
      startRoom: c.world.startRoom,
      resources: c.world.resources,
    },
    persistence: {
      backend: "YAML",
      rootDir: "data/players",
      worker: {
        enabled: true,
        flushIntervalMs: 5000,
      },
    },
    database: {
      jdbcUrl: "jdbc:postgresql://localhost:5432/ambonmud",
      username: "ambon",
      password: "ambon",
      maxPoolSize: 5,
      minimumIdle: 1,
    },
    login: {
      maxWrongPasswordRetries: 3,
      maxFailedAttemptsBeforeDisconnect: 3,
      maxConcurrentLogins: 150,
      authThreads: 8,
    },
    engine,
    progression: c.progression,
    transport: {
      telnet: {
        maxLineLen: 1024,
        maxNonPrintablePerLine: 32,
        socketBacklog: 256,
      },
      websocket: {
        host: "0.0.0.0",
        stopGraceMillis: 1000,
        stopTimeoutMillis: 2000,
      },
      maxInboundBackpressureFailures: 3,
    },
    demo: {
      autoLaunchBrowser: false,
      webClientHost: "localhost",
      webClientUrl: null,
    },
    observability: {
      metricsEnabled: c.observability?.metricsEnabled ?? true,
      metricsEndpoint: c.observability?.metricsEndpoint ?? "/metrics",
      metricsHttpPort: c.observability?.metricsHttpPort ?? 9099,
      metricsHttpHost: c.observability?.metricsHttpHost ?? "0.0.0.0",
      staticTags: c.observability?.staticTags ?? {},
    },
    admin: {
      enabled: adminConfig.enabled,
      port: adminConfig.port,
      token: adminConfig.token,
      basePath: adminConfig.basePath || undefined,
      grafanaUrl: adminConfig.grafanaUrl || undefined,
      corsOrigins: adminConfig.corsOrigins,
    },
    logging: {
      level: c.logging?.level ?? "INFO",
      packageLevels: {
        ...{ "dev.ambon.transport": "INFO", "dev.ambon.engine": "INFO" },
        ...(c.logging?.packageLevels ?? {}),
      },
    },
    redis: {
      enabled: false,
      uri: "redis://localhost:6379",
      cacheTtlSeconds: 3600,
      bus: {
        enabled: false,
        inboundChannel: "ambon:inbound",
        outboundChannel: "ambon:outbound",
        instanceId: "",
        sharedSecret: "CHANGE_ME",
      },
    },
    images: {
      baseUrl: imageBaseUrl,
      spriteLevelTiers: c.images.spriteLevelTiers,
      globalAssets: normalizeGlobalAssetMap(c.globalAssets),
    },
    videos: {
      baseUrl: siblingMediaBaseUrl(imageBaseUrl, "videos"),
    },
    audio: {
      baseUrl: siblingMediaBaseUrl(imageBaseUrl, "audio"),
    },
  };

  applyRawSections(ambonmud, c.rawSections);
  return ambonmud;
}

/**
 * Build a monolithic application.yaml string from the in-memory AppConfig.
 * Wraps everything under the `ambonmud` root key with the `engine` sub-tree,
 * matching the structure that AmbonMUD server expects.
 */
export function buildMonolithicConfig(config?: AppConfig | null, slotPositions?: SlotPositionMap): string {
  return stringify({ ambonmud: buildMonolithicConfigObject(config, undefined, slotPositions) }, YAML_OPTS);
}

/**
 * Export the current project to MUD server format.
 * Writes application.yaml + world/*.yaml to the output directory.
 */
export async function exportMudFormat(outputDir: string): Promise<ExportResult> {
  const config = useConfigStore.getState().config;
  const zones = useZoneStore.getState().zones;
  const mudDir = useProjectStore.getState().project?.mudDir;

  if (!config) throw new Error("No config loaded");

  const slotPositions = await loadSlotPositions(mudDir);

  const resourcesDir = `${outputDir}/src/main/resources`;
  const worldDir = `${resourcesDir}/world`;

  // Create directory structure
  await mkdir(worldDir, { recursive: true });

  // Write monolithic config
  const configYaml = buildMonolithicConfig(config, slotPositions);
  await writeTextFile(`${resourcesDir}/application.yaml`, configYaml);

  // Write sprites manifest
  const spritesYaml = generateSpritesYaml();
  if (spritesYaml) {
    await writeTextFile(`${resourcesDir}/sprites.yaml`, spritesYaml);
  }

  // Write achievements
  if (config.achievementDefs && Object.keys(config.achievementDefs).length > 0) {
    await writeTextFile(
      `${worldDir}/achievements.yaml`,
      stringify({ achievements: config.achievementDefs }, YAML_OPTS),
    );
  }

  // Write zone files
  let zonesExported = 0;
  const errors: string[] = [];

  for (const [zoneId] of zones) {
    try {
      const yaml = serializeZone(zoneId);
      await writeTextFile(`${worldDir}/${zoneId}.yaml`, yaml);
      zonesExported++;
    } catch (err) {
      errors.push(`${zoneId}: ${err}`);
    }
  }

  return {
    configExported: true,
    zonesExported,
    outputDir,
    errors,
  };
}

export interface ExportResult {
  configExported: boolean;
  zonesExported: number;
  outputDir: string;
  errors: string[];
}

// ─── Sprites YAML generation ────────────────────────────────────────

export function generateSpritesYaml(): string {
  const definitions = useSpriteDefinitionStore.getState().definitions;
  if (Object.keys(definitions).length === 0) return "";

  const entries: Record<string, Record<string, unknown>> = {};
  for (const [id, def] of Object.entries(definitions)) {
    const entry: Record<string, unknown> = {
      displayName: def.displayName,
    };
    if (def.description) entry.description = def.description;
    entry.category = def.category;
    entry.sortOrder = def.sortOrder;
    // Always emit a non-empty requirements list. The MUD's SpriteLoader rejects
    // sprites with no unlock specification (it reads an empty `type` field and
    // throws "unknown unlock type ''"), so we use minLevel:0 — equivalent to
    // "no requirement", since player levels start at 1.
    entry.requirements = def.requirements.length > 0
      ? def.requirements.map((req) => {
          switch (req.type) {
            case "minLevel": return { type: "minLevel", level: req.level };
            case "race": return { type: "race", race: req.race };
            case "class": return { type: "class", playerClass: req.playerClass };
            case "achievement": return { type: "achievement", achievementId: req.achievementId };
            case "staff": return { type: "staff" };
          }
        })
      : [{ type: "minLevel", level: 0 }];
    if (def.variants && def.variants.length > 0) {
      entry.variants = def.variants;
    } else if (def.image) {
      entry.image = def.image;
    }
    entries[id] = entry;
  }

  return stringify({ sprites: entries }, YAML_OPTS);
}

// ─── Slot position loading ──────────────────────────────────────────

export async function loadSlotPositions(mudDir?: string): Promise<SlotPositionMap> {
  if (!mudDir) return {};
  try {
    const meta = await invoke<{ wearSlotPositions?: SlotPositionMap }>("load_arcanum_meta", { mudDir });
    // Lowercase keys to match the on-disk equipment slot keys (which the
    // loader normalizes to lowercase). Otherwise positions saved against
    // legacy uppercase IDs (e.g. "HEAD") would never match the lowercase
    // slot key during export, leaving every slot at the fallback position.
    const raw = meta.wearSlotPositions ?? {};
    const out: SlotPositionMap = {};
    for (const [id, pos] of Object.entries(raw)) {
      const key = id.trim().toLowerCase();
      if (key) out[key] = pos;
    }
    return out;
  } catch {
    return {};
  }
}

// ─── Serialization helpers (shared with saveSplitConfig) ────────────

export function mapEntries<T>(
  data: Record<string, T>,
  toPlain: (item: T, id: string) => Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [id, item] of Object.entries(data)) {
    result[id] = toPlain(item, id);
  }
  return result;
}

export function abilityToPlain(a: AppConfig["abilities"][string]): Record<string, unknown> {
  const effect: Record<string, unknown> = { type: a.effect.type };
  if (a.effect.value != null) effect.value = a.effect.value;
  if (a.effect.statusEffectId) effect.statusEffectId = a.effect.statusEffectId;
  if (a.effect.minDamage != null) effect.minDamage = a.effect.minDamage;
  if (a.effect.maxDamage != null) effect.maxDamage = a.effect.maxDamage;
  if (a.effect.damagePerLevel != null) effect.damagePerLevel = a.effect.damagePerLevel;
  if (a.effect.minHeal != null) effect.minHeal = a.effect.minHeal;
  if (a.effect.maxHeal != null) effect.maxHeal = a.effect.maxHeal;
  if (a.effect.healPerLevel != null) effect.healPerLevel = a.effect.healPerLevel;
  if (a.effect.flatThreat != null) effect.flatThreat = a.effect.flatThreat;
  if (a.effect.margin != null) effect.margin = a.effect.margin;
  if (a.effect.petTemplateKey) effect.petTemplateKey = a.effect.petTemplateKey;
  if (a.effect.durationMs != null) effect.durationMs = a.effect.durationMs;
  const obj: Record<string, unknown> = {
    displayName: a.displayName,
    manaCost: a.manaCost,
    cooldownMs: a.cooldownMs,
    levelRequired: a.levelRequired,
    targetType: a.targetType,
    effect,
  };
  if (a.description) obj.description = a.description;
  if (a.image) obj.image = normalizeAssetRef(a.image);
  const requiredClass = a.requiredClass?.trim() || a.classRestriction?.trim();
  if (requiredClass) obj.requiredClass = requiredClass;
  if (a.prerequisites && a.prerequisites.length > 0) obj.prerequisites = a.prerequisites;
  if (a.tree) obj.tree = a.tree;
  if (a.tier != null) obj.tier = a.tier;
  return obj;
}

export function statusEffectToPlain(e: AppConfig["statusEffects"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    displayName: e.displayName,
    effectType: normalizeStatusEffectTypeId(e.effectType),
    durationMs: e.durationMs,
  };
  if (e.tickIntervalMs != null) obj.tickIntervalMs = e.tickIntervalMs;
  const tickMinValue = e.tickMinValue ?? e.tickValue;
  const tickMaxValue = e.tickMaxValue ?? e.tickValue;
  if (tickMinValue != null) obj.tickMinValue = tickMinValue;
  if (tickMaxValue != null) obj.tickMaxValue = tickMaxValue;
  if (e.shieldAmount != null) obj.shieldAmount = e.shieldAmount;
  if (e.stackBehavior) obj.stackBehavior = e.stackBehavior;
  if (e.maxStacks != null) obj.maxStacks = e.maxStacks;
  if (e.strMod != null || e.statMods?.STR != null) obj.strMod = e.strMod ?? e.statMods?.STR;
  if (e.dexMod != null || e.statMods?.DEX != null) obj.dexMod = e.dexMod ?? e.statMods?.DEX;
  if (e.conMod != null || e.statMods?.CON != null) obj.conMod = e.conMod ?? e.statMods?.CON;
  if (e.intMod != null || e.statMods?.INT != null) obj.intMod = e.intMod ?? e.statMods?.INT;
  if (e.wisMod != null || e.statMods?.WIS != null) obj.wisMod = e.wisMod ?? e.statMods?.WIS;
  if (e.chaMod != null || e.statMods?.CHA != null) obj.chaMod = e.chaMod ?? e.statMods?.CHA;
  return obj;
}

export function classToPlain(cls: AppConfig["classes"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    displayName: cls.displayName,
    hpPerLevel: cls.hpPerLevel,
    manaPerLevel: cls.manaPerLevel,
  };
  if (cls.description) obj.description = cls.description;
  if (cls.backstory) obj.backstory = cls.backstory;
  if (cls.primaryStat) obj.primaryStat = cls.primaryStat;
  if (cls.selectable != null) obj.selectable = cls.selectable;
  if (cls.startRoom) obj.startRoom = cls.startRoom;
  if (cls.threatMultiplier != null) obj.threatMultiplier = cls.threatMultiplier;
  if (cls.image) obj.image = normalizeAssetRef(cls.image);
  if (cls.outfitDescription) obj.outfitDescription = cls.outfitDescription;
  if (cls.showcaseRace) obj.showcaseRace = cls.showcaseRace;
  return obj;
}

export function housingToPlain(h: AppConfig["housing"]): Record<string, unknown> {
  const templates: Record<string, unknown> = {};
  for (const [id, t] of Object.entries(h.templates)) {
    const obj: Record<string, unknown> = {
      title: t.title,
      description: t.description,
      cost: t.cost,
    };
    if (t.isEntry) obj.isEntry = true;
    if (t.image) obj.image = normalizeAssetRef(t.image);
    if (t.maxDroppedItems != null && t.maxDroppedItems > 0) obj.maxDroppedItems = t.maxDroppedItems;
    if (t.safe) obj.safe = true;
    if (t.station) obj.station = t.station;
    templates[id] = obj;
  }
  return {
    enabled: h.enabled,
    entryExitDirection: h.entryExitDirection,
    templates,
  };
}

export function raceToPlain(race: AppConfig["races"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = { displayName: race.displayName };
  if (race.description) obj.description = race.description;
  if (race.backstory) obj.backstory = race.backstory;
  if (race.traits && race.traits.length > 0) obj.traits = race.traits;
  if (race.abilities && race.abilities.length > 0) obj.abilities = race.abilities;
  if (race.image) obj.image = normalizeAssetRef(race.image);
  if (race.statMods && Object.keys(race.statMods).length > 0) obj.statMods = race.statMods;
  if (race.bodyDescription) obj.bodyDescription = race.bodyDescription;
  if (race.staffPrompt) obj.staffPrompt = race.staffPrompt;
  return obj;
}

export function petToPlain(pet: AppConfig["pets"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    name: pet.name,
    hp: pet.hp,
    minDamage: pet.minDamage,
    maxDamage: pet.maxDamage,
    armor: pet.armor,
  };
  if (pet.description) obj.description = pet.description;
  if (pet.image) obj.image = normalizeAssetRef(pet.image);
  return obj;
}

export function enchantmentToPlain(e: AppConfig["enchanting"]["definitions"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    displayName: e.displayName,
    skill: e.skill,
    skillRequired: e.skillRequired,
    materials: e.materials.map((m) => ({ itemId: m.itemId, quantity: m.quantity })),
    xpReward: e.xpReward,
  };
  if (e.statBonuses && Object.keys(e.statBonuses).length > 0) obj.statBonuses = e.statBonuses;
  if (e.damageBonus) obj.damageBonus = e.damageBonus;
  if (e.armorBonus) obj.armorBonus = e.armorBonus;
  if (e.targetSlots) obj.targetSlots = e.targetSlots;
  return obj;
}
