use serde::Serialize;
use std::path::Path;

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
