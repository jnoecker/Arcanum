// Dialogue voice-over types. Arcanum synthesizes NPC dialogue lines via
// ElevenLabs and publishes the clips to R2 at the path the AmbonMUD engine
// resolves. See docs/VOICE_OVER_CONTRACT.md in the AmbonMUD repo.

/** Mirrors the Rust ElevenLabsVoice struct. */
export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category: string;
  previewUrl: string;
}

/** Mirrors the Rust VoiceClip struct returned by elevenlabs_synthesize. */
export interface VoiceClip {
  filePath: string;
  cacheHash: string;
  /** First 8 hex chars of SHA-256(raw node text) — the contract hash. */
  textSha8: string;
  /** data:audio/mpeg;base64,... for in-app preview playback. */
  dataUrl: string;
  sizeBytes: number;
  cached: boolean;
}

/** Per-request ElevenLabs delivery controls (mirrors Rust VoiceSettings).
 *  Every field optional — unset falls back to the project default, then to
 *  ElevenLabs' own voice default. */
export interface VoiceSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  speed?: number;
  /** Extra pause (seconds) inserted after each sentence. Not an ElevenLabs
   *  voice setting — Arcanum injects `<break>` tags into the synthesis input. */
  sentencePause?: number;
}

/** Lightweight generated-clip handle held in the panel's per-line state.
 *  `dataUrl` is loaded lazily (absent for clips rehydrated from disk). */
export interface LineClip {
  cacheHash: string;
  textSha8: string;
  dataUrl?: string;
}

/** Mirrors the Rust VoiceStatusQuery — one per line, for cache rehydration. */
export interface VoiceStatusQuery {
  key: string;
  text: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
}

/** Mirrors the Rust VoiceStatusResult. */
export interface VoiceStatusResult {
  key: string;
  cacheHash: string;
  textSha8: string;
  present: boolean;
}

/** Mirrors the Rust VoiceMap struct (.arcanum/voices.json). */
export interface VoiceMap {
  defaultVoiceId: string;
  modelId: string;
  /** templateKey → ElevenLabs voiceId. */
  assignments: Record<string, string>;
  /** Project-wide delivery defaults. */
  defaultSettings: VoiceSettings;
  /** templateKey → per-mob delivery overrides. */
  settings: Record<string, VoiceSettings>;
}

/** ElevenLabs' own defaults, shown in sliders when nothing is set. */
export const ELEVENLABS_DEFAULT_SETTINGS: Required<VoiceSettings> = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: 1.0,
  sentencePause: 0,
};

/** Numeric delivery controls surfaced as sliders. `useSpeakerBoost` is a
 *  separate checkbox. */
export const VOICE_SETTING_FIELDS = [
  { key: "stability", label: "Stability", min: 0, max: 1, step: 0.05, hint: "Low = more emotional & variable; high = flat & consistent." },
  { key: "similarityBoost", label: "Similarity", min: 0, max: 1, step: 0.05, hint: "How closely to match the source voice." },
  { key: "style", label: "Style", min: 0, max: 1, step: 0.05, hint: "Amplify the voice's character (slower to render)." },
  { key: "speed", label: "Speed", min: 0.7, max: 1.2, step: 0.05, hint: "Delivery pacing." },
  { key: "sentencePause", label: "Sentence pause", min: 0, max: 2, step: 0.1, suffix: "s", hint: "Extra pause inserted after each sentence (added to the audio only, not the displayed text)." },
] as const satisfies readonly {
  key: keyof VoiceSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  hint: string;
}[];

/** Merge a mob's per-NPC overrides over the project defaults, field by field. */
export function resolveVoiceSettings(map: VoiceMap, templateKey: string): VoiceSettings {
  const base = map.defaultSettings ?? {};
  const over = map.settings?.[templateKey] ?? {};
  return {
    stability: over.stability ?? base.stability,
    similarityBoost: over.similarityBoost ?? base.similarityBoost,
    style: over.style ?? base.style,
    useSpeakerBoost: over.useSpeakerBoost ?? base.useSpeakerBoost,
    speed: over.speed ?? base.speed,
    sentencePause: over.sentencePause ?? base.sentencePause,
  };
}

/** True when no field is set (so the backend omits voice_settings entirely). */
export function settingsAreEmpty(s: VoiceSettings | undefined): boolean {
  if (!s) return true;
  return (
    s.stability === undefined &&
    s.similarityBoost === undefined &&
    s.style === undefined &&
    s.useSpeakerBoost === undefined &&
    s.speed === undefined &&
    s.sentencePause === undefined
  );
}

/** Mirrors the Rust VoiceUploadJob struct passed to deploy_voices_to_r2. */
export interface VoiceUploadJob {
  zone: string;
  templateKey: string;
  nodeId: string;
  textSha8: string;
  cacheHash: string;
}

/** A single voiceable NPC dialogue line, flattened across all loaded zones. */
export interface DialogueLine {
  zone: string;
  templateKey: string;
  mobName: string;
  nodeId: string;
  text: string;
}

/** ElevenLabs synthesis models offered in the picker. */
export const ELEVENLABS_MODELS = [
  {
    id: "eleven_multilingual_v2",
    label: "Multilingual v2",
    description: "Highest quality, most expressive. Default.",
  },
  {
    id: "eleven_turbo_v2_5",
    label: "Turbo v2.5",
    description: "Faster and cheaper, slightly lower fidelity.",
  },
  {
    id: "eleven_flash_v2_5",
    label: "Flash v2.5",
    description: "Lowest latency, lowest cost.",
  },
] as const;

export const DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";

/** Stable identity for a dialogue line across the panel + result maps. */
export function lineKey(zone: string, templateKey: string, nodeId: string): string {
  return `${zone} ${templateKey} ${nodeId}`;
}

/**
 * First 8 hex chars of SHA-256 over the exact raw text. Must match the Rust
 * `elevenlabs::text_sha8` and the AmbonMUD engine byte-for-byte — hashes the
 * UTF-8 bytes of `text` verbatim with no trimming or normalization.
 */
export async function sha8(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 8);
}
