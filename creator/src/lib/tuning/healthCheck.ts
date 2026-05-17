// ─── Health Check ───────────────────────────────────────────────────
//
// Detects cross-section imbalances after a selective preset apply.
// Only runs when fewer than all 4 sections were accepted (per D-09).
// Compares pre-apply and post-apply metrics to flag known problematic
// combinations.

import type { AppConfig } from "@/types/config";
import type { MetricSnapshot } from "./types";
import { TuningSection } from "./types";
import { estimatePacing } from "./pacing";

export interface HealthWarning {
  severity: "warning" | "info";
  message: string;
  detail: string;
}

/**
 * Format minutes as a human label (e.g. "2 min", "1h 30m"). Plus
 * sign indicates infinity / unreachable.
 */
function fmtMinutes(min: number): string {
  if (!Number.isFinite(min)) return "∞";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Check whether the applied preset produces wildly off-target leveling
 * pace under the canonical trash-clearing scenario. Runs on every
 * apply (not just partial accepts) because absolute pacing is a
 * property of the merged config alone, not of cross-section drift.
 */
export function checkPacingHealth(
  postConfig: AppConfig,
  presetId: string | null,
): HealthWarning[] {
  const pacing = estimatePacing(postConfig, presetId);
  if (!pacing.targetsPresetId) return [];

  const warnings: HealthWarning[] = [];
  // Only emit warnings for severe mismatches. The preview card already
  // shows soft "fast" / "slow" dots for marginal drift.
  const tooFast = pacing.milestones.filter((m) => m.verdict === "way-too-fast");
  const tooSlow = pacing.milestones.filter((m) => m.verdict === "way-too-slow");

  if (tooFast.length > 0) {
    const worst = tooFast.reduce((a, b) =>
      a.minutesTarget && b.minutesTarget && a.minutesEstimated / a.minutesTarget < b.minutesEstimated / b.minutesTarget
        ? a
        : b,
    );
    warnings.push({
      severity: "warning",
      message: `Leveling pace looks too fast — players reach level ${worst.level} in about ${fmtMinutes(worst.minutesEstimated)} (target ~${fmtMinutes(worst.minutesTarget ?? 0)}).`,
      detail:
        "Estimated against a canonical trash-clearing run (120 kills/hr, mostly weak mobs). Lower mob XP rewards or steepen the XP curve to bring pacing in line with this preset's intent.",
    });
  } else if (tooSlow.length > 0) {
    const worst = tooSlow.reduce((a, b) =>
      a.minutesTarget && b.minutesTarget && a.minutesEstimated / a.minutesTarget > b.minutesEstimated / b.minutesTarget
        ? a
        : b,
    );
    warnings.push({
      severity: "warning",
      message: `Leveling pace looks too slow — players reach level ${worst.level} in about ${fmtMinutes(worst.minutesEstimated)} (target ~${fmtMinutes(worst.minutesTarget ?? 0)}).`,
      detail:
        "Estimated against a canonical trash-clearing run (120 kills/hr, mostly weak mobs). Raise mob XP rewards or flatten the XP curve to keep players engaged.",
    });
  }

  return warnings;
}

/**
 * Check the final merged config for *absolute* imbalances that make the
 * world feel broken regardless of which preset / sections were applied.
 * Examples: regen so high that mob damage doesn't matter, weak-tier mobs
 * with TTK measured in minutes, etc. Runs on every apply.
 */
export function checkAbsoluteHealth(config: AppConfig): HealthWarning[] {
  const warnings: HealthWarning[] = [];

  const regen = config.regen;
  const combat = config.combat;
  const weak = config.mobTiers?.weak;
  const standard = config.mobTiers?.standard;
  const mobDelay = config.mobActionDelay;
  const baseHp = config.progression?.rewards?.baseHp;

  if (!regen || !combat || !weak || !standard || !mobDelay || !baseHp) return warnings;

  const regenHpPerSecBase = (regen.regenPercent * baseHp * 1000) / regen.baseIntervalMillis;
  const regenHpPerSecInCombat = regenHpPerSecBase * regen.inCombatMultiplier;
  const avgMobDelaySec =
    (mobDelay.minActionDelayMillis + mobDelay.maxActionDelayMillis) / 2 / 1000;
  const stdAvgDmg = (standard.baseMinDamage + standard.baseMaxDamage) / 2;
  const stdDps = avgMobDelaySec > 0 ? stdAvgDmg / avgMobDelaySec : 0;

  // Rule A: in-combat regen swamps standard-tier mob DPS by 3× or more.
  // Standard mobs are the workhorse threat tier — if a stationary player
  // out-regens them mid-fight, combat has no tension. Uses the in-combat
  // multiplier since out-of-combat regen doesn't compete with mob DPS.
  if (stdDps > 0 && regenHpPerSecInCombat / stdDps >= 3) {
    warnings.push({
      severity: "warning",
      message: `In-combat regen (${regenHpPerSecInCombat.toFixed(1)} HP/s) outpaces standard-tier mob DPS (${stdDps.toFixed(2)}/s) by ${(regenHpPerSecInCombat / stdDps).toFixed(1)}× — combat may feel inconsequential.`,
      detail:
        "Lower regen.regenPercent, lower regen.inCombatMultiplier, raise mob damage, or shorten mobActionDelay so standard-tier fights apply real pressure.",
    });
  }

  // Rule B: weak-tier L1 TTK is absurd. Indicates a tier baseline mismatch
  // for tutorial mobs (what triggered this whole audit).
  //
  // Player baseline melee swing at L1, unarmed, base stat: from the bindings,
  // that's `meleeBaseAttackPower × varianceMid × (1 - mitigation(weak.armor))`.
  // No equipment, no stat bonus, no level scaling at level 1.
  const b = config.stats.bindings;
  const mitigation =
    weak.baseArmor > 0
      ? weak.baseArmor / (weak.baseArmor + b.meleeArmorMitigationK)
      : 0;
  const playerAvgDmg = Math.max(
    1,
    b.meleeBaseAttackPower *
      ((b.meleeVarianceMin + b.meleeVarianceMax) / 2) *
      (1 - mitigation),
  );
  if (weak.baseHp > 0) {
    const weakTtkSec = (weak.baseHp / playerAvgDmg) * (combat.tickMillis / 1000);
    if (weakTtkSec > 30) {
      warnings.push({
        severity: "warning",
        message: `Weak-tier L1 mob takes ~${Math.round(weakTtkSec)}s to kill with an unarmed level-1 player — fights may feel grindy.`,
        detail:
          "Lower mobTiers.weak.baseHp, raise stats.bindings.meleeBaseAttackPower, or reduce combat.tickMillis. Weak-tier should land in the 5–20s range for a level-1 unarmed player.",
      });
    } else if (weakTtkSec < 2) {
      warnings.push({
        severity: "info",
        message: `Weak-tier L1 mob dies in ~${weakTtkSec.toFixed(1)}s — too quick for skill expression.`,
        detail:
          "Raise mobTiers.weak.baseHp or lower stats.bindings.meleeBaseAttackPower for fights that breathe.",
      });
    }
  }

  // Rule D: melee level scaling rate diverges from HP scaling rate. When the
  // two curves drift apart, same-level fight pacing changes across the level
  // band — over-leveled mobs become punishing or trivial in ways that aren't
  // a deliberate design choice. Mirroring rates keeps damage:HP ratios
  // stable across the curve (the whole point of the new combat formula).
  const hpRate = config.progression.rewards.hpScalingRate;
  const meleeRate = b.meleeLevelScalingRate;
  if (
    hpRate > 0 &&
    meleeRate > 0 &&
    Math.abs(meleeRate - hpRate) >= 0.05
  ) {
    warnings.push({
      severity: "warning",
      message: `Melee level scaling (${meleeRate.toFixed(2)}) and player HP scaling (${hpRate.toFixed(2)}) diverge — same-level fight pacing will drift across the level band.`,
      detail:
        "Set stats.bindings.meleeLevelScalingRate equal to progression.rewards.hpScalingRate so damage and HP track in lockstep. Asymmetric rates either trivialize high-level combat (HP runs away) or make it lethal (damage runs away).",
    });
  }

  // Spell + heal scaling should also track HP scaling. The three schools
  // can diverge intentionally (e.g. casters fall off late-game) but more
  // often it's a tuning oversight worth flagging.
  const spellRate = b.spellLevelScalingRate;
  if (spellRate > 0 && hpRate > 0 && Math.abs(spellRate - hpRate) >= 0.05) {
    warnings.push({
      severity: "warning",
      message: `Spell level scaling (${spellRate.toFixed(2)}) and player HP scaling (${hpRate.toFixed(2)}) diverge — caster damage will drift relative to player survivability.`,
      detail:
        "Set stats.bindings.spellLevelScalingRate equal to progression.rewards.hpScalingRate so casters keep pace with the HP curve.",
    });
  }
  const healRate = b.healLevelScalingRate;
  if (healRate > 0 && hpRate > 0 && Math.abs(healRate - hpRate) >= 0.05) {
    warnings.push({
      severity: "warning",
      message: `Heal level scaling (${healRate.toFixed(2)}) and player HP scaling (${hpRate.toFixed(2)}) diverge — healers will out-heal or under-heal incoming damage across the level band.`,
      detail:
        "Set stats.bindings.healLevelScalingRate equal to progression.rewards.hpScalingRate so healing keeps up with the HP and damage curves.",
    });
  }

  // Rule C: full HP recovery is so slow players will rely on consumables for
  // every fight. Surfaces a knob mismatch rather than a balance opinion.
  // Out-of-combat rate ignores inCombatMultiplier — the percent system makes
  // this a constant time-to-full regardless of level.
  if (regenHpPerSecBase > 0) {
    const fullHealSec = baseHp / regenHpPerSecBase;
    if (fullHealSec > 600) {
      warnings.push({
        severity: "info",
        message: `Out-of-combat HP recovery is very slow (~${Math.round(fullHealSec / 60)} min to full at base regen).`,
        detail:
          "If that's intentional for a survival-economy feel, ignore. Otherwise raise regen.regenPercent or lower regen.baseIntervalMillis.",
      });
    }
  }

  return warnings;
}

/**
 * Check for imbalanced metric combinations after a selective apply.
 * Only runs when fewer than all 4 sections were accepted (per D-09).
 * Compares pre-apply and post-apply metrics to detect cross-section imbalances.
 */
export function checkTuningHealth(
  preMetrics: MetricSnapshot,
  postMetrics: MetricSnapshot,
  acceptedSections: Set<TuningSection>,
): HealthWarning[] {
  if (acceptedSections.size === 4) return [];

  const warnings: HealthWarning[] = [];
  const LEVEL = 10; // representative comparison level

  // Rule 1: Economy changed but combat did not -- gold income may be misaligned
  if (acceptedSections.has(TuningSection.EconomyCrafting) && !acceptedSections.has(TuningSection.CombatStats)) {
    const preGold = preMetrics.mobGoldAvg["normal"]?.[LEVEL] ?? preMetrics.mobGoldAvg["standard"]?.[LEVEL] ?? 0;
    const postGold = postMetrics.mobGoldAvg["normal"]?.[LEVEL] ?? postMetrics.mobGoldAvg["standard"]?.[LEVEL] ?? 0;
    const preMobHp = preMetrics.mobHp["normal"]?.[LEVEL] ?? preMetrics.mobHp["standard"]?.[LEVEL] ?? 0;
    const postMobHp = postMetrics.mobHp["normal"]?.[LEVEL] ?? postMetrics.mobHp["standard"]?.[LEVEL] ?? 0;
    if (preGold > 0 && Math.abs(postGold - preGold) / preGold > 0.5 && preMobHp === postMobHp) {
      warnings.push({
        severity: "warning",
        message: "Economy values were changed without combat adjustments. Gold income may be misaligned with combat difficulty.",
        detail: "Consider also accepting Combat & Stats to keep gold rewards proportional to mob difficulty.",
      });
    }
  }

  // Rule 2: Progression changed but combat did not -- XP vs mob XP mismatch
  if (acceptedSections.has(TuningSection.ProgressionQuests) && !acceptedSections.has(TuningSection.CombatStats)) {
    const preXp = preMetrics.xpPerLevel[LEVEL] ?? 0;
    const postXp = postMetrics.xpPerLevel[LEVEL] ?? 0;
    const preMobHp = preMetrics.mobHp["normal"]?.[LEVEL] ?? preMetrics.mobHp["standard"]?.[LEVEL] ?? 0;
    const postMobHp = postMetrics.mobHp["normal"]?.[LEVEL] ?? postMetrics.mobHp["standard"]?.[LEVEL] ?? 0;
    if (preXp > 0 && Math.abs(postXp - preXp) / preXp > 0.3 && preMobHp === postMobHp) {
      warnings.push({
        severity: "warning",
        message: "Progression values were changed without matching mob XP rewards. Leveling pace may feel inconsistent with mob encounters.",
        detail: "Consider also accepting Combat & Stats so mob difficulty scales with the new progression curve.",
      });
    }
  }

  // Rule 3: World/Social changed but combat did not -- regen vs damage mismatch
  if (acceptedSections.has(TuningSection.WorldSocial) && !acceptedSections.has(TuningSection.CombatStats)) {
    const preRegen = preMetrics.regenInterval[LEVEL] ?? 0;
    const postRegen = postMetrics.regenInterval[LEVEL] ?? 0;
    const preDmg = preMetrics.mobDamageAvg["normal"]?.[LEVEL] ?? preMetrics.mobDamageAvg["standard"]?.[LEVEL] ?? 0;
    const postDmg = postMetrics.mobDamageAvg["normal"]?.[LEVEL] ?? postMetrics.mobDamageAvg["standard"]?.[LEVEL] ?? 0;
    if (preRegen > 0 && Math.abs(postRegen - preRegen) / preRegen > 0.3 && preDmg === postDmg) {
      warnings.push({
        severity: "warning",
        message: "Stat scaling was changed without combat adjustments. Player survivability may be significantly different than intended.",
        detail: "Consider also accepting Combat & Stats to keep combat balance aligned with the new regen/stat values.",
      });
    }
  }

  return warnings;
}
