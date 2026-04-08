import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";

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

/**
 * Load an image from a local file path via IPC, returning a data URL plus status.
 * Handles three kinds of paths:
 * - R2 hash filenames (e.g. "abc123...def.png") → resolve from local asset cache
 * - Legacy relative paths (e.g. "zone/image.png") → resolve from MUD images dir
 * - Absolute paths → load directly
 */
export function useImageSrcStatus(filePath: string | undefined): ImageLoadResult {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<ImageLoadStatus>("idle");

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

    let cancelled = false;
    setStatus("loading");

    (async () => {
      for (const path of candidates) {
        if (cancelled) return;
        try {
          const dataUrl = await invoke<string>("read_image_data_url", { path });
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
  }, [candidates, filePath]);

  return { src, status };
}

/** Backwards-compatible thin wrapper that returns just the data URL. */
export function useImageSrc(filePath: string | undefined): string | null {
  return useImageSrcStatus(filePath).src;
}
