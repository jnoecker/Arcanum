// ─── Story → Video Export Orchestrator ──────────────────────────
// Top-level frontend function that drives the end-to-end pipeline.
// Glues together every primitive from PRs 1–7 into a single callable
// entry point.
//
// Pipeline stages:
//   1. ffmpeg       — ensure the ffmpeg binary is available (downloads
//                      on first use)
//   2. timeline      — compute initial timeline from word counts
//   3. tts           — synthesize narration per scene with TTS
//   4. timeline_sync — refresh timeline durations from real TTS
//                      audio lengths (probed via `<audio>.duration`)
//   5. images        — load all scene backgrounds + entity sprites
//   6. frames        — render each scene to a canvas and save PNG
//   7. audio_paths   — resolve zone music + ambient file paths
//   8. export        — call the Rust orchestrator which does the
//                      audio mix + video encode + mux
//   9. cleanup       — delete the session temp dir
//
// Callers pass a `Story` plus pre-resolved scene data (from the
// existing `useResolvedSceneData` hook) plus a preset ID plus an
// output path. An optional `onProgress` callback receives staged
// progress events.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { Story, SceneEntity } from "@/types/story";
import type { WorldFile } from "@/types/world";
import type { Project } from "@/types/project";

import {
  computeStoryTimeline,
  type StoryTimeline,
  type TimelineOptions,
} from "@/lib/storyTiming";
import { synthesizeSceneNarration } from "@/lib/narrationSynthesis";
import type {
  NarrationAudio,
  OpenAiTtsVoice,
  OpenAiTtsModel,
} from "@/lib/narrationSynthesis";
import {
  computeSceneFrameLayout,
  type LayoutEntityInfo,
} from "@/lib/storyFrameLayout";
import {
  loadSceneImages,
  renderSceneFrameToBlob,
  type LoadedSceneImages,
  type SceneImageSources,
} from "@/lib/storyFrameRenderer";
import { checkFfmpegStatus, ensureFfmpegReady } from "@/lib/ffmpegStatus";
import { getPreset, type ExportPresetId } from "@/lib/videoExportPresets";

// ─── Types ───────────────────────────────────────────────────────

/** Scene data already resolved with image data URLs (from useResolvedSceneData). */
export interface ResolvedSceneForExport {
  sceneId: string;
  roomImageSrc?: string;
  entities: Array<{
    entity: SceneEntity;
    name: string;
    imageSrc?: string;
  }>;
}

export type ExportStage =
  | "ffmpeg"
  | "timeline"
  | "tts"
  | "timeline_sync"
  | "images"
  | "frames"
  | "audio_paths"
  | "export"
  | "audio_mix"
  | "video_encode"
  | "mux"
  | "cleanup"
  | "done";

export interface ExportProgressEvent {
  stage: ExportStage;
  /** Monotonic phase index for the progress bar (0..1). */
  fraction: number;
  /** Human-readable message for the UI. */
  message: string;
}

export interface ExportStoryVideoOptions {
  story: Story;
  /** Scene data already resolved with image data URLs. */
  resolvedScenes: ResolvedSceneForExport[];
  /** The zone the story lives in. Used to resolve music/ambient paths. */
  world: WorldFile;
  /** Current project — used for legacy mudDir path fallbacks. */
  project: Project;
  /** Absolute path to the assets cache dir (from assetStore.assetsDir). */
  assetsDir: string;
  /** Which preset to export. */
  presetId: ExportPresetId;
  /** Absolute output file path (.mp4). The caller picks this from a file dialog. */
  outputPath: string;
  /** Override the preset's default TTS voice. */
  voiceOverride?: OpenAiTtsVoice;
  /** Override the preset's default TTS model. */
  modelOverride?: OpenAiTtsModel;
  /** Progress callback — fires at every stage transition. */
  onProgress?: (event: ExportProgressEvent) => void;
}

export interface ExportStoryVideoResult {
  outputPath: string;
  durationMs: number;
  sizeBytes: number;
}

// ─── Rust-side type mirrors ──────────────────────────────────────

interface RustNarrationTrack {
  filePath: string;
  offsetMs: number;
}

interface RustAudioMixInput {
  narrations: RustNarrationTrack[];
  musicPath: string | null;
  ambientPath: string | null;
  totalDurationMs: number;
  audioBitrateKbps: number;
}

interface RustSceneExportEntry {
  pngPath: string;
  durationMs: number;
}

interface RustVideoExportRequest {
  sessionId: string;
  scenes: RustSceneExportEntry[];
  audio: RustAudioMixInput;
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  profile: string;
  crossfadeMs: number | null;
  outputPath: string;
}

interface RustVideoExportResult {
  outputPath: string;
  totalDurationMs: number;
  sizeBytes: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Generates a UUID for the session temp dir. Uses crypto.randomUUID in browsers. */
function makeSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: random hex. Used only in environments without crypto
  // (shouldn't happen in a real Tauri webview).
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

/**
 * Converts a Blob to a base64 string suitable for Tauri IPC.
 * Uses chunked String.fromCharCode to avoid call-stack overflow on
 * large frames — same pattern as useBackgroundRemoval.ts.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(chunks.join(""));
}

/**
 * Reads the duration of a narration audio file via a transient
 * HTMLAudioElement. The file is already saved to disk in the Rust
 * cache; we just need its length.
 *
 * Returns the duration in milliseconds, or null on failure.
 */
async function probeNarrationDurationMs(filePath: string): Promise<number | null> {
  // Load the file as a data URL via the existing media reader so the
  // browser security model is happy with file:// URIs.
  try {
    const dataUrl = await invoke<string>("read_media_data_url", { path: filePath });
    return new Promise<number | null>((resolve) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const ms = isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null;
        resolve(ms);
      };
      audio.onerror = () => resolve(null);
      audio.src = dataUrl;
    });
  } catch {
    return null;
  }
}

/**
 * Builds the same candidate path list that `useMediaSrc` computes so
 * zone audio refs resolve the same way the in-app preview does.
 */
function buildMediaCandidatePaths(
  fileName: string,
  assetsDir: string,
  mudDir: string | undefined,
): string[] {
  if (!fileName) return [];
  // R2 hash filename → asset cache
  const isHash = /^[0-9a-f]{40,64}\.(mp3|mp4|webm|ogg|wav|m4a)$/i.test(fileName);
  if (isHash) {
    if (!assetsDir) return [];
    return [
      `${assetsDir}\\audio\\${fileName}`,
      `${assetsDir}\\video\\${fileName}`,
      `${assetsDir}\\images\\${fileName}`,
    ];
  }
  // Absolute path
  if (fileName.includes(":\\") || fileName.startsWith("/")) {
    return [fileName];
  }
  // Legacy relative path
  if (!mudDir) return [];
  return [
    `${mudDir}/src/main/resources/world/audio/${fileName}`,
    `${mudDir}/src/main/resources/audio/${fileName}`,
  ];
}

/**
 * Resolves a zone audio file reference (filename as stored in
 * world.audio.music / world.audio.ambient) to an absolute file path.
 * Returns `null` if no candidate exists on disk.
 */
async function resolveZoneAudioPath(
  fileName: string | undefined,
  assetsDir: string,
  mudDir: string | undefined,
): Promise<string | null> {
  if (!fileName) return null;
  const candidates = buildMediaCandidatePaths(fileName, assetsDir, mudDir);
  if (candidates.length === 0) return null;
  try {
    return await invoke<string | null>("resolve_first_existing_path", { candidates });
  } catch {
    return null;
  }
}

// ─── Orchestrator ────────────────────────────────────────────────

/**
 * End-to-end story → video export.
 *
 * Contract: every stage emits exactly one progress event on entry.
 * The overall fraction rises monotonically from 0 to 1.
 *
 * Throws on any pipeline failure; the caller is expected to show the
 * error to the user. On throw, temp files from this session are left
 * on disk for debugging — call cleanupVideoExportSession() to reclaim
 * the space.
 */
export async function exportStoryVideo(
  options: ExportStoryVideoOptions,
): Promise<ExportStoryVideoResult> {
  const {
    story,
    resolvedScenes,
    world,
    presetId,
    outputPath,
    voiceOverride,
    modelOverride,
    assetsDir,
    project,
    onProgress,
  } = options;

  const preset = getPreset(presetId);
  const sessionId = makeSessionId();
  const emit = (event: ExportProgressEvent) => {
    onProgress?.(event);
  };

  // ─── Subscribe to Rust-side progress relayed from export_story_video ──
  // Rust emits at audio_mix / video_encode / mux / cleanup / done stages.
  // We map those to the orchestrator's progress callback.
  let unlistenProgress: UnlistenFn | null = null;
  try {
    unlistenProgress = await listen<{ stage: string; message: string }>(
      "video_export:progress",
      (event) => {
        const stage = event.payload.stage as ExportStage;
        // Rough fractions for the Rust-side sub-stages.
        const fractionByStage: Partial<Record<ExportStage, number>> = {
          audio_mix: 0.72,
          video_encode: 0.82,
          mux: 0.95,
          cleanup: 0.98,
          done: 1.0,
        };
        emit({
          stage,
          fraction: fractionByStage[stage] ?? 0.8,
          message: event.payload.message,
        });
      },
    );
  } catch (e) {
    console.warn("[exportStoryVideo] progress listener setup failed:", e);
  }

  try {
    // ─── Stage 1: ffmpeg availability ────────────────────────
    emit({ stage: "ffmpeg", fraction: 0.0, message: "Checking ffmpeg…" });
    const ffmpegStatus = await checkFfmpegStatus();
    if (!ffmpegStatus.available) {
      emit({
        stage: "ffmpeg",
        fraction: 0.03,
        message: "Downloading ffmpeg (~30 MB, one-time)…",
      });
      await ensureFfmpegReady();
    }

    // ─── Stage 2: initial timeline from word counts ──────────
    emit({ stage: "timeline", fraction: 0.08, message: "Computing timeline…" });
    const timelineOptions: TimelineOptions = {};
    let timeline = computeStoryTimeline(story, timelineOptions);
    if (timeline.scenes.length === 0) {
      throw new Error("Story has no scenes — cannot export.");
    }

    // ─── Stage 3: TTS synthesis per scene ────────────────────
    const scenesBySortOrder = [...story.scenes].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const narrationCache = new Map<string, NarrationAudio | null>();

    for (let i = 0; i < scenesBySortOrder.length; i++) {
      const scene = scenesBySortOrder[i]!;
      emit({
        stage: "tts",
        fraction: 0.1 + (i / scenesBySortOrder.length) * 0.2,
        message: `Synthesizing narration ${i + 1} of ${scenesBySortOrder.length}…`,
      });
      const audio = await synthesizeSceneNarration({
        narrationJson: scene.narration,
        voice: voiceOverride ?? preset.ttsVoice,
        model: modelOverride ?? preset.ttsModel,
        speed: scene.narrationSpeed ?? story.narrationSpeed ?? "normal",
      }).catch((e) => {
        throw new Error(
          `TTS failed for scene "${scene.title}" (${scene.id}): ${(e as Error).message}`,
        );
      });
      narrationCache.set(scene.id, audio);
    }

    // ─── Stage 4: refresh timeline durations from real TTS audio ──
    emit({
      stage: "timeline_sync",
      fraction: 0.3,
      message: "Syncing scene durations to narration audio…",
    });
    const narrationDurationOverrides: Record<string, number> = {};
    for (const scene of scenesBySortOrder) {
      const audio = narrationCache.get(scene.id);
      if (!audio) continue;
      const ms = await probeNarrationDurationMs(audio.filePath);
      if (ms !== null && ms > 0) {
        narrationDurationOverrides[scene.id] = ms;
      }
    }
    timeline = computeStoryTimeline(story, { narrationDurationOverrides });

    // ─── Stage 5: load scene images ──────────────────────────
    emit({
      stage: "images",
      fraction: 0.35,
      message: "Loading scene images…",
    });
    const loadedByScene = new Map<string, LoadedSceneImages>();
    for (let i = 0; i < scenesBySortOrder.length; i++) {
      const scene = scenesBySortOrder[i]!;
      const resolved = resolvedScenes.find((r) => r.sceneId === scene.id);
      if (!resolved) {
        throw new Error(
          `Missing resolved scene data for "${scene.title}" (${scene.id}). Did you pass the useResolvedSceneData output?`,
        );
      }
      const sources: SceneImageSources = {
        background: resolved.roomImageSrc,
        entities: resolved.entities.map((e) => ({
          entityId: e.entity.id,
          src: e.imageSrc,
        })),
      };
      const loaded = await loadSceneImages(sources);
      loadedByScene.set(scene.id, loaded);
    }

    // ─── Stage 6: render frames + save to disk ───────────────
    const savedFrames: RustSceneExportEntry[] = [];
    for (let i = 0; i < scenesBySortOrder.length; i++) {
      const scene = scenesBySortOrder[i]!;
      emit({
        stage: "frames",
        fraction: 0.4 + (i / scenesBySortOrder.length) * 0.25,
        message: `Rendering frame ${i + 1} of ${scenesBySortOrder.length}…`,
      });

      const resolved = resolvedScenes.find((r) => r.sceneId === scene.id)!;
      const loaded = loadedByScene.get(scene.id)!;
      const entities: LayoutEntityInfo[] = resolved.entities.map((e) => {
        const img = loaded.entities.get(e.entity.id);
        return {
          entity: e.entity,
          name: e.name,
          imageSize: img ? { width: img.naturalWidth, height: img.naturalHeight } : undefined,
        };
      });
      const roomImageSize = loaded.background
        ? { width: loaded.background.naturalWidth, height: loaded.background.naturalHeight }
        : undefined;

      const layout = computeSceneFrameLayout(
        scene,
        entities,
        roomImageSize,
        preset.width,
        preset.height,
        { fit: preset.backgroundFit, fillColor: preset.fillColor },
      );
      const blob = await renderSceneFrameToBlob(layout, loaded, {
        drawCaptionBackdrop: preset.burnedCaptions,
      });
      const base64 = await blobToBase64(blob);
      const framePath = await invoke<string>("save_video_frame", {
        sessionId,
        sceneIndex: i,
        pngBase64: base64,
      });

      // Scene duration from the refreshed timeline.
      const timelineEntry = timeline.scenes.find((e) => e.sceneId === scene.id);
      if (!timelineEntry) {
        throw new Error(`Timeline entry missing for scene ${scene.id}`);
      }
      savedFrames.push({ pngPath: framePath, durationMs: timelineEntry.durationMs });
    }

    // ─── Stage 7: resolve zone audio paths ───────────────────
    emit({
      stage: "audio_paths",
      fraction: 0.68,
      message: "Resolving zone music and ambient…",
    });

    const musicPath = preset.includeMusic
      ? await resolveZoneAudioPath(world.audio?.music, assetsDir, project.mudDir)
      : null;
    const ambientPath = preset.includeAmbient
      ? await resolveZoneAudioPath(world.audio?.ambient, assetsDir, project.mudDir)
      : null;

    // ─── Stage 8: build the export request ───────────────────
    // Total duration = sum of scene durations (no transition overlap —
    // the PR 7 video encoder handles crossfade overlap itself).
    const totalDurationMs = savedFrames.reduce((sum, f) => sum + f.durationMs, 0);

    // Narration tracks: resolve TTS file paths + absolute offsets.
    // Absolute offset = cumulative scene start + per-scene narrationStartMs.
    const narrations: RustNarrationTrack[] = [];
    let cumulativeMs = 0;
    for (let i = 0; i < scenesBySortOrder.length; i++) {
      const scene = scenesBySortOrder[i]!;
      const narrationAudio = narrationCache.get(scene.id);
      const timelineEntry = timeline.scenes.find((e) => e.sceneId === scene.id);
      if (narrationAudio && timelineEntry) {
        narrations.push({
          filePath: narrationAudio.filePath,
          offsetMs: cumulativeMs + timelineEntry.narrationStartMs,
        });
      }
      cumulativeMs += savedFrames[i]!.durationMs;
    }

    const exportRequest: RustVideoExportRequest = {
      sessionId,
      scenes: savedFrames,
      audio: {
        narrations,
        musicPath,
        ambientPath,
        totalDurationMs,
        audioBitrateKbps: preset.audioBitrateKbps,
      },
      width: preset.width,
      height: preset.height,
      fps: preset.fps,
      videoBitrateKbps: preset.videoBitrateKbps,
      profile: preset.profile,
      // Pass crossfade if the story has any scene with a crossfade
      // transition. Otherwise use hard cuts.
      crossfadeMs: scenesBySortOrder.some(
        (s) => s.transition?.type === "crossfade",
      )
        ? 500
        : null,
      outputPath,
    };

    // ─── Stage 9: call the Rust orchestrator ─────────────────
    emit({
      stage: "export",
      fraction: 0.7,
      message: "Encoding video…",
    });
    const result = await invoke<RustVideoExportResult>("export_story_video", {
      request: exportRequest,
    });

    // ─── Stage 10: cleanup + done ────────────────────────────
    emit({
      stage: "cleanup",
      fraction: 0.98,
      message: "Cleaning up temp files…",
    });
    try {
      await invoke("cleanup_video_export_session", { sessionId });
    } catch (e) {
      // Best-effort — don't fail the export on cleanup hiccup.
      console.warn("[exportStoryVideo] cleanup failed:", e);
    }

    emit({
      stage: "done",
      fraction: 1.0,
      message: `Exported ${formatBytes(result.sizeBytes)} to ${result.outputPath}`,
    });

    return {
      outputPath: result.outputPath,
      durationMs: result.totalDurationMs,
      sizeBytes: result.sizeBytes,
    };
  } finally {
    if (unlistenProgress) {
      unlistenProgress();
    }
  }
}

/**
 * Manually cleans up a session temp dir. Call this when the user
 * cancels an export mid-stream, or when a prior export threw.
 */
export async function cleanupVideoExportSession(sessionId: string): Promise<void> {
  await invoke("cleanup_video_export_session", { sessionId });
}

// ─── Formatting helpers (used by progress messages + UI) ──────────

/** Formats a byte count as KB / MB / GB for display. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export type { StoryTimeline };
