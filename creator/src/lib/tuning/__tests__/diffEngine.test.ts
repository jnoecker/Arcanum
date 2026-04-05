import { describe, it, expect } from "vitest";
import { computeDiff, groupDiffBySection } from "@/lib/tuning/diffEngine";
import { TuningSection } from "@/lib/tuning/types";

// ─── computeDiff ───────────────────────────────────────────────────

describe("computeDiff", () => {
  it("returns empty array for identical objects", () => {
    const config = { progression: { xp: { baseXp: 100 } }, combat: { tickMillis: 2000 } };
    expect(computeDiff(config, config)).toEqual([]);
  });

  it("detects a single changed field with correct path, values, and label", () => {
    const configA = { progression: { xp: { baseXp: 100 } }, combat: { tickMillis: 2000 } };
    const configB = { progression: { xp: { baseXp: 200 } }, combat: { tickMillis: 2000 } };
    const diff = computeDiff(configA, configB);
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe("progression.xp.baseXp");
    expect(diff[0].oldValue).toBe(100);
    expect(diff[0].newValue).toBe(200);
    expect(diff[0].label).toBe("Base XP");
    expect(diff[0].section).toBe(TuningSection.ProgressionQuests);
  });

  it("detects nested changed field with correct dot-path", () => {
    const configA = { mobTiers: { weak: { baseHp: 5 } } };
    const configB = { mobTiers: { weak: { baseHp: 10 } } };
    const diff = computeDiff(configA, configB);
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe("mobTiers.weak.baseHp");
    expect(diff[0].oldValue).toBe(5);
    expect(diff[0].newValue).toBe(10);
  });

  it("ignores fields NOT in FIELD_METADATA (non-tunable paths)", () => {
    const configA = { server: { telnetPort: 8080 }, combat: { tickMillis: 2000 } };
    const configB = { server: { telnetPort: 9090 }, combat: { tickMillis: 2000 } };
    const diff = computeDiff(configA, configB);
    expect(diff).toHaveLength(0);
  });

  it("handles multiple changes across different sections", () => {
    const configA = {
      progression: { xp: { baseXp: 100 } },
      combat: { tickMillis: 2000 },
      economy: { buyMultiplier: 1.0 },
    };
    const configB = {
      progression: { xp: { baseXp: 200 } },
      combat: { tickMillis: 1000 },
      economy: { buyMultiplier: 2.0 },
    };
    const diff = computeDiff(configA, configB);
    expect(diff).toHaveLength(3);
    const paths = diff.map((d) => d.path).sort();
    expect(paths).toEqual(["combat.tickMillis", "economy.buyMultiplier", "progression.xp.baseXp"]);

    // Check sections are correct
    const sections = new Set(diff.map((d) => d.section));
    expect(sections.has(TuningSection.ProgressionQuests)).toBe(true);
    expect(sections.has(TuningSection.CombatStats)).toBe(true);
    expect(sections.has(TuningSection.EconomyCrafting)).toBe(true);
  });

  it("does not include unchanged tunable fields", () => {
    const configA = { combat: { tickMillis: 2000, minDamage: 1 } };
    const configB = { combat: { tickMillis: 2000, minDamage: 1 } };
    const diff = computeDiff(configA, configB);
    expect(diff).toHaveLength(0);
  });
});

// ─── groupDiffBySection ────────────────────────────────────────────

describe("groupDiffBySection", () => {
  it("groups DiffEntry[] into Record<TuningSection, DiffEntry[]>", () => {
    const entries = [
      { path: "combat.tickMillis", label: "Combat Tick Duration", section: TuningSection.CombatStats, oldValue: 2000, newValue: 1000 },
      { path: "progression.xp.baseXp", label: "Base XP", section: TuningSection.ProgressionQuests, oldValue: 100, newValue: 200 },
      { path: "economy.buyMultiplier", label: "Shop Buy Multiplier", section: TuningSection.EconomyCrafting, oldValue: 1.0, newValue: 2.0 },
    ];
    const grouped = groupDiffBySection(entries);
    expect(grouped[TuningSection.CombatStats]).toHaveLength(1);
    expect(grouped[TuningSection.ProgressionQuests]).toHaveLength(1);
    expect(grouped[TuningSection.EconomyCrafting]).toHaveLength(1);
  });

  it("returns empty arrays for sections with no changes", () => {
    const entries = [
      { path: "combat.tickMillis", label: "Combat Tick Duration", section: TuningSection.CombatStats, oldValue: 2000, newValue: 1000 },
    ];
    const grouped = groupDiffBySection(entries);
    expect(grouped[TuningSection.WorldSocial]).toEqual([]);
    expect(grouped[TuningSection.EconomyCrafting]).toEqual([]);
    expect(grouped[TuningSection.ProgressionQuests]).toEqual([]);
  });
});
