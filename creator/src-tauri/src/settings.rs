use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::LazyLock;
use tauri::{AppHandle, Manager};
use tokio::sync::RwLock;

const SETTINGS_FILE: &str = "settings.json";

/// The currently active project directory. When set, `get_settings` automatically
/// merges user-level settings with project-level settings.
static ACTIVE_PROJECT_DIR: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));

/// Read the currently active project directory (used by other modules like assets).
pub async fn active_project_dir() -> Option<String> {
    ACTIVE_PROJECT_DIR.read().await.clone()
}

/// Cached user settings — avoids reading settings.json from disk on every call.
static USER_SETTINGS_CACHE: LazyLock<RwLock<Option<Settings>>> = LazyLock::new(|| RwLock::new(None));

/// Called by the frontend when a project is opened/closed.
#[tauri::command]
pub async fn set_active_project_dir(project_dir: Option<String>) -> Result<(), String> {
    let mut dir = ACTIVE_PROJECT_DIR.write().await;
    *dir = project_dir;
    Ok(())
}

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
    #[serde(default)]
    pub openai_api_key: String,
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
    #[serde(default = "default_auto_enhance_prompts")]
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
    pub github_pat: String,
    #[serde(default)]
    pub hub_api_url: String,
    #[serde(default)]
    pub hub_api_key: String,
    /// When true, image generation + LLM calls route through the hub
    /// (using hub_api_url + hub_api_key) instead of direct provider
    /// APIs. The hub enforces model allowlist and per-user quotas.
    #[serde(default)]
    pub use_hub_ai: bool,
}

fn default_image_model() -> String {
    "black-forest-labs/FLUX-1-dev".to_string()
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
    12
}

fn default_auto_enhance_prompts() -> bool {
    true
}

fn default_bg_removal_provider() -> String {
    "local".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            deepinfra_api_key: String::new(),
            runware_api_key: String::new(),
            anthropic_api_key: String::new(),
            openrouter_api_key: String::new(),
            openai_api_key: String::new(),
            image_model: default_image_model(),
            enhance_model: default_enhance_model(),
            prompt_llm_provider: default_prompt_llm_provider(),
            image_provider: default_image_provider(),
            video_model: default_video_model(),
            batch_concurrency: default_batch_concurrency(),
            auto_enhance_prompts: default_auto_enhance_prompts(),
            auto_remove_bg: false,
            bg_removal_provider: default_bg_removal_provider(),
            r2_account_id: String::new(),
            r2_access_key_id: String::new(),
            r2_secret_access_key: String::new(),
            r2_bucket: String::new(),
            r2_custom_domain: String::new(),
            github_pat: String::new(),
            hub_api_url: String::new(),
            hub_api_key: String::new(),
            use_hub_ai: false,
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

/// Load user-level settings only (no project merge).
pub async fn get_user_settings(app: &AppHandle) -> Result<Settings, String> {
    // Check cache first
    {
        let cache = USER_SETTINGS_CACHE.read().await;
        if let Some(ref cached) = *cache {
            return Ok(cached.clone());
        }
    }
    // Cache miss — read from disk
    let path = settings_path(app)?;
    let settings = if !path.exists() {
        Settings::default()
    } else {
        let data = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read settings: {e}"))?;
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse settings: {e}"))?
    };
    // Update cache
    {
        let mut cache = USER_SETTINGS_CACHE.write().await;
        *cache = Some(settings.clone());
    }
    Ok(settings)
}

/// Returns settings, automatically merged with project settings when a project is active.
/// All 24+ backend commands call this — they get the right credentials without changes.
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let user = get_user_settings(&app).await?;
    let dir = ACTIVE_PROJECT_DIR.read().await;
    if let Some(project_dir) = dir.as_ref() {
        if let Ok(Some(ps)) = crate::project_settings::get_project_settings(project_dir.clone()).await {
            return Ok(Settings {
                deepinfra_api_key: user.deepinfra_api_key,
                runware_api_key: user.runware_api_key,
                anthropic_api_key: user.anthropic_api_key,
                openrouter_api_key: user.openrouter_api_key,
                openai_api_key: user.openai_api_key,
                github_pat: user.github_pat,
                hub_api_url: user.hub_api_url,
                hub_api_key: user.hub_api_key,
                use_hub_ai: user.use_hub_ai,
                image_model: ps.image_model,
                enhance_model: ps.enhance_model,
                prompt_llm_provider: ps.prompt_llm_provider,
                image_provider: ps.image_provider,
                video_model: ps.video_model,
                batch_concurrency: ps.batch_concurrency,
                auto_enhance_prompts: ps.auto_enhance_prompts,
                auto_remove_bg: ps.auto_remove_bg,
                bg_removal_provider: ps.bg_removal_provider,
                r2_account_id: ps.r2_account_id,
                r2_access_key_id: ps.r2_access_key_id,
                r2_secret_access_key: ps.r2_secret_access_key,
                r2_bucket: ps.r2_bucket,
                r2_custom_domain: ps.r2_custom_domain,
            });
        }
    }
    Ok(user)
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create settings dir: {e}"))?;
    }
    crate::fs_utils::write_json_file(&path, &settings, "settings").await?;
    // Update cache with freshly saved settings
    {
        let mut cache = USER_SETTINGS_CACHE.write().await;
        *cache = Some(settings.clone());
    }
    Ok(())
}

/// Returns settings merged from user-level and project-level sources.
/// Project settings override the art/R2 fields; API keys always come from user settings.
#[tauri::command]
pub async fn get_merged_settings(
    app: AppHandle,
    project_dir: Option<String>,
) -> Result<Settings, String> {
    let user = get_settings(app).await?;
    let project = if let Some(dir) = project_dir {
        crate::project_settings::get_project_settings(dir).await?
    } else {
        None
    };
    match project {
        Some(ps) => Ok(Settings {
            // API keys always from user
            deepinfra_api_key: user.deepinfra_api_key,
            runware_api_key: user.runware_api_key,
            anthropic_api_key: user.anthropic_api_key,
            openrouter_api_key: user.openrouter_api_key,
            openai_api_key: user.openai_api_key,
            github_pat: user.github_pat,
            hub_api_url: user.hub_api_url,
            hub_api_key: user.hub_api_key,
            use_hub_ai: user.use_hub_ai,
            // Everything else from project
            image_model: ps.image_model,
            enhance_model: ps.enhance_model,
            prompt_llm_provider: ps.prompt_llm_provider,
            image_provider: ps.image_provider,
            video_model: ps.video_model,
            batch_concurrency: ps.batch_concurrency,
            auto_enhance_prompts: ps.auto_enhance_prompts,
            auto_remove_bg: ps.auto_remove_bg,
            bg_removal_provider: ps.bg_removal_provider,
            r2_account_id: ps.r2_account_id,
            r2_access_key_id: ps.r2_access_key_id,
            r2_secret_access_key: ps.r2_secret_access_key,
            r2_bucket: ps.r2_bucket,
            r2_custom_domain: ps.r2_custom_domain,
        }),
        None => Ok(user),
    }
}
