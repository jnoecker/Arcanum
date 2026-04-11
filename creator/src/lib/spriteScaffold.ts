/**
 * Sprite scaffolding — computes expected sprite combos based on a chosen mode,
 * detects gaps vs existing definitions, and creates missing definitions.
 */
import type { AppConfig } from "@/types/config";
import type { SpriteDefinition } from "@/types/sprites";

// ─── Types ──────────────────────────────────────────────────────────

export type ScaffoldMode = "race_class" | "race_only" | "class_only";

export interface SpriteSlot {
  id: string;
  race?: string;
  playerClass?: string;
  gender?: string;
}

export interface GapSummary {
  expected: SpriteSlot[];
  existing: SpriteSlot[];
  missing: SpriteSlot[];
  byGroup: Record<string, { total: number; existing: number; missing: number }>;
}

// ─── Slot computation ───────────────────────────────────────────────

function buildSlots(
  axis1: string[],
  axis2: string[] | null,
  genders: string[],
  makeSlot: (a: string, b: string | null, g?: string) => SpriteSlot,
): SpriteSlot[] {
  const slots: SpriteSlot[] = [];
  for (const a of axis1) {
    const bValues = axis2 ?? [null];
    for (const b of bValues) {
      if (genders.length === 0) {
        slots.push(makeSlot(a, b));
      } else {
        for (const g of genders) {
          slots.push(makeSlot(a, b, g));
        }
      }
    }
  }
  return slots;
}

export function computeExpectedSlots(
  config: AppConfig,
  genders: string[],
  mode: ScaffoldMode,
): SpriteSlot[] {
  const races = Object.keys(config.races);
  const classes = Object.keys(config.classes).filter((c) => c !== "base");

  switch (mode) {
    case "race_class":
      return buildSlots(races, classes, genders, (race, cls, gender) => ({
        id: [race, cls, gender].filter(Boolean).join("_"),
        race,
        playerClass: cls!,
        gender,
      }));

    case "race_only":
      return buildSlots(races, null, genders, (race, _, gender) => ({
        id: [race, gender].filter(Boolean).join("_"),
        race,
        gender,
      }));

    case "class_only":
      return buildSlots(classes, null, genders, (cls, _, gender) => ({
        id: [cls, gender].filter(Boolean).join("_"),
        playerClass: cls,
        gender,
      }));
  }
}

// ─── Gap detection ──────────────────────────────────────────────────

function definitionMatchesSlot(
  id: string,
  def: SpriteDefinition,
  slot: SpriteSlot,
): boolean {
  if (id === slot.id) return true;

  const raceReq = def.requirements.find((r) => r.type === "race");
  const classReq = def.requirements.find((r) => r.type === "class");

  if (slot.race) {
    if (!(raceReq?.type === "race" && raceReq.race === slot.race)) return false;
  } else {
    if (raceReq) return false;
  }

  if (slot.playerClass) {
    if (!(classReq?.type === "class" && classReq.playerClass === slot.playerClass)) return false;
  } else {
    if (classReq) return false;
  }

  if (slot.gender) {
    return def.gender === slot.gender;
  }
  return !def.gender;
}

export function computeGaps(
  config: AppConfig,
  definitions: Record<string, SpriteDefinition>,
  genders: string[],
  mode: ScaffoldMode,
): GapSummary {
  const expected = computeExpectedSlots(config, genders, mode);
  const defEntries = Object.entries(definitions);

  const existing: SpriteSlot[] = [];
  const missing: SpriteSlot[] = [];

  for (const slot of expected) {
    const found = defEntries.some(([id, def]) => definitionMatchesSlot(id, def, slot));
    if (found) {
      existing.push(slot);
    } else {
      missing.push(slot);
    }
  }

  const groupKeyFn = mode === "class_only"
    ? (s: SpriteSlot) => s.playerClass ?? "—"
    : (s: SpriteSlot) => s.race ?? "—";
  const byGroup: GapSummary["byGroup"] = {};
  for (const slot of expected) {
    const key = groupKeyFn(slot);
    if (!byGroup[key]) byGroup[key] = { total: 0, existing: 0, missing: 0 };
    byGroup[key]!.total++;
  }
  for (const slot of existing) {
    byGroup[groupKeyFn(slot)]!.existing++;
  }
  for (const slot of missing) {
    byGroup[groupKeyFn(slot)]!.missing++;
  }

  return { expected, existing, missing, byGroup };
}

// ─── Definition scaffolding ─────────────────────────────────────────

function slotDisplayName(slot: SpriteSlot, config: AppConfig): string {
  const parts: string[] = [];
  if (slot.race) parts.push(config.races[slot.race]?.displayName ?? slot.race);
  if (slot.playerClass) parts.push(config.classes[slot.playerClass]?.displayName ?? slot.playerClass);
  if (slot.gender) parts.push(`(${slot.gender})`);
  return parts.join(" ") || slot.id;
}

export function scaffoldDefinition(
  slot: SpriteSlot,
  config: AppConfig,
  sortBase: number,
): SpriteDefinition {
  const requirements: SpriteDefinition["requirements"] = [];
  if (slot.race) requirements.push({ type: "race", race: slot.race });
  if (slot.playerClass) requirements.push({ type: "class", playerClass: slot.playerClass });

  const def: SpriteDefinition = {
    displayName: slotDisplayName(slot, config),
    category: "general",
    sortOrder: sortBase,
    requirements,
    image: `player_sprites/${slot.id}.png`,
  };

  if (slot.gender) {
    def.gender = slot.gender;
  }

  return def;
}

export function scaffoldDefinitions(
  slots: SpriteSlot[],
  config: AppConfig,
  existingCount: number,
): [string, SpriteDefinition][] {
  return slots.map((slot, i) => [
    slot.id,
    scaffoldDefinition(slot, config, (existingCount + i) * 10),
  ]);
}
