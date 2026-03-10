use base64::Engine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::LazyLock;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

const MANIFEST_FILE: &str = "manifest.json";

/// Global mutex to prevent concurrent manifest read-modify-write corruption.
static MANIFEST_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetEntry {
    pub id: String,
    pub hash: String,
    pub prompt: String,
    #[serde(default)]
    pub enhanced_prompt: String,
    pub model: String,
    pub asset_type: String,
    #[serde(default)]
    pub context: AssetContext,
    pub created_at: DateTime<Utc>,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    #[serde(default = "default_sync_status")]
    pub sync_status: String,
    #[serde(default)]
    pub variant_group: String,
    #[serde(default)]
    pub is_active: bool,
}

fn default_sync_status() -> String {
    "local".to_string()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AssetContext {
    #[serde(default)]
    pub zone: String,
    #[serde(default)]
    pub entity_type: String,
    #[serde(default)]
    pub entity_id: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Manifest {
    assets: Vec<AssetEntry>,
}

fn assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("assets"))
}

fn manifest_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(assets_dir(app)?.join(MANIFEST_FILE))
}

async fn load_manifest(app: &AppHandle) -> Result<Manifest, String> {
    let path = manifest_path(app)?;
    if !path.exists() {
        return Ok(Manifest::default());
    }
    let data = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read manifest: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse manifest: {e}"))
}

async fn save_manifest(app: &AppHandle, manifest: &Manifest) -> Result<(), String> {
    let path = manifest_path(app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create assets dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Failed to serialize manifest: {e}"))?;
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| format!("Failed to write manifest: {e}"))
}

#[tauri::command]
pub async fn accept_asset(
    app: AppHandle,
    id: String,
    hash: String,
    prompt: String,
    enhanced_prompt: Option<String>,
    model: String,
    asset_type: String,
    context: Option<AssetContext>,
    file_name: String,
    width: u32,
    height: u32,
    variant_group: Option<String>,
    is_active: Option<bool>,
) -> Result<AssetEntry, String> {
    let vg = variant_group.unwrap_or_default();
    let active = is_active.unwrap_or(false);

    let entry = AssetEntry {
        id,
        hash,
        prompt,
        enhanced_prompt: enhanced_prompt.unwrap_or_default(),
        model,
        asset_type,
        context: context.unwrap_or_default(),
        created_at: Utc::now(),
        file_name,
        width,
        height,
        sync_status: "local".to_string(),
        variant_group: vg.clone(),
        is_active: active,
    };

    let _lock = MANIFEST_LOCK.lock().await;
    let mut manifest = load_manifest(&app).await?;
    // Avoid duplicates by hash
    manifest.assets.retain(|a| a.hash != entry.hash);
    // If setting as active, deactivate other variants in the same group
    if active && !vg.is_empty() {
        for a in manifest.assets.iter_mut() {
            if a.variant_group == vg {
                a.is_active = false;
            }
        }
    }
    manifest.assets.push(entry.clone());
    save_manifest(&app, &manifest).await?;

    Ok(entry)
}

#[tauri::command]
pub async fn list_assets(app: AppHandle) -> Result<Vec<AssetEntry>, String> {
    let manifest = load_manifest(&app).await?;
    Ok(manifest.assets)
}

#[tauri::command]
pub async fn delete_asset(app: AppHandle, id: String) -> Result<(), String> {
    let _lock = MANIFEST_LOCK.lock().await;
    let mut manifest = load_manifest(&app).await?;
    let entry = manifest.assets.iter().find(|a| a.id == id).cloned();

    if let Some(entry) = &entry {
        // Delete the file — check all subdirectories
        let base = assets_dir(&app)?;
        for subdir in &["images", "video", "audio"] {
            let file_path = base.join(subdir).join(&entry.file_name);
            if file_path.exists() {
                tokio::fs::remove_file(&file_path)
                    .await
                    .map_err(|e| format!("Failed to delete file: {e}"))?;
                break;
            }
        }
    }

    manifest.assets.retain(|a| a.id != id);
    save_manifest(&app, &manifest).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_assets_dir(app: AppHandle) -> Result<String, String> {
    let dir = assets_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

/// Resolve a media asset filename to its absolute local path.
/// Searches images/, video/, and audio/ subdirectories.
#[tauri::command]
pub async fn resolve_media_path(app: AppHandle, file_name: String) -> Result<String, String> {
    let base = assets_dir(&app)?;
    for subdir in &["images", "video", "audio"] {
        let path = base.join(subdir).join(&file_name);
        if path.exists() {
            return Ok(path.to_string_lossy().to_string());
        }
    }
    Err(format!("Asset file not found: {file_name}"))
}

/// Update the sync_status of an asset by ID. Called from r2 module.
/// Update sync_status for a single asset. NOT locked — callers that
/// invoke this in a loop (e.g. sync_assets) must ensure serialization
/// themselves or accept that concurrent writes may lose updates.
pub async fn update_sync_status(app: AppHandle, id: &str, status: &str) -> Result<(), String> {
    let mut manifest = load_manifest(&app).await?;
    if let Some(entry) = manifest.assets.iter_mut().find(|a| a.id == id) {
        entry.sync_status = status.to_string();
    }
    save_manifest(&app, &manifest).await
}

fn detect_extension(bytes: &[u8]) -> &'static str {
    // Images
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if bytes.starts_with(b"RIFF") && bytes.len() > 12 && &bytes[8..12] == b"WEBP" {
        "webp"
    // Video
    } else if bytes.len() > 12 && &bytes[4..8] == b"ftyp" {
        "mp4"
    } else if bytes.starts_with(b"\x1a\x45\xdf\xa3") {
        "webm"
    // Audio
    } else if bytes.starts_with(b"OggS") {
        "ogg"
    } else if bytes.starts_with(b"ID3") || (bytes.len() >= 2 && bytes[0] == 0xFF && (bytes[1] & 0xE0) == 0xE0) {
        "mp3"
    } else if bytes.starts_with(b"fLaC") {
        "flac"
    } else if bytes.starts_with(b"RIFF") && bytes.len() > 12 && &bytes[8..12] == b"WAVE" {
        "wav"
    } else {
        "bin"
    }
}

fn extension_from_path(path: &str) -> Option<&str> {
    std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
}

fn mime_from_ext(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "wav" => "audio/wav",
        _ => "application/octet-stream",
    }
}

/// Read any media file from disk and return it as a data URL.
/// Works for images, audio, and video.
#[tauri::command]
pub async fn read_media_data_url(path: String) -> Result<String, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read file: {e}"))?;

    let detected = detect_extension(&bytes);
    let ext = if detected == "bin" {
        extension_from_path(&path).unwrap_or("bin")
    } else {
        detected
    };
    let mime = mime_from_ext(ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

/// Determine the storage subdirectory for an asset based on its extension.
fn media_subdir(ext: &str) -> &'static str {
    match ext {
        "mp4" | "webm" => "video",
        "mp3" | "ogg" | "flac" | "wav" => "audio",
        _ => "images",
    }
}

/// Import an existing file from disk into the asset library.
/// Works for images, audio, and video files.
#[tauri::command]
pub async fn import_asset(
    app: AppHandle,
    source_path: String,
    asset_type: String,
    context: Option<AssetContext>,
) -> Result<AssetEntry, String> {
    let bytes = tokio::fs::read(&source_path)
        .await
        .map_err(|e| format!("Failed to read source file: {e}"))?;

    // Content-addressed hash
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    // Determine extension — prefer magic bytes, fall back to source extension
    let detected = detect_extension(&bytes);
    let ext = if detected == "bin" {
        extension_from_path(&source_path).unwrap_or("bin")
    } else {
        detected
    };
    let file_name = format!("{hash}.{ext}");

    // Read dimensions from image header (0x0 for non-image files)
    let (width, height) = match imagesize::blob_size(&bytes) {
        Ok(size) => (size.width as u32, size.height as u32),
        Err(_) => (0, 0),
    };

    // Copy to assets/<subdir>
    let subdir = media_subdir(ext);
    let dest_dir = assets_dir(&app)?.join(subdir);
    tokio::fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| format!("Failed to create {subdir} dir: {e}"))?;

    let dest = dest_dir.join(&file_name);
    if !dest.exists() {
        tokio::fs::copy(&source_path, &dest)
            .await
            .map_err(|e| format!("Failed to copy file: {e}"))?;
    }

    // Extract original filename for the prompt field
    let original_name = std::path::Path::new(&source_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let entry = AssetEntry {
        id: uuid::Uuid::new_v4().to_string(),
        hash,
        prompt: format!("Imported: {original_name}"),
        enhanced_prompt: String::new(),
        model: "imported".to_string(),
        asset_type,
        context: context.unwrap_or_default(),
        created_at: Utc::now(),
        file_name,
        width,
        height,
        sync_status: "local".to_string(),
        variant_group: String::new(),
        is_active: false,
    };

    let _lock = MANIFEST_LOCK.lock().await;
    let mut manifest = load_manifest(&app).await?;
    // Dedup by hash — update existing entry if same content
    manifest.assets.retain(|a| a.hash != entry.hash);
    manifest.assets.push(entry.clone());
    save_manifest(&app, &manifest).await?;

    Ok(entry)
}

#[tauri::command]
pub async fn set_active_variant(
    app: AppHandle,
    variant_group: String,
    asset_id: String,
) -> Result<(), String> {
    let _lock = MANIFEST_LOCK.lock().await;
    let mut manifest = load_manifest(&app).await?;
    for a in manifest.assets.iter_mut() {
        if a.variant_group == variant_group {
            a.is_active = a.id == asset_id;
        }
    }
    save_manifest(&app, &manifest).await
}

#[tauri::command]
pub async fn list_variants(
    app: AppHandle,
    variant_group: String,
) -> Result<Vec<AssetEntry>, String> {
    let manifest = load_manifest(&app).await?;
    Ok(manifest
        .assets
        .into_iter()
        .filter(|a| a.variant_group == variant_group)
        .collect())
}

#[tauri::command]
pub async fn save_bytes_as_asset(
    app: AppHandle,
    bytes_b64: String,
    asset_type: String,
    context: Option<AssetContext>,
    variant_group: Option<String>,
) -> Result<AssetEntry, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&bytes_b64)
        .map_err(|e| format!("Failed to decode base64: {e}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    let detected = detect_extension(&bytes);
    let ext = if detected == "bin" { "png" } else { detected };
    let file_name = format!("{hash}.{ext}");

    let (width, height) = match imagesize::blob_size(&bytes) {
        Ok(size) => (size.width as u32, size.height as u32),
        Err(_) => (0, 0),
    };

    let subdir = media_subdir(ext);
    let dest_dir = assets_dir(&app)?.join(subdir);
    tokio::fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| format!("Failed to create {subdir} dir: {e}"))?;

    let dest = dest_dir.join(&file_name);
    if !dest.exists() {
        tokio::fs::write(&dest, &bytes)
            .await
            .map_err(|e| format!("Failed to write file: {e}"))?;
    }

    let entry = AssetEntry {
        id: uuid::Uuid::new_v4().to_string(),
        hash,
        prompt: "Background removed".to_string(),
        enhanced_prompt: String::new(),
        model: "bg-removal".to_string(),
        asset_type,
        context: context.unwrap_or_default(),
        created_at: Utc::now(),
        file_name,
        width,
        height,
        sync_status: "local".to_string(),
        variant_group: variant_group.unwrap_or_default(),
        is_active: false,
    };

    let _lock = MANIFEST_LOCK.lock().await;
    let mut manifest = load_manifest(&app).await?;
    manifest.assets.retain(|a| a.hash != entry.hash);
    manifest.assets.push(entry.clone());
    save_manifest(&app, &manifest).await?;

    Ok(entry)
}

/// Import result for bulk sprite import.
#[derive(Debug, Default, Serialize)]
pub struct SpriteImportResult {
    pub imported: u32,
    pub retagged: u32,
    pub skipped: u32,
    pub errors: Vec<String>,
}

/// Bulk-import player sprites from a directory export structure.
///
/// Expected format uses directories like:
///   `{source_dir}/player_sprites/player_sprites_{race}_{class}_l{tier}/v1.png`
///
/// Each sprite is imported into the asset library with a variant_group of
/// `player_sprite:{race}_{class}_l{tier}` for management.
#[tauri::command]
pub async fn import_player_sprites(
    app: AppHandle,
    source_dir: String,
) -> Result<SpriteImportResult, String> {
    let sprites_dir = std::path::Path::new(&source_dir);
    if !sprites_dir.is_dir() {
        return Err(format!("Directory not found: {source_dir}"));
    }

    let mut result = SpriteImportResult::default();
    let _lock = MANIFEST_LOCK.lock().await;
    let mut manifest = load_manifest(&app).await?;
    let images_dir = assets_dir(&app)?.join("images");
    tokio::fs::create_dir_all(&images_dir)
        .await
        .map_err(|e| format!("Failed to create images dir: {e}"))?;

    let entries = std::fs::read_dir(sprites_dir)
        .map_err(|e| format!("Failed to read directory: {e}"))?;

    for entry in entries.flatten() {
        let dir_name = entry.file_name().to_string_lossy().to_string();

        // Match directories like player_sprites_{race}_{gender}_{class}_l{tier}
        let sprite_key = match dir_name.strip_prefix("player_sprites_") {
            Some(k) if k.contains('_') && k.contains("_l") => k,
            _ => continue, // skip non-sprite dirs like "entrance", "apprentice_hall", etc.
        };

        let subdir = entry.path();
        if !subdir.is_dir() {
            continue;
        }

        // Find the image file inside (v1.png, v1.jpg, etc.)
        let image_file = std::fs::read_dir(&subdir)
            .ok()
            .and_then(|mut r| r.find_map(|e| {
                let e = e.ok()?;
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with("v1.") {
                    Some(e.path())
                } else {
                    None
                }
            }));

        let image_path = match image_file {
            Some(p) => p,
            None => {
                result.errors.push(format!("No v1.* image in {dir_name}"));
                continue;
            }
        };

        // Read the image
        let bytes = match std::fs::read(&image_path) {
            Ok(b) => b,
            Err(e) => {
                result.errors.push(format!("Failed to read {dir_name}: {e}"));
                continue;
            }
        };

        // Content-addressed hash
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let hash = format!("{:x}", hasher.finalize());

        let variant_group = format!("player_sprite:{sprite_key}");

        // Check if already in manifest by hash
        if let Some(existing) = manifest.assets.iter_mut().find(|a| a.hash == hash) {
            // Already tagged correctly — skip
            if existing.asset_type == "player_sprite" && existing.variant_group == variant_group {
                result.skipped += 1;
                continue;
            }
            // Re-tag the existing asset with sprite metadata
            existing.asset_type = "player_sprite".to_string();
            existing.variant_group = variant_group;
            existing.is_active = true;
            existing.context = AssetContext {
                zone: String::new(),
                entity_type: "player_sprite".to_string(),
                entity_id: sprite_key.to_string(),
            };
            existing.prompt = format!("Player sprite: {}", sprite_key.replace('_', " "));
            result.retagged += 1;
            continue;
        }

        let detected = detect_extension(&bytes);
        let ext = if detected == "bin" {
            extension_from_path(image_path.to_str().unwrap_or("")).unwrap_or("png")
        } else {
            detected
        };
        let file_name = format!("{hash}.{ext}");

        let (width, height) = match imagesize::blob_size(&bytes) {
            Ok(size) => (size.width as u32, size.height as u32),
            Err(_) => (0, 0),
        };

        // Copy to assets/images/
        let dest = images_dir.join(&file_name);
        if !dest.exists() {
            if let Err(e) = std::fs::copy(&image_path, &dest) {
                result.errors.push(format!("Failed to copy {dir_name}: {e}"));
                continue;
            }
        }

        let entry = AssetEntry {
            id: uuid::Uuid::new_v4().to_string(),
            hash,
            prompt: format!("Player sprite: {}", sprite_key.replace('_', " ")),
            enhanced_prompt: String::new(),
            model: "imported".to_string(),
            asset_type: "player_sprite".to_string(),
            context: AssetContext {
                zone: String::new(),
                entity_type: "player_sprite".to_string(),
                entity_id: sprite_key.to_string(),
            },
            created_at: Utc::now(),
            file_name,
            width,
            height,
            sync_status: "local".to_string(),
            variant_group,
            is_active: true,
        };

        manifest.assets.push(entry);
        result.imported += 1;
    }

    save_manifest(&app, &manifest).await?;
    Ok(result)
}
