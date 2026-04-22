import { describe, expect, it } from "vitest";
import { evaluateArchetype } from "@/lib/tuning/archetypeScore";
import { getArchetypeContract } from "@/lib/tuning/archetypes";
import {
  BALANCED_PRESET,
  CASUAL_PRESET,
  HARDCORE_PRESET,
  LORE_EXPLORER_PRESET,
  PVP_ARENA_PRESET,
  SOLO_STORY_PRESET,
  TUNING_PRESETS,
} from "@/lib/tuning/presets";
import type { AppConfig } from "@/types/config";

function configFromPreset(preset: { config: object }): AppConfig {
  return {
    classes: {},
    ...preset.config,
  } as AppConfig;
}

describe("archetype contracts", () => {
  it("defines a contract for every tuning preset", () => {
    for (const preset of TUNING_PRESETS) {
      expect(getArchetypeContract(preset.id), `missing contract for ${preset.id}`).toBeTruthy();
    }
  });
});

describe("archetype evaluation", () => {
  it("marks the main curated presets as validated", () => {
    expect(evaluateArchetype(configFromPreset(CASUAL_PRESET), CASUAL_PRESET.id)?.status).toBe("validated");
    expect(evaluateArchetype(configFromPreset(BALANCED_PRESET), BALANCED_PRESET.id)?.status).toBe("validated");
    expect(evaluateArchetype(configFromPreset(HARDCORE_PRESET), HARDCORE_PRESET.id)?.status).toBe("validated");
    expect(evaluateArchetype(configFromPreset(SOLO_STORY_PRESET), SOLO_STORY_PRESET.id)?.status).toBe("validated");
    expect(evaluateArchetype(configFromPreset(PVP_ARENA_PRESET), PVP_ARENA_PRESET.id)?.status).toBe("validated");
    expect(evaluateArchetype(configFromPreset(LORE_EXPLORER_PRESET), LORE_EXPLORER_PRESET.id)?.status).toBe("validated");
  });

  it("keeps Casual fully inside its contract without warning-level drift", () => {
    const evaluation = evaluateArchetype(configFromPreset(CASUAL_PRESET), CASUAL_PRESET.id);
    expect(evaluation?.status).toBe("validated");
    expect(evaluation?.warnCount).toBe(0);
    expect(evaluation?.failCount).toBe(0);
  });

  it("keeps Lore Explorer extremely fast without failing its own pacing contract", () => {
    const evaluation = evaluateArchetype(configFromPreset(LORE_EXPLORER_PRESET), LORE_EXPLORER_PRESET.id);
    expect(evaluation?.status).toBe("validated");
    expect(
      evaluation?.checks
        .filter((check) => check.category === "pacing" && check.status === "fail")
        .map((check) => check.label),
    ).toEqual([]);
  });
});
