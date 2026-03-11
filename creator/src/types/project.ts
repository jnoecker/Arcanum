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

export type TabKind = "studio" | "zone" | "config" | "console" | "sprites";

export type ConfigSubTab =
  | "characterStudio"
  | "abilityStudio"
  | "worldSystems"
  | "contentStudio"
  | "operations"
  | "rawYaml";

export interface Tab {
  id: string;
  kind: TabKind;
  label: string;
}
