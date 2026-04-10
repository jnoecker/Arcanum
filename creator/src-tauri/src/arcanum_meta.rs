use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ArcanumMeta {
    pub wear_slot_positions: HashMap<String, SlotPosition>,
}

fn meta_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("arcanum-meta"))
}

fn project_hash(mud_dir: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(mud_dir.as_bytes());
    hex::encode(&hasher.finalize()[..16])
}

#[tauri::command]
pub async fn load_arcanum_meta(
    app: AppHandle,
    mud_dir: String,
) -> Result<ArcanumMeta, String> {
    let path = meta_dir(&app)?.join(format!("{}.json", project_hash(&mud_dir)));
    if !path.exists() {
        return Ok(ArcanumMeta::default());
    }
    let data = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read arcanum meta: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse arcanum meta: {e}"))
}

#[tauri::command]
pub async fn save_arcanum_meta(
    app: AppHandle,
    mud_dir: String,
    meta: ArcanumMeta,
) -> Result<(), String> {
    let dir = meta_dir(&app)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create arcanum-meta dir: {e}"))?;

    let path = dir.join(format!("{}.json", project_hash(&mud_dir)));
    crate::fs_utils::write_json_file(&path, &meta, "arcanum meta").await
}
