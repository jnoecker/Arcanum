// ─── Export Cancellation Registry ────────────────────────────────
// Tracks in-flight story video exports by session_id so the frontend
// can abort a running export via `cancel_story_video_export`. The
// orchestrator registers a cancel flag on start, unregisters on end,
// and polls the flag between pipeline stages + inside the ffmpeg
// spawn loops so cancellation has a ~500ms worst-case latency.
//
// Implementation notes:
//   - We use std::sync::OnceLock for the registry singleton (stable
//     since Rust 1.70) so there's no new crate dependency.
//   - Each flag is an Arc<AtomicBool> so the orchestrator holds one
//     strong ref while it runs; the cancel command holds a weak-ish
//     ref via the registry lookup. Unregister on end clears the
//     registry entry but the orchestrator still has its clone.
//   - The flag uses SeqCst ordering because cancellation is rare
//     (user click) and ordering cost is negligible compared to
//     the relief of not debugging a weird memory-ordering bug.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

/// Shared cancellation flag held by both the orchestrator and the
/// registry. Set to `true` when cancellation is requested.
pub type CancelFlag = Arc<AtomicBool>;

type Registry = Mutex<HashMap<String, CancelFlag>>;

fn registry() -> &'static Registry {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Registers a new cancellation flag for the given session and
/// returns the flag for the orchestrator to hold. If the session_id
/// was already registered (shouldn't happen — session_ids are UUIDs),
/// the previous entry is overwritten.
pub fn register(session_id: String) -> CancelFlag {
    let flag: CancelFlag = Arc::new(AtomicBool::new(false));
    let mut map = registry().lock().expect("cancel registry poisoned");
    map.insert(session_id, flag.clone());
    flag
}

/// Removes the session's cancellation flag from the registry.
/// Called by the orchestrator after the export completes (success,
/// error, or cancellation). The orchestrator still owns its
/// Arc clone, so this just stops new `cancel` calls from finding it.
pub fn unregister(session_id: &str) {
    let mut map = registry().lock().expect("cancel registry poisoned");
    map.remove(session_id);
}

/// Requests cancellation of the export for the given session. Returns
/// `true` if a session with that ID was found and flagged, `false` if
/// the session was not in the registry (already finished, never
/// started, or wrong id).
pub fn cancel(session_id: &str) -> bool {
    let map = registry().lock().expect("cancel registry poisoned");
    if let Some(flag) = map.get(session_id) {
        flag.store(true, Ordering::SeqCst);
        true
    } else {
        false
    }
}

/// Convenience: returns `true` if the flag has been cancelled.
pub fn is_cancelled(flag: &AtomicBool) -> bool {
    flag.load(Ordering::SeqCst)
}

/// Returns `Err("Export cancelled")` if the flag is set, otherwise
/// `Ok(())`. The orchestrator calls this between stages to bail out
/// early instead of progressing to the next ffmpeg invocation.
pub fn check(flag: &AtomicBool) -> Result<(), String> {
    if is_cancelled(flag) {
        Err("Export cancelled by user".to_string())
    } else {
        Ok(())
    }
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Tests use unique session IDs per test to avoid cross-test
    /// registry contamination (the registry is a process-global
    /// singleton shared across all tests in the same run).
    fn unique_id(name: &str) -> String {
        format!(
            "{name}-{pid}-{ts}",
            pid = std::process::id(),
            ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
        )
    }

    #[test]
    fn register_returns_a_fresh_unset_flag() {
        let id = unique_id("register_unset");
        let flag = register(id.clone());
        assert!(!is_cancelled(&flag));
        unregister(&id);
    }

    #[test]
    fn cancel_sets_the_flag_for_a_registered_session() {
        let id = unique_id("cancel_sets");
        let flag = register(id.clone());
        assert!(cancel(&id));
        assert!(is_cancelled(&flag));
        unregister(&id);
    }

    #[test]
    fn cancel_returns_false_for_unknown_session() {
        assert!(!cancel("totally-nonexistent-session-id"));
    }

    #[test]
    fn unregister_prevents_future_cancel_from_reaching_the_flag() {
        let id = unique_id("unregister_blocks");
        let flag = register(id.clone());
        unregister(&id);
        assert!(!cancel(&id));
        // The orchestrator's copy of the flag is unaffected
        assert!(!is_cancelled(&flag));
    }

    #[test]
    fn unregister_does_not_reset_an_already_cancelled_flag() {
        let id = unique_id("unregister_after_cancel");
        let flag = register(id.clone());
        cancel(&id);
        unregister(&id);
        // The orchestrator's clone still sees the cancellation
        assert!(is_cancelled(&flag));
    }

    #[test]
    fn check_returns_ok_when_not_cancelled() {
        let flag = AtomicBool::new(false);
        assert!(check(&flag).is_ok());
    }

    #[test]
    fn check_returns_err_when_cancelled() {
        let flag = AtomicBool::new(true);
        let err = check(&flag).unwrap_err();
        assert!(err.contains("cancelled"));
    }

    #[test]
    fn multiple_sessions_are_independent() {
        let a = unique_id("multi_a");
        let b = unique_id("multi_b");
        let flag_a = register(a.clone());
        let flag_b = register(b.clone());
        cancel(&a);
        assert!(is_cancelled(&flag_a));
        assert!(!is_cancelled(&flag_b));
        unregister(&a);
        unregister(&b);
    }

    #[test]
    fn re_registering_same_id_overwrites_the_flag() {
        let id = unique_id("re_register");
        let first = register(id.clone());
        let _second = register(id.clone());
        // Cancel finds the SECOND flag, not the first
        cancel(&id);
        assert!(!is_cancelled(&first));
        unregister(&id);
    }
}
