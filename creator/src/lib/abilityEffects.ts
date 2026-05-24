import type { AbilityEffectConfig } from "@/types/config";

/**
 * Mirrors the server's `AbilityEffect.flatten()` — recursively unwraps
 * `COMPOSITE` effects into a flat list of leaf effects. Non-composite effects
 * return themselves as a single-element list.
 */
export function flattenEffect(effect: AbilityEffectConfig): AbilityEffectConfig[] {
  if (effect.type === "COMPOSITE") {
    return (effect.effects ?? []).flatMap(flattenEffect);
  }
  return [effect];
}

/**
 * Effect type used for client-side defaults (icon visual, animation
 * archetype). For composites the *first leaf* drives the choice, matching the
 * server's `primaryEffectType()` — a "damage + DoT" composite still presents
 * as a damage spell.
 */
export function primaryEffectType(effect: AbilityEffectConfig): string {
  const flat = flattenEffect(effect);
  return flat[0]?.type ?? effect.type;
}

/**
 * Per-target-type allowlists for ability effects, mirroring the server's
 * `handle*Cast` validation. Used by the validator to warn on misconfigured
 * composites before the player ever casts. Lowercased target keys; values are
 * UPPERCASE effect types. Empty list means "no constraint" (target type is
 * data-defined and we don't know the rules).
 */
export const TARGET_EFFECT_ALLOWLIST: Record<string, readonly string[]> = {
  self: ["DIRECT_HEAL", "APPLY_STATUS", "SUMMON_PET"],
  ally: ["DIRECT_HEAL", "APPLY_STATUS"],
  pet: ["DIRECT_HEAL", "APPLY_STATUS"],
  enemy: ["DIRECT_DAMAGE", "AREA_DAMAGE", "TAUNT", "APPLY_STATUS"],
  all_enemies: ["DIRECT_DAMAGE", "AREA_DAMAGE", "APPLY_STATUS"],
  all_allies: ["DIRECT_HEAL", "APPLY_STATUS"],
};

/**
 * Returns the list of effect types that are incompatible with the given
 * target type. Returns an empty list when the target type is unknown — we
 * don't fabricate constraints for custom target types defined by the project.
 */
export function incompatibleChildEffects(
  effect: AbilityEffectConfig,
  targetType: string,
): AbilityEffectConfig[] {
  const allow = TARGET_EFFECT_ALLOWLIST[targetType.trim().toLowerCase()];
  if (!allow) return [];
  return flattenEffect(effect).filter((e) => !allow.includes(e.type.toUpperCase()));
}
