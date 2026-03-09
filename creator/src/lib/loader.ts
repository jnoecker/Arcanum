import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { parseDocument } from "yaml";
import type { WorldFile } from "@/types/world";
import type { AppConfig } from "@/types/config";

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
 * Load and parse the application.yaml config file.
 * Extracts known sections into typed config and preserves unknown sections as raw YAML.
 */
export async function loadAppConfig(
  mudDir: string,
): Promise<AppConfig | null> {
  const configPath = `${mudDir}/src/main/resources/application.yaml`;

  try {
    const content = await readTextFile(configPath);
    const doc = parseDocument(content);
    const raw = doc.toJS() as Record<string, unknown>;

    // Navigate into the ambonmud root if present
    const root = (raw.ambonmud ?? raw) as Record<string, unknown>;
    const engine = (root.engine ?? {}) as Record<string, unknown>;
    const progression = (root.progression ?? {}) as Record<string, unknown>;

    const config: AppConfig = {
      server: parseServerConfig(root.server),
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
      achievementCategories: parseMapSection(engine, "achievementCategories"),
      achievementCriterionTypes: parseMapSection(engine, "achievementCriterionTypes"),
      questObjectiveTypes: parseMapSection(engine, "questObjectiveTypes"),
      questCompletionTypes: parseMapSection(engine, "questCompletionTypes"),
      statusEffectTypes: parseMapSection(engine.effectTypes, "types"),
      stackBehaviors: parseMapSection(engine.stackBehaviors, "behaviors"),
      abilityTargetTypes: parseMapSection(engine.targetTypes, "types"),
      craftingSkills: parseMapSection(engine.craftingSkills, "skills"),
      craftingStationTypes: parseMapSection(engine.craftingStationTypes, "stationTypes"),
      guild: parseGuildConfig(engine.guildRanks),
      guildRanks: parseMapSection(engine.guildRanks, "ranks"),
      friends: parseFriendsConfig(engine.friends),
      images: parseImagesConfig(root.images),
      globalAssets: parseGlobalAssets(root.globalAssets),
      rawSections: collectRawSections(root, engine),
    };

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

function parseWorldConfig(raw: unknown): AppConfig["world"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    startRoom: asString(s.startRoom, ""),
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
  };
}

function parseImagesConfig(raw: unknown): AppConfig["images"] {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    baseUrl: asString(s.baseUrl, "/images/"),
    spriteLevelTiers: parseNumberArray(s.spriteLevelTiers, [50, 40, 30, 20, 10, 1]),
    staffSpriteTier: asNumber(s.staffSpriteTier, 60),
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
    "server", "engine", "progression", "images", "globalAssets", "world", "persistence",
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
    "scheduler", "friends", "debug", "classStartRooms",
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
