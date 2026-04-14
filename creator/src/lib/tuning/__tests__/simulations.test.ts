import { describe, it, expect } from "vitest";
import {
  simulateEncounter,
  simulateEconomy,
  simulateProgression,
  analyzeCraftingViability,
  tierForLevel,
} from "@/lib/tuning/simulations";
import type { AppConfig } from "@/types/config";
import type { WorldFile } from "@/types/world";

// ─── Shared mock config ────────────────────────────────────────────

const MOCK_CONFIG = {
  progression: {
    maxLevel: 50,
    xp: { baseXp: 100, exponent: 2.0, linearXp: 0, multiplier: 1.0, defaultKillXp: 10 },
    rewards: {
      hpPerLevel: 4,
      manaPerLevel: 3,
      fullHealOnLevelUp: true,
      fullManaOnLevelUp: true,
      baseHp: 30,
      baseMana: 30,
    },
  },
  combat: {
    maxCombatsPerTick: 10,
    tickMillis: 1000,
    minDamage: 2,
    maxDamage: 4,
    feedback: { enabled: true, roomBroadcastEnabled: true },
  },
  mobTiers: {
    weak: {
      baseHp: 10, hpPerLevel: 3,
      baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0,
      baseArmor: 0, baseXpReward: 15, xpRewardPerLevel: 5,
      baseGoldMin: 1, baseGoldMax: 3, goldPerLevel: 1,
    },
    standard: {
      baseHp: 20, hpPerLevel: 5,
      baseMinDamage: 2, baseMaxDamage: 4, damagePerLevel: 1,
      baseArmor: 1, baseXpReward: 30, xpRewardPerLevel: 10,
      baseGoldMin: 3, baseGoldMax: 8, goldPerLevel: 2,
    },
    elite: {
      baseHp: 40, hpPerLevel: 8,
      baseMinDamage: 3, baseMaxDamage: 6, damagePerLevel: 1,
      baseArmor: 2, baseXpReward: 75, xpRewardPerLevel: 25,
      baseGoldMin: 10, baseGoldMax: 25, goldPerLevel: 5,
    },
    boss: {
      baseHp: 80, hpPerLevel: 15,
      baseMinDamage: 6, baseMaxDamage: 12, damagePerLevel: 2,
      baseArmor: 4, baseXpReward: 200, xpRewardPerLevel: 50,
      baseGoldMin: 30, baseGoldMax: 80, goldPerLevel: 15,
    },
  },
  stats: {
    definitions: {},
    bindings: {
      meleeDamageStat: "str", meleeDamageDivisor: 3,
      dodgeStat: "dex", dodgePerPoint: 0.5, maxDodgePercent: 30,
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
  economy: { buyMultiplier: 1.2, sellMultiplier: 0.6 },
  crafting: {
    maxSkillLevel: 50,
    baseXpPerLevel: 80,
    xpExponent: 1.3,
    gatherCooldownMs: 2000,
    stationBonusQuantity: 1,
  },
  classes: {
    warrior: {
      displayName: "Warrior",
      hpPerLevel: 6,
      manaPerLevel: 2,
      selectable: true,
    },
  },
} as unknown as AppConfig;

// ─── simulateEncounter ─────────────────────────────────────────────

describe("simulateEncounter", () => {
  it("produces a complete outcome", () => {
    const r = simulateEncounter(MOCK_CONFIG, {
      playerLevel: 10,
      mobTier: "standard",
      mobLevel: 10,
    });
    expect(r.turnsToKill).toBeGreaterThan(0);
    expect(r.playerHp).toBeGreaterThan(0);
    expect(r.mobHp).toBeGreaterThan(0);
    expect(["easy", "fair", "risky", "lethal"]).toContain(r.verdict);
  });

  it("is 'lethal' when facing a much higher-level boss", () => {
    const r = simulateEncounter(MOCK_CONFIG, {
      playerLevel: 5,
      mobTier: "boss",
      mobLevel: 30,
    });
    expect(r.verdict).toBe("lethal");
    expect(r.playerWins).toBe(false);
  });

  it("uses class hpPerLevel when classId is supplied", () => {
    const r1 = simulateEncounter(MOCK_CONFIG, {
      playerLevel: 10,
      mobTier: "standard",
      mobLevel: 10,
    });
    const r2 = simulateEncounter(MOCK_CONFIG, {
      playerLevel: 10,
      classId: "warrior",
      mobTier: "standard",
      mobLevel: 10,
    });
    // Warrior has 6 hpPerLevel vs default 3 → strictly more HP
    expect(r2.playerHp).toBeGreaterThan(r1.playerHp);
  });

  it("treats empty classId the same as undefined", () => {
    const r1 = simulateEncounter(MOCK_CONFIG, {
      playerLevel: 10,
      mobTier: "standard",
      mobLevel: 10,
    });
    const r2 = simulateEncounter(MOCK_CONFIG, {
      playerLevel: 10,
      classId: "",
      mobTier: "standard",
      mobLevel: 10,
    });
    expect(r1.playerHp).toBe(r2.playerHp);
  });
});

// ─── simulateEconomy ───────────────────────────────────────────────

describe("simulateEconomy", () => {
  it("normalises tier mix that does not sum to 1", () => {
    const r = simulateEconomy(MOCK_CONFIG, {
      level: 10,
      killsPerHour: 60,
      tierMix: { weak: 2, standard: 2, elite: 1, boss: 0 },
      sellRate: 0.5,
      consumableSpendPerHour: 0,
    });
    const sum = Object.values(r.normalisedMix).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("yields zero income when killsPerHour is 0", () => {
    const r = simulateEconomy(MOCK_CONFIG, {
      level: 10,
      killsPerHour: 0,
      tierMix: { weak: 1, standard: 0, elite: 0, boss: 0 },
      sellRate: 0.5,
      consumableSpendPerHour: 0,
    });
    expect(r.xpPerHour).toBe(0);
    expect(r.goldPerHour).toBeLessThanOrEqual(0);
    expect(r.timeToNextLevelHours).toBe(Number.POSITIVE_INFINITY);
  });

  it("subtracts gambling stake from goldPerHour", () => {
    const base = simulateEconomy(MOCK_CONFIG, {
      level: 10,
      killsPerHour: 60,
      tierMix: { weak: 1, standard: 0, elite: 0, boss: 0 },
      sellRate: 0.5,
      consumableSpendPerHour: 0,
    });
    const withStake = simulateEconomy(MOCK_CONFIG, {
      level: 10,
      killsPerHour: 60,
      tierMix: { weak: 1, standard: 0, elite: 0, boss: 0 },
      sellRate: 0.5,
      consumableSpendPerHour: 0,
      gamblingStakePerHour: 50,
    });
    expect(withStake.goldPerHour).toBe(base.goldPerHour - 50);
  });

  it("higher sellMultiplier produces more gold from shop sales", () => {
    const lowMult = simulateEconomy(
      { ...MOCK_CONFIG, economy: { buyMultiplier: 1, sellMultiplier: 0.2 } } as AppConfig,
      {
        level: 10,
        killsPerHour: 100,
        tierMix: { weak: 1, standard: 0, elite: 0, boss: 0 },
        sellRate: 1,
        consumableSpendPerHour: 0,
      },
    );
    const highMult = simulateEconomy(
      { ...MOCK_CONFIG, economy: { buyMultiplier: 1, sellMultiplier: 0.9 } } as AppConfig,
      {
        level: 10,
        killsPerHour: 100,
        tierMix: { weak: 1, standard: 0, elite: 0, boss: 0 },
        sellRate: 1,
        consumableSpendPerHour: 0,
      },
    );
    expect(highMult.goldPerHour).toBeGreaterThan(lowMult.goldPerHour);
  });
});

// ─── simulateProgression ───────────────────────────────────────────

describe("simulateProgression", () => {
  it("produces one point per level in range inclusive", () => {
    const r = simulateProgression(MOCK_CONFIG, {
      startLevel: 1,
      endLevel: 10,
      xpPerHour: 1000,
    });
    expect(r.points).toHaveLength(10);
    expect(r.points[0]!.level).toBe(1);
    expect(r.points[9]!.level).toBe(10);
  });

  it("cumulative hours are monotonically non-decreasing", () => {
    const r = simulateProgression(MOCK_CONFIG, {
      startLevel: 1,
      endLevel: 20,
      xpPerHour: 1000,
    });
    for (let i = 1; i < r.points.length; i++) {
      expect(r.points[i]!.cumulativeHours).toBeGreaterThanOrEqual(
        r.points[i - 1]!.cumulativeHours,
      );
    }
  });

  it("identifies slowest level as the highest level in a steep curve", () => {
    const r = simulateProgression(MOCK_CONFIG, {
      startLevel: 1,
      endLevel: 30,
      xpPerHour: 1000,
    });
    // Quadratic curve — slowest level should be near the end
    expect(r.slowestLevel).toBe(30);
  });

  it("handles reversed start/end by swapping", () => {
    const r = simulateProgression(MOCK_CONFIG, {
      startLevel: 10,
      endLevel: 1,
      xpPerHour: 1000,
    });
    expect(r.points[0]!.level).toBe(1);
    expect(r.points[r.points.length - 1]!.level).toBe(10);
  });
});

// ─── analyzeCraftingViability ──────────────────────────────────────

describe("analyzeCraftingViability", () => {
  const makeZone = (): Map<string, { data: WorldFile }> => {
    const world: WorldFile = {
      zone: "test",
      startRoom: "r1",
      rooms: { r1: { title: "R1", description: "desc" } },
      items: {
        iron_ore: { displayName: "Iron Ore", basePrice: 10 },
        iron_sword: { displayName: "Iron Sword", basePrice: 120 },
        pearl: { displayName: "Pearl", basePrice: 80 },
      },
      gatheringNodes: {
        iron_vein: {
          displayName: "Iron Vein",
          skill: "mining",
          yields: [{ itemId: "iron_ore", minQuantity: 1, maxQuantity: 3 }],
          room: "r1",
        },
      },
      recipes: {
        craft_iron_sword: {
          displayName: "Craft Iron Sword",
          skill: "smithing",
          materials: [{ itemId: "iron_ore", quantity: 4 }],
          outputItemId: "iron_sword",
          outputQuantity: 1,
          xpReward: 50,
        },
        craft_pearl_necklace: {
          displayName: "Craft Pearl Necklace",
          skill: "jewelcrafting",
          materials: [{ itemId: "pearl", quantity: 2 }],
          outputItemId: "iron_sword",
          outputQuantity: 1,
        },
      },
    };
    return new Map([["test", { data: world }]]);
  };

  it("marks recipes with no gathering source as unsourced", () => {
    const rows = analyzeCraftingViability(MOCK_CONFIG, makeZone());
    const pearl = rows.find((r) => r.recipeId === "craft_pearl_necklace")!;
    expect(pearl.materialsSourced).toBe(false);
    expect(pearl.missingMaterialIds).toContain("pearl");
  });

  it("flags sourced recipes and computes a positive gather time", () => {
    const rows = analyzeCraftingViability(MOCK_CONFIG, makeZone());
    const iron = rows.find((r) => r.recipeId === "craft_iron_sword")!;
    expect(iron.materialsSourced).toBe(true);
    expect(iron.estimatedGatherSeconds).toBeGreaterThan(0);
  });

  it("computes netValue as output minus materials", () => {
    const rows = analyzeCraftingViability(MOCK_CONFIG, makeZone());
    const iron = rows.find((r) => r.recipeId === "craft_iron_sword")!;
    // 4 iron_ore @ 10 = 40 materials, iron_sword @ 120 = 120 output, net = 80
    expect(iron.materialValue).toBe(40);
    expect(iron.outputValue).toBe(120);
    expect(iron.netValue).toBe(80);
  });
});

// ─── tierForLevel ──────────────────────────────────────────────────

describe("tierForLevel", () => {
  it("returns one of the four tier keys", () => {
    const tier = tierForLevel(MOCK_CONFIG.mobTiers, 15);
    expect(["weak", "standard", "elite", "boss"]).toContain(tier);
  });
});
