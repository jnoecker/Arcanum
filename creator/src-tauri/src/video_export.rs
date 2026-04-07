// ─── Story Video Export Orchestrator ────────────────────────────
// Top-level Tauri command that wires together every primitive from
// PRs 1–7 into a single export pipeline. The TypeScript side is
// responsible for:
//   - Computing the timeline (storyTiming.ts)
//   - Synthesizing TTS narration (narrationSynthesis.ts)
//   - Rendering scene frames to PNGs via canvas (storyFrameRenderer.ts)
//   - Saving those PNGs via `save_video_frame`
//   - Resolving zone music/ambient file paths
//   - Bundling everything into an ExportRequest and calling
//     `export_story_video`.
//
// This module handles the backend pipeline:
//   1. audio_mix::mix_audio → temp m4a
//   2. video_encode::encode_video_segments → temp silent mp4
//   3. video_encode::mux_video_and_audio → final mp4
//   4. cleanup of the session temp directory
//
// Progress events are emitted on the `video_export:progress` channel
// so the UI can show a staged progress bar.

use std::path::PathBuf;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::audio_mix::{self, AudioMixInput};
use crate::video_encode::{
    self, H264Profile, SceneFrame, VideoEncodeInput,
};

// ─── Frame persistence ───────────────────────────────────────────

/// Returns the filesystem directory where scene PNGs and intermediate
/// audio/video files live for a given export session.
fn session_dir(app: &AppHandle, session_id: &str) -> Result<PathBuf, String> {
    if session_id.is_empty() {
        return Err("Export session_id is empty".to_string());
    }
    // Defensive: only allow simple alphanumeric/dash session IDs so
    // a malicious caller can't traverse up the filesystem.
    if session_id.chars().any(|c| !c.is_ascii_alphanumeric() && c != '-' && c != '_') {
        return Err(format!("Invalid session_id '{session_id}' — alphanumeric + dash/underscore only"));
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?
        .join("tmp")
        .join("video_export")
        .join(session_id);
    Ok(dir)
}

/// Persists a base64-encoded scene PNG into the session temp dir.
/// Returns the absolute path to the saved file so the frontend can
/// collect all frame paths into the export request.
#[tauri::command]
pub async fn save_video_frame(
    app: AppHandle,
    session_id: String,
    scene_index: u32,
    png_base64: String,
) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&png_base64)
        .map_err(|e| format!("Failed to decode frame base64: {e}"))?;
    if bytes.len() < 8 || &bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
        return Err("Frame bytes are not a valid PNG".to_string());
    }

    let dir = session_dir(&app, &session_id)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create session dir: {e}"))?;

    let file_path = dir.join(format!("scene_{scene_index:04}.png"));
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write frame: {e}"))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Given an ordered list of candidate file paths, returns the first
/// one that exists on disk, or `None` if none do. The frontend uses
/// this to resolve zone music / ambient audio references against the
/// candidate list that `useMediaSrc` would probe (asset cache dir,
/// mudDir fallbacks, absolute paths).
#[tauri::command]
pub async fn resolve_first_existing_path(
    candidates: Vec<String>,
) -> Result<Option<String>, String> {
    for path in candidates {
        if path.is_empty() {
            continue;
        }
        if tokio::fs::metadata(&path).await.is_ok() {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

/// Deletes the session temp dir. Called after a successful export or
/// when the user cancels mid-export.
#[tauri::command]
pub async fn cleanup_video_export_session(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let dir = session_dir(&app, &session_id)?;
    if dir.exists() {
        tokio::fs::remove_dir_all(&dir)
            .await
            .map_err(|e| format!("Failed to remove session dir: {e}"))?;
    }
    Ok(())
}

// ─── Export request ──────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoExportRequest {
    /// Session ID used for save_video_frame. The orchestrator uses it
    /// to locate intermediate audio/video files under the same dir.
    pub session_id: String,

    /// Ordered scene frames (absolute PNG paths + durations).
    pub scenes: Vec<SceneExportEntry>,

    /// Audio mix configuration (same shape as audio_mix::AudioMixInput).
    pub audio: AudioMixInput,

    /// Preset-derived video settings.
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub video_bitrate_kbps: u32,
    pub profile: String, // "baseline" | "main" | "high"
    pub crossfade_ms: Option<u64>,

    /// Optional burned-in caption track. The orchestrator resolves
    /// the bundled font path on the Rust side, so the frontend only
    /// needs to send the chunks + style.
    #[serde(default)]
    pub captions: Option<crate::captions::CaptionTrack>,

    /// Final output path. The caller picks this (usually from a
    /// native file dialog) — we don't second-guess it.
    pub output_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneExportEntry {
    pub png_path: String,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoExportResult {
    pub output_path: String,
    pub total_duration_ms: u64,
    pub size_bytes: u64,
}

// ─── Progress events ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    stage: &'static str,
    message: String,
}

fn emit_progress(app: &AppHandle, stage: &'static str, message: impl Into<String>) {
    let payload = ProgressEvent {
        stage,
        message: message.into(),
    };
    // Best-effort: emit failures are non-fatal for the pipeline.
    let _ = app.emit("video_export:progress", payload);
}

// ─── Profile mapping ─────────────────────────────────────────────

fn parse_profile(s: &str) -> Result<H264Profile, String> {
    match s.to_ascii_lowercase().as_str() {
        "baseline" => Ok(H264Profile::Baseline),
        "main" => Ok(H264Profile::Main),
        "high" => Ok(H264Profile::High),
        other => Err(format!("Unknown H.264 profile '{other}'")),
    }
}

// ─── Orchestrator command ───────────────────────────────────────

/// Top-level export orchestrator. Runs audio mix → video encode →
/// mux → cleanup. Emits progress events on `video_export:progress`
/// at each stage transition.
///
/// Temp files live under `app_data_dir/tmp/video_export/<session_id>/`
/// and are cleaned up on success. On failure, the caller can call
/// `cleanup_video_export_session` manually to free disk space.
#[tauri::command]
pub async fn export_story_video(
    app: AppHandle,
    request: VideoExportRequest,
) -> Result<VideoExportResult, String> {
    if request.scenes.is_empty() {
        return Err("Cannot export: no scenes provided".to_string());
    }

    let profile = parse_profile(&request.profile)?;
    let session = session_dir(&app, &request.session_id)?;
    tokio::fs::create_dir_all(&session)
        .await
        .map_err(|e| format!("Failed to create session dir: {e}"))?;

    let audio_temp = session.join("audio.m4a");
    let video_temp = session.join("video_silent.mp4");
    let output_path = PathBuf::from(&request.output_path);

    // Ensure the output directory exists before ffmpeg writes to it.
    if let Some(parent) = output_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create output directory: {e}"))?;
    }

    // ─── Stage 1: Audio mix ──────────────────────────────────
    emit_progress(&app, "audio_mix", "Mixing narration, music, and ambient…");
    audio_mix::mix_audio(&app, request.audio.clone(), audio_temp.clone())
        .await
        .map_err(|e| format!("Audio mix failed: {e}"))?;

    // ─── Stage 2: Video encode ───────────────────────────────
    emit_progress(
        &app,
        "video_encode",
        format!("Encoding {} scenes at {}x{} @ {}fps…", request.scenes.len(), request.width, request.height, request.fps),
    );
    let scene_frames: Vec<SceneFrame> = request
        .scenes
        .iter()
        .map(|s| SceneFrame {
            png_path: s.png_path.clone(),
            duration_ms: s.duration_ms,
        })
        .collect();

    // Resolve the bundled caption font + plan per-line wrapping,
    // writing one text file per wrapped line into the session dir.
    // Each file contains a single line with no embedded newlines,
    // which sidesteps ffmpeg's drawtext rendering the LF byte as a
    // visible tofu glyph. See captions.rs for the full rationale.
    let captions_present = request
        .captions
        .as_ref()
        .map(|t| !t.chunks.is_empty())
        .unwrap_or(false);

    let (caption_font_path, caption_lines) = if captions_present {
        let font = crate::captions::caption_font_path(&app)?
            .to_string_lossy()
            .to_string();
        let track = request.captions.as_ref().unwrap();
        let lines = crate::captions::plan_caption_lines(
            track,
            &session,
            request.width,
            request.height,
        );
        for line in &lines {
            tokio::fs::write(&line.file_path, &line.file_content)
                .await
                .map_err(|e| {
                    format!(
                        "Failed to write caption line file {}: {e}",
                        line.file_path,
                    )
                })?;
        }
        (Some(font), lines)
    } else {
        (None, Vec::new())
    };

    let encode_input = VideoEncodeInput {
        scenes: scene_frames,
        width: request.width,
        height: request.height,
        fps: request.fps,
        video_bitrate_kbps: request.video_bitrate_kbps,
        profile,
        crossfade_ms: request.crossfade_ms,
        captions: request.captions.clone(),
        caption_font_path,
        caption_lines,
    };

    let encode_output =
        video_encode::encode_video_segments(&app, encode_input, video_temp.clone())
            .await
            .map_err(|e| format!("Video encode failed: {e}"))?;

    // ─── Stage 3: Mux ────────────────────────────────────────
    emit_progress(&app, "mux", "Muxing video and audio…");
    video_encode::mux_video_and_audio(
        &app,
        video_temp.clone(),
        audio_temp.clone(),
        output_path.clone(),
    )
    .await
    .map_err(|e| format!("Mux failed: {e}"))?;

    // ─── Stage 4: Cleanup + result ───────────────────────────
    emit_progress(&app, "cleanup", "Cleaning up temp files…");
    // Don't hard-fail the whole export if cleanup stumbles.
    if let Err(e) = tokio::fs::remove_file(&audio_temp).await {
        eprintln!("warn: failed to remove temp audio {audio_temp:?}: {e}");
    }
    if let Err(e) = tokio::fs::remove_file(&video_temp).await {
        eprintln!("warn: failed to remove temp video {video_temp:?}: {e}");
    }

    let size_bytes = tokio::fs::metadata(&output_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    emit_progress(&app, "done", "Export complete");

    Ok(VideoExportResult {
        output_path: output_path.to_string_lossy().to_string(),
        total_duration_ms: encode_output.total_duration_ms,
        size_bytes,
    })
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_all_h264_profile_names() {
        assert_eq!(parse_profile("baseline").unwrap(), H264Profile::Baseline);
        assert_eq!(parse_profile("main").unwrap(), H264Profile::Main);
        assert_eq!(parse_profile("high").unwrap(), H264Profile::High);
    }

    #[test]
    fn parses_profile_case_insensitively() {
        assert_eq!(parse_profile("HIGH").unwrap(), H264Profile::High);
        assert_eq!(parse_profile("Main").unwrap(), H264Profile::Main);
    }

    #[test]
    fn rejects_unknown_profiles() {
        assert!(parse_profile("ultra").is_err());
        assert!(parse_profile("").is_err());
    }

    // session_dir validation is the interesting bit — the rest of the
    // orchestrator is async + app-handle-dependent, so it's exercised
    // via the TypeScript side's integration tests rather than here.

    // ─── session_dir validation (pure logic) ────────────────
    // These tests can't construct a real AppHandle, so they only
    // verify the input validation path by threading a stub.

    fn validate_session_id(id: &str) -> Result<(), String> {
        if id.is_empty() {
            return Err("Export session_id is empty".to_string());
        }
        if id.chars().any(|c| !c.is_ascii_alphanumeric() && c != '-' && c != '_') {
            return Err(format!(
                "Invalid session_id '{id}' — alphanumeric + dash/underscore only"
            ));
        }
        Ok(())
    }

    #[test]
    fn rejects_empty_session_id() {
        assert!(validate_session_id("").is_err());
    }

    #[test]
    fn accepts_uuid_session_id() {
        assert!(validate_session_id("550e8400-e29b-41d4-a716-446655440000").is_ok());
    }

    #[test]
    fn accepts_underscore_session_id() {
        assert!(validate_session_id("story_export_42").is_ok());
    }

    #[test]
    fn rejects_path_traversal_session_id() {
        assert!(validate_session_id("../etc/passwd").is_err());
        assert!(validate_session_id("..\\windows").is_err());
    }

    #[test]
    fn rejects_session_id_with_slashes() {
        assert!(validate_session_id("a/b").is_err());
        assert!(validate_session_id("a\\b").is_err());
    }

    #[test]
    fn rejects_session_id_with_spaces() {
        assert!(validate_session_id("story 1").is_err());
    }
}
