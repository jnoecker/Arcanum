import type { StatMap } from "./world";

// ─── Stat system ────────────────────────────────────────────────────

export interface StatDefinition {
  id: string;
  displayName: string;
  abbreviation: string;
  description: string;
  baseStat: number;
}

export interface StatBindings {
  meleeDamageStat: string;
  meleeDamageDivisor: number;
  dodgeStat: string;
  dodgePerPoint: number;
  maxDodgePercent: number;
  spellDamageStat: string;
  spellDamageDivisor: number;
  hpScalingStat: string;
  hpScalingDivisor: number;
  manaScalingStat: string;
  manaScalingDivisor: number;
  hpRegenStat: string;
  hpRegenMsPerPoint: number;
  manaRegenStat: string;
  manaRegenMsPerPoint: number;
  xpBonusStat: string;
  xpBonusPerPoint: number;
}

// ─── Abilities ──────────────────────────────────────────────────────

export interface AbilityEffectConfig {
  type: string;
  value?: number;
  statusEffectId?: string;
  flatThreat?: number;
  margin?: number;
}

export interface AbilityDefinitionConfig {
  displayName: string;
  description?: string;
  manaCost: number;
  cooldownMs: number;
  levelRequired: number;
  targetType: string;
  effect: AbilityEffectConfig;
  classRestriction?: string;
  image?: string;
}

// ─── Status Effects ─────────────────────────────────────────────────

export interface StatusEffectDefinitionConfig {
  displayName: string;
  effectType: string;
  durationMs: number;
  tickIntervalMs?: number;
  tickValue?: number;
  shieldAmount?: number;
  stackBehavior?: string;
  maxStacks?: number;
  statMods?: StatMap;
}

// ─── Combat ─────────────────────────────────────────────────────────

export interface CombatConfig {
  maxCombatsPerTick: number;
  tickMillis: number;
  minDamage: number;
  maxDamage: number;
  feedback: {
    enabled: boolean;
    roomBroadcastEnabled: boolean;
  };
}

// ─── Mob Tiers ──────────────────────────────────────────────────────

export interface MobTierConfig {
  baseHp: number;
  hpPerLevel: number;
  baseMinDamage: number;
  baseMaxDamage: number;
  damagePerLevel: number;
  baseArmor: number;
  baseXpReward: number;
  xpRewardPerLevel: number;
  baseGoldMin: number;
  baseGoldMax: number;
  goldPerLevel: number;
}

export interface MobTiersConfig {
  weak: MobTierConfig;
  standard: MobTierConfig;
  elite: MobTierConfig;
  boss: MobTierConfig;
}

export interface MobActionDelayConfig {
  minActionDelayMillis: number;
  maxActionDelayMillis: number;
}

// ─── Progression ────────────────────────────────────────────────────

export interface XpCurveConfig {
  baseXp: number;
  exponent: number;
  linearXp: number;
  multiplier: number;
  defaultKillXp: number;
}

export interface LevelRewardsConfig {
  hpPerLevel: number;
  manaPerLevel: number;
  fullHealOnLevelUp: boolean;
  fullManaOnLevelUp: boolean;
  baseHp: number;
  baseMana: number;
}

export interface ProgressionConfig {
  maxLevel: number;
  xp: XpCurveConfig;
  rewards: LevelRewardsConfig;
}

// ─── Economy ────────────────────────────────────────────────────────

export interface EconomyConfig {
  buyMultiplier: number;
  sellMultiplier: number;
}

// ─── Regen ──────────────────────────────────────────────────────────

export interface RegenConfig {
  maxPlayersPerTick: number;
  baseIntervalMillis: number;
  minIntervalMillis: number;
  regenAmount: number;
  mana: {
    baseIntervalMillis: number;
    minIntervalMillis: number;
    regenAmount: number;
  };
}

// ─── Crafting ───────────────────────────────────────────────────────

export interface CraftingConfig {
  maxSkillLevel: number;
  baseXpPerLevel: number;
  xpExponent: number;
  gatherCooldownMs: number;
  stationBonusQuantity: number;
}

// ─── Group ──────────────────────────────────────────────────────────

export interface GroupConfig {
  maxSize: number;
  inviteTimeoutMs: number;
  xpBonusPerMember: number;
}

// ─── Equipment Slots ────────────────────────────────────────────────

export interface EquipmentSlotDefinition {
  displayName: string;
  order: number;
}

// ─── Gender ─────────────────────────────────────────────────────────

export interface GenderDefinition {
  displayName: string;
  spriteCode?: string;
}

// ─── Achievements ───────────────────────────────────────────────────

export interface AchievementCategoryDefinition {
  displayName: string;
}

export interface AchievementCriterionTypeDefinition {
  displayName: string;
  progressFormat?: string;
}

// ─── Quests ─────────────────────────────────────────────────────────

export interface QuestObjectiveTypeDefinition {
  displayName: string;
}

export interface QuestCompletionTypeDefinition {
  displayName: string;
}

// ─── Status Effect Types ────────────────────────────────────────────

export interface StatusEffectTypeDefinition {
  displayName: string;
  tickBehavior?: string;
  preventsActions?: boolean;
  preventsMovement?: boolean;
  absorbsDamage?: boolean;
}

export interface StackBehaviorDefinition {
  displayName: string;
}

// ─── Ability Target Types ───────────────────────────────────────────

export interface AbilityTargetTypeDefinition {
  displayName: string;
}

// ─── Crafting Skills & Stations ─────────────────────────────────────

export interface CraftingSkillDefinition {
  displayName: string;
  type: string;
}

export interface CraftingStationTypeDefinition {
  displayName: string;
}

// ─── Guild Ranks ────────────────────────────────────────────────────

export interface GuildRankDefinition {
  displayName: string;
  level: number;
  permissions?: string[];
}

// ─── Classes & Races ────────────────────────────────────────────────

export interface ClassDefinitionConfig {
  displayName: string;
  description?: string;
  hpPerLevel: number;
  manaPerLevel: number;
  primaryStat?: string;
  selectable?: boolean;
  startRoom?: string;
  threatMultiplier?: number;
}

// ─── Character Creation ────────────────────────────────────────────

export interface CharacterCreationConfig {
  startingGold: number;
}

export interface RaceDefinitionConfig {
  displayName: string;
  description?: string;
  statMods?: StatMap;
}

// ─── Images ─────────────────────────────────────────────────────────

export interface ImagesConfig {
  baseUrl: string;
}

// ─── Server ─────────────────────────────────────────────────────────

export interface ServerConfig {
  telnetPort: number;
  webPort: number;
}

// ─── Top-level config state ─────────────────────────────────────────

export interface AppConfig {
  server: ServerConfig;
  stats: {
    definitions: Record<string, StatDefinition>;
    bindings: StatBindings;
  };
  abilities: Record<string, AbilityDefinitionConfig>;
  statusEffects: Record<string, StatusEffectDefinitionConfig>;
  combat: CombatConfig;
  mobTiers: MobTiersConfig;
  mobActionDelay: MobActionDelayConfig;
  progression: ProgressionConfig;
  economy: EconomyConfig;
  regen: RegenConfig;
  crafting: CraftingConfig;
  group: GroupConfig;
  classes: Record<string, ClassDefinitionConfig>;
  races: Record<string, RaceDefinitionConfig>;
  characterCreation: CharacterCreationConfig;
  equipmentSlots: Record<string, EquipmentSlotDefinition>;
  genders: Record<string, GenderDefinition>;
  achievementCategories: Record<string, AchievementCategoryDefinition>;
  achievementCriterionTypes: Record<string, AchievementCriterionTypeDefinition>;
  questObjectiveTypes: Record<string, QuestObjectiveTypeDefinition>;
  questCompletionTypes: Record<string, QuestCompletionTypeDefinition>;
  statusEffectTypes: Record<string, StatusEffectTypeDefinition>;
  stackBehaviors: Record<string, StackBehaviorDefinition>;
  abilityTargetTypes: Record<string, AbilityTargetTypeDefinition>;
  craftingSkills: Record<string, CraftingSkillDefinition>;
  craftingStationTypes: Record<string, CraftingStationTypeDefinition>;
  guildRanks: Record<string, GuildRankDefinition>;
  images: ImagesConfig;
  /** Raw YAML content for unrecognized sections */
  rawSections: Record<string, unknown>;
}
