// ─── Admin API response types ──────────────────────────────────────
// Mirror the AmbonMUD admin server JSON API shapes.

export interface AdminConfig {
  url: string;
  token: string;
}

export type AdminConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface AdminOverview {
  playersOnline: number;
  mobsAlive: number;
  zonesLoaded: number;
  roomsTotal: number;
  grafanaUrl?: string;
  metricsUrl?: string;
}

export interface PlayerSummary {
  name: string;
  level: number;
  playerClass: string;
  race: string;
  room: string;
  isOnline: boolean;
  isStaff: boolean;
  hp: number;
  maxHp: number;
}

export interface PlayerDetail extends PlayerSummary {
  mana: number;
  maxMana: number;
  xpTotal: number;
  gold: number;
  stats: Record<string, number>;
  activeTitle?: string;
  activeQuestIds: string[];
  completedQuestIds: string[];
  achievementIds: string[];
}

export interface ZoneSummary {
  name: string;
  roomCount: number;
  playersOnline: number;
  mobsAlive: number;
}

export interface ZoneDetail {
  name: string;
  rooms: RoomSummary[];
}

export interface RoomSummary {
  id: string;
  title: string;
  exits: string[];
  players: string[];
  mobs: string[];
}

export interface ReloadResult {
  status: string;
  summary: string;
}

export type ReloadTarget = "world" | "abilities" | "effects" | "all";

// ─── Phase 2: New API response types ──────────────────────────────

export interface HealthResponse {
  status: string;
  uptimeMs: number;
  playersOnline: number;
}

export interface StaffToggleResult {
  name: string;
  isStaff: boolean;
}

export interface ExitDetail {
  direction: string;
  target: string;
}

export interface RoomMobInfo {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  templateKey: string;
}

export interface RoomDetailResponse {
  id: string;
  title: string;
  description: string;
  exits: ExitDetail[];
  players: string[];
  mobs: RoomMobInfo[];
  features: string[];
  station?: string;
  image?: string;
  video?: string;
  music?: string;
  ambient?: string;
  mapX?: number;
  mapY?: number;
}

export interface MobSummary {
  id: string;
  name: string;
  roomId: string;
  hp: number;
  maxHp: number;
  templateKey: string;
  aggressive: boolean;
  xpReward: number;
  armor: number;
  image?: string;
  questIds: string[];
  spawnRoomId: string;
}

export interface AbilityEntry {
  id: string;
  displayName: string;
  description: string;
  manaCost: number;
  cooldownMs: number;
  levelRequired: number;
  targetType: string;
  requiredClass?: string;
  image?: string;
  effectType: string;
}

export interface EffectEntry {
  id: string;
  displayName: string;
  effectType: string;
  durationMs: number;
  tickIntervalMs: number;
  tickMinValue: number;
  tickMaxValue: number;
  shieldAmount: number;
  statMods: Record<string, number>;
  stackBehavior: string;
  maxStacks: number;
}

export interface QuestObjective {
  type: string;
  targetId: string;
  count: number;
  description: string;
}

export interface QuestRewards {
  xp?: number;
  gold?: number;
}

export interface QuestEntry {
  id: string;
  name: string;
  description: string;
  giverMobId: string;
  completionType: string;
  objectives: QuestObjective[];
  rewards: QuestRewards;
}

export interface AchievementCriterion {
  type: string;
  targetId: string;
  count: number;
  description: string;
}

export interface AchievementRewards {
  xp?: number;
  gold?: number;
  title?: string;
}

export interface AchievementEntry {
  id: string;
  displayName: string;
  description: string;
  category: string;
  hidden: boolean;
  criteria: AchievementCriterion[];
  rewards: AchievementRewards;
}

export interface ShopItemEntry {
  id: string;
  displayName: string;
  basePrice: number;
  slot?: string;
}

export interface ShopEntry {
  id: string;
  name: string;
  roomId: string;
  items: ShopItemEntry[];
}

export interface ItemEntry {
  id: string;
  displayName: string;
  description: string;
  slot?: string;
  damage: number;
  armor: number;
  stats: Record<string, number>;
  consumable: boolean;
  basePrice: number;
  image?: string;
  spawnRoom?: string;
}

export interface BroadcastResult {
  status: string;
  recipients: number;
}

export type AdminContentCategory =
  | "abilities"
  | "effects"
  | "quests"
  | "achievements"
  | "shops"
  | "items";
