// ─── Health Check ───────────────────────────────────────────────────
//
// Detects cross-section imbalances after a selective preset apply.
// Only runs when fewer than all 4 sections were accepted (per D-09).
// Compares pre-apply and post-apply metrics to flag known problematic
// combinations.

import type { MetricSnapshot } from "./types";
import { TuningSection } from "./types";

export interface HealthWarning {
  severity: "warning" | "info";
  message: string;
  detail: string;
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
