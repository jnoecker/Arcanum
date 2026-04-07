// ─── Zone Story & Scene Data Model ─────────────────────────────────
// Stories are cinematic narratives composed from zone data.
// Each story contains an ordered list of scenes.

import type { NarrationSpeed } from "@/lib/narrationSpeed";

/**
 * Built-in scene template IDs. User-defined custom templates store their own
 * IDs as plain strings, so `Scene.template` is widened to `SceneTemplateId`.
 */
export type SceneTemplate = "establishing_shot" | "encounter" | "discovery";

/** ID for either a built-in or custom scene template (lives in WorldLore.customSceneTemplates). */
export type SceneTemplateId = SceneTemplate | string;

/** Preset slot positions for entity placement in a scene. */
export type EntitySlot =
  | "front-left" | "front-center" | "front-right"
  | "back-left" | "back-center" | "back-right";

/** Entity in a scene -- positioned via preset slot or custom coordinates. */
export interface SceneEntity {
  id: string;
  entityType: "mob" | "item" | "npc";
  entityId: string;
  slot?: EntitySlot;
  position?: { x: number; y: number };
  entrancePath?: string; // Preset ID from ENTRANCE_PRESETS (e.g., "enter-from-left")
  exitPath?: string;     // Preset ID from EXIT_PRESETS (e.g., "exit-stage-left")
  /** Custom image override (asset filename). When set, used instead of the zone entity's image. */
  imageOverride?: string;
  /** Display name override for custom entities not tied to a zone entity. */
  nameOverride?: string;
}

/** Transition type between scenes. */
export type TransitionType = "crossfade" | "fade_black";

export interface TransitionConfig {
  type: TransitionType;
}

/** Visual effects for a scene. */
export interface EffectConfig {
  particles?: string; // preset name
  parallaxLayers?: number;
  parallaxDepth?: number;
}

/** Title card overlay shown above the scene (distinct from bottom narration). */
export type TitleCardStyle = "location" | "year" | "subtitle" | "character";

export interface TitleCard {
  text: string;
  style?: TitleCardStyle;
}

export interface Scene {
  id: string;
  title: string;
  sortOrder: number;
  roomId?: string;
  /** Custom background image override (asset filename). When set, used instead of the room's image. */
  backgroundOverride?: string;
  narration?: string; // TipTap JSON string
  dmNotes?: string;
  template?: SceneTemplateId;
  entities?: SceneEntity[];
  transition?: TransitionConfig;
  effects?: EffectConfig;
  narrationSpeed?: NarrationSpeed;

  // ─── Lore links ──────────────────────────────────────────────────
  /** Featured lore article IDs for this scene (characters, items, etc). */
  linkedArticleIds?: string[];
  /** Article ID for the location this scene depicts. */
  linkedLocationArticleId?: string;
  /** Map ID this scene is positioned on. */
  linkedMapId?: string;
  /** Pin ID on the linked map. */
  linkedPinId?: string;
  /** Timeline event ID this scene depicts. */
  linkedTimelineEventId?: string;

  // ─── Visual overlays ──────────────────────────────────────────────
  /** Title card text overlay (top-center, distinct from narration). */
  titleCard?: TitleCard;
}

export interface Story {
  id: string;
  title: string;
  zoneId: string;
  coverImage?: string; // Asset ID
  scenes: Scene[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  narrationSpeed?: NarrationSpeed; // Story-level default, defaults to "normal"

  // ─── Story metadata ──────────────────────────────────────────────
  /** Short logline / pitch for this story. */
  synopsis?: string;
  /** Free-form tags for organization. */
  tags?: string[];
  /** Draft stories are excluded from the showcase export. */
  draft?: boolean;

  // ─── Story-level lore links ──────────────────────────────────────
  /** Featured lore article IDs for the story as a whole. */
  linkedArticleIds?: string[];
  /** Article IDs of characters featured in this story. */
  featuredCharacterIds?: string[];
  /** Primary map for the story (e.g. world map for context). */
  primaryMapId?: string;
  /** Primary calendar system to drive timeline display. */
  primaryCalendarId?: string;

  // ─── Exported cinematic ──────────────────────────────────────────
  /**
   * Public URL of the showcase-preset MP4 cinematic, set after
   * deployStoryVideoToR2 uploads it to R2. When present, the
   * showcase SPA shows a "Watch cinematic" button on the story
   * player page.
   */
  cinematicUrl?: string;
}
