// ─── Narration Synthesis ─────────────────────────────────────────
// Frontend wrapper around the `openai_tts_generate` Tauri command.
// Converts TipTap JSON scene narration into plain text, calls OpenAI
// TTS via the Rust backend, and returns the cached MP3 file path.
//
// Used by the story → video export pipeline. Also usable ad-hoc
// from any UI that wants to preview narration.

import { invoke } from "@tauri-apps/api/core";
import { extractPlainText } from "@/lib/sceneLayout";
import type { NarrationSpeed } from "@/lib/narrationSpeed";

// ─── Types ───────────────────────────────────────────────────────

/** OpenAI TTS voices supported by the backend. Keep in sync with openai_tts.rs. */
export const OPENAI_TTS_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;

export type OpenAiTtsVoice = (typeof OPENAI_TTS_VOICES)[number];

/** Human labels + descriptions for the voice picker UI. */
export const OPENAI_TTS_VOICE_LABELS: Record<OpenAiTtsVoice, { label: string; description: string }> = {
  alloy: { label: "Alloy", description: "Neutral, balanced — good default" },
  echo: { label: "Echo", description: "Warm, grounded male timbre" },
  fable: { label: "Fable", description: "Storytelling, slight British cadence" },
  onyx: { label: "Onyx", description: "Deep, resonant — dramatic narration" },
  nova: { label: "Nova", description: "Bright, expressive female timbre" },
  shimmer: { label: "Shimmer", description: "Soft, intimate — gentle moments" },
};

export const OPENAI_TTS_MODELS = ["tts-1", "tts-1-hd"] as const;
export type OpenAiTtsModel = (typeof OPENAI_TTS_MODELS)[number];

export interface NarrationAudio {
  /** Absolute filesystem path to the cached MP3. */
  filePath: string;
  /** Content-address hash (also the filename stem). */
  hash: string;
  /** Byte size of the audio file. */
  sizeBytes: number;
  /** Whether the file was served from cache or freshly synthesized. */
  cached: boolean;
}

export interface SynthesizeNarrationOptions {
  text: string;
  voice?: OpenAiTtsVoice;
  model?: OpenAiTtsModel;
  /** Narration speed preset — mapped to OpenAI's `speed` parameter. */
  speed?: NarrationSpeed | number;
}

// ─── Speed mapping ───────────────────────────────────────────────

/**
 * Maps the in-app NarrationSpeed presets to OpenAI's `speed` parameter.
 * Mirrors the feel of the in-app typewriter stagger:
 *   slow   → 0.85× (a little slower than default)
 *   normal → 1.0×  (default)
 *   fast   → 1.15× (a little faster than default)
 */
export function resolveTtsSpeed(speed: NarrationSpeed | number | undefined): number | undefined {
  if (speed === undefined) return undefined;
  if (typeof speed === "number") return speed;
  switch (speed) {
    case "slow":
      return 0.85;
    case "normal":
      return 1.0;
    case "fast":
      return 1.15;
  }
}

// ─── Core synthesize call ────────────────────────────────────────

/**
 * Synthesizes narration audio via the OpenAI TTS backend. Results are
 * cached by content hash in Rust, so repeated calls with the same
 * (text, voice, model, speed) return instantly without hitting the API.
 *
 * Throws on empty text or API errors.
 */
export async function synthesizeNarration(
  options: SynthesizeNarrationOptions,
): Promise<NarrationAudio> {
  const text = options.text.trim();
  if (!text) {
    throw new Error("Cannot synthesize narration from empty text.");
  }

  const voice = options.voice ?? "onyx";
  const model = options.model ?? "tts-1";
  const speed = resolveTtsSpeed(options.speed);

  return invoke<NarrationAudio>("openai_tts_generate", {
    text,
    voice,
    model,
    speed,
  });
}

// ─── Scene-level convenience ─────────────────────────────────────

export interface SynthesizeSceneNarrationOptions {
  /** TipTap JSON narration string (as stored on Scene.narration). */
  narrationJson: string | undefined;
  voice?: OpenAiTtsVoice;
  model?: OpenAiTtsModel;
  speed?: NarrationSpeed | number;
}

/**
 * Convenience wrapper that extracts plain text from a scene's TipTap
 * narration JSON and synthesizes it. Returns `null` when the scene has
 * no narration (rather than throwing) — scene-level callers often want
 * to skip audio generation for silent scenes.
 */
export async function synthesizeSceneNarration(
  options: SynthesizeSceneNarrationOptions,
): Promise<NarrationAudio | null> {
  const plain = extractPlainText(options.narrationJson ?? "").trim();
  if (!plain) return null;
  return synthesizeNarration({
    text: plain,
    voice: options.voice,
    model: options.model,
    speed: options.speed,
  });
}
