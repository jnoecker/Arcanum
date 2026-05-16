// Calibration snapshot — records the actual minutes-to-level numbers
// the estimator produces for each preset. Not an assertion of correctness,
// just a pinned record so future tuning changes surface in diffs.

import { describe, it, expect } from "vitest";
import {
  CASUAL_PRESET,
  BALANCED_PRESET,
  HARDCORE_PRESET,
  SOLO_STORY_PRESET,
  PVP_ARENA_PRESET,
  LORE_EXPLORER_PRESET,
} from "@/lib/tuning/presets";
import { estimatePacing } from "@/lib/tuning/pacing";
import { deepMerge } from "@/lib/tuning/merge";
import type { AppConfig } from "@/types/config";
import type { DeepPartial } from "@/lib/tuning/types";

const BASE_CONFIG = {
  progression: {
    maxLevel: 30,
    xp: { baseXp: 800, exponent: 2.2, linearXp: 1200, multiplier: 1.0, defaultKillXp: 60 },
    rewards: { hpScalingRate: 1.099, manaScalingRate: 1.096, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 130, baseMana: 120 },
  },
  mobTiers: {
    weak: { baseHp: 36, hpScalingRate: 1.097, baseMinDamage: 1, baseMaxDamage: 3, damageScalingRate: 1.085, baseArmor: 0, baseXpReward: 70, xpScalingRate: 1.087, baseGoldMin: 2, baseGoldMax: 6, goldScalingRate: 1.085 },
    standard: { baseHp: 150, hpScalingRate: 1.085, baseMinDamage: 5, baseMaxDamage: 12, damageScalingRate: 1.075, baseArmor: 1, baseXpReward: 220, xpScalingRate: 1.078, baseGoldMin: 5, baseGoldMax: 14, goldScalingRate: 1.080 },
    elite: { baseHp: 400, hpScalingRate: 1.054, baseMinDamage: 10, baseMaxDamage: 22, damageScalingRate: 1.057, baseArmor: 2, baseXpReward: 600, xpScalingRate: 1.075, baseGoldMin: 18, baseGoldMax: 45, goldScalingRate: 1.072 },
    boss: { baseHp: 1000, hpScalingRate: 1.068, baseMinDamage: 20, baseMaxDamage: 45, damageScalingRate: 1.072, baseArmor: 4, baseXpReward: 2000, xpScalingRate: 1.068, baseGoldMin: 70, baseGoldMax: 150, goldScalingRate: 1.059 },
  },
} as unknown as Record<string, unknown>;

function configFromPreset(preset: { config: DeepPartial<AppConfig> }): AppConfig {
  return deepMerge(
    BASE_CONFIG,
    preset.config as unknown as DeepPartial<Record<string, unknown>>,
  ) as unknown as AppConfig;
}

const PRESETS: Array<[string, { config: DeepPartial<AppConfig> }]> = [
  ["loreExplorer", LORE_EXPLORER_PRESET],
  ["soloStory", SOLO_STORY_PRESET],
  ["casual", CASUAL_PRESET],
  ["balanced", BALANCED_PRESET],
  ["pvpArena", PVP_ARENA_PRESET],
  ["hardcore", HARDCORE_PRESET],
];

describe("pacing calibration snapshots", () => {
  it.each(PRESETS)("does not way-too-fast-flag %s against its own targets", (id, preset) => {
    const pacing = estimatePacing(configFromPreset(preset), id);
    const wayTooFast = pacing.milestones.filter((m) => m.verdict === "way-too-fast");
    expect(wayTooFast.map((m) => m.level)).toEqual([]);
  });
});
