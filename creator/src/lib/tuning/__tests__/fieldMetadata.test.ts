import { describe, it, expect } from "vitest";
import { FIELD_METADATA, getFieldMeta, getFieldsBySection } from "@/lib/tuning/fieldMetadata";
import { TuningSection } from "@/lib/tuning/types";

// ─── FIELD_METADATA structure ──────────────────────────────────────

describe("FIELD_METADATA", () => {
  const entries = Object.entries(FIELD_METADATA);

  it("has entries for known config paths", () => {
    expect(FIELD_METADATA["progression.xp.baseXp"]).toBeDefined();
    expect(FIELD_METADATA["combat.tickMillis"]).toBeDefined();
    expect(FIELD_METADATA["economy.buyMultiplier"]).toBeDefined();
    expect(FIELD_METADATA["mobTiers.weak.baseHp"]).toBeDefined();
    expect(FIELD_METADATA["regen.baseIntervalMillis"]).toBeDefined();
  });

  it("every key is a valid dot-path (contains at least one dot)", () => {
    for (const [path] of entries) {
      expect(path).toContain(".");
    }
  });

  it("every entry has a non-empty label", () => {
    for (const [path, meta] of entries) {
      expect(meta.label, `${path} missing label`).toBeTruthy();
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
    }
  });

  it("every entry has a non-empty description", () => {
    for (const [path, meta] of entries) {
      expect(meta.description, `${path} missing description`).toBeTruthy();
      expect(typeof meta.description).toBe("string");
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("every entry has a valid section", () => {
    const validSections = new Set([
      TuningSection.CombatStats,
      TuningSection.EconomyCrafting,
      TuningSection.ProgressionQuests,
      TuningSection.WorldSocial,
    ]);
    for (const [path, meta] of entries) {
      expect(validSections.has(meta.section), `${path} has invalid section: ${meta.section}`).toBe(true);
    }
  });

  it("every entry has a valid impact value", () => {
    const validImpacts = new Set(["high", "medium", "low"]);
    for (const [path, meta] of entries) {
      expect(validImpacts.has(meta.impact), `${path} has invalid impact: ${meta.impact}`).toBe(true);
    }
  });

  it("all 4 sections have at least 5 entries each", () => {
    const sectionCounts = new Map<string, number>();
    for (const [, meta] of entries) {
      sectionCounts.set(meta.section, (sectionCounts.get(meta.section) ?? 0) + 1);
    }
    expect(sectionCounts.get(TuningSection.CombatStats)).toBeGreaterThanOrEqual(5);
    expect(sectionCounts.get(TuningSection.EconomyCrafting)).toBeGreaterThanOrEqual(5);
    expect(sectionCounts.get(TuningSection.ProgressionQuests)).toBeGreaterThanOrEqual(5);
    expect(sectionCounts.get(TuningSection.WorldSocial)).toBeGreaterThanOrEqual(5);
  });
});

// ─── getFieldMeta ──────────────────────────────────────────────────

describe("getFieldMeta", () => {
  it("returns FieldMeta for a known path", () => {
    const meta = getFieldMeta("progression.xp.baseXp");
    expect(meta).toBeDefined();
    expect(meta!.label).toBe("Base XP");
    expect(meta!.section).toBe(TuningSection.ProgressionQuests);
  });

  it("returns undefined for a nonexistent path", () => {
    expect(getFieldMeta("nonexistent.path")).toBeUndefined();
  });
});

// ─── getFieldsBySection ────────────────────────────────────────────

describe("getFieldsBySection", () => {
  it("returns only entries with the requested section", () => {
    const combatFields = getFieldsBySection(TuningSection.CombatStats);
    expect(combatFields.length).toBeGreaterThan(0);
    for (const { meta } of combatFields) {
      expect(meta.section).toBe(TuningSection.CombatStats);
    }
  });

  it("includes path and meta in each result", () => {
    const fields = getFieldsBySection(TuningSection.EconomyCrafting);
    expect(fields.length).toBeGreaterThan(0);
    for (const entry of fields) {
      expect(entry.path).toBeDefined();
      expect(entry.meta).toBeDefined();
      expect(entry.path).toContain(".");
    }
  });
});
