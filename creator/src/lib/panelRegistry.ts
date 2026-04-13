// ─── Panel registry ─────────────────────────────────────────────────
// Central source of truth for all navigable panels. The sidebar, tab
// bar, and main-area router all read from this registry.

import { AI_ENABLED } from "@/lib/featureFlags";

export type SidebarGroup =
  | "studio"
  | "characters"
  | "world"
  | "systems"
  | "lore"
  | "operations"
  | "command";

/**
 * The six map-based "islands" that organize all panels in the new shell,
 * plus a pseudo-bucket for panels that live in the unified Settings modal.
 * Every PanelDef must be tagged with exactly one island destination.
 */
export type Island =
  | "forge"
  | "loom"
  | "orrery"
  | "livingWorld"
  | "arcanum"
  | "spire"
  | "settings";

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
  /** Which map island this panel lives on. Used by the new world-map shell
   *  to decide which island view surfaces this panel as a hotspot. */
  island?: Island;
  /** Short glyph (emoji or single char) shown beside the hotspot label. */
  glyph?: string;
  /** Panel requires AI features and is hidden in the community build. */
  aiOnly?: boolean;
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
  island: "forge",
  glyph: "\u{1F3A8}",
};

const STUDIO_PANELS: PanelDef[] = [
  { id: "art", label: "Art", group: "studio", host: "studio", kicker: "Studio", title: "Art", description: "Zone vibes, entity art, defaults, and free-form generation.", maxWidth: "max-w-7xl", island: "forge", glyph: "\u{1F3A8}" },
  { id: "media", label: "Media", group: "studio", host: "studio", kicker: "Studio", title: "Media", description: "Music, ambience, and cinematic staging.", maxWidth: "max-w-7xl", island: "forge", glyph: "\u{1F5BC}\uFE0F" },
  { id: "portraits", label: "Portraits", group: "studio", host: "studio", kicker: "Studio", title: "Portraits", description: "Race and class portrait creation.", maxWidth: "max-w-7xl", island: "forge", glyph: "\u{1F464}", aiOnly: true },
  { id: "studioAbilities", label: "Icons", group: "studio", host: "studio", kicker: "Studio", title: "Icons", description: "Ability and status-effect icon generation.", maxWidth: "max-w-7xl", island: "forge", glyph: "\u{1F532}", aiOnly: true },
  { id: "sprites", label: "Player Sprites", group: "studio", host: "command", kicker: "Studio", title: "Player sprites", description: "Visible identity, unlockable variants, and portrait logic.", maxWidth: "max-w-7xl", island: "forge", glyph: "\u{1F9CD}" },
  ART_STYLE_PANEL,
];

// ─── Character panels (includes former Ability panels) ─────────────

const CHARACTER_PANELS: PanelDef[] = [
  { id: "classes", label: "Classes", group: "characters", host: "config", kicker: "Classes", title: "Class designer", description: "Class identity, scaling, visual direction, and start-room overrides.", maxWidth: "max-w-5xl", subGroup: "Identity", island: "loom", glyph: "\u2692\uFE0F" },
  { id: "races", label: "Races", group: "characters", host: "config", kicker: "Races", title: "Race designer", description: "Race lore, traits, stat modifiers, portraits, and staff-tier overrides.", maxWidth: "max-w-5xl", subGroup: "Identity", island: "loom", glyph: "\u{1F3FA}" },
  { id: "creation", label: "Creation", group: "characters", host: "config", kicker: "Character foundations", title: "Character creation", description: "Starting state and gender definitions.", maxWidth: "max-w-5xl", subGroup: "Identity", island: "orrery", glyph: "\u{1F300}" },
  { id: "equipment", label: "Equipment", group: "characters", host: "config", kicker: "Equipment", title: "Equipment slots", description: "Wear slots and layout.", maxWidth: "max-w-5xl", subGroup: "Identity", island: "loom", glyph: "\u{1F6E1}\uFE0F" },
  { id: "stats", label: "Stats", group: "characters", host: "config", kicker: "Stats", title: "Stat definitions", description: "Primary stats, abbreviations, and base values.", maxWidth: "max-w-5xl", subGroup: "Powers", island: "spire", glyph: "\u{1F4CA}" },
  { id: "abilityDesigner", label: "Abilities", group: "characters", host: "config", kicker: "Abilities", title: "Ability designer", description: "Class restrictions, costs, cooldowns, targets, and effects.", maxWidth: "max-w-5xl", subGroup: "Powers", island: "loom", glyph: "\u26A1" },
  { id: "conditions", label: "Conditions", group: "characters", host: "config", kicker: "Status effects", title: "Condition designer", description: "Status effects, stack rules, and ticking behavior.", maxWidth: "max-w-5xl", subGroup: "Powers", island: "loom", glyph: "\u{1F9EA}" },
];

// ─── World panels ───────────────────────────────────────────────────

const WORLD_PANELS: PanelDef[] = [
  { id: "tuningWizard", label: "Tuning Wizard", group: "world", host: "command", kicker: "World", title: "Tuning Wizard", description: "Configure all game balance — presets, inline editing, and before/after comparison.", maxWidth: "max-w-7xl", island: "orrery", glyph: "\u2699\uFE0F" },
  { id: "world", label: "World", group: "world", host: "config", kicker: "World topology", title: "World", description: "Default spawn room and per-class start-room overrides.", maxWidth: "max-w-5xl", island: "orrery", glyph: "\u{1F30D}" },
  { id: "serverConfig", label: "Server Config", group: "world", host: "config", kicker: "Server runtime", title: "Server config", description: "Ports, event loop, admin API, observability, and logging for the MUD server process.", maxWidth: "max-w-5xl", island: "spire", glyph: "\u{1F9EC}" },
  { id: "infrastructure", label: "Infrastructure", group: "world", host: "config", kicker: "Deployment", title: "Infrastructure", description: "Deployment mode, persistence, login, transport, database, Redis, gRPC, gateway, and sharding.", maxWidth: "max-w-5xl", island: "orrery", glyph: "\u{1F3D7}\uFE0F" },
  { id: "commands", label: "Commands", group: "world", host: "config", kicker: "Commands", title: "Command designer", description: "Custom commands, usage strings, and categories.", maxWidth: "max-w-5xl", island: "loom", glyph: "\u{1F58B}\uFE0F" },
];

// ─── Systems panels ────────────────────────────────────────────────

const SYSTEMS_PANELS: PanelDef[] = [
  { id: "currencies", label: "Currencies", group: "systems", host: "config", kicker: "Economy", title: "Secondary currencies", description: "Quest points, honor, crafting tokens, and other non-gold currencies.", maxWidth: "max-w-5xl", subGroup: "Economy", island: "livingWorld", glyph: "\u{1F4B0}" },
  { id: "crafting", label: "Crafting", group: "systems", host: "config", kicker: "Crafting", title: "Crafting & gathering", description: "Skill leveling, station types, gathering, and recipes.", maxWidth: "max-w-5xl", subGroup: "Economy", island: "orrery", glyph: "\u{1F4DC}" },
  { id: "enchanting", label: "Enchanting", group: "systems", host: "config", kicker: "Enchanting", title: "Enchanting system", description: "Enchantment definitions, materials, stat bonuses, and target slots.", maxWidth: "max-w-5xl", subGroup: "Economy", island: "orrery", glyph: "\u2728" },
  { id: "guilds", label: "Guilds", group: "systems", host: "config", kicker: "Guilds", title: "Guild system", description: "Guild ranks, permissions, friends, and defaults.", maxWidth: "max-w-5xl", subGroup: "Social", island: "livingWorld", glyph: "\u{1F3DB}\uFE0F" },
  { id: "guildHalls", label: "Guild Halls", group: "systems", host: "config", kicker: "Social", title: "Guild halls", description: "Guild housing costs, room templates, and hall configuration.", maxWidth: "max-w-5xl", subGroup: "Social", island: "livingWorld", glyph: "\u{1F3E0}" },
  { id: "factions", label: "Factions", group: "systems", host: "config", kicker: "Factions", title: "Faction system", description: "Reputation factions, enemy relationships, and quest rewards.", maxWidth: "max-w-5xl", subGroup: "Social", island: "orrery", glyph: "\u{1F3DB}\uFE0F" },
  { id: "emotes", label: "Emotes", group: "systems", host: "config", kicker: "Social", title: "Emote presets", description: "Quick-action emotes available to players in the chat panel.", maxWidth: "max-w-5xl", subGroup: "Social", island: "livingWorld", glyph: "\u{1F60A}" },
  { id: "housing", label: "Housing", group: "systems", host: "config", kicker: "Housing", title: "Player housing", description: "Room templates, costs, and housing system settings.", maxWidth: "max-w-5xl", subGroup: "Living World", island: "orrery", glyph: "\u{1F3E0}" },
  { id: "pets", label: "Pets", group: "systems", host: "config", kicker: "Companions", title: "Pet system", description: "Define pet templates that can be summoned by abilities.", maxWidth: "max-w-5xl", subGroup: "Living World", island: "loom", glyph: "\u{1F43E}" },
  { id: "worldEvents", label: "Events", group: "systems", host: "config", kicker: "Seasonal", title: "World events", description: "Seasonal events with date schedules, flags, and broadcast messages.", maxWidth: "max-w-5xl", subGroup: "Living World", island: "livingWorld", glyph: "\u{1F342}" },
  { id: "weatherEnvironment", label: "Weather & Environment", group: "systems", host: "config", kicker: "Atmosphere", title: "Weather & environment", description: "Weather types, mote colors, sky gradients, room transitions, and per-zone visual overrides.", maxWidth: "max-w-5xl", subGroup: "Living World", island: "livingWorld", glyph: "\u{1F342}" },
  { id: "achievements", label: "Achievements", group: "systems", host: "config", kicker: "Content", title: "Achievements", description: "Achievement builder, categories, and criterion types.", maxWidth: "max-w-5xl", subGroup: "Content", island: "orrery", glyph: "\u{1F3C6}" },
  { id: "quests", label: "Quests", group: "systems", host: "config", kicker: "Content", title: "Quest taxonomy", description: "Quest objective and completion type definitions.", maxWidth: "max-w-5xl", subGroup: "Content", island: "livingWorld", glyph: "\u{1F4DC}" },
];

// ─── Lore panels ───────────────────────────────────────────────────

const LORE_PANELS: PanelDef[] = [
  { id: "lore", label: "Articles", group: "lore", host: "lore", kicker: "Codex", title: "World lore", description: "All world-building articles — characters, locations, factions, and more.", maxWidth: "max-w-7xl", island: "arcanum", glyph: "\u{1F4DC}" },
  { id: "worldSetting", label: "World Setting", group: "lore", host: "lore", kicker: "Foundation", title: "World setting", description: "Name, overview, history, themes, geography, and magic system.", maxWidth: "max-w-5xl", island: "arcanum", glyph: "\u{1F30C}" },
  { ...ART_STYLE_PANEL, group: "lore", kicker: "Foundation" },
  { id: "loreMaps", label: "Maps", group: "lore", host: "lore", kicker: "Cartography", title: "World maps", description: "Upload maps, place pins, link locations, and plan world zones.", maxWidth: "max-w-7xl", island: "arcanum", glyph: "\u{1F5FA}\uFE0F" },
  { id: "loreTimeline", label: "Timeline", group: "lore", host: "lore", kicker: "Chronicle", title: "Timeline", description: "Custom calendar systems, eras, and historical events.", maxWidth: "max-w-7xl", island: "arcanum", glyph: "\u231B" },
  { id: "loreRelations", label: "Relations", group: "lore", host: "lore", kicker: "Connections", title: "Relationship graph", description: "Visual graph of connections between articles, factions, and characters.", maxWidth: "max-w-7xl", island: "arcanum", glyph: "\u{1F517}" },
  { id: "loreDocuments", label: "Documents", group: "lore", host: "lore", kicker: "Archive", title: "Document library", description: "Internal notes, lore bibles, and reference documents.", maxWidth: "max-w-5xl", island: "arcanum", glyph: "\u{1F4C4}" },
  { id: "hubSettings", label: "Arcanum Hub", group: "lore", host: "config", kicker: "Publication", title: "Arcanum Hub", description: "Hub API credentials, AI routing, and per-world publishing settings.", maxWidth: "max-w-5xl", island: "settings", glyph: "\u{1F310}" },
  { id: "showcaseSettings", label: "Showcase", group: "lore", host: "lore", kicker: "Publication", title: "Showcase settings", description: "Branding and appearance for the published showcase site.", maxWidth: "max-w-5xl", island: "settings", glyph: "\u{1F4F0}" },
  { id: "templates", label: "Templates", group: "lore", host: "lore", kicker: "Lore structure", title: "Templates", description: "Create and customize article template types and their fields.", maxWidth: "max-w-5xl", island: "settings", glyph: "\u{1F4D1}" },
  { id: "sceneTemplates", label: "Scene Templates", group: "lore", host: "lore", kicker: "Narrative", title: "Scene templates", description: "Custom scene presets that appear in the story editor's template picker.", maxWidth: "max-w-5xl", island: "settings", glyph: "\u{1F3AC}" },
  { id: "storyEditor", label: "Story Editor", group: "lore", host: "lore", kicker: "Narrative", title: "Story editor", description: "Compose cinematic zone stories with scenes and narration.", maxWidth: "max-w-7xl", island: "arcanum", glyph: "\u{1F3AC}" },
];

// ─── Operations panels ──────────────────────────────────────────────

const OPERATIONS_PANELS: PanelDef[] = [
  { id: "appearance", label: "Appearance", group: "operations", host: "command", kicker: "Operations", title: "Appearance", description: "Theme color palette — pick or paste 4 colors to retheme the app.", maxWidth: "max-w-5xl", island: "settings", glyph: "\u{1F3A8}" },
  { id: "services", label: "Services", group: "operations", host: "config", kicker: "Operations", title: "Services", description: "Provider API keys and per-project AI pipeline.", maxWidth: "max-w-5xl", island: "settings", glyph: "\u{1F511}" },
  { id: "r2Settings", label: "Cloudflare R2", group: "operations", host: "config", kicker: "Operations", title: "Cloudflare R2", description: "Asset CDN credentials for self-hosted deployments.", maxWidth: "max-w-5xl", island: "settings", glyph: "\u2601\uFE0F" },
  { id: "deployment", label: "Deployment", group: "operations", host: "config", kicker: "Operations", title: "Deployment", description: "Export, sync, and deploy your MUD.", maxWidth: "max-w-5xl", island: "spire", glyph: "\u{1F680}" },
  { id: "sharedAssets", label: "Shared Assets", group: "operations", host: "config", kicker: "Operations", title: "Shared assets", description: "Global asset keys and image configuration.", maxWidth: "max-w-5xl", island: "livingWorld", glyph: "\u{1F4E6}" },
  { id: "rawYaml", label: "Raw YAML", group: "operations", host: "config", kicker: "Advanced", title: "Raw configuration", description: "Inspect or edit the exact serialized YAML when the structured editors are not enough.", maxWidth: "max-w-6xl", island: "settings", glyph: "\u{1F4DD}" },
  { id: "versionControl", label: "Version Control", group: "operations", host: "config", kicker: "Operations", title: "Version control", description: "Git status, commits, push/pull, and conflict resolution for standalone projects.", maxWidth: "max-w-5xl", island: "settings", glyph: "\u{1F33F}" },
];

// ─── Command panels ─────────────────────────────────────────────────

const COMMAND_PANELS: PanelDef[] = [
  { id: "console", label: "Console", group: "command", host: "command", kicker: "Command", title: "Console", description: "Live logs, command output, and runtime traces.", maxWidth: "max-w-7xl", island: "spire", glyph: "\u{1F5A5}\uFE0F" },
  { id: "admin", label: "Admin", group: "command", host: "command", kicker: "Command", title: "Admin", description: "Direct command over the living world.", maxWidth: "max-w-7xl", island: "spire", glyph: "\u{1F451}" },
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
    if (p.aiOnly && !AI_ENABLED) continue;
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
  { id: "studio", label: "Studio", panels: STUDIO_PANELS.filter(p => !p.aiOnly || AI_ENABLED) },
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

/** Return all panels tagged for a given island, in registry order. */
export function panelsForIsland(island: Island): PanelDef[] {
  return ALL_PANELS.filter((p) => p.island === island);
}
