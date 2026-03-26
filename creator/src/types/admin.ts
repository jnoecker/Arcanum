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
