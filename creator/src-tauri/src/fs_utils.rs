use serde::Serialize;
use std::path::Path;

/// Serialize `data` as pretty-printed JSON and write it to `path`.
/// `label` is used in error messages (e.g. "admin config", "settings").
pub async fn write_json_file<T: Serialize>(
    path: &Path,
    data: &T,
    label: &str,
) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize {label}: {e}"))?;
    tokio::fs::write(path, json)
        .await
        .map_err(|e| format!("Failed to write {label}: {e}"))
}
