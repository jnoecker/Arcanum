import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { buildMonolithicConfigObject } from "../exportMud";
import { parseAppConfigYaml } from "../loader";
import type { AppConfig } from "@/types/config";

const BASE_CONFIG: AppConfig = {
  mode: "STANDALONE",
  server: { telnetPort: 4000, webPort: 8080, inboundChannelCapacity: 10000, outboundChannelCapacity: 10000, sessionOutboundQueueCapacity: 200, maxInboundEventsPerTick: 1000, tickMillis: 100, inboundBudgetMs: 30 },
  world: { startRoom: "ambon_hub:hall_of_portals", resources: ["world/tutorial_glade.yaml"] },
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
  navigation: {
    recall: {
      cooldownMs: 300000,
      messages: {
        combatBlocked: "blocked",
        cooldownRemaining: "cooldown",
        castBegin: "cast",
        unreachable: "unreachable",
        departNotice: "depart",
        arriveNotice: "arrive",
        arrival: "arrival",
      },
    },
  },
  death: {
    sanctumRoom: "",
    respawnHpFraction: 0.2,
    respawnManaFraction: 0.2,
    xpPenaltyFraction: 0.0,
    messages: {
      arriveSanctum: "arrive sanctum",
      departNoSanctum: "no sanctum",
      departNoDeath: "no death",
      departBegin: "depart begin",
      departUnreachable: "unreachable",
    },
  },
  commands: {},
  group: { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 0.1 },
  classes: {},
  races: {},
  characterCreation: { startingGold: 0 },
  equipmentSlots: {},
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
  enchanting: { maxEnchantmentsPerItem: 1, definitions: {} },
  bank: { maxItems: 50 },
  worldTime: { cycleLengthMs: 3600000, dawnHour: 5, dayHour: 8, duskHour: 18, nightHour: 21 },
  season: { cycleLengthMs: 14400000 },
  weather: { minTransitionMs: 300000, maxTransitionMs: 900000, types: {} },
  mobVariants: { enabled: true, chance: 0.04, variants: {} },
  environment: { defaultTheme: { moteColors: [], skyGradients: {}, transitionColors: [], weatherParticleOverrides: {} }, zones: {} },
  worldEvents: { definitions: {} },
  pets: {},
  guild: { founderRank: "leader", defaultRank: "member" },
  guildRanks: {},
  friends: { maxFriends: 50 },
  mobActionDelay: { minActionDelayMillis: 8000, maxActionDelayMillis: 20000 },
  images: { baseUrl: "https://assets.ambon.dev" },
  globalAssets: {},
  skillPoints: {
    interval: 5,
  },
  multiclass: {
    minLevel: 10,
    goldCost: 500,
    maxClasses: 2147483647,
    goldCostMultiplier: 1.0,
  },
  admin: {
    enabled: false,
    host: "127.0.0.1",
    port: 8081,
    token: "",
    basePath: "/admin",
    grafanaUrl: "",
  },
  observability: {
    metricsEnabled: false,
    metricsEndpoint: "/metrics",
    metricsHttpPort: 9090,
  },
  logging: {
    level: "INFO",
    packageLevels: {},
  },
  achievementDefs: {},
  emotePresets: { presets: [] },
  persistence: { backend: "YAML", rootDir: "data/players", worker: { enabled: true, flushIntervalMs: 5000 } },
  login: { maxWrongPasswordRetries: 3, maxFailedAttemptsBeforeDisconnect: 3, maxConcurrentLogins: 50, authThreads: 8 },
  transport: { telnet: { maxLineLen: 1024, maxNonPrintablePerLine: 32, socketBacklog: 256, maxConnections: 5000 }, websocket: { host: "0.0.0.0", stopGraceMillis: 1000, stopTimeoutMillis: 2000, maxConnections: 5000, maxConnectionsPerIp: 30, pingPeriodMillis: 15000, pongTimeoutMillis: 30000, maxFrameBytes: 65536 }, maxInboundBackpressureFailures: 3 },
  demo: { autoLaunchBrowser: false, webClientHost: "localhost", webClientUrl: null },
  database: { jdbcUrl: "jdbc:postgresql://localhost:5432/ambonmud", username: "ambon", password: "ambon", maxPoolSize: 5, minimumIdle: 1 },
  redis: { enabled: false, uri: "redis://localhost:6379", cacheTtlSeconds: 3600, bus: { enabled: false, inboundChannel: "ambon:inbound", outboundChannel: "ambon:outbound", instanceId: "", sharedSecret: "" } },
  grpc: { server: { port: 9090, controlPlaneSendTimeoutMs: 2000 }, client: { engineHost: "localhost", enginePort: 9090 }, sharedSecret: "", allowPlaintext: true, timestampToleranceMs: 30000 },
  gateway: { id: 0, snowflake: { idLeaseTtlSeconds: 300 }, reconnect: { maxAttempts: 10, initialDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0.2, streamVerifyMs: 2000 }, engines: [], startZone: "" },
  sharding: { enabled: false, engineId: "engine-1", zones: [], registry: { type: "STATIC", leaseTtlSeconds: 30, assignments: [] }, handoff: { ackTimeoutMs: 2000 }, advertiseHost: "localhost", advertisePort: null, playerIndex: { enabled: false, heartbeatMs: 10000 }, instancing: { enabled: false, defaultCapacity: 200, loadReportIntervalMs: 5000, startZoneMinInstances: 1, autoScale: { enabled: false, evaluationIntervalMs: 30000, scaleUpThreshold: 0.8, scaleDownThreshold: 0.2, cooldownMs: 60000 } } },
  rawSections: {},
};

describe("buildMonolithicConfigObject", () => {
  it("emits explicit runtime defaults and normalizes split room ids", () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      admin: {
        ...BASE_CONFIG.admin,
        enabled: true,
        token: "should-not-be-exported",
      },
      classStartRooms: { BULWARK: "training_grounds" },
      abilities: {
        shield_bash: {
          displayName: "Shield Bash",
          manaCostPct: 5,
          cooldownMs: 1000,
          levelRequired: 1,
          targetType: "enemy",
          effect: { type: "DIRECT_DAMAGE", minDamage: 1, maxDamage: 2 },
          image: "C:/Users/John Noecker Jr/AppData/Roaming/dev.ambon.creator/assets/images/shield_bash.png",
        },
      },
      statusEffects: {
        fortress_stance: {
          displayName: "Fortress Stance",
          effectType: "BUFF",
          durationMs: 10000,
          image: "C:/Users/John Noecker Jr/AppData/Roaming/dev.ambon.creator/assets/images/fortress_stance.webp",
        },
      },
    };

    const zones = new Map([
      ["tutorial_glade", {
        filePath: "",
        dirty: false,
        past: [],
        future: [],
        data: {
          zone: "tutorial_glade",
          startRoom: "training_grounds",
          rooms: {
            training_grounds: { title: "Training Grounds", description: "", exits: {} },
          },
        },
      }],
    ]) as any;

    const runtime = buildMonolithicConfigObject(config, zones) as any;

    expect(runtime.redis.enabled).toBe(false);
    expect(runtime.audio.baseUrl).toBe("https://assets.ambon.dev/");
    expect(runtime.videos.baseUrl).toBe("https://assets.ambon.dev/");
    expect(runtime.admin.enabled).toBe(true);
    expect(runtime.admin.token).toBe("OVERRIDE_ME_FROM_ENV");
    expect(runtime.engine.classStartRooms.BULWARK).toBe("tutorial_glade:training_grounds");
    expect(runtime.engine.statusEffects.definitions.fortress_stance.effectType).toBe("stat_buff");
    // Regression: status-effect icon path used to be silently dropped on save,
    // causing the panel thumbnail to render empty after every reload even
    // though the underlying asset variants were intact.
    expect(runtime.engine.statusEffects.definitions.fortress_stance.image).toBe("fortress_stance.webp");
    expect(runtime.engine.abilities.definitions.shield_bash.image).toBe("shield_bash.png");
    // Unset skillPointCost is omitted so the Kotlin default of 1 applies
    expect(
      "skillPointCost" in runtime.engine.abilities.definitions.shield_bash,
    ).toBe(false);
    expect(runtime.engine.achievementCategories.categories.combat.displayName).toBe("Combat");
    expect(runtime.engine.questObjectiveTypes.types.kill.displayName).toBe("Kill");
    expect(runtime.images.globalAssets).toEqual({});
  });

  it("disables daily quests during export when pools are incomplete", () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      dailyQuests: {
        enabled: true,
        streakBonusPercent: 10,
        dailySlots: 3,
        weeklySlots: 1,
        dailyPool: [],
        weeklyPool: [],
      },
    };

    const runtime = buildMonolithicConfigObject(config) as any;

    expect(runtime.engine.dailyQuests.enabled).toBe(false);
    expect(runtime.engine.dailyQuests.dailySlots).toBe(3);
    expect(runtime.engine.dailyQuests.dailyPool).toEqual([]);
  });

  it("emits season and mob-variant engine config", () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      season: { cycleLengthMs: 7200000 },
      mobVariants: { enabled: false, chance: 0.1, variants: {} },
    };

    const runtime = buildMonolithicConfigObject(config) as any;

    expect(runtime.engine.season.cycleLengthMs).toBe(7200000);
    expect(runtime.engine.mobVariants.enabled).toBe(false);
    expect(runtime.engine.mobVariants.chance).toBe(0.1);
    // An empty custom palette is omitted so the server keeps its built-ins.
    expect("variants" in runtime.engine.mobVariants).toBe(false);
  });

  it("preserves a custom mob-variant palette on export", () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      mobVariants: {
        enabled: true,
        chance: 0.04,
        variants: {
          molten: { namePrefix: "Molten ", tint: "#ff0000", weight: 2, announce: "ZONE" },
        },
      },
    };

    const runtime = buildMonolithicConfigObject(config) as any;

    expect(runtime.engine.mobVariants.variants.molten.namePrefix).toBe("Molten ");
    expect(runtime.engine.mobVariants.variants.molten.weight).toBe(2);
  });

  it("emits non-default skillPointCost values on abilities", () => {
    const config: AppConfig = {
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
        pricey_blast: {
          displayName: "Pricey Blast",
          manaCostPct: 10,
          cooldownMs: 2000,
          levelRequired: 5,
          targetType: "ENEMY",
          skillPointCost: 3,
          effect: { type: "DIRECT_DAMAGE", minDamage: 20, maxDamage: 20 },
        },
      },
    };

    const runtime = buildMonolithicConfigObject(config) as any;
    const defs = runtime.engine.abilities.definitions;

    expect(defs.free_spark.skillPointCost).toBe(0);
    expect(defs.pricey_blast.skillPointCost).toBe(3);
  });

  it("disables global quests during export when objectives are missing", () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      globalQuests: {
        enabled: true,
        intervalMs: 7_200_000,
        durationMs: 1_800_000,
        objectives: [],
      },
    };

    const runtime = buildMonolithicConfigObject(config) as any;

    expect(runtime.engine.globalQuests.enabled).toBe(false);
    expect(runtime.engine.globalQuests.objectives).toEqual([]);
  });
});

describe("parseAppConfigYaml", () => {
  it("loads nested registry shapes from monolithic yaml", () => {
    const yaml = `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: ambon_hub:hall_of_portals
    resources: []
  progression:
    maxLevel: 50
    xp: { baseXp: 100, exponent: 2, linearXp: 0, multiplier: 1, defaultKillXp: 50 }
    rewards: { hpScalingRate: 1.1, manaScalingRate: 1.05, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 20 }
  images:
    baseUrl: https://assets.ambon.dev/
    globalAssets:
      minimap_unexplored: fog.png
  engine:
    achievementCategories:
      categories:
        combat:
          displayName: Combat
    achievementCriterionTypes:
      types:
        kill:
          displayName: Kill
          progressFormat: "{current}/{required}"
    questObjectiveTypes:
      types:
        collect:
          displayName: Collect
    questCompletionTypes:
      types:
        npc_turn_in:
          displayName: NPC Turn-In
`;

    const config = parseAppConfigYaml(yaml);
    expect(config.globalAssets.minimap_unexplored).toBe("fog.png");
    expect(config.achievementCategories.combat.displayName).toBe("Combat");
    expect(config.achievementCriterionTypes.kill.progressFormat).toBe("{current}/{required}");
    expect(config.questObjectiveTypes.collect.displayName).toBe("Collect");
    expect(config.questCompletionTypes.npc_turn_in.displayName).toBe("NPC Turn-In");

    const parsed = parse(yaml) as any;
    expect(parsed.ambonmud.engine.achievementCategories.categories.combat.displayName).toBe("Combat");
  });

  it("preserves ability skillPointCost through parse and re-export", () => {
    const yaml = `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: hub:square
    resources: []
  engine:
    abilities:
      definitions:
        free_spark:
          displayName: Free Spark
          manaCostPct: 5
          cooldownMs: 0
          levelRequired: 1
          skillPointCost: 0
          targetType: ENEMY
          effect: { type: DIRECT_DAMAGE, minDamage: 3, maxDamage: 3 }
        pricey_blast:
          displayName: Pricey Blast
          manaCostPct: 10
          cooldownMs: 2000
          levelRequired: 5
          skillPointCost: 3
          targetType: ENEMY
          effect: { type: DIRECT_DAMAGE, minDamage: 20, maxDamage: 20 }
`;

    const config = parseAppConfigYaml(yaml);
    expect(config.abilities.free_spark?.skillPointCost).toBe(0);
    expect(config.abilities.free_spark?.manaCostPct).toBe(5);
    expect(config.abilities.free_spark).not.toHaveProperty("manaCost");
    expect(config.abilities.pricey_blast?.skillPointCost).toBe(3);
    expect(config.abilities.pricey_blast?.manaCostPct).toBe(10);
    expect(config.abilities.pricey_blast).not.toHaveProperty("manaCost");

    const runtime = buildMonolithicConfigObject(config) as any;
    const defs = runtime.engine.abilities.definitions;
    expect(defs.free_spark.skillPointCost).toBe(0);
    expect(defs.free_spark.manaCostPct).toBe(5);
    expect(defs.free_spark).not.toHaveProperty("manaCost");
    expect(defs.pricey_blast.skillPointCost).toBe(3);
    expect(defs.pricey_blast.manaCostPct).toBe(10);
    expect(defs.pricey_blast).not.toHaveProperty("manaCost");
  });

  it("migrates legacy ability manaCost to manaCostPct on first load", () => {
    const yaml = `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: hub:square
    resources: []
  progression:
    rewards:
      baseMana: 100
      manaScalingRate: 1.5
  engine:
    classes:
      definitions:
        MAGE:
          displayName: Mage
          hpScalingRate: 1.1
          manaScalingRate: 2
    abilities:
      definitions:
        fireball:
          displayName: Fireball
          manaCost: 50
          cooldownMs: 1000
          levelRequired: 2
          requiredClass: MAGE
          targetType: ENEMY
          effect: { type: DIRECT_DAMAGE, minDamage: 8, maxDamage: 8 }
`;

    const config = parseAppConfigYaml(yaml);

    expect(config.abilities.fireball?.manaCostPct).toBe(25);
    expect(config.abilities.fireball).not.toHaveProperty("manaCost");

    const runtime = buildMonolithicConfigObject(config) as any;
    const defs = runtime.engine.abilities.definitions;
    expect(defs.fireball.manaCostPct).toBe(25);
    expect(defs.fireball).not.toHaveProperty("manaCost");
  });
});

describe("akathavae config", () => {
  it("parses engine.akathavae overrides and fills defaults for missing keys", () => {
    const yaml = `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: hub:square
    resources: []
  engine:
    akathavae:
      renounceCostGold: 999
      illuminateBaseSuccessPct: 50
      successStat: WIS
`;
    const config = parseAppConfigYaml(yaml);
    expect(config.akathavae.renounceCostGold).toBe(999);
    expect(config.akathavae.illuminateBaseSuccessPct).toBe(50);
    expect(config.akathavae.successStat).toBe("WIS");
    // Untouched keys fall back to the canonical defaults.
    expect(config.akathavae.repledgeCooldownMs).toBe(86_400_000);
    expect(config.akathavae.maxSuccessPct).toBe(95);
    expect(config.akathavae.enabled).toBe(true);
  });

  it("defaults the whole block when engine.akathavae is absent", () => {
    const yaml = `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: hub:square
    resources: []
  engine: {}
`;
    const config = parseAppConfigYaml(yaml);
    expect(config.akathavae.renounceCostGold).toBe(2500);
    expect(config.akathavae.successStat).toBe("INT");
  });

  it("omits the block on export when unchanged, emits it when tuned", () => {
    const base = parseAppConfigYaml(`
ambonmud:
  server: { telnetPort: 4000, webPort: 8080 }
  world: { startRoom: hub:square, resources: [] }
  engine: {}
`);
    // Default config → no akathavae block in the rebuilt monolith.
    const clean = buildMonolithicConfigObject(base) as any;
    expect(clean.engine).not.toHaveProperty("akathavae");

    // Tuned config → block round-trips with the change preserved.
    const tuned: AppConfig = { ...base, akathavae: { ...base.akathavae, renounceCostGold: 5000 } };
    const runtime = buildMonolithicConfigObject(tuned) as any;
    expect(runtime.engine.akathavae.renounceCostGold).toBe(5000);
    // Block re-parses cleanly with the change preserved.
    expect(parseAppConfigYaml(stringify({ ambonmud: runtime })).akathavae.renounceCostGold).toBe(5000);
  });
});
