import type { ZonePlanRegion } from "@/types/lore";

export interface CroppedImageData {
  dataUrl: string;
  width: number;
  height: number;
}

export async function cropImageDataUrl(
  sourceDataUrl: string,
  region: ZonePlanRegion,
): Promise<CroppedImageData> {
  const image = await loadImage(sourceDataUrl);
  const width = Math.max(1, Math.round(region.w));
  const height = Math.max(1, Math.round(region.h));
  const sx = Math.max(0, Math.round(region.x));
  const sy = Math.max(0, Math.round(image.naturalHeight - region.y - region.h));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D canvas context.");

  ctx.drawImage(image, sx, sy, width, height, 0, 0, width, height);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width,
    height,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping."));
    img.src = src;
  });
}
