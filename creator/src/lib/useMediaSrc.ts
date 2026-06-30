import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { isR2HashPath, isLegacyImagePath } from "./useImageSrc";

function mimeFromPath(path: string): string {
  const ext = path.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "ogg":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    case "wav":
      return "audio/wav";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

/**
 * Load a media file (audio/video) from a local file path via IPC, returning a
 * blob object URL.
 *
 * Audio/video files are large, and the WebView's media engine pins `data:`
 * URLs for the lifetime of the session — cycling through tracks in the Audio
 * Studio leaks memory until OOM. Returning the bytes as a `Blob` + object URL
 * lets the player stream from the blob and frees it deterministically via
 * `revokeObjectURL` when the path changes or the component unmounts.
 *
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
    let objectUrl: string | null = null;

    (async () => {
      for (const path of candidates) {
        if (cancelled) return;
        try {
          const bytes = await invoke<ArrayBuffer>("read_media_bytes", { path });
          if (cancelled) return;
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeFromPath(path) }));
          setSrc(objectUrl);
          return;
        } catch {
          // Try next candidate
        }
      }
      if (!cancelled) setSrc(null);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [candidates]);

  return src;
}
