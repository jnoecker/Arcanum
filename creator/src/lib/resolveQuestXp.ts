// ─── Quest XP Resolver ──────────────────────────────────────────────
//
// Mirrors the server's PlayerProgression.computeQuestXp + QuestSystem
// completion logic: the authored `rewards.xp` (when > 0) always wins as
// an explicit override; otherwise the engine computes
//   (baseline.baseXp + baseline.xpPerLevel * (level - 1)) * tiers[difficulty]
// at the quest's declared level (or the player's level at completion time
// in scaling zones — which we can't predict from the creator, so we use
// `quest.level ?? 1` as the preview anchor). When `xpAnchors` are declared
// (D-33) the standard unit is the anchor curve instead of the linear
// baseline: geometric between anchors, the last segment's ratio beyond the
// ends, exactly as the engine interpolates mob tier anchors.

import type { QuestFile } from "@/types/world";
import type { QuestXpConfig } from "@/types/config";

export interface ResolvedQuestXp {
  /** XP the engine will actually award (override when set, else computed). */
  effective: number;
  /** XP the engine would compute from difficulty + baseline. Null when no difficulty or config. */
  computed: number | null;
  /** XP the author explicitly set. Null when unset/0 (falls back to computed). */
  authored: number | null;
  /** True when the author's value overrides the computed one. */
  overridden: boolean;
  /** Human explanation of why effective is what it is. */
  reason: "override" | "computed" | "authored-no-tier" | "no-data";
}

const DEFAULT_BASELINE_XP = 50;
const DEFAULT_XP_PER_LEVEL = 20;
const DEFAULT_TIER_MULTIPLIERS = {
  trivial: 0.25,
  easy: 0.5,
  standard: 1.0,
  hard: 1.75,
  epic: 3.0,
} as const;

function baselineXpAt(level: number, config: QuestXpConfig | undefined): number {
  const anchored = anchoredXpAt(Math.max(1, level), config?.xpAnchors);
  if (anchored != null) return anchored;
  const baseXp = config?.baseline.baseXp ?? DEFAULT_BASELINE_XP;
  const xpPerLevel = config?.baseline.xpPerLevel ?? DEFAULT_XP_PER_LEVEL;
  return baseXp + xpPerLevel * (Math.max(1, level) - 1);
}

/** The anchor curve's standard unit at `level`, or null when no anchors are declared. */
export function anchoredXpAt(level: number, anchors: Record<string, number> | undefined): number | null {
  if (!anchors) return null;
  const points = Object.entries(anchors)
    .map(([k, v]) => [Number.parseInt(k, 10), v] as const)
    .filter(([k, v]) => Number.isFinite(k) && typeof v === "number")
    .sort((a, b) => a[0] - b[0]);
  if (points.length === 0) return null;
  const exact = points.find(([k]) => k === level);
  if (exact) return exact[1];
  const first = points[0]!;
  if (level < first[0] || points.length === 1) return first[1];
  let lo = points[points.length - 2]!;
  let hi = points[points.length - 1]!;
  if (level < hi[0]) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      if (a[0] < level && level < b[0]) {
        lo = a;
        hi = b;
        break;
      }
    }
  }
  const vLo = Math.max(lo[1], 1);
  const vHi = Math.max(hi[1], 1);
  const t = (level - lo[0]) / (hi[0] - lo[0]);
  return vLo * Math.pow(vHi / vLo, t);
}

export function resolveQuestXp(
  quest: QuestFile,
  config: QuestXpConfig | undefined,
): ResolvedQuestXp {
  const authored = (quest.rewards?.xp ?? 0) > 0 ? quest.rewards!.xp! : null;
  const level = quest.level ?? 1;

  if (quest.difficulty) {
    const multiplier = config?.tiers?.[quest.difficulty] ?? DEFAULT_TIER_MULTIPLIERS[quest.difficulty];
    const computed = Math.max(0, Math.round(baselineXpAt(level, config) * multiplier));
    if (authored != null) {
      return { effective: authored, computed, authored, overridden: true, reason: "override" };
    }
    return { effective: computed, computed, authored: null, overridden: false, reason: "computed" };
  }

  if (authored != null) {
    return {
      effective: authored,
      computed: null,
      authored,
      overridden: false,
      reason: "authored-no-tier",
    };
  }

  return { effective: 0, computed: null, authored: null, overridden: false, reason: "no-data" };
}
