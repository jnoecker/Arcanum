// Web Worker: CPU-intensive background removal via @imgly/background-removal (WASM/ONNX).
// Runs off the main thread so the UI stays responsive during inference.

import { removeBackground } from "@imgly/background-removal";

// Diagnostic: logs once the worker spins up so we can tell whether this
// worker context is cross-origin-isolated. Multi-threaded WASM in
// onnxruntime requires crossOriginIsolated === true in BOTH the main
// document and every worker spawned from it.
console.info("[bg-worker] crossOriginIsolated =", self.crossOriginIsolated);

self.onmessage = async (
  e: MessageEvent<{ id: number; imageDataUrl: string }>,
) => {
  const { id, imageDataUrl } = e.data;
  try {
    const blob = await removeBackground(imageDataUrl);
    const buffer = await blob.arrayBuffer();
    // Transfer the buffer (zero-copy) back to the main thread
    self.postMessage({ id, buffer }, { transfer: [buffer] });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
