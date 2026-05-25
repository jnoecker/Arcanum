import { describe, it, expect } from "vitest";
import { validateConfig } from "../validateConfig";
import type { AppConfig } from "@/types/config";

/** Minimal valid config for tests to spread over */
const BASE_CONFIG: AppConfig = {
  mode: "STANDALONE",
  server: { telnetPort: 4000, webPort: 8080, inboundChannelCapacity: 10000, outboundChannelCapacity: 10000, sessionOutboundQueueCapacity: 200, maxInboundEventsPerTick: 1000, tickMillis: 100, inboundBudgetMs: 30 },
  admin: { enabled: false, port: 9091, token: "", basePath: "/", grafanaUrl: "", corsOrigins: [] },
  observability: { metricsEnabled: true, metricsEndpoint: "/metrics", metricsHttpPort: 9099, metricsHttpHost: "0.0.0.0", staticTags: {} },
  logging: { level: "INFO", packageLevels: {} },
  world: { startRoom: "" },
  navigation: {
    recall: {
      cooldownMs: 300000,
      messages: {
        combatBlocked: "",
        cooldownRemaining: "",
        castBegin: "",
        unreachable: "",
        departNotice: "",
        arriveNotice: "",
        arrival: "",
      },
    },
  },
  death: {
    sanctumRoom: "",
    respawnHpFraction: 0.2,
    respawnManaFraction: 0.2,
    xpPenaltyFraction: 0,
    messages: {
      arriveSanctum: "",
      departNoSanctum: "",
      departNoDeath: "",
      departBegin: "",
      departUnreachable: "",
    },
  },
  commands: {},
  classStartRooms: {},
  stats: {
    definitions: {
      STR: { id: "STR", displayName: "Strength", abbreviation: "STR", description: "", baseStat: 10 },
      DEX: { id: "DEX", displayName: "Dexterity", abbreviation: "DEX", description: "", baseStat: 10 },
      INT: { id: "INT", displayName: "Intelligence", abbreviation: "INT", description: "", baseStat: 10 },
      CON: { id: "CON", displayName: "Constitution", abbreviation: "CON", description: "", baseStat: 10 },
      WIS: { id: "WIS", displayName: "Wisdom", abbreviation: "WIS", description: "", baseStat: 10 },
      CHA: { id: "CHA", displayName: "Charisma", abbreviation: "CHA", description: "", baseStat: 10 },
    },
    bindings: {
      meleeDamageStat: "STR",
      meleeStatMultiplier: 0.25,
      meleeLevelScalingRate: 1.30,
      meleeVarianceMin: 0.85,
      meleeVarianceMax: 1.15,
      meleeBaseAttackPower: 1,
      meleeArmorMitigationK: 20,
      dodgeStat: "DEX",
      dodgePerPoint: 2,
      maxDodgePercent: 30,
      spellDamageStat: "INT",
      spellStatMultiplier: 0.25,
      spellLevelScalingRate: 1.30,
      spellVarianceMin: 0.85,
      spellVarianceMax: 1.15,
      healStat: "WIS",
      healStatMultiplier: 0.25,
      healLevelScalingRate: 1.30,
      healVarianceMin: 0.85,
      healVarianceMax: 1.15,
      buffStat: "CHA",
      buffDurationPerStat: 0.02,
      buffMagnitudePerStat: 0.02,
      hpScalingStat: "CON",
      hpScalingDivisor: 5,
      manaScalingStat: "INT",
      manaScalingDivisor: 5,
      hpRegenStat: "CON",
      hpRegenMsPerPoint: 200,
      manaRegenStat: "WIS",
      manaRegenMsPerPoint: 200,
      xpBonusStat: "CHA",
      xpBonusPerPoint: 0.005,
    },
  },
  abilities: {},
  statusEffects: {},
  combat: {
    maxCombatsPerTick: 20,
    tickMillis: 2000,
    feedback: { enabled: false, roomBroadcastEnabled: false },
  },
  mobTiers: {
    weak: { baseHp: 10, hpScalingRate: 1.1, baseMinDamage: 1, baseMaxDamage: 4, damageScalingRate: 1.1, baseArmor: 0, baseXpReward: 30, xpScalingRate: 1.15, baseGoldMin: 0, baseGoldMax: 0, goldScalingRate: 1.0 },
    standard: { baseHp: 20, hpScalingRate: 1.1, baseMinDamage: 2, baseMaxDamage: 6, damageScalingRate: 1.1, baseArmor: 0, baseXpReward: 50, xpScalingRate: 1.15, baseGoldMin: 0, baseGoldMax: 0, goldScalingRate: 1.0 },
    elite: { baseHp: 40, hpScalingRate: 1.1, baseMinDamage: 4, baseMaxDamage: 10, damageScalingRate: 1.1, baseArmor: 2, baseXpReward: 100, xpScalingRate: 1.15, baseGoldMin: 0, baseGoldMax: 0, goldScalingRate: 1.0 },
    boss: { baseHp: 100, hpScalingRate: 1.1, baseMinDamage: 8, baseMaxDamage: 20, damageScalingRate: 1.1, baseArmor: 5, baseXpReward: 300, xpScalingRate: 1.15, baseGoldMin: 0, baseGoldMax: 0, goldScalingRate: 1.0 },
  },
  progression: {
    maxLevel: 50,
    xp: { baseXp: 100, exponent: 2, linearXp: 0, multiplier: 1, defaultKillXp: 50 },
    rewards: { hpScalingRate: 1.1, manaScalingRate: 1.05, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 20 },
  },
  economy: { buyMultiplier: 1.0, sellMultiplier: 0.5 },
  regen: {
    maxPlayersPerTick: 50,
    baseIntervalMillis: 5000,
    minIntervalMillis: 1000,
    regenPercent: 0.05,
    inCombatMultiplier: 0.5,
    mana: { baseIntervalMillis: 3000, minIntervalMillis: 1000, regenPercent: 0.05 },
  },
  crafting: { maxSkillLevel: 100, baseXpPerLevel: 50, xpExponent: 1.5, gatherCooldownMs: 3000, stationBonusQuantity: 1 },
  group: { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 0.1 },
  classes: {},
  races: {},
  equipmentSlots: { head: { displayName: "Head", order: 1 } },
  genders: {},
  achievementCategories: {},
  achievementCriterionTypes: {},
  questObjectiveTypes: {},
  questCompletionTypes: {},
  statusEffectTypes: {},
  stackBehaviors: {},
  abilityTargetTypes: {},
  craftingSkills: {},
  craftingStationTypes: {},
  housing: { enabled: false, entryExitDirection: "SOUTH", templates: {} },
  guild: { founderRank: "leader", defaultRank: "member" },
  friends: { maxFriends: 50 },
  emotePresets: { presets: [] },
  enchanting: { maxEnchantmentsPerItem: 1, definitions: {} },
  bank: { maxItems: 50 },
  worldTime: { cycleLengthMs: 3600000, dawnHour: 5, dayHour: 8, duskHour: 18, nightHour: 21 },
  weather: { minTransitionMs: 300000, maxTransitionMs: 900000, types: {} },
  environment: { defaultTheme: { moteColors: [], skyGradients: {}, transitionColors: [], weatherParticleOverrides: {} }, zones: {} },
  worldEvents: { definitions: {} },
  pets: {},
  skillPoints: { interval: 2 },
  multiclass: { minLevel: 10, goldCost: 500, maxClasses: 2147483647, goldCostMultiplier: 1.0 },
  guildRanks: {},
  mobActionDelay: { minActionDelayMillis: 8000, maxActionDelayMillis: 20000 },
  characterCreation: { startingGold: 0 },
  images: { baseUrl: "/images/" },
  globalAssets: {
    video_available_indicator: "video_available_indicator.png",
    shop_kiosk: "shop_kiosk.png",
    puzzle_kiosk: "puzzle_kiosk.png",
    feature_door: "feature_door.png",
    feature_container: "feature_container.png",
    feature_lever: "feature_lever.png",
    dialog_indicator: "dialog_indicator.png",
    aggro_indicator: "aggro_indicator.png",
    quest_available_indicator: "quest_available_indicator.png",
    quest_complete_indicator: "quest_complete_indicator.png",
    crafting_station: "crafting_station.png",
    trainer_icon: "trainer_icon.png",
    bank_vault: "bank_vault.png",
    lottery_board_widget: "lottery_board_widget.png",
    dungeon_portal_widget: "dungeon_portal_widget.png",
    auction_hall_widget: "auction_hall_widget.png",
    duel_arena_widget: "duel_arena_widget.png",
    stylist_mirror: "stylist_mirror.png",
    housing_broker: "housing_broker.png",
    inn_widget: "inn_widget.png",
    character_widget: "character_widget.png",
    inventory_widget: "inventory_widget.png",
    equipment_widget: "equipment_widget.png",
    spellbook_widget: "spellbook_widget.png",
    quests_widget: "quests_widget.png",
    combat_log_widget: "combat_log_widget.png",
    social_widget: "social_widget.png",
    crafting_widget: "crafting_widget.png",
    auction_widget: "auction_widget.png",
    mail_widget: "mail_widget.png",
    help_widget: "help_widget.png",
    terminal_widget: "terminal_widget.png",
    compass_north: "compass_north.png",
    compass_south: "compass_south.png",
    compass_east: "compass_east.png",
    compass_west: "compass_west.png",
    compass_up: "compass_up.png",
    compass_down: "compass_down.png",
    minimap_bg: "minimap_bg.png",
    minimap_room: "minimap_room.png",
    minimap_room_inside: "minimap_room_inside.png",
    minimap_room_outside: "minimap_room_outside.png",
    minimap_room_forest: "minimap_room_forest.png",
    minimap_room_mountain: "minimap_room_mountain.png",
    minimap_room_underground: "minimap_room_underground.png",
    minimap_room_underwater: "minimap_room_underwater.png",
    minimap_room_desert: "minimap_room_desert.png",
    minimap_room_swamp: "minimap_room_swamp.png",
    minimap_room_urban: "minimap_room_urban.png",
    minimap_room_sky: "minimap_room_sky.png",
    minimap_room_current: "minimap_room_current.png",
    minimap_unexplored: "minimap-unexplored.png",
    minimap_room_housing: "minimap_room_housing.png",
    minimap_quest: "minimap_quest.png",
    map_background: "map_background.png",
    room_panel_bg: "room_panel_bg.png",
    compass_bg: "compass_bg.png",
  },
  persistence: { backend: "YAML", rootDir: "data/players", worker: { enabled: true, flushIntervalMs: 5000 } },
  login: { maxWrongPasswordRetries: 3, maxFailedAttemptsBeforeDisconnect: 3, maxConcurrentLogins: 50, authThreads: 8 },
  transport: { telnet: { maxLineLen: 1024, maxNonPrintablePerLine: 32, socketBacklog: 256, maxConnections: 5000 }, websocket: { host: "0.0.0.0", stopGraceMillis: 1000, stopTimeoutMillis: 2000 }, maxInboundBackpressureFailures: 3 },
  demo: { autoLaunchBrowser: false, webClientHost: "localhost", webClientUrl: null },
  database: { jdbcUrl: "jdbc:postgresql://localhost:5432/ambonmud", username: "ambon", password: "ambon", maxPoolSize: 5, minimumIdle: 1 },
  redis: { enabled: false, uri: "redis://localhost:6379", cacheTtlSeconds: 3600, bus: { enabled: false, inboundChannel: "ambon:inbound", outboundChannel: "ambon:outbound", instanceId: "", sharedSecret: "" } },
  grpc: { server: { port: 9090, controlPlaneSendTimeoutMs: 2000 }, client: { engineHost: "localhost", enginePort: 9090 }, sharedSecret: "", allowPlaintext: true, timestampToleranceMs: 30000 },
  gateway: { id: 0, snowflake: { idLeaseTtlSeconds: 300 }, reconnect: { maxAttempts: 10, initialDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0.2, streamVerifyMs: 2000 }, engines: [], startZone: "" },
  sharding: { enabled: false, engineId: "engine-1", zones: [], registry: { type: "STATIC", leaseTtlSeconds: 30, assignments: [] }, handoff: { ackTimeoutMs: 2000 }, advertiseHost: "localhost", advertisePort: null, playerIndex: { enabled: false, heartbeatMs: 10000 }, instancing: { enabled: false, defaultCapacity: 200, loadReportIntervalMs: 5000, startZoneMinInstances: 1, autoScale: { enabled: false, evaluationIntervalMs: 30000, scaleUpThreshold: 0.8, scaleDownThreshold: 0.2, cooldownMs: 60000 } } },
  rawSections: {},
};

describe("validateConfig", () => {
  it("returns no issues for a valid config", () => {
    expect(validateConfig(BASE_CONFIG)).toEqual([]);
  });

  // ─── Server ─────────────────────────────────────────────────
  it("flags telnet port out of range", () => {
    const cfg = { ...BASE_CONFIG, server: { ...BASE_CONFIG.server, telnetPort: 0, webPort: 8080 } };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "server", severity: "error", message: expect.stringContaining("Telnet port") }),
    );
  });

  it("flags web port out of range", () => {
    const cfg = { ...BASE_CONFIG, server: { ...BASE_CONFIG.server, telnetPort: 4000, webPort: 70000 } };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "server", severity: "error", message: expect.stringContaining("Web port") }),
    );
  });

  it("flags duplicate ports", () => {
    const cfg = { ...BASE_CONFIG, server: { ...BASE_CONFIG.server, telnetPort: 4000, webPort: 4000 } };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "server", message: expect.stringContaining("different") }),
    );
  });

  it("flags invalid observability endpoint", () => {
    const cfg = {
      ...BASE_CONFIG,
      observability: { ...BASE_CONFIG.observability, metricsEndpoint: "metrics" },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "observability", severity: "error" }),
    );
  });

  // ─── Stat bindings ──────────────────────────────────────────
  it("flags binding referencing unknown stat", () => {
    const cfg = {
      ...BASE_CONFIG,
      stats: {
        ...BASE_CONFIG.stats,
        bindings: { ...BASE_CONFIG.stats.bindings, meleeDamageStat: "MISSING" },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "stats.bindings",
        severity: "error",
        message: expect.stringContaining("MISSING"),
      }),
    );
  });

  it("skips binding checks when no stats defined", () => {
    const cfg = {
      ...BASE_CONFIG,
      stats: {
        definitions: {},
        bindings: { ...BASE_CONFIG.stats.bindings, meleeDamageStat: "ANYTHING" },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues.filter((i) => i.entity === "stats.bindings")).toEqual([]);
  });

  // ─── Abilities ──────────────────────────────────────────────
  it("flags ability referencing unknown status effect", () => {
    const cfg = {
      ...BASE_CONFIG,
      abilities: {
        poison_strike: {
          displayName: "Poison Strike",
          manaCostPct: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          effect: { type: "APPLY_STATUS", statusEffectId: "nonexistent" },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "ability:poison_strike",
        severity: "error",
        message: expect.stringContaining("nonexistent"),
      }),
    );
  });

  it("passes when ability references valid status effect", () => {
    const cfg = {
      ...BASE_CONFIG,
      statusEffects: {
        poison: { displayName: "Poison", effectType: "DOT", durationMs: 10000 },
      },
      abilities: {
        poison_strike: {
          displayName: "Poison Strike",
          manaCostPct: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          effect: { type: "APPLY_STATUS", statusEffectId: "poison" },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues.filter((i) => i.entity.startsWith("ability:"))).toEqual([]);
  });

  it("flags negative skillPointCost on an ability", () => {
    const cfg = {
      ...BASE_CONFIG,
      abilities: {
        bogus_cost: {
          displayName: "Bogus Cost",
          manaCostPct: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          skillPointCost: -1,
          effect: { type: "DIRECT_DAMAGE", minDamage: 5, maxDamage: 5 },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "ability:bogus_cost",
        severity: "error",
        message: expect.stringContaining("skillPointCost"),
      }),
    );
  });

  it("accepts a zero skillPointCost (auto-learned ability)", () => {
    const cfg = {
      ...BASE_CONFIG,
      abilities: {
        free_spark: {
          displayName: "Free Spark",
          manaCostPct: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          skillPointCost: 0,
          effect: { type: "DIRECT_DAMAGE", minDamage: 3, maxDamage: 3 },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(
      issues.filter((i) => i.entity === "ability:free_spark"),
    ).toEqual([]);
  });

  it("warns about ability with unknown class restriction", () => {
    const cfg = {
      ...BASE_CONFIG,
      classes: { WARRIOR: { displayName: "Warrior", hpScalingRate: 1.1, manaScalingRate: 1.05 } },
      abilities: {
        smite: {
          displayName: "Smite",
          manaCostPct: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          classRestriction: "PALADIN",
          effect: { type: "DIRECT_DAMAGE", minDamage: 5, maxDamage: 5 },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "ability:smite",
        severity: "warning",
        message: expect.stringContaining("PALADIN"),
      }),
    );
  });

  // ─── Status effects ─────────────────────────────────────────
  it("flags status effect stat mod referencing unknown stat", () => {
    const cfg = {
      ...BASE_CONFIG,
      statusEffects: {
        buff: {
          displayName: "Buff",
          effectType: "STAT_BUFF",
          durationMs: 60000,
          statMods: { FAKE: 5 },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "statusEffect:buff",
        severity: "error",
        message: expect.stringContaining("FAKE"),
      }),
    );
  });

  // ─── Classes ────────────────────────────────────────────────
  it("warns about class with unknown primary stat", () => {
    const cfg = {
      ...BASE_CONFIG,
      classes: {
        MAGE: { displayName: "Mage", hpScalingRate: 1.08, manaScalingRate: 1.12, primaryStat: "NOPE" },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "class:MAGE",
        severity: "warning",
        message: expect.stringContaining("NOPE"),
      }),
    );
  });

  // ─── Races ──────────────────────────────────────────────────
  it("warns about race stat mod referencing unknown stat", () => {
    const cfg = {
      ...BASE_CONFIG,
      races: {
        elf: { displayName: "Elf", statMods: { BOGUS: 2 } },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "race:elf",
        severity: "warning",
        message: expect.stringContaining("BOGUS"),
      }),
    );
  });

  // ─── Stat bindings (melee combat formula) ──────────────────────
  it("errors when meleeStatMultiplier is negative", () => {
    const cfg = {
      ...BASE_CONFIG,
      stats: {
        ...BASE_CONFIG.stats,
        bindings: { ...BASE_CONFIG.stats.bindings, meleeStatMultiplier: -0.1 },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "stats.bindings", severity: "error" }),
    );
  });

  it("errors when meleeLevelScalingRate is below 1.0", () => {
    const cfg = {
      ...BASE_CONFIG,
      stats: {
        ...BASE_CONFIG.stats,
        bindings: { ...BASE_CONFIG.stats.bindings, meleeLevelScalingRate: 0.9 },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "stats.bindings", severity: "error" }),
    );
  });

  it("errors when meleeArmorMitigationK is zero or negative", () => {
    const cfg = {
      ...BASE_CONFIG,
      stats: {
        ...BASE_CONFIG.stats,
        bindings: { ...BASE_CONFIG.stats.bindings, meleeArmorMitigationK: 0 },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "stats.bindings", severity: "error" }),
    );
  });

  it("flags stale lottery config that would export invalid values", () => {
    const cfg = {
      ...BASE_CONFIG,
      lottery: {
        enabled: true,
        ticketCost: 0,
        drawingIntervalMs: 0,
        jackpotSeedGold: -1,
      },
    };
    const issues = validateConfig(cfg);
    expect(issues.some((i) => i.entity === "lottery" && i.severity === "error")).toBe(true);
  });

  it("flags gambling win chance outside 0..1", () => {
    const cfg = {
      ...BASE_CONFIG,
      gambling: {
        enabled: true,
        diceMinBet: 10,
        diceMaxBet: 100,
        diceWinChance: 2,
        diceWinMultiplier: 2,
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "gambling", severity: "error" }),
    );
  });

  // ─── Progression ────────────────────────────────────────────
  it("flags max level below 1", () => {
    const cfg = {
      ...BASE_CONFIG,
      progression: { ...BASE_CONFIG.progression, maxLevel: 0 },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "progression", severity: "error" }),
    );
  });
});
