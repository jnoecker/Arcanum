import { describe, it, expect } from "vitest";
import {
  buildXpCurveData,
  buildMobTierData,
  buildStatRadarData,
} from "@/lib/tuning/chartData";
import { CHART_COLORS } from "@/lib/tuning/chartColors";
import { xpForLevel, mobHpAtLevel, mobAvgDamageAtLevel } from "@/lib/tuning/formulas";
import type { AppConfig } from "@/types/config";
import type { StatBindings } from "@/types/config";

// ─── Shared Fixtures ──────────────────────────────────────────────

const MOCK_XP = { baseXp: 100, exponent: 2.0, linearXp: 0, multiplier: 1.0, defaultKillXp: 10 };

const WEAK_TIER = {
  baseHp: 5, hpPerLevel: 2,
  baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0,
  baseArmor: 0, baseXpReward: 15, xpRewardPerLevel: 5,
  baseGoldMin: 1, baseGoldMax: 3, goldPerLevel: 1,
};

const STANDARD_TIER = {
  baseHp: 10, hpPerLevel: 4,
  baseMinDamage: 2, baseMaxDamage: 4, damagePerLevel: 1,
  baseArmor: 1, baseXpReward: 30, xpRewardPerLevel: 10,
  baseGoldMin: 3, baseGoldMax: 8, goldPerLevel: 2,
};

const ELITE_TIER = {
  baseHp: 25, hpPerLevel: 7,
  baseMinDamage: 3, baseMaxDamage: 6, damagePerLevel: 1,
  baseArmor: 2, baseXpReward: 75, xpRewardPerLevel: 25,
  baseGoldMin: 10, baseGoldMax: 25, goldPerLevel: 5,
};

const BOSS_TIER = {
  baseHp: 50, hpPerLevel: 10,
  baseMinDamage: 3, baseMaxDamage: 8, damagePerLevel: 2,
  baseArmor: 3, baseXpReward: 200, xpRewardPerLevel: 50,
  baseGoldMin: 50, baseGoldMax: 100, goldPerLevel: 15,
};

const MOCK_BINDINGS: StatBindings = {
  meleeDamageStat: "str", meleeDamageDivisor: 4,
  dodgeStat: "dex", dodgePerPoint: 2.5, maxDodgePercent: 30,
  spellDamageStat: "int", spellDamageDivisor: 3,
  hpScalingStat: "con", hpScalingDivisor: 5,
  manaScalingStat: "int", manaScalingDivisor: 6,
  hpRegenStat: "con", hpRegenMsPerPoint: 200,
  manaRegenStat: "int", manaRegenMsPerPoint: 150,
  xpBonusStat: "wis", xpBonusPerPoint: 1.5,
};

const MOCK_CONFIG = {
  progression: {
    maxLevel: 50,
    xp: MOCK_XP,
    rewards: { hpPerLevel: 2, manaPerLevel: 1, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 10 },
  },
  mobTiers: {
    weak: WEAK_TIER,
    standard: STANDARD_TIER,
    elite: ELITE_TIER,
    boss: BOSS_TIER,
  },
  stats: {
    definitions: {},
    bindings: MOCK_BINDINGS,
  },
  regen: {
    maxPlayersPerTick: 10,
    baseIntervalMillis: 5000,
    minIntervalMillis: 1000,
    regenAmount: 1,
    mana: { baseIntervalMillis: 5000, minIntervalMillis: 1000, regenAmount: 1 },
  },
} as unknown as AppConfig;

// ─── buildXpCurveData ─────────────────────────────────────────────

describe("buildXpCurveData", () => {
  it("returns exactly 50 items", () => {
    const data = buildXpCurveData(MOCK_CONFIG, MOCK_CONFIG);
    expect(data).toHaveLength(50);
  });

  it("first item has level=1, last has level=50", () => {
    const data = buildXpCurveData(MOCK_CONFIG, MOCK_CONFIG);
    expect(data[0]!.level).toBe(1);
    expect(data[49]!.level).toBe(50);
  });

  it("values match xpForLevel for spot-checked levels", () => {
    const data = buildXpCurveData(MOCK_CONFIG, MOCK_CONFIG);
    for (const level of [1, 25, 50]) {
      const point = data[level - 1]!;
      const expected = xpForLevel(level, MOCK_XP);
      expect(point.current).toBe(expected);
      expect(point.preset).toBe(expected);
    }
  });

  it("with identical configs, current === preset at every level", () => {
    const data = buildXpCurveData(MOCK_CONFIG, MOCK_CONFIG);
    for (const point of data) {
      expect(point.current).toBe(point.preset);
    }
  });
});

// ─── buildMobTierData ─────────────────────────────────────────────

describe("buildMobTierData", () => {
  it("returns exactly 4 items", () => {
    const data = buildMobTierData(MOCK_CONFIG, 30);
    expect(data).toHaveLength(4);
  });

  it("tier labels are Weak, Standard, Elite, Boss in order", () => {
    const data = buildMobTierData(MOCK_CONFIG, 30);
    expect(data.map((d) => d.tier)).toEqual(["Weak", "Standard", "Elite", "Boss"]);
  });

  it("raw HP at level 30 matches mobHpAtLevel for each tier", () => {
    const data = buildMobTierData(MOCK_CONFIG, 30);
    expect(data[0]!.rawHp).toBe(mobHpAtLevel(WEAK_TIER, 30));
    expect(data[1]!.rawHp).toBe(mobHpAtLevel(STANDARD_TIER, 30));
    expect(data[2]!.rawHp).toBe(mobHpAtLevel(ELITE_TIER, 30));
    expect(data[3]!.rawHp).toBe(mobHpAtLevel(BOSS_TIER, 30));
  });

  it("raw damage at level 30 matches mobAvgDamageAtLevel for each tier", () => {
    const data = buildMobTierData(MOCK_CONFIG, 30);
    expect(data[0]!.rawDamage).toBe(mobAvgDamageAtLevel(WEAK_TIER, 30));
    expect(data[1]!.rawDamage).toBe(mobAvgDamageAtLevel(STANDARD_TIER, 30));
    expect(data[2]!.rawDamage).toBe(mobAvgDamageAtLevel(ELITE_TIER, 30));
    expect(data[3]!.rawDamage).toBe(mobAvgDamageAtLevel(BOSS_TIER, 30));
  });

  it("raw armor equals tier.baseArmor (not level-dependent)", () => {
    const data = buildMobTierData(MOCK_CONFIG, 30);
    expect(data[0]!.rawArmor).toBe(WEAK_TIER.baseArmor);
    expect(data[1]!.rawArmor).toBe(STANDARD_TIER.baseArmor);
    expect(data[2]!.rawArmor).toBe(ELITE_TIER.baseArmor);
    expect(data[3]!.rawArmor).toBe(BOSS_TIER.baseArmor);
  });

  it("raw xp equals baseXpReward + xpRewardPerLevel * level", () => {
    const level = 30;
    const data = buildMobTierData(MOCK_CONFIG, level);
    expect(data[0]!.rawXp).toBe(WEAK_TIER.baseXpReward + WEAK_TIER.xpRewardPerLevel * level);
    expect(data[3]!.rawXp).toBe(BOSS_TIER.baseXpReward + BOSS_TIER.xpRewardPerLevel * level);
  });

  it("normalized values are percentages (0-100) with boss tier at 100", () => {
    const data = buildMobTierData(MOCK_CONFIG, 30);
    expect(data[3]!.hp).toBe(100);
    expect(data[3]!.damage).toBe(100);
    expect(data[3]!.armor).toBe(100);
    expect(data[3]!.xp).toBe(100);
    for (const point of data) {
      expect(point.hp).toBeGreaterThanOrEqual(0);
      expect(point.hp).toBeLessThanOrEqual(100);
    }
  });

  it("different level produces different raw HP values", () => {
    const data10 = buildMobTierData(MOCK_CONFIG, 10);
    const data50 = buildMobTierData(MOCK_CONFIG, 50);
    expect(data10[0]!.rawHp).not.toBe(data50[0]!.rawHp);
    expect(data10[3]!.rawHp).not.toBe(data50[3]!.rawHp);
  });
});

// ─── buildStatRadarData ───────────────────────────────────────────

describe("buildStatRadarData", () => {
  it("returns exactly 8 items", () => {
    const data = buildStatRadarData(MOCK_BINDINGS, MOCK_BINDINGS);
    expect(data).toHaveLength(8);
  });

  it("labels match expected order", () => {
    const data = buildStatRadarData(MOCK_BINDINGS, MOCK_BINDINGS);
    expect(data.map((d) => d.stat)).toEqual([
      "Melee Dmg", "Spell Dmg", "HP Scaling", "Mana Scaling",
      "Dodge", "HP Regen", "Mana Regen", "XP Bonus",
    ]);
  });

  it("divisor fields are inverted (1/divisor)", () => {
    const data = buildStatRadarData(MOCK_BINDINGS, MOCK_BINDINGS);
    // meleeDamageDivisor=4, so result should be 0.25
    expect(data[0]!.current).toBe(1 / 4);
    // spellDamageDivisor=3, so result should be 1/3
    expect(data[1]!.current).toBeCloseTo(1 / 3);
    // hpScalingDivisor=5
    expect(data[2]!.current).toBe(1 / 5);
    // manaScalingDivisor=6
    expect(data[3]!.current).toBeCloseTo(1 / 6);
  });

  it("direct fields are used as-is", () => {
    const data = buildStatRadarData(MOCK_BINDINGS, MOCK_BINDINGS);
    // dodgePerPoint=2.5
    expect(data[4]!.current).toBe(2.5);
    // hpRegenMsPerPoint=200
    expect(data[5]!.current).toBe(200);
    // manaRegenMsPerPoint=150
    expect(data[6]!.current).toBe(150);
    // xpBonusPerPoint=1.5
    expect(data[7]!.current).toBe(1.5);
  });

  it("with identical bindings, current === preset for all entries", () => {
    const data = buildStatRadarData(MOCK_BINDINGS, MOCK_BINDINGS);
    for (const point of data) {
      expect(point.current).toBe(point.preset);
    }
  });
});

// ─── CHART_COLORS ─────────────────────────────────────────────────

describe("CHART_COLORS", () => {
  it("currentSeries is #dccbb3", () => {
    expect(CHART_COLORS.currentSeries).toBe("#dccbb3");
  });

  it("presetSeries is #ff7d00", () => {
    expect(CHART_COLORS.presetSeries).toBe("#ff7d00");
  });

  it("has all 9 color keys", () => {
    expect(Object.keys(CHART_COLORS)).toHaveLength(9);
    expect(CHART_COLORS).toHaveProperty("grid");
    expect(CHART_COLORS).toHaveProperty("axisText");
    expect(CHART_COLORS).toHaveProperty("axisLine");
    expect(CHART_COLORS).toHaveProperty("barHp");
    expect(CHART_COLORS).toHaveProperty("barDamage");
    expect(CHART_COLORS).toHaveProperty("barArmor");
    expect(CHART_COLORS).toHaveProperty("barXp");
  });
});
