// ─── Tuning Presets ─────────────────────────────────────────────────
//
// Three themed presets (Casual, Balanced, Hardcore) as DeepPartial<AppConfig>
// overlays covering all 139 tunable fields from FIELD_METADATA.
//
// Each preset is a standalone overlay -- not derived from Kotlin defaults.
// Use with applyTemplate() from lib/templates.ts to merge onto a config.

import type { AppConfig } from "@/types/config";
import type { DeepPartial } from "./types";
import { TuningSection } from "./types";

/** A themed tuning preset with metadata and config overlay. */
export interface TuningPreset {
  id: string;
  name: string;
  description: string;
  sectionDescriptions: Partial<Record<TuningSection, string>>;
  config: DeepPartial<AppConfig>;
}

// ─── Casual Preset ───────────────────────────────────────────────────

export const CASUAL_PRESET: TuningPreset = {
  id: "casual",
  name: "Casual Adventure",
  description:
    "A relaxed experience with faster progression, gentler combat, and generous rewards. Ideal for story-focused or solo play.",
  sectionDescriptions: {
    [TuningSection.CombatStats]:
      "Forgiving combat with lower mob damage and faster kill times. Stats scale generously so builds feel impactful early.",
    [TuningSection.EconomyCrafting]:
      "Generous gold flow with favorable shop prices. Crafting levels quickly and gambling is fun without being punishing.",
    [TuningSection.ProgressionQuests]:
      "Fast leveling with a gentle XP curve. Quests and bounties reward generously, and prestige is accessible for extended play.",
    [TuningSection.WorldSocial]:
      "Quick regen to minimize downtime. Social systems are wide open with large friend lists and active guild halls.",
  },
  config: {
    // ─── Combat ──────────────────────────────────────────────────────
    combat: {
      tickMillis: 3500,
    },

    // ─── Mob Tiers ───────────────────────────────────────────────────
    // Same 1.5x HP / 1.35-1.5x damage / 1.45-1.5x XP+gold scaling shape as
    // Balanced, but with smaller base values so early-game friction is
    // gentler. Gold base is the highest of the three difficulty presets.
    mobTiers: {
      weak: {
        baseHp: 12,
        hpScalingRate: 1.5,
        baseMinDamage: 6,
        baseMaxDamage: 9,
        damageScalingRate: 1.35,
        baseArmor: 0,
        baseXpReward: 80,
        xpScalingRate: 1.45,
        baseGoldMin: 6,
        baseGoldMax: 12,
        goldScalingRate: 1.45,
      },
      standard: {
        baseHp: 24,
        hpScalingRate: 1.5,
        baseMinDamage: 9,
        baseMaxDamage: 12,
        damageScalingRate: 1.4,
        baseArmor: 0,
        baseXpReward: 160,
        xpScalingRate: 1.5,
        baseGoldMin: 12,
        baseGoldMax: 30,
        goldScalingRate: 1.5,
      },
      elite: {
        baseHp: 48,
        hpScalingRate: 1.5,
        baseMinDamage: 12,
        baseMaxDamage: 15,
        damageScalingRate: 1.45,
        baseArmor: 1,
        baseXpReward: 240,
        xpScalingRate: 1.5,
        baseGoldMin: 30,
        baseGoldMax: 75,
        goldScalingRate: 1.5,
      },
      boss: {
        baseHp: 120,
        hpScalingRate: 1.5,
        baseMinDamage: 12,
        baseMaxDamage: 24,
        damageScalingRate: 1.5,
        baseArmor: 3,
        baseXpReward: 320,
        xpScalingRate: 1.52,
        baseGoldMin: 120,
        baseGoldMax: 260,
        goldScalingRate: 1.52,
      },
    },

    // ─── Mob Action Delay ────────────────────────────────────────────
    mobActionDelay: {
      minActionDelayMillis: 5000,
      maxActionDelayMillis: 10000,
    },

    // ─── Stat Bindings ───────────────────────────────────────────────
    stats: {
      bindings: {
        meleeStatMultiplier: 0.25,
        meleeLevelScalingRate: 1.30,
        meleeVarianceMin: 0.85,
        meleeVarianceMax: 1.15,
        meleeBaseAttackPower: 10,
        meleeArmorMitigationK: 22,
        dodgePerPoint: 3,
        maxDodgePercent: 35,
        spellStatMultiplier: 0.25,
        spellLevelScalingRate: 1.30,
        spellVarianceMin: 0.85,
        spellVarianceMax: 1.15,
        healStat: "WIS",
        healStatMultiplier: 0.25,
        healLevelScalingRate: 1.30,
        healVarianceMin: 0.85,
        healVarianceMax: 1.15,
        buffStat: "CHA",
        buffDurationPerStat: 0.025,
        buffMagnitudePerStat: 0.025,
        hpScalingDivisor: 4,
        manaScalingDivisor: 4,
        hpRegenMsPerPoint: 250,
        manaRegenMsPerPoint: 250,
        xpBonusPerPoint: 0.02,
      },
    },

    // ─── Economy ─────────────────────────────────────────────────────
    economy: {
      buyMultiplier: 0.8,
      sellMultiplier: 0.6,
    },

    // ─── Crafting ────────────────────────────────────────────────────
    crafting: {
      maxSkillLevel: 50,
      baseXpPerLevel: 80,
      xpExponent: 1.3,
      gatherCooldownMs: 2000,
      stationBonusQuantity: 2,
    },

    // ─── Gambling ────────────────────────────────────────────────────
    gambling: {
      enabled: true,
      diceMinBet: 5,
      diceMaxBet: 500,
      diceWinChance: 0.45,
      diceWinMultiplier: 2.0,
    },

    // ─── Lottery ─────────────────────────────────────────────────────
    lottery: {
      enabled: true,
      ticketCost: 10,
      drawingIntervalMs: 1800000,
      jackpotSeedGold: 1000,
    },

    // ─── Stylist ─────────────────────────────────────────────────────
    stylist: {
      feeGold: 250,
    },

    // ─── Bank ────────────────────────────────────────────────────────
    bank: {
      maxItems: 100,
    },

    // ─── Enchanting ──────────────────────────────────────────────────
    enchanting: {
      maxEnchantmentsPerItem: 4,
    },

    // ─── Progression ─────────────────────────────────────────────────
    progression: {
      maxLevel: 30,
      xp: {
        baseXp: 500,
        exponent: 1.5,
        linearXp: 60,
        multiplier: 1.0,
        defaultKillXp: 120,
        diminishing: {
          enabled: true,
          thresholds: [
            { levelsBelow: 1, multiplier: 0.9 },
            { levelsBelow: 3, multiplier: 0.7 },
            { levelsBelow: 5, multiplier: 0.4 },
            { levelsBelow: 10, multiplier: 0.1 },
          ],
        },
      },
      rewards: {
        hpScalingRate: 1.3,
        manaScalingRate: 1.3,
        fullHealOnLevelUp: true,
        fullManaOnLevelUp: true,
        baseHp: 160,
        baseMana: 140,
      },
      quests: {
        baseline: { baseXp: 200, xpPerLevel: 80 },
        tiers: { trivial: 0.3, easy: 0.6, standard: 1.0, hard: 1.4, epic: 2.0 },
      },
    },

    // ─── Skill Points ────────────────────────────────────────────────
    skillPoints: {
      interval: 1,
    },

    // ─── Multiclass ──────────────────────────────────────────────────
    multiclass: {
      minLevel: 10,
      goldCost: 200,
      maxClasses: 4,
      goldCostMultiplier: 1.5,
    },

    // ─── Character Creation ──────────────────────────────────────────
    characterCreation: {
      startingGold: 200,
    },

    // ─── Prestige ────────────────────────────────────────────────────
    prestige: {
      enabled: true,
      xpCostBase: 5000,
      xpCostMultiplier: 1.3,
      maxRank: 10,
    },

    // ─── Respec ──────────────────────────────────────────────────────
    respec: {
      goldCost: 50,
      cooldownMs: 60000,
    },

    // ─── Auto Quests ─────────────────────────────────────────────────
    autoQuests: {
      enabled: true,
      timeLimitMs: 600000,
      cooldownMs: 120000,
    },

    // ─── Daily Quests ────────────────────────────────────────────────
    dailyQuests: {
      enabled: true,
      streakBonusPercent: 15,
    },

    // ─── Global Quests ───────────────────────────────────────────────
    globalQuests: {
      enabled: true,
      intervalMs: 3600000,
      durationMs: 1800000,
    },

    // ─── Regen ───────────────────────────────────────────────────────
    // 25%/3000ms = full pool in ~12s out of combat, 15% during fights.
    // Casual is the most forgiving difficulty: in-combat regen actually
    // helps you survive mistakes rather than just smoothing downtime.
    regen: {
      maxPlayersPerTick: 15,
      baseIntervalMillis: 3000,
      minIntervalMillis: 800,
      regenPercent: 0.25,
      inCombatMultiplier: 0.6,
      mana: {
        baseIntervalMillis: 3000,
        minIntervalMillis: 800,
        regenPercent: 0.25,
      },
    },

    // ─── World Time ──────────────────────────────────────────────────
    worldTime: {
      cycleLengthMs: 1200000,
      dawnHour: 5,
      dayHour: 7,
      duskHour: 18,
      nightHour: 20,
    },

    // ─── Weather ─────────────────────────────────────────────────────
    weather: {
      minTransitionMs: 120000,
      maxTransitionMs: 300000,
    },

    // ─── Group ───────────────────────────────────────────────────────
    group: {
      maxSize: 6,
      inviteTimeoutMs: 60000,
      xpBonusPerMember: 0.15,
    },

    // ─── Navigation ──────────────────────────────────────────────────
    navigation: {
      recall: {
        cooldownMs: 30000,
      },
    },

    // ─── Death ───────────────────────────────────────────────────────
    death: {
      respawnHpFraction: 0.5,
      respawnManaFraction: 0.5,
      xpPenaltyFraction: 0.0,
    },

    // ─── Friends ─────────────────────────────────────────────────────
    friends: {
      maxFriends: 100,
    },

    // ─── Guild ───────────────────────────────────────────────────────
    guild: {
      maxSize: 50,
      inviteTimeoutMs: 60000,
    },

    // ─── Guild Halls ─────────────────────────────────────────────────
    guildHalls: {
      enabled: true,
      purchaseCost: 5000,
    },

    // ─── Housing ─────────────────────────────────────────────────────
    housing: {
      enabled: true,
    },

    // ─── Factions ────────────────────────────────────────────────────
    factions: {
      defaultReputation: 0,
      killPenalty: 5,
      killBonus: 3,
    },

    // ─── Leaderboard ─────────────────────────────────────────────────
    leaderboard: {
      refreshIntervalMs: 60000,
      topN: 20,
    },
  },
};

// ─── Balanced Preset ─────────────────────────────────────────────────

export const BALANCED_PRESET: TuningPreset = {
  id: "balanced",
  name: "Balanced Realm",
  description:
    "The Spawningold playtest tuning: mobs scale faster than players (1.5x vs 1.3x) so encounters stay tense across the level band, paired with generous out-of-combat regen and full heal on level up. Solid default for most builders.",
  sectionDescriptions: {
    [TuningSection.CombatStats]:
      "Measured combat where mobs out-scale players at higher levels; gear and abilities pick up the slack. 2s combat ticks keep fights snappy and the 1.5x mob HP curve makes elites and bosses meaningful threats deep into the run.",
    [TuningSection.EconomyCrafting]:
      "A healthy buy/sell spread that makes gold meaningful. Crafting has a satisfying progression curve and gambling is a modest side activity.",
    [TuningSection.ProgressionQuests]:
      "Steady leveling with aggressive diminishing-return penalties for killing lower-level mobs, so players advance through zones rather than farming the starter area. Daily/global/auto quests are off by default to keep the core loop tight.",
    [TuningSection.WorldSocial]:
      "Percent-based regen (15% per tick) heals fully in ~27s out of combat, dropping to 33% during fights so encounters apply real pressure. Group play is incentivized and guild systems are fully featured.",
  },
  config: {
    // ─── Combat ──────────────────────────────────────────────────────
    // Calibrated against the Spawningold playtest: 2s ticks pair with the
    // 1.3x player + 1.5x mob scaling so combat tightens up the higher you
    // climb. Tier baselines are deliberately small — mobs out-scale players,
    // but diminishing XP and full-heal-on-level-up keep the curve fair.
    combat: {
      tickMillis: 2000,
    },

    // ─── Mob Tiers ───────────────────────────────────────────────────
    mobTiers: {
      weak: {
        baseHp: 20,
        hpScalingRate: 1.5,
        baseMinDamage: 10,
        baseMaxDamage: 15,
        damageScalingRate: 1.35,
        baseArmor: 0,
        baseXpReward: 50,
        xpScalingRate: 1.45,
        baseGoldMin: 2,
        baseGoldMax: 6,
        goldScalingRate: 1.45,
      },
      standard: {
        baseHp: 40,
        hpScalingRate: 1.5,
        baseMinDamage: 15,
        baseMaxDamage: 20,
        damageScalingRate: 1.4,
        baseArmor: 1,
        baseXpReward: 100,
        xpScalingRate: 1.5,
        baseGoldMin: 5,
        baseGoldMax: 14,
        goldScalingRate: 1.5,
      },
      elite: {
        baseHp: 80,
        hpScalingRate: 1.5,
        baseMinDamage: 20,
        baseMaxDamage: 25,
        damageScalingRate: 1.45,
        baseArmor: 2,
        baseXpReward: 150,
        xpScalingRate: 1.5,
        baseGoldMin: 18,
        baseGoldMax: 45,
        goldScalingRate: 1.5,
      },
      boss: {
        baseHp: 200,
        hpScalingRate: 1.5,
        baseMinDamage: 20,
        baseMaxDamage: 40,
        damageScalingRate: 1.5,
        baseArmor: 4,
        baseXpReward: 200,
        xpScalingRate: 1.52,
        baseGoldMin: 70,
        baseGoldMax: 150,
        goldScalingRate: 1.52,
      },
    },

    // ─── Mob Action Delay ────────────────────────────────────────────
    mobActionDelay: {
      minActionDelayMillis: 4000,
      maxActionDelayMillis: 8000,
    },

    // ─── Stat Bindings ───────────────────────────────────────────────
    stats: {
      bindings: {
        meleeStatMultiplier: 0.25,
        meleeLevelScalingRate: 1.30,
        meleeVarianceMin: 0.85,
        meleeVarianceMax: 1.15,
        meleeBaseAttackPower: 10,
        meleeArmorMitigationK: 20,
        dodgePerPoint: 2,
        maxDodgePercent: 30,
        spellStatMultiplier: 0.25,
        spellLevelScalingRate: 1.30,
        spellVarianceMin: 0.85,
        spellVarianceMax: 1.15,
        healStat: "WIS",
        healStatMultiplier: 0.25,
        healLevelScalingRate: 1.30,
        healVarianceMin: 0.85,
        healVarianceMax: 1.15,
        buffStat: "CHA",
        buffDurationPerStat: 0.02,
        buffMagnitudePerStat: 0.02,
        hpScalingDivisor: 5,
        manaScalingDivisor: 5,
        hpRegenMsPerPoint: 200,
        manaRegenMsPerPoint: 200,
        xpBonusPerPoint: 0.01,
      },
    },

    // ─── Economy ─────────────────────────────────────────────────────
    economy: {
      buyMultiplier: 1.0,
      sellMultiplier: 0.5,
    },

    // ─── Crafting ────────────────────────────────────────────────────
    crafting: {
      maxSkillLevel: 75,
      baseXpPerLevel: 100,
      xpExponent: 1.5,
      gatherCooldownMs: 3000,
      stationBonusQuantity: 1,
    },

    // ─── Gambling ────────────────────────────────────────────────────
    gambling: {
      enabled: true,
      diceMinBet: 10,
      diceMaxBet: 1000,
      diceWinChance: 0.45,
      diceWinMultiplier: 2.0,
    },

    // ─── Lottery ─────────────────────────────────────────────────────
    lottery: {
      enabled: true,
      ticketCost: 25,
      drawingIntervalMs: 3600000,
      jackpotSeedGold: 500,
    },

    // ─── Stylist ─────────────────────────────────────────────────────
    stylist: {
      feeGold: 500,
    },

    // ─── Bank ────────────────────────────────────────────────────────
    bank: {
      maxItems: 50,
    },

    // ─── Enchanting ──────────────────────────────────────────────────
    enchanting: {
      maxEnchantmentsPerItem: 3,
    },

    // ─── Progression ─────────────────────────────────────────────────
    progression: {
      maxLevel: 30,
      xp: {
        baseXp: 800,
        exponent: 1.5,
        linearXp: 100,
        multiplier: 1.0,
        defaultKillXp: 100,
        diminishing: {
          enabled: true,
          thresholds: [
            { levelsBelow: 1, multiplier: 0.8 },
            { levelsBelow: 2, multiplier: 0.6 },
            { levelsBelow: 3, multiplier: 0.5 },
            { levelsBelow: 5, multiplier: 0.25 },
            { levelsBelow: 10, multiplier: 0.05 },
          ],
        },
      },
      rewards: {
        hpScalingRate: 1.3,
        manaScalingRate: 1.3,
        fullHealOnLevelUp: true,
        fullManaOnLevelUp: true,
        baseHp: 130,
        baseMana: 120,
      },
      quests: {
        baseline: { baseXp: 400, xpPerLevel: 160 },
        tiers: { trivial: 0.25, easy: 0.5, standard: 1.0, hard: 1.75, epic: 3.0 },
      },
    },

    // ─── Skill Points ────────────────────────────────────────────────
    skillPoints: {
      interval: 1,
    },

    // ─── Multiclass ──────────────────────────────────────────────────
    multiclass: {
      minLevel: 30,
      goldCost: 50000,
      maxClasses: 2,
      goldCostMultiplier: 2.0,
    },

    // ─── Character Creation ──────────────────────────────────────────
    characterCreation: {
      startingGold: 100,
    },

    // ─── Prestige ────────────────────────────────────────────────────
    prestige: {
      enabled: false,
      xpCostBase: 10000,
      xpCostMultiplier: 1.5,
      maxRank: 5,
    },

    // ─── Respec ──────────────────────────────────────────────────────
    respec: {
      goldCost: 1500,
      cooldownMs: 300000,
    },

    // ─── Auto Quests ─────────────────────────────────────────────────
    autoQuests: {
      enabled: false,
      timeLimitMs: 300000,
      cooldownMs: 300000,
    },

    // ─── Daily Quests ────────────────────────────────────────────────
    dailyQuests: {
      enabled: false,
      streakBonusPercent: 10,
    },

    // ─── Global Quests ───────────────────────────────────────────────
    globalQuests: {
      enabled: false,
      intervalMs: 7200000,
      durationMs: 3600000,
    },

    // ─── Regen ───────────────────────────────────────────────────────
    // 15%/4000ms = full pool in ~27s out of combat, 1/3 of that during
    // fights. Generous healing between encounters compensates for the
    // 1.5x mob HP scaling without trivializing actual combat.
    regen: {
      maxPlayersPerTick: 10,
      baseIntervalMillis: 4000,
      minIntervalMillis: 1000,
      regenPercent: 0.15,
      inCombatMultiplier: 0.33,
      mana: {
        baseIntervalMillis: 4000,
        minIntervalMillis: 1000,
        regenPercent: 0.15,
      },
    },

    // ─── World Time ──────────────────────────────────────────────────
    worldTime: {
      cycleLengthMs: 1800000,
      dawnHour: 5,
      dayHour: 7,
      duskHour: 18,
      nightHour: 20,
    },

    // ─── Weather ─────────────────────────────────────────────────────
    weather: {
      minTransitionMs: 180000,
      maxTransitionMs: 600000,
    },

    // ─── Group ───────────────────────────────────────────────────────
    group: {
      maxSize: 5,
      inviteTimeoutMs: 60000,
      xpBonusPerMember: 0.10,
    },

    // ─── Navigation ──────────────────────────────────────────────────
    navigation: {
      recall: {
        cooldownMs: 60000,
      },
    },

    // ─── Death ───────────────────────────────────────────────────────
    death: {
      respawnHpFraction: 0.2,
      respawnManaFraction: 0.2,
      xpPenaltyFraction: 0.0,
    },

    // ─── Friends ─────────────────────────────────────────────────────
    friends: {
      maxFriends: 50,
    },

    // ─── Guild ───────────────────────────────────────────────────────
    guild: {
      maxSize: 30,
      inviteTimeoutMs: 60000,
    },

    // ─── Guild Halls ─────────────────────────────────────────────────
    guildHalls: {
      enabled: true,
      purchaseCost: 10000,
    },

    // ─── Housing ─────────────────────────────────────────────────────
    housing: {
      enabled: true,
    },

    // ─── Factions ────────────────────────────────────────────────────
    factions: {
      defaultReputation: 0,
      killPenalty: 10,
      killBonus: 5,
    },

    // ─── Leaderboard ─────────────────────────────────────────────────
    leaderboard: {
      refreshIntervalMs: 120000,
      topN: 10,
    },
  },
};

// ─── Hardcore Preset ─────────────────────────────────────────────────

export const HARDCORE_PRESET: TuningPreset = {
  id: "hardcore",
  name: "Hardcore Challenge",
  description:
    "A punishing world where every level is earned, resources are scarce, and combat demands preparation. For experienced MUD players.",
  sectionDescriptions: {
    [TuningSection.CombatStats]:
      "Dangerous combat where mobs hit hard and scale aggressively. Stat investments must be deliberate, and even weak mobs can threaten careless players.",
    [TuningSection.EconomyCrafting]:
      "A tight economy where gold is scarce and prices are steep. Crafting requires real investment, and gambling is high-risk with modest payouts.",
    [TuningSection.ProgressionQuests]:
      "A steep XP curve that makes every level an achievement. Quests are time-pressured and prestige demands serious endgame commitment.",
    [TuningSection.WorldSocial]:
      "Slow regen that forces resource management and healer dependency. Social systems are available but guild halls and housing come at a premium.",
  },
  config: {
    // ─── Combat ──────────────────────────────────────────────────────
    combat: {
      tickMillis: 2000,
    },

    // ─── Mob Tiers ───────────────────────────────────────────────────
    // Same scaling shape as Balanced (1.5x HP, 1.35-1.5x damage), but
    // base HP and damage land 50% higher and gold is sharply lower.
    // Standard-tier mobs are real threats from the start.
    mobTiers: {
      weak: {
        baseHp: 30,
        hpScalingRate: 1.5,
        baseMinDamage: 15,
        baseMaxDamage: 22,
        damageScalingRate: 1.35,
        baseArmor: 0,
        baseXpReward: 30,
        xpScalingRate: 1.45,
        baseGoldMin: 1,
        baseGoldMax: 3,
        goldScalingRate: 1.45,
      },
      standard: {
        baseHp: 60,
        hpScalingRate: 1.5,
        baseMinDamage: 22,
        baseMaxDamage: 30,
        damageScalingRate: 1.4,
        baseArmor: 2,
        baseXpReward: 60,
        xpScalingRate: 1.5,
        baseGoldMin: 2,
        baseGoldMax: 5,
        goldScalingRate: 1.5,
      },
      elite: {
        baseHp: 120,
        hpScalingRate: 1.5,
        baseMinDamage: 30,
        baseMaxDamage: 38,
        damageScalingRate: 1.45,
        baseArmor: 4,
        baseXpReward: 90,
        xpScalingRate: 1.5,
        baseGoldMin: 6,
        baseGoldMax: 15,
        goldScalingRate: 1.5,
      },
      boss: {
        baseHp: 300,
        hpScalingRate: 1.5,
        baseMinDamage: 30,
        baseMaxDamage: 60,
        damageScalingRate: 1.5,
        baseArmor: 5,
        baseXpReward: 120,
        xpScalingRate: 1.52,
        baseGoldMin: 24,
        baseGoldMax: 50,
        goldScalingRate: 1.52,
      },
    },

    // ─── Mob Action Delay ────────────────────────────────────────────
    mobActionDelay: {
      minActionDelayMillis: 2500,
      maxActionDelayMillis: 5000,
    },

    // ─── Stat Bindings ───────────────────────────────────────────────
    stats: {
      bindings: {
        meleeStatMultiplier: 0.25,
        meleeLevelScalingRate: 1.30,
        meleeVarianceMin: 0.80,
        meleeVarianceMax: 1.20,
        meleeBaseAttackPower: 10,
        meleeArmorMitigationK: 18,
        dodgePerPoint: 1,
        maxDodgePercent: 20,
        spellStatMultiplier: 0.25,
        spellLevelScalingRate: 1.30,
        spellVarianceMin: 0.80,
        spellVarianceMax: 1.20,
        healStat: "WIS",
        healStatMultiplier: 0.25,
        healLevelScalingRate: 1.30,
        healVarianceMin: 0.80,
        healVarianceMax: 1.20,
        buffStat: "CHA",
        buffDurationPerStat: 0.015,
        buffMagnitudePerStat: 0.015,
        hpScalingDivisor: 6,
        manaScalingDivisor: 6,
        hpRegenMsPerPoint: 150,
        manaRegenMsPerPoint: 150,
        xpBonusPerPoint: 0.01,
      },
    },

    // ─── Economy ─────────────────────────────────────────────────────
    economy: {
      buyMultiplier: 1.3,
      sellMultiplier: 0.35,
    },

    // ─── Crafting ────────────────────────────────────────────────────
    crafting: {
      maxSkillLevel: 100,
      baseXpPerLevel: 150,
      xpExponent: 1.8,
      gatherCooldownMs: 5000,
      stationBonusQuantity: 1,
    },

    // ─── Gambling ────────────────────────────────────────────────────
    gambling: {
      enabled: true,
      diceMinBet: 25,
      diceMaxBet: 2000,
      diceWinChance: 0.35,
      diceWinMultiplier: 2.5,
    },

    // ─── Lottery ─────────────────────────────────────────────────────
    lottery: {
      enabled: true,
      ticketCost: 50,
      drawingIntervalMs: 7200000,
      jackpotSeedGold: 200,
    },

    // ─── Stylist ─────────────────────────────────────────────────────
    stylist: {
      feeGold: 1000,
    },

    // ─── Bank ────────────────────────────────────────────────────────
    bank: {
      maxItems: 30,
    },

    // ─── Enchanting ──────────────────────────────────────────────────
    enchanting: {
      maxEnchantmentsPerItem: 2,
    },

    // ─── Progression ─────────────────────────────────────────────────
    progression: {
      maxLevel: 30,
      xp: {
        baseXp: 1500,
        exponent: 1.55,
        linearXp: 150,
        multiplier: 1.0,
        defaultKillXp: 80,
        diminishing: {
          enabled: true,
          thresholds: [
            { levelsBelow: 1, multiplier: 0.6 },
            { levelsBelow: 2, multiplier: 0.4 },
            { levelsBelow: 3, multiplier: 0.25 },
            { levelsBelow: 5, multiplier: 0.1 },
            { levelsBelow: 10, multiplier: 0.0 },
          ],
        },
      },
      rewards: {
        hpScalingRate: 1.3,
        manaScalingRate: 1.3,
        fullHealOnLevelUp: false,
        fullManaOnLevelUp: false,
        baseHp: 110,
        baseMana: 100,
      },
      quests: {
        baseline: { baseXp: 500, xpPerLevel: 200 },
        tiers: { trivial: 0.2, easy: 0.4, standard: 1.0, hard: 2.0, epic: 3.5 },
      },
    },

    // ─── Skill Points ────────────────────────────────────────────────
    skillPoints: {
      interval: 3,
    },

    // ─── Multiclass ──────────────────────────────────────────────────
    multiclass: {
      minLevel: 25,
      goldCost: 2000,
      maxClasses: 2,
      goldCostMultiplier: 3.0,
    },

    // ─── Character Creation ──────────────────────────────────────────
    characterCreation: {
      startingGold: 25,
    },

    // ─── Prestige ────────────────────────────────────────────────────
    prestige: {
      enabled: true,
      xpCostBase: 25000,
      xpCostMultiplier: 1.35,
      maxRank: 10,
    },

    // ─── Respec ──────────────────────────────────────────────────────
    respec: {
      goldCost: 500,
      cooldownMs: 3600000,
    },

    // ─── Auto Quests ─────────────────────────────────────────────────
    autoQuests: {
      enabled: true,
      timeLimitMs: 180000,
      cooldownMs: 600000,
    },

    // ─── Daily Quests ────────────────────────────────────────────────
    dailyQuests: {
      enabled: true,
      streakBonusPercent: 5,
    },

    // ─── Global Quests ───────────────────────────────────────────────
    globalQuests: {
      enabled: true,
      intervalMs: 14400000,
      durationMs: 7200000,
    },

    // ─── Regen ───────────────────────────────────────────────────────
    // 8%/5500ms = full pool in ~69s out of combat, zero in-combat. Every
    // fight leaves a mark and standard-tier mobs are unambiguous threats.
    // Hardcore by design.
    regen: {
      maxPlayersPerTick: 8,
      baseIntervalMillis: 5500,
      minIntervalMillis: 2800,
      regenPercent: 0.08,
      inCombatMultiplier: 0,
      mana: {
        baseIntervalMillis: 5500,
        minIntervalMillis: 2800,
        regenPercent: 0.08,
      },
    },

    // ─── World Time ──────────────────────────────────────────────────
    worldTime: {
      cycleLengthMs: 2400000,
      dawnHour: 5,
      dayHour: 7,
      duskHour: 18,
      nightHour: 20,
    },

    // ─── Weather ─────────────────────────────────────────────────────
    weather: {
      minTransitionMs: 300000,
      maxTransitionMs: 900000,
    },

    // ─── Group ───────────────────────────────────────────────────────
    group: {
      maxSize: 4,
      inviteTimeoutMs: 30000,
      xpBonusPerMember: 0.05,
    },

    // ─── Navigation ──────────────────────────────────────────────────
    navigation: {
      recall: {
        cooldownMs: 300000,
      },
    },

    // ─── Death ───────────────────────────────────────────────────────
    death: {
      respawnHpFraction: 0.1,
      respawnManaFraction: 0.0,
      xpPenaltyFraction: 0.1,
    },

    // ─── Friends ─────────────────────────────────────────────────────
    friends: {
      maxFriends: 25,
    },

    // ─── Guild ───────────────────────────────────────────────────────
    guild: {
      maxSize: 20,
      inviteTimeoutMs: 30000,
    },

    // ─── Guild Halls ─────────────────────────────────────────────────
    guildHalls: {
      enabled: true,
      purchaseCost: 25000,
    },

    // ─── Housing ─────────────────────────────────────────────────────
    housing: {
      enabled: true,
    },

    // ─── Factions ────────────────────────────────────────────────────
    factions: {
      defaultReputation: 0,
      killPenalty: 20,
      killBonus: 8,
    },

    // ─── Leaderboard ─────────────────────────────────────────────────
    leaderboard: {
      refreshIntervalMs: 300000,
      topN: 10,
    },
  },
};

// ─── Solo Story Preset ─────────��────────────────────────────────────

export const SOLO_STORY_PRESET: TuningPreset = {
  id: "soloStory",
  name: "Solo Story",
  description:
    "A narrative-first experience designed for solo exploration. Generous progression, forgiving combat, and ample resources so the story is never interrupted.",
  sectionDescriptions: {
    [TuningSection.CombatStats]:
      "Very forgiving combat tuned for solo play. Mobs are manageable alone, stat scaling is generous, and regen is fast enough to keep moving.",
    [TuningSection.EconomyCrafting]:
      "Abundant gold and cheap prices so gear and crafting never block progress. Crafting levels quickly for casual experimentation.",
    [TuningSection.ProgressionQuests]:
      "Fast leveling that keeps the story moving without flattening the whole arc. Progress still advances quickly, but players have room to grow before they cap out.",
    [TuningSection.WorldSocial]:
      "Fast regen and short cooldowns minimize downtime. Social systems are available but not required — designed for solo-friendly play.",
  },
  config: {
    combat: { tickMillis: 4000 },
    mobTiers: {
      weak: { baseHp: 18, hpScalingRate: 1.095, baseMinDamage: 1, baseMaxDamage: 1, damageScalingRate: 1.0, baseArmor: 0, baseXpReward: 80, xpScalingRate: 1.087, baseGoldMin: 8, baseGoldMax: 20, goldScalingRate: 1.190 },
      standard: { baseHp: 70, hpScalingRate: 1.083, baseMinDamage: 2, baseMaxDamage: 5, damageScalingRate: 1.068, baseArmor: 0, baseXpReward: 320, xpScalingRate: 1.079, baseGoldMin: 14, baseGoldMax: 32, goldScalingRate: 1.190 },
      elite: { baseHp: 200, hpScalingRate: 1.060, baseMinDamage: 4, baseMaxDamage: 9, damageScalingRate: 1.051, baseArmor: 1, baseXpReward: 900, xpScalingRate: 1.075, baseGoldMin: 35, baseGoldMax: 80, goldScalingRate: 1.190 },
      boss: { baseHp: 500, hpScalingRate: 1.071, baseMinDamage: 8, baseMaxDamage: 18, damageScalingRate: 1.072, baseArmor: 2, baseXpReward: 2800, xpScalingRate: 1.068, baseGoldMin: 120, baseGoldMax: 260, goldScalingRate: 1.190 },
    },
    mobActionDelay: { minActionDelayMillis: 6000, maxActionDelayMillis: 12000 },
    stats: { bindings: { meleeStatMultiplier: 0.20, meleeLevelScalingRate: 1.22, meleeVarianceMin: 0.85, meleeVarianceMax: 1.15, meleeBaseAttackPower: 1, meleeArmorMitigationK: 24, dodgePerPoint: 3, maxDodgePercent: 40, spellStatMultiplier: 0.20, spellLevelScalingRate: 1.22, spellVarianceMin: 0.85, spellVarianceMax: 1.15, healStat: "WIS", healStatMultiplier: 0.20, healLevelScalingRate: 1.22, healVarianceMin: 0.85, healVarianceMax: 1.15, buffStat: "CHA", buffDurationPerStat: 0.025, buffMagnitudePerStat: 0.025, hpScalingDivisor: 3, manaScalingDivisor: 3, hpRegenMsPerPoint: 300, manaRegenMsPerPoint: 300, xpBonusPerPoint: 0.03 } },
    economy: { buyMultiplier: 0.6, sellMultiplier: 0.4 },
    crafting: { maxSkillLevel: 40, baseXpPerLevel: 60, xpExponent: 1.2, gatherCooldownMs: 1500, stationBonusQuantity: 3 },
    gambling: { enabled: true, diceMinBet: 5, diceMaxBet: 300, diceWinChance: 0.45, diceWinMultiplier: 2.0 },
    lottery: { enabled: true, ticketCost: 5, drawingIntervalMs: 1200000, jackpotSeedGold: 1500 },
    stylist: { feeGold: 200 },
    bank: { maxItems: 150 },
    enchanting: { maxEnchantmentsPerItem: 5 },
    progression: {
      maxLevel: 30,
      xp: {
        baseXp: 3200,
        exponent: 1.45,
        linearXp: 260,
        multiplier: 0.7,
        defaultKillXp: 100,
        diminishing: {
          enabled: true,
          thresholds: [
            { levelsBelow: 5, multiplier: 0.5 },
            { levelsBelow: 8, multiplier: 0.2 },
            { levelsBelow: 12, multiplier: 0.0 },
          ],
        },
      },
      rewards: { hpScalingRate: 1.097, manaScalingRate: 1.094, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 160, baseMana: 150 },
      quests: {
        baseline: { baseXp: 300, xpPerLevel: 220 },
        tiers: { trivial: 0.3, easy: 0.6, standard: 1.0, hard: 1.5, epic: 2.5 },
      },
    },
    skillPoints: { interval: 2 },
    multiclass: { minLevel: 8, goldCost: 100, maxClasses: 5, goldCostMultiplier: 1.5 },
    characterCreation: { startingGold: 500 },
    prestige: { enabled: true, xpCostBase: 3000, xpCostMultiplier: 1.2, maxRank: 10 },
    respec: { goldCost: 25, cooldownMs: 30000 },
    autoQuests: { enabled: true, timeLimitMs: 900000, cooldownMs: 60000 },
    dailyQuests: { enabled: true, streakBonusPercent: 20 },
    globalQuests: { enabled: true, intervalMs: 3600000, durationMs: 1800000 },
    // 7.5%/2000ms = 6 HP/s on a 160-HP starter — sandbox forgiveness.
    // In-combat multiplier 0.5 keeps boss fights from feeling trivial.
    regen: { maxPlayersPerTick: 20, baseIntervalMillis: 2000, minIntervalMillis: 500, regenPercent: 0.075, inCombatMultiplier: 0.5, mana: { baseIntervalMillis: 2000, minIntervalMillis: 500, regenPercent: 0.067 } },
    worldTime: { cycleLengthMs: 1200000, dawnHour: 5, dayHour: 7, duskHour: 18, nightHour: 20 },
    weather: { minTransitionMs: 120000, maxTransitionMs: 300000 },
    group: { maxSize: 6, inviteTimeoutMs: 60000, xpBonusPerMember: 0.20 },
    navigation: { recall: { cooldownMs: 15000 } },
    death: { respawnHpFraction: 1.0, respawnManaFraction: 1.0, xpPenaltyFraction: 0.0 },
    friends: { maxFriends: 100 },
    guild: { maxSize: 50, inviteTimeoutMs: 60000 },
    guildHalls: { enabled: true, purchaseCost: 3000 },
    housing: { enabled: true },
    factions: { defaultReputation: 0, killPenalty: 3, killBonus: 5 },
    leaderboard: { refreshIntervalMs: 60000, topN: 20 },
  },
};

// ─── PvP Arena Preset ───────────────────────────────────────────��───

export const PVP_ARENA_PRESET: TuningPreset = {
  id: "pvpArena",
  name: "PvP Arena",
  description:
    "Tight competitive balance with fast combat, meaningful stat choices, and scarce resources. Designed for player-versus-player worlds.",
  sectionDescriptions: {
    [TuningSection.CombatStats]:
      "Fast, lethal combat where positioning and build choices dominate. Stat scaling is deliberate — every point matters in a mirror match.",
    [TuningSection.EconomyCrafting]:
      "Scarce economy where gold is a strategic resource. Crafting is slow but powerful, and gambling is high-stakes.",
    [TuningSection.ProgressionQuests]:
      "Moderate leveling — fast enough to reach competitive play, steep enough that level advantages are earned. Quest rewards are balanced for fairness.",
    [TuningSection.WorldSocial]:
      "Moderate regen that rewards preparation. Group play is strongly incentivized with generous XP bonuses. Factions have meaningful reputation swings.",
  },
  config: {
    combat: { tickMillis: 1500 },
    mobTiers: {
      weak: { baseHp: 32, hpScalingRate: 1.097, baseMinDamage: 1, baseMaxDamage: 4, damageScalingRate: 1.075, baseArmor: 0, baseXpReward: 65, xpScalingRate: 1.086, baseGoldMin: 2, baseGoldMax: 5, goldScalingRate: 1.195 },
      standard: { baseHp: 135, hpScalingRate: 1.085, baseMinDamage: 6, baseMaxDamage: 14, damageScalingRate: 1.080, baseArmor: 1, baseXpReward: 200, xpScalingRate: 1.079, baseGoldMin: 4, baseGoldMax: 12, goldScalingRate: 1.195 },
      elite: { baseHp: 360, hpScalingRate: 1.060, baseMinDamage: 12, baseMaxDamage: 26, damageScalingRate: 1.067, baseArmor: 3, baseXpReward: 520, xpScalingRate: 1.075, baseGoldMin: 14, baseGoldMax: 36, goldScalingRate: 1.195 },
      boss: { baseHp: 900, hpScalingRate: 1.072, baseMinDamage: 24, baseMaxDamage: 54, damageScalingRate: 1.072, baseArmor: 4, baseXpReward: 1700, xpScalingRate: 1.070, baseGoldMin: 55, baseGoldMax: 130, goldScalingRate: 1.195 },
    },
    mobActionDelay: { minActionDelayMillis: 2500, maxActionDelayMillis: 5000 },
    stats: { bindings: { meleeStatMultiplier: 0.28, meleeLevelScalingRate: 1.32, meleeVarianceMin: 0.82, meleeVarianceMax: 1.18, meleeBaseAttackPower: 1, meleeArmorMitigationK: 18, dodgePerPoint: 2, maxDodgePercent: 25, spellStatMultiplier: 0.28, spellLevelScalingRate: 1.32, spellVarianceMin: 0.82, spellVarianceMax: 1.18, healStat: "WIS", healStatMultiplier: 0.28, healLevelScalingRate: 1.32, healVarianceMin: 0.82, healVarianceMax: 1.18, buffStat: "CHA", buffDurationPerStat: 0.018, buffMagnitudePerStat: 0.018, hpScalingDivisor: 4, manaScalingDivisor: 4, hpRegenMsPerPoint: 180, manaRegenMsPerPoint: 180, xpBonusPerPoint: 0.01 } },
    economy: { buyMultiplier: 1.2, sellMultiplier: 0.4 },
    crafting: { maxSkillLevel: 80, baseXpPerLevel: 120, xpExponent: 1.6, gatherCooldownMs: 4000, stationBonusQuantity: 1 },
    gambling: { enabled: true, diceMinBet: 20, diceMaxBet: 1500, diceWinChance: 0.35, diceWinMultiplier: 2.5 },
    lottery: { enabled: false, ticketCost: 50, drawingIntervalMs: 7200000, jackpotSeedGold: 300 },
    stylist: { feeGold: 1500 },
    bank: { maxItems: 40 },
    enchanting: { maxEnchantmentsPerItem: 2 },
    progression: {
      maxLevel: 30,
      xp: {
        baseXp: 2700,
        exponent: 1.7,
        linearXp: 3000,
        multiplier: 1.0,
        defaultKillXp: 60,
        diminishing: {
          enabled: true,
          thresholds: [
            { levelsBelow: 3, multiplier: 0.5 },
            { levelsBelow: 5, multiplier: 0.2 },
            { levelsBelow: 8, multiplier: 0.0 },
          ],
        },
      },
      rewards: { hpScalingRate: 1.098, manaScalingRate: 1.095, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 135, baseMana: 125 },
      quests: {
        baseline: { baseXp: 400, xpPerLevel: 100 },
        tiers: { trivial: 0.25, easy: 0.5, standard: 1.0, hard: 1.75, epic: 2.5 },
      },
    },
    skillPoints: { interval: 2 },
    multiclass: { minLevel: 20, goldCost: 1000, maxClasses: 2, goldCostMultiplier: 2.5 },
    characterCreation: { startingGold: 75 },
    prestige: { enabled: true, xpCostBase: 15000, xpCostMultiplier: 1.8, maxRank: 5 },
    respec: { goldCost: 250, cooldownMs: 600000 },
    autoQuests: { enabled: true, timeLimitMs: 240000, cooldownMs: 300000 },
    dailyQuests: { enabled: true, streakBonusPercent: 8 },
    globalQuests: { enabled: true, intervalMs: 5400000, durationMs: 2700000 },
    // 3.7%/4800ms ≈ 1.0 HP/s on a 135-HP starter — PvE recovery is light;
    // in-combat regen is disabled so PvP duels are decided by burst, not
    // by waiting out a regen war.
    regen: { maxPlayersPerTick: 10, baseIntervalMillis: 4800, minIntervalMillis: 1300, regenPercent: 0.037, inCombatMultiplier: 0, mana: { baseIntervalMillis: 4800, minIntervalMillis: 1300, regenPercent: 0.032 } },
    worldTime: { cycleLengthMs: 1800000, dawnHour: 5, dayHour: 7, duskHour: 18, nightHour: 20 },
    weather: { minTransitionMs: 180000, maxTransitionMs: 600000 },
    group: { maxSize: 4, inviteTimeoutMs: 30000, xpBonusPerMember: 0.15 },
    navigation: { recall: { cooldownMs: 120000 } },
    death: { respawnHpFraction: 0.5, respawnManaFraction: 0.3, xpPenaltyFraction: 0.0 },
    friends: { maxFriends: 50 },
    guild: { maxSize: 25, inviteTimeoutMs: 30000 },
    guildHalls: { enabled: true, purchaseCost: 15000 },
    housing: { enabled: true },
    factions: { defaultReputation: 0, killPenalty: 15, killBonus: 10 },
    leaderboard: { refreshIntervalMs: 60000, topN: 10 },
  },
};

// ─── Lore Explorer Preset ───────────────────────────────────────────

export const LORE_EXPLORER_PRESET: TuningPreset = {
  id: "loreExplorer",
  name: "Lore Explorer",
  description:
    "Overpowered from the start. Players are strong immediately and can roam freely, exploring every corner of the world without friction. Built for world-first enjoyment.",
  sectionDescriptions: {
    [TuningSection.CombatStats]:
      "Players dominate combat from level 1. Mobs are fragile and barely threaten — the world is yours to explore, not survive.",
    [TuningSection.EconomyCrafting]:
      "Gold flows freely and everything is cheap. Crafting is instant gratification — max out skills quickly and experiment with recipes.",
    [TuningSection.ProgressionQuests]:
      "Very fast leveling. Players cap quickly over a short run of sessions so they can access content fast, but the curve no longer collapses into a few minutes of trash pulls.",
    [TuningSection.WorldSocial]:
      "Instant regen, no cooldowns. The world is a playground — no resource management, no waiting, just exploration.",
  },
  config: {
    combat: { tickMillis: 4000 },
    mobTiers: {
      weak: { baseHp: 10, hpScalingRate: 1.099, baseMinDamage: 1, baseMaxDamage: 1, damageScalingRate: 1.0, baseArmor: 0, baseXpReward: 40, xpScalingRate: 1.089, baseGoldMin: 25, baseGoldMax: 60, goldScalingRate: 1.143 },
      standard: { baseHp: 45, hpScalingRate: 1.078, baseMinDamage: 1, baseMaxDamage: 3, damageScalingRate: 1.0, baseArmor: 0, baseXpReward: 120, xpScalingRate: 1.081, baseGoldMin: 45, baseGoldMax: 110, goldScalingRate: 1.143 },
      elite: { baseHp: 110, hpScalingRate: 1.065, baseMinDamage: 2, baseMaxDamage: 5, damageScalingRate: 1.068, baseArmor: 0, baseXpReward: 360, xpScalingRate: 1.075, baseGoldMin: 110, baseGoldMax: 240, goldScalingRate: 1.143 },
      boss: { baseHp: 250, hpScalingRate: 1.074, baseMinDamage: 5, baseMaxDamage: 12, damageScalingRate: 1.063, baseArmor: 1, baseXpReward: 1100, xpScalingRate: 1.071, baseGoldMin: 320, baseGoldMax: 700, goldScalingRate: 1.143 },
    },
    mobActionDelay: { minActionDelayMillis: 6000, maxActionDelayMillis: 14000 },
    stats: { bindings: { meleeStatMultiplier: 0.15, meleeLevelScalingRate: 1.20, meleeVarianceMin: 0.90, meleeVarianceMax: 1.10, meleeBaseAttackPower: 1, meleeArmorMitigationK: 28, dodgePerPoint: 5, maxDodgePercent: 55, spellStatMultiplier: 0.15, spellLevelScalingRate: 1.20, spellVarianceMin: 0.90, spellVarianceMax: 1.10, healStat: "WIS", healStatMultiplier: 0.15, healLevelScalingRate: 1.20, healVarianceMin: 0.90, healVarianceMax: 1.10, buffStat: "CHA", buffDurationPerStat: 0.03, buffMagnitudePerStat: 0.03, hpScalingDivisor: 2, manaScalingDivisor: 2, hpRegenMsPerPoint: 400, manaRegenMsPerPoint: 400, xpBonusPerPoint: 0.05 } },
    economy: { buyMultiplier: 0.3, sellMultiplier: 0.2 },
    crafting: { maxSkillLevel: 30, baseXpPerLevel: 30, xpExponent: 1.1, gatherCooldownMs: 1000, stationBonusQuantity: 5 },
    gambling: { enabled: true, diceMinBet: 1, diceMaxBet: 100, diceWinChance: 0.45, diceWinMultiplier: 2.0 },
    lottery: { enabled: true, ticketCost: 1, drawingIntervalMs: 600000, jackpotSeedGold: 5000 },
    stylist: { feeGold: 50 },
    bank: { maxItems: 200 },
    enchanting: { maxEnchantmentsPerItem: 6 },
    progression: {
      maxLevel: 30,
      xp: {
        baseXp: 780,
        exponent: 1.3,
        linearXp: 75,
        multiplier: 0.25,
        defaultKillXp: 250,
        diminishing: {
          enabled: true,
          thresholds: [
            { levelsBelow: 5, multiplier: 0.5 },
            { levelsBelow: 10, multiplier: 0.0 },
          ],
        },
      },
      rewards: { hpScalingRate: 1.097, manaScalingRate: 1.091, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 200, baseMana: 200 },
      quests: {
        baseline: { baseXp: 180, xpPerLevel: 90 },
        tiers: { trivial: 0.5, easy: 0.8, standard: 1.0, hard: 1.2, epic: 1.5 },
      },
    },
    skillPoints: { interval: 1 },
    multiclass: { minLevel: 5, goldCost: 50, maxClasses: 6, goldCostMultiplier: 1.0 },
    characterCreation: { startingGold: 2000 },
    prestige: { enabled: true, xpCostBase: 1000, xpCostMultiplier: 1.1, maxRank: 20 },
    respec: { goldCost: 0, cooldownMs: 0 },
    autoQuests: { enabled: true, timeLimitMs: 1800000, cooldownMs: 30000 },
    dailyQuests: { enabled: true, streakBonusPercent: 30 },
    globalQuests: { enabled: true, intervalMs: 1800000, durationMs: 900000 },
    // 15%/1200ms = 25 HP/s on a 200-HP starter — explorer-grade self-healing.
    // In-combat multiplier 1.0 means combat is pure flavor; nothing short of
    // a boss can drop you.
    regen: { maxPlayersPerTick: 25, baseIntervalMillis: 1200, minIntervalMillis: 280, regenPercent: 0.15, inCombatMultiplier: 1, mana: { baseIntervalMillis: 1200, minIntervalMillis: 280, regenPercent: 0.125 } },
    worldTime: { cycleLengthMs: 900000, dawnHour: 5, dayHour: 7, duskHour: 18, nightHour: 20 },
    weather: { minTransitionMs: 60000, maxTransitionMs: 180000 },
    group: { maxSize: 8, inviteTimeoutMs: 120000, xpBonusPerMember: 0.25 },
    navigation: { recall: { cooldownMs: 5000 } },
    death: { respawnHpFraction: 1.0, respawnManaFraction: 1.0, xpPenaltyFraction: 0.0 },
    friends: { maxFriends: 200 },
    guild: { maxSize: 100, inviteTimeoutMs: 120000 },
    guildHalls: { enabled: true, purchaseCost: 1000 },
    housing: { enabled: true },
    factions: { defaultReputation: 50, killPenalty: 1, killBonus: 10 },
    leaderboard: { refreshIntervalMs: 30000, topN: 50 },
  },
};

/** All available tuning presets for iteration. */
export const TUNING_PRESETS: TuningPreset[] = [
  CASUAL_PRESET,
  BALANCED_PRESET,
  HARDCORE_PRESET,
  SOLO_STORY_PRESET,
  PVP_ARENA_PRESET,
  LORE_EXPLORER_PRESET,
];
