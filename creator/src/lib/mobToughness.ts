// ─── Mob Toughness ─────────────────────────────────────────────────
//
// Single-dial difficulty knob that writes through to the four mob mults
// (hpMult, dmgMult, xpMult, goldMult). Arcanum-side convenience layer —
// the server only sees the resolved mults.
//
// XP and gold mults track combat toughness 1:1: tougher mobs are worth more,
// pushovers are worth less. Authors who need decoupled curves (e.g. rare
// high-XP pushover) edit the mults directly under the Power-user disclosure.

import type { MobFile } from "@/types/world";

export type ToughnessStep = -2 | -1 | 0 | 1 | 2;

export const TOUGHNESS_STEPS: readonly ToughnessStep[] = [-2, -1, 0, 1, 2] as const;

export interface ToughnessProfile {
  hpMult: number;
  dmgMult: number;
  xpMult: number;
  goldMult: number;
  label: string;
  description: string;
}

export const TOUGHNESS_PROFILES: Record<ToughnessStep, ToughnessProfile> = {
  [-2]: {
    hpMult: 0.6,
    dmgMult: 0.6,
    xpMult: 0.6,
    goldMult: 0.6,
    label: "Pushover",
    description: "Frail and weak. Trivial fights with reduced rewards.",
  },
  [-1]: {
    hpMult: 0.8,
    dmgMult: 0.8,
    xpMult: 0.8,
    goldMult: 0.8,
    label: "Easy",
    description: "Below tier baseline. Slightly easier than the curve.",
  },
  [0]: {
    hpMult: 1.0,
    dmgMult: 1.0,
    xpMult: 1.0,
    goldMult: 1.0,
    label: "Standard",
    description: "Tier baseline. Default for typical encounters.",
  },
  [1]: {
    hpMult: 1.25,
    dmgMult: 1.25,
    xpMult: 1.25,
    goldMult: 1.25,
    label: "Tough",
    description: "Above tier baseline. Notably more dangerous and rewarding.",
  },
  [2]: {
    hpMult: 1.6,
    dmgMult: 1.6,
    xpMult: 1.6,
    goldMult: 1.6,
    label: "Brutal",
    description: "Mini-boss spike within the tier. High risk, high reward.",
  },
};

/** Default toughness when no step is authored. */
export const DEFAULT_TOUGHNESS_STEP: ToughnessStep = 0;

/**
 * Returns the toughness step that exactly matches the mob's current mults, or
 * null if the mults diverge from any profile (i.e. the user has hand-tuned
 * the mults under the Power-user disclosure).
 */
export function inferToughness(mob: MobFile): ToughnessStep | null {
  if (mob.toughness != null) {
    const profile = TOUGHNESS_PROFILES[mob.toughness];
    if (profile && multsMatch(mob, profile)) return mob.toughness;
    // Toughness was authored but mults have diverged from the profile.
    return null;
  }
  // No authored toughness — infer from mults. If all four are absent or 1.0,
  // it's "Standard".
  const hp = mob.hpMult ?? 1;
  const dmg = mob.dmgMult ?? 1;
  const xp = mob.xpMult ?? 1;
  const gold = mob.goldMult ?? 1;
  if (hp === 1 && dmg === 1 && xp === 1 && gold === 1) return 0;
  for (const step of TOUGHNESS_STEPS) {
    if (multsMatch(mob, TOUGHNESS_PROFILES[step])) return step;
  }
  return null;
}

function multsMatch(mob: MobFile, profile: ToughnessProfile): boolean {
  return (
    (mob.hpMult ?? 1) === profile.hpMult &&
    (mob.dmgMult ?? 1) === profile.dmgMult &&
    (mob.xpMult ?? 1) === profile.xpMult &&
    (mob.goldMult ?? 1) === profile.goldMult
  );
}

/**
 * Returns a partial MobFile patch that sets toughness + all four mults to the
 * given step's profile. Step 0 clears the mult fields (default behavior).
 */
export function toughnessPatch(step: ToughnessStep): Partial<MobFile> {
  if (step === 0) {
    return {
      toughness: undefined,
      hpMult: undefined,
      dmgMult: undefined,
      xpMult: undefined,
      goldMult: undefined,
    };
  }
  const p = TOUGHNESS_PROFILES[step];
  return {
    toughness: step,
    hpMult: p.hpMult,
    dmgMult: p.dmgMult,
    xpMult: p.xpMult,
    goldMult: p.goldMult,
  };
}
