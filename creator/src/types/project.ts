export type ProjectFormat = "legacy" | "standalone";

export interface Project {
  version: 1;
  name: string;
  mudDir: string;
  format: ProjectFormat;
  openZones: string[];
  lastOpenTab?: string;
}

export type ServerStatus =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error";

export interface ServerState {
  status: ServerStatus;
  pid?: number;
  lastError?: string;
}

export type TabKind = "panel" | "zone" | "zoneAtlas" | "console" | "sprites" | "admin";

export type AdminSubView =
  | "overview"
  | "players"
  | "world"
  | "content"
  | "actions";

export type AdminContentSubView =
  | "abilities"
  | "effects"
  | "quests"
  | "achievements"
  | "shops"
  | "items";

export interface Tab {
  id: string;
  kind: TabKind;
  label: string;
  /** Panel identifier — set when kind is "panel". */
  panelId?: string;
}
