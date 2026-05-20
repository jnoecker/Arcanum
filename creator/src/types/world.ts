/**
 * Dynamic stat map: stat ID -> numeric value.
 *
 * Two flavors of key are accepted:
 *
 * - **Concrete** stat IDs (lowercase by convention, e.g. `strength`,
 *   `dexterity`) must be defined in `application.yaml::stats.definitions`.
 *   These apply uniformly to anyone wearing the item.
 *
 * - **Archetypal** stat IDs ({@link ARCHETYPAL_STATS}) are uppercase placeholders
 *   that resolve at equip time against the wearer's active class
 *   `statPriorities`:
 *     PRIMARY   → statPriorities[0]
 *     SECONDARY → statPriorities[1]
 *     TERTIARY  → statPriorities[2]
 *
 *   Items can mix both — `{ PRIMARY: 3, dexterity: 1 }` gives flat DEX to
 *   everyone plus 3 to the wearer's primary stat. When the active class has
 *   no priority slot for the archetypal key, the server silently drops it.
 */
export type StatMap = Record<string, number>;

/** Archetypal stat keys that resolve to a concrete stat at equip time
 *  via the wearer's class `statPriorities`. */
export const ARCHETYPAL_STATS = ["PRIMARY", "SECONDARY", "TERTIARY"] as const;
export type ArchetypalStat = (typeof ARCHETYPAL_STATS)[number];

/** True if `key` is one of `PRIMARY`/`SECONDARY`/`TERTIARY`. */
export function isArchetypalStat(key: string): key is ArchetypalStat {
  return (ARCHETYPAL_STATS as readonly string[]).includes(key);
}

// ─── Zone-level types (mirror world-yaml-dtos) ──────────────────────

/**
 * Controls how the engine resolves mob and quest levels at runtime.
 * - "static" — author-authored levels are used verbatim (default).
 * - "bounded" — content scales to the highest-level player in the zone,
 *   clamped to `levelRange`. Keeps progression gates intact while letting
 *   mixed-level parties play the same zone.
 * - "player" — content tracks the reference player's level directly,
 *   no bounds. Intended for tutorial zones and endgame social hubs.
 */
export type ScalingMode = "static" | "bounded" | "player";

export interface ZoneScaling {
  mode: ScalingMode;
  /** Inclusive [min, max] band. Required when mode is "bounded"; ignored otherwise. */
  levelRange?: [number, number];
}

export interface WorldFile {
  zone: string;
  lifespan?: number;
  startRoom: string;
  terrain?: string;
  graphical?: boolean;
  pvpEnabled?: boolean;
  /** Dynamic level-scaling config. Omit for static (authored levels) behaviour. */
  scaling?: ZoneScaling;
  /** Intended level range for this zone. Drives the Rebalance Zone feature. */
  levelBand?: { min: number; max: number };
  /** Intended difficulty profile — informs rebalance stat targets. */
  difficultyHint?: "casual" | "standard" | "challenging";
  /** Controlling faction ID (references FactionConfig.definitions). Drives "hostile territory" reactions. */
  faction?: string;
  puzzles?: Record<string, PuzzleFile>;
  image?: ZoneImageDefaults;
  audio?: ZoneAudioDefaults;
  rooms: Record<string, RoomFile>;
  mobs?: Record<string, MobFile>;
  items?: Record<string, ItemFile>;
  shops?: Record<string, ShopFile>;
  quests?: Record<string, QuestFile>;
  gatheringNodes?: Record<string, GatheringNodeFile>;
  recipes?: Record<string, RecipeFile>;
  dungeon?: DungeonFile;
}

/** Reputation gate: player must have `min ≤ rep ≤ max` with `faction` to use. */
export interface ReputationRequirement {
  faction: string;
  min?: number;
  max?: number;
}

export interface ZoneImageDefaults {
  room?: string;
  mob?: string;
  item?: string;
  zoneMap?: string;
}

export interface ZoneAudioDefaults {
  music?: string;
  ambient?: string;
}

export interface RoomFile {
  title: string;
  description: string;
  exits?: Record<string, string | ExitValue>;
  features?: Record<string, FeatureFile>;
  terrain?: string;
  station?: string;
  bank?: boolean;
  tavern?: boolean;
  dungeon?: boolean;
  auction?: boolean;
  stylist?: boolean;
  housingBroker?: boolean;
  /** True if this room is an inn. Players can `rest` here to set their recall point. */
  inn?: boolean;
  image?: string;
  video?: string;
  music?: string;
  ambient?: string;
  /** Legacy Arcanum-only alias; stripped on output. */
  audio?: string;
}

export interface ExitValue {
  to: string;
  door?: DoorFile;
  /** Achievement ID the player must hold for the exit to be traversable. */
  requiresAchievement?: string;
  /** Shown when the player tries to take a gated exit they don't qualify for. */
  lockedMessage?: string;
}

export interface DoorFile {
  initialState?: string;
  keyItemId?: string;
  keyConsumed?: boolean;
  resetWithZone?: boolean;
  /** Legacy alias; normalized to `initialState` on output. */
  closed?: boolean;
  /** Legacy alias; normalized to `initialState` on output. */
  locked?: boolean;
  /** Legacy alias; normalized to `keyItemId` on output. */
  key?: string;
}

/** Room feature: container, lever, or sign. */
export interface FeatureFile {
  type: string; // "CONTAINER" | "LEVER" | "SIGN"
  displayName: string;
  keyword: string;
  /** "open" | "closed" | "locked" for CONTAINER; "up" | "down" for LEVER. */
  initialState?: string;
  keyItemId?: string;
  keyConsumed?: boolean;
  resetWithZone?: boolean;
  /** Initial item IDs inside a CONTAINER. */
  items?: string[];
  /** Text content for SIGN type. */
  text?: string;
}

/**
 * Classifies what a mob is *for*, independent of how tough it is. Gates
 * which behaviours the engine exposes — combatants can be attacked and award
 * XP; vendors/quest-givers/dialog mobs surface their social affordances but
 * refuse combat; props are examine-only set dressing.
 */
export type MobRole = "combat" | "vendor" | "quest_giver" | "trainer" | "dialog" | "prop";

export const MOB_ROLES: MobRole[] = ["combat", "vendor", "quest_giver", "trainer", "dialog", "prop"];

export const MOB_ROLE_LABELS: Record<MobRole, string> = {
  combat: "Combat",
  vendor: "Vendor",
  quest_giver: "Quest Giver",
  trainer: "Trainer",
  dialog: "Dialog",
  prop: "Prop",
};

export const MOB_ROLE_DESCRIPTIONS: Record<MobRole, string> = {
  combat: "Can be attacked, fights back, awards XP and loot.",
  vendor: "Shopkeeper. Cannot be attacked.",
  quest_giver: "Offers and accepts quests. Cannot be attacked.",
  trainer: "Teaches class abilities. Marks each spawn room as a training room.",
  dialog: "Conversational NPC. Cannot be attacked.",
  prop: "Examine-only flavour entity. No interaction beyond look.",
};

/**
 * One placement of a mob template in the world. A mob can have multiple
 * spawn entries; each entry may produce `count` runtime instances. The
 * legacy single-room `room` field on `MobFile` is no longer authored —
 * loaders normalize it into `spawns: [{ room }]` on read.
 */
export interface SpawnEntry {
  room: string;
  count?: number;
}

export interface MobFile {
  name: string;
  description?: string;
  /**
   * Where this mob template gets placed in the zone. New content always
   * uses `spawns`; the loader synthesizes a single-entry list for legacy
   * mobs that still have a top-level `room` shorthand, then drops `room`.
   */
  spawns?: SpawnEntry[];
  /** @deprecated Legacy single-room placement — loaders migrate to `spawns`. */
  room?: string;
  /**
   * What this mob is *for*. Omitted/missing defaults to "combat" to preserve
   * legacy behaviour. Non-combat roles refuse attack commands server-side.
   */
  role?: MobRole;
  tier?: string;
  level?: number;
  category?: string;
  hp?: number;
  minDamage?: number;
  maxDamage?: number;
  armor?: number;
  xpReward?: number;
  goldMin?: number;
  goldMax?: number;
  /**
   * Power-user multiplier on tier+level HP baseline. 1.0 = no change.
   * Authors typically use `toughness` instead, which writes through to all
   * four mults. Range (0, 10].
   */
  hpMult?: number;
  /** Power-user multiplier on tier+level damage baseline. */
  dmgMult?: number;
  /** Power-user multiplier on tier+level XP-reward baseline. */
  xpMult?: number;
  /** Power-user multiplier on tier+level gold baseline. */
  goldMult?: number;
  /**
   * Single-dial difficulty knob. Maps to all four mults at once. Arcanum-side
   * convenience: server only sees the resolved mults. Range -2 to +2.
   */
  toughness?: -2 | -1 | 0 | 1 | 2;
  drops?: MobDropFile[];
  respawnSeconds?: number;
  behavior?: BehaviorFile;
  dialogue?: Record<string, DialogueNodeFile>;
  quests?: string[];
  faction?: string;
  spells?: Record<string, MobSpellFile>;
  defaultAttack?: string;
  image?: string;
  video?: string;
  /**
   * When `role === "trainer"`, the class IDs this NPC teaches. One entry =
   * single-class trainer; two or more = multi-class trainer. Each spawn room
   * becomes a training room for these classes on save. Empty/missing on
   * non-trainer mobs.
   */
  trainerClasses?: string[];
}

export interface MobSpellFile {
  displayName: string;
  message: string;
  roomMessage?: string;
  minDamage?: number;
  maxDamage?: number;
  healMin?: number;
  healMax?: number;
  cooldownMs?: number;
  weight?: number;
  statusEffectId?: string;
}

export interface MobDropFile {
  itemId: string;
  chance: number;
}

export interface BehaviorFile {
  template?: string;
  params?: BehaviorParams;
  tree?: BtNodeFile;
}

export interface BehaviorParams {
  patrolRoute?: string[];
  fleeHpPercent?: number;
  aggroMessage?: string;
  fleeMessage?: string;
  maxWanderDistance?: number;
}

export type BtNodeType =
  | "selector" | "sequence" | "inverter" | "cooldown"
  | "is_in_combat" | "is_player_in_room" | "is_hp_below"
  | "stationary" | "aggro" | "flee" | "say" | "patrol" | "wander";

export interface BtNodeFile {
  type: BtNodeType;
  children?: BtNodeFile[];
  /** cooldown node: cooldown duration in ms */
  cooldownMs?: number;
  /** cooldown node: unique key for cooldown tracking */
  key?: string;
  /** is_hp_below node: HP threshold percent (default 20) */
  percent?: number;
  /** say node: message text */
  message?: string;
  /** patrol node: ordered list of room IDs */
  route?: string[];
  /** wander node: max rooms from origin (default 3) */
  maxDistance?: number;
}

/**
 * Broad server-assigned item category. When omitted, the server infers it from
 * slot / consumable / basePrice. `questItem: true` always resolves to "quest"
 * regardless of this field.
 */
export type ItemType = "equipment" | "consumable" | "quest" | "treasure" | "misc";

export const ITEM_TYPES: readonly ItemType[] = [
  "equipment",
  "consumable",
  "quest",
  "treasure",
  "misc",
] as const;

export interface ItemFile {
  displayName: string;
  description?: string;
  keyword?: string;
  slot?: string;
  damage?: number;
  armor?: number;
  stats?: StatMap;
  consumable?: boolean;
  charges?: number;
  onUse?: ItemOnUse;
  room?: string;
  mob?: string;
  matchByKey?: boolean;
  basePrice?: number;
  image?: string;
  video?: string;
  /**
   * Explicit server-side category. Leave unset to let the server infer from
   * other fields. Values are lowercase to match the server's `ItemType.label()`.
   */
  itemType?: ItemType;
  /**
   * Soulbound flag: quest items cannot be dropped, sold, traded, given, or
   * stored in containers. Always resolves to the "quest" category server-side.
   */
  questItem?: boolean;
  /** Intended player level. Drives the level multiplier in budget derivation. */
  level?: number;
  /** Rarity tier. Drives the tier multiplier in budget derivation. */
  tier?:
    | "trash"
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary";
  /** Budget split: damage / armor / balanced / stat. Accessory slots force "stat". */
  archetype?: "damage" | "armor" | "balanced" | "stat";
  /** Primary stat: receives the largest share of the stat-budget. */
  primaryStat?: string;
  /** Secondary stat: receives the middle share of the stat-budget. */
  secondaryStat?: string;
  /** Tertiary stat: receives the smallest share of the stat-budget. */
  tertiaryStat?: string;
  /**
   * When true, the tertiary slot is dropped entirely and the stat budget is
   * split 60/40 between primary and secondary instead of the default 50/30/20.
   * Use for items that should only carry two stat bonuses.
   */
  disableTertiary?: boolean;
  /**
   * Class restriction. When non-empty, only players whose `playerClass` matches
   * one of these IDs can equip the item. Null/absent = unrestricted. Mirrors
   * AmbonMUD's `ItemFile.classes` field; the server's equip handler enforces
   * the wall. Loader normalizes entries to uppercase.
   */
  classes?: string[];
}

export interface ItemOnUse {
  healHp?: number;
  healMana?: number;
  grantXp?: number;
}

export interface ShopFile {
  name: string;
  room: string;
  items?: string[];
  image?: string;
  /** Rep gate. Shop refuses to trade when the requirement fails. */
  requiredReputation?: ReputationRequirement;
}

export interface QuestFile {
  name: string;
  description?: string;
  giver: string;
  completionType?: string;
  objectives?: QuestObjectiveFile[];
  rewards?: QuestRewardsFile;
  /** Rep gate. Giver will not offer the quest when the requirement fails. */
  requiredReputation?: ReputationRequirement;
  /**
   * Intended player level. When set, XP rewards are scaled by the same
   * diminishing-returns curve used for kills — players who have out-levelled
   * the quest receive reduced XP rather than the flat reward. Omit to keep
   * legacy flat-award behaviour.
   */
  level?: number;
  /**
   * Engine-driven difficulty tier. When set and `rewards.xp` is absent/0, the
   * engine computes XP from the progression config's quest baseline × the
   * tier's multiplier. An explicit positive `rewards.xp` always wins.
   */
  difficulty?: import("./config").QuestDifficulty;
  /**
   * Optional dialogue-flag gate. When set, the quest stays hidden from
   * `qoffers`, the canvas Quest indicator, and `accept` until the player has
   * the named flag in their dialogueFlags set. Flags are added by dialogue
   * choice actions of the form `unlock_flag:<name>` and are global strings,
   * so the unlocking conversation can be on any NPC in any zone.
   */
  requiresDialogueFlag?: string;
  /**
   * Optional override for the NPC that accepts turn-ins. Bare mob keyword
   * (e.g. `headmaster_aldric`); the loader qualifies it with the zone id.
   * Defaults to `giver` when null/empty.
   */
  turnInMob?: string;
}

export interface QuestObjectiveFile {
  type: string;
  targetKey: string;
  count?: number;
  description?: string;
}

export interface QuestRewardsFile {
  xp?: number;
  gold?: number;
  currencies?: Record<string, number>;
}

export interface DialogueNodeFile {
  text: string;
  choices?: DialogueChoiceFile[];
}

export interface DialogueChoiceFile {
  text: string;
  next?: string;
  minLevel?: number;
  requiredClass?: string;
  action?: string;
}

export interface GatheringNodeFile {
  displayName: string;
  keyword?: string;
  image?: string;
  skill: string;
  skillRequired?: number;
  yields: GatheringYieldFile[];
  rareYields?: RareYieldFile[];
  respawnSeconds?: number;
  xpReward?: number;
  room: string;
}

export interface GatheringYieldFile {
  itemId: string;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface RareYieldFile {
  itemId: string;
  quantity?: number;
  dropChance: number;
}

export interface RecipeFile {
  displayName: string;
  skill: string;
  skillRequired?: number;
  levelRequired?: number;
  materials: RecipeMaterialFile[];
  outputItemId: string;
  outputQuantity?: number;
  station?: string;
  stationBonus?: number;
  xpReward?: number;
  image?: string;
}

export interface RecipeMaterialFile {
  itemId: string;
  quantity: number;
}

// ─── Dungeon template types ────────────────────────────────────────

export interface DungeonMobPool {
  common?: string[];
  elite?: string[];
  boss?: string[];
}

export interface DungeonRoomTemplate {
  title: string;
  description: string;
  image?: string;
}

export interface DungeonLootTable {
  mobDrops?: string[];
  completionRewards?: string[];
}

export interface DungeonFile {
  name: string;
  description?: string;
  image?: string;
  minLevel?: number;
  roomCountMin?: number;
  roomCountMax?: number;
  portalRoom?: string;
  roomTemplates?: Record<string, DungeonRoomTemplate[]>;
  mobPools?: DungeonMobPool;
  lootTables?: Record<string, DungeonLootTable>;
}

// ─── Puzzles ──────────────────────────────────────────────────────

export interface PuzzleReward {
  type: string; // "unlock_exit" | "give_item" | "give_gold" | "give_xp"
  exitDirection?: string;
  targetRoom?: string;
  itemId?: string;
  gold?: number;
  xp?: number;
  /** Legacy alias used by older creator code; normalized on output. */
  amount?: number;
}

export interface PuzzleStep {
  feature: string;
  action: string;
}

export interface PuzzleFile {
  type: string; // "riddle" | "sequence"
  mobId?: string;
  roomId: string;
  question?: string;
  answer?: string;
  acceptableAnswers?: string[];
  steps?: PuzzleStep[];
  reward: PuzzleReward;
  failMessage?: string;
  successMessage?: string;
  cooldownMs?: number;
  resetOnFail?: boolean;
}
