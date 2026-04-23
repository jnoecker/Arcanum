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

// ─── Pets / Companions ─────────────────────────────────────────────

export interface PetSpellConfig {
  displayName: string;
  message: string;
  roomMessage?: string;
  minDamage?: number;
  maxDamage?: number;
  healMin?: number;
  healMax?: number;
  cooldownMs?: number;
  weight?: number;
}

export interface PetDefinitionConfig {
  name: string;
  description?: string;
  hp: number;
  minDamage: number;
  maxDamage: number;
  armor: number;
  threatMultiplier?: number;
  spells?: Record<string, PetSpellConfig>;
  defaultAttack?: string;
  image?: string;
}

// ─── Abilities ──────────────────────────────────────────────────────

export interface AbilityEffectConfig {
  type: string;
  value?: number;
  statusEffectId?: string;
  minDamage?: number;
  maxDamage?: number;
  damagePerLevel?: number;
  minHeal?: number;
  maxHeal?: number;
  healPerLevel?: number;
  flatThreat?: number;
  margin?: number;
  petTemplateKey?: string;
  durationMs?: number;
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
  /** Skill tree this ability belongs to (e.g., "warrior_arms", "mage_fire") */
  tree?: string;
  /** Depth in the skill tree (0 = root, higher = deeper) */
  tier?: number;
  /** Ability IDs that must be learned before this one */
  prerequisites?: string[];
  /**
   * Skill points needed to learn this ability from a trainer.
   * Defaults to 1. A value of 0 means the ability auto-grants
   * once the player meets level, class, and prerequisite gates.
   */
  skillPointCost?: number;
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

export interface DiminishingXpThreshold {
  /** Minimum level difference (player - mob) for this threshold to apply. */
  levelsBelow: number;
  /** Multiplier applied to the mob's kill XP when this threshold wins. */
  multiplier: number;
}

export interface DiminishingXpConfig {
  enabled: boolean;
  /** Ordered lookup — the largest matching `levelsBelow` wins. */
  thresholds: DiminishingXpThreshold[];
}

export interface XpCurveConfig {
  baseXp: number;
  exponent: number;
  linearXp: number;
  multiplier: number;
  defaultKillXp: number;
  /** Optional diminishing-returns curve when a player over-levels a mob. */
  diminishing?: DiminishingXpConfig;
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
  /** Engine-computed XP for quests. Authors pick a difficulty tier; engine computes XP at completion. */
  quests?: QuestXpConfig;
}

export type QuestDifficulty = "trivial" | "easy" | "standard" | "hard" | "epic";

export const QUEST_DIFFICULTIES: QuestDifficulty[] = ["trivial", "easy", "standard", "hard", "epic"];

export const QUEST_DIFFICULTY_LABELS: Record<QuestDifficulty, string> = {
  trivial: "Trivial",
  easy: "Easy",
  standard: "Standard",
  hard: "Hard",
  epic: "Epic",
};

export const QUEST_DIFFICULTY_DESCRIPTIONS: Record<QuestDifficulty, string> = {
  trivial: "Fetch quests, tutorial steps. ~¼ of a standard reward.",
  easy: "Short side quests. Half of a standard reward.",
  standard: "Default pacing — baseline reward for the quest level.",
  hard: "Tough chains or boss fights. ~1.75× the standard reward.",
  epic: "Capstone / zone finale. ~3× the standard reward.",
};

export interface QuestBaselineConfig {
  baseXp: number;
  xpPerLevel: number;
}

export interface QuestXpConfig {
  baseline: QuestBaselineConfig;
  /** Per-tier XP multiplier applied on top of the baseline. */
  tiers: Partial<Record<QuestDifficulty, number>>;
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
  specializationXpBonus?: number;
}

// ─── Day/Night Cycle ───────────────────────────────────────────────

export interface WorldTimeConfig {
  cycleLengthMs: number;
  dawnHour: number;
  dayHour: number;
  duskHour: number;
  nightHour: number;
}

// ─── Weather ───────────────────────────────────────────────────────

export interface WeatherTypeDefinition {
  displayName: string;
  description?: string;
  weight: number;
  particleHint?: string;
  icon?: string;
}

export interface WeatherConfig {
  minTransitionMs: number;
  maxTransitionMs: number;
  types: Record<string, WeatherTypeDefinition>;
}

// ─── Environment Themes ───────────────────────────────────────────

export interface MoteColor {
  core: string;
  glow: string;
}

export interface SkyGradient {
  top: string;
  bottom: string;
}

export type TimePeriod = "DAWN" | "DAY" | "DUSK" | "NIGHT";

export interface EnvironmentTheme {
  moteColors: MoteColor[];
  skyGradients: Partial<Record<TimePeriod, SkyGradient>>;
  transitionColors: string[];
  weatherParticleOverrides?: Record<string, string>;
}

export interface EnvironmentConfig {
  defaultTheme: EnvironmentTheme;
  zones: Record<string, Partial<EnvironmentTheme>>;
}

// ─── Seasonal Events ───────────────────────────────────────────────

export interface WorldEventDefinitionConfig {
  displayName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  flags?: string[];
  startMessage?: string;
  endMessage?: string;
}

export interface WorldEventsConfig {
  definitions: Record<string, WorldEventDefinitionConfig>;
}

// ─── Skill Points ─────────────────────────────────────────────────

export interface SkillPointsConfig {
  interval: number;
}

// ─── Multiclass ───────────────────────────────────────────────────

export interface MulticlassConfig {
  minLevel: number;
  goldCost: number;
}

// ─── Bank ──────────────────────────────────────────────────────────

export interface BankConfig {
  maxItems: number;
}

// ─── Enchanting ────────────────────────────────────────────────────

export interface EnchantmentMaterialConfig {
  itemId: string;
  quantity: number;
}

export interface EnchantmentDefinitionConfig {
  displayName: string;
  skill: string;
  skillRequired: number;
  materials: EnchantmentMaterialConfig[];
  statBonuses?: Record<string, number>;
  damageBonus?: number;
  armorBonus?: number;
  targetSlots?: string[];
  xpReward: number;
}

export interface EnchantingConfig {
  maxEnchantmentsPerItem: number;
  definitions: Record<string, EnchantmentDefinitionConfig>;
}

// ─── Factions ──────────────────────────────────────────────────────

export interface FactionDefinition {
  name: string;
  description?: string;
  enemies?: string[];
}

export interface ReputationTier {
  /** Stable ID used in data (e.g. "honored"). */
  id: string;
  /** Display label (e.g. "Honored"). */
  label: string;
  /** Minimum reputation (inclusive) for a player to be in this tier. */
  minReputation: number;
}

/**
 * Default reputation tiers. IDs are stable; labels and thresholds can be
 * overridden per-project. The floor tier's minReputation is the absolute
 * minimum rep the MUD will allow.
 */
export const DEFAULT_REPUTATION_TIERS: ReputationTier[] = [
  { id: "hated", label: "Hated", minReputation: -20000 },
  { id: "hostile", label: "Hostile", minReputation: -1000 },
  { id: "unfriendly", label: "Unfriendly", minReputation: -500 },
  { id: "neutral", label: "Neutral", minReputation: 0 },
  { id: "friendly", label: "Friendly", minReputation: 250 },
  { id: "honored", label: "Honored", minReputation: 1000 },
  { id: "revered", label: "Revered", minReputation: 5000 },
  { id: "exalted", label: "Exalted", minReputation: 20000 },
];

export interface FactionConfig {
  defaultReputation: number;
  killPenalty: number;
  killBonus: number;
  definitions: Record<string, FactionDefinition>;
  questRewards?: Record<string, Record<string, number>>;
  /** Named reputation bands, ordered low→high. Omitted for the built-in default set. */
  tiers?: ReputationTier[];
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
  x?: number;  // Paper-doll X position (0-100%)
  y?: number;  // Paper-doll Y position (0-100%)
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

// ─── Housing ───────────────────────────────────────────────────────

export interface HousingTemplateDefinition {
  title: string;
  description: string;
  cost: number;
  isEntry?: boolean;
  image?: string;
  maxDroppedItems?: number;
  safe?: boolean;
  station?: string;
}

export interface HousingConfig {
  enabled: boolean;
  entryExitDirection: string;
  templates: Record<string, HousingTemplateDefinition>;
}

// ─── Friends ────────────────────────────────────────────────────────

export interface FriendsConfig {
  maxFriends: number;
}

// ─── Guild Ranks ────────────────────────────────────────────────────

export interface GuildConfig {
  founderRank: string;
  defaultRank: string;
  maxSize?: number;
  inviteTimeoutMs?: number;
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

// ─── Images ─────────────────────────────────────────────────────────

export interface ImagesConfig {
  baseUrl: string;
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
  productionMode?: boolean;
  inboundChannelCapacity: number;
  outboundChannelCapacity: number;
  sessionOutboundQueueCapacity: number;
  maxInboundEventsPerTick: number;
  tickMillis: number;
  inboundBudgetMs: number;
}

// ─── Deployment mode ───────────────────────────────────────────────

export type DeploymentMode = "STANDALONE" | "ENGINE" | "GATEWAY";

// ─── Persistence ───────────────────────────────────────────────────

export type PersistenceBackend = "YAML" | "POSTGRES";

export interface PersistenceWorkerConfig {
  enabled: boolean;
  flushIntervalMs: number;
}

export interface PersistenceConfig {
  backend: PersistenceBackend;
  rootDir: string;
  worker: PersistenceWorkerConfig;
}

// ─── Login ─────────────────────────────────────────────────────────

export interface LoginConfig {
  maxWrongPasswordRetries: number;
  maxFailedAttemptsBeforeDisconnect: number;
  maxConcurrentLogins: number;
  authThreads: number;
}

// ─── Transport ─────────────────────────────────────────────────────

export interface TelnetTransportConfig {
  maxLineLen: number;
  maxNonPrintablePerLine: number;
  socketBacklog: number;
  maxConnections: number;
}

export interface WebSocketTransportConfig {
  host: string;
  stopGraceMillis: number;
  stopTimeoutMillis: number;
}

export interface TransportConfig {
  telnet: TelnetTransportConfig;
  websocket: WebSocketTransportConfig;
  maxInboundBackpressureFailures: number;
}

// ─── Demo ──────────────────────────────────────────────────────────

export interface DemoConfig {
  autoLaunchBrowser: boolean;
  webClientHost: string;
  webClientUrl: string | null;
}

// ─── Database ──────────────────────────────────────────────────────

export interface DatabaseConfig {
  jdbcUrl: string;
  username: string;
  password: string;
  maxPoolSize: number;
  minimumIdle: number;
}

// ─── Redis ─────────────────────────────────────────────────────────

export interface RedisBusConfig {
  enabled: boolean;
  inboundChannel: string;
  outboundChannel: string;
  instanceId: string;
  sharedSecret: string;
}

export interface RedisConfig {
  enabled: boolean;
  uri: string;
  cacheTtlSeconds: number;
  bus: RedisBusConfig;
}

// ─── gRPC ──────────────────────────────────────────────────────────

export interface GrpcServerConfig {
  port: number;
  controlPlaneSendTimeoutMs: number;
}

export interface GrpcClientConfig {
  engineHost: string;
  enginePort: number;
}

export interface GrpcConfig {
  server: GrpcServerConfig;
  client: GrpcClientConfig;
  sharedSecret: string;
  allowPlaintext: boolean;
  timestampToleranceMs: number;
}

// ─── Gateway ───────────────────────────────────────────────────────

export interface SnowflakeConfig {
  idLeaseTtlSeconds: number;
}

export interface GatewayReconnectConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  streamVerifyMs: number;
}

export interface GatewayEngineEntry {
  host: string;
  port: number;
}

export interface GatewayConfig {
  id: number;
  snowflake: SnowflakeConfig;
  reconnect: GatewayReconnectConfig;
  engines: GatewayEngineEntry[];
  startZone: string;
}

// ─── Sharding ──────────────────────────────────────────────────────

export interface ShardingRegistryConfig {
  type: string;
  leaseTtlSeconds: number;
  assignments: string[];
}

export interface ShardingHandoffConfig {
  ackTimeoutMs: number;
}

export interface PlayerIndexConfig {
  enabled: boolean;
  heartbeatMs: number;
}

export interface AutoScaleConfig {
  enabled: boolean;
  evaluationIntervalMs: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownMs: number;
}

export interface InstanceConfig {
  enabled: boolean;
  defaultCapacity: number;
  loadReportIntervalMs: number;
  startZoneMinInstances: number;
  autoScale: AutoScaleConfig;
}

export interface ShardingConfig {
  enabled: boolean;
  engineId: string;
  zones: string[];
  registry: ShardingRegistryConfig;
  handoff: ShardingHandoffConfig;
  advertiseHost: string;
  advertisePort: number | null;
  playerIndex: PlayerIndexConfig;
  instancing: InstanceConfig;
}

// ─── Admin ──────────────────────────────────────────────────────────

export interface AdminServerConfig {
  enabled: boolean;
  port: number;
  token: string;
  basePath: string;
  grafanaUrl: string;
  corsOrigins?: string[];
}

// ─── Observability ──────────────────────────────────────────────────

export interface ObservabilityConfig {
  metricsEnabled: boolean;
  metricsEndpoint: string;
  metricsHttpPort: number;
  metricsHttpHost?: string;
  staticTags?: Record<string, string>;
}

// ─── Logging ────────────────────────────────────────────────────────

export interface LoggingConfig {
  level: string;
  packageLevels: Record<string, string>;
}

// ─── Prestige ──────────────────────────────────────────────────────

export interface PrestigePerkConfig {
  type: string; // "STAT_BONUS" | "SKILL_POINT" | "TITLE" | "MAX_HP" | "MAX_MANA"
  stat?: string;
  amount?: number;
  title?: string;
  description?: string;
}

export interface PrestigeConfig {
  enabled: boolean;
  xpCostBase: number;
  xpCostMultiplier: number;
  maxRank: number;
  perks: Record<string, PrestigePerkConfig>;
}

// ─── Respec ────────────────────────────────────────────────────────

export interface RespecConfig {
  enabled?: boolean;
  goldCost: number;
  cooldownMs: number;
}

// ─── Currencies ────────────────────────────────────────────────────

export interface CurrencyDefinition {
  displayName: string;
  abbreviation?: string;
  description?: string;
  maxAmount?: number;
}

export interface CurrenciesConfig {
  definitions: Record<string, CurrencyDefinition>;
  honorPerPvpKill?: number;
  tokensPerCraft?: number;
}

// ─── Lottery ───────────────────────────────────────────────────────

export interface LotteryConfig {
  enabled: boolean;
  ticketCost: number;
  drawingIntervalMs: number;
  jackpotSeedGold: number;
  jackpotPercentFromTickets?: number;
  maxTicketsPerPlayer?: number;
  jackpotBase?: number;
}

// ─── Gambling ──────────────────────────────────────────────────────

export interface GamblingConfig {
  enabled: boolean;
  diceMinBet: number;
  diceMaxBet: number;
  diceWinChance: number;
  diceWinMultiplier: number;
  cooldownMs?: number;
  minBet?: number;
  maxBet?: number;
  winChance?: number;
  winMultiplier?: number;
}

// ─── Stylist ───────────────────────────────────────────────────────

export interface StylistConfig {
  feeGold: number;
}

// ─── Auto Quests (Bounties) ────────────────────────────────────────

export interface AutoQuestsConfig {
  enabled: boolean;
  timeLimitMs: number;
  cooldownMs: number;
  rewardGoldBase?: number;
  rewardGoldPerLevel?: number;
  rewardXpBase?: number;
  rewardXpPerLevel?: number;
  killCountMin?: number;
  killCountMax?: number;
}

export interface DailyQuestDefinition {
  type: string;
  targetCount?: number;
  description?: string;
  goldReward?: number;
  xpReward?: number;
}

// ─── Daily/Weekly Quests ───────────────────────────────────────────

export interface DailyQuestsConfig {
  enabled: boolean;
  resetHourUtc?: number;
  dailySlots?: number;
  weeklySlots?: number;
  streakBonusPercent: number;
  streakMaxDays?: number;
  dailyPool?: DailyQuestDefinition[];
  weeklyPool?: DailyQuestDefinition[];
  resetTimeUtc?: string;
  pools?: Record<string, string[]>;
}

export interface GlobalQuestObjectiveConfig {
  type: string;
  targetCount?: number;
  description?: string;
}

// ─── Global Quests ─────────────────────────────────────────────────

export interface GlobalQuestsConfig {
  enabled: boolean;
  intervalMs: number;
  durationMs: number;
  announceIntervalMs?: number;
  minPlayersOnline?: number;
  rewardGoldFirst?: number;
  rewardGoldSecond?: number;
  rewardGoldThird?: number;
  rewardXpFirst?: number;
  rewardXpSecond?: number;
  rewardXpThird?: number;
  objectives?: GlobalQuestObjectiveConfig[];
  rewards?: Record<string, unknown>;
}

// ─── Guild Halls ───────────────────────────────────────────────────

export interface GuildHallRoomTemplate {
  title?: string;
  displayName?: string;
  description: string;
  cost?: number;
  hasStorage?: boolean;
}

export interface GuildHallsConfig {
  enabled: boolean;
  purchaseCost?: number;
  roomCost?: number;
  maxRooms?: number;
  templates?: Record<string, GuildHallRoomTemplate>;
  baseCost?: number;
  roomTemplates?: Record<string, GuildHallRoomTemplate>;
}

export interface LeaderboardConfig {
  refreshIntervalMs: number;
  topN: number;
}

// ─── Top-level config state ─────────────────────────────────────────

export interface AppConfig {
  mode: DeploymentMode;
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
  housing: HousingConfig;
  guild: GuildConfig;
  guildRanks: Record<string, GuildRankDefinition>;
  friends: FriendsConfig;
  images: ImagesConfig;
  emotePresets: EmotePresetsConfig;
  factions?: FactionConfig;
  enchanting: EnchantingConfig;
  skillPoints: SkillPointsConfig;
  multiclass: MulticlassConfig;
  bank: BankConfig;
  worldTime: WorldTimeConfig;
  weather: WeatherConfig;
  environment: EnvironmentConfig;
  worldEvents: WorldEventsConfig;
  pets: Record<string, PetDefinitionConfig>;
  prestige?: PrestigeConfig;
  respec?: RespecConfig;
  currencies?: CurrenciesConfig;
  lottery?: LotteryConfig;
  gambling?: GamblingConfig;
  stylist?: StylistConfig;
  autoQuests?: AutoQuestsConfig;
  dailyQuests?: DailyQuestsConfig;
  globalQuests?: GlobalQuestsConfig;
  guildHalls?: GuildHallsConfig;
  leaderboard?: LeaderboardConfig;
  globalAssets: Record<string, string>;
  defaultAssets: Record<string, string>;
  persistence: PersistenceConfig;
  login: LoginConfig;
  transport: TransportConfig;
  demo: DemoConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  grpc: GrpcConfig;
  gateway: GatewayConfig;
  sharding: ShardingConfig;
  /** Raw YAML content for unrecognized sections */
  rawSections: Record<string, unknown>;
}
