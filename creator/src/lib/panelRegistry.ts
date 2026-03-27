// ─── Panel registry ─────────────────────────────────────────────────
// Central source of truth for all navigable panels. The sidebar, tab
// bar, and main-area router all read from this registry.

export type SidebarGroup =
  | "studio"
  | "characters"
  | "abilities"
  | "world"
  | "content"
  | "operations";

export interface PanelDef {
  id: string;
  label: string;
  group: SidebarGroup;
  /** "config" panels share the config auto-save chrome, "studio" panels
   *  share the zone-selection state in StudioWorkspace. */
  host: "config" | "studio";
  kicker: string;
  title: string;
  description: string;
  maxWidth: string;
}

// ─── Studio panels ──────────────────────────────────────────────────

const STUDIO_PANELS: PanelDef[] = [
  { id: "home", label: "Studio", group: "studio", host: "studio", kicker: "Studio", title: "Home", description: "Atlas, recent assets, and world direction at a glance.", maxWidth: "max-w-7xl" },
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
  { id: "stats", label: "Stats", group: "abilities", host: "config", kicker: "Stats", title: "Stat definitions and bindings", description: "Primary stats and their bindings.", maxWidth: "max-w-5xl" },
  { id: "abilityDesigner", label: "Abilities", group: "abilities", host: "config", kicker: "Abilities", title: "Ability designer", description: "Class restrictions, costs, cooldowns, targets, and effects.", maxWidth: "max-w-5xl" },
  { id: "conditions", label: "Conditions", group: "abilities", host: "config", kicker: "Status effects", title: "Condition designer", description: "Status effects, stack rules, and ticking behavior.", maxWidth: "max-w-5xl" },
];

// ─── World panels ───────────────────────────────────────────────────

const WORLD_PANELS: PanelDef[] = [
  { id: "worldServer", label: "World & Server", group: "world", host: "config", kicker: "Infrastructure", title: "World & server", description: "Start room, server ports, admin API, observability, and logging.", maxWidth: "max-w-5xl" },
  { id: "combat", label: "Combat", group: "world", host: "config", kicker: "Combat loop", title: "Combat loop", description: "Tick rates, damage ranges, mob tiers, and regeneration.", maxWidth: "max-w-5xl" },
  { id: "progression", label: "Progression", group: "world", host: "config", kicker: "Progression", title: "Progression & stats", description: "Leveling curve, XP formula, and per-level rewards.", maxWidth: "max-w-5xl" },
  { id: "travel", label: "Travel", group: "world", host: "config", kicker: "Travel", title: "Travel & commands", description: "Recall, navigation, and custom commands.", maxWidth: "max-w-5xl" },
  { id: "economy", label: "Economy", group: "world", host: "config", kicker: "Economy", title: "Economy & crafting", description: "Buy/sell multipliers, crafting, skills, and station types.", maxWidth: "max-w-5xl" },
  { id: "social", label: "Social", group: "world", host: "config", kicker: "Social", title: "Social systems", description: "Groups, guilds, friends, and ranks.", maxWidth: "max-w-5xl" },
];

// ─── Content panels ─────────────────────────────────────────────────

const CONTENT_PANELS: PanelDef[] = [
  { id: "achievements", label: "Achievements", group: "content", host: "config", kicker: "Content", title: "Achievements", description: "Achievement categories and criteria types.", maxWidth: "max-w-5xl" },
  { id: "quests", label: "Quests", group: "content", host: "config", kicker: "Content", title: "Quest taxonomy", description: "Quest objective and completion type definitions.", maxWidth: "max-w-5xl" },
  { id: "sharedAssets", label: "Shared Assets", group: "content", host: "config", kicker: "Content", title: "Shared assets", description: "Global asset keys and image configuration.", maxWidth: "max-w-5xl" },
];

// ─── Operations panels ──────────────────────────────────────────────

const OPERATIONS_PANELS: PanelDef[] = [
  { id: "services", label: "Services", group: "operations", host: "config", kicker: "Operations", title: "Services", description: "API keys, image providers, and LLM settings.", maxWidth: "max-w-5xl" },
  { id: "deployment", label: "Deployment", group: "operations", host: "config", kicker: "Operations", title: "Deployment", description: "R2 sync, export, and runtime handoff.", maxWidth: "max-w-5xl" },
  { id: "rawYaml", label: "Raw YAML", group: "operations", host: "config", kicker: "Advanced", title: "Raw configuration", description: "Use this when the structured editors are not enough or when you need to inspect exact serialized data.", maxWidth: "max-w-6xl" },
];

// ─── Aggregate ──────────────────────────────────────────────────────

export const ALL_PANELS: PanelDef[] = [
  ...STUDIO_PANELS,
  ...CHARACTER_PANELS,
  ...ABILITY_PANELS,
  ...WORLD_PANELS,
  ...CONTENT_PANELS,
  ...OPERATIONS_PANELS,
];

export const PANEL_MAP: Record<string, PanelDef> = Object.fromEntries(
  ALL_PANELS.map((p) => [p.id, p]),
);

export const SIDEBAR_GROUPS: { id: SidebarGroup; label: string; panels: PanelDef[] }[] = [
  { id: "studio", label: "Studio", panels: STUDIO_PANELS },
  { id: "characters", label: "Characters", panels: CHARACTER_PANELS },
  { id: "abilities", label: "Abilities", panels: ABILITY_PANELS },
  { id: "world", label: "World", panels: WORLD_PANELS },
  { id: "content", label: "Content", panels: CONTENT_PANELS },
  { id: "operations", label: "Operations", panels: OPERATIONS_PANELS },
];

/** Build a Tab object for a panel ID. */
export function panelTab(panelId: string): { id: string; kind: "panel"; label: string; panelId: string } {
  const def = PANEL_MAP[panelId];
  return { id: `panel:${panelId}`, kind: "panel" as const, label: def?.label ?? panelId, panelId };
}
