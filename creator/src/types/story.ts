// ─── Zone Story & Scene Data Model ─────────────────────────────────
// Stories are cinematic narratives composed from zone data.
// Each story contains an ordered list of scenes.

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
  movementPath?: string; // SVG d attribute
}

/** Placeholder -- filled out in Phase 10 */
export interface TransitionConfig {
  type: "crossfade" | "fade_black" | "slide";
  duration?: number;
}

/** Placeholder -- filled out in Phase 10 */
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
  narration?: string; // TipTap JSON string
  dmNotes?: string;
  template?: SceneTemplate;
  entities?: SceneEntity[];
  transition?: TransitionConfig;
  effects?: EffectConfig;
}

export interface Story {
  id: string;
  title: string;
  zoneId: string;
  coverImage?: string; // Asset ID
  scenes: Scene[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
