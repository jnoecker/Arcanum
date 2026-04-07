// ─── Story Audio Mixer ───────────────────────────────────────────
// Builds an ffmpeg filter_complex for the story → video export
// pipeline. Mixes per-scene narration MP3s (delayed to their absolute
// timeline offsets) with optional zone music (looped, sidechain-ducked
// under narration) and zone ambient (looped, low-volume bed).
//
// Architecture:
//   - `build_mix_command()` is a PURE function that turns a MixInput
//     into the exact ffmpeg argv. Unit-tested without invoking ffmpeg.
//   - `mix_audio()` is the async wrapper that resolves the ffmpeg
//     binary, spawns it, waits for completion, and returns the output
//     file metadata. Used by the export orchestrator (PR 7).
//
// Filtergraph shape (4 narrations + music + ambient):
//
//   [0:a]adelay=1000|1000[n0];
//   [1:a]adelay=8500|8500[n1];
//   [2:a]adelay=16000|16000[n2];
//   [3:a]adelay=22000|22000[n3];
//   [n0][n1][n2][n3]amix=inputs=4:duration=longest:normalize=0[narr];
//   [4:a]volume=0.55[music_raw];
//   [music_raw][narr]sidechaincompress=threshold=0.04:ratio=6:attack=15:release=400[music_d];
//   [5:a]volume=0.22[ambient];
//   [music_d][narr][ambient]amix=inputs=3:duration=first:normalize=0[out]
//
// All four major shapes are supported:
//   - narrations + music + ambient
//   - narrations + music (no ambient)
//   - narrations only
//   - music + ambient with no narrations (silent story with ambient bed)
//
// Returns an error if there is nothing to mix at all.

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

/// One scene's narration audio with its absolute placement in the
/// final video timeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NarrationTrack {
    pub file_path: String,
    /// Absolute start time in the final video, in milliseconds.
    pub offset_ms: u64,
}

/// Mix request: zero or more narration tracks plus optional music
/// and ambient backing tracks.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMixInput {
    pub narrations: Vec<NarrationTrack>,
    pub music_path: Option<String>,
    pub ambient_path: Option<String>,
    /// Total story duration in milliseconds. Output is clamped to this
    /// length so looping music/ambient don't run forever.
    pub total_duration_ms: u64,
    /// Audio bitrate in kbps for the AAC encoder.
    pub audio_bitrate_kbps: u32,
}

/// Result of a successful mix.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMixOutput {
    pub file_path: String,
    pub duration_ms: u64,
}

// ─── Volume + dynamics constants ─────────────────────────────────

/// Music background volume (linear, 0..1) before sidechain ducking.
const MUSIC_VOLUME: f32 = 0.55;
/// Ambient bed volume (linear, 0..1).
const AMBIENT_VOLUME: f32 = 0.22;

// Sidechain compressor settings — chosen for music ducking under
// dialogue. Tuned to be audible but not aggressive.
const DUCK_THRESHOLD: f32 = 0.04;
const DUCK_RATIO: u32 = 6;
const DUCK_ATTACK_MS: u32 = 15;
const DUCK_RELEASE_MS: u32 = 400;

// ─── Pure command builder ────────────────────────────────────────

/// The pure result of building an ffmpeg invocation. Doesn't actually
/// run ffmpeg — `mix_audio` is the function that spawns the process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AudioMixCommand {
    /// Full argv (excluding the ffmpeg binary path itself). Pass this
    /// to `Command::args`.
    pub args: Vec<String>,
}

/// Builds the ffmpeg argument vector for an audio mix.
///
/// Returns an error when the input has nothing to mix (no narrations,
/// no music, no ambient) or when total_duration_ms is zero.
pub fn build_mix_command(
    input: &AudioMixInput,
    output_path: &Path,
) -> Result<AudioMixCommand, String> {
    if input.total_duration_ms == 0 {
        return Err("Cannot mix audio: total duration is zero.".to_string());
    }

    let has_narrations = !input.narrations.is_empty();
    let has_music = input.music_path.is_some();
    let has_ambient = input.ambient_path.is_some();

    if !has_narrations && !has_music && !has_ambient {
        return Err(
            "Cannot mix audio: no narrations, music, or ambient tracks provided."
                .to_string(),
        );
    }

    let mut args: Vec<String> = Vec::new();
    // Overwrite output without prompting + suppress noisy banner.
    args.push("-y".to_string());
    args.push("-hide_banner".to_string());
    args.push("-loglevel".to_string());
    args.push("error".to_string());
    // Emit progress key=value pairs to stdout so the async runner
    // can parse them and forward intra-stage progress events to the
    // UI. Stderr is reserved for actual error messages.
    args.push("-progress".to_string());
    args.push("pipe:1".to_string());
    args.push("-nostats".to_string());

    // ─── Inputs (in declared order, indexed for the filter) ──
    let mut next_index: usize = 0;
    let mut narration_indexes: Vec<usize> = Vec::with_capacity(input.narrations.len());

    for narration in &input.narrations {
        if narration.file_path.is_empty() {
            return Err("Narration track has empty file_path".to_string());
        }
        args.push("-i".to_string());
        args.push(narration.file_path.clone());
        narration_indexes.push(next_index);
        next_index += 1;
    }

    let music_index = if let Some(music) = input.music_path.as_ref() {
        // Loop the music input infinitely; the -t flag at the end
        // clamps total duration so we don't render forever.
        args.push("-stream_loop".to_string());
        args.push("-1".to_string());
        args.push("-i".to_string());
        args.push(music.clone());
        let idx = next_index;
        next_index += 1;
        Some(idx)
    } else {
        None
    };

    let ambient_index = if let Some(ambient) = input.ambient_path.as_ref() {
        args.push("-stream_loop".to_string());
        args.push("-1".to_string());
        args.push("-i".to_string());
        args.push(ambient.clone());
        // Last input — no further increment needed.
        Some(next_index)
    } else {
        None
    };

    // ─── Filter complex ──────────────────────────────────────
    let filter = build_filter_complex(
        &narration_indexes,
        &input.narrations,
        music_index,
        ambient_index,
    );
    args.push("-filter_complex".to_string());
    args.push(filter);

    args.push("-map".to_string());
    args.push("[out]".to_string());

    // ─── Duration clamp + encoder settings ───────────────────
    let total_seconds = format_seconds(input.total_duration_ms);
    args.push("-t".to_string());
    args.push(total_seconds);

    args.push("-c:a".to_string());
    args.push("aac".to_string());
    args.push("-b:a".to_string());
    args.push(format!("{}k", input.audio_bitrate_kbps.max(64)));

    args.push(output_path.to_string_lossy().to_string());

    Ok(AudioMixCommand { args })
}

/// Formats a millisecond duration as a decimal seconds string with
/// 3-digit precision: 1500 → "1.500".
fn format_seconds(ms: u64) -> String {
    let seconds = ms / 1000;
    let millis = ms % 1000;
    format!("{seconds}.{millis:03}")
}

/// Constructs the filter_complex value. Handles every combination of
/// narration / music / ambient presence.
fn build_filter_complex(
    narration_indexes: &[usize],
    narrations: &[NarrationTrack],
    music_index: Option<usize>,
    ambient_index: Option<usize>,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    // ─── Narration delay + mix → [narr] ──────────────────────
    let narr_label: Option<&str> = if narration_indexes.is_empty() {
        None
    } else {
        for (i, &input_idx) in narration_indexes.iter().enumerate() {
            let offset = narrations[i].offset_ms;
            // adelay default unit is milliseconds. Pipe-separate the
            // value once per channel (we use stereo, so 2 values).
            parts.push(format!(
                "[{input_idx}:a]adelay={offset}|{offset}[n{i}]",
            ));
        }
        if narration_indexes.len() == 1 {
            // Rename to [narr] for consistency with the multi-narration path.
            parts.push("[n0]anull[narr]".to_string());
        } else {
            let labels: String = (0..narration_indexes.len())
                .map(|i| format!("[n{i}]"))
                .collect::<Vec<_>>()
                .join("");
            parts.push(format!(
                "{labels}amix=inputs={count}:duration=longest:normalize=0[narr]",
                count = narration_indexes.len(),
            ));
        }
        Some("narr")
    };

    // ─── Music: volume + optional sidechain duck → [music_out] ──
    let music_label: Option<String> = if let Some(idx) = music_index {
        parts.push(format!("[{idx}:a]volume={MUSIC_VOLUME}[music_raw]"));
        if narr_label.is_some() {
            // Duck music under narration via sidechain compress. We
            // need a copy of the narration signal as the sidechain,
            // so split it into two outputs first.
            parts.push("[narr]asplit=2[narr_main][narr_sc]".to_string());
            parts.push(format!(
                "[music_raw][narr_sc]sidechaincompress=threshold={DUCK_THRESHOLD}:ratio={DUCK_RATIO}:attack={DUCK_ATTACK_MS}:release={DUCK_RELEASE_MS}[music_out]",
            ));
            Some("music_out".to_string())
        } else {
            // No narration → no need to duck.
            Some("music_raw".to_string())
        }
    } else {
        None
    };

    // ─── Ambient: volume only → [ambient_out] ────────────────
    let ambient_label: Option<String> = ambient_index.map(|idx| {
        parts.push(format!("[{idx}:a]volume={AMBIENT_VOLUME}[ambient_out]"));
        "ambient_out".to_string()
    });

    // ─── Final mix → [out] ───────────────────────────────────
    // Pick the narration label (split-main if music ducked it, else raw).
    let narr_for_final: Option<String> = match (narr_label, music_label.as_deref()) {
        (Some(_), Some("music_out")) => Some("narr_main".to_string()),
        (Some(label), _) => Some(label.to_string()),
        (None, _) => None,
    };

    let mut final_inputs: Vec<String> = Vec::new();
    if let Some(label) = music_label.as_ref() {
        final_inputs.push(format!("[{label}]"));
    }
    if let Some(label) = narr_for_final.as_ref() {
        final_inputs.push(format!("[{label}]"));
    }
    if let Some(label) = ambient_label.as_ref() {
        final_inputs.push(format!("[{label}]"));
    }

    if final_inputs.len() == 1 {
        // Single source — just rename it to [out].
        let only = &final_inputs[0];
        parts.push(format!("{only}anull[out]"));
    } else {
        let count = final_inputs.len();
        // amix `duration=first` makes the output as long as the FIRST
        // input. We list narration first when present (so the mix is
        // narration-length-driven), or music first as fallback. The
        // outer -t clamp on the CLI is the real safety net.
        let joined = final_inputs.join("");
        parts.push(format!(
            "{joined}amix=inputs={count}:duration=longest:normalize=0[out]",
        ));
    }

    parts.join(";")
}

// ─── Async runner ────────────────────────────────────────────────

/// Mixes audio for a story by spawning ffmpeg with the args from
/// `build_mix_command`. Resolves ffmpeg from the bundled cache or
/// system PATH (must already be available — call `ensure_ffmpeg_ready`
/// from the frontend before invoking this).
///
/// Streams ffmpeg's `-progress pipe:1` output to parse per-frame
/// progress and forward it to the UI via `video_export:progress`
/// events. Stderr is buffered in the background and surfaced only
/// if ffmpeg exits with a non-zero status.
///
/// When a `cancel_flag` is supplied and it flips to `true` mid-run,
/// the spawned ffmpeg child is killed and the function returns
/// `Err("Export cancelled by user")`. Cancellation is polled once
/// per progress block (~500ms latency worst case).
#[allow(dead_code)] // consumed by the export orchestrator (PR 7)
pub async fn mix_audio(
    app: &AppHandle,
    input: AudioMixInput,
    output_path: PathBuf,
    cancel_flag: Option<&AtomicBool>,
) -> Result<AudioMixOutput, String> {
    let ffmpeg_path = ffmpeg::ffmpeg_binary_path(app).await?;
    let cmd = build_mix_command(&input, &output_path)?;

    if let Some(parent) = output_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create output directory: {e}"))?;
    }

    let total_duration_ms = input.total_duration_ms;

    let mut child = Command::new(&ffmpeg_path)
        .args(&cmd.args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "ffmpeg stdout pipe was not captured".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "ffmpeg stderr pipe was not captured".to_string())?;

    // Drain stderr in the background so the child can't block on a
    // full stderr pipe while we're reading stdout. The collected
    // lines are surfaced only if ffmpeg exits non-zero.
    let stderr_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        let mut buf: Vec<String> = Vec::new();
        while let Ok(Some(line)) = reader.next_line().await {
            buf.push(line);
        }
        buf
    });

    // Read progress from stdout as ffmpeg emits it (~every 500ms).
    // Each complete key=value block terminates with `progress=continue`
    // or `progress=end` and flushes one FfmpegProgressEvent. We also
    // poll the cancellation flag on each line so cancel has ~500ms
    // worst-case latency (the interval between progress blocks).
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
            emit_stage_progress(
                app,
                "audio_mix",
                "Mixing narration, music, and ambient…",
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
        // Drop the stderr handle without awaiting — the background
        // task exits when the child's stderr pipe closes.
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
            "ffmpeg audio mix failed (exit {}): {}",
            exit_status.code().unwrap_or(-1),
            stderr_lines.join("\n").trim(),
        ));
    }

    Ok(AudioMixOutput {
        file_path: output_path.to_string_lossy().to_string(),
        duration_ms: total_duration_ms,
    })
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn narration(file: &str, offset_ms: u64) -> NarrationTrack {
        NarrationTrack {
            file_path: file.to_string(),
            offset_ms,
        }
    }

    fn input_with(narrations: Vec<NarrationTrack>) -> AudioMixInput {
        AudioMixInput {
            narrations,
            music_path: None,
            ambient_path: None,
            total_duration_ms: 30_000,
            audio_bitrate_kbps: 192,
        }
    }

    fn output() -> PathBuf {
        PathBuf::from("/tmp/output.m4a")
    }

    // ─── format_seconds ──────────────────────────────────────

    #[test]
    fn formats_zero_seconds() {
        assert_eq!(format_seconds(0), "0.000");
    }

    #[test]
    fn formats_round_seconds() {
        assert_eq!(format_seconds(5_000), "5.000");
    }

    #[test]
    fn formats_sub_second_precision() {
        assert_eq!(format_seconds(1_234), "1.234");
        assert_eq!(format_seconds(60_500), "60.500");
        assert_eq!(format_seconds(123_001), "123.001");
    }

    // ─── error cases ─────────────────────────────────────────

    #[test]
    fn errors_when_total_duration_is_zero() {
        let mut input = input_with(vec![]);
        input.total_duration_ms = 0;
        assert!(build_mix_command(&input, &output()).is_err());
    }

    #[test]
    fn errors_when_no_audio_sources() {
        let input = input_with(vec![]);
        let result = build_mix_command(&input, &output());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("no narrations"));
    }

    #[test]
    fn errors_when_narration_has_empty_path() {
        let input = input_with(vec![narration("", 0)]);
        assert!(build_mix_command(&input, &output()).is_err());
    }

    // ─── argv structure ──────────────────────────────────────

    #[test]
    fn includes_overwrite_and_loglevel_flags() {
        let input = input_with(vec![narration("/n0.mp3", 0)]);
        let cmd = build_mix_command(&input, &output()).unwrap();
        assert_eq!(cmd.args[0], "-y");
        assert!(cmd.args.contains(&"-hide_banner".to_string()));
        assert!(cmd.args.contains(&"-loglevel".to_string()));
    }

    #[test]
    fn includes_total_duration_clamp() {
        let mut input = input_with(vec![narration("/n0.mp3", 0)]);
        input.total_duration_ms = 12_500;
        let cmd = build_mix_command(&input, &output()).unwrap();
        let t_idx = cmd.args.iter().position(|a| a == "-t").unwrap();
        assert_eq!(cmd.args[t_idx + 1], "12.500");
    }

    #[test]
    fn includes_aac_encoder_with_bitrate() {
        let mut input = input_with(vec![narration("/n0.mp3", 0)]);
        input.audio_bitrate_kbps = 256;
        let cmd = build_mix_command(&input, &output()).unwrap();
        let codec_idx = cmd.args.iter().position(|a| a == "-c:a").unwrap();
        assert_eq!(cmd.args[codec_idx + 1], "aac");
        let bitrate_idx = cmd.args.iter().position(|a| a == "-b:a").unwrap();
        assert_eq!(cmd.args[bitrate_idx + 1], "256k");
    }

    #[test]
    fn clamps_low_bitrate_to_64k_minimum() {
        let mut input = input_with(vec![narration("/n0.mp3", 0)]);
        input.audio_bitrate_kbps = 32;
        let cmd = build_mix_command(&input, &output()).unwrap();
        let bitrate_idx = cmd.args.iter().position(|a| a == "-b:a").unwrap();
        assert_eq!(cmd.args[bitrate_idx + 1], "64k");
    }

    #[test]
    fn output_path_is_the_last_arg() {
        let input = input_with(vec![narration("/n0.mp3", 0)]);
        let cmd = build_mix_command(&input, &PathBuf::from("/out/mix.m4a")).unwrap();
        assert_eq!(cmd.args.last().unwrap(), "/out/mix.m4a");
    }

    // ─── input args ──────────────────────────────────────────

    #[test]
    fn narration_inputs_use_plain_i_flag() {
        let input = input_with(vec![narration("/n0.mp3", 0), narration("/n1.mp3", 5000)]);
        let cmd = build_mix_command(&input, &output()).unwrap();
        // Two narration -i flags, no -stream_loop in front of them
        let n0_idx = cmd.args.iter().position(|a| a == "/n0.mp3").unwrap();
        assert_eq!(cmd.args[n0_idx - 1], "-i");
        // Check it's NOT preceded by -stream_loop
        if n0_idx >= 2 {
            assert_ne!(cmd.args[n0_idx - 2], "-stream_loop");
        }
    }

    #[test]
    fn music_input_uses_stream_loop() {
        let mut input = input_with(vec![narration("/n0.mp3", 0)]);
        input.music_path = Some("/music.mp3".to_string());
        let cmd = build_mix_command(&input, &output()).unwrap();
        let music_idx = cmd.args.iter().position(|a| a == "/music.mp3").unwrap();
        assert_eq!(cmd.args[music_idx - 1], "-i");
        assert_eq!(cmd.args[music_idx - 2], "-1");
        assert_eq!(cmd.args[music_idx - 3], "-stream_loop");
    }

    #[test]
    fn ambient_input_uses_stream_loop() {
        let mut input = input_with(vec![narration("/n0.mp3", 0)]);
        input.ambient_path = Some("/ambient.mp3".to_string());
        let cmd = build_mix_command(&input, &output()).unwrap();
        let amb_idx = cmd.args.iter().position(|a| a == "/ambient.mp3").unwrap();
        assert_eq!(cmd.args[amb_idx - 3], "-stream_loop");
    }

    // ─── filter_complex content ──────────────────────────────

    fn extract_filter(cmd: &AudioMixCommand) -> String {
        let idx = cmd
            .args
            .iter()
            .position(|a| a == "-filter_complex")
            .expect("filter_complex flag missing");
        cmd.args[idx + 1].clone()
    }

    #[test]
    fn single_narration_uses_anull_rename() {
        let input = input_with(vec![narration("/n0.mp3", 1000)]);
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[0:a]adelay=1000|1000[n0]"));
        assert!(filter.contains("[n0]anull[narr]"));
        // No amix for single narration
        assert!(!filter.contains("inputs=1:duration=longest"));
    }

    #[test]
    fn multiple_narrations_are_amixed() {
        let input = input_with(vec![
            narration("/n0.mp3", 1000),
            narration("/n1.mp3", 8500),
            narration("/n2.mp3", 16000),
        ]);
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[0:a]adelay=1000|1000[n0]"));
        assert!(filter.contains("[1:a]adelay=8500|8500[n1]"));
        assert!(filter.contains("[2:a]adelay=16000|16000[n2]"));
        assert!(filter.contains("[n0][n1][n2]amix=inputs=3:duration=longest:normalize=0[narr]"));
    }

    #[test]
    fn music_only_skips_sidechain_when_no_narration() {
        let mut input = input_with(vec![]);
        input.music_path = Some("/music.mp3".to_string());
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("volume=0.55"));
        assert!(!filter.contains("sidechaincompress"));
    }

    #[test]
    fn music_with_narration_applies_sidechain_duck() {
        let mut input = input_with(vec![narration("/n0.mp3", 1000)]);
        input.music_path = Some("/music.mp3".to_string());
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        // Narration is split so one branch goes to the sidechain
        assert!(filter.contains("[narr]asplit=2[narr_main][narr_sc]"));
        // Music is ducked using narr_sc as the sidechain
        assert!(filter.contains("[music_raw][narr_sc]sidechaincompress"));
        // Final mix uses narr_main, not narr (the split branch)
        assert!(filter.contains("[narr_main]"));
    }

    #[test]
    fn ambient_uses_low_volume_only() {
        let mut input = input_with(vec![narration("/n0.mp3", 0)]);
        input.ambient_path = Some("/ambient.mp3".to_string());
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("volume=0.22"));
        assert!(filter.contains("[ambient_out]"));
        // Ambient is NOT ducked by narration
        assert!(!filter.contains("ambient_out]sidechain"));
    }

    #[test]
    fn full_mix_includes_all_three_sources_in_final_amix() {
        let mut input = input_with(vec![narration("/n0.mp3", 0)]);
        input.music_path = Some("/music.mp3".to_string());
        input.ambient_path = Some("/ambient.mp3".to_string());
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        // Final amix should have 3 inputs: ducked music + narration main + ambient
        assert!(filter.contains("amix=inputs=3"));
        assert!(filter.ends_with("[out]"));
    }

    #[test]
    fn narration_only_renames_narr_to_out() {
        let input = input_with(vec![narration("/n0.mp3", 0)]);
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        // Single source: should anull-rename narr to out
        assert!(filter.contains("[narr]anull[out]"));
    }

    #[test]
    fn music_only_renames_to_out_no_amix() {
        let mut input = input_with(vec![]);
        input.music_path = Some("/music.mp3".to_string());
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[music_raw]anull[out]"));
        assert!(!filter.contains("amix=inputs"));
    }

    #[test]
    fn input_indexes_match_filter_references() {
        // narration0=0, narration1=1, music=2, ambient=3
        let mut input = input_with(vec![
            narration("/n0.mp3", 0),
            narration("/n1.mp3", 5000),
        ]);
        input.music_path = Some("/music.mp3".to_string());
        input.ambient_path = Some("/ambient.mp3".to_string());
        let cmd = build_mix_command(&input, &output()).unwrap();
        let filter = extract_filter(&cmd);
        assert!(filter.contains("[0:a]adelay")); // narration 0
        assert!(filter.contains("[1:a]adelay")); // narration 1
        assert!(filter.contains("[2:a]volume=0.55")); // music
        assert!(filter.contains("[3:a]volume=0.22")); // ambient
    }

    #[test]
    fn output_label_is_always_out() {
        let input = input_with(vec![narration("/n0.mp3", 0)]);
        let cmd = build_mix_command(&input, &output()).unwrap();
        let map_idx = cmd.args.iter().position(|a| a == "-map").unwrap();
        assert_eq!(cmd.args[map_idx + 1], "[out]");
    }

    // ─── Integration test: real ffmpeg mix ──────────────────────
    //
    // Generates synthetic narration + music tones via ffmpeg's
    // built-in `sine` source, mixes them with our filtergraph, and
    // verifies the output exists and has the expected duration.
    //
    // Marked `#[ignore]` so it only runs when explicitly requested:
    //
    //   cargo test audio_mix::tests::mixes_real_audio_via_ffmpeg \
    //     -- --ignored --nocapture
    //
    // Requires the ffmpeg-sidecar download cache to already be
    // populated (run the ffmpeg integration test once first), or
    // ffmpeg installed on PATH.
    #[test]
    #[ignore]
    fn mixes_real_audio_via_ffmpeg() {
        use std::process::Command as StdCommand;

        // Locate ffmpeg: prefer PATH; otherwise download a fresh copy
        // into a tempdir via the same path the runtime uses on first
        // export. Either way the test ends up with a working binary.
        let tmp = std::env::temp_dir().join(format!(
            "arcanum-audio-mix-test-{}",
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

        // 1) Generate two synthetic narration tones (440 Hz and 660 Hz).
        let n0 = tmp.join("n0.mp3");
        let n1 = tmp.join("n1.mp3");
        let music = tmp.join("music.mp3");

        for (path, freq, duration) in [
            (&n0, 440, "2"),
            (&n1, 660, "2"),
            (&music, 220, "10"),
        ] {
            let status = StdCommand::new(&ffmpeg_bin)
                .args([
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    &format!("sine=frequency={freq}:duration={duration}"),
                    path.to_str().unwrap(),
                ])
                .status()
                .unwrap();
            assert!(status.success(), "failed to generate {path:?}");
        }

        // 2) Build the mix command and run it.
        let out_path = tmp.join("mixed.m4a");
        let input = AudioMixInput {
            narrations: vec![
                NarrationTrack {
                    file_path: n0.to_string_lossy().to_string(),
                    offset_ms: 0,
                },
                NarrationTrack {
                    file_path: n1.to_string_lossy().to_string(),
                    offset_ms: 4000,
                },
            ],
            music_path: Some(music.to_string_lossy().to_string()),
            ambient_path: None,
            total_duration_ms: 8000,
            audio_bitrate_kbps: 128,
        };
        let cmd = build_mix_command(&input, &out_path).unwrap();

        let mix_output = StdCommand::new(&ffmpeg_bin)
            .args(&cmd.args)
            .output()
            .unwrap();
        if !mix_output.status.success() {
            let stderr = String::from_utf8_lossy(&mix_output.stderr);
            panic!("ffmpeg mix failed: {stderr}");
        }

        // 3) Verify output exists and is non-trivial.
        let metadata = std::fs::metadata(&out_path).unwrap();
        assert!(metadata.is_file());
        assert!(
            metadata.len() > 1000,
            "output file is suspiciously small: {} bytes",
            metadata.len(),
        );

        // 4) Probe duration via ffprobe (when available) — best-effort.
        // Most users have it next to ffmpeg.
        if let Some(ffprobe_bin) = which::which("ffprobe").ok() {
            let probe = StdCommand::new(&ffprobe_bin)
                .args([
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    out_path.to_str().unwrap(),
                ])
                .output()
                .unwrap();
            let duration_str = String::from_utf8_lossy(&probe.stdout);
            let duration_sec: f64 = duration_str.trim().parse().unwrap_or(0.0);
            // Should be ~8 seconds (the total_duration_ms clamp).
            assert!(
                (7.5..=8.5).contains(&duration_sec),
                "expected ~8s output, got {duration_sec}s",
            );
            eprintln!("Mixed audio duration: {duration_sec}s");
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
