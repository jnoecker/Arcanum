// ─── Video Export Presets ────────────────────────────────────────
// Preset definitions for the story → video export pipeline.
// Each preset is a complete recipe: dimensions, codec settings,
// narration voice, caption placement, aspect strategy, and output
// naming. The export orchestrator reads a preset and drives the
// frame renderer + TTS pipeline + ffmpeg encoder accordingly.
//
// Adding a new preset: add an entry to PRESETS with all required
// fields. The export orchestrator handles any combination of fields
// generically, so no orchestrator changes are needed for most new
// presets.

import type { BackgroundFit } from "@/lib/storyFrameLayout";
import type {
  OpenAiTtsVoice,
  OpenAiTtsModel,
} from "@/lib/narrationSynthesis";
import type { NarrationSpeed } from "@/lib/narrationSpeed";

// ─── Types ───────────────────────────────────────────────────────

/** Stable string identifier for a preset — used in settings, events, URLs. */
export type ExportPresetId =
  | "showcase"
  | "social_vertical"
  | "social_square"
  | "in_game"
  | "archive";

/** H.264 profile — lower profiles have broader playback compat. */
export type H264Profile = "baseline" | "main" | "high";

/** Where narration captions are burned into the frame. */
export type CaptionPlacement = "lower-third" | "upper-third" | "center";

/** How title cards are drawn over the scene. */
export type TitleCardStyle = "corner" | "center" | "hidden";

/** Intended distribution target — drives preset selection in the UI. */
export type DistributionTarget =
  | "showcase-embed"
  | "social-feed"
  | "in-game-asset"
  | "personal-archive";

export interface ExportPreset {
  /** Stable ID. */
  id: ExportPresetId;
  /** Human label shown in the preset picker card. */
  label: string;
  /** One-line description shown under the label. */
  description: string;
  /** Distribution target this preset is designed for. */
  target: DistributionTarget;

  // ─── Video ─────────────────────────────────────────────────
  width: number;
  height: number;
  fps: 30 | 60;
  /** H.264 codec profile. */
  profile: H264Profile;
  /** Target video bitrate in kbps (for VBR -b:v). */
  videoBitrateKbps: number;
  /** How the background image fits into the target aspect. */
  backgroundFit: BackgroundFit;
  /**
   * Fill color for letterbox/pillarbox padding when backgroundFit
   * leaves empty space. Ignored for "fill" and "crop_center".
   */
  fillColor: string;

  // ─── Duration ──────────────────────────────────────────────
  /**
   * Hard cap on total video length. Stories longer than this are
   * truncated at export time (later scenes are dropped). `null` means
   * no limit.
   */
  maxDurationMs: number | null;

  // ─── Audio ─────────────────────────────────────────────────
  audioBitrateKbps: number;
  /** Whether zone music plays in the background (ducked under narration). */
  includeMusic: boolean;
  /** Whether zone ambient audio plays in the background. */
  includeAmbient: boolean;

  // ─── Narration ─────────────────────────────────────────────
  /** Default TTS voice. User can override in the export dialog. */
  ttsVoice: OpenAiTtsVoice;
  /** TTS model. `tts-1-hd` is used for the archive preset. */
  ttsModel: OpenAiTtsModel;
  /** Default narration pace (mapped to OpenAI `speed` at render time). */
  narrationSpeed: NarrationSpeed;

  // ─── Captions ──────────────────────────────────────────────
  /** Whether narration text is burned into the frame as a subtitle. */
  burnedCaptions: boolean;
  /** Where captions are placed when burnedCaptions is true. */
  captionPlacement: CaptionPlacement;
  /** Font size multiplier relative to a standard 16:9 caption. */
  captionScale: number;

  // ─── Title card ────────────────────────────────────────────
  titleCardStyle: TitleCardStyle;

  // ─── Output ────────────────────────────────────────────────
  /** File extension (without leading dot). Currently always "mp4". */
  fileExtension: "mp4";
  /** Output filename suffix (e.g. "showcase" → `story-showcase.mp4`). */
  filenameSuffix: string;
}

// ─── Preset definitions ──────────────────────────────────────────

/**
 * Showcase (1080p) — for the Cloudflare Pages showcase embed and
 * any general-purpose 16:9 share. High quality, no duration cap,
 * native aspect.
 */
const SHOWCASE: ExportPreset = {
  id: "showcase",
  label: "Showcase (1080p)",
  description: "16:9 HD for embedding on the showcase site or sharing anywhere.",
  target: "showcase-embed",
  width: 1920,
  height: 1080,
  fps: 30,
  profile: "high",
  videoBitrateKbps: 6000,
  backgroundFit: "fit",
  fillColor: "#000000",
  maxDurationMs: null,
  audioBitrateKbps: 192,
  includeMusic: true,
  includeAmbient: true,
  ttsVoice: "onyx",
  ttsModel: "tts-1",
  narrationSpeed: "normal",
  burnedCaptions: true,
  captionPlacement: "lower-third",
  captionScale: 1.0,
  titleCardStyle: "center",
  fileExtension: "mp4",
  filenameSuffix: "showcase",
};

/**
 * Social Vertical (9:16) — for TikTok/Reels/Shorts. 60 second cap,
 * captions placed in the upper third so they sit above the phone's
 * bottom UI bar. Scene art is cropped to vertical.
 */
const SOCIAL_VERTICAL: ExportPreset = {
  id: "social_vertical",
  label: "Social (Vertical)",
  description: "9:16 vertical for TikTok, Reels, and Shorts. 60s cap.",
  target: "social-feed",
  width: 1080,
  height: 1920,
  fps: 30,
  profile: "main",
  videoBitrateKbps: 5000,
  backgroundFit: "fill",
  fillColor: "#000000",
  maxDurationMs: 60_000,
  audioBitrateKbps: 160,
  includeMusic: true,
  includeAmbient: false,
  ttsVoice: "nova",
  ttsModel: "tts-1",
  narrationSpeed: "normal",
  burnedCaptions: true,
  captionPlacement: "upper-third",
  captionScale: 1.4,
  titleCardStyle: "center",
  fileExtension: "mp4",
  filenameSuffix: "vertical",
};

/**
 * Social Square (1:1) — for Instagram/Twitter feed. 60 second cap,
 * captions in lower third at larger size for mobile readability.
 * Scene art is cropped to square.
 */
const SOCIAL_SQUARE: ExportPreset = {
  id: "social_square",
  label: "Social (Square)",
  description: "1:1 square for Instagram, Twitter, and Bluesky. 60s cap.",
  target: "social-feed",
  width: 1080,
  height: 1080,
  fps: 30,
  profile: "main",
  videoBitrateKbps: 4000,
  backgroundFit: "fill",
  fillColor: "#000000",
  maxDurationMs: 60_000,
  audioBitrateKbps: 160,
  includeMusic: true,
  includeAmbient: false,
  ttsVoice: "nova",
  ttsModel: "tts-1",
  narrationSpeed: "normal",
  burnedCaptions: true,
  captionPlacement: "lower-third",
  captionScale: 1.3,
  titleCardStyle: "center",
  fileExtension: "mp4",
  filenameSuffix: "square",
};

/**
 * In-Game Intro (720p) — for the MUD client's `video:` tag on rooms,
 * mobs, and items. Small file size, baseline H.264 profile for max
 * playback compat, no captions (the MUD client renders its own text
 * and captions would burn-in player-language-agnostic).
 *
 * 30-second hard cap to keep asset sizes bounded — cinematics longer
 * than this are almost always better served as a separate showcase
 * video the player can watch out-of-game.
 */
const IN_GAME: ExportPreset = {
  id: "in_game",
  label: "In-Game Intro (720p)",
  description: "Compact 16:9 for room/mob/item video: fields. Max 30s.",
  target: "in-game-asset",
  width: 1280,
  height: 720,
  fps: 30,
  profile: "baseline",
  videoBitrateKbps: 2500,
  backgroundFit: "fit",
  fillColor: "#000000",
  maxDurationMs: 30_000,
  audioBitrateKbps: 128,
  includeMusic: false,
  includeAmbient: false,
  ttsVoice: "onyx",
  ttsModel: "tts-1",
  narrationSpeed: "normal",
  burnedCaptions: false,
  captionPlacement: "lower-third",
  captionScale: 1.0,
  titleCardStyle: "corner",
  fileExtension: "mp4",
  filenameSuffix: "intro",
};

/**
 * Archive (1080p60) — highest-quality preset for personal archives
 * and campaign trailers. 60 fps for smoother motion, `tts-1-hd`
 * voice for better narration fidelity, full duration, no caps.
 * Render time is proportionally longer.
 */
const ARCHIVE: ExportPreset = {
  id: "archive",
  label: "Archive (1080p60)",
  description: "Highest quality: 1080p60 + tts-1-hd voice. Slower to render.",
  target: "personal-archive",
  width: 1920,
  height: 1080,
  fps: 60,
  profile: "high",
  videoBitrateKbps: 10_000,
  backgroundFit: "fit",
  fillColor: "#000000",
  maxDurationMs: null,
  audioBitrateKbps: 256,
  includeMusic: true,
  includeAmbient: true,
  ttsVoice: "onyx",
  ttsModel: "tts-1-hd",
  narrationSpeed: "normal",
  burnedCaptions: true,
  captionPlacement: "lower-third",
  captionScale: 1.0,
  titleCardStyle: "center",
  fileExtension: "mp4",
  filenameSuffix: "archive",
};

// ─── Registry ────────────────────────────────────────────────────

/** All presets, keyed by ID. */
export const PRESETS: Record<ExportPresetId, ExportPreset> = {
  showcase: SHOWCASE,
  social_vertical: SOCIAL_VERTICAL,
  social_square: SOCIAL_SQUARE,
  in_game: IN_GAME,
  archive: ARCHIVE,
};

/** Ordered list for the preset picker UI (left-to-right reading order). */
export const PRESET_ORDER: ExportPresetId[] = [
  "showcase",
  "social_vertical",
  "social_square",
  "in_game",
  "archive",
];

export function getPreset(id: ExportPresetId): ExportPreset {
  return PRESETS[id];
}

export function getAllPresets(): ExportPreset[] {
  return PRESET_ORDER.map((id) => PRESETS[id]);
}

// ─── Filename suggestions ────────────────────────────────────────

/**
 * Converts a story title to a filesystem-safe base filename slug.
 * Lowercase, spaces and punctuation replaced with hyphens, trimmed,
 * capped at 60 chars. Falls back to "story" if the title is empty.
 */
export function slugifyStoryTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "story";
}

/**
 * Builds a suggested output filename for a story exported under a
 * preset. Format: `<slug>-<presetSuffix>.<ext>`.
 */
export function suggestExportFilename(
  storyTitle: string,
  presetId: ExportPresetId,
): string {
  const preset = PRESETS[presetId];
  return `${slugifyStoryTitle(storyTitle)}-${preset.filenameSuffix}.${preset.fileExtension}`;
}

// ─── Duration fit checks ─────────────────────────────────────────

export interface PresetFitCheck {
  /** Whether the story fits the preset without truncation. */
  fits: boolean;
  /**
   * Total story duration in ms (from the timeline model). Passed
   * back so the UI doesn't have to recompute.
   */
  storyDurationMs: number;
  /** When fits = false, the cap in ms. Undefined when the preset is unlimited. */
  capMs?: number;
  /** When fits = false, how many ms over the cap. */
  overshootMs?: number;
  /**
   * Human-readable warning for the UI. Empty string when fits is true.
   */
  warning: string;
}

/**
 * Checks whether a story of the given total duration fits under a
 * preset's cap. For unlimited presets always returns `fits: true`.
 *
 * The export orchestrator uses this to either (a) proceed directly,
 * (b) prompt the user to confirm truncation, or (c) suggest switching
 * to a different preset.
 */
export function checkStoryFitsPreset(
  storyDurationMs: number,
  preset: ExportPreset,
): PresetFitCheck {
  const cap = preset.maxDurationMs;
  if (cap === null || storyDurationMs <= cap) {
    return {
      fits: true,
      storyDurationMs,
      warning: "",
    };
  }
  const overshootMs = storyDurationMs - cap;
  const overshootSec = Math.ceil(overshootMs / 1000);
  const capSec = Math.round(cap / 1000);
  return {
    fits: false,
    storyDurationMs,
    capMs: cap,
    overshootMs,
    warning: `Story is ${overshootSec}s longer than this preset's ${capSec}s cap. Later scenes will be dropped.`,
  };
}

// ─── Duration formatting ─────────────────────────────────────────

/**
 * Formats a duration in ms as "M:SS" (for short clips) or "M:SS.s"
 * when the caller needs sub-second precision. Used in the preset
 * picker UI to show estimated total length.
 */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
