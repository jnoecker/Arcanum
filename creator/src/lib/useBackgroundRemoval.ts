import { useState, useCallback } from "react";

let bgRemovalModule: typeof import("@imgly/background-removal") | null = null;

async function loadBgRemoval() {
  if (!bgRemovalModule) {
    bgRemovalModule = await import("@imgly/background-removal");
  }
  return bgRemovalModule;
}

export function useBackgroundRemoval() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeBg = useCallback(async (imageDataUrl: string): Promise<Blob> => {
    setProcessing(true);
    setError(null);
    try {
      const mod = await loadBgRemoval();
      const blob = await mod.removeBackground(imageDataUrl);
      return blob;
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setProcessing(false);
    }
  }, []);

  return { removeBg, processing, error };
}
