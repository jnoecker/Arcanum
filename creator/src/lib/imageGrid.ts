/**
 * Composite multiple image data URLs into a single grid image. Used to send
 * several samples through a single-image vision call (Anthropic's API
 * accepts one image per message in our current Tauri command shape).
 *
 * Layout is a near-square grid (ceil(sqrt(N)) columns, ceil(N / cols) rows).
 * Each tile fits its image inside a square cell with object-contain
 * semantics, on a black backdrop. Output is JPEG quality 0.85 so the
 * composite stays within vision's size budget.
 */
export async function composeImageGrid(
  dataUrls: string[],
  opts?: { totalSize?: number; quality?: number },
): Promise<string> {
  const sources = dataUrls.filter((u) => !!u);
  if (sources.length === 0) {
    throw new Error("composeImageGrid: no source images provided");
  }
  if (sources.length === 1) {
    return sources[0]!;
  }

  const totalSize = opts?.totalSize ?? 1568;
  const quality = opts?.quality ?? 0.85;
  const cols = Math.ceil(Math.sqrt(sources.length));
  const rows = Math.ceil(sources.length / cols);
  const tile = Math.floor(totalSize / Math.max(cols, rows));

  const canvas = document.createElement("canvas");
  canvas.width = tile * cols;
  canvas.height = tile * rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("composeImageGrid: 2D canvas context not available");

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < sources.length; i++) {
    const img = await loadImage(sources[i]!);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * tile;
    const y = row * tile;
    const scale = Math.min(tile / img.width, tile / img.height);
    const drawW = Math.max(1, Math.round(img.width * scale));
    const drawH = Math.max(1, Math.round(img.height * scale));
    const offX = x + Math.round((tile - drawW) / 2);
    const offY = y + Math.round((tile - drawH) / 2);
    ctx.drawImage(img, offX, offY, drawW, drawH);
  }

  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image data URL"));
    img.src = src;
  });
}
