// ─── Merge Utilities ────────────────────────────────────────────────
//
// Shared deep merge and selective diff-to-partial builder for the
// Tuning Wizard apply flow. Used by both TuningWizard.tsx (preview)
// and tuningWizardStore.ts (apply).

import type { DeepPartial, DiffEntry } from "./types";
import { TuningSection } from "./types";

/** Recursively merge a DeepPartial overlay onto a base config. */
export function deepMerge<T extends Record<string, unknown>>(base: T, overlay: DeepPartial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(overlay)) {
    const ov = (overlay as Record<string, unknown>)[key];
    const bv = (base as Record<string, unknown>)[key];
    if (
      ov != null &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      bv != null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      result[key] = deepMerge(
        bv as Record<string, unknown>,
        ov as DeepPartial<Record<string, unknown>>,
      );
    } else if (ov !== undefined) {
      result[key] = ov;
    }
  }
  return result as T;
}

/** Set a value at a dot-separated path in a nested object (mutates). */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]!] = value;
}

/** Build a sparse partial config from only the diffs belonging to accepted sections. */
export function buildPartialFromDiffs(
  diffs: DiffEntry[],
  acceptedSections: Set<TuningSection>,
): Record<string, unknown> {
  const partial: Record<string, unknown> = {};
  for (const diff of diffs) {
    if (acceptedSections.has(diff.section)) {
      setNestedValue(partial, diff.path, diff.newValue);
    }
  }
  return partial;
}
