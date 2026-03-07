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
      stats: parseStatsConfig(engine.stats),
      abilities: parseMapSection(engine.abilities, "definitions"),
      statusEffects: parseMapSection(engine.statusEffects, "definitions"),
      combat: parseCombatConfig(engine.combat),
      mobTiers: parseMobTiersConfig(engine.mob),
      progression: parseProgressionConfig(progression),
      economy: parseSimpleSection(engine.economy, { buyMultiplier: 1.0, sellMultiplier: 0.5 }),
      regen: parseRegenConfig(engine.regen),
      crafting: parseCraftingConfig(engine.crafting),
      group: parseSimpleSection(engine.group, { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 0.1 }),
      classes: parseMapSection(engine.classes, "definitions"),
      races: parseMapSection(engine.races, "definitions"),
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
  const parseTier = (t: unknown): AppConfig["mobTiers"]["weak"] => {
    const r = (t ?? {}) as Record<string, unknown>;
    return {
      baseHp: asNumber(r.baseHp, 10),
      hpPerLevel: asNumber(r.hpPerLevel, 3),
      baseMinDamage: asNumber(r.baseMinDamage, 1),
      baseMaxDamage: asNumber(r.baseMaxDamage, 4),
      damagePerLevel: asNumber(r.damagePerLevel, 1),
      baseArmor: asNumber(r.baseArmor, 0),
      baseXpReward: asNumber(r.baseXpReward, 30),
      xpRewardPerLevel: asNumber(r.xpRewardPerLevel, 10),
      baseGoldMin: asNumber(r.baseGoldMin, 0),
      baseGoldMax: asNumber(r.baseGoldMax, 0),
      goldPerLevel: asNumber(r.goldPerLevel, 0),
    };
  };
  return {
    weak: parseTier(tiers.weak),
    standard: parseTier(tiers.standard),
    elite: parseTier(tiers.elite),
    boss: parseTier(tiers.boss),
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
    maxSkillLevel: asNumber(s.maxSkillLevel, 100),
    baseXpPerLevel: asNumber(s.baseXpPerLevel, 50),
    xpExponent: asNumber(s.xpExponent, 1.5),
    gatherCooldownMs: asNumber(s.gatherCooldownMs, 3000),
    stationBonusQuantity: asNumber(s.stationBonusQuantity, 1),
  };
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
    "server", "engine", "progression", "world", "persistence",
    "login", "transport", "demo", "observability", "admin",
    "logging", "database", "redis", "grpc", "gateway", "sharding",
  ]);
  const knownEngine = new Set([
    "stats", "abilities", "statusEffects", "combat", "mob",
    "regen", "economy", "crafting", "group", "guild", "classes",
    "races", "scheduler", "friends", "debug", "classStartRooms",
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
