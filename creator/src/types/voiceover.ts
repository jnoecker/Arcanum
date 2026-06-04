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

/** Mirrors the Rust VoiceMap struct (.arcanum/voices.json). */
export interface VoiceMap {
  defaultVoiceId: string;
  modelId: string;
  /** templateKey → ElevenLabs voiceId. */
  assignments: Record<string, string>;
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
