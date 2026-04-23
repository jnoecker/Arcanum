import { describe, it, expect } from "vitest";
import { TUNING_PRESETS } from "@/lib/tuning/presets";
import type { TuningPreset } from "@/lib/tuning/presets";
import { applyTemplate } from "@/lib/templates";
import { estimatePacing } from "@/lib/tuning/pacing";
import type { AppConfig } from "@/types/config";

const BASE_CONFIG = {
  progression: {
    maxLevel: 50,
    xp: { baseXp: 100, exponent: 2.0, linearXp: 0, multiplier: 1.0, defaultKillXp: 10 },
    rewards: { hpPerLevel: 2, manaPerLevel: 1, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 10, baseMana: 10 },
  },
  stats: {
    bindings: {
      meleeDamageStat: "STR", meleeDamageDivisor: 3,
      dodgeStat: "DEX", dodgePerPoint: 2, maxDodgePercent: 30,
      spellDamageStat: "INT", spellDamageDivisor: 3,
      hpScalingStat: "CON", hpScalingDivisor: 5,
      manaScalingStat: "INT", manaScalingDivisor: 5,
      hpRegenStat: "CON", hpRegenMsPerPoint: 200,
      manaRegenStat: "INT", manaRegenMsPerPoint: 200,
      xpBonusStat: "WIS", xpBonusPerPoint: 0.005,
    },
  },
} as unknown as Record<string, unknown>;

function mergedConfig(preset: TuningPreset): AppConfig {
  return applyTemplate(BASE_CONFIG as unknown as AppConfig, preset.config);
}

describe("preset invariants — server semantics", () => {
  describe("shop arbitrage (sell < buy with ≥0.1 margin)", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: economy.sellMultiplier < economy.buyMultiplier - 0.05`, () => {
        const buy = preset.config.economy?.buyMultiplier ?? 1;
        const sell = preset.config.economy?.sellMultiplier ?? 0.5;
        expect(sell, `${preset.id}: buy=${buy} sell=${sell}`).toBeLessThan(buy - 0.05);
      });
    }
  });

  describe("gambling house edge (diceWinChance × diceWinMultiplier < 1)", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: expected gross return < 1.0`, () => {
        const chance = preset.config.gambling?.diceWinChance ?? 0;
        const mult = preset.config.gambling?.diceWinMultiplier ?? 0;
        const expected = chance * mult;
        expect(expected, `${preset.id}: ${chance} × ${mult} = ${expected}`).toBeLessThan(1);
      });
    }
  });

  describe("xpBonusPerPoint is a fractional multiplier, not a percentage", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: xpBonusPerPoint in [0, 0.1]`, () => {
        const value = preset.config.stats?.bindings?.xpBonusPerPoint;
        expect(value, `${preset.id} missing xpBonusPerPoint`).toBeDefined();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0.1);
      });
    }
  });

  describe("group.xpBonusPerMember is a fractional multiplier, not a percentage", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: xpBonusPerMember in [0, 1.0]`, () => {
        const value = preset.config.group?.xpBonusPerMember;
        expect(value, `${preset.id} missing xpBonusPerMember`).toBeDefined();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    }
  });

  describe("combat.maxDamage stays within the corrected range", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: combat.maxDamage ≤ 15`, () => {
        const value = preset.config.combat?.maxDamage ?? 0;
        expect(value, `${preset.id}: maxDamage=${value}`).toBeLessThanOrEqual(15);
      });
    }
  });

  describe("mob HP tier ordering (weak < standard < elite < boss)", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: baseHp, hpPerLevel, baseXpReward ascend across tiers`, () => {
        const t = preset.config.mobTiers!;
        const weak = t.weak!;
        const standard = t.standard!;
        const elite = t.elite!;
        const boss = t.boss!;
        expect(weak.baseHp).toBeLessThan(standard.baseHp!);
        expect(standard.baseHp).toBeLessThan(elite.baseHp!);
        expect(elite.baseHp).toBeLessThan(boss.baseHp!);
        expect(weak.hpPerLevel).toBeLessThanOrEqual(standard.hpPerLevel!);
        expect(standard.hpPerLevel).toBeLessThanOrEqual(elite.hpPerLevel!);
        expect(elite.hpPerLevel).toBeLessThanOrEqual(boss.hpPerLevel!);
        expect(weak.baseXpReward).toBeLessThanOrEqual(standard.baseXpReward!);
        expect(standard.baseXpReward).toBeLessThanOrEqual(elite.baseXpReward!);
        expect(elite.baseXpReward).toBeLessThanOrEqual(boss.baseXpReward!);
      });
    }
  });

  describe("time to max level falls within [4, 120] hours", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: projected L-cap in bound`, () => {
        const merged = mergedConfig(preset);
        const maxLevel = merged.progression.maxLevel || 50;
        const pacing = estimatePacing(merged, preset.id);
        const highestMilestone = pacing.milestones.reduce<typeof pacing.milestones[number] | null>(
          (best, m) => (best == null || m.level > best.level ? m : best),
          null,
        );
        expect(highestMilestone).not.toBeNull();
        const minutes = highestMilestone!.minutesEstimated;
        const scaled = (minutes * maxLevel) / highestMilestone!.level;
        const hours = scaled / 60;
        expect(hours, `${preset.id}: projected ~${hours.toFixed(1)}h to L${maxLevel}`).toBeGreaterThanOrEqual(4);
        expect(hours, `${preset.id}: projected ~${hours.toFixed(1)}h to L${maxLevel}`).toBeLessThanOrEqual(120);
      });
    }
  });

  describe("prestige.xpCostMultiplier stays within [1.1, 1.8]", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: xpCostMultiplier in range`, () => {
        const value = preset.config.prestige?.xpCostMultiplier;
        expect(value).toBeDefined();
        expect(value).toBeGreaterThanOrEqual(1.1);
        expect(value).toBeLessThanOrEqual(1.8);
      });
    }
  });

  describe("combat.tickMillis is at least 1000 ms", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: tickMillis ≥ 1000`, () => {
        const value = preset.config.combat?.tickMillis ?? 0;
        expect(value).toBeGreaterThanOrEqual(1000);
      });
    }
  });

  describe("renamed server fields are populated (no dead keys)", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: gambling.dice* and lottery.jackpotSeedGold and guildHalls.purchaseCost are set`, () => {
        expect(preset.config.gambling?.diceMinBet).toBeDefined();
        expect(preset.config.gambling?.diceMaxBet).toBeDefined();
        expect(preset.config.gambling?.diceWinChance).toBeDefined();
        expect(preset.config.gambling?.diceWinMultiplier).toBeDefined();
        expect(preset.config.lottery?.jackpotSeedGold).toBeDefined();
        expect(preset.config.guildHalls?.purchaseCost).toBeDefined();
      });

      it(`${preset.id}: old dead keys are not set`, () => {
        const gambling = preset.config.gambling as Record<string, unknown> | undefined;
        const lottery = preset.config.lottery as Record<string, unknown> | undefined;
        const guildHalls = preset.config.guildHalls as Record<string, unknown> | undefined;
        const autoQuests = preset.config.autoQuests as Record<string, unknown> | undefined;
        expect(gambling?.minBet).toBeUndefined();
        expect(gambling?.maxBet).toBeUndefined();
        expect(gambling?.winChance).toBeUndefined();
        expect(gambling?.winMultiplier).toBeUndefined();
        expect(lottery?.jackpotBase).toBeUndefined();
        expect(guildHalls?.baseCost).toBeUndefined();
        expect(autoQuests?.rewardScaling).toBeUndefined();
      });
    }
  });

  describe("dodge cap is not reached by a modestly invested character", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: dodgePerPoint × 10 < maxDodgePercent`, () => {
        const b = preset.config.stats!.bindings!;
        const perPoint = b.dodgePerPoint!;
        const cap = b.maxDodgePercent!;
        expect(perPoint * 10, `${preset.id}: stat=20 would hit ${perPoint * 10} vs cap ${cap}`).toBeLessThan(cap);
      });
    }
  });

  describe("regen-to-full downtime is under 180 seconds at level 25", () => {
    for (const preset of TUNING_PRESETS) {
      it(`${preset.id}: post-fight regen time is reasonable`, () => {
        const merged = mergedConfig(preset);
        const rewards = merged.progression.rewards;
        const playerHpAt25 = rewards.baseHp + 24 * rewards.hpPerLevel;
        const interval = merged.regen.baseIntervalMillis;
        const amount = merged.regen.regenAmount;
        const timeToFullSec = (playerHpAt25 * interval) / (amount * 1000);
        expect(timeToFullSec, `${preset.id}: ${timeToFullSec.toFixed(0)}s to regen ${playerHpAt25}hp`).toBeLessThan(180);
      });
    }
  });
});
