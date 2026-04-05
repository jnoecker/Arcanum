import { describe, it, expect } from "vitest";
import { deepMerge, buildPartialFromDiffs } from "@/lib/tuning/merge";
import { TuningSection } from "@/lib/tuning/types";
import type { DiffEntry } from "@/lib/tuning/types";

// ─── deepMerge ─────────────────────────────────────────────────────

describe("deepMerge", () => {
  it("recursively overwrites nested values", () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const overlay = { b: { c: 99 } };
    const result = deepMerge(base, overlay);
    expect(result).toEqual({ a: 1, b: { c: 99, d: 3 } });
  });

  it("adds new keys from overlay", () => {
    const base = { a: 1 } as Record<string, unknown>;
    const overlay = { b: 2 };
    const result = deepMerge(base, overlay);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("does not overwrite when overlay value is undefined", () => {
    const base = { a: 1, b: 2 };
    const overlay = { a: undefined };
    const result = deepMerge(base, overlay);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("does not recurse into arrays", () => {
    const base = { a: [1, 2, 3] } as Record<string, unknown>;
    const overlay = { a: [4, 5] };
    const result = deepMerge(base, overlay);
    expect(result).toEqual({ a: [4, 5] });
  });

  it("deeply merges multiple levels", () => {
    const base = { x: { y: { z: 1, w: 2 } } };
    const overlay = { x: { y: { z: 99 } } };
    const result = deepMerge(base, overlay);
    expect(result).toEqual({ x: { y: { z: 99, w: 2 } } });
  });
});

// ─── buildPartialFromDiffs ──────────────────────────────────────────

describe("buildPartialFromDiffs", () => {
  const sampleDiffs: DiffEntry[] = [
    { path: "combat.tickMillis", label: "Tick", section: TuningSection.CombatStats, oldValue: 3000, newValue: 2500 },
    { path: "combat.maxDamage", label: "Max Damage", section: TuningSection.CombatStats, oldValue: 150, newValue: 100 },
    { path: "economy.buyMultiplier", label: "Buy Mult", section: TuningSection.EconomyCrafting, oldValue: 1.0, newValue: 0.8 },
    { path: "progression.xp.exponent", label: "XP Exp", section: TuningSection.ProgressionQuests, oldValue: 1.8, newValue: 1.6 },
    { path: "regen.baseIntervalMillis", label: "Regen Base", section: TuningSection.WorldSocial, oldValue: 4500, newValue: 3500 },
  ];

  it("filters diffs to only accepted sections", () => {
    const accepted = new Set([TuningSection.CombatStats, TuningSection.EconomyCrafting]);
    const result = buildPartialFromDiffs(sampleDiffs, accepted);

    expect(result).toHaveProperty("combat");
    expect(result).toHaveProperty("economy");
    expect(result).not.toHaveProperty("progression");
    expect(result).not.toHaveProperty("regen");
  });

  it("returns empty object when no sections accepted", () => {
    const result = buildPartialFromDiffs(sampleDiffs, new Set());
    expect(result).toEqual({});
  });

  it("correctly builds nested paths from dot-notation", () => {
    const accepted = new Set([TuningSection.ProgressionQuests]);
    const result = buildPartialFromDiffs(sampleDiffs, accepted);

    expect(result).toEqual({
      progression: { xp: { exponent: 1.6 } },
    });
  });

  it("includes all diffs from accepted sections", () => {
    const accepted = new Set([TuningSection.CombatStats]);
    const result = buildPartialFromDiffs(sampleDiffs, accepted);

    expect(result).toEqual({
      combat: { tickMillis: 2500, maxDamage: 100 },
    });
  });

  it("includes all sections when all are accepted", () => {
    const accepted = new Set([
      TuningSection.CombatStats,
      TuningSection.EconomyCrafting,
      TuningSection.ProgressionQuests,
      TuningSection.WorldSocial,
    ]);
    const result = buildPartialFromDiffs(sampleDiffs, accepted);

    expect(result).toHaveProperty("combat");
    expect(result).toHaveProperty("economy");
    expect(result).toHaveProperty("progression");
    expect(result).toHaveProperty("regen");
  });
});
