use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub deepinfra_api_key: String,
    #[serde(default)]
    pub runware_api_key: String,
    #[serde(default)]
    pub anthropic_api_key: String,
    #[serde(default)]
    pub openrouter_api_key: String,
    #[serde(default = "default_image_model")]
    pub image_model: String,
    #[serde(default = "default_enhance_model")]
    pub enhance_model: String,
    #[serde(default = "default_prompt_llm_provider")]
    pub prompt_llm_provider: String,
    #[serde(default = "default_image_provider")]
    pub image_provider: String,
    #[serde(default = "default_video_model")]
    pub video_model: String,
    #[serde(default = "default_batch_concurrency")]
    pub batch_concurrency: u32,
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
    #[serde(default)]
    pub github_pat: String,
}

fn default_image_model() -> String {
    "black-forest-labs/FLUX-1-schnell".to_string()
}

fn default_enhance_model() -> String {
    "Qwen/Qwen2.5-7B-Instruct".to_string()
}

fn default_prompt_llm_provider() -> String {
    "deepinfra".to_string()
}

fn default_image_provider() -> String {
    "deepinfra".to_string()
}

fn default_video_model() -> String {
    "runware:2".to_string()
}

fn default_batch_concurrency() -> u32 {
    5
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            deepinfra_api_key: String::new(),
            runware_api_key: String::new(),
            anthropic_api_key: String::new(),
            openrouter_api_key: String::new(),
            image_model: default_image_model(),
            enhance_model: default_enhance_model(),
            prompt_llm_provider: default_prompt_llm_provider(),
            image_provider: default_image_provider(),
            video_model: default_video_model(),
            batch_concurrency: default_batch_concurrency(),
            auto_remove_bg: false,
            r2_account_id: String::new(),
            r2_access_key_id: String::new(),
            r2_secret_access_key: String::new(),
            r2_bucket: String::new(),
            r2_custom_domain: String::new(),
            github_pat: String::new(),
        }
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join(SETTINGS_FILE))
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(Settings::default());
    }
    let data = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read settings: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse settings: {e}"))
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create settings dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| format!("Failed to write settings: {e}"))
}
