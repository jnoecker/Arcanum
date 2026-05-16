import { describe, it, expect } from "vitest";
import { resolveMobStats } from "../resolveMobStats";
import type { MobFile } from "@/types/world";
import type { MobTiersConfig } from "@/types/config";

const MOB_TIERS: MobTiersConfig = {
  weak: {
    baseHp: 10,
    hpScalingRate: 1.1,
    baseMinDamage: 1,
    baseMaxDamage: 2,
    damageScalingRate: 1.1,
    baseArmor: 0,
    baseXpReward: 15,
    xpScalingRate: 1.1,
    baseGoldMin: 1,
    baseGoldMax: 3,
    goldScalingRate: 1.1,
  },
  standard: {
    baseHp: 20,
    hpScalingRate: 1.1,
    baseMinDamage: 2,
    baseMaxDamage: 4,
    damageScalingRate: 1.1,
    baseArmor: 1,
    baseXpReward: 30,
    xpScalingRate: 1.1,
    baseGoldMin: 3,
    baseGoldMax: 8,
    goldScalingRate: 1.1,
  },
  elite: {
    baseHp: 50,
    hpScalingRate: 1.12,
    baseMinDamage: 5,
    baseMaxDamage: 10,
    damageScalingRate: 1.1,
    baseArmor: 2,
    baseXpReward: 75,
    xpScalingRate: 1.15,
    baseGoldMin: 10,
    baseGoldMax: 25,
    goldScalingRate: 1.1,
  },
  boss: {
    baseHp: 200,
    hpScalingRate: 1.1,
    baseMinDamage: 10,
    baseMaxDamage: 20,
    damageScalingRate: 1.1,
    baseArmor: 4,
    baseXpReward: 200,
    xpScalingRate: 1.1,
    baseGoldMin: 50,
    baseGoldMax: 150,
    goldScalingRate: 1.1,
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

  it("applies multiplicative growth via levelSteps (level-1)", () => {
    const stats = resolveMobStats(mob({ tier: "elite", level: 5 }), MOB_TIERS)!;
    // level 5 -> 4 steps above base. Elite rates: hp=1.12, xp=1.15, dmg=1.1
    expect(stats.hp.tierDefault).toBe(Math.floor(50 * Math.pow(1.12, 4)));
    expect(stats.xpReward.tierDefault).toBe(Math.floor(75 * Math.pow(1.15, 4)));
    expect(stats.minDamage.tierDefault).toBe(Math.floor(5 * Math.pow(1.1, 4)));
  });

  it("marks authored values as overrides without changing tierDefault", () => {
    const stats = resolveMobStats(mob({ tier: "standard", level: 10, hp: 500, xpReward: 9 }), MOB_TIERS)!;
    expect(stats.hp.overridden).toBe(true);
    expect(stats.hp.effective).toBe(500);
    // Standard rates: hp=1.1, xp=1.1
    expect(stats.hp.tierDefault).toBe(Math.floor(20 * Math.pow(1.1, 9)));
    expect(stats.xpReward.overridden).toBe(true);
    expect(stats.xpReward.effective).toBe(9);
    expect(stats.xpReward.tierDefault).toBe(Math.floor(30 * Math.pow(1.1, 9)));
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
});
