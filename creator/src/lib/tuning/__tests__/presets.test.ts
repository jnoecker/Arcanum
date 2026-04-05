import { describe, it, expect } from "vitest";
import { TUNING_PRESETS } from "@/lib/tuning/presets";
import type { TuningPreset } from "@/lib/tuning/presets";
import { FIELD_METADATA } from "@/lib/tuning/fieldMetadata";
import { TuningSection } from "@/lib/tuning/types";

// ─── Helpers ─────────────────────────────────────────────────────────

/** Resolve a dot-path against an object. Returns undefined if any segment is missing. */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object"
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    obj,
  );
}

const ALL_SECTIONS = [
  TuningSection.CombatStats,
  TuningSection.EconomyCrafting,
  TuningSection.ProgressionQuests,
  TuningSection.WorldSocial,
];

// ─── Preset Structure ────────────────────────────────────────────────

describe("preset structure", () => {
  it("TUNING_PRESETS has exactly 3 entries", () => {
    expect(TUNING_PRESETS).toHaveLength(3);
  });

  it("each preset has a valid id", () => {
    const ids = TUNING_PRESETS.map((p: TuningPreset) => p.id);
    expect(ids).toContain("casual");
    expect(ids).toContain("balanced");
    expect(ids).toContain("hardcore");
  });

  it("each preset has a non-empty name", () => {
    for (const preset of TUNING_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it("each preset has a non-empty description", () => {
    for (const preset of TUNING_PRESETS) {
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});

// ─── Section Descriptions ────────────────────────────────────────────

describe("sectionDescriptions", () => {
  for (const preset of TUNING_PRESETS) {
    describe(preset.id, () => {
      for (const section of ALL_SECTIONS) {
        it(`has description for "${section}"`, () => {
          expect(preset.sectionDescriptions[section]).toBeDefined();
          expect(
            (preset.sectionDescriptions[section] as string).length,
          ).toBeGreaterThan(0);
        });
      }
    });
  }
});

// ─── Field Coverage ──────────────────────────────────────────────────

describe("field coverage", () => {
  const allPaths = Object.keys(FIELD_METADATA);

  it("FIELD_METADATA has 137 entries (sanity check)", () => {
    expect(allPaths).toHaveLength(137);
  });

  for (const preset of TUNING_PRESETS) {
    describe(preset.id, () => {
      for (const path of allPaths) {
        it(`covers field: ${path}`, () => {
          const value = getNestedValue(
            preset.config as Record<string, unknown>,
            path,
          );
          expect(value, `${preset.id} missing field: ${path}`).not.toBeUndefined();
        });
      }
    });
  }
});
