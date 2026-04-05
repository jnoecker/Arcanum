import { describe, it, expect } from "vitest";
import { checkTuningHealth } from "@/lib/tuning/healthCheck";
import type { HealthWarning } from "@/lib/tuning/healthCheck";
import { TuningSection } from "@/lib/tuning/types";
import type { MetricSnapshot } from "@/lib/tuning/types";

// ─── Helpers ────────────────────────────────────────────────────────

/** Create a minimal MetricSnapshot with sensible defaults. */
function makeMetrics(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    xpPerLevel: { 10: 10000 },
    mobHp: { standard: { 10: 52 } },
    mobDamageAvg: { standard: { 10: 13 } },
    mobGoldAvg: { standard: { 10: 25.5 } },
    playerDamageBonus: { 10: 3 },
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
