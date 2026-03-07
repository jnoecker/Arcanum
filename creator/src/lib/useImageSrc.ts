import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";

/** Returns true if the path looks like a legacy relative image reference. */
export function isLegacyImagePath(path: string | undefined): boolean {
  if (!path) return false;
  // Absolute paths have a drive letter (Windows) or start with /
  if (path.includes(":") || path.startsWith("/")) return false;
  return true;
}

/**
 * Load an image from a local file path via IPC, returning a data URL.
 * Resolves legacy relative paths (e.g. "zone/image.png") against
 * the project's images directory.
 */
export function useImageSrc(filePath: string | undefined): string | null {
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const [src, setSrc] = useState<string | null>(null);

  const candidates = useMemo(() => {
    if (!filePath) return [];
    if (!isLegacyImagePath(filePath)) return [filePath];
    if (!mudDir) return [];
    // Try world/images/ first, fall back to images/
    return [
      `${mudDir}/src/main/resources/world/images/${filePath}`,
      `${mudDir}/src/main/resources/images/${filePath}`,
    ];
  }, [filePath, mudDir]);

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
