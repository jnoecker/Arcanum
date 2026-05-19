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

  // ─── Mob Tiers: Weak ───────────────────────────────────────────────

  "mobTiers.weak.baseHp": {
    label: "Weak Mob Base HP",
    description: "Starting hit points for weak-tier mobs at level 0",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Combined with hpScalingRate to determine mob survivability curve",
  },
  "mobTiers.weak.hpScalingRate": {
    label: "Weak Mob HP Scaling Rate",
    description: "Per-level multiplicative growth rate. 1.1 means HP grows ~10% per level (~15x over 30 levels).",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.weak.damageScalingRate": {
    label: "Weak Mob Damage Scaling Rate",
    description: "Per-level multiplicative growth rate applied to both min and max damage.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.weak.xpScalingRate": {
    label: "Weak Mob XP Scaling Rate",
    description: "Per-level multiplicative growth rate applied to base kill XP.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.weak.goldScalingRate": {
    label: "Weak Mob Gold Scaling Rate",
    description: "Per-level multiplicative growth rate applied to both min and max gold drops.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
    impact: "medium",
  },

  // ─── Mob Tiers: Standard ───────────────────────────────────────────

  "mobTiers.standard.baseHp": {
    label: "Standard Mob Base HP",
    description: "Starting hit points for standard-tier mobs at level 0",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Combined with hpScalingRate to determine mob survivability curve",
  },
  "mobTiers.standard.hpScalingRate": {
    label: "Standard Mob HP Scaling Rate",
    description: "Per-level multiplicative growth rate. 1.1 means HP grows ~10% per level (~15x over 30 levels).",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.standard.damageScalingRate": {
    label: "Standard Mob Damage Scaling Rate",
    description: "Per-level multiplicative growth rate applied to both min and max damage.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.standard.xpScalingRate": {
    label: "Standard Mob XP Scaling Rate",
    description: "Per-level multiplicative growth rate applied to base kill XP.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.standard.goldScalingRate": {
    label: "Standard Mob Gold Scaling Rate",
    description: "Per-level multiplicative growth rate applied to both min and max gold drops.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.elite.hpScalingRate": {
    label: "Elite Mob HP Scaling Rate",
    description: "Per-level multiplicative growth rate. 1.1 means HP grows ~10% per level (~15x over 30 levels).",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.elite.damageScalingRate": {
    label: "Elite Mob Damage Scaling Rate",
    description: "Per-level multiplicative growth rate applied to both min and max damage.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.elite.xpScalingRate": {
    label: "Elite Mob XP Scaling Rate",
    description: "Per-level multiplicative growth rate applied to base kill XP.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.elite.goldScalingRate": {
    label: "Elite Mob Gold Scaling Rate",
    description: "Per-level multiplicative growth rate applied to both min and max gold drops.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.boss.hpScalingRate": {
    label: "Boss Mob HP Scaling Rate",
    description: "Per-level multiplicative growth rate. 1.1 means HP grows ~10% per level (~15x over 30 levels).",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.boss.damageScalingRate": {
    label: "Boss Mob Damage Scaling Rate",
    description: "Per-level multiplicative growth rate applied to both min and max damage.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.boss.xpScalingRate": {
    label: "Boss Mob XP Scaling Rate",
    description: "Per-level multiplicative growth rate applied to base kill XP.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
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
  "mobTiers.boss.goldScalingRate": {
    label: "Boss Mob Gold Scaling Rate",
    description: "Per-level multiplicative growth rate applied to both min and max gold drops.",
    section: TuningSection.CombatStats,
    min: 1.0,
    max: 2.0,
    impact: "medium",
  },

  // ─── Mob Action Delay ──────────────────────────────────────────────

  "mobActionDelay.minActionDelayMillis": {
    label: "Mob Min Action Delay",
    description:
      "Minimum milliseconds between mob behavior-tree evaluations (patrol, wander, aggro initiation). This is NOT combat attack speed -- swings are driven by combat.tickMillis. Server default: 8000ms.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "mobActionDelay.maxActionDelayMillis": {
    label: "Mob Max Action Delay",
    description:
      "Maximum milliseconds between mob behavior-tree evaluations (patrol, wander, aggro initiation). This is NOT combat attack speed -- swings are driven by combat.tickMillis. Server default: 20000ms.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },

  // ─── Stat Bindings (numeric fields only) ───────────────────────────

  "stats.bindings.meleeStatMultiplier": {
    label: "Melee Stat Multiplier",
    description:
      "Multiplicative bonus per stat point above the stat's baseStat. The bonus is added to attackPower BEFORE level scaling, so it compounds with level — keep modest (~0.25 default).",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote:
      "Larger values let stat allocation eclipse gear at high level. 0.25 keeps stat allocation relevant without dominating.",
  },
  "stats.bindings.meleeLevelScalingRate": {
    label: "Melee Level Scaling Rate",
    description:
      "Per-level multiplicative growth applied to (attackPower + statBonus). 1.30 = +30% per level, mirroring player HP scaling so damage:HP ratios stay stable across the curve.",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote:
      "Should track progression.rewards.hpScalingRate. Asymmetric rates produce runaway HP or runaway damage.",
  },
  "stats.bindings.meleeVarianceMin": {
    label: "Melee Variance Min",
    description: "Lower bound of the per-swing variance band (e.g. 0.85 = swings can hit 15% low).",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
    interactionNote: "Paired with max — tighter band = more predictable combat.",
  },
  "stats.bindings.meleeVarianceMax": {
    label: "Melee Variance Max",
    description: "Upper bound of the per-swing variance band (e.g. 1.15 = swings can hit 15% high).",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "medium",
    interactionNote: "Paired with min. Wide bands feel swingy; narrow bands feel rote.",
  },
  "stats.bindings.meleeBaseAttackPower": {
    label: "Melee Base Attack Power",
    description:
      "Floor attack power for the basic swing — keeps unarmed damage non-zero. Final attackPower is meleeBaseAttackPower + equipmentAttack.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
    interactionNote: "Sets the unarmed damage floor. Any weapon attack > 0 is strictly better than fists.",
  },
  "stats.bindings.meleeArmorMitigationK": {
    label: "Melee Armor Mitigation K",
    description:
      "Half-mitigation constant for multiplicative armor. mitigation = armor / (armor + K). At K=20, armor 5 ≈ 20% reduction, armor 20 ≈ 50%, armor 40 ≈ 66%. Self-scaling — armor stays meaningful at every level.",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote: "Larger K = armor matters less. Tune alongside item armor values.",
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
  "stats.bindings.spellStatMultiplier": {
    label: "Spell Stat Multiplier",
    description:
      "Multiplicative bonus per stat point above baseStat for spell damage. Mirror of meleeStatMultiplier — keep modest (~0.25) so caster stat allocation stays meaningful without dominating.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
    interactionNote:
      "Compounds with level via spellLevelScalingRate. Tune in lockstep with meleeStatMultiplier so casters and fighters scale on par.",
  },
  "stats.bindings.spellLevelScalingRate": {
    label: "Spell Level Scaling Rate",
    description:
      "Per-level multiplicative growth applied to (anchor + statBonus) for spells. Anchor is the ability's authored damage midpoint. Should track meleeLevelScalingRate and progression.rewards.hpScalingRate.",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
    interactionNote:
      "Spells bypass armor — same rate as melee makes physical and magical damage track each other across the curve.",
  },
  "stats.bindings.spellVarianceMin": {
    label: "Spell Variance Min",
    description: "Lower bound of the per-cast variance band.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "stats.bindings.spellVarianceMax": {
    label: "Spell Variance Max",
    description: "Upper bound of the per-cast variance band.",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "medium",
  },
  "stats.bindings.healStat": {
    label: "Heal Stat",
    description: "Stat that scales healing output. Defaults to WIS so healers don't compete with INT casters.",
    section: TuningSection.CombatStats,
    impact: "high",
  },
  "stats.bindings.healStatMultiplier": {
    label: "Heal Stat Multiplier",
    description: "Multiplicative bonus per stat point above baseStat for healing. Mirror of meleeStatMultiplier.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "high",
  },
  "stats.bindings.healLevelScalingRate": {
    label: "Heal Level Scaling Rate",
    description: "Per-level multiplicative growth applied to heal output. Should track meleeLevelScalingRate so healing keeps pace with incoming damage.",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "high",
  },
  "stats.bindings.healVarianceMin": {
    label: "Heal Variance Min",
    description: "Lower bound of the per-cast heal variance band.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "medium",
  },
  "stats.bindings.healVarianceMax": {
    label: "Heal Variance Max",
    description: "Upper bound of the per-cast heal variance band.",
    section: TuningSection.CombatStats,
    min: 1,
    impact: "medium",
  },
  "stats.bindings.buffStat": {
    label: "Buff Stat (reserved)",
    description: "Stat that will scale buff duration / magnitude for support classes (bard, herald). Reserved — the server does not yet apply this lane to ApplyStatus effects.",
    section: TuningSection.CombatStats,
    impact: "low",
  },
  "stats.bindings.buffDurationPerStat": {
    label: "Buff Duration / Stat (reserved)",
    description: "Reserved fractional bonus to buff duration per buffStat point above baseStat. Not yet wired into ApplyStatus.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "low",
  },
  "stats.bindings.buffMagnitudePerStat": {
    label: "Buff Magnitude / Stat (reserved)",
    description: "Reserved fractional bonus to buff magnitude per buffStat point above baseStat. Not yet wired into ApplyStatus.",
    section: TuningSection.CombatStats,
    min: 0,
    impact: "low",
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
    description:
      "Fractional XP multiplier per stat point above the base of 10. Formula: xpMultiplier = 1.0 + (stat - 10) * xpBonusPerPoint. 0.01 = 1% bonus per point; 0.10 = 10% per point. Server default: 0.005. Do not enter percentage integers.",
    section: TuningSection.CombatStats,
    min: 0,
    max: 0.1,
    impact: "medium",
    interactionNote:
      "Multiplicative XP scaling from the configured XP-bonus stat. Tiny changes compound with stat investment.",
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
  "gambling.diceMinBet": {
    label: "Dice Minimum Bet",
    description: "Minimum gold amount for a single dice gamble. Server field: diceMinBet.",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "low",
  },
  "gambling.diceMaxBet": {
    label: "Dice Maximum Bet",
    description: "Maximum gold amount for a single dice gamble. Server field: diceMaxBet.",
    section: TuningSection.EconomyCrafting,
    min: 1,
    impact: "medium",
  },
  "gambling.diceWinChance": {
    label: "Dice Win Chance",
    description:
      "Probability of winning a dice gamble (0-1). Server field: diceWinChance. Keep diceWinChance * diceWinMultiplier < 1 for a positive house edge.",
    section: TuningSection.EconomyCrafting,
    min: 0,
    max: 1,
    impact: "medium",
  },
  "gambling.diceWinMultiplier": {
    label: "Dice Win Multiplier",
    description:
      "Gross payout multiplier on a winning dice roll (2.0 means a 100g bet returns 200g). Server field: diceWinMultiplier.",
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
  "lottery.jackpotSeedGold": {
    label: "Lottery Jackpot Seed",
    description:
      "Gold the jackpot resets to after each drawing (seed value, not a floor). Server field: jackpotSeedGold.",
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
  "progression.rewards.hpScalingRate": {
    label: "HP Scaling Rate",
    description: "Per-level multiplicative growth rate for max HP. 1.1 means HP grows ~10% per level (~15x over 30 levels).",
    section: TuningSection.ProgressionQuests,
    min: 1.0,
    max: 2.0,
    impact: "high",
    interactionNote: "Combined with class hpScalingRate and stat scaling for total HP growth",
  },
  "progression.rewards.manaScalingRate": {
    label: "Mana Scaling Rate",
    description: "Per-level multiplicative growth rate for max mana.",
    section: TuningSection.ProgressionQuests,
    min: 1.0,
    max: 2.0,
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
    description: "Base gold cost for the first trainer unlock",
    section: TuningSection.ProgressionQuests,
    min: 0,
    impact: "medium",
  },
  "multiclass.maxClasses": {
    label: "Multiclass Max Classes",
    description: "Hard cap on total unlocked classes per player (includes the starter class)",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "medium",
  },
  "multiclass.goldCostMultiplier": {
    label: "Multiclass Gold Cost Multiplier",
    description: "Exponential scaling per additional unlock — Nth unlock costs goldCost × multiplier^(N-1). 1.0 = flat.",
    section: TuningSection.ProgressionQuests,
    min: 1,
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
  "characterCreation.demoEnabled": {
    label: "Demo Characters",
    description: "Allow players to join as a one-tap demo character with a random name. They can later claim the account by setting a password.",
    section: TuningSection.ProgressionQuests,
    impact: "low",
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
    description:
      "Milliseconds between allowed respecs. Note: the server does not persist this cooldown across sessions -- players can reset the timer by disconnecting. Treat as a soft deterrent only.",
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
  "regen.regenPercent": {
    label: "HP Regen Percent",
    description:
      "Fraction of max HP restored per regen tick (0.05 = 5%). Scales automatically with player level, so the same percent feels right across the curve. In-combat regen is further multiplied by regen.inCombatMultiplier.",
    section: TuningSection.WorldSocial,
    min: 0.0001,
    max: 1,
    impact: "high",
  },
  "regen.inCombatMultiplier": {
    label: "In-Combat Regen Multiplier",
    description:
      "Multiplier applied to regen while in combat. 1.0 keeps the full out-of-combat rate; 0.5 halves it; 0.0 disables regen entirely during fights. Lower values let mob DPS apply real pressure.",
    section: TuningSection.WorldSocial,
    min: 0,
    max: 1,
    impact: "high",
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
  "regen.mana.regenPercent": {
    label: "Mana Regen Percent",
    description: "Fraction of max mana restored per regen tick (0.05 = 5%). Scales with the player's mana pool.",
    section: TuningSection.WorldSocial,
    min: 0.0001,
    max: 1,
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
    description:
      "Fractional XP multiplier per additional group member beyond the first. Formula: groupMultiplier = 1.0 + (memberCount - 1) * xpBonusPerMember. 0.10 = 10% bonus per extra member. Server default: 0.10. Do not enter percentage integers.",
    section: TuningSection.WorldSocial,
    min: 0,
    max: 1,
    impact: "medium",
    interactionNote:
      "Incentivizes grouping -- higher values make solo play relatively less efficient. Keep below 1.0.",
  },

  // ─── Navigation ────────────────────────────────────────────────────

  "navigation.recall.cooldownMs": {
    label: "Recall Cooldown",
    description: "Milliseconds between allowed recall/teleport uses",
    section: TuningSection.WorldSocial,
    min: 0,
    impact: "low",
  },

  // ─── Death / Sanctum ────────────────────────────────────────────────

  "death.respawnHpFraction": {
    label: "Respawn HP",
    description: "Fraction of max HP restored when waking in the sanctum after death (0.05 - 1.0)",
    section: TuningSection.WorldSocial,
    min: 0.05,
    max: 1.0,
    impact: "medium",
    interactionNote:
      "Lower values make death more punishing -- players must rest in the sanctum before heading out again.",
  },
  "death.respawnManaFraction": {
    label: "Respawn Mana",
    description: "Fraction of max mana restored when waking in the sanctum after death (0 - 1.0)",
    section: TuningSection.WorldSocial,
    min: 0,
    max: 1.0,
    impact: "low",
  },
  "death.xpPenaltyFraction": {
    label: "Death XP Penalty",
    description: "Fraction of total XP deducted on death (0 - 0.5). 0 = forgiving, 0.1 = lose 10% of total XP per death",
    section: TuningSection.WorldSocial,
    min: 0,
    max: 0.5,
    impact: "high",
    interactionNote:
      "A penalty above 0 turns each death into real progression loss. Pair with cautious mob tuning so dying isn't routine.",
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
  "guildHalls.purchaseCost": {
    label: "Guild Hall Purchase Cost",
    description: "Gold cost to purchase a guild hall. Server field: purchaseCost.",
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
    description:
      "Base reputation lost when killing a faction member. Actual per-kill loss scales with mob level: killPenalty * (1 + mobLevel / 10).",
    section: TuningSection.WorldSocial,
    min: 0,
    impact: "high",
  },
  "factions.killBonus": {
    label: "Faction Kill Bonus",
    description:
      "Base reputation gained with enemy factions when killing a faction member. Actual per-kill gain scales with mob level: killBonus * (1 + mobLevel / 10).",
    section: TuningSection.WorldSocial,
    min: 0,
    impact: "high",
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
