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

/**
 * Load an image from a local file path via IPC, returning a data URL.
 * Handles three kinds of paths:
 * - R2 hash filenames (e.g. "abc123...def.png") → resolve from local asset cache
 * - Legacy relative paths (e.g. "zone/image.png") → resolve from MUD images dir
 * - Absolute paths → load directly
 */
export function useImageSrc(filePath: string | undefined): string | null {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const [src, setSrc] = useState<string | null>(null);

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
    if (candidates.length === 0) {
      setSrc(null);
      return;
    }

    let cancelled = false;

    // Try each candidate path in order
    (async () => {
      for (const path of candidates) {
        if (cancelled) return;
        try {
          const dataUrl = await invoke<string>("read_image_data_url", { path });
          if (!cancelled) setSrc(dataUrl);
          return;
        } catch {
          // Try next candidate
        }
      }
      if (!cancelled) setSrc(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [candidates]);

  return src;
}
