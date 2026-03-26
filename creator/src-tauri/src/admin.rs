use base64::Engine;
use reqwest::header::{AUTHORIZATION, HeaderValue};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

// ─── Config persistence ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AdminConfig {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub token: String,
}

/// Derive a stable filename from a project path.
fn config_key(project_path: &str) -> String {
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(project_path.as_bytes());
    hex::encode(&hash[..16])
}

fn admin_config_path(app: &AppHandle, project_path: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("admin").join(format!("{}.json", config_key(project_path))))
}

#[tauri::command]
pub async fn load_admin_config(app: AppHandle, project_path: String) -> Result<AdminConfig, String> {
    let path = admin_config_path(&app, &project_path)?;
    if !path.exists() {
        return Ok(AdminConfig::default());
    }
    let data = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read admin config: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse admin config: {e}"))
}

#[tauri::command]
pub async fn save_admin_config(
    app: AppHandle,
    project_path: String,
    config: AdminConfig,
) -> Result<(), String> {
    let path = admin_config_path(&app, &project_path)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create admin config dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize admin config: {e}"))?;
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| format!("Failed to write admin config: {e}"))
}

// ─── HTTP client helpers ───────────────────────────────────────────

/// Reuse a single reqwest Client for connection pooling.
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to build HTTP client")
    })
}

fn build_auth_header(token: &str) -> Result<HeaderValue, String> {
    let encoded = base64::engine::general_purpose::STANDARD.encode(format!(":{token}"));
    HeaderValue::from_str(&format!("Basic {encoded}"))
        .map_err(|e| format!("Invalid auth header: {e}"))
}

/// Percent-encode a value for use as a URL path segment.
/// Rejects values containing path traversal characters.
fn encode_path_segment(value: &str) -> Result<String, String> {
    if value.is_empty() {
        return Err("Path segment cannot be empty".to_string());
    }
    if value.contains('/') || value.contains('\\') || value.contains("..") {
        return Err(format!("Invalid path segment: {value}"));
    }
    // Percent-encode everything except unreserved characters
    Ok(value
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                String::from(b as char)
            }
            _ => format!("%{b:02X}"),
        })
        .collect())
}

/// Valid reload targets.
const VALID_RELOAD_TARGETS: &[&str] = &["world", "abilities", "effects", "all"];

async fn admin_get<T: serde::de::DeserializeOwned>(
    url: &str,
    token: &str,
    path: &str,
) -> Result<T, String> {
    let client = get_client();
    let auth = build_auth_header(token)?;
    let full_url = format!("{}{}", url.trim_end_matches('/'), path);

    let resp = client
        .get(&full_url)
        .header(AUTHORIZATION, auth)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {status}: {body}"));
    }

    resp.json::<T>()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))
}

async fn admin_post<T: serde::de::DeserializeOwned>(
    url: &str,
    token: &str,
    path: &str,
) -> Result<T, String> {
    let client = get_client();
    let auth = build_auth_header(token)?;
    let full_url = format!("{}{}", url.trim_end_matches('/'), path);

    let resp = client
        .post(&full_url)
        .header(AUTHORIZATION, auth)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {status}: {body}"));
    }

    resp.json::<T>()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))
}

// ─── API response types ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminOverview {
    pub players_online: u32,
    pub mobs_alive: u32,
    pub zones_loaded: u32,
    pub rooms_total: u32,
    pub grafana_url: Option<String>,
    pub metrics_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerSummary {
    pub name: String,
    pub level: u32,
    pub player_class: String,
    pub race: String,
    pub room: String,
    pub is_online: bool,
    pub is_staff: bool,
    pub hp: i32,
    pub max_hp: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDetail {
    pub name: String,
    pub level: u32,
    pub player_class: String,
    pub race: String,
    pub room: String,
    pub is_online: bool,
    pub is_staff: bool,
    pub hp: i32,
    pub max_hp: i32,
    pub mana: i32,
    pub max_mana: i32,
    pub xp_total: i64,
    pub gold: i64,
    pub stats: std::collections::HashMap<String, i32>,
    pub active_title: Option<String>,
    pub active_quest_ids: Vec<String>,
    pub completed_quest_ids: Vec<String>,
    pub achievement_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoneSummary {
    pub name: String,
    pub room_count: u32,
    pub players_online: u32,
    pub mobs_alive: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoneDetailResponse {
    pub name: String,
    pub rooms: Vec<RoomSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomSummary {
    pub id: String,
    pub title: String,
    pub exits: Vec<String>,
    pub players: Vec<String>,
    pub mobs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReloadResult {
    pub status: String,
    pub summary: String,
}

// ─── Tauri commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn admin_overview(url: String, token: String) -> Result<AdminOverview, String> {
    admin_get(&url, &token, "/api/overview").await
}

#[tauri::command]
pub async fn admin_players(url: String, token: String) -> Result<Vec<PlayerSummary>, String> {
    admin_get(&url, &token, "/api/players").await
}

#[tauri::command]
pub async fn admin_player_detail(
    url: String,
    token: String,
    name: String,
) -> Result<PlayerDetail, String> {
    let safe_name = encode_path_segment(&name)?;
    admin_get(&url, &token, &format!("/api/players/{safe_name}")).await
}

#[tauri::command]
pub async fn admin_zones(url: String, token: String) -> Result<Vec<ZoneSummary>, String> {
    admin_get(&url, &token, "/api/world/zones").await
}

#[tauri::command]
pub async fn admin_zone_detail(
    url: String,
    token: String,
    zone: String,
) -> Result<ZoneDetailResponse, String> {
    let safe_zone = encode_path_segment(&zone)?;
    admin_get(&url, &token, &format!("/api/world/zones/{safe_zone}")).await
}

#[tauri::command]
pub async fn admin_reload(
    url: String,
    token: String,
    target: String,
) -> Result<ReloadResult, String> {
    let path = if target.is_empty() || target == "all" {
        "/api/reload".to_string()
    } else {
        if !VALID_RELOAD_TARGETS.contains(&target.as_str()) {
            return Err(format!("Invalid reload target: {target}"));
        }
        format!("/api/reload?target={target}")
    };
    admin_post(&url, &token, &path).await
}
