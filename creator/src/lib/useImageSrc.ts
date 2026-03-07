import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Load an image from a local file path via IPC, returning a data URL.
 * Returns null while loading or if the path is undefined.
 */
export function useImageSrc(filePath: string | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setSrc(null);
      return;
    }

    let cancelled = false;

    invoke<string>("read_image_data_url", { path: filePath })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  return src;
}
