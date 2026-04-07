// ─── Story Timeline Computation ──────────────────────────────────
// Pure, deterministic timeline for converting a Story into a timed
// sequence of scenes with narration chunks and transitions.
//
// Phase 1 of the story→video export pipeline. Consumed by the frame
// renderer (scene compositing at t=N), the audio mixer (narration
// alignment), and the encoder (scene durations for ffmpeg).
//
// Phase 2 (TTS) replaces word-count narration estimates with actual
// audio file durations via the `narrationDurationOverrides` option.

import type { Story, Scene } from "@/types/story";
import { NARRATION_TIMING, type NarrationSpeed } from "@/lib/narrationSpeed";
import { extractWords } from "@/lib/sceneLayout";

// ─── TipTap paragraph extraction ─────────────────────────────────

interface TipTapNode {
  type: string;
  text?: string;
  content?: TipTapNode[];
}

function walkTextNodes(node: TipTapNode): string {
  if (node.type === "text" && node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(walkTextNodes).join("");
}

/**
 * Extracts narration as a list of paragraphs (one per top-level block).
 * Used for caption chunking: each paragraph becomes one subtitle chunk.
 * Falls back to splitting the raw string on newlines if the input isn't
 * valid TipTap JSON — keeps the module resilient when callers pass plain
 * text (e.g. from older stories or tests).
 */
export function extractParagraphs(narrationJson: string): string[] {
  if (!narrationJson) return [];
  try {
    const doc = JSON.parse(narrationJson) as TipTapNode;
    if (!doc.content) return [];
    return doc.content
      .map((block) => walkTextNodes(block).trim())
      .filter((text) => text.length > 0);
  } catch {
    return narrationJson
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}

// ─── Types ───────────────────────────────────────────────────────

/** A single word in the narration with precise timing. */
export interface NarrationWord {
  text: string;
  /** Start time relative to the scene start (milliseconds). */
  startMs: number;
  /** End time relative to the scene start (milliseconds). */
  endMs: number;
}

/**
 * A subtitle-sized chunk of narration (typically one paragraph).
 * Used for burned-in caption rendering.
 */
export interface NarrationChunk {
  text: string;
  /** Start time relative to the scene start (milliseconds). */
  startMs: number;
  /** End time relative to the scene start (milliseconds). */
  endMs: number;
  wordCount: number;
}

/** Transition style applied at the boundary between two scenes. */
export interface SceneTransition {
  type: "crossfade" | "fade_black";
  /** Total duration of the transition (milliseconds). */
  durationMs: number;
}

/** Per-scene absolute timing plus narration breakdown. */
export interface SceneTimelineEntry {
  sceneId: string;
  sceneIndex: number;
  /** Absolute start time in the final video (milliseconds). */
  startMs: number;
  /** Total duration this scene occupies (milliseconds). */
  durationMs: number;
  /**
   * When narration audio begins playing, relative to scene start.
   * Matches the existing 200ms delay from CinematicScene.
   */
  narrationStartMs: number;
  /** When narration finishes, relative to scene start. */
  narrationEndMs: number;
  /** Post-narration hold before the scene ends. */
  holdMs: number;
  /** Paragraph-level chunks for caption rendering. */
  narrationChunks: NarrationChunk[];
  /** Word-level timing for precise sync / SRT export. */
  narrationWords: NarrationWord[];
  /**
   * Transition out of this scene into the next.
   * Null on the final scene.
   */
  transitionOut: SceneTransition | null;
}

export interface StoryTimeline {
  scenes: SceneTimelineEntry[];
  totalDurationMs: number;
}

export interface TimelineOptions {
  /** Dwell time after narration ends, before the scene transitions. Default 1500ms. */
  postNarrationHoldMs?: number;
  /** Minimum duration for any scene (e.g. scenes without narration). Default 3000ms. */
  minSceneDurationMs?: number;
  /** Maximum scene duration clamp. Default 30000ms. */
  maxSceneDurationMs?: number;
  /** Crossfade transition duration. Default 500ms. */
  crossfadeMs?: number;
  /** Fade-to-black transition duration. Default 300ms. */
  fadeBlackMs?: number;
  /**
   * Delay before narration begins within a scene. Default 200ms
   * (matches CinematicScene's in-app playback).
   */
  narrationLeadInMs?: number;
  /**
   * Override narration duration per scene, keyed by scene ID.
   * Phase 2 (TTS) populates this with actual audio file durations
   * so the timeline matches the rendered speech rather than
   * the word-count estimate.
   */
  narrationDurationOverrides?: Record<string, number>;
}

// ─── Defaults ────────────────────────────────────────────────────

const DEFAULTS: Required<Omit<TimelineOptions, "narrationDurationOverrides">> = {
  postNarrationHoldMs: 1500,
  minSceneDurationMs: 3000,
  maxSceneDurationMs: 30000,
  crossfadeMs: 500,
  fadeBlackMs: 300,
  narrationLeadInMs: 200,
};

// ─── Narration timing ────────────────────────────────────────────

/**
 * Computes the estimated duration of narration at a given speed,
 * in milliseconds. Mirrors the in-app typewriter timing from
 * NARRATION_TIMING so video export stays consistent with playback.
 */
export function estimateNarrationDurationMs(
  wordCount: number,
  speed: NarrationSpeed,
): number {
  if (wordCount <= 0) return 0;
  const timing = NARRATION_TIMING[speed];
  const perWordSeconds = timing.wordDuration + timing.wordGap;
  return Math.round(wordCount * perWordSeconds * 1000);
}

/** Computes per-word timing for a narration string at the given speed. */
function computeNarrationWords(
  narrationJson: string,
  speed: NarrationSpeed,
  totalDurationMs: number,
): NarrationWord[] {
  const words = extractWords(narrationJson);
  if (words.length === 0) return [];

  // Distribute the total narration duration proportionally across words.
  // When totalDurationMs is an override (e.g. TTS audio length), this
  // keeps the per-word timing aligned with the real audio.
  const timing = NARRATION_TIMING[speed];
  const perWordSeconds = timing.wordDuration + timing.wordGap;
  const estimatedMs = words.length * perWordSeconds * 1000;
  const scale = estimatedMs > 0 ? totalDurationMs / estimatedMs : 0;

  const result: NarrationWord[] = [];
  let cursor = 0;
  for (const word of words) {
    const wordMs = Math.round(perWordSeconds * 1000 * scale);
    result.push({
      text: word,
      startMs: cursor,
      endMs: cursor + wordMs,
    });
    cursor += wordMs;
  }
  return result;
}

/**
 * Computes paragraph-level caption chunks. Each TipTap block becomes
 * one chunk, sized proportionally to its word count.
 */
function computeNarrationChunks(
  narrationJson: string,
  totalDurationMs: number,
): NarrationChunk[] {
  const paragraphs = extractParagraphs(narrationJson);
  if (paragraphs.length === 0) return [];

  const chunkWordCounts = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
  const totalWords = chunkWordCounts.reduce((sum, n) => sum + n, 0);
  if (totalWords === 0) return [];

  const chunks: NarrationChunk[] = [];
  let cursor = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const wordCount = chunkWordCounts[i] ?? 0;
    const chunkDurationMs =
      i === paragraphs.length - 1
        ? Math.max(0, totalDurationMs - cursor) // absorb rounding into last chunk
        : Math.round((wordCount / totalWords) * totalDurationMs);
    chunks.push({
      text: paragraphs[i] ?? "",
      startMs: cursor,
      endMs: cursor + chunkDurationMs,
      wordCount,
    });
    cursor += chunkDurationMs;
  }
  return chunks;
}

// ─── Transition resolution ───────────────────────────────────────

function resolveTransition(
  scene: Scene,
  opts: Required<Omit<TimelineOptions, "narrationDurationOverrides">>,
): SceneTransition {
  const type = scene.transition?.type ?? "crossfade";
  const durationMs = type === "crossfade" ? opts.crossfadeMs : opts.fadeBlackMs;
  return { type, durationMs };
}

// ─── Main timeline computation ───────────────────────────────────

/**
 * Computes a deterministic timeline for a story, suitable for driving
 * video frame rendering, audio mixing, and encoding.
 *
 * Scenes are processed in `sortOrder`. The caller does not need to
 * pre-sort — the function sorts defensively.
 *
 * Scene duration model:
 *   scene.durationMs =
 *     narrationLeadInMs +
 *     narrationDuration +
 *     postNarrationHoldMs
 *   clamped to [minSceneDurationMs, maxSceneDurationMs]
 *
 * Where narrationDuration is:
 *   - `narrationDurationOverrides[sceneId]` if present (Phase 2 TTS)
 *   - otherwise estimated from word count × NARRATION_TIMING[speed]
 *
 * Transitions overlap: a scene with a 500ms crossfade-out and a
 * following scene do NOT produce an 500ms black gap — the next
 * scene's startMs is (current scene end) - transitionDurationMs,
 * so the crossfade mixes both scenes.
 */
export function computeStoryTimeline(
  story: Story,
  options?: TimelineOptions,
): StoryTimeline {
  const opts = { ...DEFAULTS, ...options };
  const overrides = options?.narrationDurationOverrides ?? {};
  const storySpeed: NarrationSpeed = story.narrationSpeed ?? "normal";

  const sorted = [...story.scenes].sort((a, b) => a.sortOrder - b.sortOrder);
  const entries: SceneTimelineEntry[] = [];

  let cursorMs = 0;

  for (let i = 0; i < sorted.length; i++) {
    const scene = sorted[i]!;
    const effectiveSpeed: NarrationSpeed = scene.narrationSpeed ?? storySpeed;

    // ─── Narration duration ──────────────────────────────────
    const wordCount = extractWords(scene.narration ?? "").length;
    const override = overrides[scene.id];
    const narrationDurationMs =
      override !== undefined
        ? Math.max(0, override)
        : estimateNarrationDurationMs(wordCount, effectiveSpeed);

    // ─── Scene duration (clamped) ────────────────────────────
    const rawDurationMs =
      opts.narrationLeadInMs + narrationDurationMs + opts.postNarrationHoldMs;
    const durationMs = Math.min(
      opts.maxSceneDurationMs,
      Math.max(opts.minSceneDurationMs, rawDurationMs),
    );

    // If clamping to minSceneDurationMs, give the remainder to the hold
    // so narration still plays fully at the top.
    const holdMs = Math.max(
      opts.postNarrationHoldMs,
      durationMs - opts.narrationLeadInMs - narrationDurationMs,
    );

    const narrationStartMs = opts.narrationLeadInMs;
    const narrationEndMs = narrationStartMs + narrationDurationMs;

    // ─── Chunk narration for captions + per-word sync ────────
    const narrationChunks = computeNarrationChunks(
      scene.narration ?? "",
      narrationDurationMs,
    ).map((chunk) => ({
      ...chunk,
      startMs: chunk.startMs + narrationStartMs,
      endMs: chunk.endMs + narrationStartMs,
    }));

    const narrationWords = computeNarrationWords(
      scene.narration ?? "",
      effectiveSpeed,
      narrationDurationMs,
    ).map((word) => ({
      ...word,
      startMs: word.startMs + narrationStartMs,
      endMs: word.endMs + narrationStartMs,
    }));

    // ─── Transition out ──────────────────────────────────────
    const isLast = i === sorted.length - 1;
    const transitionOut = isLast ? null : resolveTransition(scene, opts);

    entries.push({
      sceneId: scene.id,
      sceneIndex: i,
      startMs: cursorMs,
      durationMs,
      narrationStartMs,
      narrationEndMs,
      holdMs,
      narrationChunks,
      narrationWords,
      transitionOut,
    });

    // Advance the cursor. Overlap transitions so the next scene starts
    // `transitionDurationMs` before the current scene ends.
    const transitionOverlap = transitionOut?.durationMs ?? 0;
    cursorMs += durationMs - transitionOverlap;
  }

  // Final video duration = last scene's absolute end time.
  const lastEntry = entries[entries.length - 1];
  const totalDurationMs = lastEntry ? lastEntry.startMs + lastEntry.durationMs : 0;

  return {
    scenes: entries,
    totalDurationMs,
  };
}
