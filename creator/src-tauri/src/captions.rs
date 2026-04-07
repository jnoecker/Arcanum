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

// ─── Caption rendering plan ──────────────────────────────────────
//
// Why one drawtext per line instead of embedded newlines:
// The first attempt embedded newlines in a single text file per
// caption chunk and let ffmpeg's drawtext interpret them as line
// breaks. That produced visible tofu boxes at every wrap point
// regardless of font, text_shaping flag, or encoding — ffmpeg's
// drawtext renders the U+000A byte as a visible glyph AS WELL AS
// breaking the line.
//
// Reliable workaround: emit one drawtext filter per wrapped line,
// with stacked y coordinates precomputed from the font size and
// line index. Each text file contains exactly one line of text,
// no newlines, so there's nothing for drawtext to render as a
// glyph. The x=(w-text_w)/2 centering makes each line center
// independently, which also happens to give the right look for
// centered captions.
//
// The caller (the video_export orchestrator) writes each line's
// text file before invoking ffmpeg, then hands the prepared lines
// to `build_drawtext_chain_from_lines`.

/// A single wrapped line of caption text, ready to become one
/// drawtext filter. Multiple lines are produced per caption chunk
/// (one per wrapped line); they share timing with their parent
/// chunk and stack vertically via `line_index` / `total_lines`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WrappedCaptionLine {
    /// Absolute path to the (pre-written) text file containing
    /// this line's content.
    pub file_path: String,
    /// Content to write to `file_path`. The caller writes this
    /// before invoking ffmpeg.
    pub file_content: String,
    /// Parent chunk's absolute start time in the final video (ms).
    pub chunk_start_ms: u64,
    /// Parent chunk's absolute end time (ms).
    pub chunk_end_ms: u64,
    /// 0-based index of this line within its parent chunk.
    pub line_index: u32,
    /// Total number of lines in the parent chunk.
    pub total_lines: u32,
}

/// Plans the per-line caption layout for a track: wraps each chunk
/// at the frame's character budget, then emits one `WrappedCaptionLine`
/// per wrapped line. The caller writes each line's `file_content` to
/// its `file_path` before running ffmpeg.
///
/// Path scheme: `<dir>/caption_CCCC_LL.txt` where CCCC is the 0-padded
/// parent chunk index and LL is the 0-padded line index within that
/// chunk. Keeps lines easy to identify when debugging.
pub fn plan_caption_lines(
    track: &CaptionTrack,
    dir: &Path,
    frame_width: u32,
    frame_height: u32,
) -> Vec<WrappedCaptionLine> {
    if track.chunks.is_empty() {
        return Vec::new();
    }
    let font_size = compute_font_size(frame_height, track.style.font_scale);
    let budget = chars_per_line(frame_width, font_size, 0.08);

    let mut result: Vec<WrappedCaptionLine> = Vec::new();
    for (chunk_idx, chunk) in track.chunks.iter().enumerate() {
        let wrapped = wrap_caption_text(&chunk.text, budget);
        let lines: Vec<&str> = wrapped
            .split('\n')
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect();
        let total_lines = lines.len() as u32;
        if total_lines == 0 {
            continue;
        }
        for (line_idx, line_text) in lines.iter().enumerate() {
            let file_path = dir
                .join(format!("caption_{chunk_idx:04}_{line_idx:02}.txt"))
                .to_string_lossy()
                .to_string();
            result.push(WrappedCaptionLine {
                file_path,
                file_content: line_text.to_string(),
                chunk_start_ms: chunk.start_ms,
                chunk_end_ms: chunk.end_ms,
                line_index: line_idx as u32,
                total_lines,
            });
        }
    }
    result
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

/// Computes the top-y pixel coordinate for a single caption line
/// given its placement within the parent chunk's line block.
///
/// Instead of using ffmpeg expressions with `th` (text height),
/// we precompute the pixel y for each line from the known font
/// size, line count, and frame height. This is more reliable —
/// `th` only measures the single line drawtext is currently
/// rendering, so multi-drawtext blocks can't self-stack via `th`.
pub fn compute_line_y(
    placement: CaptionPlacement,
    line_index: u32,
    total_lines: u32,
    line_height: u32,
    frame_height: u32,
) -> i32 {
    let i = line_index as i32;
    let n = total_lines as i32;
    let lh = line_height as i32;
    let h = frame_height as i32;
    match placement {
        // Block's bottom edge sits at 88% of frame height (12% gap
        // from the bottom of the frame).
        CaptionPlacement::LowerThird => {
            let block_bottom = (h * 88) / 100;
            block_bottom - (n - i) * lh
        }
        // Block's top edge sits at 12% of frame height (leaves space
        // above for the phone status bar on social-vertical).
        CaptionPlacement::UpperThird => {
            let block_top = (h * 12) / 100;
            block_top + i * lh
        }
        // Block is vertically centered.
        CaptionPlacement::Center => {
            let block_top = (h - n * lh) / 2;
            block_top + i * lh
        }
    }
}

/// Line-to-line spacing (in pixels) added to the font size to
/// compute the line height. Matches the previous `line_spacing=6`
/// drawtext parameter we used for multi-line captions.
const CAPTION_LINE_SPACING: u32 = 6;

pub fn compute_line_height(font_size: u32) -> u32 {
    font_size + CAPTION_LINE_SPACING
}

/// Builds an ffmpeg drawtext filter fragment for a single wrapped
/// caption line. Used by `build_drawtext_chain_from_lines`.
///
/// Each wrapped line becomes its own drawtext filter with a fixed
/// pixel y coordinate computed from `line_index` + `total_lines`.
/// Since there are no newlines in the text file, drawtext has no
/// opportunity to render LF bytes as visible glyphs.
///
/// Quoting strategy: NO single quotes around path-style values.
/// `escape_font_path` double-escapes colons (`\\:`) so they survive
/// both the chain parser and the option parser. The `enable=`
/// expression IS wrapped in single quotes because expression values
/// follow different parser rules.
fn build_line_drawtext(
    line: &WrappedCaptionLine,
    font_path_escaped: &str,
    font_size: u32,
    placement: CaptionPlacement,
    frame_height: u32,
) -> String {
    let text_file_escaped = escape_font_path(&line.file_path);
    let line_height = compute_line_height(font_size);
    let y = compute_line_y(
        placement,
        line.line_index,
        line.total_lines,
        line_height,
        frame_height,
    );
    let start_sec = (line.chunk_start_ms as f64) / 1000.0;
    let end_sec = (line.chunk_end_ms as f64) / 1000.0;

    // Note on `enable=`: ffmpeg's filter chain parser interprets
    // commas as chain delimiters even inside single-quoted args,
    // so the commas inside `between(t,start,end)` MUST be backslash-
    // escaped.
    format!(
        "drawtext=fontfile={font_path_escaped}\
:textfile={text_file_escaped}\
:text_shaping=0\
:x=(w-text_w)/2\
:y={y}\
:fontsize={font_size}\
:fontcolor=white\
:borderw=3\
:bordercolor=black@0.85\
:box=1\
:boxcolor=black@0.55\
:boxborderw=12\
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

/// Builds the chained drawtext filter expression from a list of
/// pre-planned wrapped caption lines. Each line becomes its own
/// drawtext filter with a precomputed stacked y coordinate.
///
/// Returns an empty string when `lines` is empty. The chain is
/// comma-separated (filter chain syntax). Only the lines whose
/// parent chunk's [chunk_start_ms, chunk_end_ms] overlaps the
/// current playhead are visible, via per-line `enable=`.
pub fn build_drawtext_chain_from_lines(
    lines: &[WrappedCaptionLine],
    font_path: &str,
    placement: CaptionPlacement,
    font_scale: f32,
    frame_height: u32,
) -> String {
    if lines.is_empty() {
        return String::new();
    }
    let font_size = compute_font_size(frame_height, font_scale);
    let font_path_escaped = escape_font_path(font_path);
    let parts: Vec<String> = lines
        .iter()
        .map(|line| {
            build_line_drawtext(
                line,
                &font_path_escaped,
                font_size,
                placement,
                frame_height,
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

    // ─── plan_caption_lines ──────────────────────────────────

    #[test]
    fn empty_track_produces_empty_plan() {
        let plan = plan_caption_lines(
            &track_with(vec![]),
            Path::new("/tmp/sess"),
            1920,
            1080,
        );
        assert!(plan.is_empty());
    }

    #[test]
    fn single_line_chunk_produces_one_entry() {
        let plan = plan_caption_lines(
            &track_with(vec![chunk("hello world", 0, 1000)]),
            Path::new("/tmp/sess"),
            1920,
            1080,
        );
        assert_eq!(plan.len(), 1);
        assert_eq!(plan[0].file_content, "hello world");
        assert_eq!(plan[0].line_index, 0);
        assert_eq!(plan[0].total_lines, 1);
        assert!(plan[0].file_path.ends_with("caption_0000_00.txt"));
    }

    #[test]
    fn multiple_chunks_get_distinct_chunk_indexes() {
        let plan = plan_caption_lines(
            &track_with(vec![
                chunk("first", 0, 1000),
                chunk("second", 1000, 2000),
            ]),
            Path::new("/tmp/sess"),
            1920,
            1080,
        );
        assert_eq!(plan.len(), 2);
        assert!(plan[0].file_path.ends_with("caption_0000_00.txt"));
        assert!(plan[1].file_path.ends_with("caption_0001_00.txt"));
        // Each chunk's single line has total_lines = 1
        assert_eq!(plan[0].total_lines, 1);
        assert_eq!(plan[1].total_lines, 1);
    }

    #[test]
    fn long_chunk_wraps_to_multiple_entries() {
        // Vertical preset: narrow frame + 1.4x font scale tightens
        // the per-line budget enough to force wrapping.
        let long = "the quick brown fox jumps over the lazy dog and then runs back home through the forest while the moon rises and the stars begin to twinkle";
        let track = CaptionTrack {
            chunks: vec![chunk(long, 0, 5000)],
            style: CaptionStyle {
                placement: CaptionPlacement::UpperThird,
                font_scale: 1.4,
            },
        };
        let plan = plan_caption_lines(&track, Path::new("/tmp/sess"), 1080, 1920);
        assert!(plan.len() > 1, "expected wrapping into multiple lines");
        // Every entry in this chunk shares total_lines + chunk timing
        let total = plan[0].total_lines;
        for (i, entry) in plan.iter().enumerate() {
            assert_eq!(entry.total_lines, total);
            assert_eq!(entry.line_index, i as u32);
            assert_eq!(entry.chunk_start_ms, 0);
            assert_eq!(entry.chunk_end_ms, 5000);
            // File path encodes both chunk index and line index
            assert!(
                entry.file_path.contains(&format!("caption_0000_{i:02}.txt")),
                "unexpected filename: {}",
                entry.file_path,
            );
            // Critically: NO line contains a newline — each entry is
            // a single wrapped line, not a chunk with embedded breaks.
            assert!(
                !entry.file_content.contains('\n'),
                "line {} contains an embedded newline: {:?}",
                i,
                entry.file_content,
            );
        }
    }

    // ─── compute_line_y ──────────────────────────────────────

    #[test]
    fn lower_third_single_line_sits_at_expected_position() {
        // Single line, h=1080, line_height=50.
        // block_bottom = 1080 * 0.88 = 950
        // y = 950 - (1 - 0) * 50 = 900
        let y = compute_line_y(CaptionPlacement::LowerThird, 0, 1, 50, 1080);
        assert_eq!(y, 900);
    }

    #[test]
    fn lower_third_multi_line_stacks_correctly() {
        // 3 lines, h=1080, lh=50.
        // Line 0 y = 950 - 150 = 800
        // Line 1 y = 950 - 100 = 850
        // Line 2 y = 950 - 50 = 900
        assert_eq!(compute_line_y(CaptionPlacement::LowerThird, 0, 3, 50, 1080), 800);
        assert_eq!(compute_line_y(CaptionPlacement::LowerThird, 1, 3, 50, 1080), 850);
        assert_eq!(compute_line_y(CaptionPlacement::LowerThird, 2, 3, 50, 1080), 900);
    }

    #[test]
    fn upper_third_stacks_downward_from_top_offset() {
        // block_top = 1920 * 0.12 = 230
        // Line 0 y = 230
        // Line 1 y = 230 + 80 = 310
        assert_eq!(compute_line_y(CaptionPlacement::UpperThird, 0, 2, 80, 1920), 230);
        assert_eq!(compute_line_y(CaptionPlacement::UpperThird, 1, 2, 80, 1920), 310);
    }

    #[test]
    fn center_block_is_vertically_centered() {
        // 3 lines at lh=50 → block height = 150
        // block_top = (1080 - 150) / 2 = 465
        assert_eq!(compute_line_y(CaptionPlacement::Center, 0, 3, 50, 1080), 465);
        assert_eq!(compute_line_y(CaptionPlacement::Center, 1, 3, 50, 1080), 515);
        assert_eq!(compute_line_y(CaptionPlacement::Center, 2, 3, 50, 1080), 565);
    }

    #[test]
    fn compute_line_height_adds_spacing_to_font_size() {
        assert_eq!(compute_line_height(40), 46);
        assert_eq!(compute_line_height(0), 6);
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

    // ─── build_drawtext_chain_from_lines ─────────────────────

    /// Helper: plans caption lines from a track in /tmp/sess.
    fn planned_lines(
        track: &CaptionTrack,
        frame_width: u32,
        frame_height: u32,
    ) -> Vec<WrappedCaptionLine> {
        plan_caption_lines(track, Path::new("/tmp/sess"), frame_width, frame_height)
    }

    #[test]
    fn empty_lines_produces_empty_chain() {
        let lines: Vec<WrappedCaptionLine> = Vec::new();
        assert_eq!(
            build_drawtext_chain_from_lines(
                &lines,
                "/font.ttf",
                CaptionPlacement::LowerThird,
                1.0,
                1080,
            ),
            "",
        );
    }

    #[test]
    fn single_line_produces_single_drawtext() {
        let track = track_with(vec![chunk("Hello world", 1500, 4500)]);
        let lines = planned_lines(&track, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/font.ttf",
            track.style.placement,
            track.style.font_scale,
            1080,
        );
        assert!(chain.starts_with("drawtext="));
        // Paths are NOT single-quoted; colons are double-escaped
        // for the two-level parser.
        assert!(chain.contains("textfile=/tmp/sess/caption_0000_00.txt"));
        // Expression values (enable=) ARE single-quoted.
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
        let lines = planned_lines(&track, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/font.ttf",
            track.style.placement,
            track.style.font_scale,
            1080,
        );
        assert_eq!(chain.matches("drawtext=").count(), 3);
        assert_eq!(chain.matches(",drawtext=").count(), 2);
        assert!(chain.contains("caption_0000_00.txt"));
        assert!(chain.contains("caption_0001_00.txt"));
        assert!(chain.contains("caption_0002_00.txt"));
    }

    #[test]
    fn long_chunk_produces_one_drawtext_per_wrapped_line() {
        // Vertical preset tightens the budget enough to force
        // multi-line wrapping.
        let long = "the quick brown fox jumps over the lazy dog and then runs back home through the forest while the moon rises and the stars begin to twinkle";
        let track = CaptionTrack {
            chunks: vec![chunk(long, 0, 5000)],
            style: CaptionStyle {
                placement: CaptionPlacement::UpperThird,
                font_scale: 1.4,
            },
        };
        let lines = planned_lines(&track, 1080, 1920);
        assert!(lines.len() > 1);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/font.ttf",
            track.style.placement,
            track.style.font_scale,
            1920,
        );
        // Exactly one drawtext per wrapped line
        assert_eq!(chain.matches("drawtext=").count(), lines.len());
        // Every drawtext filter shares the parent chunk's timing
        assert_eq!(
            chain.matches(r"between(t\,0.000\,5.000)").count(),
            lines.len(),
        );
        // All filenames belong to the same chunk
        for i in 0..lines.len() {
            assert!(chain.contains(&format!("caption_0000_{i:02}.txt")));
        }
    }

    #[test]
    fn drawtext_includes_font_path() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let lines = planned_lines(&track, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/path/to/font.ttf",
            track.style.placement,
            track.style.font_scale,
            1080,
        );
        assert!(chain.contains("fontfile=/path/to/font.ttf"));
    }

    #[test]
    fn windows_font_path_has_double_escaped_colon() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let lines = planned_lines(&track, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            r"C:\Windows\Fonts\arial.ttf",
            track.style.placement,
            track.style.font_scale,
            1080,
        );
        assert!(chain.contains(r"fontfile=C\\:/Windows/Fonts/arial.ttf"));
    }

    #[test]
    fn drawtext_uses_precomputed_pixel_y_not_expressions() {
        // The new API emits concrete pixel y values, not ffmpeg
        // expressions like `h-th-(h*0.10)`. This is the key change
        // that enables per-line stacking.
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let lines = planned_lines(&track, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/font.ttf",
            track.style.placement,
            track.style.font_scale,
            1080,
        );
        assert!(!chain.contains("h-th-"));
        // Should contain a concrete numeric y= value
        assert!(
            chain.contains(":y=") && !chain.contains(":y=h"),
            "expected pixel y value in: {chain}",
        );
    }

    #[test]
    fn drawtext_includes_box_and_border_styling() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let lines = planned_lines(&track, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/font.ttf",
            track.style.placement,
            track.style.font_scale,
            1080,
        );
        assert!(chain.contains("box=1"));
        assert!(chain.contains("borderw=3"));
        assert!(chain.contains("fontcolor=white"));
    }

    #[test]
    fn drawtext_disables_text_shaping() {
        // text_shaping=0 is kept as a belt-and-braces measure even
        // though the multi-drawtext approach makes it unnecessary.
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let lines = planned_lines(&track, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/font.ttf",
            track.style.placement,
            track.style.font_scale,
            1080,
        );
        assert!(chain.contains("text_shaping=0"));
    }

    #[test]
    fn drawtext_font_size_uses_compute_font_size() {
        let track = track_with(vec![chunk("hi", 0, 1000)]);
        let lines = planned_lines(&track, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/font.ttf",
            track.style.placement,
            track.style.font_scale,
            1080,
        );
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
        let lines = planned_lines(&scaled, 1920, 1080);
        let chain = build_drawtext_chain_from_lines(
            &lines,
            "/font.ttf",
            scaled.style.placement,
            scaled.style.font_scale,
            1080,
        );
        let expected_size = compute_font_size(1080, 1.4);
        assert!(chain.contains(&format!("fontsize={expected_size}")));
    }
}
