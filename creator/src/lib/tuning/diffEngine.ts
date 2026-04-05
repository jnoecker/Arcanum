// ─── Diff Engine ───────────────────────────────────────────────────
//
// Recursive config comparison producing flat DiffEntry[] with dot-path
// keys. Only fields present in FIELD_METADATA are compared (tunable
// scalars). Definition registries and non-gameplay paths are ignored.

import type { DiffEntry } from "./types";
import { TuningSection } from "./types";
import { FIELD_METADATA } from "./fieldMetadata";

/** Walk a dot-path to read a nested value from an object. */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

/**
 * Compute field-level diffs between two config objects.
 *
 * Only paths present in FIELD_METADATA are compared. For each changed
 * tunable field, a DiffEntry is produced with the human-readable label
 * and section from metadata.
 *
 * @param current - The current/baseline config (partial or full)
 * @param preset  - The preset/target config to compare against
 * @param prefix  - Internal: dot-path prefix for recursion
 */
export function computeDiff(
  current: Record<string, unknown>,
  preset: Record<string, unknown>,
  prefix?: string,
): DiffEntry[] {
  const results: DiffEntry[] = [];

  for (const key of Object.keys(preset)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const presetVal = (preset as Record<string, unknown>)[key];

    // If the value is a non-null, non-array object, recurse
    if (presetVal !== null && typeof presetVal === "object" && !Array.isArray(presetVal)) {
      results.push(...computeDiff(
        current,
        presetVal as Record<string, unknown>,
        path,
      ));
      continue;
    }

    // Leaf value -- check if it's a tunable field
    const meta = FIELD_METADATA[path];
    if (!meta) continue;

    const currentVal = getNestedValue(current, path);
    if (currentVal !== presetVal) {
      results.push({
        path,
        label: meta.label,
        section: meta.section,
        oldValue: currentVal,
        newValue: presetVal,
      });
    }
  }

  return results;
}

/**
 * Group diff entries by their TuningSection.
 *
 * Returns a record with all 4 sections initialized to empty arrays,
 * then populated with matching entries.
 */
export function groupDiffBySection(entries: DiffEntry[]): Record<string, DiffEntry[]> {
  const grouped: Record<string, DiffEntry[]> = {
    [TuningSection.CombatStats]: [],
    [TuningSection.EconomyCrafting]: [],
    [TuningSection.ProgressionQuests]: [],
    [TuningSection.WorldSocial]: [],
  };

  for (const entry of entries) {
    const bucket = grouped[entry.section];
    if (bucket) {
      bucket.push(entry);
    }
  }

  return grouped;
}
