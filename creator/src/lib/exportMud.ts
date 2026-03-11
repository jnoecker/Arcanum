import { writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { normalizeAssetRef, normalizeConfigAssetRefs, normalizeGlobalAssetMap } from "@/lib/assetRefs";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore, type ZoneState } from "@/stores/zoneStore";
import { serializeZone } from "@/lib/saveZone";
import type { AppConfig } from "@/types/config";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

const DEFAULT_ACHIEVEMENT_CATEGORIES: AppConfig["achievementCategories"] = {
  combat: { displayName: "Combat" },
  exploration: { displayName: "Exploration" },
  social: { displayName: "Social" },
  crafting: { displayName: "Crafting" },
  class: { displayName: "Class" },
};

const DEFAULT_ACHIEVEMENT_CRITERION_TYPES: AppConfig["achievementCriterionTypes"] = {
  kill: { displayName: "Kill", progressFormat: "{current}/{required}" },
  reach_level: { displayName: "Reach Level", progressFormat: "level {current}/{required}" },
  quest_complete: { displayName: "Quest Complete", progressFormat: "{current}/{required}" },
};

const DEFAULT_QUEST_OBJECTIVE_TYPES: AppConfig["questObjectiveTypes"] = {
  kill: { displayName: "Kill" },
  collect: { displayName: "Collect" },
};

const DEFAULT_QUEST_COMPLETION_TYPES: AppConfig["questCompletionTypes"] = {
  auto: { displayName: "Automatic" },
  npc_turn_in: { displayName: "NPC Turn-In" },
};

const DEFAULT_STATUS_EFFECT_TYPES: AppConfig["statusEffectTypes"] = {
  dot: { displayName: "Damage Over Time", ticksDamage: true },
  hot: { displayName: "Heal Over Time", ticksHealing: true },
  stat_buff: { displayName: "Stat Buff", modifiesStats: true },
  stat_debuff: { displayName: "Stat Debuff", modifiesStats: true },
  stun: { displayName: "Stun" },
  root: { displayName: "Root" },
  shield: { displayName: "Shield", absorbsDamage: true },
};

const DEFAULT_STACK_BEHAVIORS: AppConfig["stackBehaviors"] = {
  refresh: { displayName: "Refresh" },
  stack: { displayName: "Stack" },
  none: { displayName: "None" },
};

const DEFAULT_ABILITY_TARGET_TYPES: AppConfig["abilityTargetTypes"] = {
  enemy: { displayName: "Enemy" },
  self: { displayName: "Self" },
  ally: { displayName: "Ally" },
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

export function buildMonolithicConfigObject(
  config?: AppConfig | null,
  zones?: Map<string, ZoneState>,
): Record<string, unknown> {
  const rawConfig = config ?? useConfigStore.getState().config;
  const c = rawConfig ? normalizeConfigAssetRefs(rawConfig) : rawConfig;
  if (!c) throw new Error("No config loaded");

  const loadedZones = zones ?? useZoneStore.getState().zones;
  const imageBaseUrl = normalizeBaseUrl(c.images.baseUrl, "/images/");
  const fallbackZone = findFallbackZone(c, loadedZones);
  const classStartRooms = normalizeClassStartRooms(c, loadedZones);

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
    slots: mapEntries(c.equipmentSlots, (s) => ({
      displayName: s.displayName,
      order: s.order,
    })),
  };
  engine.characterCreation = c.characterCreation;
  engine.genders = c.genders;
  engine.classStartRooms = classStartRooms;
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
      metricsEnabled: true,
      metricsEndpoint: "/metrics",
      metricsHttpPort: 9090,
      staticTags: {},
    },
    admin: {
      enabled: false,
      port: 9091,
      token: "",
      grafanaUrl: "",
    },
    logging: {
      level: "INFO",
      packageLevels: {
        "dev.ambon.transport": "INFO",
        "dev.ambon.engine": "INFO",
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
    },
    globalAssets: normalizeGlobalAssetMap(c.globalAssets),
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
export function buildMonolithicConfig(config?: AppConfig | null): string {
  return stringify({ ambonmud: buildMonolithicConfigObject(config) }, YAML_OPTS);
}

/**
 * Export the current project to MUD server format.
 * Writes application.yaml + world/*.yaml to the output directory.
 */
export async function exportMudFormat(outputDir: string): Promise<ExportResult> {
  const config = useConfigStore.getState().config;
  const zones = useZoneStore.getState().zones;

  if (!config) throw new Error("No config loaded");

  const resourcesDir = `${outputDir}/src/main/resources`;
  const worldDir = `${resourcesDir}/world`;

  // Create directory structure
  await mkdir(worldDir, { recursive: true });

  // Write monolithic config
  const configYaml = buildMonolithicConfig(config);
  await writeTextFile(`${resourcesDir}/application.yaml`, configYaml);

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

// ─── Serialization helpers (shared with saveSplitConfig) ────────────

export function mapEntries<T>(
  data: Record<string, T>,
  toPlain: (item: T) => Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [id, item] of Object.entries(data)) {
    result[id] = toPlain(item);
  }
  return result;
}

export function abilityToPlain(a: AppConfig["abilities"][string]): Record<string, unknown> {
  const effect: Record<string, unknown> = { type: a.effect.type };
  if (a.effect.value != null) effect.value = a.effect.value;
  if (a.effect.statusEffectId) effect.statusEffectId = a.effect.statusEffectId;
  if (a.effect.minDamage != null) effect.minDamage = a.effect.minDamage;
  if (a.effect.maxDamage != null) effect.maxDamage = a.effect.maxDamage;
  if (a.effect.minHeal != null) effect.minHeal = a.effect.minHeal;
  if (a.effect.maxHeal != null) effect.maxHeal = a.effect.maxHeal;
  if (a.effect.flatThreat != null) effect.flatThreat = a.effect.flatThreat;
  if (a.effect.margin != null) effect.margin = a.effect.margin;
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
  if (a.requiredClass != null) obj.requiredClass = a.requiredClass;
  if (a.classRestriction) obj.classRestriction = a.classRestriction;
  return obj;
}

export function statusEffectToPlain(e: AppConfig["statusEffects"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    displayName: e.displayName,
    effectType: normalizeStatusEffectTypeId(e.effectType),
    durationMs: e.durationMs,
  };
  if (e.image) obj.image = normalizeAssetRef(e.image);
  if (e.tickIntervalMs != null) obj.tickIntervalMs = e.tickIntervalMs;
  if (e.tickValue != null) obj.tickValue = e.tickValue;
  if (e.tickMinValue != null) obj.tickMinValue = e.tickMinValue;
  if (e.tickMaxValue != null) obj.tickMaxValue = e.tickMaxValue;
  if (e.shieldAmount != null) obj.shieldAmount = e.shieldAmount;
  if (e.stackBehavior) obj.stackBehavior = e.stackBehavior;
  if (e.maxStacks != null) obj.maxStacks = e.maxStacks;
  if (e.strMod != null) obj.strMod = e.strMod;
  if (e.dexMod != null) obj.dexMod = e.dexMod;
  if (e.conMod != null) obj.conMod = e.conMod;
  if (e.intMod != null) obj.intMod = e.intMod;
  if (e.wisMod != null) obj.wisMod = e.wisMod;
  if (e.chaMod != null) obj.chaMod = e.chaMod;
  if (e.statMods && Object.keys(e.statMods).length > 0) obj.statMods = e.statMods;
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
