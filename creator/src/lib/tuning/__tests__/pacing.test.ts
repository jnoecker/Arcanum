import { describe, it, expect } from "vitest";
import {
  CASUAL_PRESET,
  LORE_EXPLORER_PRESET,
  HARDCORE_PRESET,
} from "@/lib/tuning/presets";
import {
  estimatePacing,
  estimateXpPerHour,
} from "@/lib/tuning/pacing";
import { checkPacingHealth } from "@/lib/tuning/healthCheck";
import { deepMerge } from "@/lib/tuning/merge";
import type { AppConfig } from "@/types/config";
import type { DeepPartial } from "@/lib/tuning/types";

/** Minimal base config. Presets specify the pacing-relevant fields in full. */
const BASE_CONFIG = {
  progression: {
    maxLevel: 50,
    xp: { baseXp: 100, exponent: 2.0, linearXp: 0, multiplier: 1.0, defaultKillXp: 10 },
    rewards: {
      hpScalingRate: 1.1,
      manaScalingRate: 1.1,
      fullHealOnLevelUp: true,
      fullManaOnLevelUp: true,
      baseHp: 30,
      baseMana: 30,
    },
  },
  mobTiers: {
    weak: { baseHp: 10, hpScalingRate: 1.1, baseMinDamage: 1, baseMaxDamage: 2, damageScalingRate: 1.0, baseArmor: 0, baseXpReward: 15, xpScalingRate: 1.15, baseGoldMin: 1, baseGoldMax: 3, goldScalingRate: 1.1 },
    standard: { baseHp: 20, hpScalingRate: 1.1, baseMinDamage: 2, baseMaxDamage: 4, damageScalingRate: 1.1, baseArmor: 1, baseXpReward: 30, xpScalingRate: 1.15, baseGoldMin: 3, baseGoldMax: 8, goldScalingRate: 1.1 },
    elite: { baseHp: 40, hpScalingRate: 1.1, baseMinDamage: 3, baseMaxDamage: 6, damageScalingRate: 1.1, baseArmor: 2, baseXpReward: 75, xpScalingRate: 1.15, baseGoldMin: 10, baseGoldMax: 25, goldScalingRate: 1.1 },
    boss: { baseHp: 80, hpScalingRate: 1.1, baseMinDamage: 6, baseMaxDamage: 12, damageScalingRate: 1.1, baseArmor: 4, baseXpReward: 200, xpScalingRate: 1.15, baseGoldMin: 30, baseGoldMax: 80, goldScalingRate: 1.1 },
  },
} as unknown as Record<string, unknown>;

function configFromPreset(preset: { config: DeepPartial<AppConfig> }): AppConfig {
  return deepMerge(
    BASE_CONFIG,
    preset.config as unknown as DeepPartial<Record<string, unknown>>,
  ) as unknown as AppConfig;
}

describe("estimateXpPerHour", () => {
  it("still scales XP rate with player level (per-level mob XP)", () => {
    const casual = configFromPreset(CASUAL_PRESET);
    expect(estimateXpPerHour(casual, 10)).toBeGreaterThan(estimateXpPerHour(casual, 1));
  });

  it("milestone minutes are monotonic in level for Casual", () => {
    const casual = configFromPreset(CASUAL_PRESET);
    const pacing = estimatePacing(casual, "casual");
    const ms = pacing.milestones.map((m) => m.minutesEstimated);
    for (let i = 1; i < ms.length; i++) {
      expect(ms[i]).toBeGreaterThanOrEqual(ms[i - 1]!);
    }
  });
});

describe("estimatePacing + checkPacingHealth — Lore Explorer now stays within contract", () => {
  const lore = configFromPreset(LORE_EXPLORER_PRESET);

  it("keeps every pacing milestone on-target for Lore Explorer's own archetype", () => {
    const pacing = estimatePacing(lore, "loreExplorer");
    expect(pacing.milestones.every((milestone) => milestone.verdict === "on-target")).toBe(true);
  });

  it("does not emit a pacing warning", () => {
    const warnings = checkPacingHealth(lore, "loreExplorer");
    expect(warnings).toEqual([]);
  });
});

describe("estimatePacing + checkPacingHealth — Casual stays on-target", () => {
  it("does not emit pacing warnings for the Casual preset against its own targets", () => {
    const casual = configFromPreset(CASUAL_PRESET);
    const warnings = checkPacingHealth(casual, "casual");
    expect(warnings).toEqual([]);
  });
});

describe("estimatePacing — Hardcore is intentionally slow, still on-target", () => {
  it("does not flag Hardcore as too-slow against its own targets", () => {
    const hardcore = configFromPreset(HARDCORE_PRESET);
    const warnings = checkPacingHealth(hardcore, "hardcore");
    expect(warnings).toEqual([]);
  });
});

describe("estimatePacing — stability", () => {
  it("is deterministic for a given config+preset", () => {
    const lore = configFromPreset(LORE_EXPLORER_PRESET);
    const a = estimatePacing(lore, "loreExplorer");
    const b = estimatePacing(lore, "loreExplorer");
    expect(a).toEqual(b);
  });

  it("returns no targets when presetId is unknown", () => {
    const lore = configFromPreset(LORE_EXPLORER_PRESET);
    const pacing = estimatePacing(lore, "unknownPreset");
    expect(pacing.targetsPresetId).toBeNull();
  });
});
