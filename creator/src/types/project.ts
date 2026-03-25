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

export type CharacterStudioSubView =
  | "classes"
  | "races"
  | "creation"
  | "equipment"
  | "sprites";

export type AbilityStudioSubView =
  | "stats"
  | "abilities"
  | "conditions";

export type StudioSubView =
  | "home"
  | "art"
  | "media"
  | "portraits"
  | "abilities";

export type WorldSystemsSubView =
  | "world"
  | "combat"
  | "progression"
  | "travel"
  | "economy"
  | "social";

export type ContentStudioSubView =
  | "achievements"
  | "quests"
  | "assets";

export type OperationsSubView =
  | "services"
  | "delivery";

export interface Tab {
  id: string;
  kind: TabKind;
  label: string;
}
