import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildMonolithicConfigObject } from "../exportMud";
import { parseAppConfigYaml } from "../loader";
import type { AppConfig } from "@/types/config";

const BASE_CONFIG: AppConfig = {
  server: { telnetPort: 4000, webPort: 8080 },
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
      meleeDamageDivisor: 3,
      dodgeStat: "DEX",
      dodgePerPoint: 2,
      maxDodgePercent: 30,
      spellDamageStat: "INT",
      spellDamageDivisor: 3,
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
    minDamage: 1,
    maxDamage: 4,
    feedback: { enabled: false, roomBroadcastEnabled: false },
  },
  mobTiers: {
    weak: { baseHp: 10, hpPerLevel: 3, baseMinDamage: 1, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 0, baseXpReward: 30, xpRewardPerLevel: 10, baseGoldMin: 0, baseGoldMax: 0, goldPerLevel: 0 },
    standard: { baseHp: 20, hpPerLevel: 5, baseMinDamage: 2, baseMaxDamage: 6, damagePerLevel: 1, baseArmor: 0, baseXpReward: 50, xpRewardPerLevel: 15, baseGoldMin: 0, baseGoldMax: 0, goldPerLevel: 0 },
    elite: { baseHp: 40, hpPerLevel: 8, baseMinDamage: 4, baseMaxDamage: 10, damagePerLevel: 2, baseArmor: 2, baseXpReward: 100, xpRewardPerLevel: 25, baseGoldMin: 0, baseGoldMax: 0, goldPerLevel: 0 },
    boss: { baseHp: 100, hpPerLevel: 15, baseMinDamage: 8, baseMaxDamage: 20, damagePerLevel: 3, baseArmor: 5, baseXpReward: 300, xpRewardPerLevel: 50, baseGoldMin: 0, baseGoldMax: 0, goldPerLevel: 0 },
  },
  progression: {
    maxLevel: 50,
    xp: { baseXp: 100, exponent: 2, linearXp: 0, multiplier: 1, defaultKillXp: 50 },
    rewards: { hpPerLevel: 2, manaPerLevel: 5, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 20 },
  },
  economy: { buyMultiplier: 1.0, sellMultiplier: 0.5 },
  regen: {
    maxPlayersPerTick: 50,
    baseIntervalMillis: 5000,
    minIntervalMillis: 1000,
    regenAmount: 1,
    mana: { baseIntervalMillis: 3000, minIntervalMillis: 1000, regenAmount: 1 },
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
  weather: { minTransitionMs: 300000, maxTransitionMs: 900000 },
  worldEvents: { definitions: {} },
  pets: {},
  guild: { founderRank: "leader", defaultRank: "member" },
  guildRanks: {},
  friends: { maxFriends: 50 },
  mobActionDelay: { minActionDelayMillis: 8000, maxActionDelayMillis: 20000 },
  images: { baseUrl: "https://assets.ambon.dev", spriteLevelTiers: [50, 40, 30, 20, 10, 1] },
  globalAssets: {},
  skillPoints: {
    interval: 5,
  },
  multiclass: {
    minLevel: 10,
    goldCost: 500,
  },
  admin: {
    enabled: false,
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
  rawSections: {},
};

describe("buildMonolithicConfigObject", () => {
  it("emits explicit runtime defaults and normalizes split room ids", () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      classStartRooms: { BULWARK: "training_grounds" },
      abilities: {
        shield_bash: {
          displayName: "Shield Bash",
          manaCost: 5,
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
    expect(runtime.engine.classStartRooms.BULWARK).toBe("tutorial_glade:training_grounds");
    expect(runtime.engine.statusEffects.definitions.fortress_stance.effectType).toBe("stat_buff");
    expect(runtime.engine.abilities.definitions.shield_bash.image).toBe("shield_bash.png");
    expect(runtime.engine.achievementCategories.categories.combat.displayName).toBe("Combat");
    expect(runtime.engine.questObjectiveTypes.types.kill.displayName).toBe("Kill");
    expect(runtime.images.globalAssets).toEqual({});
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
    rewards: { hpPerLevel: 2, manaPerLevel: 5, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 20 }
  images:
    baseUrl: https://assets.ambon.dev/
    spriteLevelTiers: [50, 40, 30, 20, 10, 1]
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
});
