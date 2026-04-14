use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use tokio::sync::RwLock;

const PROJECT_SETTINGS_FILE: &str = ".arcanum/settings.json";

fn default_bg_removal_provider() -> String {
    "local".to_string()
}

fn default_autosave_enabled() -> bool {
    true
}

fn default_autosave_interval_minutes() -> u32 {
    5
}

fn default_snapshot_enabled() -> bool {
    true
}

fn default_snapshot_interval_minutes() -> u32 {
    60
}

fn default_snapshot_keep_count() -> u32 {
    10
}

/// Cached project settings — keyed by project_dir to avoid re-reading from disk.
static PROJECT_SETTINGS_CACHE: LazyLock<RwLock<Option<(String, ProjectSettings)>>> =
    LazyLock::new(|| RwLock::new(None));

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
    #[serde(default = "default_bg_removal_provider")]
    pub bg_removal_provider: String,
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
    pub hub_world_slug: String,
    #[serde(default)]
    pub hub_world_listed: bool,
    #[serde(default)]
    pub hub_world_display_name: String,
    #[serde(default)]
    pub hub_world_tagline: String,
    #[serde(default = "default_autosave_enabled")]
    pub autosave_enabled: bool,
    #[serde(default = "default_autosave_interval_minutes")]
    pub autosave_interval_minutes: u32,
    #[serde(default = "default_snapshot_enabled")]
    pub snapshot_enabled: bool,
    #[serde(default = "default_snapshot_interval_minutes")]
    pub snapshot_interval_minutes: u32,
    #[serde(default = "default_snapshot_keep_count")]
    pub snapshot_keep_count: u32,
    #[serde(default)]
    pub snapshot_include_assets: bool,
}

pub fn project_settings_path(project_dir: &str) -> PathBuf {
    Path::new(project_dir).join(PROJECT_SETTINGS_FILE)
}

#[tauri::command]
pub async fn get_project_settings(project_dir: String) -> Result<Option<ProjectSettings>, String> {
    // Check cache first (must match project_dir)
    {
        let cache = PROJECT_SETTINGS_CACHE.read().await;
        if let Some((ref cached_dir, ref cached_ps)) = *cache {
            if cached_dir == &project_dir {
                return Ok(Some(cached_ps.clone()));
            }
        }
    }
    // Cache miss — read from disk
    let path = project_settings_path(&project_dir);
    if !path.exists() {
        return Ok(None);
    }
    let data = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read project settings: {e}"))?;
    let mut ps: ProjectSettings =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse project settings: {e}"))?;
    crate::settings::migrate_video_model(&mut ps.video_model);
    // Update cache
    {
        let mut cache = PROJECT_SETTINGS_CACHE.write().await;
        *cache = Some((project_dir, ps.clone()));
    }
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
    crate::fs_utils::write_json_file(&path, &settings, "project settings").await?;
    // Update cache with freshly saved settings
    {
        let mut cache = PROJECT_SETTINGS_CACHE.write().await;
        *cache = Some((project_dir, settings.clone()));
    }
    Ok(())
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
        bg_removal_provider: if user_settings.bg_removal_provider.is_empty() {
            "local".to_string()
        } else {
            user_settings.bg_removal_provider
        },
        r2_account_id: user_settings.r2_account_id,
        r2_access_key_id: user_settings.r2_access_key_id,
        r2_secret_access_key: user_settings.r2_secret_access_key,
        r2_bucket: user_settings.r2_bucket,
        r2_custom_domain: user_settings.r2_custom_domain,
        hub_world_slug: String::new(),
        hub_world_listed: false,
        hub_world_display_name: String::new(),
        hub_world_tagline: String::new(),
        autosave_enabled: default_autosave_enabled(),
        autosave_interval_minutes: default_autosave_interval_minutes(),
        snapshot_enabled: default_snapshot_enabled(),
        snapshot_interval_minutes: default_snapshot_interval_minutes(),
        snapshot_keep_count: default_snapshot_keep_count(),
        snapshot_include_assets: false,
    };
    save_project_settings(project_dir, ps.clone()).await?;
    Ok(ps)
}
