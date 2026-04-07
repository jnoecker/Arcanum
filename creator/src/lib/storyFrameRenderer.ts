// ─── Story Frame Renderer ────────────────────────────────────────
// Canvas-based compositor that consumes a SceneFrameLayout and draws
// a single video frame to an offscreen/hidden canvas.
//
// Split from storyFrameLayout.ts so the pure layout math stays
// unit-testable without jsdom canvas quirks. This module is browser-
// only — it uses HTMLCanvasElement / CanvasRenderingContext2D.

import type {
  SceneFrameLayout,
  EntityLayout,
  BackgroundLayout,
  TitleCardLayout,
  CaptionLayout,
} from "@/lib/storyFrameLayout";

// ─── Image loading ───────────────────────────────────────────────

/**
 * Loads a data URL or same-origin URL into an HTMLImageElement,
 * resolving with the loaded image (which carries naturalWidth/Height).
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) =>
      reject(new Error(`Failed to load image: ${e instanceof Event ? "load error" : e}`));
    img.src = src;
  });
}

// ─── Loaded scene image cache ────────────────────────────────────

export interface LoadedSceneImages {
  background?: HTMLImageElement;
  /** Keyed by SceneEntity.id. */
  entities: Map<string, HTMLImageElement>;
}

export interface SceneImageSources {
  background?: string;
  /** entityId → data URL / URL. Entities without a source still get laid out as placeholders. */
  entities: Array<{ entityId: string; src?: string }>;
}

/**
 * Loads all images required for a scene in parallel, returning a
 * LoadedSceneImages cache. Missing sources are silently omitted — the
 * renderer will draw placeholder boxes for entities without images.
 */
export async function loadSceneImages(
  sources: SceneImageSources,
): Promise<LoadedSceneImages> {
  const result: LoadedSceneImages = { entities: new Map() };

  const bgPromise = sources.background
    ? loadImageElement(sources.background)
        .then((img) => {
          result.background = img;
        })
        .catch(() => {
          /* fall through — scene will render with no bg */
        })
    : Promise.resolve();

  const entityPromises = sources.entities.map(async ({ entityId, src }) => {
    if (!src) return;
    try {
      const img = await loadImageElement(src);
      result.entities.set(entityId, img);
    } catch {
      /* fall through — entity renders as placeholder */
    }
  });

  await Promise.all([bgPromise, ...entityPromises]);
  return result;
}

// ─── Canvas drawing primitives ───────────────────────────────────

/**
 * Fonts used by the renderer. These match the creator's design system
 * (Cinzel for display text, Crimson Pro for body). Both are loaded
 * globally via @fontsource so the canvas context inherits them.
 */
const FONT_DISPLAY = "Cinzel, serif";
const FONT_BODY = '"Crimson Pro", Georgia, serif';

function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundLayout,
  image: HTMLImageElement | undefined,
  frameWidth: number,
  frameHeight: number,
): void {
  // Fill padding area first (letterbox bars).
  if (bg.fillColor) {
    ctx.fillStyle = bg.fillColor;
    ctx.fillRect(0, 0, frameWidth, frameHeight);
  }
  if (!image) return;
  ctx.drawImage(
    image,
    bg.src.x,
    bg.src.y,
    bg.src.width,
    bg.src.height,
    bg.dst.x,
    bg.dst.y,
    bg.dst.width,
    bg.dst.height,
  );
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: EntityLayout,
  image: HTMLImageElement | undefined,
): void {
  ctx.save();
  ctx.globalAlpha = entity.opacity;

  if (image) {
    ctx.drawImage(image, entity.dst.x, entity.dst.y, entity.dst.width, entity.dst.height);
  } else {
    // Placeholder box with subtle border
    ctx.fillStyle = "rgba(40, 44, 64, 0.7)";
    ctx.fillRect(entity.dst.x, entity.dst.y, entity.dst.width, entity.dst.height);
    ctx.strokeStyle = "rgba(180, 180, 200, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      entity.dst.x + 1,
      entity.dst.y + 1,
      entity.dst.width - 2,
      entity.dst.height - 2,
    );
  }

  // Name label under the sprite
  const labelFontSize = Math.max(10, Math.round(entity.dst.width * 0.1));
  ctx.font = `${labelFontSize}px ${FONT_BODY}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillText(
    entity.name,
    entity.dst.x + entity.dst.width / 2,
    entity.dst.y + entity.dst.height + 4,
    entity.dst.width + 40, // max width: allow modest overflow
  );

  ctx.restore();
}

function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  card: TitleCardLayout,
): void {
  const { rect, text } = card;
  ctx.save();

  // Subtle backdrop
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  gradient.addColorStop(0, "rgba(10, 14, 30, 0.0)");
  gradient.addColorStop(0.5, "rgba(10, 14, 30, 0.55)");
  gradient.addColorStop(1, "rgba(10, 14, 30, 0.0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  // Text
  const fontSize = Math.round(rect.height * 0.55);
  ctx.font = `600 ${fontSize}px ${FONT_DISPLAY}`;
  ctx.fillStyle = "#e2bc6a"; // aurum-gold, matches design system
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(
    text,
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    rect.width - 20,
  );

  ctx.restore();
}

function drawCaptionBackdrop(
  ctx: CanvasRenderingContext2D,
  caption: CaptionLayout,
  frameWidth: number,
  frameHeight: number,
): void {
  // Full-width gradient from transparent at the caption top down to
  // semi-opaque black at the bottom of the frame, matching the existing
  // CinematicScene narration overlay styling.
  const { rect } = caption;
  ctx.save();
  const gradient = ctx.createLinearGradient(0, rect.y, 0, frameHeight);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, rect.y, frameWidth, frameHeight - rect.y);
  ctx.restore();
}

// ─── Public renderer ─────────────────────────────────────────────

export interface RenderFrameOptions {
  /**
   * When true, draw a lower-third gradient under the caption area even
   * if no caption text is rendered yet. Used for still frames that will
   * get caption text burned in during ffmpeg encoding.
   */
  drawCaptionBackdrop?: boolean;
}

/**
 * Draws a single scene frame onto the given canvas context.
 *
 * Assumes the canvas is already sized to layout.width × layout.height.
 * Does NOT clear — caller should clear or rely on layers filling the
 * whole frame (the background layer handles letterbox fill when the
 * fit strategy leaves empty space).
 *
 * For frames without a background (no room image, no letterbox fill),
 * caller should clear the canvas to black before calling this.
 */
export function drawSceneFrame(
  ctx: CanvasRenderingContext2D,
  layout: SceneFrameLayout,
  images: LoadedSceneImages,
  options: RenderFrameOptions = {},
): void {
  // Layer 0: room background (or fill color)
  if (layout.background) {
    drawBackground(ctx, layout.background, images.background, layout.width, layout.height);
  } else {
    // No background at all — clear to black
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  // Layer 1: back row entities (under front)
  for (const entity of layout.backRowEntities) {
    drawEntity(ctx, entity, images.entities.get(entity.entityId));
  }

  // Layer 2: front row entities
  for (const entity of layout.frontRowEntities) {
    drawEntity(ctx, entity, images.entities.get(entity.entityId));
  }

  // Layer 3: caption backdrop (optional — used when captions will be
  // burned in later by ffmpeg drawtext)
  if (options.drawCaptionBackdrop) {
    drawCaptionBackdrop(ctx, layout.captionArea, layout.width, layout.height);
  }

  // Layer 4: title card
  if (layout.titleCard) {
    drawTitleCard(ctx, layout.titleCard);
  }
}

/**
 * Convenience wrapper: creates an offscreen canvas, renders the frame,
 * and returns a PNG blob. Used by the export pipeline to serialize
 * each scene into a still image for the ffmpeg frame sequence.
 */
export async function renderSceneFrameToBlob(
  layout: SceneFrameLayout,
  images: LoadedSceneImages,
  options?: RenderFrameOptions,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D context on offscreen canvas");
  }
  drawSceneFrame(ctx, layout, images, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob returned null"));
      },
      "image/png",
    );
  });
}
