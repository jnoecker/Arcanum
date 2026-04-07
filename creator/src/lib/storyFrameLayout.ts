// ─── Story Frame Layout ──────────────────────────────────────────
// Pure, deterministic layout math for converting a scene into the
// rectangles needed to composite a single video frame.
//
// Inputs: scene data + resolved entity metadata (names, natural image
// dimensions) + target video dimensions.
// Output: a SceneFrameLayout with explicit source/dest rects that a
// canvas renderer can feed directly into ctx.drawImage.
//
// Separated from the canvas renderer so layout math is unit-testable
// without jsdom canvas quirks.

import { resolveEntityPosition, isBackRow, getEntityScale } from "@/lib/sceneLayout";
import type { Scene, SceneEntity } from "@/types/story";

// ─── Constants ───────────────────────────────────────────────────

/**
 * Entity sprite width as a fraction of target viewport width.
 * Derived from the in-app preview's 148px-at-800px convention
 * (creator/src/components/lore/AnimatedEntity.tsx). Video export
 * uses a fraction rather than absolute pixels so sprites scale
 * proportionally across preset sizes.
 */
const ENTITY_WIDTH_RATIO = 148 / 800; // ≈ 0.185

/** Default sprite aspect ratio when the entity image size is unknown. */
const DEFAULT_SPRITE_ASPECT = 1 / 1.2; // width/height, matches placeholder

/** Back-row entity opacity (matches AnimatedEntity's 0.9). */
const BACK_ROW_OPACITY = 0.9;

/** Title card box dimensions as fractions of the target frame. */
const TITLE_CARD_BOX = {
  topPct: 0.08,      // 8% from top
  widthPct: 0.6,     // 60% of frame width
  heightPct: 0.1,    // 10% of frame height
};

/** Caption box (bottom third gradient) as fraction of the target frame. */
const CAPTION_BOX = {
  topPct: 0.78,
  widthPct: 0.88,
  heightPct: 0.18,
};

// ─── Types ───────────────────────────────────────────────────────

/** A rectangular region in pixel coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How to fit the room background into the target aspect ratio.
 *
 * - `fit` — scale the source so it fully fits inside the target,
 *   letterboxing/pillarboxing the remainder with a fill color.
 * - `fill` — scale to cover the target, cropping source edges.
 * - `crop_center` — zoom to target aspect, cropping evenly from
 *   source center. Same as `fill` but with source centered.
 */
export type BackgroundFit = "fit" | "fill" | "crop_center";

/** Resolved background layer for a frame. */
export interface BackgroundLayout {
  /**
   * Source crop rect in the input image (`sx`, `sy`, `sWidth`, `sHeight`
   * for `ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)`).
   */
  src: Rect;
  /** Destination rect in the output frame. */
  dst: Rect;
  /**
   * When `fit` leaves empty space, the color/pattern used to fill the
   * padding. `null` means transparent (caller can fill with black or
   * draw a blurred source behind).
   */
  fillColor: string | null;
}

/** Resolved placement for a single entity sprite. */
export interface EntityLayout {
  entityId: string;
  /** Display name for the label beneath the sprite. */
  name: string;
  /** Destination rect in the output frame. */
  dst: Rect;
  /** Opacity to draw at (0..1). */
  opacity: number;
  /** True if this entity sits on the back row (smaller + more faded). */
  isBackRow: boolean;
  /** Whether this entity has a source image. When false, draw a placeholder. */
  hasImage: boolean;
}

export interface TitleCardLayout {
  text: string;
  style: NonNullable<Scene["titleCard"]>["style"];
  rect: Rect;
}

export interface CaptionLayout {
  /** Full lower-third rect to draw the caption gradient + text inside. */
  rect: Rect;
}

/** Complete frame layout for one scene at one moment in time. */
export interface SceneFrameLayout {
  width: number;
  height: number;
  background: BackgroundLayout | null;
  /**
   * Entities split into layers so the renderer can draw back row under
   * the front row (matches CinematicScene z-ordering).
   */
  backRowEntities: EntityLayout[];
  frontRowEntities: EntityLayout[];
  titleCard: TitleCardLayout | null;
  captionArea: CaptionLayout;
}

/** Input entity info passed into the layout function. */
export interface LayoutEntityInfo {
  entity: SceneEntity;
  name: string;
  /** Natural image dimensions in pixels. Undefined → placeholder. */
  imageSize?: { width: number; height: number };
}

export interface LayoutOptions {
  fit?: BackgroundFit;
  /** Fill color used when `fit` leaves empty space. Default "#000". */
  fillColor?: string;
}

// ─── Background fit math ─────────────────────────────────────────

/**
 * Computes the source + destination rects for fitting a source image
 * into target dimensions with the given strategy.
 */
export function computeBackgroundFit(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: BackgroundFit,
): { src: Rect; dst: Rect } {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  if (fit === "fit") {
    // Letterbox / pillarbox: full source visible, possibly padded in dest.
    const src: Rect = { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
    if (sourceAspect > targetAspect) {
      // Source is wider than target → scale to target width, pillarbox.
      const dstHeight = Math.round(targetWidth / sourceAspect);
      return {
        src,
        dst: {
          x: 0,
          y: Math.round((targetHeight - dstHeight) / 2),
          width: targetWidth,
          height: dstHeight,
        },
      };
    }
    // Source is taller → scale to target height, letterbox.
    const dstWidth = Math.round(targetHeight * sourceAspect);
    return {
      src,
      dst: {
        x: Math.round((targetWidth - dstWidth) / 2),
        y: 0,
        width: dstWidth,
        height: targetHeight,
      },
    };
  }

  // `fill` and `crop_center` both cover the full target; they differ in
  // how much of the source gets cropped. For `crop_center`, crop evenly
  // from the source center (which is what `fill` does too in practice —
  // we keep them separate for future "smart" crop variants).
  const dst: Rect = { x: 0, y: 0, width: targetWidth, height: targetHeight };
  if (sourceAspect > targetAspect) {
    // Source wider — crop source left/right.
    const cropWidth = Math.round(sourceHeight * targetAspect);
    const cropX = Math.round((sourceWidth - cropWidth) / 2);
    return {
      src: { x: cropX, y: 0, width: cropWidth, height: sourceHeight },
      dst,
    };
  }
  // Source taller — crop source top/bottom.
  const cropHeight = Math.round(sourceWidth / targetAspect);
  const cropY = Math.round((sourceHeight - cropHeight) / 2);
  return {
    src: { x: 0, y: cropY, width: sourceWidth, height: cropHeight },
    dst,
  };
}

// ─── Entity placement math ───────────────────────────────────────

/**
 * Computes the destination rect for a single entity sprite, mirroring
 * the in-app CinematicScene anchoring: sprite's bottom-center sits at
 * the entity's (x, y) viewport percentage.
 */
export function computeEntityRect(
  entity: SceneEntity,
  imageSize: { width: number; height: number } | undefined,
  targetWidth: number,
  targetHeight: number,
): Rect {
  const pos = resolveEntityPosition(entity); // { x, y } in 0..100 percent
  const scale = getEntityScale(entity);

  const spriteWidth = Math.round(targetWidth * ENTITY_WIDTH_RATIO * scale);
  const aspect = imageSize
    ? imageSize.width / imageSize.height
    : DEFAULT_SPRITE_ASPECT;
  const spriteHeight = Math.round(spriteWidth / aspect);

  // Anchor is bottom-center of sprite at (pos.x%, pos.y%).
  const anchorX = Math.round((pos.x / 100) * targetWidth);
  const anchorY = Math.round((pos.y / 100) * targetHeight);

  return {
    x: anchorX - Math.round(spriteWidth / 2),
    y: anchorY - spriteHeight,
    width: spriteWidth,
    height: spriteHeight,
  };
}

// ─── Layout computation ──────────────────────────────────────────

/**
 * Computes the full frame layout for a scene at the target resolution.
 *
 * Does NOT load any images. The caller is responsible for providing
 * natural image sizes (via ImageBitmap.width/height or preloaded Image
 * naturalWidth/Height). Entities without an imageSize render as
 * placeholder rects.
 */
export function computeSceneFrameLayout(
  scene: Scene,
  resolvedEntities: LayoutEntityInfo[],
  roomImageSize: { width: number; height: number } | undefined,
  targetWidth: number,
  targetHeight: number,
  options: LayoutOptions = {},
): SceneFrameLayout {
  const fit = options.fit ?? "fit";
  const fillColor = options.fillColor ?? "#000000";

  // ─── Background ──────────────────────────────────────────
  let background: BackgroundLayout | null = null;
  if (roomImageSize) {
    const { src, dst } = computeBackgroundFit(
      roomImageSize.width,
      roomImageSize.height,
      targetWidth,
      targetHeight,
      fit,
    );
    background = {
      src,
      dst,
      fillColor: fit === "fit" ? fillColor : null,
    };
  }

  // ─── Entities ────────────────────────────────────────────
  const backRowEntities: EntityLayout[] = [];
  const frontRowEntities: EntityLayout[] = [];

  for (const info of resolvedEntities) {
    const back = isBackRow(info.entity.slot);
    const rect = computeEntityRect(
      info.entity,
      info.imageSize,
      targetWidth,
      targetHeight,
    );
    const entry: EntityLayout = {
      entityId: info.entity.id,
      name: info.name,
      dst: rect,
      opacity: back ? BACK_ROW_OPACITY : 1,
      isBackRow: back,
      hasImage: Boolean(info.imageSize),
    };
    if (back) backRowEntities.push(entry);
    else frontRowEntities.push(entry);
  }

  // ─── Title card ──────────────────────────────────────────
  let titleCard: TitleCardLayout | null = null;
  if (scene.titleCard && scene.titleCard.text.trim()) {
    const boxWidth = Math.round(targetWidth * TITLE_CARD_BOX.widthPct);
    const boxHeight = Math.round(targetHeight * TITLE_CARD_BOX.heightPct);
    titleCard = {
      text: scene.titleCard.text,
      style: scene.titleCard.style,
      rect: {
        x: Math.round((targetWidth - boxWidth) / 2),
        y: Math.round(targetHeight * TITLE_CARD_BOX.topPct),
        width: boxWidth,
        height: boxHeight,
      },
    };
  }

  // ─── Caption area ────────────────────────────────────────
  const captionWidth = Math.round(targetWidth * CAPTION_BOX.widthPct);
  const captionArea: CaptionLayout = {
    rect: {
      x: Math.round((targetWidth - captionWidth) / 2),
      y: Math.round(targetHeight * CAPTION_BOX.topPct),
      width: captionWidth,
      height: Math.round(targetHeight * CAPTION_BOX.heightPct),
    },
  };

  return {
    width: targetWidth,
    height: targetHeight,
    background,
    backRowEntities,
    frontRowEntities,
    titleCard,
    captionArea,
  };
}
