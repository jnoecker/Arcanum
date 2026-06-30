use base64::Engine;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

/// Monotonic counter to guarantee temp-file uniqueness even when two atomic
/// writes inside the same process race in the same millisecond.
static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

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
///
/// On Windows, `rename` over an existing file occasionally fails with
/// `ERROR_ACCESS_DENIED (os error 5)` when antivirus or the Search Indexer
/// momentarily holds the temp file or target open. The failure is transient
/// — we retry with short backoff (≤ ~600ms total) before giving up.
pub async fn atomic_write_bytes(path: &Path, bytes: &[u8], label: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Invalid path for {label} (no parent dir): {}", path.display()))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| format!("Invalid path for {label} (no file name): {}", path.display()))?
        .to_string_lossy();
    let seq = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let tmp_path = parent.join(format!(
        ".{file_name}.tmp.{}.{}",
        std::process::id(),
        seq,
    ));

    tokio::fs::write(&tmp_path, bytes)
        .await
        .map_err(|e| format!("Failed to write {label} temp file: {e}"))?;

    const BACKOFFS_MS: &[u64] = &[20, 40, 80, 160, 320];
    let mut last_err: Option<std::io::Error> = None;
    for (attempt, delay) in std::iter::once(0u64).chain(BACKOFFS_MS.iter().copied()).enumerate() {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
        }
        match tokio::fs::rename(&tmp_path, path).await {
            Ok(()) => return Ok(()),
            Err(e) => last_err = Some(e),
        }
    }

    let _ = tokio::fs::remove_file(&tmp_path).await;
    let err = last_err.expect("rename loop always populates last_err on failure");
    Err(format!("Failed to atomically replace {label}: {err}"))
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
    Ok(bytes_to_data_url(&bytes))
}

fn bytes_to_data_url(bytes: &[u8]) -> String {
    let ext = detect_extension(bytes);
    let mime = detect_mime(ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:{mime};base64,{b64}")
}

static THUMBNAIL_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn thumbnail_cache() -> &'static Mutex<HashMap<String, String>> {
    THUMBNAIL_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Bounds how many thumbnail decodes run concurrently. A zone load fires one
/// IPC per visible room background + entity sprite all at once; without a cap
/// every one of those spawns a CPU-heavy `image::load_from_memory` + resize +
/// WebP encode on the blocking pool simultaneously, saturating every core and
/// spiking memory (each decode transiently holds a full-resolution bitmap).
/// Capping to roughly half the cores keeps the UI responsive while the queue
/// drains.
static DECODE_SEMAPHORE: OnceLock<tokio::sync::Semaphore> = OnceLock::new();

fn decode_semaphore() -> &'static tokio::sync::Semaphore {
    DECODE_SEMAPHORE.get_or_init(|| {
        let cores = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);
        tokio::sync::Semaphore::new((cores / 2).max(2))
    })
}

/// Generous upper bound; thumbnails are ~10–40 KB each, so a full cache is a
/// few tens of MB. Cleared wholesale rather than LRU-evicted — re-encoding on
/// the rare overflow is cheaper than tracking recency on every hit.
const THUMBNAIL_CACHE_MAX_ENTRIES: usize = 2048;

fn encode_thumbnail(bytes: &[u8], max_dim: u32) -> String {
    let img = match image::load_from_memory(bytes) {
        Ok(img) => img,
        // Undecodable here doesn't mean undecodable in the webview — serve
        // the original bytes, matching read_image_data_url behavior.
        Err(_) => return bytes_to_data_url(bytes),
    };
    if img.width() <= max_dim && img.height() <= max_dim {
        return bytes_to_data_url(bytes);
    }
    let thumb = img.thumbnail(max_dim, max_dim).to_rgba8();
    let (w, h) = (thumb.width(), thumb.height());
    let encoded = webp::Encoder::from_rgba(thumb.as_raw(), w, h).encode(80.0);
    format!(
        "data:image/webp;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&*encoded)
    )
}

/// Like `read_image_data_url`, but downscaled to fit within `max_dim` and
/// re-encoded as lossy WebP. Meant for map nodes and list thumbnails where
/// full-resolution art (often multi-MB PNGs) wastes decode time and GPU
/// memory. Results are cached against the file's mtime + size.
#[tauri::command]
pub async fn read_image_thumbnail_data_url(path: String, max_dim: u32) -> Result<String, String> {
    let max_dim = max_dim.clamp(16, 1024);
    let meta = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to read image: {e}"))?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let key = format!("{path}|{max_dim}|{mtime}|{}", meta.len());

    if let Some(hit) = thumbnail_cache()
        .lock()
        .expect("thumbnail cache poisoned")
        .get(&key)
    {
        return Ok(hit.clone());
    }

    // Gate the expensive decode behind the semaphore so a zone-load burst of
    // requests drains a few at a time instead of all at once. Cache hits above
    // return before reaching here, so warm images never wait on the queue.
    let _permit = decode_semaphore()
        .acquire()
        .await
        .map_err(|e| format!("Decode semaphore closed: {e}"))?;

    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read image: {e}"))?;

    let data_url = tokio::task::spawn_blocking(move || encode_thumbnail(&bytes, max_dim))
        .await
        .map_err(|e| format!("Thumbnail encode failed: {e}"))?;

    let mut cache = thumbnail_cache().lock().expect("thumbnail cache poisoned");
    if cache.len() >= THUMBNAIL_CACHE_MAX_ENTRIES {
        cache.clear();
    }
    cache.insert(key, data_url.clone());
    Ok(data_url)
}
