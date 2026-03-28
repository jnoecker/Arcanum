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
  minDamage?: number;
  maxDamage?: number;
  minHeal?: number;
  maxHeal?: number;
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
  requiredClass?: string;
  classRestriction?: string;
  image?: string;
}

// ─── Status Effects ─────────────────────────────────────────────────

export interface StatusEffectDefinitionConfig {
  displayName: string;
  image?: string;
  effectType: string;
  durationMs: number;
  tickIntervalMs?: number;
  tickValue?: number;
  tickMinValue?: number;
  tickMaxValue?: number;
  shieldAmount?: number;
  stackBehavior?: string;
  maxStacks?: number;
  strMod?: number;
  dexMod?: number;
  conMod?: number;
  intMod?: number;
  wisMod?: number;
  chaMod?: number;
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

// ─── Navigation ────────────────────────────────────────────────────

export interface RecallMessagesConfig {
  combatBlocked: string;
  cooldownRemaining: string;
  castBegin: string;
  unreachable: string;
  departNotice: string;
  arriveNotice: string;
  arrival: string;
}

export interface RecallConfig {
  cooldownMs: number;
  messages: RecallMessagesConfig;
}

export interface NavigationConfig {
  recall: RecallConfig;
}

// ─── Commands ──────────────────────────────────────────────────────

export interface CommandEntryConfig {
  usage: string;
  category: string;
  staff: boolean;
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

// ─── Achievement definitions ────────────────────────────────────────

export interface AchievementCriterionFile {
  type: string;
  targetId?: string;
  count?: number;
  description?: string;
}

export interface AchievementRewardsFile {
  xp?: number;
  gold?: number;
  title?: string;
}

export interface AchievementDefFile {
  displayName: string;
  description?: string;
  category: string;
  hidden?: boolean;
  criteria: AchievementCriterionFile[];
  rewards?: AchievementRewardsFile;
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
  ticksDamage?: boolean;
  ticksHealing?: boolean;
  modifiesStats?: boolean;
  absorbsDamage?: boolean;
  preventsActions?: boolean;
  preventsMovement?: boolean;
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
  image?: string;
}

// ─── Friends ────────────────────────────────────────────────────────

export interface FriendsConfig {
  maxFriends: number;
}

// ─── Guild Ranks ────────────────────────────────────────────────────

export interface GuildConfig {
  founderRank: string;
  defaultRank: string;
}

export interface GuildRankDefinition {
  displayName: string;
  level: number;
  permissions?: string[];
}

// ─── Classes & Races ────────────────────────────────────────────────

export interface ClassDefinitionConfig {
  displayName: string;
  description?: string;
  backstory?: string;
  hpPerLevel: number;
  manaPerLevel: number;
  primaryStat?: string;
  selectable?: boolean;
  startRoom?: string;
  threatMultiplier?: number;
  image?: string;
  outfitDescription?: string;
  showcaseRace?: string;
}

// ─── Character Creation ────────────────────────────────────────────

export interface CharacterCreationConfig {
  startingGold: number;
  defaultRace?: string;
  defaultClass?: string;
  defaultGender?: string;
}

// ─── Emote Presets ─────────────────────────────────────────────────

export interface EmotePreset {
  label: string;
  emoji: string;
  action: string;
}

export interface EmotePresetsConfig {
  presets: EmotePreset[];
}

export interface RaceDefinitionConfig {
  displayName: string;
  description?: string;
  backstory?: string;
  traits?: string[];
  abilities?: string[];
  image?: string;
  statMods?: StatMap;
  bodyDescription?: string;
  staffPrompt?: string;
}

// ─── Player Tiers ───────────────────────────────────────────────────

export interface TierDefinitionConfig {
  displayName: string;
  levels: string;
  visualDescription: string;
}

// ─── Images ─────────────────────────────────────────────────────────

export interface ImagesConfig {
  baseUrl: string;
  spriteLevelTiers: number[];
}

// ─── World ──────────────────────────────────────────────────────────

export interface WorldConfig {
  startRoom: string;
  resources: string[];
}

// ─── Server ─────────────────────────────────────────────────────────

export interface ServerConfig {
  telnetPort: number;
  webPort: number;
}

// ─── Admin ──────────────────────────────────────────────────────────

export interface AdminServerConfig {
  enabled: boolean;
  port: number;
  token: string;
  basePath: string;
  grafanaUrl: string;
}

// ─── Observability ──────────────────────────────────────────────────

export interface ObservabilityConfig {
  metricsEnabled: boolean;
  metricsEndpoint: string;
  metricsHttpPort: number;
}

// ─── Logging ────────────────────────────────────────────────────────

export interface LoggingConfig {
  level: string;
  packageLevels: Record<string, string>;
}

// ─── Top-level config state ─────────────────────────────────────────

export interface AppConfig {
  server: ServerConfig;
  admin: AdminServerConfig;
  observability: ObservabilityConfig;
  logging: LoggingConfig;
  world: WorldConfig;
  classStartRooms: Record<string, string>;
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
  navigation: NavigationConfig;
  commands: Record<string, CommandEntryConfig>;
  group: GroupConfig;
  classes: Record<string, ClassDefinitionConfig>;
  races: Record<string, RaceDefinitionConfig>;
  characterCreation: CharacterCreationConfig;
  equipmentSlots: Record<string, EquipmentSlotDefinition>;
  genders: Record<string, GenderDefinition>;
  achievementCategories: Record<string, AchievementCategoryDefinition>;
  achievementCriterionTypes: Record<string, AchievementCriterionTypeDefinition>;
  achievementDefs: Record<string, AchievementDefFile>;
  questObjectiveTypes: Record<string, QuestObjectiveTypeDefinition>;
  questCompletionTypes: Record<string, QuestCompletionTypeDefinition>;
  statusEffectTypes: Record<string, StatusEffectTypeDefinition>;
  stackBehaviors: Record<string, StackBehaviorDefinition>;
  abilityTargetTypes: Record<string, AbilityTargetTypeDefinition>;
  craftingSkills: Record<string, CraftingSkillDefinition>;
  craftingStationTypes: Record<string, CraftingStationTypeDefinition>;
  guild: GuildConfig;
  guildRanks: Record<string, GuildRankDefinition>;
  friends: FriendsConfig;
  images: ImagesConfig;
  emotePresets: EmotePresetsConfig;
  globalAssets: Record<string, string>;
  playerTiers?: Record<string, TierDefinitionConfig>;
  /** Raw YAML content for unrecognized sections */
  rawSections: Record<string, unknown>;
}
