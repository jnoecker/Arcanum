use serde::Serialize;
use std::path::{Path, PathBuf};

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

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp"];

fn collect_images(dir: &Path, base: &Path, out: &mut Vec<LegacyImage>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_images(&path, base, out);
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if IMAGE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()) {
                let relative = path.strip_prefix(base).unwrap_or(&path);
                out.push(LegacyImage {
                    absolute_path: path.to_string_lossy().to_string(),
                    relative_path: relative.to_string_lossy().replace('\\', "/"),
                });
            }
        }
    }
}

#[derive(Serialize)]
pub struct LegacyImage {
    pub absolute_path: String,
    pub relative_path: String,
}

/// List all image files under the MUD project's resource directories.
/// Checks both src/main/resources/world/images/ and src/main/resources/images/.
#[tauri::command]
pub fn list_legacy_images(mud_dir: String) -> Vec<LegacyImage> {
    let base = PathBuf::from(&mud_dir).join("src/main/resources");
    let candidates = [
        base.join("world/images"),
        base.join("images"),
    ];
    let mut results = Vec::new();
    for dir in &candidates {
        if dir.is_dir() {
            collect_images(dir, dir, &mut results);
        }
    }
    results
}
