// ─── Tuning Presets ─────────────────────────────────────────────────
//
// Three themed presets (Casual, Balanced, Hardcore) as DeepPartial<AppConfig>
// overlays covering all 137 tunable fields from FIELD_METADATA.
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
      tickMillis: 3000,
      minDamage: 1,
      maxDamage: 100,
    },

    // ─── Mob Tiers ───────────────────────────────────────────────────
    mobTiers: {
      weak: {
        baseHp: 3,
        hpPerLevel: 1,
        baseMinDamage: 1,
        baseMaxDamage: 2,
        damagePerLevel: 0,
        baseArmor: 0,
        baseXpReward: 20,
        xpRewardPerLevel: 8,
        baseGoldMin: 2,
        baseGoldMax: 5,
        goldPerLevel: 2,
      },
      standard: {
        baseHp: 8,
        hpPerLevel: 3,
        baseMinDamage: 1,
        baseMaxDamage: 3,
        damagePerLevel: 0,
        baseArmor: 0,
        baseXpReward: 40,
        xpRewardPerLevel: 15,
        baseGoldMin: 5,
        baseGoldMax: 12,
        goldPerLevel: 3,
      },
      elite: {
        baseHp: 18,
        hpPerLevel: 5,
        baseMinDamage: 2,
        baseMaxDamage: 5,
        damagePerLevel: 1,
        baseArmor: 1,
        baseXpReward: 100,
        xpRewardPerLevel: 35,
        baseGoldMin: 15,
        baseGoldMax: 35,
        goldPerLevel: 7,
      },
      boss: {
        baseHp: 35,
        hpPerLevel: 8,
        baseMinDamage: 2,
        baseMaxDamage: 6,
        damagePerLevel: 1,
        baseArmor: 2,
        baseXpReward: 250,
        xpRewardPerLevel: 60,
        baseGoldMin: 60,
        baseGoldMax: 120,
        goldPerLevel: 18,
      },
    },

    // ─── Mob Action Delay ────────────────────────────────────────────
    mobActionDelay: {
      minActionDelayMillis: 3000,
      maxActionDelayMillis: 6000,
    },

    // ─── Stat Bindings ───────────────────────────────────────────────
    stats: {
      bindings: {
        meleeDamageDivisor: 2,
        dodgePerPoint: 3,
        maxDodgePercent: 35,
        spellDamageDivisor: 2,
        hpScalingDivisor: 4,
        manaScalingDivisor: 4,
        hpRegenMsPerPoint: 250,
        manaRegenMsPerPoint: 250,
        xpBonusPerPoint: 2,
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
      minBet: 5,
      maxBet: 500,
      winChance: 0.5,
      winMultiplier: 2.0,
    },

    // ─── Lottery ─────────────────────────────────────────────────────
    lottery: {
      enabled: true,
      ticketCost: 10,
      drawingIntervalMs: 1800000,
      jackpotBase: 1000,
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
      maxLevel: 50,
      xp: {
        baseXp: 80,
        exponent: 1.6,
        linearXp: 10,
        multiplier: 1.0,
        defaultKillXp: 15,
      },
      rewards: {
        hpPerLevel: 3,
        manaPerLevel: 2,
        fullHealOnLevelUp: true,
        fullManaOnLevelUp: true,
        baseHp: 15,
        baseMana: 15,
      },
    },

    // ─── Skill Points ────────────────────────────────────────────────
    skillPoints: {
      interval: 2,
    },

    // ─── Multiclass ──────────────────────────────────────────────────
    multiclass: {
      minLevel: 10,
      goldCost: 200,
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
      rewardScaling: 1.5,
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
    regen: {
      maxPlayersPerTick: 15,
      baseIntervalMillis: 3500,
      minIntervalMillis: 800,
      regenAmount: 2,
      mana: {
        baseIntervalMillis: 3500,
        minIntervalMillis: 800,
        regenAmount: 2,
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
      xpBonusPerMember: 15,
    },

    // ─── Navigation ──────────────────────────────────────────────────
    navigation: {
      recall: {
        cooldownMs: 30000,
      },
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
      baseCost: 5000,
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
    "A well-tuned middle ground with satisfying combat pacing, steady progression, and a healthy economy. Good for most builders.",
  sectionDescriptions: {
    [TuningSection.CombatStats]:
      "Measured combat where positioning and preparation matter. Mob tiers scale steadily and stat investments feel rewarding without being overpowered.",
    [TuningSection.EconomyCrafting]:
      "A healthy buy/sell spread that makes gold meaningful. Crafting has a satisfying progression curve and gambling is a modest side activity.",
    [TuningSection.ProgressionQuests]:
      "Steady leveling that rewards consistent play. The XP curve accelerates at higher levels, and quest systems provide meaningful alternatives to grinding.",
    [TuningSection.WorldSocial]:
      "Moderate regen pacing that encourages resource management. Group play is incentivized and guild systems are fully featured.",
  },
  config: {
    // ─── Combat ──────────────────────────────────────────────────────
    combat: {
      tickMillis: 2000,
      minDamage: 1,
      maxDamage: 150,
    },

    // ─── Mob Tiers ───────────────────────────────────────────────────
    mobTiers: {
      weak: {
        baseHp: 5,
        hpPerLevel: 2,
        baseMinDamage: 1,
        baseMaxDamage: 2,
        damagePerLevel: 0,
        baseArmor: 0,
        baseXpReward: 15,
        xpRewardPerLevel: 5,
        baseGoldMin: 1,
        baseGoldMax: 3,
        goldPerLevel: 1,
      },
      standard: {
        baseHp: 12,
        hpPerLevel: 4,
        baseMinDamage: 2,
        baseMaxDamage: 4,
        damagePerLevel: 1,
        baseArmor: 1,
        baseXpReward: 30,
        xpRewardPerLevel: 10,
        baseGoldMin: 3,
        baseGoldMax: 8,
        goldPerLevel: 2,
      },
      elite: {
        baseHp: 28,
        hpPerLevel: 7,
        baseMinDamage: 3,
        baseMaxDamage: 6,
        damagePerLevel: 1,
        baseArmor: 2,
        baseXpReward: 75,
        xpRewardPerLevel: 25,
        baseGoldMin: 10,
        baseGoldMax: 25,
        goldPerLevel: 5,
      },
      boss: {
        baseHp: 55,
        hpPerLevel: 12,
        baseMinDamage: 4,
        baseMaxDamage: 9,
        damagePerLevel: 2,
        baseArmor: 3,
        baseXpReward: 200,
        xpRewardPerLevel: 50,
        baseGoldMin: 50,
        baseGoldMax: 100,
        goldPerLevel: 15,
      },
    },

    // ─── Mob Action Delay ────────────────────────────────────────────
    mobActionDelay: {
      minActionDelayMillis: 2000,
      maxActionDelayMillis: 5000,
    },

    // ─── Stat Bindings ───────────────────────────────────────────────
    stats: {
      bindings: {
        meleeDamageDivisor: 3,
        dodgePerPoint: 2,
        maxDodgePercent: 30,
        spellDamageDivisor: 3,
        hpScalingDivisor: 5,
        manaScalingDivisor: 5,
        hpRegenMsPerPoint: 200,
        manaRegenMsPerPoint: 200,
        xpBonusPerPoint: 1,
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
      minBet: 10,
      maxBet: 1000,
      winChance: 0.45,
      winMultiplier: 2.0,
    },

    // ─── Lottery ─────────────────────────────────────────────────────
    lottery: {
      enabled: true,
      ticketCost: 25,
      drawingIntervalMs: 3600000,
      jackpotBase: 500,
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
      maxLevel: 50,
      xp: {
        baseXp: 100,
        exponent: 1.8,
        linearXp: 0,
        multiplier: 1.0,
        defaultKillXp: 10,
      },
      rewards: {
        hpPerLevel: 2,
        manaPerLevel: 1,
        fullHealOnLevelUp: true,
        fullManaOnLevelUp: true,
        baseHp: 10,
        baseMana: 10,
      },
    },

    // ─── Skill Points ────────────────────────────────────────────────
    skillPoints: {
      interval: 3,
    },

    // ─── Multiclass ──────────────────────────────────────────────────
    multiclass: {
      minLevel: 15,
      goldCost: 500,
    },

    // ─── Character Creation ──────────────────────────────────────────
    characterCreation: {
      startingGold: 100,
    },

    // ─── Prestige ────────────────────────────────────────────────────
    prestige: {
      enabled: true,
      xpCostBase: 10000,
      xpCostMultiplier: 1.5,
      maxRank: 5,
    },

    // ─── Respec ──────────────────────────────────────────────────────
    respec: {
      goldCost: 100,
      cooldownMs: 300000,
    },

    // ─── Auto Quests ─────────────────────────────────────────────────
    autoQuests: {
      enabled: true,
      timeLimitMs: 300000,
      cooldownMs: 300000,
      rewardScaling: 1.0,
    },

    // ─── Daily Quests ────────────────────────────────────────────────
    dailyQuests: {
      enabled: true,
      streakBonusPercent: 10,
    },

    // ─── Global Quests ───────────────────────────────────────────────
    globalQuests: {
      enabled: true,
      intervalMs: 7200000,
      durationMs: 3600000,
    },

    // ─── Regen ───────────────────────────────────────────────────────
    regen: {
      maxPlayersPerTick: 10,
      baseIntervalMillis: 4500,
      minIntervalMillis: 1000,
      regenAmount: 1,
      mana: {
        baseIntervalMillis: 4500,
        minIntervalMillis: 1000,
        regenAmount: 1,
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
      xpBonusPerMember: 10,
    },

    // ─── Navigation ──────────────────────────────────────────────────
    navigation: {
      recall: {
        cooldownMs: 60000,
      },
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
      baseCost: 10000,
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
      tickMillis: 1500,
      minDamage: 1,
      maxDamage: 200,
    },

    // ─── Mob Tiers ───────────────────────────────────────────────────
    mobTiers: {
      weak: {
        baseHp: 8,
        hpPerLevel: 3,
        baseMinDamage: 1,
        baseMaxDamage: 3,
        damagePerLevel: 1,
        baseArmor: 0,
        baseXpReward: 10,
        xpRewardPerLevel: 3,
        baseGoldMin: 0,
        baseGoldMax: 2,
        goldPerLevel: 1,
      },
      standard: {
        baseHp: 18,
        hpPerLevel: 6,
        baseMinDamage: 3,
        baseMaxDamage: 6,
        damagePerLevel: 2,
        baseArmor: 2,
        baseXpReward: 20,
        xpRewardPerLevel: 7,
        baseGoldMin: 2,
        baseGoldMax: 5,
        goldPerLevel: 1,
      },
      elite: {
        baseHp: 45,
        hpPerLevel: 12,
        baseMinDamage: 5,
        baseMaxDamage: 10,
        damagePerLevel: 2,
        baseArmor: 4,
        baseXpReward: 60,
        xpRewardPerLevel: 20,
        baseGoldMin: 8,
        baseGoldMax: 18,
        goldPerLevel: 3,
      },
      boss: {
        baseHp: 100,
        hpPerLevel: 20,
        baseMinDamage: 6,
        baseMaxDamage: 14,
        damagePerLevel: 3,
        baseArmor: 5,
        baseXpReward: 150,
        xpRewardPerLevel: 40,
        baseGoldMin: 30,
        baseGoldMax: 70,
        goldPerLevel: 10,
      },
    },

    // ─── Mob Action Delay ────────────────────────────────────────────
    mobActionDelay: {
      minActionDelayMillis: 1500,
      maxActionDelayMillis: 4000,
    },

    // ─── Stat Bindings ───────────────────────────────────────────────
    stats: {
      bindings: {
        meleeDamageDivisor: 4,
        dodgePerPoint: 1,
        maxDodgePercent: 20,
        spellDamageDivisor: 4,
        hpScalingDivisor: 6,
        manaScalingDivisor: 6,
        hpRegenMsPerPoint: 150,
        manaRegenMsPerPoint: 150,
        xpBonusPerPoint: 1,
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
      minBet: 25,
      maxBet: 2000,
      winChance: 0.35,
      winMultiplier: 2.5,
    },

    // ─── Lottery ─────────────────────────────────────────────────────
    lottery: {
      enabled: true,
      ticketCost: 50,
      drawingIntervalMs: 7200000,
      jackpotBase: 200,
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
      maxLevel: 50,
      xp: {
        baseXp: 120,
        exponent: 2.2,
        linearXp: 0,
        multiplier: 1.0,
        defaultKillXp: 5,
      },
      rewards: {
        hpPerLevel: 1,
        manaPerLevel: 1,
        fullHealOnLevelUp: false,
        fullManaOnLevelUp: false,
        baseHp: 8,
        baseMana: 8,
      },
    },

    // ─── Skill Points ────────────────────────────────────────────────
    skillPoints: {
      interval: 5,
    },

    // ─── Multiclass ──────────────────────────────────────────────────
    multiclass: {
      minLevel: 25,
      goldCost: 2000,
    },

    // ─── Character Creation ──────────────────────────────────────────
    characterCreation: {
      startingGold: 25,
    },

    // ─── Prestige ────────────────────────────────────────────────────
    prestige: {
      enabled: true,
      xpCostBase: 25000,
      xpCostMultiplier: 2.0,
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
      rewardScaling: 0.8,
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
    regen: {
      maxPlayersPerTick: 8,
      baseIntervalMillis: 6000,
      minIntervalMillis: 1500,
      regenAmount: 1,
      mana: {
        baseIntervalMillis: 6000,
        minIntervalMillis: 1500,
        regenAmount: 1,
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
      xpBonusPerMember: 5,
    },

    // ─── Navigation ──────────────────────────────────────────────────
    navigation: {
      recall: {
        cooldownMs: 300000,
      },
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
      baseCost: 25000,
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

/** All available tuning presets for iteration. */
export const TUNING_PRESETS: TuningPreset[] = [
  CASUAL_PRESET,
  BALANCED_PRESET,
  HARDCORE_PRESET,
];
