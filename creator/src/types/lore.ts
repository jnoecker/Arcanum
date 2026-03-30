// ─── Lore & World Building ──────────────────────────────────────────
// Creator-only data model. Not deployed to the MUD server.

export interface WorldLore {
  setting: WorldSetting;
  factions: Record<string, Faction>;
  codex: Record<string, CodexEntry>;
}

export interface WorldSetting {
  name?: string;
  tagline?: string;
  overview?: string;
  history?: string;
  themes?: string[];
  era?: string;
  geography?: string;
  magic?: string;
  technology?: string;
}

export interface Faction {
  displayName: string;
  description?: string;
  motto?: string;
  territory?: string;
  allies?: string[];
  rivals?: string[];
  leader?: string;
  values?: string[];
  image?: string;
}

export interface CodexEntry {
  title: string;
  category?: string;
  content: string;
  tags?: string[];
  relatedEntries?: string[];
}

export const DEFAULT_WORLD_LORE: WorldLore = {
  setting: {},
  factions: {},
  codex: {},
};
