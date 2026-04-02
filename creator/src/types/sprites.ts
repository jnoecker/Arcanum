// ─── Sprite definition types ────────────────────────────────────────
// These types model the sprites.yaml format used by the MUD server.
// Sprites use a requirements-based unlock system with AND logic.

// ─── Sprite variants ────────────────────────────────────────────────

export interface SpriteVariant {
  imageId: string;
  displayName?: string;
  race?: string;
  playerClass?: string;
  gender?: string;
  imagePath: string;
}

// ─── Requirements (AND logic) ───────────────────────────────────────

export interface MinLevelRequirement {
  type: "minLevel";
  level: number;
}

export interface RaceRequirement {
  type: "race";
  race: string;
}

export interface ClassRequirement {
  type: "class";
  playerClass: string;
}

export interface AchievementRequirement {
  type: "achievement";
  achievementId: string;
}

export interface StaffRequirement {
  type: "staff";
}

export type SpriteRequirement =
  | MinLevelRequirement
  | RaceRequirement
  | ClassRequirement
  | AchievementRequirement
  | StaffRequirement;

export type RequirementType = SpriteRequirement["type"];

// ─── Sprite definition ──────────────────────────────────────────────

export interface SpriteDefinition {
  displayName: string;
  description?: string;
  category: "general" | "staff";
  sortOrder: number;
  requirements: SpriteRequirement[];
  /** Single-image shorthand — creates one variant with the sprite's ID as imageId. */
  image?: string;
  /** Multi-variant list. Takes precedence over `image` when both are present. */
  variants?: SpriteVariant[];
}
