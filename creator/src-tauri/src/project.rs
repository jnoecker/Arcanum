use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::process::Command;

#[derive(Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub gradle_wrapper: String,
}

/// Validates that a directory looks like an AmbonMUD project checkout.
/// Checks for gradlew/gradlew.bat, src/main/resources/world/, and application.yaml.
#[tauri::command]
pub fn validate_mud_dir(path: String) -> ValidationResult {
    let root = Path::new(&path);
    let mut errors = Vec::new();

    // Check for gradle wrapper
    let gradlew = if cfg!(windows) {
        "gradlew.bat"
    } else {
        "gradlew"
    };
    let gradle_path = root.join(gradlew);
    if !gradle_path.exists() {
        errors.push(format!("Missing {gradlew} in project root"));
    }

    // Check for world directory
    let world_dir = root.join("src/main/resources/world");
    if !world_dir.exists() || !world_dir.is_dir() {
        errors.push("Missing src/main/resources/world/ directory".to_string());
    }

    // Check for application.yaml
    let app_yaml = root.join("src/main/resources/application.yaml");
    if !app_yaml.exists() {
        errors.push("Missing src/main/resources/application.yaml".to_string());
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
        gradle_wrapper: gradle_path.to_string_lossy().to_string(),
    }
}

const MEDIA_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp",
    "mp4", "webm",
    "mp3", "ogg", "flac", "wav",
];

fn collect_media(dir: &Path, base: &Path, out: &mut Vec<LegacyMedia>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_media(&path, base, out);
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if MEDIA_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()) {
                let relative = path.strip_prefix(base).unwrap_or(&path);
                out.push(LegacyMedia {
                    absolute_path: path.to_string_lossy().to_string(),
                    relative_path: relative.to_string_lossy().replace('\\', "/"),
                });
            }
        }
    }
}

#[derive(Serialize)]
pub struct LegacyMedia {
    pub absolute_path: String,
    pub relative_path: String,
}

/// List all image files under the MUD project's resource directories.
/// Checks both src/main/resources/world/images/ and src/main/resources/images/.
#[tauri::command]
pub fn list_legacy_images(mud_dir: String) -> Vec<LegacyMedia> {
    let base = PathBuf::from(&mud_dir).join("src/main/resources");
    let candidates = [
        base.join("world/images"),
        base.join("images"),
    ];
    let mut results = Vec::new();
    for dir in &candidates {
        if dir.is_dir() {
            collect_media(dir, dir, &mut results);
        }
    }
    results
}

/// List all media files (images, audio, video) under the MUD project's resource directories.
#[tauri::command]
pub fn list_legacy_media(mud_dir: String) -> Vec<LegacyMedia> {
    let base = PathBuf::from(&mud_dir).join("src/main/resources");
    let candidates = [
        "world/images", "images",
        "world/audio", "audio",
        "world/video", "video",
    ];
    let mut results = Vec::new();
    for subdir in &candidates {
        let dir = base.join(subdir);
        if dir.is_dir() {
            collect_media(&dir, &dir, &mut results);
        }
    }
    results
}

// ─── R2 Migration ──────────────────────────────────────────────────

#[derive(Debug, Default, Deserialize)]
struct Manifest {
    assets: Vec<ManifestEntry>,
}

#[derive(Debug, Deserialize)]
struct ManifestEntry {
    hash: String,
    file_name: String,
}

#[derive(Debug, Default, Serialize)]
pub struct MigrationReport {
    pub zone_files_updated: usize,
    pub zone_refs_rewritten: usize,
    pub config_refs_rewritten: usize,
    pub images_deleted: usize,
    pub errors: Vec<String>,
}

/// Build a map from content SHA-256 hash to the R2 filename (hash.ext).
fn load_hash_map(app: &tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let manifest_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?
        .join("assets")
        .join("manifest.json");

    if !manifest_path.exists() {
        return Err("Asset manifest not found. Import images first.".to_string());
    }

    let data =
        std::fs::read_to_string(&manifest_path).map_err(|e| format!("Read manifest: {e}"))?;
    let manifest: Manifest =
        serde_json::from_str(&data).map_err(|e| format!("Parse manifest: {e}"))?;

    let mut map = HashMap::new();
    for entry in manifest.assets {
        map.insert(entry.hash, entry.file_name);
    }
    Ok(map)
}

/// Hash a file and look up the R2 filename in the manifest.
fn resolve_to_r2(path: &Path, hash_map: &HashMap<String, String>) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    let hash = format!("{:x}", Sha256::digest(&bytes));
    hash_map.get(&hash).cloned()
}

/// Find the local file for a legacy media path.
/// Tries world/images/, images/, world/audio/, audio/, world/video/, and video/ directories.
fn find_media_file(relative_path: &str, resources: &Path) -> Option<PathBuf> {
    let prefixes = ["world/images", "images", "world/audio", "audio", "world/video", "video"];
    for prefix in &prefixes {
        let path = resources.join(prefix).join(relative_path);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

/// Rewrite media references in a YAML string.
/// Scans for `image:`, `video:`, `music:`, `ambient:`, and `audio:` keys
/// and replaces legacy relative paths with R2 hash filenames.
/// Returns the updated content and the count of replacements made.
fn rewrite_yaml_media(
    content: &str,
    resources: &Path,
    hash_map: &HashMap<String, String>,
    errors: &mut Vec<String>,
    file_label: &str,
) -> (String, usize) {
    use regex::Regex;
    let re = Regex::new(r#"(?m)^(\s*(?:image|video|music|ambient|audio):\s*)(?:"([^"]+)"|'([^']+)'|(\S+))\s*$"#).unwrap();

    let mut count = 0;
    let result = re
        .replace_all(content, |caps: &regex::Captures| {
            let prefix = &caps[1];
            let path = caps
                .get(2)
                .or_else(|| caps.get(3))
                .or_else(|| caps.get(4))
                .map(|m| m.as_str())
                .unwrap_or("");

            // Skip if already a hash filename (64 hex chars + ext)
            if path.len() > 60 && !path.contains('/') {
                return caps[0].to_string();
            }

            // For ability paths like /images/abilities/power_strike.png, strip prefix
            let relative = path
                .strip_prefix("/images/")
                .unwrap_or(path);

            if let Some(file_path) = find_media_file(relative, resources) {
                if let Some(r2_name) = resolve_to_r2(&file_path, hash_map) {
                    count += 1;
                    return format!("{prefix}{r2_name}");
                }
                errors.push(format!(
                    "{file_label}: image '{path}' not found in asset manifest"
                ));
            } else {
                errors.push(format!(
                    "{file_label}: image file not found for '{path}'"
                ));
            }
            caps[0].to_string()
        })
        .to_string();

    (result, count)
}

/// Recursively delete a directory.
fn remove_dir_all_best_effort(dir: &Path) -> usize {
    let mut count = 0;
    if !dir.exists() {
        return count;
    }
    for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        let path = entry.path();
        if path.is_dir() {
            count += remove_dir_all_best_effort(&path);
        } else {
            if std::fs::remove_file(&path).is_ok() {
                count += 1;
            }
        }
    }
    let _ = std::fs::remove_dir(dir);
    count
}

/// Migrate all image references from legacy relative paths to R2 hash filenames.
/// Rewrites zone YAMLs and application.yaml, then deletes local image directories.
#[tauri::command]
pub fn migrate_images_to_r2(
    app: tauri::AppHandle,
    mud_dir: String,
) -> Result<MigrationReport, String> {
    let hash_map = load_hash_map(&app)?;
    if hash_map.is_empty() {
        return Err("Asset manifest is empty. Import and sync images first.".to_string());
    }

    let resources = PathBuf::from(&mud_dir).join("src/main/resources");
    let world_dir = resources.join("world");
    let config_path = resources.join("application.yaml");

    let mut report = MigrationReport::default();

    // ─── Rewrite zone YAMLs ────────────────────────────────────
    if let Ok(entries) = std::fs::read_dir(&world_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();
            if !name.ends_with(".yaml") && !name.ends_with(".yml") {
                continue;
            }

            let content = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(e) => {
                    report
                        .errors
                        .push(format!("Failed to read {name}: {e}"));
                    continue;
                }
            };

            let (updated, count) =
                rewrite_yaml_media(&content, &resources, &hash_map, &mut report.errors, name);
            if count > 0 {
                if let Err(e) = std::fs::write(&path, &updated) {
                    report
                        .errors
                        .push(format!("Failed to write {name}: {e}"));
                } else {
                    report.zone_files_updated += 1;
                    report.zone_refs_rewritten += count;
                }
            }
        }
    }

    // ─── Rewrite application.yaml ability images ───────────────
    if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read application.yaml: {e}"))?;

        let (updated, count) = rewrite_yaml_media(
            &content,
            &resources,
            &hash_map,
            &mut report.errors,
            "application.yaml",
        );
        if count > 0 {
            std::fs::write(&config_path, &updated)
                .map_err(|e| format!("Failed to write application.yaml: {e}"))?;
            report.config_refs_rewritten = count;
        }
    }

    // ─── Delete local media directories ─────────────────────────
    for subdir in &["world/images", "images", "world/audio", "audio", "world/video", "video"] {
        report.images_deleted += remove_dir_all_best_effort(&resources.join(subdir));
    }

    Ok(report)
}

// ─── Standalone Project Support ──────────────────────────────────────

#[derive(Serialize)]
pub struct ProjectValidation {
    pub valid: bool,
    pub format: String,
    pub errors: Vec<String>,
}

/// Auto-detect project format and validate the directory.
/// Returns format "standalone" if config/ + zones/ exist,
/// "legacy" if gradlew + src/main/resources/ exist.
#[tauri::command]
pub fn validate_project(path: String) -> ProjectValidation {
    let root = Path::new(&path);

    let has_config_dir = root.join("config").is_dir();
    let has_zones_dir = root.join("zones").is_dir();
    let has_gradlew = root.join("gradlew").exists() || root.join("gradlew.bat").exists();
    let has_resources = root.join("src/main/resources/world").is_dir()
        && root.join("src/main/resources/application.yaml").exists();

    if has_config_dir && has_zones_dir {
        ProjectValidation {
            valid: true,
            format: "standalone".to_string(),
            errors: vec![],
        }
    } else if has_gradlew && has_resources {
        ProjectValidation {
            valid: true,
            format: "legacy".to_string(),
            errors: vec![],
        }
    } else {
        let mut errors = Vec::new();
        if !has_config_dir && !has_resources {
            errors.push("Not a valid project: missing config/ directory (standalone) or src/main/resources/ (legacy)".to_string());
        }
        if !has_zones_dir && !has_resources {
            errors.push("Not a valid project: missing zones/ directory (standalone) or src/main/resources/world/ (legacy)".to_string());
        }
        ProjectValidation {
            valid: false,
            format: String::new(),
            errors,
        }
    }
}

/// Create a new standalone world project directory.
/// Creates config/ and zones/ subdirectories.
#[tauri::command]
pub async fn create_standalone_project(
    target_dir: String,
    project_name: String,
) -> Result<String, String> {
    let target = PathBuf::from(&target_dir).join(&project_name);
    if target.exists() {
        return Err(format!(
            "Directory already exists: {}",
            target.to_string_lossy()
        ));
    }

    tokio::fs::create_dir_all(target.join("config"))
        .await
        .map_err(|e| format!("Failed to create config/: {e}"))?;
    tokio::fs::create_dir_all(target.join("zones"))
        .await
        .map_err(|e| format!("Failed to create zones/: {e}"))?;

    Ok(target.to_string_lossy().to_string())
}

/// Create a zone directory with an assets subdirectory (standalone format).
#[tauri::command]
pub async fn create_zone_directory(
    project_dir: String,
    zone_id: String,
) -> Result<String, String> {
    let zone_dir = PathBuf::from(&project_dir).join("zones").join(&zone_id);
    if zone_dir.exists() {
        return Err(format!("Zone directory already exists: {zone_id}"));
    }

    tokio::fs::create_dir_all(zone_dir.join("assets"))
        .await
        .map_err(|e| format!("Failed to create zone directory: {e}"))?;

    Ok(zone_dir.to_string_lossy().to_string())
}

/// Delete a standalone zone directory (zone/ + assets/).
#[tauri::command]
pub async fn delete_zone_directory(
    project_dir: String,
    zone_id: String,
) -> Result<(), String> {
    let zone_dir = PathBuf::from(&project_dir).join("zones").join(&zone_id);
    if !zone_dir.exists() {
        return Err(format!("Zone directory not found: {zone_id}"));
    }
    tokio::fs::remove_dir_all(&zone_dir)
        .await
        .map_err(|e| format!("Failed to delete zone directory: {e}"))
}

// ─── New Project Commands ────────────────────────────────────────────

/// Check if git is installed and return the version string.
#[tauri::command]
pub async fn check_git_installed() -> Result<String, String> {
    let output = Command::new("git")
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Git is not installed or not in PATH: {e}"))?;

    if !output.status.success() {
        return Err("Git command failed".to_string());
    }

    String::from_utf8(output.stdout)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("Failed to parse git version: {e}"))
}

/// Clone the AmbonMUD repository into `{target_dir}/{project_name}`.
#[tauri::command]
pub async fn clone_mud_project(
    target_dir: String,
    project_name: String,
) -> Result<String, String> {
    let target = PathBuf::from(&target_dir).join(&project_name);
    if target.exists() {
        return Err(format!(
            "Directory already exists: {}",
            target.to_string_lossy()
        ));
    }

    let output = Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            "https://github.com/jnoecker/AmbonMUD.git",
            &project_name,
        ])
        .current_dir(&target_dir)
        .output()
        .await
        .map_err(|e| format!("Failed to run git clone: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {stderr}"));
    }

    Ok(target.to_string_lossy().to_string())
}

/// Delete all zone YAML files from the world directory.
/// Returns the count of deleted files.
#[tauri::command]
pub async fn clear_world_zones(mud_dir: String) -> Result<u32, String> {
    let world_dir = PathBuf::from(&mud_dir).join("src/main/resources/world");
    if !world_dir.exists() {
        return Ok(0);
    }

    let mut count = 0u32;
    let entries = std::fs::read_dir(&world_dir)
        .map_err(|e| format!("Failed to read world directory: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        if name.ends_with(".yaml") || name.ends_with(".yml") {
            if std::fs::remove_file(&path).is_ok() {
                count += 1;
            }
        }
    }

    Ok(count)
}

/// Rename a zone on disk.
///
/// For standalone projects, renames `zones/{old_id}/` to `zones/{new_id}/` and
/// returns the path to the renamed `zone.yaml` inside it.
///
/// For legacy projects, renames `{old_id}.yaml` to `{new_id}.yaml` inside the
/// world directory (derived from `old_file_path`'s parent) and returns the new
/// file path.
///
/// Refuses to rename if a zone with `new_id` already exists at the destination.
#[tauri::command]
pub async fn rename_zone(
    project_dir: String,
    project_format: String,
    old_id: String,
    new_id: String,
    old_file_path: String,
) -> Result<String, String> {
    if new_id.trim().is_empty() {
        return Err("New zone id must not be empty".to_string());
    }
    if old_id == new_id {
        return Err("New zone id must differ from the old id".to_string());
    }

    if project_format == "standalone" {
        let zones_root = PathBuf::from(&project_dir).join("zones");
        let old_dir = zones_root.join(&old_id);
        let new_dir = zones_root.join(&new_id);

        if !old_dir.exists() {
            return Err(format!("Zone directory not found: {old_id}"));
        }
        if new_dir.exists() {
            return Err(format!("Zone directory already exists: {new_id}"));
        }

        tokio::fs::rename(&old_dir, &new_dir)
            .await
            .map_err(|e| format!("Failed to rename zone directory: {e}"))?;

        Ok(new_dir
            .join("zone.yaml")
            .to_string_lossy()
            .to_string())
    } else {
        // Legacy format: rename `{old_id}.yaml` → `{new_id}.yaml` in the same
        // directory as `old_file_path`.
        let old_path = PathBuf::from(&old_file_path);
        let parent = old_path
            .parent()
            .ok_or_else(|| "Old zone file has no parent directory".to_string())?;
        let new_path = parent.join(format!("{new_id}.yaml"));

        if !old_path.exists() {
            return Err(format!("Zone file not found: {old_file_path}"));
        }
        if new_path.exists() {
            return Err(format!(
                "Zone file already exists: {}",
                new_path.to_string_lossy()
            ));
        }

        tokio::fs::rename(&old_path, &new_path)
            .await
            .map_err(|e| format!("Failed to rename zone file: {e}"))?;

        Ok(new_path.to_string_lossy().to_string())
    }
}

/// Delete a single zone file.
#[tauri::command]
pub async fn delete_zone_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {file_path}"));
    }
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete {file_path}: {e}"))
}

/// Read an arbitrary text file from disk (used for document import).
#[tauri::command]
pub async fn read_text_file(file_path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read {file_path}: {e}"))
}
