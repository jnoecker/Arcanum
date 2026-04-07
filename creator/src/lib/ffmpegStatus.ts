// ─── FFmpeg Status Wrapper ───────────────────────────────────────
// Frontend wrapper around the ffmpeg resolution and download commands
// for the story → video export pipeline.
//
// Callers typically:
//   1. Call `checkFfmpegStatus()` to see if ffmpeg is already available.
//   2. If not, show a "First export needs to download ffmpeg (~30 MB)"
//      confirm dialog, then call `ensureFfmpegReady()`.
//   3. Proceed with the export, which will resolve ffmpeg via the
//      cached binary from (2).

import { invoke } from "@tauri-apps/api/core";

export type FfmpegSource = "bundled" | "system";

export interface FfmpegStatus {
  available: boolean;
  source: FfmpegSource | null;
  path: string | null;
  version: string | null;
}

/**
 * Fast, non-blocking status check. Does not download anything.
 * Used to decide whether an export can start immediately or whether
 * the user needs to confirm a download first.
 */
export async function checkFfmpegStatus(): Promise<FfmpegStatus> {
  return invoke<FfmpegStatus>("check_ffmpeg_status");
}

/**
 * Ensures ffmpeg is available, downloading it on first call. Blocks
 * until the download + unpack completes (~30 MB, typically < 30s on
 * a reasonable connection). Subsequent calls short-circuit via the
 * cached binary.
 *
 * Throws if the download fails or if the resulting binary does not
 * respond to `-version`.
 */
export async function ensureFfmpegReady(): Promise<FfmpegStatus> {
  return invoke<FfmpegStatus>("ensure_ffmpeg_ready");
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Human-readable label for an FfmpegStatus. Used in toolbar tooltips
 * and the export dialog header.
 */
export function describeFfmpegStatus(status: FfmpegStatus): string {
  if (!status.available) return "ffmpeg not available — will download on first export";
  const src = status.source === "bundled" ? "bundled" : "system";
  return `ffmpeg ${status.version ?? "ready"} (${src})`;
}
