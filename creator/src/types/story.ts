// ─── Zone Story & Scene Data Model ─────────────────────────────────
// Stories are cinematic narratives composed from zone data.
// Each story contains an ordered list of scenes.

import type { NarrationSpeed } from "@/lib/narrationSpeed";

export type SceneTemplate = "establishing_shot" | "encounter" | "discovery";

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

export interface Scene {
  id: string;
  title: string;
  sortOrder: number;
  roomId?: string;
  /** Custom background image override (asset filename). When set, used instead of the room's image. */
  backgroundOverride?: string;
  narration?: string; // TipTap JSON string
  dmNotes?: string;
  template?: SceneTemplate;
  entities?: SceneEntity[];
  transition?: TransitionConfig;
  effects?: EffectConfig;
  narrationSpeed?: NarrationSpeed;
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
}
