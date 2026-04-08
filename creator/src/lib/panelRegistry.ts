// ─── Panel registry ─────────────────────────────────────────────────
// Central source of truth for all navigable panels. The sidebar, tab
// bar, and main-area router all read from this registry.

export type SidebarGroup =
  | "studio"
  | "characters"
  | "world"
  | "systems"
  | "lore"
  | "operations"
  | "command";

export interface PanelDef {
  id: string;
  label: string;
  group: SidebarGroup;
  /** "config" panels share the config auto-save chrome, "studio" panels
   *  share the zone-selection state in StudioWorkspace, "command" panels
   *  route to dedicated components. */
  host: "config" | "studio" | "lore" | "command";
  kicker: string;
  title: string;
  description: string;
  maxWidth: string;
  /** Optional sub-category within a sidebar group for visual chunking. */
  subGroup?: string;
}

// ─── Studio panels ──────────────────────────────────────────────────

// Art Style panel is shared between Studio (worldmaker) and Lore sidebars.
// MainArea routes on `host: "lore"` regardless of which sidebar group listed it.
const ART_STYLE_PANEL: PanelDef = {
  id: "artStyle",
  label: "Art Style",
  group: "studio",
  host: "lore",
  kicker: "Studio",
  title: "Art style",
  description: "Named art styles with base + per-surface overrides. AI-assisted generation and refinement.",
  maxWidth: "max-w-5xl",
};

const STUDIO_PANELS: PanelDef[] = [
  { id: "art", label: "Art", group: "studio", host: "studio", kicker: "Studio", title: "Art", description: "Zone vibes, entity art, defaults, and free-form generation.", maxWidth: "max-w-7xl" },
  { id: "media", label: "Media", group: "studio", host: "studio", kicker: "Studio", title: "Media", description: "Music, ambience, and cinematic staging.", maxWidth: "max-w-7xl" },
  { id: "portraits", label: "Portraits", group: "studio", host: "studio", kicker: "Studio", title: "Portraits", description: "Race and class portrait creation.", maxWidth: "max-w-7xl" },
  { id: "studioAbilities", label: "Icons", group: "studio", host: "studio", kicker: "Studio", title: "Icons", description: "Ability and status-effect icon generation.", maxWidth: "max-w-7xl" },
  { id: "sprites", label: "Player Sprites", group: "studio", host: "command", kicker: "Studio", title: "Player sprites", description: "Visible identity, unlockable variants, and portrait logic.", maxWidth: "max-w-7xl" },
  ART_STYLE_PANEL,
];

// ─── Character panels (includes former Ability panels) ─────────────

const CHARACTER_PANELS: PanelDef[] = [
  { id: "classes", label: "Classes", group: "characters", host: "config", kicker: "Classes", title: "Class designer", description: "Class identity, scaling, visual direction, and start-room overrides.", maxWidth: "max-w-5xl", subGroup: "Identity" },
  { id: "races", label: "Races", group: "characters", host: "config", kicker: "Races", title: "Race designer", description: "Race lore, traits, stat modifiers, portraits, and staff-tier overrides.", maxWidth: "max-w-5xl", subGroup: "Identity" },
  { id: "creation", label: "Creation", group: "characters", host: "config", kicker: "Character foundations", title: "Character creation", description: "Starting state and gender definitions.", maxWidth: "max-w-5xl", subGroup: "Identity" },
  { id: "equipment", label: "Equipment", group: "characters", host: "config", kicker: "Equipment", title: "Equipment slots", description: "Wear slots and layout.", maxWidth: "max-w-5xl", subGroup: "Identity" },
  { id: "characterSprites", label: "Sprite Config", group: "characters", host: "config", kicker: "Sprite config", title: "Sprite rules", description: "Image serving, sprite tiers, and player tier visuals.", maxWidth: "max-w-5xl", subGroup: "Identity" },
  { id: "stats", label: "Stats", group: "characters", host: "config", kicker: "Stats", title: "Stat definitions", description: "Primary stats, abbreviations, and base values.", maxWidth: "max-w-5xl", subGroup: "Powers" },
  { id: "abilityDesigner", label: "Abilities", group: "characters", host: "config", kicker: "Abilities", title: "Ability designer", description: "Class restrictions, costs, cooldowns, targets, and effects.", maxWidth: "max-w-5xl", subGroup: "Powers" },
  { id: "conditions", label: "Conditions", group: "characters", host: "config", kicker: "Status effects", title: "Condition designer", description: "Status effects, stack rules, and ticking behavior.", maxWidth: "max-w-5xl", subGroup: "Powers" },
];

// ─── World panels ───────────────────────────────────────────────────

const WORLD_PANELS: PanelDef[] = [
  { id: "tuningWizard", label: "Tuning Wizard", group: "world", host: "command", kicker: "World", title: "Tuning Wizard", description: "Configure all game balance — presets, inline editing, and before/after comparison.", maxWidth: "max-w-7xl" },
  { id: "worldServer", label: "World & Server", group: "world", host: "config", kicker: "Infrastructure", title: "World & server", description: "Start room, server ports, admin API, observability, and logging.", maxWidth: "max-w-5xl" },
  { id: "commands", label: "Commands", group: "world", host: "config", kicker: "Commands", title: "Command designer", description: "Custom commands, usage strings, and categories.", maxWidth: "max-w-5xl" },
];

// ─── Systems panels ────────────────────────────────────────────────

const SYSTEMS_PANELS: PanelDef[] = [
  { id: "currencies", label: "Currencies", group: "systems", host: "config", kicker: "Economy", title: "Secondary currencies", description: "Quest points, honor, crafting tokens, and other non-gold currencies.", maxWidth: "max-w-5xl", subGroup: "Economy" },
  { id: "crafting", label: "Crafting", group: "systems", host: "config", kicker: "Crafting", title: "Crafting & gathering", description: "Skill leveling, station types, gathering, and recipes.", maxWidth: "max-w-5xl", subGroup: "Economy" },
  { id: "enchanting", label: "Enchanting", group: "systems", host: "config", kicker: "Enchanting", title: "Enchanting system", description: "Enchantment definitions, materials, stat bonuses, and target slots.", maxWidth: "max-w-5xl", subGroup: "Economy" },
  { id: "guilds", label: "Guilds", group: "systems", host: "config", kicker: "Guilds", title: "Guild system", description: "Guild ranks, permissions, friends, and defaults.", maxWidth: "max-w-5xl", subGroup: "Social" },
  { id: "guildHalls", label: "Guild Halls", group: "systems", host: "config", kicker: "Social", title: "Guild halls", description: "Guild housing costs, room templates, and hall configuration.", maxWidth: "max-w-5xl", subGroup: "Social" },
  { id: "factions", label: "Factions", group: "systems", host: "config", kicker: "Factions", title: "Faction system", description: "Reputation factions, enemy relationships, and quest rewards.", maxWidth: "max-w-5xl", subGroup: "Social" },
  { id: "emotes", label: "Emotes", group: "systems", host: "config", kicker: "Social", title: "Emote presets", description: "Quick-action emotes available to players in the chat panel.", maxWidth: "max-w-5xl", subGroup: "Social" },
  { id: "housing", label: "Housing", group: "systems", host: "config", kicker: "Housing", title: "Player housing", description: "Room templates, costs, and housing system settings.", maxWidth: "max-w-5xl", subGroup: "Living World" },
  { id: "pets", label: "Pets", group: "systems", host: "config", kicker: "Companions", title: "Pet system", description: "Define pet templates that can be summoned by abilities.", maxWidth: "max-w-5xl", subGroup: "Living World" },
  { id: "worldEvents", label: "Events", group: "systems", host: "config", kicker: "Seasonal", title: "World events", description: "Seasonal events with date schedules, flags, and broadcast messages.", maxWidth: "max-w-5xl", subGroup: "Living World" },
  { id: "achievements", label: "Achievements", group: "systems", host: "config", kicker: "Content", title: "Achievements", description: "Achievement categories and criteria types.", maxWidth: "max-w-5xl", subGroup: "Content" },
  { id: "achievementDefs", label: "Achievement Builder", group: "systems", host: "config", kicker: "Content", title: "Achievement builder", description: "Define achievements, criteria, and rewards.", maxWidth: "max-w-5xl", subGroup: "Content" },
  { id: "quests", label: "Quests", group: "systems", host: "config", kicker: "Content", title: "Quest taxonomy", description: "Quest objective and completion type definitions.", maxWidth: "max-w-5xl", subGroup: "Content" },
];

// ─── Lore panels ───────────────────────────────────────────────────

const LORE_PANELS: PanelDef[] = [
  { id: "lore", label: "Articles", group: "lore", host: "lore", kicker: "Codex", title: "World lore", description: "All world-building articles — characters, locations, factions, and more.", maxWidth: "max-w-7xl" },
  { id: "worldSetting", label: "World Setting", group: "lore", host: "lore", kicker: "Foundation", title: "World setting", description: "Name, overview, history, themes, geography, and magic system.", maxWidth: "max-w-5xl" },
  { ...ART_STYLE_PANEL, group: "lore", kicker: "Foundation" },
  { id: "factions", label: "Factions", group: "lore", host: "lore", kicker: "Politics", title: "Factions & organizations", description: "Political groups, guilds, and power structures.", maxWidth: "max-w-5xl" },
  { id: "codex", label: "Codex", group: "lore", host: "lore", kicker: "Reference", title: "Lore codex", description: "Wiki-style articles for places, legends, creatures, deities, and more.", maxWidth: "max-w-5xl" },
  { id: "loreMaps", label: "Maps", group: "lore", host: "lore", kicker: "Cartography", title: "World maps", description: "Upload maps, place pins, and link locations to lore articles.", maxWidth: "max-w-7xl" },
  { id: "worldPlanner", label: "World Planner", group: "lore", host: "lore", kicker: "Cartography", title: "World planner", description: "AI-powered breakdown of a world map into high-level zones with connectivity.", maxWidth: "max-w-7xl" },
  { id: "loreTimeline", label: "Timeline", group: "lore", host: "lore", kicker: "Chronicle", title: "Timeline", description: "Custom calendar systems, eras, and historical events.", maxWidth: "max-w-5xl" },
  { id: "loreRelations", label: "Relations", group: "lore", host: "lore", kicker: "Connections", title: "Relationship graph", description: "Visual graph of connections between articles, factions, and characters.", maxWidth: "max-w-7xl" },
  { id: "loreDocuments", label: "Documents", group: "lore", host: "lore", kicker: "Archive", title: "Document library", description: "Internal notes, lore bibles, and reference documents.", maxWidth: "max-w-5xl" },
  { id: "showcaseSettings", label: "Showcase", group: "lore", host: "lore", kicker: "Publication", title: "Showcase settings", description: "Branding and appearance for the published showcase site.", maxWidth: "max-w-5xl" },
  { id: "templates", label: "Templates", group: "lore", host: "lore", kicker: "Lore structure", title: "Templates", description: "Create and customize article template types and their fields.", maxWidth: "max-w-5xl" },
  { id: "sceneTemplates", label: "Scene Templates", group: "lore", host: "lore", kicker: "Narrative", title: "Scene templates", description: "Custom scene presets that appear in the story editor's template picker.", maxWidth: "max-w-5xl" },
  { id: "storyEditor", label: "Story Editor", group: "lore", host: "lore", kicker: "Narrative", title: "Story editor", description: "Compose cinematic zone stories with scenes and narration.", maxWidth: "max-w-7xl" },
];

// ─── Operations panels ──────────────────────────────────────────────

const OPERATIONS_PANELS: PanelDef[] = [
  { id: "appearance", label: "Appearance", group: "operations", host: "command", kicker: "Operations", title: "Appearance", description: "Theme color palette — pick or paste 4 colors to retheme the app.", maxWidth: "max-w-5xl" },
  { id: "services", label: "Services", group: "operations", host: "config", kicker: "Operations", title: "Services", description: "API keys, image providers, and LLM settings.", maxWidth: "max-w-5xl" },
  { id: "deployment", label: "Deployment", group: "operations", host: "config", kicker: "Operations", title: "Deployment", description: "Export, sync, and deploy your MUD.", maxWidth: "max-w-5xl" },
  { id: "sharedAssets", label: "Shared Assets", group: "operations", host: "config", kicker: "Operations", title: "Shared assets", description: "Global asset keys and image configuration.", maxWidth: "max-w-5xl" },
  { id: "rawYaml", label: "Raw YAML", group: "operations", host: "config", kicker: "Advanced", title: "Raw configuration", description: "Inspect or edit the exact serialized YAML when the structured editors are not enough.", maxWidth: "max-w-6xl" },
  { id: "versionControl", label: "Version Control", group: "operations", host: "config", kicker: "Operations", title: "Version control", description: "Git status, commits, push/pull, and conflict resolution for standalone projects.", maxWidth: "max-w-5xl" },
];

// ─── Command panels ─────────────────────────────────────────────────

const COMMAND_PANELS: PanelDef[] = [
  { id: "console", label: "Console", group: "command", host: "command", kicker: "Command", title: "Console", description: "Live logs, command output, and runtime traces.", maxWidth: "max-w-7xl" },
  { id: "admin", label: "Admin", group: "command", host: "command", kicker: "Command", title: "Admin", description: "Direct command over the living world.", maxWidth: "max-w-7xl" },
];

// ─── Aggregate ──────────────────────────────────────────────────────

// Deduped by id — a panel listed in multiple sidebar groups (e.g. artStyle
// appears in both Studio and Lore) only produces one entry here.
export const ALL_PANELS: PanelDef[] = (() => {
  const seen = new Set<string>();
  const out: PanelDef[] = [];
  for (const p of [
    ...STUDIO_PANELS,
    ...CHARACTER_PANELS,
    ...WORLD_PANELS,
    ...SYSTEMS_PANELS,
    ...LORE_PANELS,
    ...OPERATIONS_PANELS,
    ...COMMAND_PANELS,
  ]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
})();

export const PANEL_MAP: Record<string, PanelDef> = Object.fromEntries(
  ALL_PANELS.map((p) => [p.id, p]),
);

export type Workspace = "worldmaker" | "lore";

export const WORLDMAKER_GROUPS: { id: SidebarGroup; label: string; panels: PanelDef[] }[] = [
  { id: "studio", label: "Studio", panels: STUDIO_PANELS },
  { id: "characters", label: "Characters", panels: CHARACTER_PANELS },
  { id: "world", label: "World", panels: WORLD_PANELS },
  { id: "systems", label: "Systems", panels: SYSTEMS_PANELS },
  { id: "operations", label: "Operations", panels: OPERATIONS_PANELS },
  { id: "command", label: "Command", panels: COMMAND_PANELS },
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
