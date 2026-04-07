// ─── Story Caption Rendering ─────────────────────────────────────
// Burns narration text into the exported video via ffmpeg's drawtext
// filter. Reads the bundled CrimsonPro-Variable.ttf font from the
// Tauri resource directory.
//
// Architecture mirrors audio_mix.rs and video_encode.rs:
//   - Pure functions (escape, wrap, build_drawtext_chain) are
//     unit-tested without invoking ffmpeg.
//   - The font path resolver is the only function that touches
//     filesystem state.
//
// Caption sources:
//   - The frontend orchestrator pulls narration chunks from the
//     timeline (one per TipTap paragraph) with start/end timestamps
//     in milliseconds.
//   - Timestamps are absolute video time, not scene-relative.
//   - Captions outside any chunk's [start, end] window are simply
//     not drawn — drawtext's `enable='between(t,...,...)'` handles
//     visibility.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

// ─── Constants ───────────────────────────────────────────────────

/// Bundled font filename (lives at resources/fonts/<name> in src-tauri).
const FONT_FILENAME: &str = "CrimsonPro-Variable.ttf";

/// Approximate average glyph width as a fraction of font size, used
/// for word wrapping. Crimson Pro is a slightly condensed serif so
/// 0.45 is a reasonable estimate. Word wrap is best-effort — if a
/// caption ends up wider than the budget the bottom of the line
/// will just clip slightly, which is fine for fail-soft text.
const AVG_GLYPH_WIDTH_RATIO: f32 = 0.45;

// ─── Types ───────────────────────────────────────────────────────

/// One subtitle-sized chunk of narration with absolute video timing.
/// Mirrors the TS-side `NarrationChunk` shape so the orchestrator can
/// pass them straight through.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionChunk {
    pub text: String,
    /// Absolute start time in the final video, milliseconds.
    pub start_ms: u64,
    /// Absolute end time, milliseconds.
    pub end_ms: u64,
}

/// Where caption text sits vertically in the frame.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CaptionPlacement {
    /// Bottom 22% of the frame — standard subtitle position.
    LowerThird,
    /// Top 18% of the frame — used for vertical (9:16) social
    /// where the bottom UI bar of phones covers normal subtitles.
    UpperThird,
    /// Vertically centered — for hero shots / title cards.
    Center,
}

/// Caption styling for a video. Computed from preset settings on
/// the frontend, passed through video_encode.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionStyle {
    pub placement: CaptionPlacement,
    /// Multiplier on the base font size (preset-dependent — social
    /// presets use ~1.3-1.4 for mobile readability).
    pub font_scale: f32,
}

/// All the captions for a single video plus the style they should
/// render with.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionTrack {
    pub chunks: Vec<CaptionChunk>,
    pub style: CaptionStyle,
}

// ─── Font path resolution ────────────────────────────────────────

/// Returns the absolute path to the bundled caption font, resolved
/// via Tauri's resource directory.
///
/// The font is bundled at `resources/fonts/<FONT_FILENAME>` in the
/// `src-tauri` source tree (see `bundle.resources` in tauri.conf.json).
/// At runtime Tauri copies it into the app's resource_dir, which is
/// where this function looks.
pub fn caption_font_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource_dir: {e}"))?;
    let candidate = resource_dir
        .join("resources")
        .join("fonts")
        .join(FONT_FILENAME);
    if !candidate.exists() {
        return Err(format!(
            "Caption font not found at {}. Make sure the bundle includes resources/fonts/{}.",
            candidate.display(),
            FONT_FILENAME,
        ));
    }
    Ok(candidate)
}

// ─── Drawtext text escaping ──────────────────────────────────────

// ─── Caption text file plan ──────────────────────────────────────
//
// Why textfile= instead of text=:
// ffmpeg's filter parser is exceptionally fragile around quoted text.
// The POSIX shell-style quote dance (`'\''`) used to embed apostrophes
// in single-quoted args does NOT work with ffmpeg's chain parser —
// the parser sees `'\'` as an early termination of the quoted section
// followed by an unrecognised option name. Even with single-quoting
// + escaping every special character, edge cases (mid-quote backslashes,
// unicode quotes, embedded percent signs) keep producing parse errors.
//
// The bulletproof workaround is to use `textfile='/path/caption.txt'`
// instead of `text='...'`. ffmpeg reads the file bytes verbatim and
// applies its own line-break handling for actual newlines. The only
// thing the filter chain sees is the file path, which is well-behaved
// inside single quotes.
//
// The caller writes one text file per caption chunk before spawning
// ffmpeg. `caption_text_file_plan` produces the (path, content) pairs
// the caller needs to write; `build_drawtext_chain` consumes the
// resulting paths.

/// Returns the planned text file path + content for each caption chunk
/// in the track, ready to be written to disk by the caller.
///
/// Path scheme: `<dir>/caption_NNNN.txt` (zero-padded sequential index).
/// Content: the wrapped caption text with literal `\n` newlines for
/// each line break.
pub fn caption_text_file_plan(
    track: &CaptionTrack,
    dir: &Path,
    frame_width: u32,
    frame_height: u32,
) -> Vec<(PathBuf, String)> {
    if track.chunks.is_empty() {
        return Vec::new();
    }
    let font_size = compute_font_size(frame_height, track.style.font_scale);
    let budget = chars_per_line(frame_width, font_size, 0.08);
    track
        .chunks
        .iter()
        .enumerate()
        .map(|(i, chunk)| {
            let path = dir.join(format!("caption_{i:04}.txt"));
            let content = wrap_caption_text(&chunk.text, budget);
            (path, content)
        })
        .collect()
}

// ─── Word wrapping ───────────────────────────────────────────────

/// Wraps a caption string to fit within `max_chars_per_line` characters
/// by inserting newlines at word boundaries. Words longer than the
/// budget are kept on their own line (no mid-word breaks — readers
/// hate them and ffmpeg can scale slightly past the budget without
/// catastrophic clipping).
///
/// Returns the wrapped string with newlines as separators.
pub fn wrap_caption_text(text: &str, max_chars_per_line: usize) -> String {
    if max_chars_per_line == 0 {
        return text.to_string();
    }

    let mut lines: Vec<String> = Vec::new();
    let mut current = String::new();

    for word in text.split_whitespace() {
        if current.is_empty() {
            current.push_str(word);
        } else if current.len() + 1 + word.len() <= max_chars_per_line {
            current.push(' ');
            current.push_str(word);
        } else {
            lines.push(std::mem::take(&mut current));
            current.push_str(word);
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines.join("\n")
}

/// Computes the per-line character budget given the frame width,
/// font size, and a horizontal margin fraction. Used by the wrapper
/// to size each chunk before drawtext sees it.
pub fn chars_per_line(frame_width: u32, font_size: u32, horizontal_margin: f32) -> usize {
    if font_size == 0 {
        return 0;
    }
    let usable = (frame_width as f32) * (1.0 - horizontal_margin * 2.0);
    let glyph_w = (font_size as f32) * AVG_GLYPH_WIDTH_RATIO;
    if glyph_w <= 0.0 {
        return 0;
    }
    (usable / glyph_w).max(1.0) as usize
}

// ─── Drawtext filter chain construction ──────────────────────────

/// Computes the base font size for captions given a frame height
/// and the preset's font scale. Captions sit at ~3.6% of frame
/// height by default — bumped up by the preset scale for social.
pub fn compute_font_size(frame_height: u32, font_scale: f32) -> u32 {
    let base = (frame_height as f32) * 0.036;
    (base * font_scale).round().max(14.0) as u32
}

/// Returns the y-coordinate expression for drawtext's `y=` parameter
/// based on placement. Uses ffmpeg's expression syntax (`th` = text
/// height, `h` = frame height) so the position responds to multi-line
/// captions automatically.
fn placement_y_expr(placement: CaptionPlacement) -> &'static str {
    match placement {
        // Bottom of caption sits ~12% from the bottom edge.
        CaptionPlacement::LowerThird => "h-th-(h*0.10)",
        // Top of caption sits ~12% from the top edge.
        CaptionPlacement::UpperThird => "(h*0.12)",
        // Vertically centered.
        CaptionPlacement::Center => "(h-th)/2",
    }
}

/// Builds an ffmpeg drawtext filter fragment for a single caption,
/// referencing its pre-written text file via `textfile=`. Used by
/// `build_drawtext_chain`.
///
/// Quoting strategy: NO single quotes around path-style values. The
/// option-level parser splits on `:` and treats single quotes as
/// literal characters, so we escape colons explicitly via
/// `escape_font_path`. The chain-level parser sees the escapes
/// (backslashes are preserved through it) and the option-level
/// parser then strips them. The `enable=` expression is wrapped in
/// single quotes because that's an EXPRESSION value (not a path),
/// where single quotes do work as expected.
///
/// Result example:
///   drawtext=fontfile=/path/to/font.ttf\
///     :textfile=/tmp/session/caption_0000.txt\
///     :x=(w-tw)/2:y=h-th-(h*0.10):fontsize=48:fontcolor=white\
///     :borderw=3:bordercolor=black@0.85\
///     :box=1:boxcolor=black@0.55:boxborderw=12\
///     :enable='between(t\,1.500\,4.500)'
fn build_single_drawtext(
    chunk: &CaptionChunk,
    font_path_escaped: &str,
    text_file_escaped: &str,
    font_size: u32,
    placement: CaptionPlacement,
) -> String {
    let y_expr = placement_y_expr(placement);
    let start_sec = (chunk.start_ms as f64) / 1000.0;
    let end_sec = (chunk.end_ms as f64) / 1000.0;

    // Note on `enable=`: ffmpeg's filter chain parser interprets
    // commas as chain delimiters, so the commas inside
    // `between(t,start,end)` MUST be backslash-escaped or they get
    // reinterpreted as chain breaks. The single quotes on this
    // expression value DO work because expression values follow
    // different parser rules from option=value pair separators.
    //
    // `text_shaping=0`: with the default HarfBuzz shaper, variable
    // fonts like CrimsonPro render the U+000A LINE FEED byte as a
    // visible .notdef tofu box at each wrap point (and still break
    // to the next line). Disabling text shaping switches to plain
    // FreeType rendering, which treats LF as a pure line break with
    // no visible glyph.
    format!(
        "drawtext=fontfile={font_path_escaped}\
:textfile={text_file_escaped}\
:text_shaping=0\
:x=(w-text_w)/2\
:y={y_expr}\
:fontsize={font_size}\
:fontcolor=white\
:borderw=3\
:bordercolor=black@0.85\
:box=1\
:boxcolor=black@0.55\
:boxborderw=12\
:line_spacing=6\
:enable='between(t\\,{start_sec:.3}\\,{end_sec:.3})'",
    )
}

/// Escapes a filesystem path for embedding inside an ffmpeg filter
/// option value (e.g. `fontfile=...` or `textfile=...`).
///
/// ffmpeg has TWO levels of parsing for filter strings:
///   1. The filter chain parser splits on `,` and `;` and processes
///      backslash escapes (consuming one `\` per escape).
///   2. The option parser then splits on `:` between option=value
///      pairs and processes another level of backslash escapes.
///
/// To get a literal `:` past both parsers, we emit `\\:` in the
/// source (two backslashes + colon). The chain parser consumes one
/// backslash, leaving `\:`. The option parser then consumes the
/// remaining backslash, treating `:` as a literal character instead
/// of a separator.
///
/// Result example:
///   "C:\\Program Files\\Arcanum\\font.ttf"
///   → "C\\\\:/Program Files/Arcanum/font.ttf"
pub fn escape_font_path(path: &str) -> String {
    path.replace('\\', "/").replace(':', "\\\\:")
}

/// Builds the chained drawtext filter expression for an entire
/// caption track. Returns an empty string if there are no chunks
/// or if the caption_text_files list is empty.
///
/// `caption_text_files` must be parallel to `track.chunks` — one
/// pre-written file per chunk. The caller is responsible for
/// producing them via `caption_text_file_plan` and writing them
/// to disk before invoking ffmpeg.
///
/// The chain is comma-separated (filter chain syntax). Each chunk
/// becomes one drawtext, and ffmpeg composes them together. Only
/// the chunks whose [start_ms, end_ms] overlaps the current
/// playhead are visible at any moment, thanks to `enable=`.
pub fn build_drawtext_chain(
    track: &CaptionTrack,
    font_path: &str,
    caption_text_files: &[PathBuf],
    frame_height: u32,
) -> String {
    if track.chunks.is_empty() || caption_text_files.is_empty() {
        return String::new();
    }
    if track.chunks.len() != caption_text_files.len() {
        // Defensive: parallel arrays must match. The caller built
        // these from the same source so this should never happen.
        return String::new();
    }
    let font_size = compute_font_size(frame_height, track.style.font_scale);
    let font_path_quoted = escape_font_path(font_path);
    let parts: Vec<String> = track
        .chunks
        .iter()
        .zip(caption_text_files.iter())
        .map(|(chunk, file_path)| {
            let text_file_quoted = escape_font_path(&file_path.to_string_lossy());
            build_single_drawtext(
                chunk,
                &font_path_quoted,
                &text_file_quoted,
                font_size,
                track.style.placement,
            )
        })
        .collect();
    parts.join(",")
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn chunk(text: &str, start_ms: u64, end_ms: u64) -> CaptionChunk {
        CaptionChunk {
            text: text.to_string(),
            start_ms,
            end_ms,
        }
    }

    fn track_with(chunks: Vec<CaptionChunk>) -> CaptionTrack {
        CaptionTrack {
            chunks,
            style: CaptionStyle {
                placement: CaptionPlacement::LowerThird,
                font_scale: 1.0,
            },
        }
    }

    // ─── caption_text_file_plan ──────────────────────────────

    #[test]
    fn empty_track_produces_empty_plan() {
        let plan = caption_text_file_plan(
            &track_with(vec![]),
            Path::new("/tmp/sess"),
            1920,
            1080,
        );
        assert!(plan.is_empty());
    }

    #[test]
    fn plan_emits_one_file_per_chunk_with_zero_padded_index() {
        let plan = caption_text_file_plan(
            &track_with(vec![chunk("a", 0, 1000), chunk("b", 1000, 2000)]),
            Path::new("/tmp/sess"),
            1920,
            1080,
        );
        assert_eq!(plan.len(), 2);
        assert!(plan[0].0.to_string_lossy().ends_with("caption_0000.txt"));
        assert!(plan[1].0.to_string_lossy().ends_with("caption_0001.txt"));
    }

    #[test]
    fn plan_content_is_the_word_wrapped_text() {
        let plan = caption_text_file_plan(
            &track_with(vec![chunk("hello world", 0, 1000)]),
            Path::new("/tmp/sess"),
            1920,
            1080,
        );
        assert_eq!(plan[0].1, "hello world");
    }

    #[test]
    fn plan_content_inserts_newlines_for_long_text() {
        // Vertical preset so the budget is tight enough to wrap.
        let long = "the quick brown fox jumps over the lazy dog and then runs back home through the forest while the moon rises and the stars begin to twinkle";
        let track = CaptionTrack {
            chunks: vec![chunk(long, 0, 5000)],
            style: CaptionStyle {
                placement: CaptionPlacement::UpperThird,
                font_scale: 1.4,
            },
        };
        let plan = caption_text_file_plan(&track, Path::new("/tmp/sess"), 1080, 1920);
        assert!(plan[0].1.contains('\n'), "expected wrapped newlines");
    }

    // ─── wrap_caption_text ───────────────────────────────────

    #[test]
    fn wraps_long_text_on_word_boundaries() {
        let result = wrap_caption_text("the quick brown fox jumps over", 12);
        assert!(result.contains('\n'));
        for line in result.split('\n') {
            assert!(line.len() <= 18, "line too long: '{line}'");
        }
    }

    #[test]
    fn does_not_wrap_short_text() {
        let result = wrap_caption_text("short", 80);
        assert!(!result.contains('\n'));
    }

    #[test]
    fn keeps_words_intact_even_when_longer_than_budget() {
        let result = wrap_caption_text("supercalifragilistic short", 6);
        let lines: Vec<&str> = result.split('\n').collect();
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0], "supercalifragilistic");
        assert_eq!(lines[1], "short");
    }

    #[test]
    fn wrap_handles_empty_string() {
        assert_eq!(wrap_caption_text("", 20), "");
    }

    #[test]
    fn wrap_with_zero_budget_returns_original() {
        assert_eq!(wrap_caption_text("hello world", 0), "hello world");
    }

    // ─── chars_per_line ──────────────────────────────────────

    #[test]
    fn chars_per_line_scales_with_frame_width() {
        let narrow = chars_per_line(1080, 48, 0.08);
        let wide = chars_per_line(1920, 48, 0.08);
        assert!(wide > narrow);
    }

    #[test]
    fn chars_per_line_shrinks_with_font_size() {
        let small_font = chars_per_line(1920, 32, 0.08);
        let large_font = chars_per_line(1920, 64, 0.08);
        assert!(small_font > large_font);
    }

    #[test]
    fn chars_per_line_returns_at_least_one_for_extreme_inputs() {
        assert!(chars_per_line(100, 200, 0.08) >= 1);
    }

    #[test]
    fn chars_per_line_returns_zero_for_zero_font_size() {
        assert_eq!(chars_per_line(1920, 0, 0.08), 0);
    }

    // ─── compute_font_size ───────────────────────────────────

    #[test]
    fn font_size_scales_with_frame_height() {
        let small = compute_font_size(720, 1.0);
        let large = compute_font_size(1080, 1.0);
        assert!(large > small);
    }

    #[test]
    fn font_size_scales_with_font_scale() {
        let normal = compute_font_size(1080, 1.0);
        let bumped = compute_font_size(1080, 1.4);
        assert!(bumped > normal);
        // 1.4× should be roughly 1.4× the normal size (within rounding)
        let ratio = bumped as f32 / normal as f32;
        assert!(ratio > 1.3 && ratio < 1.5);
    }

    #[test]
    fn font_size_has_minimum_of_14px() {
        // Even at tiny frame height + scale, captions stay legible.
        let tiny = compute_font_size(100, 0.1);
        assert!(tiny >= 14);
    }

    #[test]
    fn font_size_for_1080p_showcase_is_reasonable() {
        // 1080 * 0.036 = ~39 — readable on TV and laptop.
        let size = compute_font_size(1080, 1.0);
        assert!((34..=44).contains(&size));
    }

    // ─── escape_font_path ────────────────────────────────────

    #[test]
    fn font_path_normalizes_windows_separators_to_forward_slash() {
        // Two backslashes + colon: the chain parser strips one,
        // leaving `\:` for the option parser to interpret as literal.
        assert_eq!(
            escape_font_path(r"C:\Program Files\Arcanum\font.ttf"),
            r"C\\:/Program Files/Arcanum/font.ttf",
        );
    }

    #[test]
    fn font_path_double_escapes_drive_colon() {
        assert_eq!(escape_font_path("C:/foo/bar.ttf"), r"C\\:/foo/bar.ttf");
    }

    #[test]
    fn font_path_unix_unchanged() {
        assert_eq!(
            escape_font_path("/usr/share/fonts/font.ttf"),
            "/usr/share/fonts/font.ttf",
        );
    }

    // ─── placement_y_expr ────────────────────────────────────

    #[test]
    fn lower_third_y_uses_bottom_anchored_expression() {
        assert_eq!(placement_y_expr(CaptionPlacement::LowerThird), "h-th-(h*0.10)");
    }

    #[test]
    fn upper_third_y_uses_top_offset_expression() {
        assert_eq!(placement_y_expr(CaptionPlacement::UpperThird), "(h*0.12)");
    }

    #[test]
    fn center_y_centers_text_block() {
        assert_eq!(placement_y_expr(CaptionPlacement::Center), "(h-th)/2");
    }

    // ─── build_drawtext_chain ────────────────────────────────

    /// Helper: produces a parallel caption_text_files vec with
    /// the same length as the track's chunks. Used by the unit
    /// tests to satisfy the new API contract.
    fn fake_caption_files(track: &CaptionTrack) -> Vec<PathBuf> {
        (0..track.chunks.len())
            .map(|i| PathBuf::from(format!("/tmp/caption_{i:04}.txt")))
            .collect()
    }

    #[test]
    fn empty_track_produces_empty_chain() {
        let track = track_with(vec![]);
        let files = fake_caption_files(&track);
        assert_eq!(build_drawtext_chain(&track, "/font.ttf", &files, 1080), "");
    }

    #[test]
    fn mismatched_files_array_produces_empty_chain() {
        // Defensive: caller must provide one file per chunk.
        let track = track_with(vec![chunk("a", 0, 1000), chunk("b", 1000, 2000)]);
        let files = vec![PathBuf::from("/tmp/only_one.txt")];
        assert_eq!(build_drawtext_chain(&track, "/font.ttf", &files, 1080), "");
    }

    #[test]
    fn single_chunk_produces_single_drawtext() {
        let track = track_with(vec![chunk("Hello world", 1500, 4500)]);
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(&track, "/font.ttf", &files, 1080);
        assert!(chain.starts_with("drawtext="));
        // Path values are NOT single-quoted (the option parser doesn't
        // respect quotes); colons are explicitly escaped instead.
        assert!(chain.contains("textfile=/tmp/caption_0000.txt"));
        // Expression values (enable=) ARE single-quoted because the
        // expression parser handles quotes correctly.
        assert!(
            chain.contains(r"enable='between(t\,1.500\,4.500)'"),
            "expected escaped between expression in: {chain}",
        );
        assert_eq!(chain.matches(",drawtext=").count(), 0);
    }

    #[test]
    fn multiple_chunks_produce_comma_chained_filters() {
        let track = track_with(vec![
            chunk("First", 0, 2000),
            chunk("Second", 2000, 4000),
            chunk("Third", 4000, 6000),
        ]);
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(&track, "/font.ttf", &files, 1080);
        assert_eq!(chain.matches("drawtext=").count(), 3);
        assert_eq!(chain.matches(",drawtext=").count(), 2);
        // Each chunk references its own text file (no quotes)
        assert!(chain.contains("textfile=/tmp/caption_0000.txt"));
        assert!(chain.contains("textfile=/tmp/caption_0001.txt"));
        assert!(chain.contains("textfile=/tmp/caption_0002.txt"));
    }

    #[test]
    fn drawtext_includes_font_path() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(&track, "/path/to/font.ttf", &files, 1080);
        assert!(chain.contains("fontfile=/path/to/font.ttf"));
    }

    #[test]
    fn windows_font_path_has_double_escaped_colon() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(
            &track,
            r"C:\Windows\Fonts\arial.ttf",
            &files,
            1080,
        );
        // Drive colon double-escaped (chain parser → option parser),
        // backslashes normalized to forward slashes.
        assert!(chain.contains(r"fontfile=C\\:/Windows/Fonts/arial.ttf"));
    }

    #[test]
    fn drawtext_uses_lower_third_y_for_default_placement() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(&track, "/font.ttf", &files, 1080);
        assert!(chain.contains("h-th-(h*0.10)"));
    }

    #[test]
    fn drawtext_uses_upper_third_y_for_vertical_preset() {
        let track = CaptionTrack {
            chunks: vec![chunk("hi", 0, 1000)],
            style: CaptionStyle {
                placement: CaptionPlacement::UpperThird,
                font_scale: 1.4,
            },
        };
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(&track, "/font.ttf", &files, 1920);
        assert!(chain.contains("(h*0.12)"));
    }

    #[test]
    fn drawtext_includes_box_and_border_styling() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(&track, "/font.ttf", &files, 1080);
        assert!(chain.contains("box=1"));
        assert!(chain.contains("borderw=3"));
        assert!(chain.contains("fontcolor=white"));
    }

    #[test]
    fn drawtext_disables_text_shaping() {
        // text_shaping=0 is required to stop variable fonts from
        // rendering LF bytes as visible tofu boxes at wrap points.
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(&track, "/font.ttf", &files, 1080);
        assert!(
            chain.contains("text_shaping=0"),
            "expected text_shaping=0 in: {chain}",
        );
    }

    #[test]
    fn drawtext_font_size_uses_compute_font_size() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let files = fake_caption_files(&track);
        let chain = build_drawtext_chain(&track, "/font.ttf", &files, 1080);
        let expected_size = compute_font_size(1080, 1.0);
        assert!(chain.contains(&format!("fontsize={expected_size}")));
    }

    #[test]
    fn drawtext_font_size_responds_to_font_scale() {
        let scaled = CaptionTrack {
            chunks: vec![chunk("hi", 0, 1000)],
            style: CaptionStyle {
                placement: CaptionPlacement::LowerThird,
                font_scale: 1.4,
            },
        };
        let files = fake_caption_files(&scaled);
        let chain = build_drawtext_chain(&scaled, "/font.ttf", &files, 1080);
        let expected_size = compute_font_size(1080, 1.4);
        assert!(chain.contains(&format!("fontsize={expected_size}")));
    }
}
