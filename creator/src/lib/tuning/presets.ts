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
      maxLevel: 50,
      xp: {
        baseXp: 80,
        exponent: 1.6,
        linearXp: 10,
        multiplier: 0.8,
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
    combat: { tickMillis: 3500, minDamage: 2, maxDamage: 80 },
    mobTiers: {
      weak: { baseHp: 2, hpPerLevel: 1, baseMinDamage: 1, baseMaxDamage: 1, damagePerLevel: 0, baseArmor: 0, baseXpReward: 25, xpRewardPerLevel: 10, baseGoldMin: 3, baseGoldMax: 8, goldPerLevel: 3 },
      standard: { baseHp: 6, hpPerLevel: 2, baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0, baseArmor: 0, baseXpReward: 50, xpRewardPerLevel: 20, baseGoldMin: 8, baseGoldMax: 18, goldPerLevel: 5 },
      elite: { baseHp: 14, hpPerLevel: 4, baseMinDamage: 2, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 1, baseXpReward: 120, xpRewardPerLevel: 40, baseGoldMin: 20, baseGoldMax: 45, goldPerLevel: 10 },
      boss: { baseHp: 28, hpPerLevel: 6, baseMinDamage: 2, baseMaxDamage: 5, damagePerLevel: 1, baseArmor: 1, baseXpReward: 300, xpRewardPerLevel: 80, baseGoldMin: 80, baseGoldMax: 160, goldPerLevel: 25 },
    },
    mobActionDelay: { minActionDelayMillis: 3500, maxActionDelayMillis: 7000 },
    stats: { bindings: { meleeDamageDivisor: 2, dodgePerPoint: 3, maxDodgePercent: 40, spellDamageDivisor: 2, hpScalingDivisor: 3, manaScalingDivisor: 3, hpRegenMsPerPoint: 300, manaRegenMsPerPoint: 300, xpBonusPerPoint: 3 } },
    economy: { buyMultiplier: 0.6, sellMultiplier: 0.7 },
    crafting: { maxSkillLevel: 40, baseXpPerLevel: 60, xpExponent: 1.2, gatherCooldownMs: 1500, stationBonusQuantity: 3 },
    gambling: { enabled: true, minBet: 5, maxBet: 300, winChance: 0.55, winMultiplier: 2.0 },
    lottery: { enabled: true, ticketCost: 5, drawingIntervalMs: 1200000, jackpotBase: 1500 },
    stylist: { feeGold: 200 },
    bank: { maxItems: 150 },
    enchanting: { maxEnchantmentsPerItem: 5 },
    progression: {
      maxLevel: 40,
      xp: { baseXp: 70, exponent: 1.45, linearXp: 5, multiplier: 0.7, defaultKillXp: 20 },
      rewards: { hpPerLevel: 4, manaPerLevel: 3, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 20, baseMana: 20 },
    },
    skillPoints: { interval: 2 },
    multiclass: { minLevel: 8, goldCost: 100 },
    characterCreation: { startingGold: 500 },
    prestige: { enabled: true, xpCostBase: 3000, xpCostMultiplier: 1.2, maxRank: 10 },
    respec: { goldCost: 25, cooldownMs: 30000 },
    autoQuests: { enabled: true, timeLimitMs: 900000, cooldownMs: 60000, rewardScaling: 2.0 },
    dailyQuests: { enabled: true, streakBonusPercent: 20 },
    globalQuests: { enabled: true, intervalMs: 3600000, durationMs: 1800000 },
    regen: { maxPlayersPerTick: 20, baseIntervalMillis: 2500, minIntervalMillis: 500, regenAmount: 3, mana: { baseIntervalMillis: 2500, minIntervalMillis: 500, regenAmount: 3 } },
    worldTime: { cycleLengthMs: 1200000, dawnHour: 5, dayHour: 7, duskHour: 18, nightHour: 20 },
    weather: { minTransitionMs: 120000, maxTransitionMs: 300000 },
    group: { maxSize: 6, inviteTimeoutMs: 60000, xpBonusPerMember: 20 },
    navigation: { recall: { cooldownMs: 15000 } },
    friends: { maxFriends: 100 },
    guild: { maxSize: 50, inviteTimeoutMs: 60000 },
    guildHalls: { enabled: true, baseCost: 3000 },
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
    combat: { tickMillis: 1500, minDamage: 1, maxDamage: 180 },
    mobTiers: {
      weak: { baseHp: 6, hpPerLevel: 2, baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 1, baseArmor: 0, baseXpReward: 12, xpRewardPerLevel: 4, baseGoldMin: 1, baseGoldMax: 2, goldPerLevel: 1 },
      standard: { baseHp: 14, hpPerLevel: 5, baseMinDamage: 2, baseMaxDamage: 5, damagePerLevel: 1, baseArmor: 1, baseXpReward: 25, xpRewardPerLevel: 8, baseGoldMin: 2, baseGoldMax: 6, goldPerLevel: 2 },
      elite: { baseHp: 35, hpPerLevel: 9, baseMinDamage: 4, baseMaxDamage: 8, damagePerLevel: 2, baseArmor: 3, baseXpReward: 65, xpRewardPerLevel: 22, baseGoldMin: 8, baseGoldMax: 20, goldPerLevel: 4 },
      boss: { baseHp: 70, hpPerLevel: 15, baseMinDamage: 5, baseMaxDamage: 12, damagePerLevel: 3, baseArmor: 4, baseXpReward: 180, xpRewardPerLevel: 45, baseGoldMin: 40, baseGoldMax: 80, goldPerLevel: 12 },
    },
    mobActionDelay: { minActionDelayMillis: 1500, maxActionDelayMillis: 3500 },
    stats: { bindings: { meleeDamageDivisor: 3, dodgePerPoint: 2, maxDodgePercent: 25, spellDamageDivisor: 3, hpScalingDivisor: 4, manaScalingDivisor: 4, hpRegenMsPerPoint: 180, manaRegenMsPerPoint: 180, xpBonusPerPoint: 1 } },
    economy: { buyMultiplier: 1.2, sellMultiplier: 0.4 },
    crafting: { maxSkillLevel: 80, baseXpPerLevel: 120, xpExponent: 1.6, gatherCooldownMs: 4000, stationBonusQuantity: 1 },
    gambling: { enabled: true, minBet: 20, maxBet: 1500, winChance: 0.4, winMultiplier: 2.5 },
    lottery: { enabled: false, ticketCost: 50, drawingIntervalMs: 7200000, jackpotBase: 300 },
    stylist: { feeGold: 1500 },
    bank: { maxItems: 40 },
    enchanting: { maxEnchantmentsPerItem: 2 },
    progression: {
      maxLevel: 50,
      xp: { baseXp: 90, exponent: 1.7, linearXp: 5, multiplier: 1.0, defaultKillXp: 8 },
      rewards: { hpPerLevel: 2, manaPerLevel: 1, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 12, baseMana: 10 },
    },
    skillPoints: { interval: 3 },
    multiclass: { minLevel: 20, goldCost: 1000 },
    characterCreation: { startingGold: 75 },
    prestige: { enabled: true, xpCostBase: 15000, xpCostMultiplier: 1.8, maxRank: 5 },
    respec: { goldCost: 250, cooldownMs: 600000 },
    autoQuests: { enabled: true, timeLimitMs: 240000, cooldownMs: 300000, rewardScaling: 0.9 },
    dailyQuests: { enabled: true, streakBonusPercent: 8 },
    globalQuests: { enabled: true, intervalMs: 5400000, durationMs: 2700000 },
    regen: { maxPlayersPerTick: 10, baseIntervalMillis: 5000, minIntervalMillis: 1200, regenAmount: 1, mana: { baseIntervalMillis: 5000, minIntervalMillis: 1200, regenAmount: 1 } },
    worldTime: { cycleLengthMs: 1800000, dawnHour: 5, dayHour: 7, duskHour: 18, nightHour: 20 },
    weather: { minTransitionMs: 180000, maxTransitionMs: 600000 },
    group: { maxSize: 4, inviteTimeoutMs: 30000, xpBonusPerMember: 15 },
    navigation: { recall: { cooldownMs: 120000 } },
    friends: { maxFriends: 50 },
    guild: { maxSize: 25, inviteTimeoutMs: 30000 },
    guildHalls: { enabled: true, baseCost: 15000 },
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
    combat: { tickMillis: 4000, minDamage: 5, maxDamage: 50 },
    mobTiers: {
      weak: { baseHp: 1, hpPerLevel: 1, baseMinDamage: 1, baseMaxDamage: 1, damagePerLevel: 0, baseArmor: 0, baseXpReward: 50, xpRewardPerLevel: 20, baseGoldMin: 10, baseGoldMax: 25, goldPerLevel: 5 },
      standard: { baseHp: 4, hpPerLevel: 1, baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0, baseArmor: 0, baseXpReward: 100, xpRewardPerLevel: 40, baseGoldMin: 20, baseGoldMax: 50, goldPerLevel: 10 },
      elite: { baseHp: 10, hpPerLevel: 3, baseMinDamage: 1, baseMaxDamage: 3, damagePerLevel: 0, baseArmor: 0, baseXpReward: 250, xpRewardPerLevel: 80, baseGoldMin: 50, baseGoldMax: 100, goldPerLevel: 20 },
      boss: { baseHp: 20, hpPerLevel: 5, baseMinDamage: 2, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 1, baseXpReward: 500, xpRewardPerLevel: 150, baseGoldMin: 150, baseGoldMax: 300, goldPerLevel: 50 },
    },
    mobActionDelay: { minActionDelayMillis: 4000, maxActionDelayMillis: 8000 },
    stats: { bindings: { meleeDamageDivisor: 1, dodgePerPoint: 5, maxDodgePercent: 50, spellDamageDivisor: 1, hpScalingDivisor: 2, manaScalingDivisor: 2, hpRegenMsPerPoint: 400, manaRegenMsPerPoint: 400, xpBonusPerPoint: 5 } },
    economy: { buyMultiplier: 0.3, sellMultiplier: 0.9 },
    crafting: { maxSkillLevel: 30, baseXpPerLevel: 30, xpExponent: 1.1, gatherCooldownMs: 1000, stationBonusQuantity: 5 },
    gambling: { enabled: true, minBet: 1, maxBet: 100, winChance: 0.6, winMultiplier: 3.0 },
    lottery: { enabled: true, ticketCost: 1, drawingIntervalMs: 600000, jackpotBase: 5000 },
    stylist: { feeGold: 50 },
    bank: { maxItems: 200 },
    enchanting: { maxEnchantmentsPerItem: 6 },
    progression: {
      maxLevel: 30,
      xp: { baseXp: 40, exponent: 1.3, linearXp: 5, multiplier: 0.25, defaultKillXp: 50 },
      rewards: { hpPerLevel: 8, manaPerLevel: 6, fullHealOnLevelUp: true, fullManaOnLevelUp: true, baseHp: 50, baseMana: 50 },
    },
    skillPoints: { interval: 1 },
    multiclass: { minLevel: 5, goldCost: 50 },
    characterCreation: { startingGold: 2000 },
    prestige: { enabled: true, xpCostBase: 1000, xpCostMultiplier: 1.1, maxRank: 20 },
    respec: { goldCost: 0, cooldownMs: 0 },
    autoQuests: { enabled: true, timeLimitMs: 1800000, cooldownMs: 30000, rewardScaling: 3.0 },
    dailyQuests: { enabled: true, streakBonusPercent: 30 },
    globalQuests: { enabled: true, intervalMs: 1800000, durationMs: 900000 },
    regen: { maxPlayersPerTick: 25, baseIntervalMillis: 1500, minIntervalMillis: 300, regenAmount: 5, mana: { baseIntervalMillis: 1500, minIntervalMillis: 300, regenAmount: 5 } },
    worldTime: { cycleLengthMs: 900000, dawnHour: 5, dayHour: 7, duskHour: 18, nightHour: 20 },
    weather: { minTransitionMs: 60000, maxTransitionMs: 180000 },
    group: { maxSize: 8, inviteTimeoutMs: 120000, xpBonusPerMember: 25 },
    navigation: { recall: { cooldownMs: 5000 } },
    friends: { maxFriends: 200 },
    guild: { maxSize: 100, inviteTimeoutMs: 120000 },
    guildHalls: { enabled: true, baseCost: 1000 },
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
