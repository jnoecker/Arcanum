import type { AppConfig } from "@/types/config";
import { missingRequiredGlobalAssets } from "./requiredGlobalAssets";
import type { ValidationIssue } from "./validateZone";

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

  // ─── Weather ────────────────────────────────────────────────
  if (config.weather.minTransitionMs > config.weather.maxTransitionMs) {
    issues.push({ severity: "warning", entity: "weather", message: "Min transition time exceeds max transition time" });
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
    if (tier.hpPerLevel < 0) {
      issues.push({ severity: "error", entity, message: "hpPerLevel must be >= 0" });
    }
    if (tier.baseMinDamage <= 0) {
      issues.push({ severity: "error", entity, message: "baseMinDamage must be > 0" });
    }
    if (tier.baseMaxDamage < tier.baseMinDamage) {
      issues.push({ severity: "error", entity, message: "baseMaxDamage must be >= baseMinDamage" });
    }
    if (tier.damagePerLevel < 0) {
      issues.push({ severity: "error", entity, message: "damagePerLevel must be >= 0" });
    }
    if (tier.baseArmor < 0) {
      issues.push({ severity: "error", entity, message: "baseArmor must be >= 0" });
    }
    if (tier.baseXpReward < 0) {
      issues.push({ severity: "error", entity, message: "baseXpReward must be >= 0" });
    }
    if (tier.xpRewardPerLevel < 0) {
      issues.push({ severity: "error", entity, message: "xpRewardPerLevel must be >= 0" });
    }
    if (tier.baseGoldMin < 0) {
      issues.push({ severity: "error", entity, message: "baseGoldMin must be >= 0" });
    }
    if (tier.baseGoldMax < tier.baseGoldMin) {
      issues.push({ severity: "error", entity, message: "baseGoldMax must be >= baseGoldMin" });
    }
    if (tier.goldPerLevel < 0) {
      issues.push({ severity: "error", entity, message: "goldPerLevel must be >= 0" });
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
