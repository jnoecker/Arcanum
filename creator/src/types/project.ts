export interface Project {
  version: 1;
  name: string;
  mudDir: string;
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

export type TabKind = "zone" | "config" | "classes" | "races" | "console";

export interface Tab {
  id: string;
  kind: TabKind;
  label: string;
}
