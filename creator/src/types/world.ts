/** Dynamic stat map: stat ID -> numeric value */
export type StatMap = Record<string, number>;

// ─── Zone-level types (mirror world-yaml-dtos) ──────────────────────

export interface WorldFile {
  zone: string;
  lifespan?: number;
  startRoom: string;
  terrain?: string;
  graphical?: boolean;
  pvpEnabled?: boolean;
  puzzles?: Record<string, PuzzleFile>;
  image?: ZoneImageDefaults;
  audio?: ZoneAudioDefaults;
  rooms: Record<string, RoomFile>;
  mobs?: Record<string, MobFile>;
  items?: Record<string, ItemFile>;
  shops?: Record<string, ShopFile>;
  trainers?: Record<string, TrainerFile>;
  quests?: Record<string, QuestFile>;
  gatheringNodes?: Record<string, GatheringNodeFile>;
  recipes?: Record<string, RecipeFile>;
  dungeon?: DungeonFile;
}

export interface ZoneImageDefaults {
  room?: string;
  mob?: string;
  item?: string;
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

export interface MobFile {
  name: string;
  description?: string;
  room: string;
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
  drops?: MobDropFile[];
  respawnSeconds?: number;
  behavior?: BehaviorFile;
  dialogue?: Record<string, DialogueNodeFile>;
  quests?: string[];
  faction?: string;
  image?: string;
  video?: string;
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
}

export interface ItemOnUse {
  healHp?: number;
  grantXp?: number;
}

export interface ShopFile {
  name: string;
  room: string;
  items?: string[];
  image?: string;
}

export interface TrainerFile {
  name: string;
  /**
   * Legacy single-class field. Still supported for existing content and for
   * trainers that only teach one class (which is the common case). The MUD's
   * TrainerFile keeps this around for backwards compatibility.
   */
  class?: string;
  /**
   * Multi-class list. When set and non-empty, takes precedence over {@link class}
   * — matches the loader rule in reference/.../WorldLoader.kt. Use this for
   * trainers that teach two or more classes (e.g. a combat academy master
   * teaching WARRIOR + ROGUE + RANGER).
   */
  classes?: string[];
  room: string;
  image?: string;
}

export interface QuestFile {
  name: string;
  description?: string;
  giver: string;
  completionType?: string;
  objectives?: QuestObjectiveFile[];
  rewards?: QuestRewardsFile;
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
