import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { isR2HashPath, isLegacyImagePath } from "./useImageSrc";

/**
 * Load a media file (audio/video) from a local file path via IPC, returning a data URL.
 * Handles R2 hash filenames, legacy relative paths, and absolute paths.
 */
export function useMediaSrc(filePath: string | undefined): string | null {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const [src, setSrc] = useState<string | null>(null);

  const candidates = useMemo(() => {
    if (!filePath) return [];

    // R2 hash filename — resolve from local asset cache
    if (isR2HashPath(filePath)) {
      if (!assetsDir) return [];
      return [
        `${assetsDir}\\video\\${filePath}`,
        `${assetsDir}\\audio\\${filePath}`,
        `${assetsDir}\\images\\${filePath}`,
      ];
    }

    // Absolute path
    if (!isLegacyImagePath(filePath)) return [filePath];

    // Legacy relative path — try MUD media directories
    if (!mudDir) return [];
    return [
      `${mudDir}/src/main/resources/world/audio/${filePath}`,
      `${mudDir}/src/main/resources/audio/${filePath}`,
      `${mudDir}/src/main/resources/world/video/${filePath}`,
      `${mudDir}/src/main/resources/video/${filePath}`,
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

    (async () => {
      for (const path of candidates) {
        if (cancelled) return;
        try {
          const dataUrl = await invoke<string>("read_media_data_url", { path });
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
