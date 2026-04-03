use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const PROJECT_SETTINGS_FILE: &str = ".arcanum/settings.json";

/// Project-level settings stored in `<project_dir>/.arcanum/settings.json`.
/// These override the corresponding fields from user-level settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectSettings {
    #[serde(default)]
    pub image_model: String,
    #[serde(default)]
    pub enhance_model: String,
    #[serde(default)]
    pub prompt_llm_provider: String,
    #[serde(default)]
    pub image_provider: String,
    #[serde(default)]
    pub video_model: String,
    #[serde(default)]
    pub batch_concurrency: u32,
    #[serde(default)]
    pub auto_enhance_prompts: bool,
    #[serde(default)]
    pub auto_remove_bg: bool,
    #[serde(default)]
    pub r2_account_id: String,
    #[serde(default)]
    pub r2_access_key_id: String,
    #[serde(default)]
    pub r2_secret_access_key: String,
    #[serde(default)]
    pub r2_bucket: String,
    #[serde(default)]
    pub r2_custom_domain: String,
}

pub fn project_settings_path(project_dir: &str) -> PathBuf {
    Path::new(project_dir).join(PROJECT_SETTINGS_FILE)
}

#[tauri::command]
pub async fn get_project_settings(project_dir: String) -> Result<Option<ProjectSettings>, String> {
    let path = project_settings_path(&project_dir);
    if !path.exists() {
        return Ok(None);
    }
    let data = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read project settings: {e}"))?;
    let ps: ProjectSettings =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse project settings: {e}"))?;
    Ok(Some(ps))
}

#[tauri::command]
pub async fn save_project_settings(
    project_dir: String,
    settings: ProjectSettings,
) -> Result<(), String> {
    let path = project_settings_path(&project_dir);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create .arcanum dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize project settings: {e}"))?;
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| format!("Failed to write project settings: {e}"))
}

/// Seed project settings from the current user settings.
/// Called when opening a project that doesn't have project settings yet.
#[tauri::command]
pub async fn seed_project_settings(
    project_dir: String,
    user_settings: crate::settings::Settings,
) -> Result<ProjectSettings, String> {
    let ps = ProjectSettings {
        image_model: user_settings.image_model,
        enhance_model: user_settings.enhance_model,
        prompt_llm_provider: user_settings.prompt_llm_provider,
        image_provider: user_settings.image_provider,
        video_model: user_settings.video_model,
        batch_concurrency: user_settings.batch_concurrency,
        auto_enhance_prompts: user_settings.auto_enhance_prompts,
        auto_remove_bg: user_settings.auto_remove_bg,
        r2_account_id: user_settings.r2_account_id,
        r2_access_key_id: user_settings.r2_access_key_id,
        r2_secret_access_key: user_settings.r2_secret_access_key,
        r2_bucket: user_settings.r2_bucket,
        r2_custom_domain: user_settings.r2_custom_domain,
    };
    save_project_settings(project_dir, ps.clone()).await?;
    Ok(ps)
}
