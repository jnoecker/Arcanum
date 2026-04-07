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
import type { WorldFile, MobFile, ItemFile } from "@/types/world";
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
  loadImageElement,
  renderSceneFrameToBlob,
  type LoadedSceneImages,
} from "@/lib/storyFrameRenderer";
import { buildCandidatePaths } from "@/lib/useResolvedSceneData";
import { checkFfmpegStatus, ensureFfmpegReady } from "@/lib/ffmpegStatus";
import { getPreset, type ExportPresetId } from "@/lib/videoExportPresets";

// ─── Types ───────────────────────────────────────────────────────

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
  /**
   * The zone the story lives in. The orchestrator reads `rooms`, `mobs`,
   * and `items` directly from this WorldFile to resolve scene entity
   * images without depending on the in-app React hook state.
   */
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
  /**
   * Optional AbortSignal. When aborted, the orchestrator bails at the
   * next stage boundary and calls `cancel_story_video_export` on the
   * Rust side so any in-flight ffmpeg process gets killed. Temp files
   * are cleaned up automatically. Throws a `DOMException` with name
   * `"AbortError"` — callers should treat abort as non-error UX.
   */
  signal?: AbortSignal;
}

/**
 * Thrown by `exportStoryVideo` when the caller aborts via the
 * optional AbortSignal. Matches the fetch/DOM convention so callers
 * can differentiate abort from real errors via `e.name === "AbortError"`.
 */
export class ExportAbortedError extends Error {
  readonly name = "AbortError";
  constructor(message = "Export cancelled by user") {
    super(message);
  }
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

interface RustCaptionChunk {
  text: string;
  startMs: number;
  endMs: number;
}

interface RustCaptionTrack {
  chunks: RustCaptionChunk[];
  style: {
    placement: "lower-third" | "upper-third" | "center";
    fontScale: number;
  };
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
  captions: RustCaptionTrack | null;
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
 * Resolves an entity (scene entity ID) to its name + image filename by
 * looking it up directly in the zone `WorldFile`. This is the hook-free
 * equivalent of `useResolvedSceneData`'s `resolveEntityInfo` — we use it
 * so the orchestrator doesn't depend on the hook's async state machine.
 */
/**
 * Splits a paragraph of narration text into sentence-sized caption
 * chunks with proportional timing. Called from the caption-building
 * loop so the exported video shows short, readable subtitles (1-2
 * lines each) instead of huge paragraph walls.
 *
 * Splits on sentence-terminal punctuation (`.`, `!`, `?`) followed
 * by whitespace. The last sentence may lack terminal punctuation and
 * is still included. Abbreviations like "Mr." or "e.g." are not
 * specially handled — they'll cause a slightly premature split but
 * the captions will still be readable.
 *
 * Timing is distributed proportionally to each sentence's word count
 * within the parent paragraph, so the caption on-screen time roughly
 * matches the TTS audio of that sentence.
 */
function splitIntoSentenceChunks(
  text: string,
  parentStartMs: number,
  parentEndMs: number,
): { text: string; startMs: number; endMs: number }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Match sentences: non-terminal chars followed by terminal punctuation
  // (optionally followed by whitespace), or a trailing fragment with
  // no terminator.
  const matches = trimmed.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) ?? [trimmed];
  const sentences = matches.map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length === 0) return [];
  if (sentences.length === 1) {
    return [{ text: sentences[0]!, startMs: parentStartMs, endMs: parentEndMs }];
  }

  const wordCounts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const totalWords = wordCounts.reduce((sum, n) => sum + n, 0);
  if (totalWords === 0) return [];

  const parentDurationMs = parentEndMs - parentStartMs;
  const result: { text: string; startMs: number; endMs: number }[] = [];
  let cursor = parentStartMs;

  for (let i = 0; i < sentences.length; i++) {
    const words = wordCounts[i] ?? 0;
    // Last sentence absorbs any rounding remainder so the total
    // duration matches parentEndMs exactly.
    const durationMs =
      i === sentences.length - 1
        ? Math.max(0, parentEndMs - cursor)
        : Math.round((words / totalWords) * parentDurationMs);
    result.push({
      text: sentences[i]!,
      startMs: cursor,
      endMs: cursor + durationMs,
    });
    cursor += durationMs;
  }
  return result;
}

function resolveEntityFromWorld(
  sceneEntity: SceneEntity,
  world: WorldFile,
): { name: string; image?: string } {
  if (sceneEntity.nameOverride || sceneEntity.imageOverride) {
    return {
      name: sceneEntity.nameOverride ?? sceneEntity.entityId,
      image: sceneEntity.imageOverride,
    };
  }
  if (sceneEntity.entityType === "mob" || sceneEntity.entityType === "npc") {
    const mob: MobFile | undefined = world.mobs?.[sceneEntity.entityId];
    if (mob) return { name: mob.name, image: mob.image };
    return { name: sceneEntity.entityId };
  }
  if (sceneEntity.entityType === "item") {
    const item: ItemFile | undefined = world.items?.[sceneEntity.entityId];
    if (item) return { name: item.displayName, image: item.image };
    return { name: sceneEntity.entityId };
  }
  return { name: sceneEntity.entityId };
}

/**
 * Resolves an asset reference (filename or path) to a data URL by
 * trying each candidate path in order. Returns `undefined` if none
 * of the candidates exist on disk. Uses the same candidate builder
 * as `useResolvedSceneData` so resolution is consistent with the
 * in-app preview.
 */
async function loadAssetDataUrl(
  fileRef: string,
  assetsDir: string,
  mudDir: string | undefined,
): Promise<string | undefined> {
  const candidates = buildCandidatePaths(fileRef, assetsDir, mudDir);
  for (const path of candidates) {
    try {
      return await invoke<string>("read_image_data_url", { path });
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
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
    world,
    presetId,
    outputPath,
    voiceOverride,
    modelOverride,
    assetsDir,
    project,
    onProgress,
    signal,
  } = options;

  const preset = getPreset(presetId);
  const sessionId = makeSessionId();
  const emit = (event: ExportProgressEvent) => {
    onProgress?.(event);
  };

  /** Throws if the caller's AbortSignal has fired. */
  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new ExportAbortedError();
    }
  };

  // When the abort signal fires, forward it to the Rust side so any
  // in-flight ffmpeg process gets killed. We can't `await` inside a
  // synchronous event listener, but invoke() returns a promise and
  // we just fire-and-forget — the orchestrator itself will catch
  // the abort on the next `throwIfAborted` check.
  const onAbortForwarded = () => {
    invoke("cancel_story_video_export", { sessionId }).catch((e) => {
      console.warn("[exportStoryVideo] failed to signal Rust cancel:", e);
    });
  };
  signal?.addEventListener("abort", onAbortForwarded, { once: true });

  // ─── Subscribe to Rust-side progress relayed from export_story_video ──
  // Rust emits stage-transition events (stage_fraction: null) and
  // intra-stage progress events parsed from ffmpeg's -progress stream
  // (stage_fraction: 0..1). We map each event onto the overall progress
  // bar by assigning each stage a [start, end] band and interpolating
  // within it using the stage_fraction when present.
  //
  // Stage bands total the 0.70..1.00 window — everything before 0.70 is
  // client-side work (TTS, frame render, asset resolution) whose progress
  // is already emitted directly from the main pipeline below.
  const stageBands: Partial<Record<ExportStage, [number, number]>> = {
    audio_mix: [0.70, 0.78],
    video_encode: [0.78, 0.93],
    mux: [0.93, 0.97],
    cleanup: [0.97, 0.99],
    done: [1.0, 1.0],
  };

  let unlistenProgress: UnlistenFn | null = null;
  try {
    unlistenProgress = await listen<{
      stage: string;
      message: string;
      stageFraction?: number | null;
      speed?: number | null;
      frame?: number | null;
    }>(
      "video_export:progress",
      (event) => {
        const stage = event.payload.stage as ExportStage;
        const band = stageBands[stage];
        if (!band) return;
        const [start, end] = band;
        const stageFraction =
          event.payload.stageFraction ?? (stage === "done" ? 1 : 0);
        const overall = start + (end - start) * Math.max(0, Math.min(1, stageFraction));
        // Decorate the message with speed/frame info when the ffmpeg
        // parser produced them. Keeps the UI informative during long
        // encodes without needing a new payload field.
        let message = event.payload.message;
        if (event.payload.speed != null) {
          message = `${message} (${event.payload.speed.toFixed(2)}x)`;
        }
        emit({ stage, fraction: overall, message });
      },
    );
  } catch (e) {
    console.warn("[exportStoryVideo] progress listener setup failed:", e);
  }

  try {
    throwIfAborted();

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
    throwIfAborted();

    // ─── Stage 2: initial timeline from word counts ──────────
    emit({ stage: "timeline", fraction: 0.08, message: "Computing timeline…" });
    const timelineOptions: TimelineOptions = {};
    let timeline = computeStoryTimeline(story, timelineOptions);
    if (timeline.scenes.length === 0) {
      throw new Error("Story has no scenes — cannot export.");
    }

    const scenesBySortOrder = [...story.scenes].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    console.log(
      "[exportStoryVideo] starting",
      {
        storyId: story.id,
        sceneCount: scenesBySortOrder.length,
        sceneIds: scenesBySortOrder.map((s) => s.id),
        presetId,
        outputPath,
        sessionId,
      },
    );

    // ─── Stage 3: TTS synthesis per scene ────────────────────
    const narrationCache = new Map<string, NarrationAudio | null>();

    for (let i = 0; i < scenesBySortOrder.length; i++) {
      throwIfAborted();
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
    throwIfAborted();
    console.log(
      "[exportStoryVideo] TTS done",
      scenesBySortOrder.map((s) => ({
        sceneId: s.id,
        title: s.title,
        audio: narrationCache.get(s.id)?.filePath ?? "(no narration)",
      })),
    );

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
    console.log(
      "[exportStoryVideo] timeline after TTS sync",
      {
        totalDurationMs: timeline.totalDurationMs,
        scenes: timeline.scenes.map((e) => ({
          id: e.sceneId,
          startMs: e.startMs,
          durationMs: e.durationMs,
          narrationMs: e.narrationEndMs - e.narrationStartMs,
        })),
      },
    );

    // ─── Stage 5: resolve scene images directly via IPC ──────
    //
    // We deliberately DO NOT rely on the `resolvedScenes` prop here.
    // That data comes from a React hook (useResolvedSceneData) whose
    // async resolution state isn't guaranteed to be complete by the
    // time Export is clicked. Instead, we re-resolve every image from
    // scratch using the exact same candidate-path logic, but via
    // direct await on read_image_data_url so we KNOW the data URLs
    // are present before rendering starts.
    emit({
      stage: "images",
      fraction: 0.35,
      message: "Loading scene images…",
    });

    const loadedByScene = new Map<string, LoadedSceneImages>();
    const missingAssetsByScene: string[] = [];
    const bgResolutionTrace: Array<Record<string, unknown>> = [];

    // Log the world's room inventory once so a mismatched scene.roomId
    // is easy to diagnose (compare against scene roomIds below).
    console.log(
      "[exportStoryVideo] world room inventory",
      {
        zoneId: story.zoneId,
        roomCount: Object.keys(world.rooms ?? {}).length,
        roomIds: Object.keys(world.rooms ?? {}),
      },
    );

    for (let i = 0; i < scenesBySortOrder.length; i++) {
      const scene = scenesBySortOrder[i]!;

      // ─── Room background resolution with explicit failure tracing ───
      let bgDataUrl: string | undefined;
      let bgFailureReason: string | null = null;
      let overridePath: string | undefined;

      // Honor scene.backgroundOverride first, mirroring the in-app
      // preview's lookup order.
      if (scene.backgroundOverride) {
        overridePath = scene.backgroundOverride;
        bgDataUrl = await loadAssetDataUrl(
          scene.backgroundOverride,
          assetsDir,
          project.mudDir,
        );
        if (!bgDataUrl) {
          bgFailureReason = `backgroundOverride "${scene.backgroundOverride}" resolved to no candidate path`;
        }
      } else if (!scene.roomId) {
        bgFailureReason = "scene has no roomId";
      } else {
        const room = world.rooms?.[scene.roomId];
        if (!room) {
          bgFailureReason = `roomId "${scene.roomId}" not found in world.rooms`;
        } else if (!room.image) {
          bgFailureReason = `room "${scene.roomId}" ("${room.title ?? ""}") has no image set`;
        } else {
          bgDataUrl = await loadAssetDataUrl(
            room.image,
            assetsDir,
            project.mudDir,
          );
          if (!bgDataUrl) {
            bgFailureReason = `room image "${room.image}" did not resolve via any candidate path`;
          }
        }
      }

      bgResolutionTrace.push({
        sceneIndex: i,
        sceneId: scene.id,
        sceneTitle: scene.title,
        roomId: scene.roomId ?? null,
        backgroundOverride: overridePath ?? null,
        bgResolved: !!bgDataUrl,
        failureReason: bgFailureReason,
      });

      if (!bgDataUrl && bgFailureReason) {
        missingAssetsByScene.push(
          `scene ${i} "${scene.title}" (${scene.id}): ${bgFailureReason}`,
        );
      }

      // Entities — resolve from the zone WorldFile directly
      const entityDataUrls = new Map<string, string>();
      const entitySources: Array<{ entity: SceneEntity; name: string }> = [];
      for (const sceneEntity of scene.entities ?? []) {
        const info = resolveEntityFromWorld(sceneEntity, world);
        entitySources.push({ entity: sceneEntity, name: info.name });
        if (info.image) {
          const dataUrl = await loadAssetDataUrl(info.image, assetsDir, project.mudDir);
          if (dataUrl) {
            entityDataUrls.set(sceneEntity.id, dataUrl);
          } else {
            missingAssetsByScene.push(
              `scene "${scene.title}" (${scene.id}) → entity "${info.name}" image "${info.image}"`,
            );
          }
        }
      }

      // Load the data URLs into HTMLImageElements so we have natural
      // dimensions available for the layout math.
      const loaded: LoadedSceneImages = { entities: new Map() };
      if (bgDataUrl) {
        try {
          loaded.background = await loadImageElement(bgDataUrl);
        } catch (e) {
          console.warn(`[exportStoryVideo] bg image decode failed for scene ${scene.id}:`, e);
        }
      }
      for (const { entity } of entitySources) {
        const dataUrl = entityDataUrls.get(entity.id);
        if (!dataUrl) continue;
        try {
          const img = await loadImageElement(dataUrl);
          loaded.entities.set(entity.id, img);
        } catch (e) {
          console.warn(
            `[exportStoryVideo] entity image decode failed for scene ${scene.id} entity ${entity.id}:`,
            e,
          );
        }
      }
      loadedByScene.set(scene.id, loaded);
    }

    console.log(
      "[exportStoryVideo] images resolved",
      scenesBySortOrder.map((s) => {
        const loaded = loadedByScene.get(s.id);
        return {
          sceneId: s.id,
          hasBackground: !!loaded?.background,
          entityCount: s.entities?.length ?? 0,
          entitiesWithImages: loaded?.entities.size ?? 0,
        };
      }),
    );
    console.log(
      "[exportStoryVideo] bg resolution trace (per scene)",
      bgResolutionTrace,
    );
    if (missingAssetsByScene.length > 0) {
      console.warn(
        "[exportStoryVideo] unresolved assets — those layers will render as placeholders:",
        missingAssetsByScene,
      );
    }

    // ─── Stage 6: render frames + save to disk ───────────────
    const savedFrames: RustSceneExportEntry[] = [];
    for (let i = 0; i < scenesBySortOrder.length; i++) {
      throwIfAborted();
      const scene = scenesBySortOrder[i]!;
      emit({
        stage: "frames",
        fraction: 0.4 + (i / scenesBySortOrder.length) * 0.25,
        message: `Rendering frame ${i + 1} of ${scenesBySortOrder.length}…`,
      });

      const loaded = loadedByScene.get(scene.id)!;

      // Build entity layout info from the loaded images + scene metadata.
      const entities: LayoutEntityInfo[] = (scene.entities ?? []).map((sceneEntity) => {
        const info = resolveEntityFromWorld(sceneEntity, world);
        const img = loaded.entities.get(sceneEntity.id);
        return {
          entity: sceneEntity,
          name: info.name,
          imageSize: img
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : undefined,
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
      console.log(
        `[exportStoryVideo] rendered frame ${i + 1}/${scenesBySortOrder.length}`,
        {
          sceneId: scene.id,
          blobSize: blob.size,
          hasBackground: !!loaded.background,
          entitiesDrawn: loaded.entities.size,
        },
      );
      const base64 = await blobToBase64(blob);
      const framePath = await invoke<string>("save_video_frame", {
        sessionId,
        sceneIndex: i,
        pngBase64: base64,
      });
      console.log(`[exportStoryVideo] saved frame ${i} → ${framePath}`);

      // Scene duration from the refreshed timeline.
      const timelineEntry = timeline.scenes.find((e) => e.sceneId === scene.id);
      if (!timelineEntry) {
        throw new Error(`Timeline entry missing for scene ${scene.id}`);
      }
      savedFrames.push({ pngPath: framePath, durationMs: timelineEntry.durationMs });
    }

    console.log("[exportStoryVideo] savedFrames", savedFrames);

    // Defensive check: if we lost scenes between TTS and save, bail
    // loudly rather than silently producing a single-scene video.
    if (savedFrames.length !== scenesBySortOrder.length) {
      throw new Error(
        `Expected ${scenesBySortOrder.length} saved frames but got ${savedFrames.length}. ` +
          `This is a bug in the export pipeline — please report it with the console logs above.`,
      );
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

    // Narration tracks + caption chunks: both walk the same scene
    // sequence and use the same cumulative-offset math, so build them
    // in one pass.
    const narrations: RustNarrationTrack[] = [];
    const captionChunks: RustCaptionChunk[] = [];
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
      // Caption chunks: one per SENTENCE (not per paragraph) so the
      // viewer sees short, readable subtitles instead of a wall of
      // text. The timeline gives us paragraph-sized chunks with
      // scene-relative start/end; we shift each to absolute video
      // time and then subdivide into sentences with proportional
      // timing via `splitIntoSentenceChunks`.
      if (preset.burnedCaptions && timelineEntry) {
        for (const chunk of timelineEntry.narrationChunks) {
          const parentText = chunk.text.trim();
          if (!parentText) continue;
          const parentStart = cumulativeMs + chunk.startMs;
          const parentEnd = cumulativeMs + chunk.endMs;
          const sentences = splitIntoSentenceChunks(
            parentText,
            parentStart,
            parentEnd,
          );
          for (const s of sentences) {
            captionChunks.push({
              text: s.text,
              startMs: s.startMs,
              endMs: s.endMs,
            });
          }
        }
      }
      cumulativeMs += savedFrames[i]!.durationMs;
    }

    // Build the caption track only if the preset wants captions AND
    // we actually produced chunks (a story with no narration text
    // would have an empty list).
    const captionTrack: RustCaptionTrack | null =
      preset.burnedCaptions && captionChunks.length > 0
        ? {
            chunks: captionChunks,
            style: {
              placement: preset.captionPlacement,
              fontScale: preset.captionScale,
            },
          }
        : null;

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
      captions: captionTrack,
      outputPath,
    };

    // ─── Stage 9: call the Rust orchestrator ─────────────────
    console.log("[exportStoryVideo] final export request", {
      sceneCount: exportRequest.scenes.length,
      scenes: exportRequest.scenes,
      audio: {
        narrationCount: exportRequest.audio.narrations.length,
        narrations: exportRequest.audio.narrations,
        hasMusic: !!exportRequest.audio.musicPath,
        hasAmbient: !!exportRequest.audio.ambientPath,
        totalDurationMs: exportRequest.audio.totalDurationMs,
      },
      captions: exportRequest.captions
        ? {
            chunkCount: exportRequest.captions.chunks.length,
            placement: exportRequest.captions.style.placement,
            fontScale: exportRequest.captions.style.fontScale,
            firstChunk: exportRequest.captions.chunks[0],
            lastChunk: exportRequest.captions.chunks[exportRequest.captions.chunks.length - 1],
          }
        : null,
      video: {
        width: exportRequest.width,
        height: exportRequest.height,
        fps: exportRequest.fps,
        profile: exportRequest.profile,
        crossfadeMs: exportRequest.crossfadeMs,
      },
    });
    throwIfAborted();
    emit({
      stage: "export",
      fraction: 0.7,
      message: "Encoding video…",
    });
    // The Rust orchestrator polls its own cancellation flag between
    // stages and inside the ffmpeg spawn loops. If the caller aborts
    // while this await is in flight, our signal listener above fires
    // `cancel_story_video_export` which flips the flag; Rust then
    // returns an error that we convert back to ExportAbortedError.
    const result = await invoke<RustVideoExportResult>("export_story_video", {
      request: exportRequest,
    }).catch((e) => {
      const msg = typeof e === "string" ? e : (e as Error).message;
      if (signal?.aborted || msg.includes("cancelled by user")) {
        throw new ExportAbortedError();
      }
      throw e;
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
    signal?.removeEventListener("abort", onAbortForwarded);
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
