import type { AppConfig, RacialAbilityKind } from "@/types/config";
import { RACIAL_ABILITY_KINDS, RACIAL_ABILITY_TRIGGERS } from "@/types/config";
import { missingRequiredGlobalAssets } from "./requiredGlobalAssets";
import type { ValidationIssue } from "./validateZone";
import { flattenEffect, incompatibleChildEffects } from "./abilityEffects";

function normalizedLottery(config: AppConfig["lottery"]) {
  if (!config) return undefined;
  return {
    enabled: config.enabled,
    ticketCost: config.ticketCost,
    drawingIntervalMs: config.drawingIntervalMs,
    jackpotSeedGold: config.jackpotSeedGold ?? config.jackpotBase ?? 0,
    jackpotPercentFromTickets: config.jackpotPercentFromTickets ?? 80,
    maxTicketsPerPlayer: config.maxTicketsPerPlayer ?? 10,
  };
}

function normalizedGambling(config: AppConfig["gambling"]) {
  if (!config) return undefined;
  return {
    enabled: config.enabled,
    diceMinBet: config.diceMinBet ?? config.minBet ?? 0,
    diceMaxBet: config.diceMaxBet ?? config.maxBet ?? 0,
    diceWinChance: config.diceWinChance ?? config.winChance ?? 0,
    diceWinMultiplier: config.diceWinMultiplier ?? config.winMultiplier ?? 0,
    cooldownMs: config.cooldownMs ?? 0,
  };
}

function normalizedRespec(config: AppConfig["respec"]) {
  if (!config) return undefined;
  return {
    enabled: config.enabled ?? true,
    goldCost: config.goldCost,
    cooldownMs: config.cooldownMs,
  };
}

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
  if (config.observability.metricsEndpoint && !config.observability.metricsEndpoint.startsWith("/")) {
    issues.push({
      severity: "error",
      entity: "observability",
      message: "Metrics endpoint must start with '/'",
    });
  }

  // ─── Stat bindings ────────────────────────────────────────────
  if (statIds.size > 0) {
    const b = config.stats.bindings;
    const bindingChecks: [string, string][] = [
      ["meleeDamageStat", b.meleeDamageStat],
      ["dodgeStat", b.dodgeStat],
      ["spellDamageStat", b.spellDamageStat],
      ["healStat", b.healStat],
      ["buffStat", b.buffStat],
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

    // Numeric checks on the melee damage knobs — mirror the server's
    // require() rules in AppConfig.validateStatsBindings.
    if (b.meleeStatMultiplier < 0) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `meleeStatMultiplier must be >= 0 (got ${b.meleeStatMultiplier})`,
      });
    }
    if (b.meleeLevelScalingRate < 1) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `meleeLevelScalingRate must be >= 1.0 — use 1.0 to disable (got ${b.meleeLevelScalingRate})`,
      });
    }
    if (b.meleeVarianceMin <= 0 || b.meleeVarianceMax < b.meleeVarianceMin) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `meleeVarianceMin/Max must satisfy 0 < min <= max (got ${b.meleeVarianceMin} / ${b.meleeVarianceMax})`,
      });
    }
    if (b.meleeBaseAttackPower < 0) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `meleeBaseAttackPower must be >= 0 (got ${b.meleeBaseAttackPower})`,
      });
    }
    if (b.meleeArmorMitigationK <= 0) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `meleeArmorMitigationK must be > 0 (got ${b.meleeArmorMitigationK})`,
      });
    }

    // Spell damage knobs — same shape as melee, no mitigationK.
    if (b.spellStatMultiplier < 0) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `spellStatMultiplier must be >= 0 (got ${b.spellStatMultiplier})`,
      });
    }
    if (b.spellLevelScalingRate < 1) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `spellLevelScalingRate must be >= 1.0 — use 1.0 to disable (got ${b.spellLevelScalingRate})`,
      });
    }
    if (b.spellVarianceMin <= 0 || b.spellVarianceMax < b.spellVarianceMin) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `spellVarianceMin/Max must satisfy 0 < min <= max (got ${b.spellVarianceMin} / ${b.spellVarianceMax})`,
      });
    }

    // Heal knobs — mirror of spell.
    if (b.healStatMultiplier < 0) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `healStatMultiplier must be >= 0 (got ${b.healStatMultiplier})`,
      });
    }
    if (b.healLevelScalingRate < 1) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `healLevelScalingRate must be >= 1.0 — use 1.0 to disable (got ${b.healLevelScalingRate})`,
      });
    }
    if (b.healVarianceMin <= 0 || b.healVarianceMax < b.healVarianceMin) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `healVarianceMin/Max must satisfy 0 < min <= max (got ${b.healVarianceMin} / ${b.healVarianceMax})`,
      });
    }

    // Buff knobs — reserved scaling lane (server doesn't consume them yet).
    if (b.buffDurationPerStat < 0) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `buffDurationPerStat must be >= 0 (got ${b.buffDurationPerStat})`,
      });
    }
    if (b.buffMagnitudePerStat < 0) {
      issues.push({
        severity: "error",
        entity: "stats.bindings",
        message: `buffMagnitudePerStat must be >= 0 (got ${b.buffMagnitudePerStat})`,
      });
    }
  }

  // ─── Pets ─────────────────────────────────────────────────────
  const petIds = new Set(Object.keys(config.pets ?? {}));
  const petsCfg = config.petsConfig;
  if (petsCfg) {
    if (petsCfg.maxHpRatio != null && petsCfg.maxHpRatio < 0) {
      issues.push({ severity: "error", entity: "pets", message: "maxHpRatio must be >= 0" });
    }
    if (petsCfg.maxDamageRatio != null && petsCfg.maxDamageRatio < 0) {
      issues.push({ severity: "error", entity: "pets", message: "maxDamageRatio must be >= 0" });
    }
    if (petsCfg.maxArmorRatio != null && petsCfg.maxArmorRatio < 0) {
      issues.push({ severity: "error", entity: "pets", message: "maxArmorRatio must be >= 0" });
    }
  }
  for (const [id, pet] of Object.entries(config.pets ?? {})) {
    const entity = `pet:${id}`;
    if (!pet.name?.trim()) {
      issues.push({ severity: "error", entity, message: "Name is required" });
    }
    if (pet.hpRatio < 0) {
      issues.push({ severity: "error", entity, message: "hpRatio must be >= 0" });
    }
    if (pet.damageRatio < 0) {
      issues.push({ severity: "error", entity, message: "damageRatio must be >= 0" });
    }
    if (pet.armorRatio < 0) {
      issues.push({ severity: "error", entity, message: "armorRatio must be >= 0" });
    }
    if (pet.baseHp < 1) {
      issues.push({ severity: "error", entity, message: "Base HP must be at least 1" });
    }
    if (pet.baseMinDamage < 1) {
      issues.push({ severity: "error", entity, message: "Base min damage must be at least 1" });
    }
    if (pet.baseMaxDamage < pet.baseMinDamage) {
      issues.push({
        severity: "warning",
        entity,
        message: "Base max damage is below base min damage",
      });
    }
    if (pet.baseArmor < 0) {
      issues.push({ severity: "error", entity, message: "Base armor must be >= 0" });
    }
    // Caps on the world bite per-template ratios; warn so the user knows the cap will trim them.
    if (petsCfg?.maxHpRatio != null && pet.hpRatio > petsCfg.maxHpRatio) {
      issues.push({
        severity: "warning",
        entity,
        message: `hpRatio ${pet.hpRatio} exceeds the world cap (${petsCfg.maxHpRatio}); it will be clamped at summon time`,
      });
    }
    if (petsCfg?.maxDamageRatio != null && pet.damageRatio > petsCfg.maxDamageRatio) {
      issues.push({
        severity: "warning",
        entity,
        message: `damageRatio ${pet.damageRatio} exceeds the world cap (${petsCfg.maxDamageRatio}); it will be clamped at summon time`,
      });
    }
    if (petsCfg?.maxArmorRatio != null && pet.armorRatio > petsCfg.maxArmorRatio) {
      issues.push({
        severity: "warning",
        entity,
        message: `armorRatio ${pet.armorRatio} exceeds the world cap (${petsCfg.maxArmorRatio}); it will be clamped at summon time`,
      });
    }
    const petIsTank = (pet.threatMultiplier ?? 0) > 0;
    for (const [sid, spell] of Object.entries(pet.spells ?? {})) {
      const spellEntity = `pet:${id}.spells.${sid}`;
      if (spell.statusEffectId && !statusEffectIds.has(spell.statusEffectId)) {
        issues.push({
          severity: "error",
          entity: spellEntity,
          message: `Unknown status effect "${spell.statusEffectId}"`,
        });
      }
      if (spell.weight != null && spell.weight < 1) {
        issues.push({
          severity: "warning",
          entity: spellEntity,
          message: "weight should be ≥ 1 (relative weight in auto-cast roll)",
        });
      }
      if (spell.cooldownMs != null && spell.cooldownMs <= 0) {
        issues.push({
          severity: "warning",
          entity: spellEntity,
          message: "cooldownMs should be > 0 (auto-cast will pick this every tick otherwise)",
        });
      }
      if ((spell.threatBonus ?? 0) > 0 && !petIsTank) {
        issues.push({
          severity: "warning",
          entity: spellEntity,
          message: "threatBonus has no effect when the pet's threatMultiplier is 0 (DPS pet)",
        });
      }
      if (spell.damageRatio != null && spell.damageRatio < 0) {
        issues.push({
          severity: "error",
          entity: spellEntity,
          message: "damageRatio must be >= 0",
        });
      }
      if (spell.healRatio != null && spell.healRatio < 0) {
        issues.push({
          severity: "error",
          entity: spellEntity,
          message: "healRatio must be >= 0",
        });
      }
    }
  }

  // ─── Abilities ────────────────────────────────────────────────
  for (const [id, a] of Object.entries(config.abilities)) {
    if (a.effect.type === "COMPOSITE" && (!a.effect.effects || a.effect.effects.length === 0)) {
      issues.push({
        severity: "error",
        entity: `ability:${id}`,
        message: `Composite effect has no child effects`,
      });
    }
    for (const leaf of flattenEffect(a.effect)) {
      if (
        leaf.type === "APPLY_STATUS" &&
        leaf.statusEffectId &&
        !statusEffectIds.has(leaf.statusEffectId)
      ) {
        issues.push({
          severity: "error",
          entity: `ability:${id}`,
          message: `Effect references unknown status effect "${leaf.statusEffectId}"`,
        });
      }
      if (
        leaf.type === "SUMMON_PET" &&
        leaf.petTemplateKey &&
        petIds.size > 0 &&
        !petIds.has(leaf.petTemplateKey)
      ) {
        issues.push({
          severity: "warning",
          entity: `ability:${id}`,
          message: `Summon effect references unknown pet "${leaf.petTemplateKey}"`,
        });
      }
    }
    for (const bad of incompatibleChildEffects(a.effect, a.targetType)) {
      issues.push({
        severity: "warning",
        entity: `ability:${id}`,
        message: `Effect type "${bad.type}" is not valid for target "${a.targetType}" — the server will refuse to cast this ability`,
      });
    }
    const requiredClass = a.requiredClass?.trim() || a.classRestriction?.trim();
    if (requiredClass && classIds.size > 0 && !classIds.has(requiredClass)) {
      issues.push({
        severity: "warning",
        entity: `ability:${id}`,
        message: `Required class "${requiredClass}" is not defined`,
      });
    }
    if (a.skillPointCost != null && a.skillPointCost < 0) {
      issues.push({
        severity: "error",
        entity: `ability:${id}`,
        message: `skillPointCost must be >= 0 (got ${a.skillPointCost})`,
      });
    }
    if (a.manaCostPct < 0) {
      issues.push({
        severity: "error",
        entity: `ability:${id}`,
        message: `manaCostPct must be >= 0 (got ${a.manaCostPct})`,
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
    if (cls.statPriorities && cls.statPriorities.length > 0) {
      // Every entry must reference a known stat — drops would be silent at
      // equip time, so prefer a hard error here.
      if (statIds.size > 0) {
        for (const statId of cls.statPriorities) {
          if (!statIds.has(statId)) {
            issues.push({
              severity: "error",
              entity: `class:${id}`,
              message: `statPriorities references unknown stat "${statId}"`,
            });
          }
        }
      }
      // primaryStat is the legacy single-stat field. Disagreement between it
      // and statPriorities[0] usually means the legacy field is stale.
      if (cls.primaryStat && cls.statPriorities[0] && cls.statPriorities[0] !== cls.primaryStat) {
        issues.push({
          severity: "warning",
          entity: `class:${id}`,
          message: `primaryStat "${cls.primaryStat}" disagrees with statPriorities[0] "${cls.statPriorities[0]}" — these should match`,
        });
      }
    }
    if (cls.threatMultiplier != null && cls.threatMultiplier < 0) {
      issues.push({
        severity: "error",
        entity: `class:${id}`,
        message: "Threat multiplier must be >= 0",
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

    // ─── Racial passive ability ─── (mirrors server validateEngineRaces)
    const ability = race.racialAbility;
    if (ability) {
      const entity = `race:${id}`;
      const push = (message: string, severity: ValidationIssue["severity"] = "error") =>
        issues.push({ severity, entity, message });

      if (!RACIAL_ABILITY_KINDS.includes(ability.kind)) {
        push(`Racial ability kind "${ability.kind}" is not a known mechanic`);
      } else {
        const trigger = RACIAL_ABILITY_TRIGGERS[ability.kind as RacialAbilityKind];
        // Server applies defaults for omitted fields; mirror them so blank-but-valid passes.
        const cooldownMs = ability.cooldownMs ?? 120000;
        const triggerHealthPct = ability.triggerHealthPct ?? 0;
        const damageMultiplier = ability.damageMultiplier ?? 1;
        const aoe = ability.aoeDamagePctOfMaxHp ?? 0;
        const regen = ability.regenPctOfMaxHp ?? 0;
        const petCountMin = ability.petCountMin ?? 1;
        const petCountMax = ability.petCountMax ?? 1;
        const phaseTicks = ability.phaseTicks ?? 2;

        if (cooldownMs < 0) push("Racial ability cooldown must be >= 0");
        if (triggerHealthPct < 0 || triggerHealthPct > 100)
          push("Racial ability trigger HP % must be between 0 and 100");
        if (damageMultiplier < 0) push("Racial ability damage multiplier must be >= 0");
        if (aoe < 0) push("Racial ability AoE damage must be >= 0");
        if (regen < 0) push("Racial ability regen must be >= 0");
        if (petCountMin < 1) push("Racial ability pet count (min) must be >= 1");
        if (petCountMax < petCountMin)
          push("Racial ability pet count (max) must be >= pet count (min)");
        if (phaseTicks < 1) push("Racial ability phase rounds must be >= 1");

        if (trigger === "LOW_HEALTH" && !(triggerHealthPct >= 1 && triggerHealthPct <= 100)) {
          push(`Low-health ability "${ability.kind}" needs a trigger HP % between 1 and 100`);
        }

        if (ability.kind === "AURELIA_DAZZLE" && !ability.stunStatusId?.trim()) {
          push(`"${ability.kind}" requires a stun status effect`);
        }
        if (
          (ability.kind === "MYCORAE_SPORES" || ability.kind === "ARCHAE_DRENGARIAE") &&
          !ability.petTemplateKey?.trim()
        ) {
          push(`"${ability.kind}" requires a pet template`);
        }

        // Cross-reference checks (warnings — referenced entities may live in an overlay).
        if (
          ability.stunStatusId?.trim() &&
          statusEffectIds.size > 0 &&
          !statusEffectIds.has(ability.stunStatusId)
        ) {
          push(`Stun status effect "${ability.stunStatusId}" is not defined`, "warning");
        }
        if (
          ability.stoneStatusId?.trim() &&
          statusEffectIds.size > 0 &&
          !statusEffectIds.has(ability.stoneStatusId)
        ) {
          push(`Stone-form status effect "${ability.stoneStatusId}" is not defined`, "warning");
        }
        if (
          ability.petTemplateKey?.trim() &&
          petIds.size > 0 &&
          !petIds.has(ability.petTemplateKey)
        ) {
          push(`Pet template "${ability.petTemplateKey}" is not defined`, "warning");
        }
      }
    }
  }

  // ─── Equipment Slots ────────────────────────────────────────────
  // Mirrors the server's validateEngineEquipment() rule
  if (Object.keys(config.equipmentSlots).length === 0) {
    issues.push({
      severity: "error",
      entity: "equipmentSlots",
      message: "At least one equipment slot must be defined",
    });
  }
  const seenOrders = new Map<number, string>();
  for (const [id, slot] of Object.entries(config.equipmentSlots)) {
    if (id !== id.trim().toLowerCase()) {
      issues.push({
        severity: "error",
        entity: `equipmentSlot:${id}`,
        message: `Slot key "${id}" must be lowercase with no surrounding whitespace`,
      });
    }
    if (!slot.displayName?.trim()) {
      issues.push({
        severity: "error",
        entity: `equipmentSlot:${id}`,
        message: "Display name is required",
      });
    }
    const existing = seenOrders.get(slot.order);
    if (existing) {
      issues.push({
        severity: "warning",
        entity: `equipmentSlot:${id}`,
        message: `Duplicate order value ${slot.order} (also used by "${existing}")`,
      });
    } else {
      seenOrders.set(slot.order, id);
    }
  }

  // ─── Data-driven registries (empty displayName check) ──────────
  const registryChecks: [string, Record<string, { displayName: string }>][] = [
    ["gender", config.genders],
    ["achievementCategory", config.achievementCategories],
    ["achievementCriterionType", config.achievementCriterionTypes],
    ["questObjectiveType", config.questObjectiveTypes],
    ["questCompletionType", config.questCompletionTypes],
    ["statusEffectType", config.statusEffectTypes],
    ["stackBehavior", config.stackBehaviors],
    ["abilityTargetType", config.abilityTargetTypes],
    ["craftingSkill", config.craftingSkills],
    ["craftingStationType", config.craftingStationTypes],
    ["guildRank", config.guildRanks],
  ];
  for (const [prefix, items] of registryChecks) {
    for (const [id, item] of Object.entries(items)) {
      if (!item.displayName?.trim()) {
        issues.push({
          severity: "error",
          entity: `${prefix}:${id}`,
          message: "Display name is required",
        });
      }
    }
  }

  // ─── Guild ranks ──────────────────────────────────────────────
  const seenLevels = new Map<number, string>();
  for (const [id, rank] of Object.entries(config.guildRanks)) {
    const existing = seenLevels.get(rank.level);
    if (existing) {
      issues.push({
        severity: "warning",
        entity: `guildRank:${id}`,
        message: `Duplicate rank level ${rank.level} (also used by "${existing}")`,
      });
    } else {
      seenLevels.set(rank.level, id);
    }
  }

  // ─── Status effect definitions → effect type cross-ref ────────
  // Registry keys are lowercase; status effects use UPPERCASE — compare case-insensitively
  const effectTypeIds = new Set(Object.keys(config.statusEffectTypes).map((k) => k.toLowerCase()));
  const stackBehaviorIds = new Set(Object.keys(config.stackBehaviors).map((k) => k.toLowerCase()));
  if (effectTypeIds.size > 0) {
    for (const [id, e] of Object.entries(config.statusEffects)) {
      if (!effectTypeIds.has(e.effectType.toLowerCase())) {
        issues.push({
          severity: "warning",
          entity: `statusEffect:${id}`,
          message: `Effect type "${e.effectType}" is not a defined effect type`,
        });
      }
    }
  }
  if (stackBehaviorIds.size > 0) {
    for (const [id, e] of Object.entries(config.statusEffects)) {
      if (e.stackBehavior && !stackBehaviorIds.has(e.stackBehavior.toLowerCase())) {
        issues.push({
          severity: "warning",
          entity: `statusEffect:${id}`,
          message: `Stack behavior "${e.stackBehavior}" is not a defined stack behavior`,
        });
      }
    }
  }

  // ─── Ability definitions → target type cross-ref ──────────────
  const targetTypeIds = new Set(Object.keys(config.abilityTargetTypes).map((k) => k.toLowerCase()));
  if (targetTypeIds.size > 0) {
    for (const [id, a] of Object.entries(config.abilities)) {
      if (!targetTypeIds.has(a.targetType.toLowerCase())) {
        issues.push({
          severity: "warning",
          entity: `ability:${id}`,
          message: `Target type "${a.targetType}" is not a defined target type`,
        });
      }
    }
  }

  // ─── Housing ──────────────────────────────────────────────────
  const housingTemplates = config.housing.templates;
  if (Object.keys(housingTemplates).length > 0) {
    const entryTemplates = Object.entries(housingTemplates).filter(([, t]) => t.isEntry);
    if (entryTemplates.length === 0) {
      issues.push({
        severity: "error",
        entity: "housing",
        message: "No entry template defined — exactly one template must have isEntry: true",
      });
    } else if (entryTemplates.length > 1) {
      issues.push({
        severity: "error",
        entity: "housing",
        message: `Multiple entry templates: ${entryTemplates.map(([id]) => id).join(", ")} — only one is allowed`,
      });
    }
    const stationTypeIds = new Set(Object.keys(config.craftingStationTypes));
    for (const [id, t] of Object.entries(housingTemplates)) {
      if (!t.title?.trim()) {
        issues.push({
          severity: "error",
          entity: `housingTemplate:${id}`,
          message: "Title is required",
        });
      }
      if (t.cost < 0) {
        issues.push({
          severity: "error",
          entity: `housingTemplate:${id}`,
          message: "Cost must be >= 0",
        });
      }
      if (t.station && stationTypeIds.size > 0 && !stationTypeIds.has(t.station)) {
        issues.push({
          severity: "warning",
          entity: `housingTemplate:${id}`,
          message: `Station "${t.station}" is not a defined crafting station type`,
        });
      }
    }
  }

  // ─── Enchanting ──────────────────────────────────────────────
  const craftingSkillIds = new Set(Object.keys(config.craftingSkills));
  const equipSlotIds = new Set(Object.keys(config.equipmentSlots));
  for (const [id, ench] of Object.entries(config.enchanting.definitions)) {
    if (!ench.displayName?.trim()) {
      issues.push({
        severity: "error",
        entity: `enchantment:${id}`,
        message: "Display name is required",
      });
    }
    if (ench.skillRequired < 1) {
      issues.push({
        severity: "error",
        entity: `enchantment:${id}`,
        message: "Skill required must be at least 1",
      });
    }
    if (ench.materials.length === 0) {
      issues.push({
        severity: "warning",
        entity: `enchantment:${id}`,
        message: "Enchantment has no materials",
      });
    }
    for (const mat of ench.materials) {
      if (!mat.itemId?.trim()) {
        issues.push({
          severity: "error",
          entity: `enchantment:${id}`,
          message: "Material has empty item ID",
        });
      }
    }
    if (ench.skill && craftingSkillIds.size > 0 && !craftingSkillIds.has(ench.skill) && !craftingSkillIds.has(ench.skill.toLowerCase())) {
      issues.push({
        severity: "warning",
        entity: `enchantment:${id}`,
        message: `Skill "${ench.skill}" is not a defined crafting skill`,
      });
    }
    if (ench.targetSlots && ench.targetSlots.length > 0 && equipSlotIds.size > 0) {
      for (const slot of ench.targetSlots) {
        if (!equipSlotIds.has(slot) && !equipSlotIds.has(slot.toLowerCase())) {
          issues.push({
            severity: "warning",
            entity: `enchantment:${id}`,
            message: `Target slot "${slot}" is not a defined equipment slot`,
          });
        }
      }
    }
    if (ench.statBonuses && statIds.size > 0) {
      for (const statId of Object.keys(ench.statBonuses)) {
        if (!statIds.has(statId)) {
          issues.push({
            severity: "warning",
            entity: `enchantment:${id}`,
            message: `Stat bonus references unknown stat "${statId}"`,
          });
        }
      }
    }
  }
  if (config.enchanting.maxEnchantmentsPerItem < 1) {
    issues.push({
      severity: "error",
      entity: "enchanting",
      message: "Max enchantments per item must be at least 1",
    });
  }

  // ─── World Time ──────────────────────────────────────────────
  const wt = config.worldTime;
  if (wt.cycleLengthMs < 1000) {
    issues.push({ severity: "error", entity: "worldTime", message: "Cycle length must be at least 1000ms" });
  }
  if (wt.dawnHour < 0 || wt.dawnHour > 23 || wt.dayHour < 0 || wt.dayHour > 23 ||
      wt.duskHour < 0 || wt.duskHour > 23 || wt.nightHour < 0 || wt.nightHour > 23) {
    issues.push({ severity: "error", entity: "worldTime", message: "Time period hours must be 0-23" });
  }
  if (wt.dawnHour >= wt.dayHour || wt.dayHour >= wt.duskHour || wt.duskHour >= wt.nightHour) {
    issues.push({ severity: "warning", entity: "worldTime", message: "Time period hours should be in order: dawn < day < dusk < night" });
  }

  // ─── Seasons ─────────────────────────────────────────────────
  if (config.season && config.season.cycleLengthMs <= 0) {
    issues.push({ severity: "error", entity: "season", message: "Season cycle length must be greater than 0" });
  }

  // ─── Weather ────────────────────────────────────────────────
  if (config.weather.minTransitionMs > config.weather.maxTransitionMs) {
    issues.push({ severity: "warning", entity: "weather", message: "Min transition time exceeds max transition time" });
  }

  // ─── Rare Mob Variants ──────────────────────────────────────
  if (config.mobVariants) {
    const mv = config.mobVariants;
    if (Number.isNaN(mv.chance) || mv.chance < 0 || mv.chance > 1) {
      issues.push({ severity: "error", entity: "mobVariants", message: "Variant chance must be in 0.0..1.0" });
    }
    for (const [id, v] of Object.entries(mv.variants)) {
      if (v.weight < 0) {
        issues.push({ severity: "error", entity: `mobVariant:${id}`, message: "Weight must be >= 0" });
      }
      if (v.announce && !["ROOM", "ZONE", "SERVER"].includes(v.announce)) {
        issues.push({ severity: "error", entity: `mobVariant:${id}`, message: "Announce must be ROOM, ZONE, or SERVER" });
      }
    }
  }

  // ─── Weather Types ──────────────────────────────────────────────
  for (const [id, wt] of Object.entries(config.weather.types)) {
    if (!wt.displayName?.trim()) {
      issues.push({ severity: "error", entity: `weatherType:${id}`, message: "Display name is required" });
    }
    if (wt.weight <= 0) {
      issues.push({ severity: "warning", entity: `weatherType:${id}`, message: "Weight should be greater than 0" });
    }
  }

  // ─── Environment Themes ─────────────────────────────────────────
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  if (config.environment) {
    const dt = config.environment.defaultTheme;
    for (let i = 0; i < dt.moteColors.length; i++) {
      const mc = dt.moteColors[i]!;
      if (!hexRe.test(mc.core)) {
        issues.push({ severity: "warning", entity: `environment:defaultTheme:moteColor[${i}]`, message: `Invalid core color: ${mc.core}` });
      }
      if (!hexRe.test(mc.glow)) {
        issues.push({ severity: "warning", entity: `environment:defaultTheme:moteColor[${i}]`, message: `Invalid glow color: ${mc.glow}` });
      }
    }
    for (const [period, sg] of Object.entries(dt.skyGradients)) {
      if (sg && !hexRe.test(sg.top)) {
        issues.push({ severity: "warning", entity: `environment:defaultTheme:sky:${period}`, message: `Invalid top color: ${sg.top}` });
      }
      if (sg && !hexRe.test(sg.bottom)) {
        issues.push({ severity: "warning", entity: `environment:defaultTheme:sky:${period}`, message: `Invalid bottom color: ${sg.bottom}` });
      }
    }
    for (let i = 0; i < dt.transitionColors.length; i++) {
      if (!hexRe.test(dt.transitionColors[i]!)) {
        issues.push({ severity: "warning", entity: `environment:defaultTheme:transition[${i}]`, message: `Invalid color: ${dt.transitionColors[i]}` });
      }
    }
  }

  // ─── World Events ───────────────────────────────────────────
  for (const [id, evt] of Object.entries(config.worldEvents.definitions)) {
    if (!evt.displayName?.trim()) {
      issues.push({ severity: "error", entity: `worldEvent:${id}`, message: "Display name is required" });
    }
    if (evt.startDate && evt.endDate && evt.startDate > evt.endDate) {
      issues.push({ severity: "warning", entity: `worldEvent:${id}`, message: "Start date is after end date" });
    }
  }

  // ─── Death / Sanctum ─────────────────────────────────────────
  // Mirrors AppConfig.validateDeath() on the server.
  const death = config.death;
  if (death) {
    if (death.respawnHpFraction < 0.05 || death.respawnHpFraction > 1.0) {
      issues.push({
        severity: "error",
        entity: "death",
        message: `respawnHpFraction must be in [0.05, 1.0] (got ${death.respawnHpFraction})`,
      });
    }
    if (death.respawnManaFraction < 0 || death.respawnManaFraction > 1.0) {
      issues.push({
        severity: "error",
        entity: "death",
        message: `respawnManaFraction must be in [0.0, 1.0] (got ${death.respawnManaFraction})`,
      });
    }
    if (death.xpPenaltyFraction < 0 || death.xpPenaltyFraction > 0.5) {
      issues.push({
        severity: "error",
        entity: "death",
        message: `xpPenaltyFraction must be in [0.0, 0.5] (got ${death.xpPenaltyFraction})`,
      });
    }
    if (death.sanctumRoom && !death.sanctumRoom.includes(":")) {
      issues.push({
        severity: "error",
        entity: "death",
        message: `Sanctum room must be in 'zone:room' format (got '${death.sanctumRoom}')`,
      });
    }
  }

  // ─── Mob action delay ────────────────────────────────────────
  if (config.mobActionDelay.minActionDelayMillis > config.mobActionDelay.maxActionDelayMillis) {
    issues.push({
      severity: "warning",
      entity: "mobActionDelay",
      message: "Min action delay exceeds max action delay",
    });
  }

  // ─── Mob tiers ───────────────────────────────────────────────
  // Mirrors the server's validateMobTier() rule
  const mobTierEntries: [string, typeof config.mobTiers.weak][] = [
    ["weak", config.mobTiers.weak],
    ["standard", config.mobTiers.standard],
    ["elite", config.mobTiers.elite],
    ["boss", config.mobTiers.boss],
  ];
  for (const [name, tier] of mobTierEntries) {
    const entity = `mobTier:${name}`;
    if (tier.baseHp <= 0) {
      issues.push({ severity: "error", entity, message: "baseHp must be > 0" });
    }
    if (tier.hpScalingRate < 1.0 || tier.hpScalingRate > 2.0) {
      issues.push({ severity: "error", entity, message: `hpScalingRate must be in [1.0, 2.0] (got ${tier.hpScalingRate})` });
    }
    if (tier.baseMinDamage <= 0) {
      issues.push({ severity: "error", entity, message: "baseMinDamage must be > 0" });
    }
    if (tier.baseMaxDamage < tier.baseMinDamage) {
      issues.push({ severity: "error", entity, message: "baseMaxDamage must be >= baseMinDamage" });
    }
    if (tier.damageScalingRate < 1.0 || tier.damageScalingRate > 2.0) {
      issues.push({ severity: "error", entity, message: `damageScalingRate must be in [1.0, 2.0] (got ${tier.damageScalingRate})` });
    }
    if (tier.baseArmor < 0) {
      issues.push({ severity: "error", entity, message: "baseArmor must be >= 0" });
    }
    if (tier.baseXpReward < 0) {
      issues.push({ severity: "error", entity, message: "baseXpReward must be >= 0" });
    }
    if (tier.xpScalingRate < 1.0 || tier.xpScalingRate > 2.0) {
      issues.push({ severity: "error", entity, message: `xpScalingRate must be in [1.0, 2.0] (got ${tier.xpScalingRate})` });
    }
    if (tier.baseGoldMin < 0) {
      issues.push({ severity: "error", entity, message: "baseGoldMin must be >= 0" });
    }
    if (tier.baseGoldMax < tier.baseGoldMin) {
      issues.push({ severity: "error", entity, message: "baseGoldMax must be >= baseGoldMin" });
    }
    if (tier.goldScalingRate < 1.0 || tier.goldScalingRate > 2.0) {
      issues.push({ severity: "error", entity, message: `goldScalingRate must be in [1.0, 2.0] (got ${tier.goldScalingRate})` });
    }
  }

  // ─── Progression ──────────────────────────────────────────────
  if (config.progression.maxLevel < 1) {
    issues.push({
      severity: "error",
      entity: "progression",
      message: "Max level must be at least 1",
    });
  }
  if (config.progression.rewards.baseHp < 1) {
    issues.push({
      severity: "error",
      entity: "progression",
      message: "Base HP must be at least 1",
    });
  }
  if (config.progression.rewards.baseMana < 0) {
    issues.push({
      severity: "error",
      entity: "progression",
      message: "Base mana must be >= 0",
    });
  }
  const rewards = config.progression.rewards;
  if (rewards.hpScalingRate < 1.0 || rewards.hpScalingRate > 2.0) {
    issues.push({
      severity: "error",
      entity: "progression",
      message: `rewards.hpScalingRate must be in [1.0, 2.0] (got ${rewards.hpScalingRate})`,
    });
  }
  if (rewards.manaScalingRate < 1.0 || rewards.manaScalingRate > 2.0) {
    issues.push({
      severity: "error",
      entity: "progression",
      message: `rewards.manaScalingRate must be in [1.0, 2.0] (got ${rewards.manaScalingRate})`,
    });
  }
  for (const [id, cls] of Object.entries(config.classes)) {
    if (cls.hpScalingRate != null && (cls.hpScalingRate < 1.0 || cls.hpScalingRate > 2.0)) {
      issues.push({
        severity: "error",
        entity: `class:${id}`,
        message: `hpScalingRate must be in [1.0, 2.0] (got ${cls.hpScalingRate})`,
      });
    }
    if (cls.manaScalingRate != null && (cls.manaScalingRate < 1.0 || cls.manaScalingRate > 2.0)) {
      issues.push({
        severity: "error",
        entity: `class:${id}`,
        message: `manaScalingRate must be in [1.0, 2.0] (got ${cls.manaScalingRate})`,
      });
    }
  }

  // ─── Character creation ─────────────────────────────────────
  if (config.characterCreation.startingGold < 0) {
    issues.push({
      severity: "error",
      entity: "characterCreation",
      message: "Starting gold must be >= 0",
    });
  }
  const raceIds = new Set(Object.keys(config.races));
  const genderIds = new Set(Object.keys(config.genders));
  if (config.characterCreation.defaultRace && raceIds.size > 0 && !raceIds.has(config.characterCreation.defaultRace)) {
    issues.push({
      severity: "warning",
      entity: "characterCreation",
      message: `Default race "${config.characterCreation.defaultRace}" is not a defined race`,
    });
  }
  if (config.characterCreation.defaultClass && classIds.size > 0 && !classIds.has(config.characterCreation.defaultClass)) {
    issues.push({
      severity: "warning",
      entity: "characterCreation",
      message: `Default class "${config.characterCreation.defaultClass}" is not a defined class`,
    });
  }
  if (config.characterCreation.defaultGender && genderIds.size > 0 && !genderIds.has(config.characterCreation.defaultGender)) {
    issues.push({
      severity: "warning",
      entity: "characterCreation",
      message: `Default gender "${config.characterCreation.defaultGender}" is not a defined gender`,
    });
  }

  // ─── Required global assets ──────────────────────────────────
  // The MUD looks up these keys under images.globalAssets and Spring Boot
  // replaces the entire map (no per-entry merge), so every required key
  // must be set on the project side.
  for (const missing of missingRequiredGlobalAssets(config.globalAssets)) {
    issues.push({
      severity: "warning",
      entity: `globalAsset:${missing.key}`,
      message: `Required global asset "${missing.key}" (${missing.label}) is not assigned`,
    });
  }

  // ─── Emote presets ────────────────────────────────────────────
  const emotePresets = config.emotePresets?.presets ?? [];
  for (let i = 0; i < emotePresets.length; i++) {
    const preset = emotePresets[i]!;
    if (!preset.label?.trim()) {
      issues.push({
        severity: "error",
        entity: `emotePreset:${i}`,
        message: `Emote preset #${i + 1} has an empty label`,
      });
    }
    if (!preset.action?.trim()) {
      issues.push({
        severity: "error",
        entity: `emotePreset:${i}`,
        message: `Emote preset #${i + 1} has an empty action`,
      });
    }
  }

  const lottery = normalizedLottery(config.lottery);
  if (lottery?.enabled) {
    if (lottery.ticketCost <= 0) issues.push({ severity: "error", entity: "lottery", message: "Ticket cost must be > 0" });
    if (lottery.drawingIntervalMs <= 0) issues.push({ severity: "error", entity: "lottery", message: "Drawing interval must be > 0" });
    if (lottery.jackpotSeedGold < 0) issues.push({ severity: "error", entity: "lottery", message: "Jackpot seed gold must be >= 0" });
    if (lottery.jackpotPercentFromTickets < 0 || lottery.jackpotPercentFromTickets > 100) {
      issues.push({ severity: "error", entity: "lottery", message: "jackpotPercentFromTickets must be in 0..100" });
    }
    if (lottery.maxTicketsPerPlayer <= 0) {
      issues.push({ severity: "error", entity: "lottery", message: "maxTicketsPerPlayer must be > 0" });
    }
  }

  const gambling = normalizedGambling(config.gambling);
  if (gambling?.enabled) {
    if (gambling.diceMinBet <= 0) issues.push({ severity: "error", entity: "gambling", message: "diceMinBet must be > 0" });
    if (gambling.diceMaxBet < gambling.diceMinBet) issues.push({ severity: "error", entity: "gambling", message: "diceMaxBet must be >= diceMinBet" });
    if (gambling.diceWinChance < 0 || gambling.diceWinChance > 1) issues.push({ severity: "error", entity: "gambling", message: "diceWinChance must be in 0.0..1.0" });
    if (gambling.diceWinMultiplier <= 0) issues.push({ severity: "error", entity: "gambling", message: "diceWinMultiplier must be > 0" });
    if (gambling.cooldownMs < 0) issues.push({ severity: "error", entity: "gambling", message: "cooldownMs must be >= 0" });
  }

  const respec = normalizedRespec(config.respec);
  if (respec) {
    if (respec.goldCost < 0) issues.push({ severity: "error", entity: "respec", message: "goldCost must be >= 0" });
    if (respec.cooldownMs < 0) issues.push({ severity: "error", entity: "respec", message: "cooldownMs must be >= 0" });
  }

  if (config.currencies) {
    for (const [id, def] of Object.entries(config.currencies.definitions)) {
      if (!def.displayName?.trim()) issues.push({ severity: "error", entity: `currency:${id}`, message: "Display name is required" });
      if ((def.maxAmount ?? 0) < 0) issues.push({ severity: "error", entity: `currency:${id}`, message: "maxAmount must be >= 0" });
    }
    if ((config.currencies.honorPerPvpKill ?? 10) < 0) issues.push({ severity: "error", entity: "currencies", message: "honorPerPvpKill must be >= 0" });
    if ((config.currencies.tokensPerCraft ?? 1) < 0) issues.push({ severity: "error", entity: "currencies", message: "tokensPerCraft must be >= 0" });
  }

  if (config.dailyQuests?.enabled) {
    const dq = config.dailyQuests;
    if ((dq.resetHourUtc ?? 0) < 0 || (dq.resetHourUtc ?? 0) > 23) issues.push({ severity: "error", entity: "dailyQuests", message: "resetHourUtc must be 0..23" });
    if ((dq.dailySlots ?? 3) < 0 || (dq.dailySlots ?? 3) > 20) issues.push({ severity: "error", entity: "dailyQuests", message: "dailySlots must be 0..20" });
    if ((dq.weeklySlots ?? 1) < 0 || (dq.weeklySlots ?? 1) > 20) issues.push({ severity: "error", entity: "dailyQuests", message: "weeklySlots must be 0..20" });
    if (dq.streakBonusPercent < 0) issues.push({ severity: "error", entity: "dailyQuests", message: "streakBonusPercent must be >= 0" });
    if ((dq.streakMaxDays ?? 7) < 0) issues.push({ severity: "error", entity: "dailyQuests", message: "streakMaxDays must be >= 0" });
    if ((dq.dailyPool?.length ?? 0) < (dq.dailySlots ?? 3) && (dq.dailySlots ?? 3) > 0) {
      issues.push({ severity: "error", entity: "dailyQuests", message: "dailyPool must have at least dailySlots entries" });
    }
    if ((dq.weeklyPool?.length ?? 0) < (dq.weeklySlots ?? 1) && (dq.weeklySlots ?? 1) > 0) {
      issues.push({ severity: "error", entity: "dailyQuests", message: "weeklyPool must have at least weeklySlots entries" });
    }
  }

  if (config.autoQuests) {
    const aq = config.autoQuests;
    if (aq.timeLimitMs <= 0) issues.push({ severity: "error", entity: "autoQuests", message: "timeLimitMs must be > 0" });
    if (aq.cooldownMs < 0) issues.push({ severity: "error", entity: "autoQuests", message: "cooldownMs must be >= 0" });
    if ((aq.rewardGoldBase ?? 50) < 0) issues.push({ severity: "error", entity: "autoQuests", message: "rewardGoldBase must be >= 0" });
    if ((aq.rewardGoldPerLevel ?? 10) < 0) issues.push({ severity: "error", entity: "autoQuests", message: "rewardGoldPerLevel must be >= 0" });
    if ((aq.rewardXpBase ?? 100) < 0) issues.push({ severity: "error", entity: "autoQuests", message: "rewardXpBase must be >= 0" });
    if ((aq.rewardXpPerLevel ?? 25) < 0) issues.push({ severity: "error", entity: "autoQuests", message: "rewardXpPerLevel must be >= 0" });
    if ((aq.killCountMin ?? 3) <= 0) issues.push({ severity: "error", entity: "autoQuests", message: "killCountMin must be > 0" });
    if ((aq.killCountMax ?? 8) < (aq.killCountMin ?? 3)) issues.push({ severity: "error", entity: "autoQuests", message: "killCountMax must be >= killCountMin" });
  }

  if (config.globalQuests?.enabled) {
    const gq = config.globalQuests;
    if (gq.intervalMs <= 0) issues.push({ severity: "error", entity: "globalQuests", message: "intervalMs must be > 0" });
    if (gq.durationMs <= 0) issues.push({ severity: "error", entity: "globalQuests", message: "durationMs must be > 0" });
    if ((gq.announceIntervalMs ?? 300_000) <= 0) issues.push({ severity: "error", entity: "globalQuests", message: "announceIntervalMs must be > 0" });
    if ((gq.minPlayersOnline ?? 2) < 1) issues.push({ severity: "error", entity: "globalQuests", message: "minPlayersOnline must be >= 1" });
    if ((gq.objectives?.length ?? 0) === 0) issues.push({ severity: "error", entity: "globalQuests", message: "At least one objective is required" });
  }

  if (config.guildHalls) {
    const gh = config.guildHalls;
    const templates = gh.templates ?? gh.roomTemplates ?? {};
    if ((gh.purchaseCost ?? gh.baseCost ?? 50_000) < 0) issues.push({ severity: "error", entity: "guildHalls", message: "purchaseCost must be >= 0" });
    if ((gh.roomCost ?? 10_000) < 0) issues.push({ severity: "error", entity: "guildHalls", message: "roomCost must be >= 0" });
    if ((gh.maxRooms ?? 10) < 1) issues.push({ severity: "error", entity: "guildHalls", message: "maxRooms must be >= 1" });
    for (const [id, template] of Object.entries(templates)) {
      if (!(template.title ?? template.displayName)?.trim()) {
        issues.push({ severity: "error", entity: `guildHallTemplate:${id}`, message: "Title is required" });
      }
    }
  }

  return issues;
}
