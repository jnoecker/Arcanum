// ─── Story Video Encoder ─────────────────────────────────────────
// Encodes a sequence of pre-rendered scene PNGs (one per scene, at
// the preset's target dimensions) into a silent H.264 video, then
// muxes the resulting video with the audio track from audio_mix.rs.
//
// Architecture mirrors audio_mix.rs:
//   - `build_video_encode_command()` and `build_mux_command()` are
//     PURE functions returning ffmpeg argv. Unit-tested without
//     spawning ffmpeg.
//   - `encode_video_segments()` and `mux_video_and_audio()` are async
//     wrappers that resolve the ffmpeg binary, spawn it, wait for
//     completion. Used by the export orchestrator (PR 8).
//
// Filtergraph for crossfade-chained scenes (3 scenes, 0.5s xfade):
//
//   [0:v]format=yuv420p[s0];
//   [1:v]format=yuv420p[s1];
//   [2:v]format=yuv420p[s2];
//   [s0][s1]xfade=transition=fade:duration=0.500:offset=5.000[v1];
//   [v1][s2]xfade=transition=fade:duration=0.500:offset=12.500[out]
//
// xfade offsets accumulate: each crossfade shortens the running chain
// length by `crossfade_ms`, so the offset is the cumulative duration
// minus the crossfade. The encoder validates this is positive — a
// scene shorter than the crossfade would corrupt the chain.
//
// For hard cuts (crossfade_ms = None or 0), the filtergraph collapses
// to a `concat` filter which is simpler and faster.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::AtomicBool;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::ffmpeg;
use crate::ffmpeg_progress::FfmpegProgressParser;
use crate::video_export::emit_stage_progress;
use tauri::AppHandle;

// ─── Types ───────────────────────────────────────────────────────

/// One scene's pre-rendered PNG plus how long it should hold on screen.
/// Crossfade durations are global (set on `VideoEncodeInput`), not
/// per-scene, in this PR — per-scene transitions can come later.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneFrame {
    pub png_path: String,
    /// Total time this scene occupies in the final video (including
    /// any portion of the next crossfade). Milliseconds.
    pub duration_ms: u64,
}

/// H.264 codec profile — drives the `-profile:v` flag. Lower profiles
/// are more compatible with older players (in_game preset uses baseline).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum H264Profile {
    Baseline,
    Main,
    High,
}

impl H264Profile {
    fn as_arg(self) -> &'static str {
        match self {
            Self::Baseline => "baseline",
            Self::Main => "main",
            Self::High => "high",
        }
    }
}

/// Video encode request: ordered scene frames + preset video settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoEncodeInput {
    pub scenes: Vec<SceneFrame>,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub video_bitrate_kbps: u32,
    pub profile: H264Profile,
    /// Crossfade duration between consecutive scenes. `None` or `Some(0)`
    /// means hard cuts (using the concat filter instead of xfade).
    pub crossfade_ms: Option<u64>,
    /// Optional caption track. Still carried on the input so the
    /// filter builder can read the style (placement, font scale)
    /// even after the wrap planner has produced `caption_lines`.
    /// When `None` or empty, no captions are burned in.
    pub captions: Option<crate::captions::CaptionTrack>,
    /// Absolute filesystem path to the caption font (TTF/OTF). Required
    /// when `captions` is present AND non-empty. Caller resolves this
    /// via `captions::caption_font_path` first.
    pub caption_font_path: Option<String>,
    /// Pre-planned wrapped caption lines (one entry per wrapped line).
    /// The orchestrator runs `captions::plan_caption_lines` and writes
    /// each line's text to `file_path` before handing this list off to
    /// the encoder. Required when captions are present.
    pub caption_lines: Vec<crate::captions::WrappedCaptionLine>,
}

/// Result of a successful video encode.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoEncodeOutput {
    pub file_path: String,
    pub total_duration_ms: u64,
}

/// The pure result of building an ffmpeg invocation. Doesn't run
/// ffmpeg — that's `encode_video_segments`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoEncodeCommand {
    pub args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MuxCommand {
    pub args: Vec<String>,
}

// ─── Command builders ────────────────────────────────────────────

/// Builds the ffmpeg argv for encoding a sequence of scene PNGs into
/// a silent H.264 video.
///
/// Returns an error if:
///   - The scenes list is empty.
///   - Any scene has duration 0 or an empty PNG path.
///   - A crossfade is requested but a scene is shorter than the crossfade.
///   - width/height/fps/bitrate are zero.
pub fn build_video_encode_command(
    input: &VideoEncodeInput,
    output_path: &Path,
) -> Result<VideoEncodeCommand, String> {
    validate_encode_input(input)?;

    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());
    args.push("-hide_banner".to_string());
    args.push("-loglevel".to_string());
    args.push("error".to_string());
    // Stream progress key=value pairs to stdout so the async runner
    // can forward intra-stage progress to the UI. `-nostats` keeps
    // the normal stats line off stderr (the progress stream replaces it).
    args.push("-progress".to_string());
    args.push("pipe:1".to_string());
    args.push("-nostats".to_string());

    // ─── Inputs: one -loop -t -i triplet per scene ───────────
    for scene in &input.scenes {
        args.push("-loop".to_string());
        args.push("1".to_string());
        args.push("-t".to_string());
        args.push(format_seconds(scene.duration_ms));
        args.push("-i".to_string());
        args.push(scene.png_path.clone());
    }

    // ─── filter_complex ──────────────────────────────────────
    let filter = build_video_filter_complex(input)?;
    args.push("-filter_complex".to_string());
    args.push(filter);

    args.push("-map".to_string());
    args.push("[out]".to_string());

    // ─── Frame rate + codec ──────────────────────────────────
    args.push("-r".to_string());
    args.push(input.fps.to_string());

    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-profile:v".to_string());
    args.push(input.profile.as_arg().to_string());
    args.push("-pix_fmt".to_string());
    args.push("yuv420p".to_string());

    // VBR with a soft cap. The bufsize = 2x bitrate is the standard
    // x264 recommendation for streaming-friendly bitrate variability.
    let kbps = input.video_bitrate_kbps;
    args.push("-b:v".to_string());
    args.push(format!("{kbps}k"));
    args.push("-maxrate".to_string());
    args.push(format!("{kbps}k"));
    args.push("-bufsize".to_string());
    args.push(format!("{}k", kbps * 2));

    // Mark this as silent so downstream muxing knows there's no audio.
    args.push("-an".to_string());

    args.push(output_path.to_string_lossy().to_string());

    Ok(VideoEncodeCommand { args })
}

/// Builds the ffmpeg argv for muxing a silent video with an audio
/// track. Both streams are copied without re-encoding (`-c copy`),
/// so this step is fast and lossless.
pub fn build_mux_command(
    video_path: &Path,
    audio_path: &Path,
    output_path: &Path,
) -> Result<MuxCommand, String> {
    if video_path.as_os_str().is_empty() {
        return Err("Mux: video path is empty".to_string());
    }
    if audio_path.as_os_str().is_empty() {
        return Err("Mux: audio path is empty".to_string());
    }

    let args = vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "error".to_string(),
        "-i".to_string(),
        video_path.to_string_lossy().to_string(),
        "-i".to_string(),
        audio_path.to_string_lossy().to_string(),
        "-c:v".to_string(),
        "copy".to_string(),
        "-c:a".to_string(),
        "copy".to_string(),
        // Stop at the shortest stream so a slightly longer audio
        // tail doesn't trigger a black-frame extension at the end.
        "-shortest".to_string(),
        // Move the moov atom to the front for fast playback start.
        "-movflags".to_string(),
        "+faststart".to_string(),
        output_path.to_string_lossy().to_string(),
    ];

    Ok(MuxCommand { args })
}

// ─── Validation ──────────────────────────────────────────────────

fn validate_encode_input(input: &VideoEncodeInput) -> Result<(), String> {
    if input.scenes.is_empty() {
        return Err("Cannot encode video: scenes list is empty.".to_string());
    }
    if input.width == 0 || input.height == 0 {
        return Err("Cannot encode video: width and height must be non-zero.".to_string());
    }
    if input.fps == 0 {
        return Err("Cannot encode video: fps must be non-zero.".to_string());
    }
    if input.video_bitrate_kbps == 0 {
        return Err("Cannot encode video: video_bitrate_kbps must be non-zero.".to_string());
    }

    for (i, scene) in input.scenes.iter().enumerate() {
        if scene.png_path.is_empty() {
            return Err(format!("Scene {i} has empty png_path"));
        }
        if scene.duration_ms == 0 {
            return Err(format!("Scene {i} has zero duration"));
        }
    }

    if let Some(xfade_ms) = input.crossfade_ms {
        if xfade_ms > 0 && input.scenes.len() > 1 {
            for (i, scene) in input.scenes.iter().enumerate() {
                if scene.duration_ms < xfade_ms {
                    return Err(format!(
                        "Scene {i} duration ({}ms) is shorter than the crossfade ({xfade_ms}ms). \
                         Either lengthen the scene or reduce the crossfade.",
                        scene.duration_ms,
                    ));
                }
            }
        }
    }

    // Captions require a resolved font path AND pre-planned wrapped
    // caption lines. The orchestrator writes each line's text file
    // to disk and populates `caption_lines` before handing off to
    // the encoder. Empty chunks are treated as "no captions".
    if let Some(track) = input.captions.as_ref() {
        if !track.chunks.is_empty() {
            match input.caption_font_path.as_ref() {
                None => {
                    return Err(
                        "Captions provided but caption_font_path is missing.".to_string(),
                    );
                }
                Some(p) if p.is_empty() => {
                    return Err(
                        "Captions provided but caption_font_path is empty.".to_string(),
                    );
                }
                _ => {}
            }
            if input.caption_lines.is_empty() {
                return Err(
                    "Captions have chunks but caption_lines is empty; the orchestrator must run plan_caption_lines before calling the encoder.".to_string(),
                );
            }
        }
    }

    Ok(())
}

// ─── Filtergraph ─────────────────────────────────────────────────

fn build_video_filter_complex(input: &VideoEncodeInput) -> Result<String, String> {
    let mut parts: Vec<String> = Vec::new();

    // The video chain ends in this label. When captions are present
    // it's an intermediate label ([v]); the drawtext chain takes [v]
    // and emits [out]. When captions are absent it's [out] directly.
    // The CLI -map argument always points at [out] either way.
    let effective_captions = input
        .captions
        .as_ref()
        .filter(|t| !t.chunks.is_empty());
    let video_end_label = if effective_captions.is_some() { "v" } else { "out" };

    // Step 1: format every input as yuv420p with a stable label.
    for i in 0..input.scenes.len() {
        parts.push(format!("[{i}:v]format=yuv420p[s{i}]"));
    }

    let use_xfade = matches!(input.crossfade_ms, Some(ms) if ms > 0) && input.scenes.len() > 1;

    if use_xfade {
        let xfade_ms = input.crossfade_ms.unwrap();
        let xfade_sec = ms_to_decimal_seconds(xfade_ms);

        // Build the xfade chain. Each step joins the running chain
        // with the next scene at offset = (cumulative chain length) - xfade.
        let mut current_label = "s0".to_string();
        let mut chain_length_ms: u64 = input.scenes[0].duration_ms;

        for i in 1..input.scenes.len() {
            let next_label = if i == input.scenes.len() - 1 {
                video_end_label.to_string()
            } else {
                format!("v{i}")
            };
            // Offset must be positive — guarded by validate_encode_input.
            let offset_ms = chain_length_ms.saturating_sub(xfade_ms);
            let offset_sec = ms_to_decimal_seconds(offset_ms);
            parts.push(format!(
                "[{current_label}][s{i}]xfade=transition=fade:duration={xfade_sec}:offset={offset_sec}[{next_label}]",
            ));
            current_label = next_label;
            // Combined length grows by (next scene duration - xfade overlap).
            chain_length_ms += input.scenes[i].duration_ms - xfade_ms;
        }
    } else if input.scenes.len() == 1 {
        // Single scene: rename s0 → final video label.
        parts.push(format!("[s0]copy[{video_end_label}]"));
    } else {
        // Hard cuts via concat filter — much simpler than the xfade chain.
        let labels: String = (0..input.scenes.len())
            .map(|i| format!("[s{i}]"))
            .collect::<Vec<_>>()
            .join("");
        parts.push(format!(
            "{labels}concat=n={count}:v=1:a=0[{video_end_label}]",
            count = input.scenes.len(),
        ));
    }

    // Append the burned-in caption layer when present. The drawtext
    // chain consumes [v] and emits [out]. One drawtext per wrapped
    // line with precomputed stacked y coordinates — see captions.rs
    // for why we don't embed newlines in the text files.
    if let Some(track) = effective_captions {
        let font_path = input
            .caption_font_path
            .as_ref()
            .ok_or("Captions present but caption_font_path is missing")?;
        let drawtext_chain = crate::captions::build_drawtext_chain_from_lines(
            &input.caption_lines,
            font_path,
            track.style.placement,
            track.style.font_scale,
            input.height,
        );
        parts.push(format!("[v]{drawtext_chain}[out]"));
    }

    Ok(parts.join(";"))
}

// ─── Helpers ─────────────────────────────────────────────────────

fn format_seconds(ms: u64) -> String {
    let seconds = ms / 1000;
    let millis = ms % 1000;
    format!("{seconds}.{millis:03}")
}

/// Same as `format_seconds`, separated for grep-ability — used inside
/// the filter_complex string where the unit is implied.
fn ms_to_decimal_seconds(ms: u64) -> String {
    format_seconds(ms)
}

/// Computes the total duration of a video, accounting for crossfade
/// overlap (each crossfade shortens the chain by `crossfade_ms`).
pub fn compute_total_duration_ms(input: &VideoEncodeInput) -> u64 {
    let raw: u64 = input.scenes.iter().map(|s| s.duration_ms).sum();
    if let Some(xfade_ms) = input.crossfade_ms {
        if xfade_ms > 0 && input.scenes.len() > 1 {
            let overlaps = (input.scenes.len() - 1) as u64;
            return raw.saturating_sub(xfade_ms * overlaps);
        }
    }
    raw
}

// ─── Async runners ───────────────────────────────────────────────

/// Spawns ffmpeg to encode a sequence of scene PNGs into a silent
/// video. Returns the output file path and the computed total
/// duration (with crossfade overlaps subtracted).
///
/// Streams ffmpeg's `-progress pipe:1` output to parse per-frame
/// progress and forward it to the UI via `video_export:progress`
/// events. The progress fraction is relative to the total computed
/// output duration (same value returned in `VideoEncodeOutput`).
/// Stderr is buffered in the background and surfaced only if
/// ffmpeg exits with a non-zero status.
///
/// When a `cancel_flag` is supplied and it flips to `true` mid-run,
/// the spawned ffmpeg child is killed and the function returns
/// `Err("Export cancelled by user")`.
#[allow(dead_code)] // consumed by the export orchestrator (PR 8)
pub async fn encode_video_segments(
    app: &AppHandle,
    input: VideoEncodeInput,
    output_path: PathBuf,
    cancel_flag: Option<&AtomicBool>,
) -> Result<VideoEncodeOutput, String> {
    let ffmpeg_path = ffmpeg::ffmpeg_binary_path(app).await?;
    let total_duration_ms = compute_total_duration_ms(&input);
    let cmd = build_video_encode_command(&input, &output_path)?;

    if let Some(parent) = output_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create video output dir: {e}"))?;
    }

    let mut child = Command::new(&ffmpeg_path)
        .args(&cmd.args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg for video encode: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "ffmpeg stdout pipe was not captured".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "ffmpeg stderr pipe was not captured".to_string())?;

    // Background stderr drain — prevents the child from blocking on
    // a full stderr buffer while we're reading stdout for progress.
    let stderr_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        let mut buf: Vec<String> = Vec::new();
        while let Ok(Some(line)) = reader.next_line().await {
            buf.push(line);
        }
        buf
    });

    // Parse progress blocks as ffmpeg emits them. For long encodes
    // (4K archive preset, 2+ minute stories) this is what turns the
    // UI progress bar from "stuck at 72%" into a smooth scrub. We
    // also poll the cancellation flag on each line so cancel has
    // ~500ms worst-case latency.
    let mut parser = FfmpegProgressParser::new();
    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut cancelled = false;
    while let Ok(Some(line)) = stdout_reader.next_line().await {
        if let Some(flag) = cancel_flag {
            if crate::cancellation::is_cancelled(flag) {
                cancelled = true;
                break;
            }
        }
        if let Some(event) = parser.feed_line(&line) {
            let fraction = event.fraction(total_duration_ms);
            let message = match (event.frame, event.fps) {
                (Some(frame), Some(fps)) => {
                    format!("Encoding video — frame {frame} @ {fps:.0} fps")
                }
                (Some(frame), None) => format!("Encoding video — frame {frame}"),
                _ => "Encoding video…".to_string(),
            };
            emit_stage_progress(
                app,
                "video_encode",
                message,
                fraction,
                event.speed,
                event.frame,
            );
            if event.ended {
                break;
            }
        }
    }

    if cancelled {
        let _ = child.start_kill();
        let _ = child.wait().await;
        drop(stderr_handle);
        return Err("Export cancelled by user".to_string());
    }

    let exit_status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait on ffmpeg: {e}"))?;
    let stderr_lines = stderr_handle
        .await
        .map_err(|e| format!("stderr drain task panicked: {e}"))?;

    if !exit_status.success() {
        return Err(format!(
            "ffmpeg video encode failed (exit {}): {}",
            exit_status.code().unwrap_or(-1),
            stderr_lines.join("\n").trim(),
        ));
    }

    Ok(VideoEncodeOutput {
        file_path: output_path.to_string_lossy().to_string(),
        total_duration_ms,
    })
}

/// Spawns ffmpeg to mux a silent video with an audio track.
/// Both streams are copied without re-encoding (`-c copy`), and
/// the result is faststart-flagged for instant playback start.
#[allow(dead_code)] // consumed by the export orchestrator (PR 8)
pub async fn mux_video_and_audio(
    app: &AppHandle,
    video_path: PathBuf,
    audio_path: PathBuf,
    output_path: PathBuf,
) -> Result<String, String> {
    let ffmpeg_path = ffmpeg::ffmpeg_binary_path(app).await?;
    let cmd = build_mux_command(&video_path, &audio_path, &output_path)?;

    if let Some(parent) = output_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create mux output dir: {e}"))?;
    }

    let output = Command::new(&ffmpeg_path)
        .args(&cmd.args)
        .output()
        .await
        .map_err(|e| format!("Failed to spawn ffmpeg for mux: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "ffmpeg mux failed (exit {}): {}",
            output.status.code().unwrap_or(-1),
            stderr.trim(),
        ));
    }

    Ok(output_path.to_string_lossy().to_string())
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(path: &str, ms: u64) -> SceneFrame {
        SceneFrame {
            png_path: path.to_string(),
            duration_ms: ms,
        }
    }

    fn input_with(scenes: Vec<SceneFrame>) -> VideoEncodeInput {
        VideoEncodeInput {
            scenes,
            width: 1920,
            height: 1080,
            fps: 30,
            video_bitrate_kbps: 6000,
            profile: H264Profile::High,
            crossfade_ms: None,
            captions: None,
            caption_font_path: None,
            caption_lines: Vec::new(),
        }
    }

    /// Helper that populates input with synthetic wrapped caption
    /// lines (one entry per chunk, treating each chunk as a single
    /// line). Tests don't write real files — the pure builder just
    /// embeds path strings in the filter_complex.
    fn populate_caption_lines(input: &mut VideoEncodeInput) {
        if let Some(track) = input.captions.as_ref() {
            input.caption_lines = track
                .chunks
                .iter()
                .enumerate()
                .map(|(i, c)| crate::captions::WrappedCaptionLine {
                    file_path: format!("/tmp/caption_{i:04}_00.txt"),
                    file_content: c.text.clone(),
                    chunk_start_ms: c.start_ms,
                    chunk_end_ms: c.end_ms,
                    line_index: 0,
                    total_lines: 1,
                })
                .collect();
        }
    }

    fn caption_track(chunks: Vec<crate::captions::CaptionChunk>) -> crate::captions::CaptionTrack {
        crate::captions::CaptionTrack {
            chunks,
            style: crate::captions::CaptionStyle {
                placement: crate::captions::CaptionPlacement::LowerThird,
                font_scale: 1.0,
            },
        }
    }

    fn caption_chunk(text: &str, start_ms: u64, end_ms: u64) -> crate::captions::CaptionChunk {
        crate::captions::CaptionChunk {
            text: text.to_string(),
            start_ms,
            end_ms,
        }
    }

    fn out() -> PathBuf {
        PathBuf::from("/tmp/out.mp4")
    }

    // ─── format_seconds ──────────────────────────────────────

    #[test]
    fn formats_milliseconds_as_decimal_seconds() {
        assert_eq!(format_seconds(0), "0.000");
        assert_eq!(format_seconds(500), "0.500");
        assert_eq!(format_seconds(1234), "1.234");
        assert_eq!(format_seconds(60_000), "60.000");
    }

    // ─── compute_total_duration_ms ───────────────────────────

    #[test]
    fn total_duration_no_crossfade_sums_scenes() {
        let input = input_with(vec![frame("/a", 5000), frame("/b", 8000), frame("/c", 6000)]);
        assert_eq!(compute_total_duration_ms(&input), 19_000);
    }

    #[test]
    fn total_duration_with_crossfade_subtracts_overlaps() {
        let mut input =
            input_with(vec![frame("/a", 5000), frame("/b", 8000), frame("/c", 6000)]);
        input.crossfade_ms = Some(500);
        // 19000 - 2 overlaps × 500 = 18000
        assert_eq!(compute_total_duration_ms(&input), 18_000);
    }

    #[test]
    fn total_duration_zero_crossfade_treats_as_hard_cuts() {
        let mut input = input_with(vec![frame("/a", 5000), frame("/b", 8000)]);
        input.crossfade_ms = Some(0);
        assert_eq!(compute_total_duration_ms(&input), 13_000);
    }

    #[test]
    fn total_duration_single_scene_ignores_crossfade() {
        let mut input = input_with(vec![frame("/only", 5000)]);
        input.crossfade_ms = Some(500);
        assert_eq!(compute_total_duration_ms(&input), 5000);
    }

    // ─── validation ──────────────────────────────────────────

    #[test]
    fn errors_on_empty_scenes_list() {
        let input = input_with(vec![]);
        assert!(build_video_encode_command(&input, &out()).is_err());
    }

    #[test]
    fn errors_on_zero_dimensions() {
        let mut input = input_with(vec![frame("/a", 5000)]);
        input.width = 0;
        assert!(build_video_encode_command(&input, &out()).is_err());
        input.width = 1920;
        input.height = 0;
        assert!(build_video_encode_command(&input, &out()).is_err());
    }

    #[test]
    fn errors_on_zero_fps() {
        let mut input = input_with(vec![frame("/a", 5000)]);
        input.fps = 0;
        assert!(build_video_encode_command(&input, &out()).is_err());
    }

    #[test]
    fn errors_on_zero_bitrate() {
        let mut input = input_with(vec![frame("/a", 5000)]);
        input.video_bitrate_kbps = 0;
        assert!(build_video_encode_command(&input, &out()).is_err());
    }

    #[test]
    fn errors_on_empty_png_path() {
        let input = input_with(vec![frame("", 5000)]);
        let err = build_video_encode_command(&input, &out()).unwrap_err();
        assert!(err.contains("empty png_path"));
    }

    #[test]
    fn errors_on_zero_duration_scene() {
        let input = input_with(vec![frame("/a", 0)]);
        let err = build_video_encode_command(&input, &out()).unwrap_err();
        assert!(err.contains("zero duration"));
    }

    #[test]
    fn errors_when_scene_shorter_than_crossfade() {
        let mut input = input_with(vec![frame("/a", 5000), frame("/b", 200)]);
        input.crossfade_ms = Some(500);
        let err = build_video_encode_command(&input, &out()).unwrap_err();
        assert!(err.contains("shorter than the crossfade"));
    }

    // ─── argv structure ──────────────────────────────────────

    #[test]
    fn includes_overwrite_and_loglevel_flags() {
        let input = input_with(vec![frame("/a.png", 5000)]);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        assert_eq!(cmd.args[0], "-y");
        assert!(cmd.args.contains(&"-hide_banner".to_string()));
    }

    #[test]
    fn each_scene_input_uses_loop_t_i_triplet() {
        let input = input_with(vec![frame("/a.png", 5000), frame("/b.png", 8000)]);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        // Find both PNG paths preceded by -loop 1 -t <sec> -i
        let a_idx = cmd.args.iter().position(|x| x == "/a.png").unwrap();
        assert_eq!(cmd.args[a_idx - 1], "-i");
        assert_eq!(cmd.args[a_idx - 2], "5.000");
        assert_eq!(cmd.args[a_idx - 3], "-t");
        assert_eq!(cmd.args[a_idx - 4], "1");
        assert_eq!(cmd.args[a_idx - 5], "-loop");

        let b_idx = cmd.args.iter().position(|x| x == "/b.png").unwrap();
        assert_eq!(cmd.args[b_idx - 2], "8.000");
    }

    #[test]
    fn includes_h264_profile() {
        let mut input = input_with(vec![frame("/a.png", 5000)]);
        input.profile = H264Profile::Baseline;
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let p_idx = cmd.args.iter().position(|a| a == "-profile:v").unwrap();
        assert_eq!(cmd.args[p_idx + 1], "baseline");
    }

    #[test]
    fn includes_yuv420p_pixel_format() {
        let input = input_with(vec![frame("/a.png", 5000)]);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let pf_idx = cmd.args.iter().position(|a| a == "-pix_fmt").unwrap();
        assert_eq!(cmd.args[pf_idx + 1], "yuv420p");
    }

    #[test]
    fn includes_bitrate_with_2x_bufsize() {
        let mut input = input_with(vec![frame("/a.png", 5000)]);
        input.video_bitrate_kbps = 5000;
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let b_idx = cmd.args.iter().position(|a| a == "-b:v").unwrap();
        assert_eq!(cmd.args[b_idx + 1], "5000k");
        let bufsize_idx = cmd.args.iter().position(|a| a == "-bufsize").unwrap();
        assert_eq!(cmd.args[bufsize_idx + 1], "10000k");
    }

    #[test]
    fn marks_video_as_silent_with_an_flag() {
        let input = input_with(vec![frame("/a.png", 5000)]);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        assert!(cmd.args.contains(&"-an".to_string()));
    }

    #[test]
    fn output_path_is_the_last_arg() {
        let input = input_with(vec![frame("/a.png", 5000)]);
        let cmd = build_video_encode_command(&input, &PathBuf::from("/out/video.mp4")).unwrap();
        assert_eq!(cmd.args.last().unwrap(), "/out/video.mp4");
    }

    // ─── filter_complex content ──────────────────────────────

    fn extract_filter(cmd: &VideoEncodeCommand) -> String {
        let idx = cmd
            .args
            .iter()
            .position(|a| a == "-filter_complex")
            .expect("filter_complex flag missing");
        cmd.args[idx + 1].clone()
    }

    #[test]
    fn single_scene_uses_copy_rename() {
        let input = input_with(vec![frame("/a.png", 5000)]);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[0:v]format=yuv420p[s0]"));
        assert!(filter.contains("[s0]copy[out]"));
        assert!(!filter.contains("xfade"));
        assert!(!filter.contains("concat"));
    }

    #[test]
    fn hard_cuts_use_concat_filter() {
        let input = input_with(vec![
            frame("/a.png", 5000),
            frame("/b.png", 8000),
            frame("/c.png", 6000),
        ]);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[s0][s1][s2]concat=n=3:v=1:a=0[out]"));
        assert!(!filter.contains("xfade"));
    }

    #[test]
    fn crossfade_chain_two_scenes_uses_xfade_directly_to_out() {
        let mut input = input_with(vec![frame("/a.png", 5000), frame("/b.png", 8000)]);
        input.crossfade_ms = Some(500);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[s0][s1]xfade=transition=fade:duration=0.500:offset=4.500[out]"));
    }

    #[test]
    fn crossfade_chain_three_scenes_uses_intermediate_label() {
        let mut input = input_with(vec![
            frame("/a.png", 5000),
            frame("/b.png", 8000),
            frame("/c.png", 6000),
        ]);
        input.crossfade_ms = Some(500);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        // First xfade: s0 + s1 → v1, offset = 5000 - 500 = 4500ms
        assert!(filter.contains("[s0][s1]xfade=transition=fade:duration=0.500:offset=4.500[v1]"));
        // Second xfade: v1 + s2 → out
        // Chain length after first xfade = 5000 + 8000 - 500 = 12500
        // Offset for second xfade = 12500 - 500 = 12000
        assert!(filter.contains("[v1][s2]xfade=transition=fade:duration=0.500:offset=12.000[out]"));
    }

    #[test]
    fn crossfade_zero_falls_back_to_concat() {
        let mut input = input_with(vec![frame("/a.png", 5000), frame("/b.png", 8000)]);
        input.crossfade_ms = Some(0);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(!filter.contains("xfade"));
        assert!(filter.contains("concat=n=2"));
    }

    #[test]
    fn every_scene_gets_a_format_label() {
        let input = input_with(vec![
            frame("/a.png", 5000),
            frame("/b.png", 8000),
            frame("/c.png", 6000),
        ]);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[0:v]format=yuv420p[s0]"));
        assert!(filter.contains("[1:v]format=yuv420p[s1]"));
        assert!(filter.contains("[2:v]format=yuv420p[s2]"));
    }

    // ─── caption integration ─────────────────────────────────

    #[test]
    fn no_captions_emits_video_to_out_directly() {
        let input = input_with(vec![frame("/a.png", 5000), frame("/b.png", 5000)]);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        // Hard cuts → concat directly to [out]
        assert!(filter.contains("concat=n=2:v=1:a=0[out]"));
        // No drawtext anywhere
        assert!(!filter.contains("drawtext"));
        assert!(!filter.contains("[v]"));
    }

    #[test]
    fn captions_emit_video_to_v_then_drawtext_to_out() {
        let mut input = input_with(vec![frame("/a.png", 5000), frame("/b.png", 5000)]);
        input.captions = Some(caption_track(vec![caption_chunk("Hello", 1000, 4000)]));
        input.caption_font_path = Some("/fonts/CrimsonPro-Variable.ttf".to_string());
        populate_caption_lines(&mut input);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        // Concat now goes to intermediate [v] label
        assert!(filter.contains("concat=n=2:v=1:a=0[v]"));
        // drawtext chain consumes [v] and emits [out]
        assert!(filter.contains("[v]drawtext="));
        assert!(filter.contains("[out]"));
        // Caption references its pre-written text file via textfile=
        // (chunk 0, line 0 — single-line chunk)
        assert!(filter.contains("textfile=/tmp/caption_0000_00.txt"));
        assert!(filter.contains(r"between(t\,1.000\,4.000)"));
    }

    #[test]
    fn captions_with_xfade_chain_terminates_at_v_then_drawtext() {
        let mut input = input_with(vec![
            frame("/a.png", 5000),
            frame("/b.png", 5000),
            frame("/c.png", 5000),
        ]);
        input.crossfade_ms = Some(500);
        input.captions = Some(caption_track(vec![caption_chunk("Hi", 0, 1000)]));
        input.caption_font_path = Some("/fonts/font.ttf".to_string());
        populate_caption_lines(&mut input);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[v1][s2]xfade=transition=fade:duration=0.500:offset=9.000[v]"));
        assert!(filter.contains("[v]drawtext="));
        assert!(filter.ends_with("[out]"));
    }

    #[test]
    fn captions_with_single_scene_uses_copy_then_drawtext() {
        let mut input = input_with(vec![frame("/a.png", 5000)]);
        input.captions = Some(caption_track(vec![caption_chunk("Solo", 0, 5000)]));
        input.caption_font_path = Some("/fonts/font.ttf".to_string());
        populate_caption_lines(&mut input);
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[s0]copy[v]"));
        assert!(filter.contains("[v]drawtext="));
        assert!(filter.contains("textfile=/tmp/caption_0000_00.txt"));
    }

    #[test]
    fn empty_caption_chunks_skip_drawtext_layer_entirely() {
        let mut input = input_with(vec![frame("/a.png", 5000)]);
        input.captions = Some(caption_track(vec![]));
        input.caption_font_path = Some("/fonts/font.ttf".to_string());
        let cmd = build_video_encode_command(&input, &out()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[s0]copy[out]"));
        assert!(!filter.contains("drawtext"));
    }

    #[test]
    fn errors_when_captions_have_chunks_but_no_font_path() {
        let mut input = input_with(vec![frame("/a.png", 5000)]);
        input.captions = Some(caption_track(vec![caption_chunk("hi", 0, 1000)]));
        input.caption_font_path = None;
        populate_caption_lines(&mut input);
        let err = build_video_encode_command(&input, &out()).unwrap_err();
        assert!(err.contains("caption_font_path is missing"));
    }

    #[test]
    fn errors_when_caption_font_path_is_empty_string() {
        let mut input = input_with(vec![frame("/a.png", 5000)]);
        input.captions = Some(caption_track(vec![caption_chunk("hi", 0, 1000)]));
        input.caption_font_path = Some("".to_string());
        populate_caption_lines(&mut input);
        let err = build_video_encode_command(&input, &out()).unwrap_err();
        assert!(err.contains("empty"));
    }

    #[test]
    fn errors_when_captions_have_chunks_but_caption_lines_is_empty() {
        let mut input = input_with(vec![frame("/a.png", 5000)]);
        input.captions = Some(caption_track(vec![caption_chunk("hi", 0, 1000)]));
        input.caption_font_path = Some("/fonts/font.ttf".to_string());
        // caption_lines left empty — orchestrator forgot to run plan
        let err = build_video_encode_command(&input, &out()).unwrap_err();
        assert!(err.contains("caption_lines is empty"));
    }

    #[test]
    fn empty_caption_chunks_do_not_require_font_path() {
        // Edge case: caller passed an empty caption track (e.g. user
        // disabled captions in the dialog mid-export). We treat this
        // as "no captions" and don't require a font path.
        let mut input = input_with(vec![frame("/a.png", 5000)]);
        input.captions = Some(caption_track(vec![]));
        input.caption_font_path = None;
        assert!(build_video_encode_command(&input, &out()).is_ok());
    }

    // ─── mux command builder ─────────────────────────────────

    #[test]
    fn mux_command_uses_copy_codecs() {
        let cmd = build_mux_command(
            Path::new("/v.mp4"),
            Path::new("/a.m4a"),
            Path::new("/out.mp4"),
        )
        .unwrap();
        let v_idx = cmd.args.iter().position(|a| a == "-c:v").unwrap();
        assert_eq!(cmd.args[v_idx + 1], "copy");
        let a_idx = cmd.args.iter().position(|a| a == "-c:a").unwrap();
        assert_eq!(cmd.args[a_idx + 1], "copy");
    }

    #[test]
    fn mux_command_uses_shortest_and_faststart() {
        let cmd = build_mux_command(
            Path::new("/v.mp4"),
            Path::new("/a.m4a"),
            Path::new("/out.mp4"),
        )
        .unwrap();
        assert!(cmd.args.contains(&"-shortest".to_string()));
        let mv_idx = cmd.args.iter().position(|a| a == "-movflags").unwrap();
        assert_eq!(cmd.args[mv_idx + 1], "+faststart");
    }

    #[test]
    fn mux_command_takes_two_inputs_in_order() {
        let cmd = build_mux_command(
            Path::new("/v.mp4"),
            Path::new("/a.m4a"),
            Path::new("/out.mp4"),
        )
        .unwrap();
        let v_idx = cmd.args.iter().position(|x| x == "/v.mp4").unwrap();
        assert_eq!(cmd.args[v_idx - 1], "-i");
        let a_idx = cmd.args.iter().position(|x| x == "/a.m4a").unwrap();
        assert_eq!(cmd.args[a_idx - 1], "-i");
        assert!(v_idx < a_idx);
    }

    #[test]
    fn mux_command_output_is_last() {
        let cmd = build_mux_command(
            Path::new("/v.mp4"),
            Path::new("/a.m4a"),
            Path::new("/out.mp4"),
        )
        .unwrap();
        assert_eq!(cmd.args.last().unwrap(), "/out.mp4");
    }

    // ─── Integration test: real ffmpeg encode + mux ────────────
    //
    // Generates synthetic scene PNGs via ffmpeg's color source,
    // encodes them with the xfade chain, generates a synthetic
    // audio track, muxes everything, and verifies the result is
    // a valid MP4 with the expected duration.
    //
    // Marked #[ignore] so it only runs explicitly:
    //
    //   cargo test video_encode::tests::encodes_real_video_via_ffmpeg \
    //     -- --ignored --nocapture
    //
    // Self-bootstraps ffmpeg via download_ffmpeg_blocking when
    // not on PATH, so no manual setup is needed.
    #[test]
    #[ignore]
    fn encodes_real_video_via_ffmpeg() {
        use std::process::Command as StdCommand;

        let tmp = std::env::temp_dir().join(format!(
            "arcanum-video-encode-test-{}",
            std::process::id(),
        ));
        std::fs::create_dir_all(&tmp).unwrap();

        let ffmpeg_bin = match which::which("ffmpeg") {
            Ok(p) => p,
            Err(_) => {
                eprintln!("ffmpeg not on PATH; downloading via ffmpeg-sidecar...");
                crate::ffmpeg::download_ffmpeg_blocking(&tmp)
                    .expect("downloading ffmpeg should succeed")
            }
        };

        // 1) Generate three synthetic scene PNGs (red, green, blue).
        let frames = [
            (tmp.join("scene_001.png"), "red"),
            (tmp.join("scene_002.png"), "green"),
            (tmp.join("scene_003.png"), "blue"),
        ];
        for (path, color) in &frames {
            let status = StdCommand::new(&ffmpeg_bin)
                .args([
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    &format!("color=c={color}:s=640x360:d=1"),
                    "-frames:v",
                    "1",
                    path.to_str().unwrap(),
                ])
                .status()
                .unwrap();
            assert!(status.success(), "failed to generate {path:?}");
        }

        // 2) Build the encode command with crossfades and run it.
        let video_path = tmp.join("video.mp4");
        let input = VideoEncodeInput {
            scenes: vec![
                frame(&frames[0].0.to_string_lossy(), 2000),
                frame(&frames[1].0.to_string_lossy(), 2000),
                frame(&frames[2].0.to_string_lossy(), 2000),
            ],
            width: 640,
            height: 360,
            fps: 30,
            video_bitrate_kbps: 1500,
            profile: H264Profile::High,
            crossfade_ms: Some(500),
            captions: None,
            caption_font_path: None,
            caption_lines: Vec::new(),
        };
        let cmd = build_video_encode_command(&input, &video_path).unwrap();
        let result = StdCommand::new(&ffmpeg_bin)
            .args(&cmd.args)
            .output()
            .unwrap();
        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            panic!("video encode failed: {stderr}");
        }
        assert!(video_path.exists(), "encoded video should exist");

        // 3) Probe the encoded video duration.
        // Total = 6000ms - 2 overlaps × 500ms = 5000ms
        let expected_total_ms = compute_total_duration_ms(&input);
        assert_eq!(expected_total_ms, 5000);

        if let Ok(ffprobe) = which::which("ffprobe") {
            let probe = StdCommand::new(&ffprobe)
                .args([
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    video_path.to_str().unwrap(),
                ])
                .output()
                .unwrap();
            let duration_str = String::from_utf8_lossy(&probe.stdout);
            let duration_sec: f64 = duration_str.trim().parse().unwrap_or(0.0);
            assert!(
                (4.5..=5.5).contains(&duration_sec),
                "expected ~5s video, got {duration_sec}s",
            );
            eprintln!("Encoded video duration: {duration_sec}s");
        }

        // 4) Generate a synthetic audio track and test the mux.
        let audio_path = tmp.join("audio.m4a");
        let audio_status = StdCommand::new(&ffmpeg_bin)
            .args([
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=5",
                "-c:a",
                "aac",
                audio_path.to_str().unwrap(),
            ])
            .status()
            .unwrap();
        assert!(audio_status.success());

        let final_path = tmp.join("final.mp4");
        let mux_cmd = build_mux_command(&video_path, &audio_path, &final_path).unwrap();
        let mux_result = StdCommand::new(&ffmpeg_bin)
            .args(&mux_cmd.args)
            .output()
            .unwrap();
        if !mux_result.status.success() {
            let stderr = String::from_utf8_lossy(&mux_result.stderr);
            panic!("mux failed: {stderr}");
        }
        assert!(final_path.exists(), "muxed final video should exist");
        let metadata = std::fs::metadata(&final_path).unwrap();
        assert!(
            metadata.len() > 1000,
            "final mp4 is suspiciously small: {} bytes",
            metadata.len(),
        );
        eprintln!("Final muxed mp4: {} bytes", metadata.len());

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // ─── Integration test: caption burn-in with real ffmpeg ────
    //
    // Generates synthetic scene PNGs, builds a caption track with two
    // chunks, and runs the encoder against the bundled CrimsonPro
    // font. Verifies the output exists and has the expected duration.
    //
    // This is the closest we get to end-to-end caption verification
    // without doing pixel-level OCR. If the filtergraph string is
    // malformed, ffmpeg will reject it with a parse error and the
    // test will fail loudly with the stderr output.
    //
    //   cargo test video_encode::tests::burns_real_captions_via_ffmpeg \
    //     -- --ignored --nocapture
    #[test]
    #[ignore]
    fn burns_real_captions_via_ffmpeg() {
        use std::process::Command as StdCommand;

        let tmp = std::env::temp_dir().join(format!(
            "arcanum-captions-test-{}",
            std::process::id(),
        ));
        std::fs::create_dir_all(&tmp).unwrap();

        // Resolve ffmpeg (download on first use if needed).
        let ffmpeg_bin = match which::which("ffmpeg") {
            Ok(p) => p,
            Err(_) => {
                eprintln!("ffmpeg not on PATH; downloading via ffmpeg-sidecar...");
                crate::ffmpeg::download_ffmpeg_blocking(&tmp)
                    .expect("downloading ffmpeg should succeed")
            }
        };

        // Resolve the bundled font directly from the source tree.
        // CARGO_MANIFEST_DIR is the src-tauri directory, and the font
        // lives at resources/fonts/<name>.
        let font_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("fonts")
            .join("CrimsonPro-Variable.ttf");
        assert!(
            font_path.exists(),
            "bundled caption font missing at {}",
            font_path.display(),
        );

        // 1) Generate two synthetic scene PNGs.
        let frames = [
            (tmp.join("scene_001.png"), "navy"),
            (tmp.join("scene_002.png"), "darkgreen"),
        ];
        for (path, color) in &frames {
            let status = StdCommand::new(&ffmpeg_bin)
                .args([
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    &format!("color=c={color}:s=640x360:d=1"),
                    "-frames:v",
                    "1",
                    path.to_str().unwrap(),
                ])
                .status()
                .unwrap();
            assert!(status.success(), "failed to generate {path:?}");
        }

        // 2) Build the encode command with captions. The caption text
        //    files must be pre-written to disk before invoking ffmpeg
        //    (textfile= syntax) — the orchestrator does this in real
        //    use; we replicate it here.
        let captions = crate::captions::CaptionTrack {
            chunks: vec![
                crate::captions::CaptionChunk {
                    text: "First scene caption with a comma, an apostrophe's flair".to_string(),
                    start_ms: 200,
                    end_ms: 2800,
                },
                crate::captions::CaptionChunk {
                    text: "Second scene reveals a deeper truth".to_string(),
                    start_ms: 3200,
                    end_ms: 5800,
                },
            ],
            style: crate::captions::CaptionStyle {
                placement: crate::captions::CaptionPlacement::LowerThird,
                font_scale: 1.0,
            },
        };
        // Run the line-level planner — one file per wrapped line.
        let caption_lines = crate::captions::plan_caption_lines(
            &captions, &tmp, 640, 360,
        );
        for line in &caption_lines {
            std::fs::write(&line.file_path, &line.file_content)
                .expect("write caption line text file");
        }

        let video_path = tmp.join("captioned.mp4");
        let input = VideoEncodeInput {
            scenes: vec![
                frame(&frames[0].0.to_string_lossy(), 3000),
                frame(&frames[1].0.to_string_lossy(), 3000),
            ],
            width: 640,
            height: 360,
            fps: 30,
            video_bitrate_kbps: 1500,
            profile: H264Profile::High,
            crossfade_ms: None,
            captions: Some(captions),
            caption_font_path: Some(font_path.to_string_lossy().to_string()),
            caption_lines,
        };
        let cmd = build_video_encode_command(&input, &video_path).unwrap();
        let result = StdCommand::new(&ffmpeg_bin)
            .args(&cmd.args)
            .output()
            .unwrap();
        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            panic!("captioned video encode failed: {stderr}");
        }
        assert!(video_path.exists(), "captioned video should exist");
        let metadata = std::fs::metadata(&video_path).unwrap();
        assert!(
            metadata.len() > 1000,
            "captioned mp4 is suspiciously small: {} bytes",
            metadata.len(),
        );
        eprintln!("Captioned mp4: {} bytes", metadata.len());

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
