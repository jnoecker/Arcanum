import { describe, it, expect } from "vitest";
import { resolveMobStats } from "../resolveMobStats";
import type { MobFile } from "@/types/world";
import type { MobTiersConfig } from "@/types/config";

const MOB_TIERS: MobTiersConfig = {
  weak: {
    baseHp: 10,
    hpPerLevel: 2,
    baseMinDamage: 1,
    baseMaxDamage: 2,
    damagePerLevel: 1,
    baseArmor: 0,
    baseXpReward: 15,
    xpRewardPerLevel: 5,
    baseGoldMin: 1,
    baseGoldMax: 3,
    goldPerLevel: 1,
  },
  standard: {
    baseHp: 20,
    hpPerLevel: 5,
    baseMinDamage: 2,
    baseMaxDamage: 4,
    damagePerLevel: 2,
    baseArmor: 1,
    baseXpReward: 30,
    xpRewardPerLevel: 10,
    baseGoldMin: 3,
    baseGoldMax: 8,
    goldPerLevel: 2,
  },
  elite: {
    baseHp: 50,
    hpPerLevel: 10,
    baseMinDamage: 5,
    baseMaxDamage: 10,
    damagePerLevel: 3,
    baseArmor: 2,
    baseXpReward: 75,
    xpRewardPerLevel: 25,
    baseGoldMin: 10,
    baseGoldMax: 25,
    goldPerLevel: 5,
  },
  boss: {
    baseHp: 200,
    hpPerLevel: 30,
    baseMinDamage: 10,
    baseMaxDamage: 20,
    damagePerLevel: 5,
    baseArmor: 4,
    baseXpReward: 200,
    xpRewardPerLevel: 50,
    baseGoldMin: 50,
    baseGoldMax: 150,
    goldPerLevel: 20,
  },
};

function mob(overrides: Partial<MobFile> = {}): MobFile {
  return { name: "Test", spawns: [{ room: "r1" }], tier: "standard", level: 1, ...overrides };
}

describe("resolveMobStats", () => {
  it("returns undefined when the tier lookup fails", () => {
    expect(resolveMobStats(mob(), undefined)).toBeUndefined();
    expect(resolveMobStats(mob({ tier: "mythic" }), MOB_TIERS)).toBeUndefined();
  });

  it("computes tier defaults at level 1", () => {
    const stats = resolveMobStats(mob({ tier: "standard", level: 1 }), MOB_TIERS)!;
    expect(stats.hp.tierDefault).toBe(20);
    expect(stats.hp.effective).toBe(20);
    expect(stats.hp.overridden).toBe(false);
    expect(stats.minDamage.tierDefault).toBe(2);
    expect(stats.maxDamage.tierDefault).toBe(4);
    expect(stats.armor.tierDefault).toBe(1);
    expect(stats.xpReward.tierDefault).toBe(30);
    expect(stats.goldMin.tierDefault).toBe(3);
    expect(stats.goldMax.tierDefault).toBe(8);
    expect(stats.anyOverridden).toBe(false);
  });

  it("applies perLevel growth via levelSteps (level-1)", () => {
    const stats = resolveMobStats(mob({ tier: "elite", level: 5 }), MOB_TIERS)!;
    // level 5 -> 4 steps above base
    expect(stats.hp.tierDefault).toBe(50 + 10 * 4);
    expect(stats.xpReward.tierDefault).toBe(75 + 25 * 4);
    expect(stats.minDamage.tierDefault).toBe(5 + 3 * 4);
  });

  it("marks authored values as overrides without changing tierDefault", () => {
    const stats = resolveMobStats(mob({ tier: "standard", level: 10, hp: 500, xpReward: 9 }), MOB_TIERS)!;
    expect(stats.hp.overridden).toBe(true);
    expect(stats.hp.effective).toBe(500);
    expect(stats.hp.tierDefault).toBe(20 + 5 * 9);
    expect(stats.xpReward.overridden).toBe(true);
    expect(stats.xpReward.effective).toBe(9);
    expect(stats.xpReward.tierDefault).toBe(30 + 10 * 9);
    expect(stats.anyOverridden).toBe(true);
    expect(stats.minDamage.overridden).toBe(false);
  });

  it("defaults level to 1 when missing", () => {
    const stats = resolveMobStats(mob({ tier: "weak", level: undefined }), MOB_TIERS)!;
    expect(stats.hp.tierDefault).toBe(10);
  });

  it("defaults tier to standard when missing", () => {
    const stats = resolveMobStats(mob({ tier: undefined, level: 1 }), MOB_TIERS)!;
    expect(stats.hp.tierDefault).toBe(20);
  });

  it("hpMult scales tier-derived hp at level 5", () => {
    const stats = resolveMobStats(
      mob({ tier: "standard", level: 5, hpMult: 1.5 }),
      MOB_TIERS,
    )!;
    // baseline at level 5 = 20 + 5*4 = 40, * 1.5 = 60
    expect(stats.hp.tierDefault).toBe(60);
    expect(stats.hp.effective).toBe(60);
    expect(stats.hp.overridden).toBe(false);
  });

  it("dmgMult scales both min and max damage", () => {
    const stats = resolveMobStats(
      mob({ tier: "standard", level: 5, dmgMult: 2 }),
      MOB_TIERS,
    )!;
    // min at level 5 = 2 + 2*4 = 10, * 2 = 20
    expect(stats.minDamage.tierDefault).toBe(20);
    // max at level 5 = 4 + 2*4 = 12, * 2 = 24
    expect(stats.maxDamage.tierDefault).toBe(24);
  });

  it("xpMult and goldMult scale rewards", () => {
    const stats = resolveMobStats(
      mob({ tier: "standard", level: 3, xpMult: 2.5, goldMult: 0.5 }),
      MOB_TIERS,
    )!;
    // xp at level 3 = 30 + 10*2 = 50, * 2.5 = 125
    expect(stats.xpReward.tierDefault).toBe(125);
    // goldMin at level 3 = 3 + 2*2 = 7, * 0.5 = 3.5 -> 4
    expect(stats.goldMin.tierDefault).toBe(4);
    // goldMax at level 3 = 8 + 2*2 = 12, * 0.5 = 6
    expect(stats.goldMax.tierDefault).toBe(6);
  });

  it("absolute override beats multiplier", () => {
    const stats = resolveMobStats(
      mob({ tier: "standard", level: 1, hp: 100, hpMult: 5 }),
      MOB_TIERS,
    )!;
    expect(stats.hp.overridden).toBe(true);
    expect(stats.hp.effective).toBe(100);
  });

  it("hpMult clamps to at least 1 on a small mob", () => {
    const stats = resolveMobStats(
      mob({ tier: "weak", level: 1, hpMult: 0.01 }),
      MOB_TIERS,
    )!;
    expect(stats.hp.tierDefault).toBe(1);
  });

  it("maxDamage stays at least the multiplier-applied minDamage", () => {
    const stats = resolveMobStats(
      mob({ tier: "weak", level: 1, dmgMult: 0.01 }),
      MOB_TIERS,
    )!;
    // both clamp to 1; max must not fall below min
    expect(stats.minDamage.tierDefault).toBe(1);
    expect(stats.maxDamage.tierDefault).toBeGreaterThanOrEqual(stats.minDamage.tierDefault);
  });
});
