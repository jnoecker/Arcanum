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

// Rates chosen so L10 expectations align with the multiplicative formula:
//   floor(base × rate^(level-1))
// WEAK: baseHp=5, hp at L10 = floor(5 × 1.18^9) = floor(23.2) = 23
//       baseXp=15, xp at L10 = floor(15 × 1.13^9) = floor(45.3) = 45 (unused in this test file)
//       baseGoldMin=1 → 1 × 1.13^9 = floor(3.02) = 3
//       baseGoldMax=3 → 3 × 1.13^9 = floor(9.06) = 9 — avg = (3+9)/2 = 6
//       baseMinDmg=1, baseMaxDmg=2, rate=1.0 → no scaling, avg = 1.5
const WEAK_TIER = {
  baseHp: 5, hpScalingRate: 1.18,
  baseMinDamage: 1, baseMaxDamage: 2, damageScalingRate: 1.0,
  baseArmor: 0, baseXpReward: 15, xpScalingRate: 1.13,
  baseGoldMin: 1, baseGoldMax: 3, goldScalingRate: 1.13,
};

// BOSS: baseHp=50, hp at L10 = floor(50 × 1.118^9) = floor(130.4) ≈ 130 (close to old 140)
//       baseMaxDmg=8, rate=1.135 → floor(8 × 1.135^9) = floor(25.5) = 25
//       baseMinDmg=3, rate=1.135 → floor(3 × 1.135^9) = floor(9.56) = 9 — avg = (9+25)/2 = 17
const BOSS_TIER = {
  baseHp: 50, hpScalingRate: 1.118,
  baseMinDamage: 3, baseMaxDamage: 8, damageScalingRate: 1.135,
  baseArmor: 3, baseXpReward: 200, xpScalingRate: 1.15,
  baseGoldMin: 50, baseGoldMax: 100, goldScalingRate: 1.07,
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
    expect(mobHpAtLevel(WEAK_TIER, 10)).toBe(22);
  });

  it("computes boss tier HP at level 10", () => {
    expect(mobHpAtLevel(BOSS_TIER, 10)).toBe(136);
  });
});

// ─── Mob damage ────────────────────────────────────────────────────

describe("mobAvgDamageAtLevel", () => {
  it("computes weak tier avg damage at level 10 (no scaling)", () => {
    expect(mobAvgDamageAtLevel(WEAK_TIER, 10)).toBe(1.5);
  });

  it("computes boss tier avg damage at level 10 (with scaling)", () => {
    expect(mobAvgDamageAtLevel(BOSS_TIER, 10)).toBe(17);
  });
});

// ─── Mob gold ──────────────────────────────────────────────────────

describe("mobAvgGoldAtLevel", () => {
  it("computes weak tier avg gold at level 10", () => {
    expect(mobAvgGoldAtLevel(WEAK_TIER, 10)).toBe(6);
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
    // baseHp=10, hpScalingRate=1.18, level steps=9, statBonus(12, 5)=0
    // floor(10 × 1.18^9) = 44
    expect(playerHpAtLevel(10, { baseHp: 10 }, 1.18, 12, 5)).toBe(44);
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
      rewards: { hpScalingRate: 1.1, manaScalingRate: 1.1, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 10 },
    },
    mobTiers: {
      weak: WEAK_TIER,
      standard: { baseHp: 10, hpScalingRate: 1.16, baseMinDamage: 2, baseMaxDamage: 4, damageScalingRate: 1.1, baseArmor: 1, baseXpReward: 30, xpScalingRate: 1.15, baseGoldMin: 3, baseGoldMax: 8, goldScalingRate: 1.1 },
      elite: { baseHp: 25, hpScalingRate: 1.14, baseMinDamage: 3, baseMaxDamage: 6, damageScalingRate: 1.1, baseArmor: 2, baseXpReward: 75, xpScalingRate: 1.15, baseGoldMin: 10, baseGoldMax: 25, goldScalingRate: 1.1 },
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
    // baseHp=5, hpScalingRate=1.18, floor(5 × 1.18^9) = 22
    expect(result.mobHp["weak"]?.[10]).toBe(22);
  });
});
