// ─── Island registry ────────────────────────────────────────────────
// Source of truth for the map-based shell. Each island has:
//   - metadata (title, tagline, image path)
//   - a hotspot box on the top-level mainview.jpg
//   - hotspot boxes on its own detail image, one per child panel
//
// All coordinates are percentages (0-100) of 1024x1024 images,
// measured from the yellow bounding boxes in labeledMenus/*.jpg.

import type { Island } from "./panelRegistry";

export interface HotspotBox {
  /** Top-left X as percentage (0-100) of image width. */
  x: number;
  /** Top-left Y as percentage (0-100) of image height. */
  y: number;
  /** Width as percentage (0-100) of image width. */
  w: number;
  /** Height as percentage (0-100) of image height. */
  h: number;
}

export interface IslandHotspot extends HotspotBox {
  id: Island;
}

export interface PanelHotspot extends HotspotBox {
  panelId: string;
}

export type IslandActionKind = "newZone" | "openZoneView" | "openSettings";

export interface IslandAction {
  id: string;
  label: string;
  kind: IslandActionKind;
  glyph?: string;
  hotspot: HotspotBox;
}

export interface IslandDef {
  id: Island;
  title: string;
  tagline: string;
  image: string;
  panelIds: string[];
  hotspots: PanelHotspot[];
  actions?: IslandAction[];
}

// ─── Main view hotspots ─────────────────────────────────────────────

export const MAIN_VIEW_HOTSPOTS: IslandHotspot[] = [
  { id: "orrery",      x: 10, y: 11, w: 31, h: 25 },
  { id: "loom",        x: 58, y: 10, w: 34, h: 26 },
  { id: "forge",       x:  0, y: 36, w: 33, h: 25 },
  { id: "livingWorld", x: 68, y: 39, w: 31, h: 29 },
  { id: "arcanum",     x: 11, y: 67, w: 36, h: 27 },
  { id: "spire",       x: 50, y: 69, w: 33, h: 26 },
];

// ─── Forge ──────────────────────────────────────────────────────────

const FORGE_PANELS = [
  "art", "studioAbilities", "portraits",
  "artStyle", "sprites", "media",
];

const FORGE_HOTSPOTS: PanelHotspot[] = [
  { panelId: "art",              x:  7, y:  7, w: 28, h: 26 },
  { panelId: "studioAbilities",  x: 67, y:  6, w: 27, h: 22 },
  { panelId: "media",            x:  2, y: 33, w: 28, h: 19 },
  { panelId: "portraits",        x: 76, y: 30, w: 23, h: 25 },
  { panelId: "sprites",          x:  8, y: 53, w: 27, h: 22 },
  { panelId: "artStyle",         x: 65, y: 53, w: 26, h: 19 },
];

// ─── Loom ───────────────────────────────────────────────────────────

const LOOM_PANELS = [
  "pets", "races", "classes", "abilityDesigner",
  "conditions", "commands", "equipment",
];

const LOOM_HOTSPOTS: PanelHotspot[] = [
  { panelId: "pets",             x:  5, y: 37, w: 23, h: 21 },
  { panelId: "races",            x: 10, y: 13, w: 23, h: 24 },
  { panelId: "classes",          x: 34, y: 11, w: 32, h: 24 },
  { panelId: "abilityDesigner",  x: 65, y: 17, w: 23, h: 19 },
  { panelId: "conditions",       x: 71, y: 37, w: 25, h: 22 },
  { panelId: "commands",         x: 54, y: 57, w: 28, h: 24 },
  { panelId: "equipment",        x: 17, y: 59, w: 26, h: 21 },
];

// ─── Orrery ─────────────────────────────────────────────────────────

const ORRERY_PANELS = [
  "factions", "world", "housing", "achievements",
  "enchanting", "crafting", "creation", "tuningWizard",
];

const ORRERY_HOTSPOTS: PanelHotspot[] = [
  { panelId: "factions",         x:  5, y: 16, w: 29, h: 23 },
  { panelId: "world",            x: 34, y: 12, w: 31, h: 44 },
  { panelId: "housing",          x: 66, y: 15, w: 29, h: 24 },
  { panelId: "achievements",     x: 72, y: 40, w: 28, h: 23 },
  { panelId: "enchanting",       x: 68, y: 63, w: 32, h: 22 },
  { panelId: "crafting",         x: 32, y: 70, w: 36, h: 28 },
  { panelId: "creation",         x:  0, y: 62, w: 31, h: 23 },
  { panelId: "tuningWizard",     x:  1, y: 38, w: 27, h: 24 },
];

// ─── Living World ───────────────────────────────────────────────────

const LIVING_WORLD_PANELS = [
  "currencies", "guilds", "guildHalls", "worldEvents",
  "quests", "sharedAssets", "emotes", "weatherEnvironment",
];

const LIVING_WORLD_HOTSPOTS: PanelHotspot[] = [
  { panelId: "currencies",            x:  4, y: 10, w: 25, h: 34 },
  { panelId: "guilds",                x: 29, y:  4, w: 26, h: 32 },
  { panelId: "guildHalls",            x: 61, y:  4, w: 36, h: 30 },
  { panelId: "worldEvents",           x: 30, y: 42, w: 34, h: 20 },
  { panelId: "weatherEnvironment",    x: 65, y: 36, w: 34, h: 27 },
  { panelId: "emotes",                x:  1, y: 48, w: 29, h: 31 },
  { panelId: "sharedAssets",          x: 34, y: 64, w: 31, h: 24 },
  { panelId: "quests",                x: 66, y: 64, w: 32, h: 33 },
];

// ─── Arcanum ────────────────────────────────────────────────────────

const ARCANUM_PANELS = [
  "lore", "loreMaps", "loreTimeline", "storyEditor",
  "loreRelations", "loreDocuments", "worldSetting",
];

const ARCANUM_HOTSPOTS: PanelHotspot[] = [
  { panelId: "loreTimeline",     x: 31, y:  5, w: 41, h: 17 },
  { panelId: "lore",             x:  2, y: 26, w: 18, h: 42 },
  { panelId: "loreMaps",         x: 20, y: 35, w: 26, h: 26 },
  { panelId: "storyEditor",      x: 52, y: 27, w: 22, h: 36 },
  { panelId: "loreRelations",    x: 76, y: 31, w: 23, h: 31 },
  { panelId: "loreDocuments",    x: 71, y: 63, w: 24, h: 21 },
  { panelId: "worldSetting",     x: 12, y: 82, w: 77, h: 15 },
];

// ─── Spire ──────────────────────────────────────────────────────────

const SPIRE_PANELS = [
  "serverConfig", "stats", "console",
  "deployment", "admin", "infrastructure",
];

const SPIRE_HOTSPOTS: PanelHotspot[] = [
  { panelId: "deployment",       x: 37, y:  0, w: 28, h: 58 },
  { panelId: "admin",            x: 10, y: 23, w: 25, h: 26 },
  { panelId: "serverConfig",     x:  6, y: 49, w: 27, h: 23 },
  { panelId: "stats",            x: 31, y: 73, w: 37, h: 26 },
  { panelId: "infrastructure",   x: 66, y: 51, w: 27, h: 22 },
  { panelId: "console",          x: 66, y: 29, w: 23, h: 20 },
];

// ─── Island definitions ─────────────────────────────────────────────

export const ISLANDS: Record<Island, IslandDef | null> = {
  forge: {
    id: "forge",
    title: "The Forge",
    tagline: "Where assets are created.",
    image: "/menus/forge.jpg",
    panelIds: FORGE_PANELS,
    hotspots: FORGE_HOTSPOTS,
    actions: [
      {
        id: "openZoneView",
        label: "Open Zone",
        kind: "openZoneView",
        hotspot: { x: 35, y: 35, w: 31, h: 21 },
      },
      {
        id: "newZone",
        label: "New Zone",
        kind: "newZone",
        glyph: "\u2795",
        hotspot: { x: 36, y: 64, w: 29, h: 24 },
      },
    ],
  },
  loom: {
    id: "loom",
    title: "The Loom",
    tagline: "Where the definitions of the world are crafted.",
    image: "/menus/loom.jpg",
    panelIds: LOOM_PANELS,
    hotspots: LOOM_HOTSPOTS,
  },
  orrery: {
    id: "orrery",
    title: "The Orrery",
    tagline: "Where the systems of the world are tuned and balanced.",
    image: "/menus/orrery.jpg",
    panelIds: ORRERY_PANELS,
    hotspots: ORRERY_HOTSPOTS,
  },
  livingWorld: {
    id: "livingWorld",
    title: "The Living World",
    tagline: "Where the world grows and evolves.",
    image: "/menus/livingworld.jpg",
    panelIds: LIVING_WORLD_PANELS,
    hotspots: LIVING_WORLD_HOTSPOTS,
  },
  arcanum: {
    id: "arcanum",
    title: "The Arcanum",
    tagline: "The living book of all knowledge.",
    image: "/menus/arcanum.jpg",
    panelIds: ARCANUM_PANELS,
    hotspots: ARCANUM_HOTSPOTS,
  },
  spire: {
    id: "spire",
    title: "The Spire",
    tagline: "Where the Creator exerts control.",
    image: "/menus/spire.jpg",
    panelIds: SPIRE_PANELS,
    hotspots: SPIRE_HOTSPOTS,
  },
  settings: null,
};

/** Ordered list of real (non-settings) islands for rendering the world map. */
export const MAP_ISLANDS: IslandDef[] = MAIN_VIEW_HOTSPOTS
  .map((h) => ISLANDS[h.id])
  .filter((i): i is IslandDef => !!i);

export const MAIN_VIEW_IMAGE = "/menus/mainview.jpg";

/**
 * Per-panel background overrides. When a panel has its own dedicated art,
 * MainArea uses this in preference to the parent island's map view. Panels
 * without an entry fall through to the island bg.
 */
const PANEL_BG_OVERRIDES: Record<string, string> = {
  // Forge
  art:              "/menus/panels/forge-art.jpg",
  artStyle:         "/menus/panels/forge-art-style.jpg",
  studioAbilities:  "/menus/panels/forge-icons.jpg",
  media:            "/menus/panels/forge-media.jpg",
  portraits:        "/menus/panels/forge-portraits.jpg",
  sprites:          "/menus/panels/forge-player-sprites.jpg",
  // Loom
  pets:            "/menus/panels/loom-pets.jpg",
  races:           "/menus/panels/loom-races.jpg",
  classes:         "/menus/panels/loom-classes.jpg",
  abilityDesigner: "/menus/panels/loom-abilities.jpg",
  conditions:      "/menus/panels/loom-status-effects.jpg",
  commands:        "/menus/panels/loom-commands.jpg",
  equipment:       "/menus/panels/loom-equipment.jpg",
  // Spire
  serverConfig:    "/menus/panels/spire-server-config.jpg",
  stats:           "/menus/panels/spire-stats.jpg",
  console:         "/menus/panels/spire-console.jpg",
  deployment:      "/menus/panels/spire-deployment.jpg",
  admin:           "/menus/panels/spire-admin.jpg",
  infrastructure:  "/menus/panels/spire-infrastructure.jpg",
  // Arcanum
  lore:                "/menus/panels/arcanum-articles.jpg",
  loreMaps:            "/menus/panels/arcanum-maps.jpg",
  loreTimeline:        "/menus/panels/arcanum-timeline.jpg",
  storyEditor:         "/menus/panels/arcanum-story.jpg",
  loreRelations:       "/menus/panels/arcanum-relationships.jpg",
  loreDocuments:       "/menus/panels/arcanum-documents.jpg",
  worldSetting:        "/menus/panels/arcanum-world-setting.jpg",
  // Living World
  currencies:          "/menus/panels/living-world-currency.jpg",
  guilds:              "/menus/panels/living-world-guilds.jpg",
  guildHalls:          "/menus/panels/living-world-guild-halls.jpg",
  worldEvents:         "/menus/panels/living-world-events.jpg",
  quests:              "/menus/panels/living-world-quests.jpg",
  sharedAssets:        "/menus/panels/living-world-shared-assets.jpg",
  emotes:              "/menus/panels/living-world-emotes.jpg",
  weatherEnvironment:  "/menus/panels/living-world-weather-environment.jpg",
  // Orrery
  factions:        "/menus/panels/orrery-factions.jpg",
  world:           "/menus/panels/orrery-world.jpg",
  housing:         "/menus/panels/orrery-housing.jpg",
  achievements:    "/menus/panels/orrery-achievements.jpg",
  enchanting:      "/menus/panels/orrery-enchanting.jpg",
  crafting:        "/menus/panels/orrery-crafting.jpg",
  creation:        "/menus/panels/orrery-creation.jpg",
  tuningWizard:    "/menus/panels/orrery-tuning-wizard.jpg",
};

/**
 * Atmospheric background URL for any panel that lives under a given island.
 * Used by MainArea to paint art behind every child panel, giving each editor
 * surface a sense of place. Per-panel overrides win over the parent island's
 * map view; falls back to the world map when nothing else matches.
 */
export function getIslandBg(island?: Island | null, panelId?: string | null): string {
  if (panelId) {
    const override = PANEL_BG_OVERRIDES[panelId];
    if (override) return override;
  }
  if (!island) return MAIN_VIEW_IMAGE;
  const def = ISLANDS[island];
  return def?.image ?? MAIN_VIEW_IMAGE;
}

/** Backdrop art for forge zone-action popouts (open / new zone dialogs). */
export const FORGE_OPEN_ZONE_BG = "/menus/panels/forge-open-zone.jpg";
export const FORGE_NEW_ZONE_BG = "/menus/panels/forge-new-zone.jpg";

/** Synthetic bg keys for tab kinds that don't map to a panelId. Pass these
 *  as the `panelId` argument to `getIslandBg` from MainArea. */
export const WORLD_ATLAS_BG_KEY = "__worldAtlas";
export const ZONE_EDITOR_BG_KEY = "__zoneEditor";

PANEL_BG_OVERRIDES[WORLD_ATLAS_BG_KEY] = FORGE_OPEN_ZONE_BG;
PANEL_BG_OVERRIDES[ZONE_EDITOR_BG_KEY] = "/menus/panels/map-editor.jpg";
