// ─── Story scene types for the showcase cinematic renderer ─────────
// Standalone copy — no imports from creator.

export type NarrationSpeed = "slow" | "normal" | "fast";

export type EntitySlot =
  | "front-left"
  | "front-center"
  | "front-right"
  | "back-left"
  | "back-center"
  | "back-right";

export interface SceneEntity {
  id: string;
  entityType: "mob" | "item" | "npc";
  entityId: string;
  slot?: EntitySlot;
  position?: { x: number; y: number };
  entrancePath?: string;
  exitPath?: string;
}

export type TransitionType = "crossfade" | "fade_black";

export interface TransitionConfig {
  type: TransitionType;
}
