import { describe, expect, it } from "vitest";
import {
  abilityHitsForAuthoredPower,
  authoredPowerForAbilityHits,
  standardMobHpForAbilityLevel,
} from "@/lib/abilityPacing";
import type { MobTiersConfig, StatBindings } from "@/types/config";

const MOB_TIERS: MobTiersConfig = {
  weak: { baseHp: 10, hpScalingRate: 1.1, baseMinDamage: 1, baseMaxDamage: 2, damageScalingRate: 1, baseArmor: 0, baseXpReward: 10, xpScalingRate: 1, baseGoldMin: 0, baseGoldMax: 0, goldScalingRate: 1 },
  standard: { baseHp: 12, hpScalingRate: 1.2, baseMinDamage: 1, baseMaxDamage: 3, damageScalingRate: 1, baseArmor: 0, baseXpReward: 20, xpScalingRate: 1, baseGoldMin: 0, baseGoldMax: 0, goldScalingRate: 1 },
  elite: { baseHp: 30, hpScalingRate: 1.2, baseMinDamage: 2, baseMaxDamage: 5, damageScalingRate: 1, baseArmor: 1, baseXpReward: 50, xpScalingRate: 1, baseGoldMin: 0, baseGoldMax: 0, goldScalingRate: 1 },
  boss: { baseHp: 100, hpScalingRate: 1.2, baseMinDamage: 5, baseMaxDamage: 10, damageScalingRate: 1, baseArmor: 3, baseXpReward: 100, xpScalingRate: 1, baseGoldMin: 0, baseGoldMax: 0, goldScalingRate: 1 },
};

const BINDINGS: StatBindings = {
  meleeDamageStat: "STR",
  meleeStatMultiplier: 0,
  meleeLevelScalingRate: 1,
  meleeVarianceMin: 1,
  meleeVarianceMax: 1,
  meleeBaseAttackPower: 1,
  meleeArmorMitigationK: 20,
  dodgeStat: "DEX",
  dodgePerPoint: 1,
  maxDodgePercent: 30,
  spellDamageStat: "INT",
  spellStatMultiplier: 0,
  spellLevelScalingRate: 1.2,
  spellVarianceMin: 1,
  spellVarianceMax: 1,
  healStat: "WIS",
  healStatMultiplier: 0,
  healLevelScalingRate: 1.2,
  healVarianceMin: 1,
  healVarianceMax: 1,
  buffStat: "CHA",
  buffDurationPerStat: 0,
  buffMagnitudePerStat: 0,
  hpScalingStat: "CON",
  hpScalingDivisor: 5,
  manaScalingStat: "INT",
  manaScalingDivisor: 5,
  hpRegenStat: "CON",
  hpRegenMsPerPoint: 100,
  manaRegenStat: "INT",
  manaRegenMsPerPoint: 100,
  xpBonusStat: "WIS",
  xpBonusPerPoint: 0,
};

describe("ability pacing", () => {
  it("uses standard mob HP as the common-mob benchmark", () => {
    expect(standardMobHpForAbilityLevel(MOB_TIERS, 1)).toBe(12);
  });

  it("maps three level-1 casts to standard mob HP divided by three", () => {
    const authored = authoredPowerForAbilityHits(3, 1, MOB_TIERS, BINDINGS, "damage");
    expect(authored).toBe(4);
    expect(abilityHitsForAuthoredPower(authored, 1, MOB_TIERS, BINDINGS, "damage")).toBe(3);
  });

  it("stores the level-1 anchor for higher-level abilities", () => {
    const authored = authoredPowerForAbilityHits(3, 3, MOB_TIERS, BINDINGS, "damage");
    expect(authored).toBe(4);
    expect(abilityHitsForAuthoredPower(authored, 3, MOB_TIERS, BINDINGS, "damage")).toBeCloseTo(2.83, 2);
  });

  it("keeps positive pacing requests as active direct effects", () => {
    expect(authoredPowerForAbilityHits(100, 1, MOB_TIERS, BINDINGS, "damage")).toBe(1);
  });
});
