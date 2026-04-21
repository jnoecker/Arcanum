import { describe, it, expect } from "vitest";
import {
  CASUAL_PRESET,
  LORE_EXPLORER_PRESET,
  HARDCORE_PRESET,
} from "@/lib/tuning/presets";
import {
  estimatePacing,
  estimateXpPerHour,
  PRESET_PACING_TARGETS,
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
      hpPerLevel: 4,
      manaPerLevel: 3,
      fullHealOnLevelUp: true,
      fullManaOnLevelUp: true,
      baseHp: 30,
      baseMana: 30,
    },
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

describe("estimateXpPerHour", () => {
  it("produces dramatically more XP for the Lore Explorer preset than Casual", () => {
    const casual = configFromPreset(CASUAL_PRESET);
    const lore = configFromPreset(LORE_EXPLORER_PRESET);
    const casualXp = estimateXpPerHour(casual, 1);
    const loreXp = estimateXpPerHour(lore, 1);
    expect(loreXp).toBeGreaterThan(casualXp * 2);
  });

  it("scales XP rate with player level (per-level mob XP)", () => {
    const casual = configFromPreset(CASUAL_PRESET);
    expect(estimateXpPerHour(casual, 10)).toBeGreaterThan(estimateXpPerHour(casual, 1));
  });
});

describe("estimatePacing + checkPacingHealth — Lore Explorer over-generosity", () => {
  const lore = configFromPreset(LORE_EXPLORER_PRESET);

  it("flags level 20 as reachable much faster than the preset's own target", () => {
    const pacing = estimatePacing(lore, "loreExplorer");
    const m20 = pacing.milestones.find((m) => m.level === 20);
    expect(m20).toBeDefined();
    const target = PRESET_PACING_TARGETS.loreExplorer?.minutesToLevel[20];
    expect(target).toBe(30);
    expect(m20!.minutesEstimated).toBeLessThan(target! * 0.5);
    expect(m20!.verdict === "fast" || m20!.verdict === "way-too-fast").toBe(true);
  });

  it("emits a too-fast pacing warning", () => {
    const warnings = checkPacingHealth(lore, "loreExplorer");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toMatch(/too fast/i);
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
