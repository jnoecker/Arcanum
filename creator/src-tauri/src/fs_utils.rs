use base64::Engine;
use serde::Serialize;
use std::path::Path;

/// Serialize `data` as pretty-printed JSON and write it to `path` atomically.
/// `label` is used in error messages (e.g. "admin config", "settings").
///
/// Writes to a same-directory temp file then renames over the target so a
/// crash, power loss, or force-quit mid-write can never leave the JSON file
/// truncated (which would make the next load fail with "EOF while parsing").
pub async fn write_json_file<T: Serialize>(
    path: &Path,
    data: &T,
    label: &str,
) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize {label}: {e}"))?;
    atomic_write_bytes(path, json.as_bytes(), label).await
}

/// Write `bytes` to `path` atomically: temp file in the same directory,
/// then rename over the target. Same-dir rename is atomic on NTFS and POSIX.
pub async fn atomic_write_bytes(path: &Path, bytes: &[u8], label: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Invalid path for {label} (no parent dir): {}", path.display()))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| format!("Invalid path for {label} (no file name): {}", path.display()))?
        .to_string_lossy();
    let tmp_path = parent.join(format!(
        ".{file_name}.tmp.{}",
        std::process::id(),
    ));

    tokio::fs::write(&tmp_path, bytes)
        .await
        .map_err(|e| format!("Failed to write {label} temp file: {e}"))?;

    if let Err(e) = tokio::fs::rename(&tmp_path, path).await {
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return Err(format!("Failed to atomically replace {label}: {e}"));
    }
    Ok(())
}

pub fn detect_extension(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if bytes.starts_with(b"RIFF") && bytes.len() > 12 && &bytes[8..12] == b"WEBP" {
        "webp"
    } else {
        "png"
    }
}

pub fn detect_mime(ext: &str) -> &'static str {
    match ext {
        "jpg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

#[tauri::command]
pub async fn read_image_data_url(path: String) -> Result<String, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read image: {e}"))?;

    let ext = detect_extension(&bytes);
    let mime = detect_mime(ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}
