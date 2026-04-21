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
    maxLevel: 50,
    xp: { baseXp: 100, exponent: 2.0, linearXp: 0, multiplier: 1.0, defaultKillXp: 10 },
    rewards: { hpPerLevel: 4, manaPerLevel: 3, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 30, baseMana: 30 },
  },
  mobTiers: {
    weak: { baseHp: 10, hpPerLevel: 3, baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0, baseArmor: 0, baseXpReward: 15, xpRewardPerLevel: 5, baseGoldMin: 1, baseGoldMax: 3, goldPerLevel: 1 },
    standard: { baseHp: 20, hpPerLevel: 5, baseMinDamage: 2, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 1, baseXpReward: 30, xpRewardPerLevel: 10, baseGoldMin: 3, baseGoldMax: 8, goldPerLevel: 2 },
    elite: { baseHp: 40, hpPerLevel: 8, baseMinDamage: 3, baseMaxDamage: 6, damagePerLevel: 1, baseArmor: 2, baseXpReward: 75, xpRewardPerLevel: 25, baseGoldMin: 10, baseGoldMax: 25, goldPerLevel: 5 },
    boss: { baseHp: 80, hpPerLevel: 15, baseMinDamage: 6, baseMaxDamage: 12, damagePerLevel: 2, baseArmor: 4, baseXpReward: 200, xpRewardPerLevel: 50, baseGoldMin: 30, baseGoldMax: 80, goldPerLevel: 15 },
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
    expect(wayTooFast.map((m) => m.level)).toEqual(
      id === "loreExplorer" ? expect.arrayContaining([20, 30]) : [],
    );
  });
});
