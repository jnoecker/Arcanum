use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const MANIFEST_FILE: &str = "manifest.json";

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
) -> Result<AssetEntry, String> {
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
    };

    let mut manifest = load_manifest(&app).await?;
    // Avoid duplicates by hash
    manifest.assets.retain(|a| a.hash != entry.hash);
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
    let mut manifest = load_manifest(&app).await?;
    let entry = manifest.assets.iter().find(|a| a.id == id).cloned();

    if let Some(entry) = &entry {
        // Delete the file
        let file_path = assets_dir(&app)?.join("images").join(&entry.file_name);
        if file_path.exists() {
            tokio::fs::remove_file(&file_path)
                .await
                .map_err(|e| format!("Failed to delete file: {e}"))?;
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
