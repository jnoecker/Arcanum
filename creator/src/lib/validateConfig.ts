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

  // ─── Pets ─────────────────────────────────────────────────────
  const petIds = new Set(Object.keys(config.pets ?? {}));
  for (const [id, pet] of Object.entries(config.pets ?? {})) {
    if (!pet.name?.trim()) {
      issues.push({
        severity: "error",
        entity: `pet:${id}`,
        message: "Name is required",
      });
    }
    if (pet.hp < 1) {
      issues.push({
        severity: "error",
        entity: `pet:${id}`,
        message: "HP must be at least 1",
      });
    }
    if (pet.minDamage > pet.maxDamage) {
      issues.push({
        severity: "warning",
        entity: `pet:${id}`,
        message: "Min damage exceeds max damage",
      });
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
    if (
      a.effect.type === "SUMMON_PET" &&
      a.effect.petTemplateKey &&
      petIds.size > 0 &&
      !petIds.has(a.effect.petTemplateKey)
    ) {
      issues.push({
        severity: "warning",
        entity: `ability:${id}`,
        message: `Summon effect references unknown pet "${a.effect.petTemplateKey}"`,
      });
    }
    if (a.classRestriction && classIds.size > 0 && !classIds.has(a.classRestriction)) {
      issues.push({
        severity: "warning",
        entity: `ability:${id}`,
        message: `Class restriction "${a.classRestriction}" is not defined`,
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
  }

  // ─── Equipment Slots ────────────────────────────────────────────
  const seenOrders = new Map<number, string>();
  for (const [id, slot] of Object.entries(config.equipmentSlots)) {
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
  const effectTypeIds = new Set(Object.keys(config.statusEffectTypes));
  const stackBehaviorIds = new Set(Object.keys(config.stackBehaviors));
  if (effectTypeIds.size > 0) {
    for (const [id, e] of Object.entries(config.statusEffects)) {
      if (!effectTypeIds.has(e.effectType)) {
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
      if (e.stackBehavior && !stackBehaviorIds.has(e.stackBehavior)) {
        issues.push({
          severity: "warning",
          entity: `statusEffect:${id}`,
          message: `Stack behavior "${e.stackBehavior}" is not a defined stack behavior`,
        });
      }
    }
  }

  // ─── Ability definitions → target type cross-ref ──────────────
  const targetTypeIds = new Set(Object.keys(config.abilityTargetTypes));
  if (targetTypeIds.size > 0) {
    for (const [id, a] of Object.entries(config.abilities)) {
      if (!targetTypeIds.has(a.targetType)) {
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
    if (ench.skill && craftingSkillIds.size > 0 && !craftingSkillIds.has(ench.skill)) {
      issues.push({
        severity: "warning",
        entity: `enchantment:${id}`,
        message: `Skill "${ench.skill}" is not a defined crafting skill`,
      });
    }
    if (ench.targetSlots && ench.targetSlots.length > 0 && equipSlotIds.size > 0) {
      for (const slot of ench.targetSlots) {
        if (!equipSlotIds.has(slot)) {
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

  // ─── Weather ────────────────────────────────────────────────
  if (config.weather.minTransitionMs > config.weather.maxTransitionMs) {
    issues.push({ severity: "warning", entity: "weather", message: "Min transition time exceeds max transition time" });
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

  // ─── Combat ───────────────────────────────────────────────────
  if (config.combat.minDamage > config.combat.maxDamage) {
    issues.push({
      severity: "warning",
      entity: "combat",
      message: "Min damage exceeds max damage",
    });
  }

  // ─── Mob action delay ────────────────────────────────────────
  if (config.mobActionDelay.minActionDelayMillis > config.mobActionDelay.maxActionDelayMillis) {
    issues.push({
      severity: "warning",
      entity: "mobActionDelay",
      message: "Min action delay exceeds max action delay",
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

  return issues;
}
