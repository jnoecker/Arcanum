// ─── Grid overlay rendering ─────────────────────────────────────────
//
// Vision LLMs are notoriously bad at returning accurate pixel
// coordinates from raw images, but much better at reading visual
// reference grids drawn ON the image. We pre-process the source map by
// drawing a labeled grid on a copy, send the gridded image to the
// model, and ask for cell coordinates which we then translate back to
// pixel space deterministically.

export interface GridSpec {
  /** Number of columns labeled A, B, C, … */
  cols: number;
  /** Number of rows labeled 1, 2, 3, … */
  rows: number;
  /** Original image width in pixels (not the gridded copy). */
  imageWidth: number;
  /** Original image height in pixels (not the gridded copy). */
  imageHeight: number;
}

export interface GridOverlayResult {
  /** Data URL of the gridded image, suitable for sending to the LLM. */
  dataUrl: string;
  spec: GridSpec;
}

export interface GridCellRange {
  colStart: string; // "A".."Z"
  colEnd: string;   // inclusive
  rowStart: number; // 1-based
  rowEnd: number;   // inclusive
}

/**
 * Pick a sensible grid resolution given image dimensions. We aim for
 * roughly square cells with 6-12 cells on each axis. More than 12 makes
 * labels overcrowded; fewer than 6 leaves the model too coarse a target.
 */
export function chooseGridSpec(width: number, height: number): GridSpec {
  const aspect = width / height;
  let cols: number;
  let rows: number;
  if (aspect >= 1) {
    cols = clampInt(Math.round(8 * Math.sqrt(aspect)), 6, 12);
    rows = clampInt(Math.round(cols / aspect), 6, 12);
  } else {
    rows = clampInt(Math.round(8 / Math.sqrt(aspect)), 6, 12);
    cols = clampInt(Math.round(rows * aspect), 6, 12);
  }
  return { cols, rows, imageWidth: width, imageHeight: height };
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * Convert a 0-based column index to a letter label (A, B, … Z, AA, …).
 */
export function colLabel(idx: number): string {
  let n = idx;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function colIndex(label: string): number {
  let n = 0;
  for (const ch of label.toUpperCase()) {
    if (ch < "A" || ch > "Z") return -1;
    n = n * 26 + (ch.charCodeAt(0) - 65 + 1);
  }
  return n - 1;
}

/**
 * Render a labeled grid onto a copy of the source image. Returns a JPEG
 * data URL that can be passed straight to `llm_complete_with_vision`.
 */
export async function renderGridOverlay(
  sourceDataUrl: string,
  spec: GridSpec,
): Promise<GridOverlayResult> {
  const img = await loadImage(sourceDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D canvas context.");

  ctx.drawImage(img, 0, 0);

  const cellW = canvas.width / spec.cols;
  const cellH = canvas.height / spec.rows;

  // Grid lines — translucent so the underlying map remains readable.
  ctx.lineWidth = Math.max(1, Math.round(canvas.width / 800));
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 2;

  ctx.beginPath();
  for (let c = 1; c < spec.cols; c++) {
    const x = Math.round(c * cellW);
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
  }
  for (let r = 1; r < spec.rows; r++) {
    const y = Math.round(r * cellH);
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cell labels — top-left of each cell, e.g. "A1", "B1", "A2"
  const fontPx = Math.max(14, Math.round(Math.min(cellW, cellH) * 0.22));
  ctx.font = `bold ${fontPx}px monospace`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 4;

  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      const label = `${colLabel(c)}${r + 1}`;
      const x = Math.round(c * cellW + fontPx * 0.25);
      const y = Math.round(r * cellH + fontPx * 0.2);
      ctx.fillText(label, x, y);
    }
  }
  ctx.shadowBlur = 0;

  // JPEG keeps the payload reasonable; quality 0.85 is plenty for a map.
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { dataUrl, spec };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load source image for grid overlay."));
    img.src = src;
  });
}

// ─── Coordinate translation ─────────────────────────────────────────

/**
 * Convert a grid cell range (e.g. {colStart: "B", colEnd: "D", rowStart: 2,
 * rowEnd: 4}) into a top-left pixel bbox in the original image's
 * coordinate frame.
 */
export function cellRangeToPixelBox(
  range: GridCellRange,
  spec: GridSpec,
): { x: number; y: number; w: number; h: number } | null {
  const c0 = colIndex(range.colStart);
  const c1 = colIndex(range.colEnd);
  if (c0 < 0 || c1 < 0) return null;
  const r0 = Math.max(1, Math.round(range.rowStart)) - 1;
  const r1 = Math.max(1, Math.round(range.rowEnd)) - 1;
  if (Number.isNaN(r0) || Number.isNaN(r1)) return null;

  const cMin = Math.min(c0, c1);
  const cMax = Math.max(c0, c1);
  const rMin = Math.min(r0, r1);
  const rMax = Math.max(r0, r1);

  // Clamp to grid bounds (model sometimes refers to cells one off the edge).
  const cMinC = Math.max(0, Math.min(spec.cols - 1, cMin));
  const cMaxC = Math.max(0, Math.min(spec.cols - 1, cMax));
  const rMinC = Math.max(0, Math.min(spec.rows - 1, rMin));
  const rMaxC = Math.max(0, Math.min(spec.rows - 1, rMax));

  const cellW = spec.imageWidth / spec.cols;
  const cellH = spec.imageHeight / spec.rows;

  const x = Math.round(cMinC * cellW);
  const y = Math.round(rMinC * cellH);
  const w = Math.round((cMaxC - cMinC + 1) * cellW);
  const h = Math.round((rMaxC - rMinC + 1) * cellH);

  return { x, y, w, h };
}
