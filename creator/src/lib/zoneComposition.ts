// ─── Zone Composition Analysis ─────────────────────────────────────
//
// Pure analytics for the "is this zone's mob composition shaped right?"
// check. Given a WorldFile, compute the level distribution of combatant
// mobs and compare it against best-practice templates from
// docs/DERIVED_STATS.md:
//
//   Anchor zone:       100% of mobs at level N
//   Bridge zone N→N+1: ~75% at level N,   25% at level N+1
//   Bridge zone N+1:   ~75% at level N+1, 25% at level N
//
// The analysis is informational, not blocking — over-level boss spikes are
// a legitimate authoring choice and surface as "intentional?" hints rather
// than errors.

import type { WorldFile, MobFile } from "@/types/world";

export type CompositionShape =
  | "anchor"
  | "bridge"
  | "wide"
  | "off-spec"
  | "empty";

export interface LevelBucket {
  level: number;
  count: number;
  percent: number;
}

export interface CompositionWarning {
  mobId: string;
  mobLevel: number;
  message: string;
}

export interface ZoneComposition {
  /** Combatant mobs with a resolvable level. */
  totalMobs: number;
  /** Mobs with no level set (default to 1 server-side). */
  missingLevelCount: number;
  /** Distribution by level, sorted ascending. */
  buckets: LevelBucket[];
  /** Shape best matching the distribution. */
  shape: CompositionShape;
  /** Inferred target level (the modal level — most populous bucket). */
  inferredTarget: number | null;
  /** Inferred secondary level for bridges (the 25% bucket). */
  inferredBridgeTo: number | null;
  /** Mobs that fall outside the levelBand by ±2 or more. */
  warnings: CompositionWarning[];
  /** Human-readable summary line. */
  summary: string;
}

const COMBAT_ROLE: NonNullable<MobFile["role"]> = "combat";

function isCombatant(mob: MobFile): boolean {
  return (mob.role ?? COMBAT_ROLE) === COMBAT_ROLE;
}

export function analyzeZoneComposition(world: WorldFile): ZoneComposition {
  const counts = new Map<number, number>();
  let missing = 0;
  const mobs = world.mobs ?? {};
  const combatants: Array<[string, MobFile]> = [];
  for (const [id, mob] of Object.entries(mobs)) {
    if (!isCombatant(mob)) continue;
    combatants.push([id, mob]);
    if (mob.level == null) {
      missing++;
      continue;
    }
    counts.set(mob.level, (counts.get(mob.level) ?? 0) + 1);
  }
  const totalWithLevel = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const buckets: LevelBucket[] = Array.from(counts.entries())
    .map(([level, count]) => ({
      level,
      count,
      percent: totalWithLevel > 0 ? (count * 100) / totalWithLevel : 0,
    }))
    .sort((a, b) => a.level - b.level);

  const { shape, inferredTarget, inferredBridgeTo } = classifyShape(buckets);

  const warnings: CompositionWarning[] = [];
  const band = world.levelBand;
  if (band) {
    for (const [id, mob] of combatants) {
      if (mob.level == null) continue;
      if (mob.level < band.min - 1 || mob.level > band.max + 1) {
        warnings.push({
          mobId: id,
          mobLevel: mob.level,
          message: `Level ${mob.level} is outside the zone's L${band.min}–${band.max} band by ${
            mob.level < band.min ? band.min - mob.level : mob.level - band.max
          }. Intentional spike?`,
        });
      }
    }
  }

  return {
    totalMobs: combatants.length,
    missingLevelCount: missing,
    buckets,
    shape,
    inferredTarget,
    inferredBridgeTo,
    warnings,
    summary: buildSummary(shape, inferredTarget, inferredBridgeTo, combatants.length),
  };
}

function classifyShape(
  buckets: LevelBucket[],
): {
  shape: CompositionShape;
  inferredTarget: number | null;
  inferredBridgeTo: number | null;
} {
  if (buckets.length === 0) {
    return { shape: "empty", inferredTarget: null, inferredBridgeTo: null };
  }
  // Sort buckets by count descending to find the modal level.
  const ranked = [...buckets].sort((a, b) => b.count - a.count);
  const modal = ranked[0]!;
  if (buckets.length === 1) {
    return { shape: "anchor", inferredTarget: modal.level, inferredBridgeTo: null };
  }
  const second = ranked[1]!;
  // Wide distribution: more than 2 distinct levels OR span > 1 level between top two.
  if (Math.abs(modal.level - second.level) > 1 || buckets.length > 2) {
    // If span > 1 it's "off-spec"; if just 3+ adjacent levels it's "wide".
    const span = buckets[buckets.length - 1]!.level - buckets[0]!.level;
    if (span > 2) {
      return { shape: "off-spec", inferredTarget: modal.level, inferredBridgeTo: null };
    }
    return { shape: "wide", inferredTarget: modal.level, inferredBridgeTo: null };
  }
  // Two adjacent levels — this is a bridge. Detect whether the split is close
  // to the 75/25 ideal.
  const modalPct = modal.percent;
  if (modalPct >= 60 && modalPct <= 90) {
    return {
      shape: "bridge",
      inferredTarget: modal.level,
      inferredBridgeTo: second.level,
    };
  }
  // Roughly 50/50 across two levels — not a clean bridge, more like a wide
  // anchor straddling two values.
  return {
    shape: "wide",
    inferredTarget: modal.level,
    inferredBridgeTo: second.level,
  };
}

function buildSummary(
  shape: CompositionShape,
  target: number | null,
  bridgeTo: number | null,
  totalMobs: number,
): string {
  if (totalMobs === 0) return "No combatant mobs in this zone.";
  switch (shape) {
    case "empty":
      return "No combatant mobs with explicit levels.";
    case "anchor":
      return `Anchor zone for level ${target}.`;
    case "bridge":
      return target! < (bridgeTo ?? 0)
        ? `Bridge zone: mostly L${target}, partial L${bridgeTo}.`
        : `Bridge zone: mostly L${target}, partial L${bridgeTo}.`;
    case "wide":
      return `Wide composition centered on L${target}${
        bridgeTo != null ? ` with L${bridgeTo} mix` : ""
      }.`;
    case "off-spec":
      return `Off-spec composition: levels span more than 2 around L${target}.`;
  }
}
