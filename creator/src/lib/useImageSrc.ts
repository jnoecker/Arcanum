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

  const resolvedPath = useMemo(() => {
    if (!filePath) return undefined;
    if (!isLegacyImagePath(filePath)) return filePath;
    if (mudDir) return `${mudDir}/src/main/resources/images/${filePath}`;
    return undefined;
  }, [filePath, mudDir]);

  useEffect(() => {
    if (!resolvedPath) {
      setSrc(null);
      return;
    }

    let cancelled = false;

    invoke<string>("read_image_data_url", { path: resolvedPath })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedPath]);

  return src;
}
