// ─── ffmpeg Progress Parser ──────────────────────────────────────
// Parses the stream of key=value pairs ffmpeg emits when invoked
// with `-progress pipe:1`. Each block of progress data ends with a
// `progress=continue` or `progress=end` marker; the parser
// accumulates mid-block lines and flushes a complete
// `FfmpegProgressEvent` on every marker.
//
// Used by audio_mix and video_encode to translate ffmpeg's native
// progress stream into Tauri events the UI can render as a smooth
// progress bar (instead of the previous "jumps between stages"
// behavior).
//
// Sample input from ffmpeg -progress pipe:1:
//
//   frame=127
//   fps=30.12
//   stream_0_0_q=28.0
//   bitrate=1500.0kbits/s
//   total_size=50000
//   out_time_us=4233000
//   out_time_ms=4233000
//   out_time=00:00:04.233000
//   dup_frames=0
//   drop_frames=0
//   speed=1.01x
//   progress=continue
//
// Flush cadence is typically ~500ms (ffmpeg's default) but can be
// configured via `-stats_period`. We don't rely on a specific
// interval — the parser is purely line-driven.

use std::collections::HashMap;

/// One complete batch of progress data emitted by ffmpeg between
/// `progress=` markers. All numeric fields are optional because
/// older ffmpeg versions may omit some keys or emit them with
/// unexpected formatting.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct FfmpegProgressEvent {
    /// Current output timestamp in microseconds. Used with the
    /// total expected duration to compute a progress fraction.
    pub out_time_us: Option<u64>,
    /// Current encoder frame count.
    pub frame: Option<u64>,
    /// Instantaneous encoding frame rate (output frames per
    /// wall-clock second).
    pub fps: Option<f64>,
    /// Speed multiplier (1.0 = realtime; 2.0 = 2x faster than
    /// realtime). Parsed from strings like "1.23x".
    pub speed: Option<f64>,
    /// True when the block was terminated by `progress=end` (the
    /// last event ffmpeg emits before exiting). Subsequent
    /// `feed_line` calls after this will start a fresh block, but
    /// in practice ffmpeg doesn't emit more data after end.
    pub ended: bool,
}

impl FfmpegProgressEvent {
    /// Computes the progress fraction (0..1) given the total
    /// expected duration in milliseconds. Returns `None` when
    /// the event lacks `out_time_us` or `total_duration_ms` is zero.
    /// Clamps to [0, 1] so late frames at the tail don't
    /// overshoot.
    pub fn fraction(&self, total_duration_ms: u64) -> Option<f32> {
        if total_duration_ms == 0 {
            return None;
        }
        let us = self.out_time_us?;
        let current_ms = us / 1000;
        let f = current_ms as f64 / total_duration_ms as f64;
        Some(f.clamp(0.0, 1.0) as f32)
    }
}

/// Incremental parser for a single ffmpeg progress stream.
/// Feed each line from the spawned process's stdout via
/// `feed_line`; it returns `Some(event)` when a `progress=`
/// marker completes a block, `None` when still accumulating
/// mid-block fields.
///
/// The parser is stateful but cheap — one instance per ffmpeg
/// invocation.
pub struct FfmpegProgressParser {
    pending: HashMap<String, String>,
}

impl FfmpegProgressParser {
    pub fn new() -> Self {
        Self {
            pending: HashMap::new(),
        }
    }

    /// Feeds one line from ffmpeg's -progress stream. Returns
    /// `Some(event)` on block completion (any `progress=` line),
    /// `None` otherwise. Malformed lines (no `=`) are silently
    /// ignored — ffmpeg occasionally emits blank lines or
    /// diagnostic text on the same stream and we shouldn't crash
    /// on them.
    pub fn feed_line(&mut self, line: &str) -> Option<FfmpegProgressEvent> {
        let line = line.trim();
        if line.is_empty() {
            return None;
        }
        let (key, value) = match line.split_once('=') {
            Some(pair) => pair,
            None => return None,
        };
        let key = key.trim();
        let value = value.trim();

        if key == "progress" {
            let ended = value == "end";
            let event = self.build_event(ended);
            self.pending.clear();
            return Some(event);
        }

        self.pending.insert(key.to_string(), value.to_string());
        None
    }

    fn build_event(&self, ended: bool) -> FfmpegProgressEvent {
        FfmpegProgressEvent {
            out_time_us: self
                .pending
                .get("out_time_us")
                .and_then(|s| s.parse().ok()),
            frame: self.pending.get("frame").and_then(|s| s.parse().ok()),
            fps: self.pending.get("fps").and_then(|s| s.parse().ok()),
            speed: self
                .pending
                .get("speed")
                .and_then(|s| s.trim_end_matches('x').parse().ok()),
            ended,
        }
    }
}

impl Default for FfmpegProgressParser {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn feed_all(parser: &mut FfmpegProgressParser, text: &str) -> Vec<FfmpegProgressEvent> {
        let mut events = Vec::new();
        for line in text.lines() {
            if let Some(event) = parser.feed_line(line) {
                events.push(event);
            }
        }
        events
    }

    // ─── feed_line: mid-block accumulation ──────────────────

    #[test]
    fn empty_line_yields_nothing() {
        let mut p = FfmpegProgressParser::new();
        assert_eq!(p.feed_line(""), None);
        assert_eq!(p.feed_line("   "), None);
    }

    #[test]
    fn line_without_equals_is_ignored() {
        let mut p = FfmpegProgressParser::new();
        assert_eq!(p.feed_line("garbage"), None);
        assert_eq!(p.feed_line("something-else"), None);
    }

    #[test]
    fn key_value_pair_without_progress_marker_returns_none() {
        let mut p = FfmpegProgressParser::new();
        assert_eq!(p.feed_line("frame=100"), None);
        assert_eq!(p.feed_line("fps=30.0"), None);
    }

    // ─── feed_line: block completion ────────────────────────

    #[test]
    fn progress_continue_flushes_accumulated_fields() {
        let mut p = FfmpegProgressParser::new();
        p.feed_line("frame=100");
        p.feed_line("fps=30.0");
        p.feed_line("out_time_us=3500000");
        p.feed_line("speed=1.5x");
        let event = p.feed_line("progress=continue").expect("should flush");
        assert_eq!(event.frame, Some(100));
        assert_eq!(event.fps, Some(30.0));
        assert_eq!(event.out_time_us, Some(3500000));
        assert_eq!(event.speed, Some(1.5));
        assert!(!event.ended);
    }

    #[test]
    fn progress_end_sets_ended_flag() {
        let mut p = FfmpegProgressParser::new();
        p.feed_line("frame=600");
        p.feed_line("out_time_us=20000000");
        let event = p.feed_line("progress=end").expect("should flush");
        assert!(event.ended);
        assert_eq!(event.out_time_us, Some(20000000));
    }

    #[test]
    fn block_state_resets_between_progress_markers() {
        let mut p = FfmpegProgressParser::new();
        p.feed_line("frame=100");
        p.feed_line("progress=continue");
        // Second block should not carry over frame=100
        p.feed_line("out_time_us=5000000");
        let second = p.feed_line("progress=continue").unwrap();
        assert_eq!(second.frame, None);
        assert_eq!(second.out_time_us, Some(5000000));
    }

    #[test]
    fn malformed_numeric_fields_are_none() {
        let mut p = FfmpegProgressParser::new();
        p.feed_line("frame=not-a-number");
        p.feed_line("fps=also-bad");
        p.feed_line("out_time_us=garbage");
        let event = p.feed_line("progress=continue").unwrap();
        assert_eq!(event.frame, None);
        assert_eq!(event.fps, None);
        assert_eq!(event.out_time_us, None);
    }

    #[test]
    fn real_world_block_parses_correctly() {
        let mut p = FfmpegProgressParser::new();
        let block = "\
frame=127
fps=30.12
stream_0_0_q=28.0
bitrate=1500.0kbits/s
total_size=50000
out_time_us=4233000
out_time_ms=4233000
out_time=00:00:04.233000
dup_frames=0
drop_frames=0
speed=1.01x
progress=continue";
        let events = feed_all(&mut p, block);
        assert_eq!(events.len(), 1);
        let e = &events[0];
        assert_eq!(e.frame, Some(127));
        assert_eq!(e.fps, Some(30.12));
        assert_eq!(e.out_time_us, Some(4233000));
        assert_eq!(e.speed, Some(1.01));
        assert!(!e.ended);
    }

    #[test]
    fn multi_block_stream_emits_one_event_per_progress_marker() {
        let mut p = FfmpegProgressParser::new();
        let stream = "\
frame=30
out_time_us=1000000
progress=continue
frame=60
out_time_us=2000000
progress=continue
frame=90
out_time_us=3000000
progress=end";
        let events = feed_all(&mut p, stream);
        assert_eq!(events.len(), 3);
        assert_eq!(events[0].frame, Some(30));
        assert_eq!(events[1].frame, Some(60));
        assert_eq!(events[2].frame, Some(90));
        assert!(events[2].ended);
        assert!(!events[0].ended);
    }

    // ─── fraction ────────────────────────────────────────────

    #[test]
    fn fraction_computes_from_out_time_and_total() {
        let event = FfmpegProgressEvent {
            out_time_us: Some(5_000_000),
            ..Default::default()
        };
        assert_eq!(event.fraction(10_000), Some(0.5));
    }

    #[test]
    fn fraction_clamps_to_one_when_past_end() {
        let event = FfmpegProgressEvent {
            out_time_us: Some(12_000_000),
            ..Default::default()
        };
        assert_eq!(event.fraction(10_000), Some(1.0));
    }

    #[test]
    fn fraction_clamps_to_zero_for_negative_would_be() {
        // out_time_us can't actually go negative (u64), but we
        // still guard against edge cases.
        let event = FfmpegProgressEvent {
            out_time_us: Some(0),
            ..Default::default()
        };
        assert_eq!(event.fraction(10_000), Some(0.0));
    }

    #[test]
    fn fraction_is_none_when_out_time_us_missing() {
        let event = FfmpegProgressEvent::default();
        assert_eq!(event.fraction(10_000), None);
    }

    #[test]
    fn fraction_is_none_when_total_is_zero() {
        let event = FfmpegProgressEvent {
            out_time_us: Some(5_000_000),
            ..Default::default()
        };
        assert_eq!(event.fraction(0), None);
    }
}
