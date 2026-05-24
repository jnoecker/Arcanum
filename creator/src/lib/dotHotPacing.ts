import type {
  StatBindings,
  StatusEffectDefinitionConfig,
  StatusEffectTypeDefinition,
} from "@/types/config";

const BASE_STAT = 10;

export type TickKind = "damage" | "healing" | null;

/**
 * Determines whether a status-effect type ticks damage or healing, mirroring
 * the server's `EffectTypesConfig.get(...).ticksDamage / ticksHealing` check
 * that gates `computeTickAnchor`. Returns null for non-ticking effect types
 * (buffs, shields, stuns, etc.) so the editor knows not to show a scaled
 * preview.
 */
export function tickKindFor(
  effectTypeId: string | undefined,
  effectTypes: Record<string, StatusEffectTypeDefinition>,
): TickKind {
  if (!effectTypeId) return null;
  const def = effectTypes[effectTypeId.toLowerCase()];
  if (!def) return null;
  if (def.ticksDamage) return "damage";
  if (def.ticksHealing) return "healing";
  return null;
}

/**
 * Authored anchor for a tick — midpoint of `tickMinValue`/`tickMaxValue`.
 * Mirrors the server's `(tickMinValue + tickMaxValue) / 2.0`. Falls back to
 * the legacy `tickValue` if both bounds are zero (matches the editor's
 * "legacy flat value" affordance).
 */
export function authoredTickAnchor(effect: StatusEffectDefinitionConfig): number {
  const lo = effect.tickMinValue ?? 0;
  const hi = effect.tickMaxValue ?? 0;
  if (lo === 0 && hi === 0) return effect.tickValue ?? 0;
  return (lo + hi) / 2;
}

/**
 * Scaled tick anchor — the value a single tick will resolve to (before
 * per-tick variance) for the given caster level and stat value. Mirrors
 * `StatusEffectSystem.computeTickAnchor` on the server:
 *
 *   statBonus  = (statValue - BASE_STAT) × statMultiplier
 *   levelScale = (spell|heal)LevelScalingRate ^ (level - 1)
 *   tickAnchor = (anchor + statBonus) × levelScale
 *
 * Returns 0 when the effect doesn't tick or the anchor is zero.
 */
export function scaledTickAnchor(
  effect: StatusEffectDefinitionConfig,
  kind: TickKind,
  bindings: StatBindings,
  level: number,
  statValue: number = BASE_STAT,
): number {
  if (!kind) return 0;
  const anchor = authoredTickAnchor(effect);
  if (anchor <= 0) return 0;
  const [statMul, rate] =
    kind === "damage"
      ? [bindings.spellStatMultiplier, bindings.spellLevelScalingRate]
      : [bindings.healStatMultiplier, bindings.healLevelScalingRate];
  const statBonus = (statValue - BASE_STAT) * statMul;
  const levelScale = Math.pow(rate, Math.max(0, level - 1));
  return (anchor + statBonus) * levelScale;
}

/**
 * The relevant scaling stat id for the given tick kind, so editor previews
 * can name the stat the author is configuring against.
 */
export function tickScalingStat(
  kind: TickKind,
  bindings: StatBindings,
): string | null {
  if (!kind) return null;
  return kind === "damage" ? bindings.spellDamageStat : bindings.healStat;
}
