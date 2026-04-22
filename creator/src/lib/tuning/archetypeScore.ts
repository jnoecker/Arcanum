import type { AppConfig } from "@/types/config";
import { regenIntervalMs } from "./formulas";
import { getArchetypeContract, type NumericBand } from "./archetypes";
import { estimatePacing } from "./pacing";
import { simulateEconomy, simulateEncounter } from "./simulations";

export type ContractCheckCategory = "pacing" | "combat" | "economy" | "world";
export type ContractCheckStatus = "pass" | "warn" | "fail";
export type ArchetypeStatus = "validated" | "close" | "needs-tuning";

export interface ContractCheck {
  id: string;
  category: ContractCheckCategory;
  label: string;
  status: ContractCheckStatus;
  actual: string;
  expected: string;
  detail: string;
}

export interface ArchetypeEvaluation {
  status: ArchetypeStatus;
  score: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  checks: ContractCheck[];
}

const STATUS_SCORE: Record<ContractCheckStatus, number> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
};

const VERDICT_RANK: Record<string, number> = {
  easy: 0,
  fair: 1,
  risky: 2,
  lethal: 3,
};

function bandLabel(band: NumericBand, formatter: (value: number) => string): string {
  if (band.min != null && band.max != null) {
    return `${formatter(band.min)}-${formatter(band.max)}`;
  }
  if (band.min != null) return `>= ${formatter(band.min)}`;
  if (band.max != null) return `<= ${formatter(band.max)}`;
  return "any value";
}

function numericStatus(actual: number, band: NumericBand): ContractCheckStatus {
  const min = band.min;
  const max = band.max;

  if ((min == null || actual >= min) && (max == null || actual <= max)) {
    return "pass";
  }

  const nearestBound =
    min != null && actual < min
      ? min
      : max != null && actual > max
        ? max
        : null;

  if (nearestBound == null) return "pass";

  const delta = Math.abs(actual - nearestBound);
  const ratio = delta / Math.max(Math.abs(nearestBound), 1);
  return ratio <= 0.15 ? "warn" : "fail";
}

function verdictStatus(actual: string, allowed: string[]): ContractCheckStatus {
  if (allowed.includes(actual)) return "pass";
  const actualRank = VERDICT_RANK[actual];
  if (actualRank == null) return "fail";
  const nearest = Math.min(
    ...allowed
      .map((value) => VERDICT_RANK[value])
      .filter((value) => value != null)
      .map((value) => Math.abs(value - actualRank)),
  );
  return nearest <= 1 ? "warn" : "fail";
}

function worseStatus(left: ContractCheckStatus, right: ContractCheckStatus): ContractCheckStatus {
  const rank = { pass: 0, warn: 1, fail: 2 } as const;
  return rank[left] >= rank[right] ? left : right;
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return "inf";
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes - hours * 60);
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function evaluateArchetype(
  config: AppConfig,
  presetId: string | null | undefined,
): ArchetypeEvaluation | null {
  const contract = getArchetypeContract(presetId);
  if (!contract) return null;

  const checks: ContractCheck[] = [];

  const pacing = estimatePacing(config, contract.id);
  for (const milestone of pacing.milestones) {
    const status: ContractCheckStatus =
      milestone.verdict === "on-target"
        ? "pass"
        : milestone.verdict === "fast" || milestone.verdict === "slow"
          ? "warn"
          : "fail";
    checks.push({
      id: `pacing-${milestone.level}`,
      category: "pacing",
      label: `Reach level ${milestone.level}`,
      status,
      actual: formatMinutes(milestone.minutesEstimated),
      expected:
        milestone.minutesTarget != null ? `~${formatMinutes(milestone.minutesTarget)}` : "tracked",
      detail: "Canonical trash-clearing run: 120 kills/hr, mostly weak mobs.",
    });
  }

  for (const encounter of contract.combat) {
    const result = simulateEncounter(config, encounter.inputs);
    const hpRemainingPercent =
      result.playerHp > 0 ? (result.playerHpRemaining / result.playerHp) * 100 : 0;
    const verdict = verdictStatus(result.verdict, encounter.allowedVerdicts);
    const hpBand = numericStatus(hpRemainingPercent, encounter.hpRemainingPercent);
    checks.push({
      id: encounter.id,
      category: "combat",
      label: encounter.label,
      status: worseStatus(verdict, hpBand),
      actual: `${result.verdict}, ${hpRemainingPercent.toFixed(1)}% HP left`,
      expected: `${encounter.allowedVerdicts.join("/")} and ${bandLabel(encounter.hpRemainingPercent, (value) => `${value.toFixed(0)}%`)}`,
      detail: "Same-level PvE encounter using default primary stat growth.",
    });
  }

  const economy = simulateEconomy(config, contract.economy.inputs);
  checks.push({
    id: contract.economy.id,
    category: "economy",
    label: contract.economy.label,
    status: numericStatus(economy.goldPerHour, contract.economy.goldPerHour),
    actual: `${economy.goldPerHour.toLocaleString("en-US")} gold/hr`,
    expected: bandLabel(contract.economy.goldPerHour, (value) =>
      `${value.toLocaleString("en-US")} gold/hr`,
    ),
    detail: "Canonical trash run with 50% of drops sold and 500 gold/hr in expenses.",
  });

  const regenInterval = regenIntervalMs(
    contract.regen.statValue,
    config.regen,
    config.stats.bindings.hpRegenMsPerPoint,
  );
  checks.push({
    id: contract.regen.id,
    category: "world",
    label: contract.regen.label,
    status: numericStatus(regenInterval, contract.regen.intervalMs),
    actual: `${Math.round(regenInterval)}ms`,
    expected: bandLabel(contract.regen.intervalMs, (value) => `${Math.round(value)}ms`),
    detail: "Recovery speed with a representative invested stat value of 30.",
  });

  const total = checks.reduce((sum, check) => sum + STATUS_SCORE[check.status], 0);
  const score = checks.length > 0 ? Math.round((total / checks.length) * 100) : 0;
  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const failCount = checks.filter((check) => check.status === "fail").length;

  let status: ArchetypeStatus;
  if (failCount === 0 && warnCount <= 1 && score >= 80) {
    status = "validated";
  } else if (failCount <= 2 && score >= 60) {
    status = "close";
  } else {
    status = "needs-tuning";
  }

  return {
    status,
    score,
    passCount,
    warnCount,
    failCount,
    checks,
  };
}
