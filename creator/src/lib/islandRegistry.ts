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

export type IslandActionKind = "newZone" | "openZoneView";

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
  { id: "orrery",      x:  1, y:  2, w: 33, h: 39 },
  { id: "loom",        x: 34, y:  2, w: 33, h: 39 },
  { id: "forge",       x: 67, y:  2, w: 32, h: 39 },
  { id: "livingWorld", x:  1, y: 41, w: 34, h: 43 },
  { id: "arcanum",     x: 35, y: 41, w: 33, h: 43 },
  { id: "spire",       x: 68, y: 41, w: 31, h: 43 },
];

// ─── Forge ──────────────────────────────────────────────────────────

const FORGE_PANELS = [
  "art", "studioAbilities", "portraits",
  "artStyle", "sprites", "media",
];

const FORGE_HOTSPOTS: PanelHotspot[] = [
  { panelId: "art",              x:  8, y:  8, w: 23, h: 21 },
  { panelId: "studioAbilities",  x: 65, y:  8, w: 23, h: 20 },
  { panelId: "portraits",        x: 75, y: 27, w: 22, h: 21 },
  { panelId: "artStyle",         x: 65, y: 49, w: 24, h: 18 },
  { panelId: "sprites",          x: 11, y: 49, w: 23, h: 19 },
  { panelId: "media",            x:  3, y: 32, w: 23, h: 17 },
];

// ─── Loom ───────────────────────────────────────────────────────────

const LOOM_PANELS = [
  "pets", "races", "classes", "abilityDesigner",
  "conditions", "commands", "equipment",
];

const LOOM_HOTSPOTS: PanelHotspot[] = [
  { panelId: "pets",             x:  0, y: 41, w: 27, h: 24 },
  { panelId: "races",            x:  0, y: 18, w: 27, h: 23 },
  { panelId: "classes",          x: 28, y: 12, w: 24, h: 23 },
  { panelId: "abilityDesigner",  x: 52, y: 12, w: 22, h: 20 },
  { panelId: "conditions",       x: 74, y: 20, w: 26, h: 22 },
  { panelId: "commands",         x: 74, y: 42, w: 26, h: 24 },
  { panelId: "equipment",        x: 28, y: 54, w: 28, h: 20 },
];

// ─── Orrery ─────────────────────────────────────────────────────────

const ORRERY_PANELS = [
  "factions", "worldServer", "housing", "achievements",
  "enchanting", "crafting", "creation", "tuningWizard",
];

const ORRERY_HOTSPOTS: PanelHotspot[] = [
  { panelId: "factions",         x:  6, y: 25, w: 24, h: 17 },
  { panelId: "worldServer",      x: 33, y: 24, w: 33, h: 35 },
  { panelId: "housing",          x: 68, y: 24, w: 28, h: 18 },
  { panelId: "achievements",     x: 69, y: 43, w: 27, h: 22 },
  { panelId: "enchanting",       x: 66, y: 65, w: 33, h: 23 },
  { panelId: "crafting",         x: 30, y: 64, w: 36, h: 24 },
  { panelId: "creation",         x:  1, y: 64, w: 29, h: 20 },
  { panelId: "tuningWizard",     x:  3, y: 42, w: 27, h: 22 },
];

// ─── Living World ───────────────────────────────────────────────────

const LIVING_WORLD_PANELS = [
  "currencies", "guilds", "guildHalls", "worldEvents",
  "quests", "achievementDefs", "emotes", "weatherEnvironment",
];

const LIVING_WORLD_HOTSPOTS: PanelHotspot[] = [
  { panelId: "currencies",            x:  1, y: 18, w: 22, h: 33 },
  { panelId: "guilds",                x: 23, y:  4, w: 19, h: 34 },
  { panelId: "guildHalls",            x: 47, y:  3, w: 37, h: 39 },
  { panelId: "worldEvents",           x: 27, y: 46, w: 47, h: 15 },
  { panelId: "weatherEnvironment",    x: 78, y: 24, w: 22, h: 30 },
  { panelId: "quests",                x: 67, y: 54, w: 33, h: 35 },
  { panelId: "achievementDefs",       x: 33, y: 65, w: 34, h: 24 },
  { panelId: "emotes",                x:  1, y: 51, w: 29, h: 20 },
];

// ─── Arcanum ────────────────────────────────────────────────────────

const ARCANUM_PANELS = [
  "lore", "loreMaps", "loreTimeline", "storyEditor",
  "loreRelations", "loreDocuments", "worldSetting",
];

const ARCANUM_HOTSPOTS: PanelHotspot[] = [
  { panelId: "loreTimeline",     x: 33, y: 16, w: 35, h: 11 },
  { panelId: "lore",             x:  6, y: 40, w: 16, h: 24 },
  { panelId: "loreMaps",         x: 22, y: 41, w: 27, h: 18 },
  { panelId: "storyEditor",      x: 51, y: 34, w: 22, h: 25 },
  { panelId: "loreRelations",    x: 70, y: 47, w: 25, h: 13 },
  { panelId: "loreDocuments",    x: 71, y: 60, w: 21, h: 13 },
  { panelId: "worldSetting",     x: 36, y: 73, w: 29, h: 13 },
];

// ─── Spire ──────────────────────────────────────────────────────────

const SPIRE_PANELS = [
  "characterSprites", "stats", "sharedAssets",
  "console", "deployment", "admin",
];

const SPIRE_HOTSPOTS: PanelHotspot[] = [
  { panelId: "characterSprites", x: 23, y: 72, w: 54, h: 12 },
  { panelId: "stats",            x: 29, y: 60, w: 42, h: 12 },
  { panelId: "sharedAssets",     x: 33, y: 48, w: 35, h: 12 },
  { panelId: "console",          x: 35, y: 36, w: 30, h: 12 },
  { panelId: "deployment",       x: 40, y: 23, w: 21, h: 13 },
  { panelId: "admin",            x: 42, y: 10, w: 16, h: 12 },
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
        hotspot: { x: 36, y: 16, w: 28, h: 31 },
      },
      {
        id: "newZone",
        label: "New Zone",
        kind: "newZone",
        glyph: "\u2795",
        hotspot: { x: 35, y: 57, w: 30, h: 22 },
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
