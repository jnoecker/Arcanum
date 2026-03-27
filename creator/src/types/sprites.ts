// ─── Sprite definition types ────────────────────────────────────────
// These types model the sprites.yaml format used by the MUD server.

export interface SpriteVariant {
  imageId: string;
  displayName?: string;
  race?: string;
  playerClass?: string;
  gender?: string;
  imagePath: string;
}

export interface SpriteUnlock {
  type: "level" | "achievement" | "staff";
  minLevel?: number;
  achievementId?: string;
}

export interface SpriteDefinition {
  displayName: string;
  category: "level" | "achievement" | "staff";
  sortOrder: number;
  unlock: SpriteUnlock;
  variants: SpriteVariant[];
}

/** User-authored achievement sprite definition (stored in project). */
export interface AchievementSpriteDef {
  displayName: string;
  sortOrder: number;
  achievementId: string;
  /** Creative brief for image generation. */
  brief?: string;
  variants: SpriteVariant[];
}
