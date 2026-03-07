/** Dynamic stat map: stat ID -> numeric value */
export type StatMap = Record<string, number>;

// ─── Zone-level types (mirror world-yaml-dtos) ──────────────────────

export interface WorldFile {
  zone: string;
  lifespan?: number;
  startRoom: string;
  image?: ZoneImageDefaults;
  audio?: ZoneAudioDefaults;
  rooms: Record<string, RoomFile>;
  mobs?: Record<string, MobFile>;
  items?: Record<string, ItemFile>;
  shops?: Record<string, ShopFile>;
  quests?: Record<string, QuestFile>;
  gatheringNodes?: Record<string, GatheringNodeFile>;
  recipes?: Record<string, RecipeFile>;
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
  station?: string;
  image?: string;
  video?: string;
  music?: string;
  ambient?: string;
  audio?: string;
}

export interface ExitValue {
  to: string;
  door?: DoorFile;
}

export interface DoorFile {
  closed?: boolean;
  locked?: boolean;
  key?: string;
}

export interface MobFile {
  name: string;
  description?: string;
  room: string;
  tier?: string;
  level?: number;
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
  image?: string;
  video?: string;
}

export interface MobDropFile {
  itemId: string;
  chance: number;
}

export interface BehaviorFile {
  template: string;
  params?: BehaviorParams;
}

export interface BehaviorParams {
  patrolRoute?: string[];
  fleeHpPercent?: number;
  aggroMessage?: string;
  fleeMessage?: string;
  maxWanderDistance?: number;
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
  skill: string;
  skillRequired?: number;
  yields: GatheringYieldFile[];
  respawnSeconds?: number;
  xpReward?: number;
  room: string;
}

export interface GatheringYieldFile {
  itemId: string;
  minQuantity?: number;
  maxQuantity?: number;
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
