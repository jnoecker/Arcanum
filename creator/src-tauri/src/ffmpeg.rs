// ─── FFmpeg Resolution & Download ────────────────────────────────
// Finds ffmpeg for the story → video export pipeline.
//
// Resolution order:
//   1. Cached binary under `app_data_dir/bin/ffmpeg(.exe)` — downloaded
//      by this module on first export.
//   2. System-installed ffmpeg (via PATH).
//   3. None → caller invokes `ensure_ffmpeg_ready` to download.
//
// We deliberately prefer the cached binary over the system one so
// exports stay reproducible across machines (same ffmpeg version).
// System PATH is a fallback for users who want to point at their own
// build — e.g. with hardware encoder support — or who pre-placed a
// binary before first launch.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

// ─── Types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FfmpegSource {
    /// Downloaded by this app into `app_data_dir/bin/`.
    Bundled,
    /// Resolved via the system PATH (user-installed).
    System,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegStatus {
    /// Whether ffmpeg is currently usable.
    pub available: bool,
    /// Which source was resolved. `None` when unavailable.
    pub source: Option<FfmpegSource>,
    /// Absolute path to the binary. `None` when unavailable.
    pub path: Option<String>,
    /// Parsed version string (e.g. "6.1.1"). `None` when unavailable
    /// or when parsing failed.
    pub version: Option<String>,
}

impl FfmpegStatus {
    fn missing() -> Self {
        Self {
            available: false,
            source: None,
            path: None,
            version: None,
        }
    }
}

// ─── Paths ───────────────────────────────────────────────────────

fn bin_filename() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

fn bundled_bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?
        .join("bin");
    Ok(dir)
}

fn bundled_ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(bundled_bin_dir(app)?.join(bin_filename()))
}

// ─── Probing ─────────────────────────────────────────────────────

/// Runs `ffmpeg -version` against the given binary and returns the
/// parsed version string on success. Returns `None` on any failure
/// (binary missing, non-zero exit, unparseable output).
async fn probe_ffmpeg(path: &Path) -> Option<String> {
    let output = tokio::process::Command::new(path)
        .arg("-version")
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ffmpeg_version(&stdout)
}

/// Parses the first line of `ffmpeg -version` output into a version
/// string. Typical format: `ffmpeg version 6.1.1 Copyright ...`.
///
/// Returns the third whitespace-delimited token or `None` if the line
/// doesn't start with the expected prefix.
fn parse_ffmpeg_version(text: &str) -> Option<String> {
    let first_line = text.lines().next()?.trim();
    let rest = first_line.strip_prefix("ffmpeg version ")?;
    let token = rest.split_whitespace().next()?;
    Some(token.to_string())
}

// ─── Resolution ──────────────────────────────────────────────────

/// Attempts to find ffmpeg in the bundled location first, then on
/// the system PATH. Returns the first working source (probed via
/// `ffmpeg -version`).
pub async fn resolve_ffmpeg(app: &AppHandle) -> FfmpegStatus {
    // ─── Bundled cache ───────────────────────────────────────
    if let Ok(bundled) = bundled_ffmpeg_path(app) {
        if bundled.exists() {
            if let Some(version) = probe_ffmpeg(&bundled).await {
                return FfmpegStatus {
                    available: true,
                    source: Some(FfmpegSource::Bundled),
                    path: Some(bundled.to_string_lossy().to_string()),
                    version: Some(version),
                };
            }
        }
    }

    // ─── System PATH ─────────────────────────────────────────
    if let Ok(system_path) = which::which("ffmpeg") {
        if let Some(version) = probe_ffmpeg(&system_path).await {
            return FfmpegStatus {
                available: true,
                source: Some(FfmpegSource::System),
                path: Some(system_path.to_string_lossy().to_string()),
                version: Some(version),
            };
        }
    }

    FfmpegStatus::missing()
}

// ─── Download ────────────────────────────────────────────────────

/// Downloads and unpacks ffmpeg into the given directory. Blocks the
/// calling task (use `tokio::task::spawn_blocking` from async callers).
///
/// This is intentionally synchronous because `ffmpeg-sidecar` does
/// blocking I/O internally — wrapping it is the caller's responsibility.
///
/// Visible to other modules in the crate so integration tests in
/// sibling modules (e.g. `audio_mix`) can self-bootstrap ffmpeg
/// without requiring it on PATH.
pub(crate) fn download_ffmpeg_blocking(dest_dir: &Path) -> Result<PathBuf, String> {
    use ffmpeg_sidecar::download::{
        download_ffmpeg_package, ffmpeg_download_url, unpack_ffmpeg,
    };

    std::fs::create_dir_all(dest_dir)
        .map_err(|e| format!("Failed to create ffmpeg dir: {e}"))?;

    // Keep only the ffmpeg binary; skip ffplay and ffprobe to shave
    // a few MB off the download. Our pipeline only needs ffmpeg itself.
    std::env::set_var("FFMPEG_SIDECAR_KEEP_ONLY_FFMPEG", "1");

    let url = ffmpeg_download_url()
        .map_err(|e| format!("Failed to resolve ffmpeg download URL: {e}"))?;
    let archive_path = download_ffmpeg_package(url, dest_dir)
        .map_err(|e| format!("Failed to download ffmpeg: {e}"))?;
    unpack_ffmpeg(&archive_path, dest_dir)
        .map_err(|e| format!("Failed to unpack ffmpeg: {e}"))?;

    let final_path = dest_dir.join(bin_filename());
    if !final_path.exists() {
        return Err(format!(
            "ffmpeg binary not found at expected path after unpack: {}",
            final_path.display(),
        ));
    }
    Ok(final_path)
}

// ─── Commands ────────────────────────────────────────────────────

/// Fast status check. Does not download anything. Returns the current
/// resolution state so the UI can show "ready" vs. "needs install".
#[tauri::command]
pub async fn check_ffmpeg_status(app: AppHandle) -> Result<FfmpegStatus, String> {
    Ok(resolve_ffmpeg(&app).await)
}

/// Ensures ffmpeg is available, downloading it into `app_data_dir/bin/`
/// if needed. Returns the final status (with path + version).
///
/// On success, subsequent calls short-circuit via the bundled cache.
/// On failure, returns an error describing the step that failed
/// (resolve URL / download / unpack / post-unpack probe).
#[tauri::command]
pub async fn ensure_ffmpeg_ready(app: AppHandle) -> Result<FfmpegStatus, String> {
    // If ffmpeg is already resolvable, short-circuit.
    let status = resolve_ffmpeg(&app).await;
    if status.available {
        return Ok(status);
    }

    let dest_dir = bundled_bin_dir(&app)?;

    // ffmpeg-sidecar is blocking; run it on the blocking pool so we
    // don't wedge the async runtime while downloading ~30MB.
    let dest_for_blocking = dest_dir.clone();
    let downloaded = tokio::task::spawn_blocking(move || {
        download_ffmpeg_blocking(&dest_for_blocking)
    })
    .await
    .map_err(|e| format!("ffmpeg download task panicked: {e}"))??;

    // Confirm the just-downloaded binary works.
    let version = probe_ffmpeg(&downloaded).await.ok_or_else(|| {
        format!(
            "Downloaded ffmpeg at {} did not respond to -version",
            downloaded.display(),
        )
    })?;

    Ok(FfmpegStatus {
        available: true,
        source: Some(FfmpegSource::Bundled),
        path: Some(downloaded.to_string_lossy().to_string()),
        version: Some(version),
    })
}

// ─── Internal helper for the encoder PR ──────────────────────────

/// Returns the path to an ffmpeg binary that is known to work, or an
/// error if one is not available. Tries the cache + PATH; does NOT
/// trigger a download (callers that want download-on-demand should use
/// `ensure_ffmpeg_ready` via IPC first).
///
/// Used by the video export pipeline when it needs to spawn ffmpeg.
#[allow(dead_code)] // consumed by a later PR in the feature branch
pub async fn ffmpeg_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    let status = resolve_ffmpeg(app).await;
    match status.path {
        Some(p) => Ok(PathBuf::from(p)),
        None => Err(
            "ffmpeg is not available. Call ensure_ffmpeg_ready first to download it."
                .to_string(),
        ),
    }
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_standard_version_line() {
        let sample = "ffmpeg version 6.1.1 Copyright (c) 2000-2023 the FFmpeg developers\n\
                      built with gcc 11.4.0 (Ubuntu 11.4.0-1ubuntu1~22.04)";
        assert_eq!(parse_ffmpeg_version(sample), Some("6.1.1".to_string()));
    }

    #[test]
    fn parses_git_version_line() {
        let sample = "ffmpeg version n6.0-gfedcba Copyright (c) 2000-2023 the FFmpeg developers";
        assert_eq!(parse_ffmpeg_version(sample), Some("n6.0-gfedcba".to_string()));
    }

    #[test]
    fn parses_windows_build_version() {
        let sample = "ffmpeg version 2024-01-15-git-6b6b9c4e5e-full_build-www.gyan.dev Copyright (c) 2000-2024";
        assert_eq!(
            parse_ffmpeg_version(sample),
            Some("2024-01-15-git-6b6b9c4e5e-full_build-www.gyan.dev".to_string())
        );
    }

    #[test]
    fn returns_none_for_non_ffmpeg_output() {
        assert_eq!(parse_ffmpeg_version(""), None);
        assert_eq!(parse_ffmpeg_version("not ffmpeg"), None);
        assert_eq!(parse_ffmpeg_version("bash: ffmpeg: command not found"), None);
    }

    #[test]
    fn returns_none_for_partial_version_line() {
        // "ffmpeg version" with nothing after
        assert_eq!(parse_ffmpeg_version("ffmpeg version "), None);
        assert_eq!(parse_ffmpeg_version("ffmpeg version"), None);
    }

    #[test]
    fn ignores_lines_after_the_first() {
        let sample = "ffmpeg version 7.0.0 Copyright\nrandom second line\n6.1.1 trailing";
        assert_eq!(parse_ffmpeg_version(sample), Some("7.0.0".to_string()));
    }

    #[test]
    fn bin_filename_is_platform_specific() {
        if cfg!(windows) {
            assert_eq!(bin_filename(), "ffmpeg.exe");
        } else {
            assert_eq!(bin_filename(), "ffmpeg");
        }
    }

    #[test]
    fn missing_status_has_no_path_or_version() {
        let missing = FfmpegStatus::missing();
        assert!(!missing.available);
        assert!(missing.source.is_none());
        assert!(missing.path.is_none());
        assert!(missing.version.is_none());
    }

    // ─── Integration test: real ffmpeg download ─────────────────
    //
    // Exercises the full download → unpack → probe pipeline against
    // the real ffmpeg-sidecar CDN. Marked `#[ignore]` so it only runs
    // when explicitly requested:
    //
    //   cargo test ffmpeg::tests::downloads_and_probes_real_ffmpeg \
    //     -- --ignored --nocapture
    //
    // Takes ~30 seconds on a reasonable connection. Downloads ~30 MB.
    #[test]
    #[ignore]
    fn downloads_and_probes_real_ffmpeg() {
        let tmp = std::env::temp_dir().join(format!(
            "arcanum-ffmpeg-test-{}",
            std::process::id(),
        ));
        let _ = std::fs::remove_dir_all(&tmp);

        let bin = download_ffmpeg_blocking(&tmp)
            .expect("download should succeed");
        assert!(bin.exists(), "downloaded binary should exist at {}", bin.display());

        // Sync version probe (the async helper needs tokio).
        let output = std::process::Command::new(&bin)
            .arg("-version")
            .output()
            .expect("spawning downloaded ffmpeg should succeed");
        assert!(output.status.success(), "ffmpeg -version should exit 0");
        let stdout = String::from_utf8_lossy(&output.stdout);
        let version = parse_ffmpeg_version(&stdout).expect("should parse version");
        eprintln!("Downloaded ffmpeg version: {version}");

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
