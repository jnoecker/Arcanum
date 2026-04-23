// ─── Field Metadata Catalog ────────────────────────────────────────
//
// Maps every tunable scalar field in AppConfig to rich metadata for
// the Tuning Wizard: labels, descriptions, section grouping, impact,
// and optional min/max/interaction notes.
//
// Section assignments follow D-01 definitions:
//   Combat & Stats      -- combat, mobTiers, stats.bindings (numeric only)
//   Economy & Crafting   -- economy, crafting, gambling, lottery, bank, enchanting
//   Progression & Quests -- progression, autoQuests, dailyQuests, globalQuests,
//                           skillPoints, multiclass, prestige, respec, characterCreation
//   World & Social       -- regen, worldTime, weather, group, navigation, friends,
//                           guild, guildHalls, housing, factions, leaderboard

import type { FieldMeta } from "./types";
import { TuningSection } from "./types";

export const FIELD_METADATA: Record<string, FieldMeta> = {
  // ─── Combat ────────────────────────────────────────────────────────

  "combat.tickMillis": {
    label: "Combat Tick Duration",
    description: "Milliseconds between combat rounds",
    section: TuningSection.CombatStats,
    min: 100,
    impact: "high",
    interactionNote: "Affects overall combat speed and DPS calculations",
  },
  "combat.minDamage": {
    label: "Global Min Damage",
    description:
      "Minimum of the per-swing random roll. This roll is ADDED on top of weapon damage and the melee stat bonus -- it is not a damage floor or cap. Keep small so weapons remain the dominant damage source.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote:
      "Added to weapon damage + melee stat bonus every swing. If large, drowns out item/class tuning.",
  },
  "combat.maxDamage": {
    label: "Global Max Damage",
    description:
      "Maximum of the per-swing random roll. This roll is ADDED on top of weapon damage and the melee stat bonus -- it is not a damage cap. A value much larger than typical weapon damage will dominate the formula and make weapon/class tuning feel like noise. Typical values: 4-10.",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote:
      "Added to weapon damage + melee stat bonus every swing. Recommended to stay in the same order of magnitude as the strongest weapon's damage.",
  },

  // ─── Mob Tiers: Weak ───────────────────────────────────────────────

  "mobTiers.weak.baseHp": {
    label: "Weak Mob Base HP",
    description: "Starting hit points for weak-tier mobs at level 0",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Combined with hpPerLevel to determine mob survivability curve",
  },
  "mobTiers.weak.hpPerLevel": {
    label: "Weak Mob HP/Level",
    description: "Additional hit points gained per level for weak mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote: "Scales mob tankiness -- affects kill times at all levels",
  },
  "mobTiers.weak.baseMinDamage": {
    label: "Weak Mob Min Damage",
    description: "Minimum base damage for weak mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.weak.baseMaxDamage": {
    label: "Weak Mob Max Damage",
    description: "Maximum base damage for weak mobs",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "medium",
  },
  "mobTiers.weak.damagePerLevel": {
    label: "Weak Mob Damage/Level",
    description: "Additional damage per level for weak mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.weak.baseArmor": {
    label: "Weak Mob Base Armor",
    description: "Starting armor value for weak mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "low",
  },
  "mobTiers.weak.baseXpReward": {
    label: "Weak Mob Base XP",
    description: "Base XP reward for killing a weak mob",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote: "Core XP income source -- affects leveling speed directly",
  },
  "mobTiers.weak.xpRewardPerLevel": {
    label: "Weak Mob XP/Level",
    description: "Additional XP reward per mob level for weak mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "mobTiers.weak.baseGoldMin": {
    label: "Weak Mob Min Gold",
    description: "Minimum gold drop from weak mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.weak.baseGoldMax": {
    label: "Weak Mob Max Gold",
    description: "Maximum gold drop from weak mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.weak.goldPerLevel": {
    label: "Weak Mob Gold/Level",
    description: "Additional gold per mob level for weak mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },

  // ─── Mob Tiers: Standard ───────────────────────────────────────────

  "mobTiers.standard.baseHp": {
    label: "Standard Mob Base HP",
    description: "Starting hit points for standard-tier mobs at level 0",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Combined with hpPerLevel to determine mob survivability curve",
  },
  "mobTiers.standard.hpPerLevel": {
    label: "Standard Mob HP/Level",
    description: "Additional hit points gained per level for standard mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote: "Scales mob tankiness -- affects kill times at all levels",
  },
  "mobTiers.standard.baseMinDamage": {
    label: "Standard Mob Min Damage",
    description: "Minimum base damage for standard mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.standard.baseMaxDamage": {
    label: "Standard Mob Max Damage",
    description: "Maximum base damage for standard mobs",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "medium",
  },
  "mobTiers.standard.damagePerLevel": {
    label: "Standard Mob Damage/Level",
    description: "Additional damage per level for standard mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.standard.baseArmor": {
    label: "Standard Mob Base Armor",
    description: "Starting armor value for standard mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "low",
  },
  "mobTiers.standard.baseXpReward": {
    label: "Standard Mob Base XP",
    description: "Base XP reward for killing a standard mob",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote: "Primary XP income source for most players",
  },
  "mobTiers.standard.xpRewardPerLevel": {
    label: "Standard Mob XP/Level",
    description: "Additional XP reward per mob level for standard mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "mobTiers.standard.baseGoldMin": {
    label: "Standard Mob Min Gold",
    description: "Minimum gold drop from standard mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.standard.baseGoldMax": {
    label: "Standard Mob Max Gold",
    description: "Maximum gold drop from standard mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.standard.goldPerLevel": {
    label: "Standard Mob Gold/Level",
    description: "Additional gold per mob level for standard mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },

  // ─── Mob Tiers: Elite ──────────────────────────────────────────────

  "mobTiers.elite.baseHp": {
    label: "Elite Mob Base HP",
    description: "Starting hit points for elite-tier mobs at level 0",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Elite mobs are challenging encounters -- HP must outpace standard tier",
  },
  "mobTiers.elite.hpPerLevel": {
    label: "Elite Mob HP/Level",
    description: "Additional hit points gained per level for elite mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "mobTiers.elite.baseMinDamage": {
    label: "Elite Mob Min Damage",
    description: "Minimum base damage for elite mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.elite.baseMaxDamage": {
    label: "Elite Mob Max Damage",
    description: "Maximum base damage for elite mobs",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "medium",
  },
  "mobTiers.elite.damagePerLevel": {
    label: "Elite Mob Damage/Level",
    description: "Additional damage per level for elite mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.elite.baseArmor": {
    label: "Elite Mob Base Armor",
    description: "Starting armor value for elite mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "low",
  },
  "mobTiers.elite.baseXpReward": {
    label: "Elite Mob Base XP",
    description: "Base XP reward for killing an elite mob",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote: "High XP reward makes elites valuable targets for leveling",
  },
  "mobTiers.elite.xpRewardPerLevel": {
    label: "Elite Mob XP/Level",
    description: "Additional XP reward per mob level for elite mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "mobTiers.elite.baseGoldMin": {
    label: "Elite Mob Min Gold",
    description: "Minimum gold drop from elite mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.elite.baseGoldMax": {
    label: "Elite Mob Max Gold",
    description: "Maximum gold drop from elite mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.elite.goldPerLevel": {
    label: "Elite Mob Gold/Level",
    description: "Additional gold per mob level for elite mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },

  // ─── Mob Tiers: Boss ───────────────────────────────────────────────

  "mobTiers.boss.baseHp": {
    label: "Boss Mob Base HP",
    description: "Starting hit points for boss-tier mobs at level 0",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Boss HP defines encounter length -- too high causes tedium, too low trivializes content",
  },
  "mobTiers.boss.hpPerLevel": {
    label: "Boss Mob HP/Level",
    description: "Additional hit points gained per level for boss mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "mobTiers.boss.baseMinDamage": {
    label: "Boss Mob Min Damage",
    description: "Minimum base damage for boss mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "mobTiers.boss.baseMaxDamage": {
    label: "Boss Mob Max Damage",
    description: "Maximum base damage for boss mobs",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
  },
  "mobTiers.boss.damagePerLevel": {
    label: "Boss Mob Damage/Level",
    description: "Additional damage per level for boss mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "mobTiers.boss.baseArmor": {
    label: "Boss Mob Base Armor",
    description: "Starting armor value for boss mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.boss.baseXpReward": {
    label: "Boss Mob Base XP",
    description: "Base XP reward for killing a boss mob",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote: "Major XP reward -- affects whether boss farming is viable",
  },
  "mobTiers.boss.xpRewardPerLevel": {
    label: "Boss Mob XP/Level",
    description: "Additional XP reward per mob level for boss mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "mobTiers.boss.baseGoldMin": {
    label: "Boss Mob Min Gold",
    description: "Minimum gold drop from boss mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.boss.baseGoldMax": {
    label: "Boss Mob Max Gold",
    description: "Maximum gold drop from boss mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobTiers.boss.goldPerLevel": {
    label: "Boss Mob Gold/Level",
    description: "Additional gold per mob level for boss mobs",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },

  // ─── Mob Action Delay ──────────────────────────────────────────────

  "mobActionDelay.minActionDelayMillis": {
    label: "Mob Min Action Delay",
    description: "Minimum milliseconds between mob actions",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobActionDelay.maxActionDelayMillis": {
    label: "Mob Max Action Delay",
    description: "Maximum milliseconds between mob actions",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },

  // ─── Stat Bindings (numeric fields only) ───────────────────────────

  "stats.bindings.meleeDamageDivisor": {
    label: "Melee Damage Divisor",
    description: "Stat points divided by this value gives melee damage bonus",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Lower divisor = more damage per stat point. Core melee scaling factor.",
  },
  "stats.bindings.dodgePerPoint": {
    label: "Dodge % Per Point",
    description: "Dodge chance percentage gained per point of the dodge stat",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote: "Combined with maxDodgePercent to cap avoidance",
  },
  "stats.bindings.maxDodgePercent": {
    label: "Max Dodge %",
    description: "Maximum dodge chance percentage cap",
    section: TuningSection.CombatStats,
    min: 0,
    max: 100,
    impact: "high",
    interactionNote: "Hard cap on avoidance -- prevents full dodge builds from being unkillable",
  },
  "stats.bindings.spellDamageDivisor": {
    label: "Spell Damage Divisor",
    description: "Stat points divided by this value gives spell damage bonus",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Lower divisor = more spell damage per stat point. Core caster scaling.",
  },
  "stats.bindings.hpScalingDivisor": {
    label: "HP Scaling Divisor",
    description: "Stat points divided by this value gives bonus HP per level",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Affects player tankiness scaling with stats",
  },
  "stats.bindings.manaScalingDivisor": {
    label: "Mana Scaling Divisor",
    description: "Stat points divided by this value gives bonus mana per level",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "medium",
  },
  "stats.bindings.hpRegenMsPerPoint": {
    label: "HP Regen ms/Point",
    description: "Milliseconds subtracted from HP regen interval per stat point",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
    interactionNote: "Combined with regen base interval to determine effective regen rate",
  },
  "stats.bindings.manaRegenMsPerPoint": {
    label: "Mana Regen ms/Point",
    description: "Milliseconds subtracted from mana regen interval per stat point",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "stats.bindings.xpBonusPerPoint": {
    label: "XP Bonus Per Point",
    description: "Percentage XP bonus per point of the XP bonus stat",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
    interactionNote: "Multiplicative XP scaling from charisma -- affects leveling speed",
  },

  // ─── Economy ───────────────────────────────────────────────────────

  "economy.buyMultiplier": {
    label: "Shop Buy Multiplier",
    description: "Multiplier applied to item base price when buying from shops",
    section: TuningSection.EconomyCrafting,
    min: 0,
    impact: "high",
    interactionNote: "Higher values make items more expensive -- affects gold sink rate",
  },
  "economy.sellMultiplier": {
    label: "Shop Sell Multiplier",
    description: "Multiplier applied to item base price when selling to shops",
    section: TuningSection.EconomyCrafting,
    min: 0,
    max: 1,
    impact: "high",
    interactionNote: "Buy/sell spread determines gold economy health",
  },

  // ─── Crafting ──────────────────────────────────────────────────────

  "crafting.maxSkillLevel": {
    label: "Max Crafting Skill",
    description: "Maximum attainable crafting skill level",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "medium",
  },
  "crafting.baseXpPerLevel": {
    label: "Crafting Base XP/Level",
    description: "Base crafting XP required per skill level",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "medium",
  },
  "crafting.xpExponent": {
    label: "Crafting XP Exponent",
    description: "Exponent for crafting XP curve -- higher means steeper late-game progression",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "medium",
  },
  "crafting.gatherCooldownMs": {
    label: "Gather Cooldown",
    description: "Milliseconds between gathering attempts",
    section: TuningSection.EconomyCrafting,
    min: 0,
    impact: "low",
  },
  "crafting.stationBonusQuantity": {
    label: "Station Bonus Quantity",
    description: "Extra items produced when crafting at a station",
    section: TuningSection.EconomyCrafting,
    min: 0,
    impact: "low",
  },

  // ─── Gambling ──────────────────────────────────────────────────────

  "gambling.enabled": {
    label: "Gambling Enabled",
    description: "Whether the gambling system is active",
    section: TuningSection.EconomyCrafting,
    impact: "low",
  },
  "gambling.minBet": {
    label: "Minimum Bet",
    description: "Minimum gold amount for a single gamble",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "low",
  },
  "gambling.maxBet": {
    label: "Maximum Bet",
    description: "Maximum gold amount for a single gamble",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "medium",
  },
  "gambling.winChance": {
    label: "Gambling Win Chance",
    description: "Probability of winning a gamble (0-1)",
    section: TuningSection.EconomyCrafting,
    min: 0,
    max: 1,
    impact: "medium",
  },
  "gambling.winMultiplier": {
    label: "Gambling Win Multiplier",
    description: "Multiplier applied to bet amount on a win",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "medium",
  },

  // ─── Lottery ───────────────────────────────────────────────────────

  "lottery.enabled": {
    label: "Lottery Enabled",
    description: "Whether the lottery system is active",
    section: TuningSection.EconomyCrafting,
    impact: "low",
  },
  "lottery.ticketCost": {
    label: "Lottery Ticket Cost",
    description: "Gold cost per lottery ticket",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "low",
  },
  "lottery.drawingIntervalMs": {
    label: "Lottery Drawing Interval",
    description: "Milliseconds between lottery drawings",
    section: TuningSection.EconomyCrafting,
    min: 1000,
    impact: "low",
  },
  "lottery.jackpotBase": {
    label: "Lottery Jackpot Base",
    description: "Starting jackpot amount before ticket sales accumulate",
    section: TuningSection.EconomyCrafting,
    min: 0,
    impact: "low",
  },

  // ─── Stylist ───────────────────────────────────────────────────────

  "stylist.feeGold": {
    label: "Stylist Fee (Gold)",
    description: "Gold charged per race change at a stylist NPC",
    section: TuningSection.EconomyCrafting,
    min: 0,
    impact: "low",
  },

  // ─── Bank ──────────────────────────────────────────────────────────

  "bank.maxItems": {
    label: "Bank Max Items",
    description: "Maximum number of items a player can store in the bank",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "low",
  },

  // ─── Enchanting ────────────────────────────────────────────────────

  "enchanting.maxEnchantmentsPerItem": {
    label: "Max Enchantments/Item",
    description: "Maximum number of enchantments that can be applied to a single item",
    section: TuningSection.EconomyCrafting,
    min: 0,
    impact: "medium",
  },

  // ─── Progression ───────────────────────────────────────────────────

  "progression.maxLevel": {
    label: "Max Level",
    description: "Maximum character level players can reach",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "high",
    interactionNote: "Defines endgame -- all level-scaled formulas stop here",
  },
  "progression.xp.baseXp": {
    label: "Base XP",
    description: "Base experience points used in the XP curve formula",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "high",
    interactionNote: "Core multiplier in XP curve -- affects all leveling speed",
  },
  "progression.xp.exponent": {
    label: "XP Exponent",
    description: "Exponent in XP curve formula -- higher means steeper late-game XP requirements",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "high",
    interactionNote: "Most impactful XP param -- small changes dramatically affect high-level grind",
  },
  "progression.xp.linearXp": {
    label: "Linear XP",
    description: "Linear XP component added per level in the XP curve",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },
  "progression.xp.multiplier": {
    label: "XP Multiplier",
    description: "Global multiplier applied to the entire XP curve",
    section: TuningSection.ProgressionQuests,
    min: 0.01,
    impact: "high",
    interactionNote: "Scales entire curve uniformly -- use for global XP rate adjustment",
  },
  "progression.xp.defaultKillXp": {
    label: "Default Kill XP",
    description: "XP awarded for kills when no tier-specific XP is configured",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },
  "progression.rewards.hpPerLevel": {
    label: "HP Per Level",
    description: "Hit points gained per level from base progression",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "high",
    interactionNote: "Combined with class HP/level and stat scaling for total HP growth",
  },
  "progression.rewards.manaPerLevel": {
    label: "Mana Per Level",
    description: "Mana points gained per level from base progression",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "high",
  },
  "progression.rewards.fullHealOnLevelUp": {
    label: "Full Heal on Level Up",
    description: "Whether players are fully healed when gaining a level",
    section: TuningSection.ProgressionQuests,
    impact: "low",
  },
  "progression.rewards.fullManaOnLevelUp": {
    label: "Full Mana on Level Up",
    description: "Whether players get full mana when gaining a level",
    section: TuningSection.ProgressionQuests,
    impact: "low",
  },
  "progression.rewards.baseHp": {
    label: "Base HP",
    description: "Starting hit points for a new character before any level scaling",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "high",
    interactionNote: "Foundation for all HP calculations -- sets level 1 survivability",
  },
  "progression.rewards.baseMana": {
    label: "Base Mana",
    description: "Starting mana points for a new character before any level scaling",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "high",
  },

  // ─── Skill Points ──────────────────────────────────────────────────

  "skillPoints.interval": {
    label: "Skill Point Interval",
    description: "Levels between each skill point award",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "medium",
  },

  // ─── Multiclass ────────────────────────────────────────────────────

  "multiclass.minLevel": {
    label: "Multiclass Min Level",
    description: "Minimum level required to multiclass",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "medium",
  },
  "multiclass.goldCost": {
    label: "Multiclass Gold Cost",
    description: "Gold required to change class",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },

  // ─── Character Creation ────────────────────────────────────────────

  "characterCreation.startingGold": {
    label: "Starting Gold",
    description: "Gold amount given to new characters",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },

  // ─── Prestige ──────────────────────────────────────────────────────

  "prestige.enabled": {
    label: "Prestige Enabled",
    description: "Whether the prestige system is active",
    section: TuningSection.ProgressionQuests,
    impact: "medium",
  },
  "prestige.xpCostBase": {
    label: "Prestige XP Cost Base",
    description: "Base XP cost for the first prestige rank",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "high",
    interactionNote: "Combined with multiplier to determine prestige grind curve",
  },
  "prestige.xpCostMultiplier": {
    label: "Prestige XP Multiplier",
    description: "Multiplier applied per prestige rank to increase cost",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "high",
  },
  "prestige.maxRank": {
    label: "Prestige Max Rank",
    description: "Maximum prestige rank attainable",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "medium",
  },

  // ─── Respec ────────────────────────────────────────────────────────

  "respec.goldCost": {
    label: "Respec Gold Cost",
    description: "Gold cost to respecialize stats or skills",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },
  "respec.cooldownMs": {
    label: "Respec Cooldown",
    description: "Milliseconds between allowed respecs",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "low",
  },

  // ─── Auto Quests (Bounties) ────────────────────────────────────────

  "autoQuests.enabled": {
    label: "Bounties Enabled",
    description: "Whether the auto-quest bounty system is active",
    section: TuningSection.ProgressionQuests,
    impact: "medium",
  },
  "autoQuests.timeLimitMs": {
    label: "Bounty Time Limit",
    description: "Milliseconds allowed to complete a bounty quest",
    section: TuningSection.ProgressionQuests,
    min: 1000,
    impact: "medium",
  },
  "autoQuests.cooldownMs": {
    label: "Bounty Cooldown",
    description: "Milliseconds between bounty quest availability",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },
  "autoQuests.rewardScaling": {
    label: "Bounty Reward Scaling",
    description: "Multiplier for bounty quest rewards based on difficulty",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },

  // ─── Daily Quests ──────────────────────────────────────────────────

  "dailyQuests.enabled": {
    label: "Daily Quests Enabled",
    description: "Whether the daily quest system is active",
    section: TuningSection.ProgressionQuests,
    impact: "medium",
  },
  "dailyQuests.streakBonusPercent": {
    label: "Daily Streak Bonus %",
    description: "Percentage bonus reward for consecutive daily quest completions",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },

  // ─── Global Quests ─────────────────────────────────────────────────

  "globalQuests.enabled": {
    label: "Global Quests Enabled",
    description: "Whether server-wide global quests are active",
    section: TuningSection.ProgressionQuests,
    impact: "medium",
  },
  "globalQuests.intervalMs": {
    label: "Global Quest Interval",
    description: "Milliseconds between global quest activations",
    section: TuningSection.ProgressionQuests,
    min: 1000,
    impact: "low",
  },
  "globalQuests.durationMs": {
    label: "Global Quest Duration",
    description: "Milliseconds that a global quest remains active",
    section: TuningSection.ProgressionQuests,
    min: 1000,
    impact: "low",
  },

  // ─── Regen ─────────────────────────────────────────────────────────

  "regen.maxPlayersPerTick": {
    label: "Regen Max Players/Tick",
    description: "Maximum number of players processed per regen tick",
    section: TuningSection.WorldSocial,
    min: 1,
    impact: "low",
  },
  "regen.baseIntervalMillis": {
    label: "HP Regen Base Interval",
    description: "Base milliseconds between HP regen ticks before stat reduction",
    section: TuningSection.WorldSocial,
    min: 100,
    impact: "high",
    interactionNote: "Combined with stat-based reduction to determine effective regen rate",
  },
  "regen.minIntervalMillis": {
    label: "HP Regen Min Interval",
    description: "Minimum milliseconds between HP regen ticks (floor after stat reduction)",
    section: TuningSection.WorldSocial,
    min: 100,
    impact: "medium",
  },
  "regen.regenAmount": {
    label: "HP Regen Amount",
    description: "Hit points restored per regen tick",
    section: TuningSection.WorldSocial,
    min: 1,
    impact: "medium",
  },
  "regen.mana.baseIntervalMillis": {
    label: "Mana Regen Base Interval",
    description: "Base milliseconds between mana regen ticks before stat reduction",
    section: TuningSection.WorldSocial,
    min: 100,
    impact: "high",
  },
  "regen.mana.minIntervalMillis": {
    label: "Mana Regen Min Interval",
    description: "Minimum milliseconds between mana regen ticks (floor after stat reduction)",
    section: TuningSection.WorldSocial,
    min: 100,
    impact: "medium",
  },
  "regen.mana.regenAmount": {
    label: "Mana Regen Amount",
    description: "Mana points restored per regen tick",
    section: TuningSection.WorldSocial,
    min: 1,
    impact: "medium",
  },

  // ─── World Time ────────────────────────────────────────────────────

  "worldTime.cycleLengthMs": {
    label: "Day/Night Cycle Length",
    description: "Total milliseconds for one full day/night cycle",
    section: TuningSection.WorldSocial,
    min: 1000,
    impact: "medium",
  },
  "worldTime.dawnHour": {
    label: "Dawn Hour",
    description: "In-game hour when dawn begins",
    section: TuningSection.WorldSocial,
    min: 0,
    max: 23,
    impact: "low",
  },
  "worldTime.dayHour": {
    label: "Day Hour",
    description: "In-game hour when full daylight begins",
    section: TuningSection.WorldSocial,
    min: 0,
    max: 23,
    impact: "low",
  },
  "worldTime.duskHour": {
    label: "Dusk Hour",
    description: "In-game hour when dusk begins",
    section: TuningSection.WorldSocial,
    min: 0,
    max: 23,
    impact: "low",
  },
  "worldTime.nightHour": {
    label: "Night Hour",
    description: "In-game hour when full nighttime begins",
    section: TuningSection.WorldSocial,
    min: 0,
    max: 23,
    impact: "low",
  },

  // ─── Weather ───────────────────────────────────────────────────────

  "weather.minTransitionMs": {
    label: "Weather Min Transition",
    description: "Minimum milliseconds between weather state changes",
    section: TuningSection.WorldSocial,
    min: 1000,
    impact: "low",
  },
  "weather.maxTransitionMs": {
    label: "Weather Max Transition",
    description: "Maximum milliseconds between weather state changes",
    section: TuningSection.WorldSocial,
    min: 1000,
    impact: "low",
  },

  // ─── Group ─────────────────────────────────────────────────────────

  "group.maxSize": {
    label: "Max Group Size",
    description: "Maximum number of players in a group",
    section: TuningSection.WorldSocial,
    min: 2,
    impact: "medium",
  },
  "group.inviteTimeoutMs": {
    label: "Group Invite Timeout",
    description: "Milliseconds before a group invite expires",
    section: TuningSection.WorldSocial,
    min: 1000,
    impact: "low",
  },
  "group.xpBonusPerMember": {
    label: "Group XP Bonus/Member",
    description: "XP bonus percentage per additional group member",
    section: TuningSection.WorldSocial,
    min: 0,
    impact: "medium",
    interactionNote: "Incentivizes grouping -- higher values make solo play relatively less efficient",
  },

  // ─── Navigation ────────────────────────────────────────────────────

  "navigation.recall.cooldownMs": {
    label: "Recall Cooldown",
    description: "Milliseconds between allowed recall/teleport uses",
    section: TuningSection.WorldSocial,
    min: 0,
    impact: "low",
  },

  // ─── Friends ───────────────────────────────────────────────────────

  "friends.maxFriends": {
    label: "Max Friends",
    description: "Maximum number of friends a player can have",
    section: TuningSection.WorldSocial,
    min: 1,
    impact: "low",
  },

  // ─── Guild ─────────────────────────────────────────────────────────

  "guild.maxSize": {
    label: "Guild Max Size",
    description: "Maximum number of members in a guild",
    section: TuningSection.WorldSocial,
    min: 1,
    impact: "medium",
  },
  "guild.inviteTimeoutMs": {
    label: "Guild Invite Timeout",
    description: "Milliseconds before a guild invite expires",
    section: TuningSection.WorldSocial,
    min: 1000,
    impact: "low",
  },

  // ─── Guild Halls ───────────────────────────────────────────────────

  "guildHalls.enabled": {
    label: "Guild Halls Enabled",
    description: "Whether the guild hall system is active",
    section: TuningSection.WorldSocial,
    impact: "low",
  },
  "guildHalls.baseCost": {
    label: "Guild Hall Base Cost",
    description: "Gold cost to purchase a guild hall",
    section: TuningSection.WorldSocial,
    min: 0,
    impact: "medium",
  },

  // ─── Housing ───────────────────────────────────────────────────────

  "housing.enabled": {
    label: "Housing Enabled",
    description: "Whether the player housing system is active",
    section: TuningSection.WorldSocial,
    impact: "medium",
  },

  // ─── Factions ──────────────────────────────────────────────────────

  "factions.defaultReputation": {
    label: "Default Faction Reputation",
    description: "Starting reputation value for all factions",
    section: TuningSection.WorldSocial,
    impact: "medium",
  },
  "factions.killPenalty": {
    label: "Faction Kill Penalty",
    description: "Reputation lost when killing a faction member",
    section: TuningSection.WorldSocial,
    min: 0,
    impact: "medium",
  },
  "factions.killBonus": {
    label: "Faction Kill Bonus",
    description: "Reputation gained with enemy factions when killing a faction member",
    section: TuningSection.WorldSocial,
    min: 0,
    impact: "medium",
  },

  // ─── Leaderboard ───────────────────────────────────────────────────

  "leaderboard.refreshIntervalMs": {
    label: "Leaderboard Refresh Interval",
    description: "Milliseconds between leaderboard recalculations",
    section: TuningSection.WorldSocial,
    min: 1000,
    impact: "low",
  },
  "leaderboard.topN": {
    label: "Leaderboard Top N",
    description: "Number of top players shown on leaderboards",
    section: TuningSection.WorldSocial,
    min: 1,
    impact: "low",
  },
};

/** Look up metadata for a config dot-path. Returns undefined if the path is not in the catalog. */
export function getFieldMeta(path: string): FieldMeta | undefined {
  return FIELD_METADATA[path];
}

/** Get all field entries belonging to a specific tuning section. */
export function getFieldsBySection(section: TuningSection): Array<{ path: string; meta: FieldMeta }> {
  return Object.entries(FIELD_METADATA)
    .filter(([, meta]) => meta.section === section)
    .map(([path, meta]) => ({ path, meta }));
}
