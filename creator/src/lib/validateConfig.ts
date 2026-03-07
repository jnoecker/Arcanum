import type { AppConfig } from "@/types/config";
import type { ValidationIssue } from "./validateZone";

/**
 * Validate an AppConfig for referential integrity and common mistakes.
 * Returns an array of issues (empty = valid).
 */
export function validateConfig(config: AppConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const statIds = new Set(Object.keys(config.stats.definitions));
  const statusEffectIds = new Set(Object.keys(config.statusEffects));
  const classIds = new Set(Object.keys(config.classes));

  // ─── Server ───────────────────────────────────────────────────
  if (config.server.telnetPort < 1 || config.server.telnetPort > 65535) {
    issues.push({
      severity: "error",
      entity: "server",
      message: `Telnet port ${config.server.telnetPort} out of range (1-65535)`,
    });
  }
  if (config.server.webPort < 1 || config.server.webPort > 65535) {
    issues.push({
      severity: "error",
      entity: "server",
      message: `Web port ${config.server.webPort} out of range (1-65535)`,
    });
  }
  if (config.server.telnetPort === config.server.webPort) {
    issues.push({
      severity: "error",
      entity: "server",
      message: "Telnet and web ports must be different",
    });
  }

  // ─── Stat bindings ────────────────────────────────────────────
  if (statIds.size > 0) {
    const b = config.stats.bindings;
    const bindingChecks: [string, string][] = [
      ["meleeDamageStat", b.meleeDamageStat],
      ["dodgeStat", b.dodgeStat],
      ["spellDamageStat", b.spellDamageStat],
      ["hpScalingStat", b.hpScalingStat],
      ["manaScalingStat", b.manaScalingStat],
      ["hpRegenStat", b.hpRegenStat],
      ["manaRegenStat", b.manaRegenStat],
      ["xpBonusStat", b.xpBonusStat],
    ];
    for (const [field, statId] of bindingChecks) {
      if (statId && !statIds.has(statId)) {
        issues.push({
          severity: "error",
          entity: "stats.bindings",
          message: `${field} references unknown stat "${statId}"`,
        });
      }
    }
  }

  // ─── Abilities ────────────────────────────────────────────────
  for (const [id, a] of Object.entries(config.abilities)) {
    if (
      a.effect.type === "APPLY_STATUS" &&
      a.effect.statusEffectId &&
      !statusEffectIds.has(a.effect.statusEffectId)
    ) {
      issues.push({
        severity: "error",
        entity: `ability:${id}`,
        message: `Effect references unknown status effect "${a.effect.statusEffectId}"`,
      });
    }
    if (a.requiredClass && classIds.size > 0 && !classIds.has(a.requiredClass)) {
      issues.push({
        severity: "warning",
        entity: `ability:${id}`,
        message: `Required class "${a.requiredClass}" is not defined`,
      });
    }
  }

  // ─── Status effects ──────────────────────────────────────────
  for (const [id, e] of Object.entries(config.statusEffects)) {
    if (e.statMods && statIds.size > 0) {
      for (const statId of Object.keys(e.statMods)) {
        if (!statIds.has(statId)) {
          issues.push({
            severity: "error",
            entity: `statusEffect:${id}`,
            message: `Stat modifier references unknown stat "${statId}"`,
          });
        }
      }
    }
  }

  // ─── Classes ──────────────────────────────────────────────────
  for (const [id, cls] of Object.entries(config.classes)) {
    if (cls.primaryStat && statIds.size > 0 && !statIds.has(cls.primaryStat)) {
      issues.push({
        severity: "warning",
        entity: `class:${id}`,
        message: `Primary stat "${cls.primaryStat}" is not defined`,
      });
    }
  }

  // ─── Races ────────────────────────────────────────────────────
  for (const [id, race] of Object.entries(config.races)) {
    if (race.statMods && statIds.size > 0) {
      for (const statId of Object.keys(race.statMods)) {
        if (!statIds.has(statId)) {
          issues.push({
            severity: "warning",
            entity: `race:${id}`,
            message: `Stat modifier references unknown stat "${statId}"`,
          });
        }
      }
    }
  }

  // ─── Combat ───────────────────────────────────────────────────
  if (config.combat.minDamage > config.combat.maxDamage) {
    issues.push({
      severity: "warning",
      entity: "combat",
      message: "Min damage exceeds max damage",
    });
  }

  // ─── Progression ──────────────────────────────────────────────
  if (config.progression.maxLevel < 1) {
    issues.push({
      severity: "error",
      entity: "progression",
      message: "Max level must be at least 1",
    });
  }

  return issues;
}
