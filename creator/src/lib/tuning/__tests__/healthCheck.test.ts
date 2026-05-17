import { describe, it, expect } from "vitest";
import { checkTuningHealth, checkAbsoluteHealth } from "@/lib/tuning/healthCheck";
import type { HealthWarning } from "@/lib/tuning/healthCheck";
import { TuningSection } from "@/lib/tuning/types";
import type { MetricSnapshot } from "@/lib/tuning/types";
import type { AppConfig } from "@/types/config";

// ─── Helpers ────────────────────────────────────────────────────────

/** Create a minimal MetricSnapshot with sensible defaults. */
function makeMetrics(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    xpPerLevel: { 10: 10000 },
    mobHp: { standard: { 10: 52 } },
    mobDamageAvg: { standard: { 10: 13 } },
    mobGoldAvg: { standard: { 10: 25.5 } },
    playerMeleeAvgDamage: { 10: 3 },
    playerHp: { 10: 60 },
    dodgeChance: { 10: 20 },
    regenInterval: { 10: 3000 },
    ...overrides,
  };
}

const ALL_SECTIONS = new Set([
  TuningSection.CombatStats,
  TuningSection.EconomyCrafting,
  TuningSection.ProgressionQuests,
  TuningSection.WorldSocial,
]);

// ─── Tests ──────────────────────────────────────────────────────────

describe("checkTuningHealth", () => {
  it("returns empty array when all 4 sections accepted", () => {
    const pre = makeMetrics();
    const post = makeMetrics({ xpPerLevel: { 10: 20000 } });
    const result = checkTuningHealth(pre, post, ALL_SECTIONS);
    expect(result).toEqual([]);
  });

  it("returns economy-combat warning when gold changes >50% but mob HP unchanged", () => {
    const pre = makeMetrics();
    // Gold changed from 25.5 to 50 (>50% change), mob HP unchanged
    const post = makeMetrics({ mobGoldAvg: { standard: { 10: 50 } } });

    const accepted = new Set([TuningSection.EconomyCrafting]);
    const result = checkTuningHealth(pre, post, accepted);

    expect(result.length).toBe(1);
    expect(result[0]!.severity).toBe("warning");
    expect(result[0]!.message).toContain("Economy");
    expect(result[0]!.detail).toContain("Combat & Stats");
  });

  it("returns progression-combat warning when XP changes >30% but mob HP unchanged", () => {
    const pre = makeMetrics();
    // XP changed from 10000 to 15000 (50% change), mob HP unchanged
    const post = makeMetrics({ xpPerLevel: { 10: 15000 } });

    const accepted = new Set([TuningSection.ProgressionQuests]);
    const result = checkTuningHealth(pre, post, accepted);

    expect(result.length).toBe(1);
    expect(result[0]!.severity).toBe("warning");
    expect(result[0]!.message).toContain("Progression");
    expect(result[0]!.detail).toContain("Combat & Stats");
  });

  it("returns regen-damage warning when regen changes >30% but mob damage unchanged", () => {
    const pre = makeMetrics();
    // Regen changed from 3000 to 1500 (50% change), mob damage unchanged
    const post = makeMetrics({ regenInterval: { 10: 1500 } });

    const accepted = new Set([TuningSection.WorldSocial]);
    const result = checkTuningHealth(pre, post, accepted);

    expect(result.length).toBe(1);
    expect(result[0]!.severity).toBe("warning");
    expect(result[0]!.message).toContain("Stat scaling");
    expect(result[0]!.detail).toContain("Combat & Stats");
  });

  it("returns empty array when changes are within balanced thresholds", () => {
    const pre = makeMetrics();
    // Gold changed by only 10% (within 50% threshold)
    const post = makeMetrics({ mobGoldAvg: { standard: { 10: 28 } } });

    const accepted = new Set([TuningSection.EconomyCrafting]);
    const result = checkTuningHealth(pre, post, accepted);

    expect(result).toEqual([]);
  });

  it("each warning has severity, message, and detail fields", () => {
    const pre = makeMetrics();
    const post = makeMetrics({
      mobGoldAvg: { standard: { 10: 50 } },
      xpPerLevel: { 10: 15000 },
      regenInterval: { 10: 1500 },
    });

    // Accept all except combat -- should trigger all 3 warnings
    const accepted = new Set([
      TuningSection.EconomyCrafting,
      TuningSection.ProgressionQuests,
      TuningSection.WorldSocial,
    ]);
    const result = checkTuningHealth(pre, post, accepted);

    expect(result.length).toBe(3);
    for (const warning of result) {
      expect(warning.severity).toBeTruthy();
      expect(warning.message.length).toBeGreaterThan(0);
      expect(warning.detail.length).toBeGreaterThan(0);
    }
  });

  it("does not warn when combat section is also accepted", () => {
    const pre = makeMetrics();
    const post = makeMetrics({ mobGoldAvg: { standard: { 10: 50 } } });

    // Accept both economy AND combat -- no warning
    const accepted = new Set([TuningSection.EconomyCrafting, TuningSection.CombatStats]);
    const result = checkTuningHealth(pre, post, accepted);

    expect(result).toEqual([]);
  });
});

// ─── checkAbsoluteHealth ────────────────────────────────────────────

/**
 * Build a partial AppConfig that exercises the fields checkAbsoluteHealth
 * actually reads. Cast through unknown to satisfy TS without spelling out
 * dozens of unrelated sections.
 */
function makeConfig(overrides: {
  regenAmount?: number;
  regenInterval?: number;
  weakBaseHp?: number;
  weakBaseArmor?: number;
  weakDmgMin?: number;
  weakDmgMax?: number;
  stdDmgMin?: number;
  stdDmgMax?: number;
  mobDelayMin?: number;
  mobDelayMax?: number;
  /** Unarmed level-1 swing = meleeBaseAttackPower × varianceMid. */
  meleeBaseAttackPower?: number;
  meleeLevelScalingRate?: number;
  meleeVarianceMin?: number;
  meleeVarianceMax?: number;
  meleeArmorMitigationK?: number;
  tickMillis?: number;
  baseHp?: number;
  /** Player HP scaling rate — paired with melee level scaling rate for symmetry check. */
  hpScalingRate?: number;
} = {}): AppConfig {
  return ({
    regen: {
      regenAmount: overrides.regenAmount ?? 2,
      baseIntervalMillis: overrides.regenInterval ?? 4000,
    },
    combat: {
      tickMillis: overrides.tickMillis ?? 2000,
    },
    stats: {
      bindings: {
        meleeBaseAttackPower: overrides.meleeBaseAttackPower ?? 1,
        meleeLevelScalingRate: overrides.meleeLevelScalingRate ?? 1.30,
        meleeVarianceMin: overrides.meleeVarianceMin ?? 0.85,
        meleeVarianceMax: overrides.meleeVarianceMax ?? 1.15,
        meleeArmorMitigationK: overrides.meleeArmorMitigationK ?? 20,
        meleeStatMultiplier: 0.25,
      },
    },
    mobTiers: {
      weak: {
        baseHp: overrides.weakBaseHp ?? 8,
        baseArmor: overrides.weakBaseArmor ?? 0,
        baseMinDamage: overrides.weakDmgMin ?? 1,
        baseMaxDamage: overrides.weakDmgMax ?? 3,
      },
      standard: {
        baseMinDamage: overrides.stdDmgMin ?? 5,
        baseMaxDamage: overrides.stdDmgMax ?? 12,
      },
    },
    mobActionDelay: {
      minActionDelayMillis: overrides.mobDelayMin ?? 4000,
      maxActionDelayMillis: overrides.mobDelayMax ?? 8000,
    },
    progression: {
      rewards: {
        baseHp: overrides.baseHp ?? 150,
        hpScalingRate: overrides.hpScalingRate ?? 1.30,
      },
    },
  } as unknown) as AppConfig;
}

describe("checkAbsoluteHealth", () => {
  it("returns empty for a reasonably-tuned config", () => {
    const result = checkAbsoluteHealth(makeConfig());
    expect(result).toEqual([]);
  });

  it("warns when regen swamps standard-tier mob DPS by 3× or more", () => {
    // regen 10/s, std DPS ~1.42/s → 7× ratio
    const result = checkAbsoluteHealth(
      makeConfig({ regenAmount: 40, regenInterval: 4000 }),
    );
    expect(result.some((w) => /Regen.*outpaces standard-tier/.test(w.message))).toBe(true);
  });

  it("does not warn when regen is below standard-tier DPS", () => {
    // regen 0.5/s, std DPS ~1.42/s → 0.35× ratio
    const result = checkAbsoluteHealth(
      makeConfig({ regenAmount: 2, regenInterval: 4000 }),
    );
    expect(result.some((w) => /Regen.*outpaces standard-tier/.test(w.message))).toBe(false);
  });

  it("warns when weak-tier TTK exceeds 30s", () => {
    // 150 HP weak / 1 avg unarmed dmg × 2s tick = 300s
    const result = checkAbsoluteHealth(
      makeConfig({ weakBaseHp: 150, meleeBaseAttackPower: 1 }),
    );
    expect(result.some((w) => /grindy/.test(w.message))).toBe(true);
  });

  it("hints when weak-tier TTK is under 2s", () => {
    // 4 HP weak / 5 avg dmg × 2s tick = ~1.6s
    const result = checkAbsoluteHealth(
      makeConfig({ weakBaseHp: 4, meleeBaseAttackPower: 5 }),
    );
    expect(result.some((w) => /too quick/.test(w.message) && w.severity === "info")).toBe(true);
  });

  it("warns when melee level scaling and HP scaling diverge", () => {
    const result = checkAbsoluteHealth(
      makeConfig({ meleeLevelScalingRate: 1.30, hpScalingRate: 1.10 }),
    );
    expect(
      result.some((w) =>
        /Melee level scaling.*player HP scaling.*diverge/.test(w.message),
      ),
    ).toBe(true);
  });

  it("does not warn when melee and HP rates are within 0.05 of each other", () => {
    const result = checkAbsoluteHealth(
      makeConfig({ meleeLevelScalingRate: 1.30, hpScalingRate: 1.32 }),
    );
    expect(
      result.some((w) =>
        /Melee level scaling.*player HP scaling.*diverge/.test(w.message),
      ),
    ).toBe(false);
  });

  it("hints when out-of-combat recovery exceeds 10 minutes", () => {
    // baseHp 1000, regen 1/4s = 0.25/s → 4000s = 66 min
    const result = checkAbsoluteHealth(
      makeConfig({ regenAmount: 1, regenInterval: 4000, baseHp: 1000 }),
    );
    expect(result.some((w) => /recovery is very slow/.test(w.message))).toBe(true);
  });

  it("bails gracefully when required config sections are missing", () => {
    const partial = ({ regen: undefined } as unknown) as AppConfig;
    expect(() => checkAbsoluteHealth(partial)).not.toThrow();
    expect(checkAbsoluteHealth(partial)).toEqual([]);
  });
});
