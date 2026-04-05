// ─── Tuning Wizard Types ───────────────────────────────────────────

import type { AppConfig } from "@/types/config";

/** Recursive partial -- allows presets to specify any subset of AppConfig. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** The 4 coarse sections for grouping tunable fields (D-01). */
export const enum TuningSection {
  CombatStats = "Combat & Stats",
  EconomyCrafting = "Economy & Crafting",
  ProgressionQuests = "Progression & Quests",
  WorldSocial = "World & Social",
}

/** Rich metadata for a single tunable field (D-05). */
export interface FieldMeta {
  label: string;
  description: string;
  section: TuningSection;
  min?: number;
  max?: number;
  impact: "high" | "medium" | "low";
  interactionNote?: string;
}

/** A single field-level diff between current config and preset. */
export interface DiffEntry {
  path: string;
  label: string;
  section: TuningSection;
  oldValue: unknown;
  newValue: unknown;
}

/** Derived metrics evaluated at representative levels. */
export interface MetricSnapshot {
  xpPerLevel: Record<number, number>;
  mobHp: Record<string, Record<number, number>>;
  mobDamageAvg: Record<string, Record<number, number>>;
  mobGoldAvg: Record<string, Record<number, number>>;
  playerDamageBonus: Record<number, number>;
  playerHp: Record<number, number>;
  dodgeChance: Record<number, number>;
  regenInterval: Record<number, number>;
}

/** Levels at which to evaluate formulas for comparison snapshots (D-04). */
export const REPRESENTATIVE_LEVELS = [1, 5, 10, 20, 30, 50] as const;
