// ─── Quest XP Resolver ──────────────────────────────────────────────
//
// Mirrors the server's PlayerProgression.computeQuestXp + QuestSystem
// completion logic: the authored `rewards.xp` (when > 0) always wins as
// an explicit override; otherwise the engine computes
//   (baseline.baseXp + baseline.xpPerLevel * (level - 1)) * tiers[difficulty]
// at the quest's declared level (or the player's level at completion time
// in scaling zones — which we can't predict from the creator, so we use
// `quest.level ?? 1` as the preview anchor).

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
  const baseXp = config?.baseline.baseXp ?? DEFAULT_BASELINE_XP;
  const xpPerLevel = config?.baseline.xpPerLevel ?? DEFAULT_XP_PER_LEVEL;
  return baseXp + xpPerLevel * (Math.max(1, level) - 1);
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
