import { describe, it, expect } from "vitest";
import { TUNING_PRESETS, CASUAL_PRESET, BALANCED_PRESET, HARDCORE_PRESET } from "@/lib/tuning/presets";
import type { TuningPreset } from "@/lib/tuning/presets";
import { FIELD_METADATA } from "@/lib/tuning/fieldMetadata";
import { TuningSection } from "@/lib/tuning/types";
import { applyTemplate } from "@/lib/templates";
import { validateConfig } from "@/lib/validateConfig";
import { computeMetrics } from "@/lib/tuning/formulas";
import type { AppConfig } from "@/types/config";

// ─── Full Mock Config ───────────────────────────────────────────────
// A complete AppConfig that passes validateConfig with zero errors.
// Used as the base for merging preset overlays.

const FULL_MOCK_CONFIG: AppConfig = {
  server: { telnetPort: 4000, webPort: 8080 },
  admin: { enabled: false, port: 9090, token: "test", basePath: "/admin", grafanaUrl: "" },
  observability: { metricsEnabled: false, metricsEndpoint: "/metrics", metricsHttpPort: 9100 },
  logging: { level: "INFO", packageLevels: {} },
  world: { startRoom: "town:center", resources: [] },
  classStartRooms: {},
  stats: {
    definitions: {
      STR: { id: "STR", displayName: "Strength", abbreviation: "STR", description: "Physical power", baseStat: 10 },
      DEX: { id: "DEX", displayName: "Dexterity", abbreviation: "DEX", description: "Agility", baseStat: 10 },
      CON: { id: "CON", displayName: "Constitution", abbreviation: "CON", description: "Endurance", baseStat: 10 },
      INT: { id: "INT", displayName: "Intelligence", abbreviation: "INT", description: "Magic", baseStat: 10 },
      WIS: { id: "WIS", displayName: "Wisdom", abbreviation: "WIS", description: "Insight", baseStat: 10 },
    },
    bindings: {
      meleeDamageStat: "STR", meleeDamageDivisor: 3,
      dodgeStat: "DEX", dodgePerPoint: 2, maxDodgePercent: 30,
      spellDamageStat: "INT", spellDamageDivisor: 3,
      hpScalingStat: "CON", hpScalingDivisor: 5,
      manaScalingStat: "INT", manaScalingDivisor: 5,
      hpRegenStat: "CON", hpRegenMsPerPoint: 200,
      manaRegenStat: "INT", manaRegenMsPerPoint: 200,
      xpBonusStat: "WIS", xpBonusPerPoint: 1,
    },
  },
  abilities: {},
  statusEffects: {},
  combat: { tickMillis: 2000, minDamage: 1, maxDamage: 150, feedback: { enabled: true, roomBroadcastEnabled: true } },
  mobTiers: {
    weak: { baseHp: 5, hpPerLevel: 2, baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0, baseArmor: 0, baseXpReward: 15, xpRewardPerLevel: 5, baseGoldMin: 1, baseGoldMax: 3, goldPerLevel: 1 },
    standard: { baseHp: 10, hpPerLevel: 4, baseMinDamage: 2, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 1, baseXpReward: 30, xpRewardPerLevel: 10, baseGoldMin: 3, baseGoldMax: 8, goldPerLevel: 2 },
    elite: { baseHp: 25, hpPerLevel: 7, baseMinDamage: 3, baseMaxDamage: 6, damagePerLevel: 1, baseArmor: 2, baseXpReward: 75, xpRewardPerLevel: 25, baseGoldMin: 10, baseGoldMax: 25, goldPerLevel: 5 },
    boss: { baseHp: 50, hpPerLevel: 10, baseMinDamage: 3, baseMaxDamage: 8, damagePerLevel: 2, baseArmor: 3, baseXpReward: 200, xpRewardPerLevel: 50, baseGoldMin: 50, baseGoldMax: 100, goldPerLevel: 15 },
  },
  mobActionDelay: { minActionDelayMillis: 2000, maxActionDelayMillis: 5000 },
  progression: {
    maxLevel: 50,
    xp: { baseXp: 100, exponent: 2.0, linearXp: 0, multiplier: 1.0, defaultKillXp: 10 },
    rewards: { hpPerLevel: 2, manaPerLevel: 1, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 10 },
  },
  economy: { buyMultiplier: 1.0, sellMultiplier: 0.5 },
  regen: {
    maxPlayersPerTick: 10, baseIntervalMillis: 5000, minIntervalMillis: 1000, regenAmount: 1,
    mana: { baseIntervalMillis: 5000, minIntervalMillis: 1000, regenAmount: 1 },
  },
  crafting: { maxSkillLevel: 75, baseXpPerLevel: 100, xpExponent: 1.5, gatherCooldownMs: 3000, stationBonusQuantity: 1 },
  navigation: { recall: { cooldownMs: 60000, messages: { combatBlocked: "", cooldownRemaining: "", castBegin: "", unreachable: "", departNotice: "", arriveNotice: "", arrival: "" } } },
  commands: {},
  group: { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 10 },
  classes: {
    WARRIOR: { displayName: "Warrior", hpPerLevel: 4, manaPerLevel: 1, primaryStat: "STR", description: "A fighter." },
  },
  races: {
    HUMAN: { displayName: "Human", description: "Versatile." },
  },
  characterCreation: { startingGold: 100 },
  equipmentSlots: {
    head: { displayName: "Head", order: 1 },
    chest: { displayName: "Chest", order: 2 },
  },
  genders: { MALE: { displayName: "Male" }, FEMALE: { displayName: "Female" } },
  achievementCategories: { COMBAT: { displayName: "Combat" } },
  achievementCriterionTypes: { KILL_MOB: { displayName: "Kill Mob" } },
  achievementDefs: {},
  questObjectiveTypes: { KILL: { displayName: "Kill" } },
  questCompletionTypes: { TALK: { displayName: "Talk" } },
  statusEffectTypes: { DOT: { displayName: "Damage over Time" } },
  stackBehaviors: { REPLACE: { displayName: "Replace" } },
  abilityTargetTypes: { SINGLE: { displayName: "Single Target" } },
  craftingSkills: { SMITHING: { displayName: "Smithing", type: "CRAFT" } },
  craftingStationTypes: { FORGE: { displayName: "Forge" } },
  housing: { enabled: true, entryExitDirection: "south", templates: {} },
  guild: { founderRank: "LEADER", defaultRank: "MEMBER" },
  guildRanks: { LEADER: { displayName: "Leader", level: 10 }, MEMBER: { displayName: "Member", level: 1 } },
  friends: { maxFriends: 50 },
  images: { baseUrl: "", spriteLevelTiers: [] },
  emotePresets: { presets: [] },
  factions: { defaultReputation: 0, killPenalty: 10, killBonus: 5, definitions: {} },
  enchanting: { maxEnchantmentsPerItem: 3, definitions: {} },
  skillPoints: { interval: 3 },
  multiclass: { minLevel: 15, goldCost: 500 },
  bank: { maxItems: 50 },
  worldTime: { cycleLengthMs: 1800000, dawnHour: 5, dayHour: 7, duskHour: 18, nightHour: 20 },
  weather: { minTransitionMs: 180000, maxTransitionMs: 600000, types: { CLEAR: { displayName: "Clear", weight: 3.0 }, RAIN: { displayName: "Rain", weight: 2.0 } } },
  environment: { defaultTheme: { moteColors: [{ core: "#c8b8e8", glow: "#a897d2" }], skyGradients: {}, transitionColors: [], weatherParticleOverrides: {} }, zones: {} },
  worldEvents: { definitions: {} },
  pets: {},
  prestige: { enabled: true, xpCostBase: 10000, xpCostMultiplier: 1.5, maxRank: 5, perks: {} },
  respec: { goldCost: 100, cooldownMs: 300000 },
  currencies: { definitions: {} },
  lottery: { enabled: true, ticketCost: 25, drawingIntervalMs: 3600000, jackpotBase: 500 },
  gambling: { enabled: true, minBet: 10, maxBet: 1000, winChance: 0.45, winMultiplier: 2.0 },
  autoQuests: { enabled: true, timeLimitMs: 300000, cooldownMs: 300000, rewardScaling: 1.0 },
  dailyQuests: {
    enabled: true,
    resetTimeUtc: "06:00",
    streakBonusPercent: 10,
    dailySlots: 1,
    weeklySlots: 1,
    dailyPool: [{ type: "kill", targetCount: 5, description: "Defeat 5 enemies" }],
    weeklyPool: [{ type: "gather", targetCount: 10, description: "Gather 10 resources" }],
  },
  globalQuests: {
    enabled: true,
    intervalMs: 7200000,
    durationMs: 3600000,
    objectives: [{ type: "kill", targetCount: 25, description: "Defeat 25 enemies" }],
    rewards: {},
  },
  guildHalls: { enabled: true, baseCost: 10000, roomTemplates: {} },
  leaderboard: { refreshIntervalMs: 120000, topN: 10 },
  globalAssets: {},
  rawSections: {},
};

// ─── Helpers ─────────────────────────────────────────────────────────

/** Resolve a dot-path against an object. Returns undefined if any segment is missing. */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object"
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    obj,
  );
}

const ALL_SECTIONS = [
  TuningSection.CombatStats,
  TuningSection.EconomyCrafting,
  TuningSection.ProgressionQuests,
  TuningSection.WorldSocial,
];

// ─── Preset Structure ────────────────────────────────────────────────

describe("preset structure", () => {
  it("TUNING_PRESETS has exactly 6 entries", () => {
    expect(TUNING_PRESETS).toHaveLength(6);
  });

  it("each preset has a valid id", () => {
    const ids = TUNING_PRESETS.map((p: TuningPreset) => p.id);
    expect(ids).toContain("casual");
    expect(ids).toContain("balanced");
    expect(ids).toContain("hardcore");
    expect(ids).toContain("soloStory");
    expect(ids).toContain("pvpArena");
    expect(ids).toContain("loreExplorer");
  });

  it("each preset has a non-empty name", () => {
    for (const preset of TUNING_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it("each preset has a non-empty description", () => {
    for (const preset of TUNING_PRESETS) {
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});

// ─── Section Descriptions ────────────────────────────────────────────

describe("sectionDescriptions", () => {
  for (const preset of TUNING_PRESETS) {
    describe(preset.id, () => {
      for (const section of ALL_SECTIONS) {
        it(`has description for "${section}"`, () => {
          expect(preset.sectionDescriptions[section]).toBeDefined();
          expect(
            (preset.sectionDescriptions[section] as string).length,
          ).toBeGreaterThan(0);
        });
      }
    });
  }
});

// ─── Validation ─────────────────────────────────────────────────────

describe("validation", () => {
  it("FULL_MOCK_CONFIG itself passes validateConfig with zero errors", () => {
    const issues = validateConfig(FULL_MOCK_CONFIG);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors, `Base mock has errors: ${errors.map((e) => e.message).join("; ")}`).toHaveLength(0);
  });

  for (const preset of TUNING_PRESETS) {
    it(`${preset.id} preset produces zero validation errors when merged`, () => {
      const merged = applyTemplate(FULL_MOCK_CONFIG, preset.config);
      const issues = validateConfig(merged);
      const errors = issues.filter((i) => i.severity === "error");
      expect(
        errors,
        `${preset.id} merged config has errors: ${errors.map((e) => `[${e.entity}] ${e.message}`).join("; ")}`,
      ).toHaveLength(0);
    });
  }
});

// ─── Field Coverage ──────────────────────────────────────────────────

describe("field coverage", () => {
  const allPaths = Object.keys(FIELD_METADATA);

  it("FIELD_METADATA has 136 entries (sanity check)", () => {
    expect(allPaths).toHaveLength(136);
  });

  for (const preset of TUNING_PRESETS) {
    describe(preset.id, () => {
      for (const path of allPaths) {
        it(`covers field: ${path}`, () => {
          const value = getNestedValue(
            preset.config as Record<string, unknown>,
            path,
          );
          expect(value, `${preset.id} missing field: ${path}`).not.toBeUndefined();
        });
      }
    });
  }
});

// ─── Metric Differentiation ─────────────────────────────────────────

describe("metric differentiation", () => {
  const casualMerged = applyTemplate(FULL_MOCK_CONFIG, CASUAL_PRESET.config);
  const balancedMerged = applyTemplate(FULL_MOCK_CONFIG, BALANCED_PRESET.config);
  const hardcoreMerged = applyTemplate(FULL_MOCK_CONFIG, HARDCORE_PRESET.config);
  const casualMetrics = computeMetrics(casualMerged);
  const balancedMetrics = computeMetrics(balancedMerged);
  const hardcoreMetrics = computeMetrics(hardcoreMerged);

  // ─── XP ordering ────────────────────────────────────────────────
  describe("XP requirements (Casual < Balanced < Hardcore)", () => {
    for (const level of [20, 50] as const) {
      it(`level ${level}: Casual < Balanced < Hardcore`, () => {
        expect(casualMetrics.xpPerLevel[level]).toBeLessThan(balancedMetrics.xpPerLevel[level]!);
        expect(balancedMetrics.xpPerLevel[level]).toBeLessThan(hardcoreMetrics.xpPerLevel[level]!);
      });
    }
  });

  // ─── Mob HP ordering ────────────────────────────────────────────
  describe("Mob HP (Casual < Balanced < Hardcore, standard tier)", () => {
    for (const level of [20, 50] as const) {
      it(`level ${level}: Casual < Balanced < Hardcore`, () => {
        expect(casualMetrics.mobHp["standard"]![level]).toBeLessThan(balancedMetrics.mobHp["standard"]![level]!);
        expect(balancedMetrics.mobHp["standard"]![level]).toBeLessThan(hardcoreMetrics.mobHp["standard"]![level]!);
      });
    }
  });

  // ─── Mob damage ordering ────────────────────────────────────────
  describe("Mob damage (Casual < Balanced < Hardcore, standard tier)", () => {
    for (const level of [20, 50] as const) {
      it(`level ${level}: Casual < Balanced < Hardcore`, () => {
        expect(casualMetrics.mobDamageAvg["standard"]![level]).toBeLessThan(balancedMetrics.mobDamageAvg["standard"]![level]!);
        expect(balancedMetrics.mobDamageAvg["standard"]![level]).toBeLessThan(hardcoreMetrics.mobDamageAvg["standard"]![level]!);
      });
    }
  });

  // ─── Mob gold ordering (reversed -- Casual > Balanced > Hardcore)
  describe("Mob gold (Casual > Balanced > Hardcore, standard tier)", () => {
    for (const level of [20, 50] as const) {
      it(`level ${level}: Casual > Balanced > Hardcore`, () => {
        expect(casualMetrics.mobGoldAvg["standard"]![level]).toBeGreaterThan(balancedMetrics.mobGoldAvg["standard"]![level]!);
        expect(balancedMetrics.mobGoldAvg["standard"]![level]).toBeGreaterThan(hardcoreMetrics.mobGoldAvg["standard"]![level]!);
      });
    }
  });

  // ─── Regen ordering ─────────────────────────────────────────────
  it("Casual regen faster than Hardcore (lower ms = faster)", () => {
    expect(casualMetrics.regenInterval[10]).toBeLessThan(hardcoreMetrics.regenInterval[10]!);
  });

  // ─── Meaningful spread tests ────────────────────────────────────
  describe("meaningful spread", () => {
    it("XP at level 30: Hardcore >= 2x Casual", () => {
      expect(hardcoreMetrics.xpPerLevel[30]).toBeGreaterThanOrEqual(
        2 * casualMetrics.xpPerLevel[30]!,
      );
    });

    it("Mob HP at level 20 (standard): Hardcore >= 1.4x Casual", () => {
      expect(hardcoreMetrics.mobHp["standard"]![20]).toBeGreaterThanOrEqual(
        casualMetrics.mobHp["standard"]![20]! * 1.4,
      );
    });
  });
});
