import type { MobTiersConfig, StatBindings } from "@/types/config";
import {
  extractHealSchool,
  extractSpellSchool,
} from "@/types/config";
import {
  computeAttackDamage,
  mobHpAtLevel,
} from "@/lib/tuning/formulas";

const BASE_STAT = 10;

type AbilityPowerKind = "damage" | "heal";

function levelSteps(level: number): number {
  return Math.max(1, level) - 1;
}

function schoolFor(kind: AbilityPowerKind, bindings: StatBindings) {
  return kind === "heal"
    ? extractHealSchool(bindings)
    : extractSpellSchool(bindings);
}

export function standardMobHpForAbilityLevel(
  mobTiers: MobTiersConfig,
  level: number,
): number {
  return mobHpAtLevel(mobTiers.standard, level);
}

export function abilityHitsForAuthoredPower(
  authoredPower: number,
  level: number,
  mobTiers: MobTiersConfig,
  bindings: StatBindings,
  kind: AbilityPowerKind,
): number {
  if (authoredPower <= 0) return 0;
  const hp = standardMobHpForAbilityLevel(mobTiers, level);
  const school = schoolFor(kind, bindings);
  const resolved = computeAttackDamage(school, authoredPower, BASE_STAT, level, 0);
  return hp / resolved.avg;
}

export function authoredPowerForAbilityHits(
  hits: number,
  level: number,
  mobTiers: MobTiersConfig,
  bindings: StatBindings,
  kind: AbilityPowerKind,
): number {
  if (hits <= 0) return 0;
  const hp = standardMobHpForAbilityLevel(mobTiers, level);
  const targetAverage = hp / hits;
  const school = schoolFor(kind, bindings);
  const levelScale = Math.pow(school.levelScalingRate, levelSteps(level));
  const varianceAverage = (school.varianceMin + school.varianceMax) / 2;
  const estimate = targetAverage / Math.max(levelScale * varianceAverage, 0.0001);
  let best = Math.max(1, Math.round(estimate));
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let candidate = Math.max(1, Math.floor(estimate) - 8); candidate <= Math.ceil(estimate) + 8; candidate += 1) {
    const resolved = computeAttackDamage(school, candidate, BASE_STAT, level, 0);
    const distance = Math.abs(resolved.avg - targetAverage);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}
