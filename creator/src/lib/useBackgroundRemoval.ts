import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AssetContext, AssetEntry } from "@/types/assets";

let bgRemovalModule: typeof import("@imgly/background-removal") | null = null;

async function loadBgRemoval() {
  if (!bgRemovalModule) {
    bgRemovalModule = await import("@imgly/background-removal");
  }
  return bgRemovalModule;
}

/** Standalone bg removal — works outside React components. */
export async function removeBackground(imageDataUrl: string): Promise<Blob> {
  const mod = await loadBgRemoval();
  return mod.removeBackground(imageDataUrl);
}

/** Asset types that benefit from background removal (sprites, not scene backgrounds). */
const BG_REMOVAL_TYPES = new Set([
  "mob", "item", "entity_portrait", "ability_sprite",
  "player_sprite", "race_portrait", "class_portrait",
]);

/** Returns true if the given asset type should have bg removal applied. */
export function shouldRemoveBg(assetType: string): boolean {
  return BG_REMOVAL_TYPES.has(assetType);
}

/**
 * Run background removal on a data URL and save the result as an asset variant.
 * Returns the saved AssetEntry, or null if removal failed.
 */
export async function removeBgAndSave(
  imageDataUrl: string,
  assetType: string,
  context?: AssetContext,
  variantGroup?: string,
): Promise<AssetEntry | null> {
  console.log(`[bg-removal] Starting for ${assetType}${variantGroup ? ` (variant: ${variantGroup})` : ""}`);
  try {
    const blob = await removeBackground(imageDataUrl);
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    const b64 = btoa(binary);

    const entry = await invoke<AssetEntry>("save_bytes_as_asset", {
      bytesB64: b64,
      assetType,
      context: context ?? null,
      variantGroup: variantGroup ?? null,
    });
    // Set the bg-removed variant as active so it's the one displayed/exported
    if (variantGroup) {
      await invoke("set_active_variant", { variantGroup, assetId: entry.id });
      console.log(`[bg-removal] Set as active variant for ${variantGroup}`);
    }
    return entry;
  } catch (e) {
    // BG removal is best-effort — don't block the main flow
    console.error("[bg-removal] Failed:", e);
    return null;
  }
}

/** React hook for background removal with loading/error state. */
export function useBackgroundRemoval() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeBg = useCallback(async (imageDataUrl: string): Promise<Blob> => {
    setProcessing(true);
    setError(null);
    try {
      const blob = await removeBackground(imageDataUrl);
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
