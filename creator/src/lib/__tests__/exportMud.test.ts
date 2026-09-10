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
    achievements:
      challenger:
        displayName: Challenger
        category: combat
        criteria: []
        rewards:
          skillPoints: 2
`;

    const config = parseAppConfigYaml(yaml);
    expect(config.globalAssets.minimap_unexplored).toBe("fog.png");
    expect(config.achievementCategories.combat.displayName).toBe("Combat");
    expect(config.achievementCriterionTypes.kill.progressFormat).toBe("{current}/{required}");
    expect(config.questObjectiveTypes.collect.displayName).toBe("Collect");
    expect(config.achievementDefs.challenger.rewards?.skillPoints).toBe(2);
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

describe("regen config", () => {
  const withRegen = (regen: string) => `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: hub:square
    resources: []
  engine:
    regen:
${regen}
`;

  it("parses regen.model and mana.inCombatMultiplier and exports them unchanged", () => {
    const config = parseAppConfigYaml(
      withRegen(`      regenPercent: 0.1
      inCombatMultiplier: 0.1
      model: rate
      mana:
        regenPercent: 0.1
        inCombatMultiplier: 0.05`),
    );
    expect(config.regen.model).toBe("rate");
    expect(config.regen.mana.inCombatMultiplier).toBe(0.05);
    expect(config.regen.inCombatMultiplier).toBe(0.1);

    const out = buildMonolithicConfigObject(config) as { engine: { regen: AppConfig["regen"] } };
    expect(out.engine.regen.model).toBe("rate");
    expect(out.engine.regen.mana.inCombatMultiplier).toBe(0.05);
  });

  it("omits the optional regen keys when they are not authored", () => {
    const config = parseAppConfigYaml(withRegen(`      regenPercent: 0.15`));
    expect(config.regen.model).toBeUndefined();
    expect(config.regen.mana.inCombatMultiplier).toBeUndefined();

    const out = buildMonolithicConfigObject(config) as { engine: { regen: Record<string, unknown> & { mana: Record<string, unknown> } } };
    expect("model" in out.engine.regen).toBe(false);
    expect("inCombatMultiplier" in out.engine.regen.mana).toBe(false);
  });

  it("drops an unknown regen.model value rather than exporting it", () => {
    const config = parseAppConfigYaml(withRegen(`      model: hybrid`));
    expect(config.regen.model).toBeUndefined();
  });
});

describe("D-20 stat model keys", () => {
  const doc = (bindings: string, classExtra = "") => `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: hub:square
    resources: []
  engine:
    stats:
      definitions:
        STR: { displayName: Strength, abbreviation: STR, description: "", baseStat: 10 }
        INT: { displayName: Intelligence, abbreviation: INT, description: "", baseStat: 10 }
      bindings:
${bindings}
    classes:
      definitions:
        bulwark:
          displayName: Bulwark
          hpScalingRate: 1.12
          manaScalingRate: 1.12
${classExtra}
`;

  it("parses and exports the stat model keys and the class offensive stat when authored", () => {
    const config = parseAppConfigYaml(
      doc(`        statScalingMode: multiplicative
        meleePercentPerPoint: 0.0075
        spellPercentPerPoint: 0.0075
        healPercentPerPoint: 0.0075
        shieldPercentPerPoint: 0.0075
        dodgePerPoint: 0.5
        poolStatMode: multiplicative
        poolPercentPerPoint: 0.0075
        poolsUseEquipment: true`, `          offensiveStat: STR`),
    );
    expect(config.stats.bindings.statScalingMode).toBe("multiplicative");
    expect(config.stats.bindings.dodgePerPoint).toBe(0.5);
    expect(config.stats.bindings.poolsUseEquipment).toBe(true);
    expect(config.classes.bulwark.offensiveStat).toBe("STR");

    const out = buildMonolithicConfigObject(config) as {
      engine: { stats: { bindings: Record<string, unknown> }; classes: { definitions: Record<string, Record<string, unknown>> } };
    };
    expect(out.engine.stats.bindings.statScalingMode).toBe("multiplicative");
    expect(out.engine.stats.bindings.meleePercentPerPoint).toBe(0.0075);
    expect(out.engine.stats.bindings.poolStatMode).toBe("multiplicative");
    expect(out.engine.stats.bindings.poolPercentPerPoint).toBe(0.0075);
    expect(out.engine.stats.bindings.poolsUseEquipment).toBe(true);
    expect(out.engine.classes.definitions.bulwark.offensiveStat).toBe("STR");
  });

  it("omits the optional keys when they are not authored", () => {
    const config = parseAppConfigYaml(doc(`        dodgePerPoint: 2`));
    expect(config.stats.bindings.statScalingMode).toBeUndefined();
    expect(config.stats.bindings.poolStatMode).toBeUndefined();
    expect(config.classes.bulwark.offensiveStat).toBeUndefined();
    const out = buildMonolithicConfigObject(config) as {
      engine: { stats: { bindings: Record<string, unknown> }; classes: { definitions: Record<string, Record<string, unknown>> } };
    };
    expect("statScalingMode" in out.engine.stats.bindings).toBe(false);
    expect("poolsUseEquipment" in out.engine.stats.bindings).toBe(false);
    expect("offensiveStat" in out.engine.classes.definitions.bulwark).toBe(false);
  });

  it("drops an unknown scaling mode rather than exporting it", () => {
    const config = parseAppConfigYaml(doc(`        statScalingMode: hybrid`));
    expect(config.stats.bindings.statScalingMode).toBeUndefined();
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

  it("round-trips the unpledged journaling and zone-completion knobs", () => {
    const base = parseAppConfigYaml(`
ambonmud:
  server: { telnetPort: 4000, webPort: 8080 }
  world: { startRoom: hub:square, resources: [] }
  engine: {}
`);
    const tuned: AppConfig = {
      ...base,
      akathavae: { ...base.akathavae, unpledgedSuccessMultiplier: 0.3, unpledgedXpMultiplier: 0, zoneCompletionGold: 1000 },
    };
    const runtime = buildMonolithicConfigObject(tuned) as any;
    expect(runtime.engine.akathavae.unpledgedSuccessMultiplier).toBe(0.3);
    const reparsed = parseAppConfigYaml(stringify({ ambonmud: runtime })).akathavae;
    expect(reparsed.unpledgedSuccessMultiplier).toBe(0.3);
    expect(reparsed.unpledgedXpMultiplier).toBe(0);
    expect(reparsed.zoneCompletionGold).toBe(1000);
    // Untouched new knobs fall back to canonical defaults.
    expect(reparsed.roomDiscoveryXpPerZoneLevel).toBe(5);
    expect(reparsed.zoneCompletionXpPerRoom).toBe(50);
  });
});

describe("flight config", () => {
  it("parses engine.flight overrides and fills defaults for missing keys", () => {
    const yaml = `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: hub:square
    resources: []
  engine:
    flight:
      baseCost: 100
      costPerRoom: 10
      messages:
        arrival: "Touchdown at {dest}."
`;
    const config = parseAppConfigYaml(yaml);
    expect(config.flight.baseCost).toBe(100);
    expect(config.flight.costPerRoom).toBe(10);
    expect(config.flight.messages.arrival).toBe("Touchdown at {dest}.");
    // Untouched keys fall back to the canonical defaults.
    expect(config.flight.minCost).toBe(25);
    expect(config.flight.maxCost).toBe(5000);
    expect(config.flight.unreachableCost).toBe(500);
    expect(config.flight.messages.alreadyHere).toBe("You're already at that flight point.");
  });

  it("defaults the whole block when engine.flight is absent", () => {
    const config = parseAppConfigYaml(`
ambonmud:
  server: { telnetPort: 4000, webPort: 8080 }
  world: { startRoom: hub:square, resources: [] }
  engine: {}
`);
    expect(config.flight.baseCost).toBe(25);
    expect(config.flight.costPerRoom).toBe(4);
  });

  it("omits the block on export when unchanged, emits it when tuned", () => {
    const base = parseAppConfigYaml(`
ambonmud:
  server: { telnetPort: 4000, webPort: 8080 }
  world: { startRoom: hub:square, resources: [] }
  engine: {}
`);
    // Default config → no flight block in the rebuilt monolith.
    const clean = buildMonolithicConfigObject(base) as any;
    expect(clean.engine).not.toHaveProperty("flight");

    // Tuned config → block round-trips with the change preserved.
    const tuned: AppConfig = { ...base, flight: { ...base.flight, costPerRoom: 9 } };
    const runtime = buildMonolithicConfigObject(tuned) as any;
    expect(runtime.engine.flight.costPerRoom).toBe(9);
    // Block re-parses cleanly with the change preserved.
    expect(parseAppConfigYaml(stringify({ ambonmud: runtime })).flight.costPerRoom).toBe(9);
  });

  it("round-trips a customized message even when costs are default", () => {
    const base = parseAppConfigYaml(`
ambonmud:
  server: { telnetPort: 4000, webPort: 8080 }
  world: { startRoom: hub:square, resources: [] }
  engine: {}
`);
    const tuned: AppConfig = {
      ...base,
      flight: { ...base.flight, messages: { ...base.flight.messages, depart: "Up, up and away to {dest}!" } },
    };
    const runtime = buildMonolithicConfigObject(tuned) as any;
    expect(runtime.engine.flight.messages.depart).toBe("Up, up and away to {dest}!");
    expect(parseAppConfigYaml(stringify({ ambonmud: runtime })).flight.messages.depart).toBe("Up, up and away to {dest}!");
  });
});

describe("boat config round-trip", () => {
  it("defaults the whole block when engine.boat is absent", () => {
    const config = parseAppConfigYaml(`
ambonmud:
  server: { telnetPort: 4000, webPort: 8080 }
  world: { startRoom: hub:square, resources: [] }
  engine: {}
`);
    expect(config.boat.messages.notAtDock).toBe("You need to be at a boat dock to do that.");
    expect(config.boat.messages.combatBlocked).toBe("You can't set sail in the middle of a battle!");
  });

  it("omits the block on export when unchanged, emits it when a message is tuned", () => {
    const base = parseAppConfigYaml(`
ambonmud:
  server: { telnetPort: 4000, webPort: 8080 }
  world: { startRoom: hub:square, resources: [] }
  engine: {}
`);
    // Default config → no boat block in the rebuilt monolith.
    const clean = buildMonolithicConfigObject(base) as any;
    expect(clean.engine).not.toHaveProperty("boat");

    // Tuned config → block round-trips with the change preserved.
    const tuned: AppConfig = {
      ...base,
      boat: { ...base.boat, messages: { ...base.boat.messages, depart: "Anchors aweigh for {dest}!" } },
    };
    const runtime = buildMonolithicConfigObject(tuned) as any;
    expect(runtime.engine.boat.messages.depart).toBe("Anchors aweigh for {dest}!");
    expect(parseAppConfigYaml(stringify({ ambonmud: runtime })).boat.messages.depart).toBe("Anchors aweigh for {dest}!");
  });
});

describe("racial ability round-trip", () => {
  it("serializes a race's racialAbility and re-parses it intact", () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      races: {
        MYCORAE: {
          displayName: "Mycorae",
          racialAbility: {
            kind: "MYCORAE_SPORES",
            displayName: "Spore Burst",
            description: "When you drop to 25% health, you erupt in spores that congeal into tank mushrooms to guard you.",
            image: "abc123.png",
            cooldownMs: 120000,
            triggerHealthPct: 25,
            petTemplateKey: "spore_mushroom",
            petCountMin: 1,
            petCountMax: 3,
            petDurationMs: 12000,
            selfMessage: "You burst, scattering spores!",
            roomMessage: "{player} bursts in a cloud of spores!",
          },
        },
      },
    };

    const runtime = buildMonolithicConfigObject(config) as any;
    const ability = runtime.engine.races.definitions.MYCORAE.racialAbility;
    expect(ability.kind).toBe("MYCORAE_SPORES");
    expect(ability.petTemplateKey).toBe("spore_mushroom");
    expect(ability.petCountMax).toBe(3);
    expect(ability.description).toContain("25% health");
    expect(ability.image).toBe("abc123.png");

    const reparsed = parseAppConfigYaml(stringify({ ambonmud: runtime }));
    expect(reparsed.races.MYCORAE.racialAbility).toEqual(config.races.MYCORAE.racialAbility);
  });

  it("omits racialAbility for races without one", () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      races: { HUMAN: { displayName: "Human" } },
    };
    const runtime = buildMonolithicConfigObject(config) as any;
    expect("racialAbility" in runtime.engine.races.definitions.HUMAN).toBe(false);
  });
});


describe("balance profile keys survive parse and re-export", () => {
  const yaml = `
ambonmud:
  server:
    telnetPort: 4000
    webPort: 8080
  world:
    startRoom: "hub:start"
    resources: []
  progression:
    maxLevel: 30
  engine:
    stats:
      bindings:
        meleeLevelScalingRate: 1.12
        shieldStat: WIS
        shieldStatMultiplier: 0.25
        shieldLevelScalingRate: 1.12
        xpBonusCap: 0.25
    mob:
      tiers:
        standard:
          baseHp: 87
          hpScalingRate: 1.12
          baseMinDamage: 8
          baseMaxDamage: 10
          damageScalingRate: 1.12
          levelAnchors:
            "1": { hp: 87, minDamage: 8, maxDamage: 10 }
            "30": { hp: 9258, minDamage: 676, maxDamage: 914 }
    classes:
      definitions:
        bulwark:
          displayName: Bulwark
          hpScalingRate: 1.12
          manaScalingRate: 1.1
          baseHpMultiplier: 1.362
          baseManaMultiplier: 0.628
`;

  it("carries progression.repeatableXp through parse and export", () => {
    const config = parseAppConfigYaml(yaml);
    config.progression.repeatableXp = {
      dailyFractionOfLevel: 0.1,
      weeklyFractionOfLevel: 0.375,
      autoQuestFractionOfLevel: 0.05,
      globalFirstFractionOfLevel: 0.225,
      globalSecondFractionOfLevel: 0.11,
      globalThirdFractionOfLevel: 0.05,
    };
    const runtime = buildMonolithicConfigObject(config) as any;
    expect(runtime.progression.repeatableXp.weeklyFractionOfLevel).toBe(0.375);
    const round = parseAppConfigYaml(stringify({ ambonmud: runtime }));
    expect(round.progression.repeatableXp?.dailyFractionOfLevel).toBe(0.1);
    expect(round.progression.repeatableXp?.globalThirdFractionOfLevel).toBe(0.05);
  });

  it("leaves repeatableXp absent when the source never set it", () => {
    const config = parseAppConfigYaml(yaml);
    expect(config.progression.repeatableXp).toBeUndefined();
  });

  it("carries an anchored xpReward through parse and export", () => {
    const config = parseAppConfigYaml(yaml);
    const anchors = config.mobTiers.standard.levelAnchors!;
    anchors["1"] = { ...anchors["1"], xpReward: 86 };
    anchors["30"] = { ...anchors["30"], xpReward: 857 };
    const runtime = buildMonolithicConfigObject(config) as any;
    expect(runtime.engine.mob.tiers.standard.levelAnchors["30"].xpReward).toBe(857);
    const round = parseAppConfigYaml(stringify({ ambonmud: runtime }));
    expect(round.mobTiers.standard.levelAnchors?.["1"]).toEqual({ hp: 87, minDamage: 8, maxDamage: 10, xpReward: 86 });
    expect(round.mobTiers.standard.levelAnchors?.["30"]?.xpReward).toBe(857);
  });

  it("leaves xpReward off anchors whose source never set it", () => {
    const config = parseAppConfigYaml(yaml);
    expect(config.mobTiers.standard.levelAnchors?.["30"]).toEqual({ hp: 9258, minDamage: 676, maxDamage: 914 });
    const runtime = buildMonolithicConfigObject(config) as any;
    expect(runtime.engine.mob.tiers.standard.levelAnchors["30"]).not.toHaveProperty("xpReward");
  });

  it("carries anchored goldMin and goldMax through parse and export", () => {
    const config = parseAppConfigYaml(yaml);
    const anchors = config.mobTiers.standard.levelAnchors!;
    anchors["1"] = { ...anchors["1"], goldMin: 1, goldMax: 2 };
    anchors["30"] = { ...anchors["30"], goldMin: 7, goldMax: 14 };
    const runtime = buildMonolithicConfigObject(config) as any;
    expect(runtime.engine.mob.tiers.standard.levelAnchors["30"].goldMax).toBe(14);
    const round = parseAppConfigYaml(stringify({ ambonmud: runtime }));
    expect(round.mobTiers.standard.levelAnchors?.["1"]?.goldMin).toBe(1);
    expect(round.mobTiers.standard.levelAnchors?.["30"]).toEqual({ hp: 9258, minDamage: 676, maxDamage: 914, goldMin: 7, goldMax: 14 });
  });

  it("leaves gold anchors off anchors whose source never set them", () => {
    const config = parseAppConfigYaml(yaml);
    const runtime = buildMonolithicConfigObject(config) as any;
    expect(runtime.engine.mob.tiers.standard.levelAnchors["30"]).not.toHaveProperty("goldMax");
  });

  it("keeps class base multipliers, tier levelAnchors, shield bindings, and xpBonusCap", () => {
    const config = parseAppConfigYaml(yaml);
    expect(config.classes.bulwark.baseHpMultiplier).toBe(1.362);
    expect(config.mobTiers.standard.levelAnchors?.["30"]).toEqual({ hp: 9258, minDamage: 676, maxDamage: 914 });
    expect(config.stats.bindings.shieldLevelScalingRate).toBe(1.12);
    expect(config.stats.bindings.xpBonusCap).toBe(0.25);

    const out = buildMonolithicConfigObject(config, new Map()) as any;
    const engine = out.engine;
    expect(engine.classes.definitions.bulwark.baseHpMultiplier).toBe(1.362);
    expect(engine.classes.definitions.bulwark.baseManaMultiplier).toBe(0.628);
    expect(engine.mob.tiers.standard.levelAnchors["1"]).toEqual({ hp: 87, minDamage: 8, maxDamage: 10 });
    expect(engine.mob.tiers.standard.levelAnchors["30"].hp).toBe(9258);
    expect(engine.stats.bindings.shieldStat).toBe("WIS");
    expect(engine.stats.bindings.shieldLevelScalingRate).toBe(1.12);
    expect(engine.stats.bindings.xpBonusCap).toBe(0.25);
  });

  it("does not invent the optional keys when the source never set them", () => {
    const config = parseAppConfigYaml(yaml.replace(/ {8}shieldStat:.*\n/, "").replace(/ {8}xpBonusCap:.*\n/, ""));
    const out = buildMonolithicConfigObject(config, new Map()) as any;
    expect("shieldStat" in out.engine.stats.bindings).toBe(false);
    expect("xpBonusCap" in out.engine.stats.bindings).toBe(false);
    expect("levelAnchors" in out.engine.mob.tiers.weak).toBe(false);
  });
});
