// ─── Tuning Presets ─────────────────────────────────────────────────
//
// Three themed presets (Casual, Balanced, Hardcore) as DeepPartial<AppConfig>
// overlays covering all 137 tunable fields from FIELD_METADATA.
//
// Each preset is a standalone overlay -- not derived from Kotlin defaults.
// Use with applyTemplate() from lib/templates.ts to merge onto a config.

import type { AppConfig } from "@/types/config";
import type { DeepPartial } from "./types";
import { TuningSection } from "./types";

/** A themed tuning preset with metadata and config overlay. */
export interface TuningPreset {
  id: string;
  name: string;
  description: string;
  sectionDescriptions: Partial<Record<TuningSection, string>>;
  config: DeepPartial<AppConfig>;
}

// ─── Casual Preset ───────────────────────────────────────────────────

export const CASUAL_PRESET: TuningPreset = {
  id: "casual",
  name: "Casual Adventure",
  description:
    "A relaxed experience with faster progression, gentler combat, and generous rewards. Ideal for story-focused or solo play.",
  sectionDescriptions: {},
  config: {},
};

// ─── Balanced Preset ─────────────────────────────────────────────────

export const BALANCED_PRESET: TuningPreset = {
  id: "balanced",
  name: "Balanced Realm",
  description:
    "A well-tuned middle ground with satisfying combat pacing, steady progression, and a healthy economy. Good for most builders.",
  sectionDescriptions: {},
  config: {},
};

// ─── Hardcore Preset ─────────────────────────────────────────────────

export const HARDCORE_PRESET: TuningPreset = {
  id: "hardcore",
  name: "Hardcore Challenge",
  description:
    "A punishing world where every level is earned, resources are scarce, and combat demands preparation. For experienced MUD players.",
  sectionDescriptions: {},
  config: {},
};

/** All available tuning presets for iteration. */
export const TUNING_PRESETS: TuningPreset[] = [
  CASUAL_PRESET,
  BALANCED_PRESET,
  HARDCORE_PRESET,
];
