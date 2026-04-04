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

/** Yield to the browser event loop so UI stays responsive. */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Sequential queue ─────────────────────────────────────────────
// BG removal is CPU-intensive WASM that blocks the main thread.
// Queue tasks and process one at a time with yielding between them
// so the UI (scroll, clicks, animations) stays responsive.

type QueueEntry = { run: () => Promise<void>; resolve: () => void };
const bgQueue: QueueEntry[] = [];
let bgQueueRunning = false;

async function processBgQueue() {
  if (bgQueueRunning) return;
  bgQueueRunning = true;
  while (bgQueue.length > 0) {
    const entry = bgQueue.shift()!;
    await yieldToUI(); // let the UI breathe before each task
    await entry.run();
    entry.resolve();
    await yieldToUI(); // let the UI breathe after each task
  }
  bgQueueRunning = false;
}

function enqueueBgTask(run: () => Promise<void>): Promise<void> {
  return new Promise<void>((resolve) => {
    bgQueue.push({ run, resolve });
    processBgQueue();
  });
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
  let result: AssetEntry | null = null;
  await enqueueBgTask(async () => {
    console.log(`[bg-removal] Starting for ${assetType}${variantGroup ? ` (variant: ${variantGroup})` : ""}`);
    try {
      const blob = await removeBackground(imageDataUrl);
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const chunks: string[] = [];
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
      }
      const b64 = btoa(chunks.join(""));

      const entry = await invoke<AssetEntry>("save_bytes_as_asset", {
        bytesB64: b64,
        assetType,
        context: context ?? null,
        variantGroup: variantGroup ?? null,
      });
      if (variantGroup) {
        await invoke("set_active_variant", { variantGroup, assetId: entry.id });
        console.log(`[bg-removal] Set as active variant for ${variantGroup}`);
      }
      result = entry;
    } catch (e) {
      console.error("[bg-removal] Failed:", e);
    }
  });
  return result;
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
