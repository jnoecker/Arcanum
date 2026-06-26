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
  /**
   * Multiplicative bonus per stat point above the stat's baseStat. Compounds
   * with level via the level-scaling rate, so keep this modest.
   */
  meleeStatMultiplier: number;
  /**
   * Per-level multiplicative growth applied to (attackPower + statBonus).
   * Mirror this with `progression.rewards.hpScalingRate` so player damage
   * and player HP track each other across the curve.
   */
  meleeLevelScalingRate: number;
  /** Multiplicative variance band applied to each swing's core damage. */
  meleeVarianceMin: number;
  meleeVarianceMax: number;
  /**
   * Floor attack power for the basic swing — keeps unarmed damage non-zero
   * and gives equipped weapons a strictly-better target to clear.
   * Final attackPower is `meleeBaseAttackPower + equipmentAttack`.
   */
  meleeBaseAttackPower: number;
  /**
   * Half-mitigation constant for multiplicative armor:
   *   mitigation = armor / (armor + meleeArmorMitigationK)
   * At K=20, armor 5 ≈ 20% reduction, armor 20 ≈ 50%. Self-scaling — armor
   * stays meaningful at every level.
   */
  meleeArmorMitigationK: number;
  dodgeStat: string;
  dodgePerPoint: number;
  maxDodgePercent: number;
  /**
   * Spell damage school. Same shape as melee minus armor — spells bypass
   * physical mitigation. The "attackPower" anchor for a given ability is
   * the midpoint of its authored `effect.minDamage`/`maxDamage`; per-ability
   * `damagePerLevel` has been removed in favor of `spellLevelScalingRate`.
   */
  spellDamageStat: string;
  spellStatMultiplier: number;
  spellLevelScalingRate: number;
  spellVarianceMin: number;
  spellVarianceMax: number;
  /**
   * Healing school. Mirrors spell damage but anchored on the ability's
   * `effect.minHeal`/`maxHeal` midpoint. Default stat is WIS so dedicated
   * healers don't compete with INT casters for a single scaling stat.
   */
  healStat: string;
  healStatMultiplier: number;
  healLevelScalingRate: number;
  healVarianceMin: number;
  healVarianceMax: number;
  /**
   * Buff school — reserved scaling lane for utility / support classes
   * (bard, herald). The config fields exist now so the wiring has a
   * defined home, but `ApplyStatus` duration/magnitude does not yet
   * consume them server-side.
   */
  buffStat: string;
  buffDurationPerStat: number;
  buffMagnitudePerStat: number;
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

/**
 * A single "school" of attack-shaped damage. Captures the curve and binding
 * knobs that drive a basic-attack roll. Melee is the only school populated
 * today; spell damage / heal / utility schools will follow the same shape
 * when the server reworks ability scaling.
 */
export interface DamageSchool {
  statId: string;
  statMultiplier: number;
  levelScalingRate: number;
  varianceMin: number;
  varianceMax: number;
  baseAttackPower: number;
  mitigationK: number;
}

/** Pull the melee `DamageSchool` out of the stat bindings. */
export function extractMeleeSchool(bindings: StatBindings): DamageSchool {
  return {
    statId: bindings.meleeDamageStat,
    statMultiplier: bindings.meleeStatMultiplier,
    levelScalingRate: bindings.meleeLevelScalingRate,
    varianceMin: bindings.meleeVarianceMin,
    varianceMax: bindings.meleeVarianceMax,
    baseAttackPower: bindings.meleeBaseAttackPower,
    mitigationK: bindings.meleeArmorMitigationK,
  };
}

/**
 * Pull the spell `DamageSchool` out of the bindings. Spells bypass armor
 * (`mitigationK: 0`) and don't have a flat `baseAttackPower` — the caller
 * passes the ability's authored damage anchor as `attackPower`.
 */
export function extractSpellSchool(bindings: StatBindings): DamageSchool {
  return {
    statId: bindings.spellDamageStat,
    statMultiplier: bindings.spellStatMultiplier,
    levelScalingRate: bindings.spellLevelScalingRate,
    varianceMin: bindings.spellVarianceMin,
    varianceMax: bindings.spellVarianceMax,
    baseAttackPower: 0,
    mitigationK: 0,
  };
}

/**
 * Pull the heal `DamageSchool` out of the bindings. Heals have no enemy
 * defense to mitigate against; the caller passes the ability's authored
 * heal anchor as `attackPower`.
 */
export function extractHealSchool(bindings: StatBindings): DamageSchool {
  return {
    statId: bindings.healStat,
    statMultiplier: bindings.healStatMultiplier,
    levelScalingRate: bindings.healLevelScalingRate,
    varianceMin: bindings.healVarianceMin,
    varianceMax: bindings.healVarianceMax,
    baseAttackPower: 0,
    mitigationK: 0,
  };
}

// ─── Pets / Companions ─────────────────────────────────────────────

export interface PetSpellConfig {
  displayName: string;
  message: string;
  roomMessage?: string;
  /**
   * Spell damage as a multiple of the pet's already-scaled melee swing.
   * 1.0 = same as a normal swing; 2.0 = twice as hard. Wins over
   * `minDamage`/`maxDamage` when set, so spells inherit level/gear scaling.
   */
  damageRatio?: number;
  /** Heal as a fraction of the owner's maxHp. Wins over `healMin`/`healMax` when set. */
  healRatio?: number;
  /** Absolute fallback damage range, used when `damageRatio` is null. */
  minDamage?: number;
  maxDamage?: number;
  /** Absolute fallback heal range, used when `healRatio` is null. */
  healMin?: number;
  healMax?: number;
  statusEffectId?: string;
  cooldownMs?: number;
  weight?: number;
  /**
   * Flat threat added on cast. Only useful when the parent pet has
   * threatMultiplier > 0; on DPS pets this falls onto the owner's threat
   * entry, which is rarely intended.
   */
  threatBonus?: number;
  /** Icon shown in the player UI for manual triggering. */
  image?: string;
}

export interface PetDefinitionConfig {
  name: string;
  description?: string;
  /** Pet HP as a fraction of the owner's effective maxHp. 1.0 = same as owner. */
  hpRatio: number;
  /** Pet melee damage as a fraction of the owner's displayed damage range. */
  damageRatio: number;
  /** Pet armor as a fraction of the owner's equipped armor. */
  armorRatio: number;
  /** Floor applied to scaled HP. Also used when no owner stats are available. */
  baseHp: number;
  /** Floor applied to scaled min damage. */
  baseMinDamage: number;
  /** Floor applied to scaled max damage. */
  baseMaxDamage: number;
  /** Floor applied to scaled armor. */
  baseArmor: number;
  threatMultiplier?: number;
  spells?: Record<string, PetSpellConfig>;
  defaultAttack?: string;
  image?: string;
}

/** Top-level pet configuration (siblings of `pets.definitions`). */
export interface PetsTopLevelConfig {
  /** Auto-cast suppression window after a manual skill trigger. Default: 8000ms. */
  manualSkillGraceMs?: number;
  /** Global cap on per-template `hpRatio`. */
  maxHpRatio?: number;
  /** Global cap on per-template `damageRatio`. */
  maxDamageRatio?: number;
  /** Global cap on per-template `armorRatio`. */
  maxArmorRatio?: number;
}

// ─── Abilities ──────────────────────────────────────────────────────

export interface AbilityEffectConfig {
  type: string;
  statusEffectId?: string;
  /**
   * Authored damage range. The server scales this via the global
   * `spellLevelScalingRate` / `spellStatMultiplier`; per-ability
   * `damagePerLevel` has been removed in favor of the unified curve.
   */
  minDamage?: number;
  maxDamage?: number;
  /**
   * Authored heal range. Scaled by `healLevelScalingRate` /
   * `healStatMultiplier`; per-ability `healPerLevel` has been removed.
   */
  minHeal?: number;
  maxHeal?: number;
  flatThreat?: number;
  margin?: number;
  petTemplateKey?: string;
  durationMs?: number;
  /**
   * Child effects when `type` is `"COMPOSITE"`. The ability pays mana/cooldown
   * once and every child resolves against the same primary target. The server
   * flattens nested composites at parse time; the editor authors flat lists
   * (see `lib/abilityEffects.ts`).
   */
  effects?: AbilityEffectConfig[];
}

/**
 * Combat-canvas visuals for the cast moment of an ability. Archetype drives
 * the animation kind (projectile / aura / burst / etc.). All fields are
 * optional: leave `archetype` blank for server-side auto-derivation from
 * effect + target + class. `projectileImage` falls back to the ability's
 * spellbook icon, and the colors fall back to per-archetype defaults.
 */
export type AbilityVisualArchetype =
  | "RANGED_PROJECTILE"
  | "MELEE_STRIKE"
  | "HEAL_AURA"
  | "BUFF_AURA"
  | "DEBUFF_AURA"
  | "AREA_BURST"
  | "SUMMON_POOF";

export interface AbilityVisualConfig {
  archetype?: AbilityVisualArchetype | "";
  projectileImage?: string;
  color?: string;
  accentColor?: string;
}

export interface AbilityDefinitionConfig {
  displayName: string;
  description?: string;
  /** Percent of the ability-level base mana pool spent per cast. */
  manaCostPct: number;
  /** @deprecated Legacy flat mana cost, migrated to manaCostPct on load. */
  manaCost?: number;
  cooldownMs: number;
  levelRequired: number;
  targetType: string;
  effect: AbilityEffectConfig;
  requiredClass?: string;
  classRestriction?: string;
  image?: string;
  /** Combat-canvas visuals (cast animation). See {@link AbilityVisualConfig}. */
  visual?: AbilityVisualConfig;
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
  /**
   * Who wields this ability. When omitted, falls back to "player" if a
   * `requiredClass` is set, otherwise "creature". Set explicitly to
   * disambiguate creature powers without a `requiredClass`.
   */
  scope?: "player" | "creature";
}

/** Resolve the effective scope of an ability, honoring the explicit field
 *  when set and otherwise inferring from `requiredClass`. */
export function abilityScope(ability: AbilityDefinitionConfig): "player" | "creature" {
  if (ability.scope) return ability.scope;
  return ability.requiredClass || ability.classRestriction ? "player" : "creature";
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
  feedback: {
    enabled: boolean;
    roomBroadcastEnabled: boolean;
  };
}

// ─── Mob Tiers ──────────────────────────────────────────────────────

export interface MobTierConfig {
  baseHp: number;
  /** Per-level multiplicative growth rate. 1.1 means HP grows ~10% per level. */
  hpScalingRate: number;
  baseMinDamage: number;
  baseMaxDamage: number;
  /** Per-level multiplicative growth rate for both min and max damage. */
  damageScalingRate: number;
  baseArmor: number;
  baseXpReward: number;
  /** Per-level multiplicative growth rate for kill XP. */
  xpScalingRate: number;
  baseGoldMin: number;
  baseGoldMax: number;
  /** Per-level multiplicative growth rate for both gold min and max. */
  goldScalingRate: number;
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
  /** Per-level multiplicative growth rate for max HP. 1.1 means ~10% per level. */
  hpScalingRate: number;
  /** Per-level multiplicative growth rate for max mana. */
  manaScalingRate: number;
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
  regenPercent: number;
  inCombatMultiplier: number;
  /** Regen multiplier applied in inn rooms (hp5/mp5 boost). Must be >= 1.0. Default 2.0. */
  innMultiplier: number;
  mana: {
    baseIntervalMillis: number;
    minIntervalMillis: number;
    regenPercent: number;
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

// ─── Seasons ───────────────────────────────────────────────────────

export interface SeasonConfig {
  /**
   * Real-time milliseconds for one full game year (all four seasons). Each
   * season lasts a quarter of this.
   */
  cycleLengthMs: number;
}

// ─── Rare Mob Variants ─────────────────────────────────────────────

/**
 * A single server-generated rare variant archetype. Cosmetic (tint + overlay +
 * name prefix) plus a modest stat bump. Mirrors the server's
 * `MobVariantDefinition`.
 */
export interface MobVariantDefinition {
  displayName?: string;
  /** Prepended to the base mob name, e.g. "Shadow-touched ". */
  namePrefix?: string;
  /** CSS hex tint applied to the client sprite (multiply). Empty = no tint. */
  tint?: string;
  /** Client particle/overlay hint: swirl|embers|sparkle|frost|mist. Empty = none. */
  overlay?: string;
  /** uncommon|rare|legendary — flavor + default announce loudness. */
  rarity?: string;
  /** Relative selection weight among all variants. Higher = more common. */
  weight: number;
  hpMultiplier?: number;
  xpMultiplier?: number;
  /** Multiplies drop chances (and gold) for this variant. */
  lootMultiplier?: number;
  /** Announcement scope on appearance: ROOM|ZONE|SERVER. */
  announce?: string;
}

export interface MobVariantsConfig {
  enabled: boolean;
  /**
   * Base probability that an eligible mob rolls as a rare variant on each
   * dynamic spawn opportunity (zone reset, post-death respawn, conditional
   * spawn). Cold-start spawns are never rolled.
   */
  chance: number;
  /**
   * Variant archetypes keyed by ID, selected by weight. Empty = the server's
   * built-in palette (albino, verdant, shadow, ember, …) is used.
   */
  variants: Record<string, MobVariantDefinition>;
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
  /**
   * Hard cap on the player's total unlocked classes (including the starter class).
   * Defaults to effectively unlimited so existing worlds keep working unchanged.
   */
  maxClasses: number;
  /**
   * Exponential multiplier applied per additional class beyond the first trainer unlock.
   * Cost for the Nth trainer unlock is `goldCost * goldCostMultiplier^(N-1)`. Default
   * 1.0 keeps the cost flat (no-op).
   */
  goldCostMultiplier: number;
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
  /** Informational allies — for the relationship graph only. Does not
   *  affect reputation or combat. */
  allies?: string[];
  /** Heraldic accent color (hex like "#abcdef"). Used on the rivalry map
   *  and as the badge ring in the allegiance list. */
  color?: string;
  /** Sigil / emblem image (asset hash filename). Renders in place of the
   *  default compass rose. */
  image?: string;
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

// ─── Death / Sanctum ───────────────────────────────────────────────

export interface DeathMessagesConfig {
  arriveSanctum: string;
  departNoSanctum: string;
  departNoDeath: string;
  departBegin: string;
  departUnreachable: string;
}

export interface DeathConfig {
  /** Fully-qualified "zone:room" sanctum room. Empty falls back to the dead player's zone start. */
  sanctumRoom: string;
  /** Fraction of maxHp restored on respawn. Server clamps to [0.05, 1.0]. */
  respawnHpFraction: number;
  /** Fraction of maxMana restored on respawn. Server clamps to [0.0, 1.0]. */
  respawnManaFraction: number;
  /** Fraction of current xpTotal deducted on death. Server clamps to [0.0, 0.5]. 0 = no penalty. */
  xpPenaltyFraction: number;
  messages: DeathMessagesConfig;
}

// ─── Commands ──────────────────────────────────────────────────────

export interface CommandEntryConfig {
  usage: string;
  /** Shown to players in the in-game help output. */
  description?: string;
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
  /** Per-level multiplicative growth rate this class contributes to max HP. */
  hpScalingRate: number;
  /** Per-level multiplicative growth rate this class contributes to max mana. */
  manaScalingRate: number;
  primaryStat?: string;
  /**
   * Ordered stat IDs from most to least valued for this class. Used to resolve
   * archetypal item stats (`PRIMARY`/`SECONDARY`/`TERTIARY` in a StatMap) at
   * equip time:
   *   PRIMARY   → statPriorities[0]
   *   SECONDARY → statPriorities[1]
   *   TERTIARY  → statPriorities[2]
   *
   * Provide at least three entries to fully support adaptive items. When this
   * field is empty or missing, the server falls back to `[primaryStat]` —
   * which leaves SECONDARY/TERTIARY unresolvable (items using them silently
   * drop those bonuses for this class).
   *
   * Example for a Wizard: `["intelligence", "wisdom", "constitution"]`.
   */
  statPriorities?: string[];
  selectable?: boolean;
  startRoom?: string;
  threatMultiplier?: number;
  image?: string;
  outfitDescription?: string;
  showcaseRace?: string;
  /**
   * Items granted to a new character of this class at creation. Order is
   * preserved. `equip: false` keeps the item in inventory; omitted/true asks
   * the server to equip it (no-op for items without a slot).
   */
  starterEquipment?: StarterEquipmentEntry[];
}

export interface StarterEquipmentEntry {
  itemId: string;
  equip?: boolean;
}

// ─── Character Creation ────────────────────────────────────────────

export interface CharacterCreationConfig {
  startingGold: number;
  defaultRace?: string;
  defaultClass?: string;
  defaultGender?: string;
  /** When true, new players can join as a one-tap demo character with a random
   *  name. They can later claim the account by setting a password. */
  demoEnabled?: boolean;
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
  /**
   * Verbatim directive appended to every sprite prompt for this race
   * (e.g. "NO FACE NO HUMAN FACE" for faceless ancestries). Bypasses the
   * LLM paraphrase step that goes through `bodyDescription` → template, so
   * it survives literally into the FLUX prompt. Keep it short — long
   * addenda compete with the subject description for token weight.
   */
  imagePromptDirective?: string;
  staffPrompt?: string;
  /** Whether this race appears in character creation. Defaults to true when
   *  omitted. Mirrors the same field on `ClassDefinitionConfig`. */
  selectable?: boolean;
  /** Optional race-specific passive ability (low-health / lethal-blow trigger). */
  racialAbility?: RacialAbilityConfig;
}

/**
 * The distinct race-specific passive ability mechanics. Each `kind` selects one bespoke
 * behaviour resolved by the server's `RacialAbilitySystem`; the remaining fields on
 * `RacialAbilityConfig` are read only by the kinds that use them. Mirrors the server's
 * `RacialAbilityKind` enum — keep in sync.
 */
export const RACIAL_ABILITY_KINDS = [
  "PYRAE_IMMOLATE",
  "LUSTRIAE_TIMESLIP",
  "AURELIA_DAZZLE",
  "LITHAE_STONEFORM",
  "MYCORAE_SPORES",
  "KITSARAE_REVERSAL",
  "ARCHAE_DRENGARIAE",
  "OPHIRAE_WRATH",
  "AETHERAE_PHASE",
] as const;

export type RacialAbilityKind = (typeof RACIAL_ABILITY_KINDS)[number];

/** Which combat hook fires a racial ability. */
export type RacialTrigger = "LOW_HEALTH" | "LETHAL_BLOW";

/** Maps each ability kind to the combat hook that fires it. Mirrors the server enum. */
export const RACIAL_ABILITY_TRIGGERS: Record<RacialAbilityKind, RacialTrigger> = {
  PYRAE_IMMOLATE: "LOW_HEALTH",
  LUSTRIAE_TIMESLIP: "LETHAL_BLOW",
  AURELIA_DAZZLE: "LOW_HEALTH",
  LITHAE_STONEFORM: "LETHAL_BLOW",
  MYCORAE_SPORES: "LOW_HEALTH",
  KITSARAE_REVERSAL: "LETHAL_BLOW",
  ARCHAE_DRENGARIAE: "LOW_HEALTH",
  OPHIRAE_WRATH: "LOW_HEALTH",
  AETHERAE_PHASE: "LETHAL_BLOW",
};

/**
 * Tunable knobs for a race's passive ability. `kind` selects the mechanic; the remaining
 * fields are read only by the kinds that use them and keep harmless defaults otherwise.
 * Mirrors the server's `RacialAbilityConfig`.
 */
export interface RacialAbilityConfig {
  kind: RacialAbilityKind;
  displayName?: string;
  /** Player-facing explanation of what the ability does, surfaced in the spellbook. */
  description?: string;
  /** Spellbook icon: a raw image filename resolved against the images base URL when emitted. */
  image?: string;
  /** Cooldown before the ability can fire again, in milliseconds. */
  cooldownMs?: number;
  /** LOW_HEALTH only: fires once the player's HP is at or below this percent (1..100) of max. */
  triggerHealthPct?: number;
  /** Pyrae: AoE damage dealt to each enemy, as a fraction of the player's max HP. */
  aoeDamagePctOfMaxHp?: number;
  /** Ophirae: outgoing-damage multiplier while the wrath buff is active. */
  damageMultiplier?: number;
  /** Ophirae: how long the wrath buff lasts, in milliseconds. */
  buffDurationMs?: number;
  /** Aurelia: status-effect id (of effectType "stun") applied to enemies. */
  stunStatusId?: string;
  /** Mycorae/Archae: pet template key to summon. */
  petTemplateKey?: string;
  /** Mycorae: inclusive lower bound on the number of pets spawned. */
  petCountMin?: number;
  /** Mycorae: inclusive upper bound on the number of pets spawned. */
  petCountMax?: number;
  /** Mycorae/Archae: how long the summoned pets live before despawning, in milliseconds. */
  petDurationMs?: number;
  /** Lithae: HP restored on entering stone form, as a fraction of max HP. */
  regenPctOfMaxHp?: number;
  /** Lithae: status-effect id (of effectType "root") applied to self so the player can't move. */
  stoneStatusId?: string;
  /** Lithae: how long the player stays untargetable in stone form, in milliseconds. */
  stoneDurationMs?: number;
  /** Aetherae: number of combat rounds the player stays phased/untargetable after the blow. */
  phaseTicks?: number;
  /** Message shown to the triggering player. */
  selfMessage?: string;
  /** Message broadcast to others in the room ({player} is substituted). */
  roomMessage?: string;
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
  maxConnections: number;
  maxConnectionsPerIp: number;
  pingPeriodMillis: number;
  pongTimeoutMillis: number;
  maxFrameBytes: number;
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
  host: string;
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

// ─── Akathavae (pacifist explorer path) ────────────────────────────

/**
 * Tuning for the Akathavae pledge — the pacifist explorer path. Mirrors the
 * server's `ambonMUD.engine.akathavae` block. Pledging is free at a shrine
 * (`akathavaeShrine` room flag); renouncing costs gold and gates a re-pledge
 * cooldown. Illumination replaces combat: a stat-driven attempt to record a
 * creature in the player's Arcanum.
 */
export interface AkathavaeConfig {
  enabled: boolean;
  /** Gold cost to renounce the pledge at a shrine. */
  renounceCostGold: number;
  /** Real-time cooldown before an ex-Akathavae may pledge again (ms). Default 24h. */
  repledgeCooldownMs: number;
  /** Base chance (percent) that an illumination success roll passes before stat/level adjustments. */
  illuminateBaseSuccessPct: number;
  /** Stat that improves illumination success chance. */
  successStat: string;
  /** Success-chance percent gained per successStat point above base (10). */
  successPerStatPoint: number;
  /** Success-chance percent lost per level the subject is above the player. */
  levelGapPenaltyPct: number;
  /** Stat that shrinks the level-gap penalty. */
  gapReliefStat: string;
  /** Gap-penalty percent (per subject level) removed per gapReliefStat point above base. */
  gapReliefPerStatPoint: number;
  /** Success chance is clamped into [minSuccessPct, maxSuccessPct]. */
  minSuccessPct: number;
  maxSuccessPct: number;
  /** Per-subject retry cooldown after a failed illumination (ms). */
  failRetryCooldownMs: number;
  /** Stat that lets a failed illuminator talk their way out of being attacked. */
  escapeStat: string;
  /** Escape-chance percent per escapeStat point above base on a failed illumination. */
  escapePerStatPoint: number;
  /** Stat that scales all illumination/discovery XP yields. */
  xpStat: string;
  /** Fractional XP bonus per xpStat point above base (0.02 = +2% per point). */
  xpBonusPerStatPoint: number;
  /** Fraction of the first-time XP awarded for re-illuminating a known subject. */
  repeatXpFraction: number;
  /** Per-subject cooldown before a repeat illumination yields XP again (ms). */
  repeatXpCooldownMs: number;
  /** XP for recording a never-before-visited room. */
  roomDiscoveryXp: number;
  /** XP for recording a never-before-seen item. */
  itemDiscoveryXp: number;
  /** XP for observing a non-combat NPC (recorded, never removed). */
  observeNpcXp: number;
  /** Minimum gap between discovery XP awards (ms) — anti-speedrun throttle. */
  discoveryXpThrottleMs: number;
}

// ─── Flight masters (gold fast-travel) ─────────────────────────────

/**
 * Tuning for flight masters — room kiosks (flagged with the `flightMaster`
 * room flag) where players pay gold to fast-travel between flight points they
 * have personally discovered by visiting. Mirrors the server's
 * `ambonMUD.engine.flight` block. The fare scales with travel distance: the
 * BFS hop count between the player's current room and the destination over the
 * world's exit graph, so the same destination costs more the farther you fly
 * from. Flying is blocked only in combat; otherwise gold is the sole gate.
 */
export interface FlightConfig {
  /** Base gold fare for any flight, before distance scaling. */
  baseCost: number;
  /** Additional gold per room of travel distance (BFS hops between source and destination). */
  costPerRoom: number;
  /** Floor for the total fare after scaling. */
  minCost: number;
  /** Ceiling for the total fare after scaling. */
  maxCost: number;
  /** Fare charged when distance can't be computed (destination not loaded on this engine). */
  unreachableCost: number;
  /** Player-facing flavor text. `{cost}`, `{gold}`, and `{dest}` placeholders are substituted by the server. */
  messages: FlightMessagesConfig;
}

export interface FlightMessagesConfig {
  combatBlocked: string;
  notAtFlightMaster: string;
  noDestinations: string;
  unknownDestination: string;
  alreadyHere: string;
  /** Uses `{cost}` and `{gold}` placeholders. */
  notEnoughGold: string;
  discovered: string;
  departNotice: string;
  arriveNotice: string;
  /** Uses the `{dest}` placeholder. */
  depart: string;
  /** Uses `{dest}` and `{cost}` placeholders. */
  arrival: string;
}

// ─── Boat docks (gold fast-travel, authored routes) ────────────────

/**
 * Tuning for boat docks — room kiosks (flagged with the `boatDock` room flag)
 * that let players pay gold to sail a fixed set of routes the worldbuilder
 * authored on each dock. Mirrors the server's `ambonMUD.engine.boat` block.
 * Unlike the flight master, fares are flat and author-set per route (no distance
 * scaling), routes need no discovery, and the fare is paid on every trip.
 * Sailing is blocked only in combat; otherwise gold is the sole gate. There are
 * no numeric knobs — the per-route price lives on each room's `boatRoutes` — so
 * this block is messages only.
 */
export interface BoatConfig {
  /** Player-facing flavor text. `{cost}`, `{gold}`, and `{dest}` placeholders are substituted by the server. */
  messages: BoatMessagesConfig;
}

export interface BoatMessagesConfig {
  combatBlocked: string;
  notAtDock: string;
  noRoutes: string;
  unknownDestination: string;
  alreadyHere: string;
  /** Uses `{cost}` and `{gold}` placeholders. */
  notEnoughGold: string;
  departNotice: string;
  arriveNotice: string;
  /** Uses the `{dest}` placeholder. */
  depart: string;
  /** Uses `{dest}` and `{cost}` placeholders. */
  arrival: string;
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
  image?: string;
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
  death: DeathConfig;
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
  season: SeasonConfig;
  weather: WeatherConfig;
  mobVariants: MobVariantsConfig;
  environment: EnvironmentConfig;
  worldEvents: WorldEventsConfig;
  pets: Record<string, PetDefinitionConfig>;
  petsConfig?: PetsTopLevelConfig;
  prestige?: PrestigeConfig;
  respec?: RespecConfig;
  currencies?: CurrenciesConfig;
  lottery?: LotteryConfig;
  gambling?: GamblingConfig;
  stylist?: StylistConfig;
  akathavae: AkathavaeConfig;
  flight: FlightConfig;
  boat: BoatConfig;
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
