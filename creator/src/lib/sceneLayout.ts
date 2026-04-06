import type { EntitySlot, SceneEntity } from "@/types/story";

// ─── Preset slot definitions ──────────────────────────────────────

/** Preset positions for entity placement in a scene (percentage-based coordinates). */
export const PRESET_SLOTS: Record<EntitySlot, { x: number; y: number }> = {
  "front-left":   { x: 20, y: 72 },
  "front-center": { x: 50, y: 72 },
  "front-right":  { x: 80, y: 72 },
  "back-left":    { x: 25, y: 48 },
  "back-center":  { x: 50, y: 48 },
  "back-right":   { x: 75, y: 48 },
};

/** Priority order for auto-assigning entity slots. */
export const SLOT_ORDER: EntitySlot[] = [
  "front-center", "front-left", "front-right",
  "back-center", "back-left", "back-right",
];

// ─── Slot distribution ────────────────────────────────────────────

/**
 * Returns the next available slot from SLOT_ORDER that is not in occupiedSlots.
 * Falls back to "front-center" when all slots are occupied.
 */
export function getNextSlot(occupiedSlots: EntitySlot[]): EntitySlot {
  const occupied = new Set(occupiedSlots);
  for (const slot of SLOT_ORDER) {
    if (!occupied.has(slot)) return slot;
  }
  return "front-center";
}

// ─── Position resolution ──────────────────────────────────────────

/**
 * Resolves the display position for an entity.
 * Priority: custom position > preset slot > front-center fallback.
 */
export function resolveEntityPosition(entity: SceneEntity): { x: number; y: number } {
  if (entity.position) return entity.position;
  if (entity.slot) return PRESET_SLOTS[entity.slot];
  return PRESET_SLOTS["front-center"];
}

// ─── Row detection & scale ────────────────────────────────────────

/** Returns true if the slot is in the back row. */
export function isBackRow(slot?: EntitySlot): boolean {
  if (!slot) return false;
  return slot.startsWith("back-");
}

/**
 * Returns the visual scale factor for an entity.
 * Back-row entities render at 0.78x for depth perception; front-row at 1.0x.
 */
export function getEntityScale(entity: SceneEntity): number {
  if (entity.slot && isBackRow(entity.slot)) return 0.78;
  return 1.0;
}

// ─── Position clamping ────────────────────────────────────────────

/** Clamps a position to the 0-100 percentage range. */
export function clampPosition(pos: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(100, pos.x)),
    y: Math.max(0, Math.min(100, pos.y)),
  };
}

// ─── TipTap plain text extraction ─────────────────────────────────

interface TipTapNode {
  type: string;
  text?: string;
  content?: TipTapNode[];
  marks?: Array<{ type: string }>;
}

/** Recursively extracts text from a TipTap JSON node. */
function walkTextNodes(node: TipTapNode): string {
  if (node.type === "text" && node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(walkTextNodes).join("");
}

/**
 * Extracts plain text from a TipTap JSON narration string.
 * Joins paragraphs with newlines. Returns "" on empty input or parse error.
 */
export function extractPlainText(narrationJson: string): string {
  if (!narrationJson) return "";
  try {
    const doc: TipTapNode = JSON.parse(narrationJson);
    if (!doc.content) return "";
    return doc.content
      .map((block) => walkTextNodes(block))
      .filter((text) => text.length > 0)
      .join("\n");
  } catch {
    return "";
  }
}

/**
 * Extracts individual words from TipTap JSON narration for typewriter animation.
 * Returns an empty array for empty/invalid content.
 */
export function extractWords(narrationJson: string): string[] {
  const text = extractPlainText(narrationJson);
  if (!text) return [];
  return text.split(/\s+/).filter(Boolean);
}
