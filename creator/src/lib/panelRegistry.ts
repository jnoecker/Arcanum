// ─── Panel registry ─────────────────────────────────────────────────
// Central source of truth for all navigable panels. The sidebar, tab
// bar, and main-area router all read from this registry.

export type SidebarGroup =
  | "studio"
  | "characters"
  | "abilities"
  | "world"
  | "lore"
  | "content"
  | "operations";

export interface PanelDef {
  id: string;
  label: string;
  group: SidebarGroup;
  /** "config" panels share the config auto-save chrome, "studio" panels
   *  share the zone-selection state in StudioWorkspace. */
  host: "config" | "studio" | "lore";
  kicker: string;
  title: string;
  description: string;
  maxWidth: string;
}

// ─── Studio panels ──────────────────────────────────────────────────

const STUDIO_PANELS: PanelDef[] = [
  { id: "art", label: "Art", group: "studio", host: "studio", kicker: "Studio", title: "Art", description: "Zone vibes, entity art, defaults, and free-form generation.", maxWidth: "max-w-7xl" },
  { id: "media", label: "Media", group: "studio", host: "studio", kicker: "Studio", title: "Media", description: "Music, ambience, and cinematic staging.", maxWidth: "max-w-7xl" },
  { id: "portraits", label: "Portraits", group: "studio", host: "studio", kicker: "Studio", title: "Portraits", description: "Race and class portrait creation.", maxWidth: "max-w-7xl" },
  { id: "studioAbilities", label: "Abilities", group: "studio", host: "studio", kicker: "Studio", title: "Abilities", description: "Ability and status-effect icon generation.", maxWidth: "max-w-7xl" },
];

// ─── Character panels ───────────────────────────────────────────────

const CHARACTER_PANELS: PanelDef[] = [
  { id: "classes", label: "Classes", group: "characters", host: "config", kicker: "Classes", title: "Class designer", description: "Class identity, scaling, visual direction, and start-room overrides.", maxWidth: "max-w-5xl" },
  { id: "races", label: "Races", group: "characters", host: "config", kicker: "Races", title: "Race designer", description: "Race lore, traits, stat modifiers, portraits, and staff-tier overrides.", maxWidth: "max-w-5xl" },
  { id: "creation", label: "Creation", group: "characters", host: "config", kicker: "Character foundations", title: "Character creation", description: "Starting state and gender definitions.", maxWidth: "max-w-5xl" },
  { id: "equipment", label: "Equipment", group: "characters", host: "config", kicker: "Equipment", title: "Equipment slots", description: "Wear slots and layout.", maxWidth: "max-w-5xl" },
  { id: "characterSprites", label: "Sprites", group: "characters", host: "config", kicker: "Sprites", title: "Sprite rules", description: "Image serving, sprite tiers, and player tier visuals.", maxWidth: "max-w-5xl" },
];

// ─── Ability panels ─────────────────────────────────────────────────

const ABILITY_PANELS: PanelDef[] = [
  { id: "stats", label: "Stats", group: "abilities", host: "config", kicker: "Stats", title: "Stat definitions", description: "Primary stats, abbreviations, and base values.", maxWidth: "max-w-5xl" },
  { id: "abilityDesigner", label: "Abilities", group: "abilities", host: "config", kicker: "Abilities", title: "Ability designer", description: "Class restrictions, costs, cooldowns, targets, and effects.", maxWidth: "max-w-5xl" },
  { id: "conditions", label: "Conditions", group: "abilities", host: "config", kicker: "Status effects", title: "Condition designer", description: "Status effects, stack rules, and ticking behavior.", maxWidth: "max-w-5xl" },
];

// ─── World panels ───────────────────────────────────────────────────

const WORLD_PANELS: PanelDef[] = [
  { id: "worldServer", label: "World & Server", group: "world", host: "config", kicker: "Infrastructure", title: "World & server", description: "Start room, server ports, admin API, observability, and logging.", maxWidth: "max-w-5xl" },
  { id: "combat", label: "Combat", group: "world", host: "config", kicker: "Combat loop", title: "Combat loop", description: "Tick rates, damage ranges, mob tiers, and regeneration.", maxWidth: "max-w-5xl" },
  { id: "progression", label: "Progression", group: "world", host: "config", kicker: "Progression", title: "Progression", description: "Leveling curve, XP formula, and per-level rewards.", maxWidth: "max-w-5xl" },
  { id: "statBindings", label: "Stat Bindings", group: "world", host: "config", kicker: "Stat bindings", title: "Stat bindings", description: "How stats map to combat, regen, dodge, and XP bonuses.", maxWidth: "max-w-5xl" },
  { id: "travel", label: "Travel", group: "world", host: "config", kicker: "Travel", title: "Navigation & recall", description: "Recall cooldowns and movement rules.", maxWidth: "max-w-5xl" },
  { id: "commands", label: "Commands", group: "world", host: "config", kicker: "Commands", title: "Command designer", description: "Custom commands, usage strings, and categories.", maxWidth: "max-w-5xl" },
  { id: "economy", label: "Economy", group: "world", host: "config", kicker: "Economy", title: "Economy", description: "Buy/sell multipliers and gold economy.", maxWidth: "max-w-5xl" },
  { id: "crafting", label: "Crafting", group: "world", host: "config", kicker: "Crafting", title: "Crafting & gathering", description: "Skill leveling, station types, gathering, and recipes.", maxWidth: "max-w-5xl" },
  { id: "groups", label: "Groups", group: "world", host: "config", kicker: "Groups", title: "Party system", description: "Party size, XP sharing, and invite rules.", maxWidth: "max-w-5xl" },
  { id: "guilds", label: "Guilds", group: "world", host: "config", kicker: "Guilds", title: "Guild system", description: "Guild ranks, permissions, friends, and defaults.", maxWidth: "max-w-5xl" },
  { id: "emotes", label: "Emotes", group: "world", host: "config", kicker: "Social", title: "Emote presets", description: "Quick-action emotes available to players in the chat panel.", maxWidth: "max-w-5xl" },
  { id: "housing", label: "Housing", group: "world", host: "config", kicker: "Housing", title: "Player housing", description: "Room templates, costs, and housing system settings.", maxWidth: "max-w-5xl" },
];

// ─── Lore panels ───────────────────────────────────────────────────

const LORE_PANELS: PanelDef[] = [
  { id: "lore", label: "Articles", group: "lore", host: "lore", kicker: "Lore", title: "World lore", description: "All world-building articles — characters, locations, factions, and more.", maxWidth: "max-w-7xl" },
  { id: "worldSetting", label: "World Setting", group: "lore", host: "lore", kicker: "Lore", title: "World setting", description: "Name, overview, history, themes, geography, and magic system.", maxWidth: "max-w-5xl" },
  { id: "factions", label: "Factions", group: "lore", host: "lore", kicker: "Lore", title: "Factions & organizations", description: "Political groups, guilds, and power structures.", maxWidth: "max-w-5xl" },
  { id: "codex", label: "Codex", group: "lore", host: "lore", kicker: "Lore", title: "Lore codex", description: "Wiki-style articles for places, legends, creatures, deities, and more.", maxWidth: "max-w-5xl" },
  { id: "loreMaps", label: "Maps", group: "lore", host: "lore", kicker: "Lore", title: "World maps", description: "Upload maps, place pins, and link locations to lore articles.", maxWidth: "max-w-7xl" },
  { id: "loreTimeline", label: "Timeline", group: "lore", host: "lore", kicker: "Lore", title: "Timeline", description: "Custom calendar systems, eras, and historical events.", maxWidth: "max-w-5xl" },
  { id: "loreRelations", label: "Relations", group: "lore", host: "lore", kicker: "Lore", title: "Relationship graph", description: "Visual graph of connections between articles, factions, and characters.", maxWidth: "max-w-7xl" },
  { id: "loreDocuments", label: "Documents", group: "lore", host: "lore", kicker: "Lore", title: "Document library", description: "Internal notes, lore bibles, and reference documents.", maxWidth: "max-w-5xl" },
];

// ─── Content panels ─────────────────────────────────────────────────

const CONTENT_PANELS: PanelDef[] = [
  { id: "achievements", label: "Achievements", group: "content", host: "config", kicker: "Content", title: "Achievements", description: "Achievement categories and criteria types.", maxWidth: "max-w-5xl" },
  { id: "achievementDefs", label: "Achievement Builder", group: "content", host: "config", kicker: "Content", title: "Achievement builder", description: "Define achievements, criteria, and rewards.", maxWidth: "max-w-5xl" },
  { id: "quests", label: "Quests", group: "content", host: "config", kicker: "Content", title: "Quest taxonomy", description: "Quest objective and completion type definitions.", maxWidth: "max-w-5xl" },
  { id: "sharedAssets", label: "Shared Assets", group: "content", host: "config", kicker: "Content", title: "Shared assets", description: "Global asset keys and image configuration.", maxWidth: "max-w-5xl" },
];

// ─── Operations panels ──────────────────────────────────────────────

const OPERATIONS_PANELS: PanelDef[] = [
  { id: "services", label: "Services", group: "operations", host: "config", kicker: "Operations", title: "Services", description: "API keys, image providers, and LLM settings.", maxWidth: "max-w-5xl" },
  { id: "deployment", label: "Deployment", group: "operations", host: "config", kicker: "Operations", title: "Deployment", description: "Export, sync, and deploy your MUD.", maxWidth: "max-w-5xl" },
  { id: "rawYaml", label: "Raw YAML", group: "operations", host: "config", kicker: "Advanced", title: "Raw configuration", description: "Inspect or edit the exact serialized YAML when the structured editors are not enough.", maxWidth: "max-w-6xl" },
  { id: "versionControl", label: "Version Control", group: "operations", host: "config", kicker: "Operations", title: "Version control", description: "Git status, commits, push/pull, and conflict resolution for standalone projects.", maxWidth: "max-w-5xl" },
];

// ─── Aggregate ──────────────────────────────────────────────────────

export const ALL_PANELS: PanelDef[] = [
  ...STUDIO_PANELS,
  ...CHARACTER_PANELS,
  ...ABILITY_PANELS,
  ...WORLD_PANELS,
  ...LORE_PANELS,
  ...CONTENT_PANELS,
  ...OPERATIONS_PANELS,
];

export const PANEL_MAP: Record<string, PanelDef> = Object.fromEntries(
  ALL_PANELS.map((p) => [p.id, p]),
);

export type Workspace = "worldmaker" | "lore";

export const WORLDMAKER_GROUPS: { id: SidebarGroup; label: string; panels: PanelDef[] }[] = [
  { id: "studio", label: "Studio", panels: STUDIO_PANELS },
  { id: "characters", label: "Characters", panels: CHARACTER_PANELS },
  { id: "abilities", label: "Abilities", panels: ABILITY_PANELS },
  { id: "world", label: "World", panels: WORLD_PANELS },
  { id: "content", label: "Content", panels: CONTENT_PANELS },
  { id: "operations", label: "Operations", panels: OPERATIONS_PANELS },
];

export const LORE_GROUPS: { id: SidebarGroup; label: string; panels: PanelDef[] }[] = [
  { id: "lore", label: "Lore", panels: LORE_PANELS },
];

/** @deprecated Use WORLDMAKER_GROUPS / LORE_GROUPS */
export const SIDEBAR_GROUPS: { id: SidebarGroup; label: string; panels: PanelDef[] }[] = [
  ...WORLDMAKER_GROUPS,
  ...LORE_GROUPS,
];

/** Build a Tab object for a panel ID. */
export function panelTab(panelId: string): { id: string; kind: "panel"; label: string; panelId: string } {
  const def = PANEL_MAP[panelId];
  return { id: `panel:${panelId}`, kind: "panel" as const, label: def?.label ?? panelId, panelId };
}
