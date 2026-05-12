import { invoke } from "@tauri-apps/api/core";

/**
 * Anthropic's vision endpoint rejects images >5 MB (base64). Base64 inflates
 * ~33%, so the underlying image must be ≤~3.75 MB. We compress *every* image
 * we send to vision so a high-resolution map (8k×8k PNG, 20MB+) never blows
 * up the hub call.
 *
 * Defaults match Anthropic's recommendation: images are resized to fit a
 * 1568×1568 box and re-encoded as JPEG quality 0.85. That comfortably fits
 * under 1 MB for typical map-sized images while preserving enough fidelity
 * for label reading and feature recognition.
 */
export async function compressImageForVision(
  dataUrl: string,
  opts?: { maxDimension?: number; quality?: number },
): Promise<string> {
  if (!dataUrl) return dataUrl;
  const maxDimension = opts?.maxDimension ?? 1568;
  const quality = opts?.quality ?? 0.85;

  const img = await loadImage(dataUrl);
  const longest = Math.max(img.width, img.height);
  const scale = longest > maxDimension ? maxDimension / longest : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context for image compression");
  ctx.drawImage(img, 0, 0, w, h);
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

interface VisionArgs {
  systemPrompt: string;
  userPrompt: string;
  imageDataUrl: string;
  maxTokens?: number;
}

/**
 * Single chokepoint for `llm_complete_with_vision` calls. Compresses the
 * image (max 1568px, JPEG q=0.85) before forwarding so callers never have
 * to think about hub / provider image-size limits. Use this in place of
 * raw `invoke("llm_complete_with_vision", ...)` everywhere.
 */
export async function llmCompleteWithVision(args: VisionArgs): Promise<string> {
  const compressed = await compressImageForVision(args.imageDataUrl);
  return invoke<string>("llm_complete_with_vision", {
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    imageDataUrl: compressed,
    maxTokens: args.maxTokens,
  });
}
