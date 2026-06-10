import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";

/**
 * Module-level cache for `read_image_data_url` results. Keyed by absolute
 * filesystem path so identical images (e.g. the same R2 hash referenced from
 * many rooms) only pay the IPC + base64 cost once per session.
 *
 * Stores the in-flight Promise so concurrent callers share a single IPC.
 * Failed promises are evicted so the next caller can retry cleanly.
 */
const imageDataUrlCache = new Map<string, Promise<string>>();

/** Settled values from `imageDataUrlCache`, for synchronous lookup. Lets
 *  components that re-mount constantly (ReactFlow nodes under
 *  `onlyRenderVisibleElements`) render already-loaded images in their first
 *  paint instead of flashing through a loading state on every pan. */
const resolvedImageCache = new Map<string, string>();

// NUL is illegal in file paths on every platform, so thumbnail keys can
// never collide with a real full-size path key.
const KEY_SEP = String.fromCharCode(0);

function cacheKey(path: string, maxDim?: number): string {
  return maxDim ? `${path}${KEY_SEP}${maxDim}` : path;
}

function fetchImageDataUrl(path: string, maxDim?: number): Promise<string> {
  const key = cacheKey(path, maxDim);
  const cached = imageDataUrlCache.get(key);
  if (cached) return cached;
  const promise = maxDim
    ? invoke<string>("read_image_thumbnail_data_url", { path, maxDim })
    : invoke<string>("read_image_data_url", { path });
  imageDataUrlCache.set(key, promise);
  promise.then(
    (dataUrl) => resolvedImageCache.set(key, dataUrl),
    () => imageDataUrlCache.delete(key),
  );
  return promise;
}

function lookupResolved(candidates: string[], maxDim?: number): string | null {
  for (const path of candidates) {
    const hit = resolvedImageCache.get(cacheKey(path, maxDim));
    if (hit) return hit;
  }
  return null;
}

/** Drop all cached entries (full-size and thumbnails) for a path. Call after
 *  writing the underlying file (e.g. asset accept, regenerate) so the next
 *  load picks up the new bytes instead of returning a stale data URL. */
export function invalidateImageCache(path: string): void {
  for (const map of [imageDataUrlCache, resolvedImageCache] as Map<string, unknown>[]) {
    for (const key of map.keys()) {
      if (key === path || key.startsWith(`${path}${KEY_SEP}`)) map.delete(key);
    }
  }
}

/** Clear the entire image-data-url cache. Use sparingly — meant for project
 *  switches where every path is now invalid. */
export function clearImageCache(): void {
  imageDataUrlCache.clear();
  resolvedImageCache.clear();
}

/** Returns true if the path looks like an R2 hash filename (64 hex chars + extension). */
export function isR2HashPath(path: string | undefined): boolean {
  if (!path) return false;
  return /^[0-9a-f]{64}\.\w+$/.test(path);
}

/** Returns true if the path looks like a legacy relative image reference. */
export function isLegacyImagePath(path: string | undefined): boolean {
  if (!path) return false;
  if (isR2HashPath(path)) return false;
  // Absolute paths have a drive letter (Windows) or start with /
  if (path.includes(":") || path.startsWith("/")) return false;
  return true;
}

export type ImageLoadStatus = "idle" | "loading" | "loaded" | "error";

export interface ImageLoadResult {
  src: string | null;
  status: ImageLoadStatus;
}

export interface ImageSrcOptions {
  /** Downscale server-side to fit within maxDim pixels (re-encoded as lossy
   *  WebP). Use for map nodes and list thumbnails — full-resolution art is
   *  often a multi-MB PNG that wastes IPC, decode time, and GPU memory when
   *  displayed at thumbnail size. Omit for full resolution. */
  maxDim?: number;
}

/**
 * Load an image from a local file path via IPC, returning a data URL plus status.
 * Handles three kinds of paths:
 * - R2 hash filenames (e.g. "abc123...def.png") → resolve from local asset cache
 * - Legacy relative paths (e.g. "zone/image.png") → resolve from MUD images dir
 * - Absolute paths → load directly
 */
export function useImageSrcStatus(
  filePath: string | undefined,
  options?: ImageSrcOptions,
): ImageLoadResult {
  const maxDim = options?.maxDim;
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const assetsDir = useAssetStore((s) => s.assetsDir);

  const candidates = useMemo(() => {
    if (!filePath) return [];

    // R2 hash filename — look in local asset cache
    if (isR2HashPath(filePath)) {
      if (!assetsDir) return [];
      return [`${assetsDir}\\images\\${filePath}`];
    }

    // Absolute path
    if (!isLegacyImagePath(filePath)) return [filePath];

    // Legacy relative path — try MUD images directories
    if (!mudDir) return [];
    return [
      `${mudDir}/src/main/resources/world/images/${filePath}`,
      `${mudDir}/src/main/resources/images/${filePath}`,
    ];
  }, [filePath, mudDir, assetsDir]);

  // Synchronous fast path on mount: components that re-mount constantly
  // (ReactFlow nodes under `onlyRenderVisibleElements` re-mount on every
  // pan) render already-loaded images in their first paint, skipping the
  // loading flash and the extra render of the async path.
  const initial = lookupResolved(candidates, maxDim);
  const [src, setSrc] = useState<string | null>(initial);
  const [status, setStatus] = useState<ImageLoadStatus>(
    initial ? "loaded" : filePath ? "loading" : "idle",
  );

  useEffect(() => {
    if (!filePath) {
      setSrc(null);
      setStatus("idle");
      return;
    }
    if (candidates.length === 0) {
      // We have a filePath but cannot construct any candidate (e.g. assetsDir
      // not loaded yet). Stay in "loading" until candidates resolve.
      setSrc(null);
      setStatus("loading");
      return;
    }

    // Same fast path for in-place candidate changes (e.g. a list row reused
    // for a different image whose data URL is already cached). React bails
    // out of the re-render when the values are unchanged.
    const resolved = lookupResolved(candidates, maxDim);
    if (resolved) {
      setSrc(resolved);
      setStatus("loaded");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    (async () => {
      for (const path of candidates) {
        if (cancelled) return;
        try {
          const dataUrl = await fetchImageDataUrl(path, maxDim);
          if (!cancelled) {
            setSrc(dataUrl);
            setStatus("loaded");
          }
          return;
        } catch {
          // Try next candidate
        }
      }
      if (!cancelled) {
        setSrc(null);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidates, filePath, maxDim]);

  return { src, status };
}

/** Backwards-compatible thin wrapper that returns just the data URL. */
export function useImageSrc(
  filePath: string | undefined,
  options?: ImageSrcOptions,
): string | null {
  return useImageSrcStatus(filePath, options).src;
}

/**
 * Imperative variant of `useImageSrcStatus` — resolves an image to a data URL
 * outside of a React render. Mirrors the hook's candidate-path logic
 * (R2 hash → asset cache, legacy → MUD images dir, otherwise → direct path)
 * and returns null if every candidate fails. Useful for action handlers
 * (e.g. derive flows) that need an image data URL on demand.
 */
export async function resolveImageDataUrl(
  filePath: string | undefined,
): Promise<string | null> {
  if (!filePath) return null;
  const mudDir = useProjectStore.getState().project?.mudDir;
  const assetsDir = useAssetStore.getState().assetsDir;

  const candidates: string[] = [];
  if (isR2HashPath(filePath)) {
    if (assetsDir) candidates.push(`${assetsDir}\\images\\${filePath}`);
  } else if (!isLegacyImagePath(filePath)) {
    candidates.push(filePath);
  } else if (mudDir) {
    candidates.push(`${mudDir}/src/main/resources/world/images/${filePath}`);
    candidates.push(`${mudDir}/src/main/resources/images/${filePath}`);
  }

  for (const path of candidates) {
    try {
      return await fetchImageDataUrl(path);
    } catch {
      // Try next candidate.
    }
  }
  return null;
}
