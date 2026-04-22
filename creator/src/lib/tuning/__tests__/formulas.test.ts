import { describe, it, expect } from "vitest";
import {
  xpForLevel,
  mobHpAtLevel,
  mobAvgDamageAtLevel,
  mobAvgGoldAtLevel,
  statBonus,
  dodgeChance,
  playerHpAtLevel,
  regenIntervalMs,
  computeMetrics,
} from "@/lib/tuning/formulas";
import { REPRESENTATIVE_LEVELS } from "@/lib/tuning/types";

// ─── Server-side Kotlin default values from AppConfig ─────────────

const DEFAULT_XP = { baseXp: 100, exponent: 2.0, linearXp: 0, multiplier: 1.0 };

const WEAK_TIER = {
  baseHp: 5, hpPerLevel: 2,
  baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0,
  baseArmor: 0, baseXpReward: 15, xpRewardPerLevel: 5,
  baseGoldMin: 1, baseGoldMax: 3, goldPerLevel: 1,
};

const BOSS_TIER = {
  baseHp: 50, hpPerLevel: 10,
  baseMinDamage: 3, baseMaxDamage: 8, damagePerLevel: 2,
  baseArmor: 3, baseXpReward: 200, xpRewardPerLevel: 50,
  baseGoldMin: 50, baseGoldMax: 100, goldPerLevel: 15,
};

// ─── XP curve ──────────────────────────────────────────────────────

describe("xpForLevel", () => {
  it("returns 0 at level 1", () => {
    expect(xpForLevel(1, DEFAULT_XP)).toBe(0);
  });

  it("uses level-1 steps at level 10", () => {
    expect(xpForLevel(10, DEFAULT_XP)).toBe(8100);
  });

  it("uses level-1 steps at level 50", () => {
    expect(xpForLevel(50, DEFAULT_XP)).toBe(240100);
  });
});

// ─── Mob HP ────────────────────────────────────────────────────────

describe("mobHpAtLevel", () => {
  it("computes weak tier HP at level 10", () => {
    expect(mobHpAtLevel(WEAK_TIER, 10)).toBe(23);
  });

  it("computes boss tier HP at level 10", () => {
    expect(mobHpAtLevel(BOSS_TIER, 10)).toBe(140);
  });
});

// ─── Mob damage ────────────────────────────────────────────────────

describe("mobAvgDamageAtLevel", () => {
  it("computes weak tier avg damage at level 10 (no scaling)", () => {
    expect(mobAvgDamageAtLevel(WEAK_TIER, 10)).toBe(1.5);
  });

  it("computes boss tier avg damage at level 10 (with scaling)", () => {
    expect(mobAvgDamageAtLevel(BOSS_TIER, 10)).toBe(23.5);
  });
});

// ─── Mob gold ──────────────────────────────────────────────────────

describe("mobAvgGoldAtLevel", () => {
  it("computes weak tier avg gold at level 10", () => {
    expect(mobAvgGoldAtLevel(WEAK_TIER, 10)).toBe(11);
  });
});

// ─── Stat bonus ────────────────────────────────────────────────────

describe("statBonus", () => {
  it("counts only points above the base stat", () => {
    expect(statBonus(15, 3)).toBe(1);
  });

  it("returns 0 when the stat is at baseline", () => {
    expect(statBonus(10, 5)).toBe(0);
  });
});

// ─── Dodge chance ──────────────────────────────────────────────────

describe("dodgeChance", () => {
  it("caps at maxDodgePercent", () => {
    expect(dodgeChance(30, { dodgePerPoint: 2, maxDodgePercent: 30 })).toBe(30);
  });

  it("returns uncapped value when below max", () => {
    expect(dodgeChance(20, { dodgePerPoint: 2, maxDodgePercent: 30 })).toBe(20);
  });
});

// ─── Player HP ─────────────────────────────────────────────────────

describe("playerHpAtLevel", () => {
  it("computes player HP at level 10", () => {
    // baseHp=10, perLevel=4, level steps=9, statBonus(12, 5)=0
    // 10 + 9*4 = 46
    expect(playerHpAtLevel(10, { baseHp: 10, hpPerLevel: 2 }, 4, 12, 5)).toBe(46);
  });
});

// ─── Regen interval ────────────────────────────────────────────────

describe("regenIntervalMs", () => {
  it("reduces interval based on stat", () => {
    // Only points above the base stat accelerate regen.
    expect(regenIntervalMs(15, { baseIntervalMillis: 5000, minIntervalMillis: 1000 }, 200)).toBe(4000);
  });

  it("clamps to min interval", () => {
    // 5000 - 200*30 = -1000, clamped to 1000
    expect(regenIntervalMs(30, { baseIntervalMillis: 5000, minIntervalMillis: 1000 }, 200)).toBe(1000);
  });
});

// ─── computeMetrics ────────────────────────────────────────────────

describe("computeMetrics", () => {
  // Minimal mock config with only the fields computeMetrics needs
  const mockConfig = {
    progression: {
      maxLevel: 50,
      xp: { baseXp: 100, exponent: 2.0, linearXp: 0, multiplier: 1.0, defaultKillXp: 10 },
      rewards: { hpPerLevel: 2, manaPerLevel: 1, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 10 },
    },
    mobTiers: {
      weak: WEAK_TIER,
      standard: { baseHp: 10, hpPerLevel: 4, baseMinDamage: 2, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 1, baseXpReward: 30, xpRewardPerLevel: 10, baseGoldMin: 3, baseGoldMax: 8, goldPerLevel: 2 },
      elite: { baseHp: 25, hpPerLevel: 7, baseMinDamage: 3, baseMaxDamage: 6, damagePerLevel: 1, baseArmor: 2, baseXpReward: 75, xpRewardPerLevel: 25, baseGoldMin: 10, baseGoldMax: 25, goldPerLevel: 5 },
      boss: BOSS_TIER,
    },
    stats: {
      definitions: {},
      bindings: {
        meleeDamageStat: "str", meleeDamageDivisor: 3,
        dodgeStat: "dex", dodgePerPoint: 2, maxDodgePercent: 30,
        spellDamageStat: "int", spellDamageDivisor: 3,
        hpScalingStat: "con", hpScalingDivisor: 5,
        manaScalingStat: "int", manaScalingDivisor: 5,
        hpRegenStat: "con", hpRegenMsPerPoint: 200,
        manaRegenStat: "int", manaRegenMsPerPoint: 200,
        xpBonusStat: "wis", xpBonusPerPoint: 1,
      },
    },
    regen: {
      maxPlayersPerTick: 10,
      baseIntervalMillis: 5000,
      minIntervalMillis: 1000,
      regenAmount: 1,
      mana: { baseIntervalMillis: 5000, minIntervalMillis: 1000, regenAmount: 1 },
    },
  } as unknown;

  it("returns MetricSnapshot with all keys", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = computeMetrics(mockConfig as any);
    expect(result).toHaveProperty("xpPerLevel");
    expect(result).toHaveProperty("mobHp");
    expect(result).toHaveProperty("mobDamageAvg");
    expect(result).toHaveProperty("mobGoldAvg");
    expect(result).toHaveProperty("playerDamageBonus");
    expect(result).toHaveProperty("playerHp");
    expect(result).toHaveProperty("dodgeChance");
    expect(result).toHaveProperty("regenInterval");
  });

  it("has entries for all representative levels", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = computeMetrics(mockConfig as any);
    for (const level of REPRESENTATIVE_LEVELS) {
      expect(result.xpPerLevel).toHaveProperty(String(level));
      expect(result.playerHp).toHaveProperty(String(level));
    }
  });

  it("computes correct XP at level 10", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = computeMetrics(mockConfig as any);
    expect(result.xpPerLevel[10]).toBe(8100);
  });

  it("computes correct weak mob HP at level 10", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = computeMetrics(mockConfig as any);
    expect(result.mobHp["weak"]?.[10]).toBe(23);
  });
});
