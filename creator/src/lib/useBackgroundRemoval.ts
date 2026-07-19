import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AssetContext, AssetEntry, BgRemovalProvider } from "@/types/assets";
import { useAssetStore } from "@/stores/assetStore";
import { BG_REMOVAL_ASSET_TYPES } from "./arcanumPrompts";
import { AI_ENABLED } from "@/lib/featureFlags";

// ─── Provider resolution ─────────────────────────────────────────────
// The background-removal backend is a project-level setting
// (projectSettings.bg_removal_provider). We read from the asset store
// at call time so each invocation picks up the live value — users can
// switch between local and Runware without reloading.

function currentBgProvider(): BgRemovalProvider {
  if (!AI_ENABLED) return "local";
  const ps = useAssetStore.getState().projectSettings;
  return ps?.bg_removal_provider === "runware" ? "runware" : "local";
}

// ─── Worker-based background removal ─────────────────────────────────
// WASM/ONNX inference runs in a dedicated Web Worker so the UI stays responsive.

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (buf: ArrayBuffer) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("./bgRemovalWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e: MessageEvent) => {
      const { id, buffer, error } = e.data;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (error) {
        entry.reject(new Error(error));
      } else {
        entry.resolve(buffer);
      }
    };
    worker.onerror = (e) => {
      console.error("[bg-removal worker]", e.message);
    };
  }
  return worker;
}

/** Remove background from an image data URL.
 *  Dispatches based on the project's bg_removal_provider setting:
 *  - "local": runs the Imgly/ONNX model in a Web Worker.
 *  - "runware": calls Runware BiRefNet General (direct or via hub). */
export async function removeBackground(imageDataUrl: string): Promise<Blob> {
  if (!AI_ENABLED) return removeBackgroundLocal(imageDataUrl);
  if (currentBgProvider() === "runware") {
    return removeBackgroundRunware(imageDataUrl);
  }
  return removeBackgroundLocal(imageDataUrl);
}

function removeBackgroundLocal(imageDataUrl: string): Promise<Blob> {
  const id = nextId++;
  const w = getWorker();
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, {
      resolve: (buf) => resolve(new Blob([buf], { type: "image/png" })),
      reject,
    });
    w.postMessage({ id, imageDataUrl });
  });
}

async function removeBackgroundRunware(imageDataUrl: string): Promise<Blob> {
  // The Rust side handles hub-mode short-circuiting, so this one
  // command name works in both direct and hub configurations.
  const b64 = await invoke<string>("runware_remove_background", { imageDataUrl });
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

// ─── Bounded-concurrency queue ────────────────────────────────────
// The local provider stays strictly serial: there's a single WASM
// worker, and holding multiple large data URLs at once creates memory
// pressure. The Runware provider is just an HTTP round trip, so several
// removals run in flight at once — the per-image latency is upstream
// inference, and parallel requests are how you buy it back.
//
// NOTE: a runner must never let a task throw out of its loop — that
// would leak an `activeBgRunners` slot and shrink the pool for the rest
// of the session. Per-task errors are surfaced through the per-task
// promise (reject), not through the runner.

const RUNWARE_BG_CONCURRENCY = 4;

/** How many bg-removal tasks may run at once for the current provider. */
export function bgRemovalConcurrency(): number {
  return currentBgProvider() === "runware" ? RUNWARE_BG_CONCURRENCY : 1;
}

interface QueueEntry<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

const bgQueue: QueueEntry<unknown>[] = [];
let activeBgRunners = 0;

async function runBgWorker() {
  activeBgRunners++;
  try {
    while (bgQueue.length > 0) {
      const entry = bgQueue.shift()!;
      try {
        const value = await entry.run();
        entry.resolve(value);
      } catch (err) {
        entry.reject(err);
      }
    }
  } finally {
    activeBgRunners--;
  }
}

function processBgQueue() {
  // Re-read the limit on every pump: the provider can switch mid-session,
  // and extra runners drain naturally when their loop finds an empty queue.
  // Each spawned worker synchronously shifts its first task, so this loop
  // can't spawn more workers than there are waiting tasks.
  while (activeBgRunners < bgRemovalConcurrency() && bgQueue.length > 0) {
    runBgWorker();
  }
}

function enqueueBgTask<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    bgQueue.push({
      run: run as () => Promise<unknown>,
      resolve: resolve as (v: unknown) => void,
      reject,
    });
    processBgQueue();
  });
}

/** Returns true if the given asset type should have bg removal applied.
 *  Sourced from `arcanumPrompts.BG_REMOVAL_ASSET_TYPES` so the prompt-pipeline
 *  sprite safety injection and the runtime bg-removal pass can't drift apart. */
export function shouldRemoveBg(assetType: string): boolean {
  return BG_REMOVAL_ASSET_TYPES.has(assetType);
}

/**
 * Run background removal on a data URL and save the result as an asset variant.
 * Throws on failure so callers can surface the real error message — the old
 * "swallow and return null" behavior made every failure look identical in
 * the bulk UI ("Removal returned null") and hid actual causes like worker
 * crashes or oversized input.
 *
 * Existing call sites that relied on null-return can still get that behavior
 * by appending `.catch(() => null)`.
 */
async function runBgRemoval(
  imageDataUrl: string,
  assetType: string,
  context?: AssetContext,
  variantGroup?: string,
): Promise<AssetEntry> {
  console.log(
    `[bg-removal] Starting for ${assetType}${variantGroup ? ` (variant: ${variantGroup})` : ""}`,
  );
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
  return entry;
}

export async function removeBgAndSave(
  imageDataUrl: string,
  assetType: string,
  context?: AssetContext,
  variantGroup?: string,
): Promise<AssetEntry> {
  return enqueueBgTask(() => runBgRemoval(imageDataUrl, assetType, context, variantGroup));
}

/**
 * Like `removeBgAndSave`, but reads the source image from disk *inside* the
 * serialized task instead of holding a multi-MB data URL in memory until the
 * queue reaches it. Batch art generation uses this so a whole zone's worth of
 * pending removals doesn't pin every source image at once.
 */
export async function removeBgFromFileAndSave(
  filePath: string,
  assetType: string,
  context?: AssetContext,
  variantGroup?: string,
): Promise<AssetEntry> {
  return enqueueBgTask(async () => {
    const imageDataUrl = await invoke<string>("read_image_data_url", { path: filePath });
    return runBgRemoval(imageDataUrl, assetType, context, variantGroup);
  });
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
