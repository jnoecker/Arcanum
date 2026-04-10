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
    crate::fs_utils::write_json_file(&path, &config, "admin config").await
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

async fn admin_get_with_query<T: serde::de::DeserializeOwned>(
    url: &str,
    token: &str,
    path: &str,
    query: &[(&str, &str)],
) -> Result<T, String> {
    let client = get_client();
    let auth = build_auth_header(token)?;
    let full_url = format!("{}{}", url.trim_end_matches('/'), path);

    let resp = client
        .get(&full_url)
        .header(AUTHORIZATION, auth)
        .query(query)
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

async fn admin_post_with_body<B: serde::Serialize, T: serde::de::DeserializeOwned>(
    url: &str,
    token: &str,
    path: &str,
    body: &B,
) -> Result<T, String> {
    let client = get_client();
    let auth = build_auth_header(token)?;
    let full_url = format!("{}{}", url.trim_end_matches('/'), path);

    let resp = client
        .post(&full_url)
        .header(AUTHORIZATION, auth)
        .json(body)
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: String,
    pub uptime_ms: u64,
    pub players_online: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffToggleResult {
    pub name: String,
    pub is_staff: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomDetailResponse {
    pub id: String,
    pub title: String,
    pub description: String,
    pub exits: Vec<ExitDetail>,
    pub players: Vec<String>,
    pub mobs: Vec<RoomMobInfo>,
    pub features: Vec<String>,
    pub station: Option<String>,
    pub image: Option<String>,
    pub video: Option<String>,
    pub music: Option<String>,
    pub ambient: Option<String>,
    pub map_x: Option<i32>,
    pub map_y: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitDetail {
    pub direction: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomMobInfo {
    pub id: String,
    pub name: String,
    pub hp: i32,
    pub max_hp: i32,
    pub template_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobSummary {
    pub id: String,
    pub name: String,
    pub room_id: String,
    pub hp: i32,
    pub max_hp: i32,
    pub template_key: String,
    pub aggressive: bool,
    pub xp_reward: i64,
    pub armor: i32,
    pub image: Option<String>,
    pub quest_ids: Vec<String>,
    pub spawn_room_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbilityEntry {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub mana_cost: i32,
    pub cooldown_ms: i64,
    pub level_required: u32,
    pub target_type: String,
    pub required_class: Option<String>,
    pub image: Option<String>,
    pub effect_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectEntry {
    pub id: String,
    pub display_name: String,
    pub effect_type: String,
    pub duration_ms: i64,
    pub tick_interval_ms: i64,
    pub tick_min_value: i32,
    pub tick_max_value: i32,
    pub shield_amount: i32,
    pub stat_mods: std::collections::HashMap<String, i32>,
    pub stack_behavior: String,
    pub max_stacks: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestObjective {
    pub r#type: String,
    pub target_id: String,
    pub count: i32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestRewards {
    pub xp: Option<i64>,
    pub gold: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub giver_mob_id: String,
    pub completion_type: String,
    pub objectives: Vec<QuestObjective>,
    pub rewards: QuestRewards,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementCriterion {
    pub r#type: String,
    pub target_id: String,
    pub count: i32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementRewards {
    pub xp: Option<i64>,
    pub gold: Option<i64>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementEntry {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub category: String,
    pub hidden: bool,
    pub criteria: Vec<AchievementCriterion>,
    pub rewards: AchievementRewards,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopItemEntry {
    pub id: String,
    pub display_name: String,
    pub base_price: i64,
    pub slot: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopEntry {
    pub id: String,
    pub name: String,
    pub room_id: String,
    pub items: Vec<ShopItemEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemEntry {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub slot: Option<String>,
    pub damage: i32,
    pub armor: i32,
    pub stats: std::collections::HashMap<String, i32>,
    pub consumable: bool,
    pub base_price: i64,
    pub image: Option<String>,
    pub spawn_room: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastResult {
    pub status: String,
    pub recipients: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BroadcastRequest {
    message: String,
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

// ─── New commands (phase 2) ────────────────────────────────────────

#[tauri::command]
pub async fn admin_health(url: String, token: String) -> Result<HealthResponse, String> {
    admin_get(&url, &token, "/api/health").await
}

#[tauri::command]
pub async fn admin_player_search(
    url: String,
    token: String,
    query: String,
) -> Result<PlayerDetail, String> {
    admin_get_with_query(&url, &token, "/api/players/search", &[("q", &query)]).await
}

#[tauri::command]
pub async fn admin_player_toggle_staff(
    url: String,
    token: String,
    name: String,
) -> Result<StaffToggleResult, String> {
    let safe_name = encode_path_segment(&name)?;
    admin_post(&url, &token, &format!("/api/players/{safe_name}/staff")).await
}

#[tauri::command]
pub async fn admin_room_detail(
    url: String,
    token: String,
    zone: String,
    room: String,
) -> Result<RoomDetailResponse, String> {
    let safe_zone = encode_path_segment(&zone)?;
    let safe_room = encode_path_segment(&room)?;
    admin_get(&url, &token, &format!("/api/world/zones/{safe_zone}/rooms/{safe_room}")).await
}

#[tauri::command]
pub async fn admin_mobs(
    url: String,
    token: String,
    zone: Option<String>,
) -> Result<Vec<MobSummary>, String> {
    match zone {
        Some(z) => admin_get_with_query(&url, &token, "/api/mobs", &[("zone", &z)]).await,
        None => admin_get(&url, &token, "/api/mobs").await,
    }
}

#[tauri::command]
pub async fn admin_mob_detail(
    url: String,
    token: String,
    id: String,
) -> Result<MobSummary, String> {
    let safe_id = encode_path_segment(&id)?;
    admin_get(&url, &token, &format!("/api/mobs/{safe_id}")).await
}

#[tauri::command]
pub async fn admin_abilities(url: String, token: String) -> Result<Vec<AbilityEntry>, String> {
    admin_get(&url, &token, "/api/abilities").await
}

#[tauri::command]
pub async fn admin_ability_detail(
    url: String,
    token: String,
    id: String,
) -> Result<AbilityEntry, String> {
    let safe_id = encode_path_segment(&id)?;
    admin_get(&url, &token, &format!("/api/abilities/{safe_id}")).await
}

#[tauri::command]
pub async fn admin_effects(url: String, token: String) -> Result<Vec<EffectEntry>, String> {
    admin_get(&url, &token, "/api/effects").await
}

#[tauri::command]
pub async fn admin_effect_detail(
    url: String,
    token: String,
    id: String,
) -> Result<EffectEntry, String> {
    let safe_id = encode_path_segment(&id)?;
    admin_get(&url, &token, &format!("/api/effects/{safe_id}")).await
}

#[tauri::command]
pub async fn admin_quests(url: String, token: String) -> Result<Vec<QuestEntry>, String> {
    admin_get(&url, &token, "/api/quests").await
}

#[tauri::command]
pub async fn admin_quest_detail(
    url: String,
    token: String,
    id: String,
) -> Result<QuestEntry, String> {
    let safe_id = encode_path_segment(&id)?;
    admin_get(&url, &token, &format!("/api/quests/{safe_id}")).await
}

#[tauri::command]
pub async fn admin_achievements(
    url: String,
    token: String,
) -> Result<Vec<AchievementEntry>, String> {
    admin_get(&url, &token, "/api/achievements").await
}

#[tauri::command]
pub async fn admin_achievement_detail(
    url: String,
    token: String,
    id: String,
) -> Result<AchievementEntry, String> {
    let safe_id = encode_path_segment(&id)?;
    admin_get(&url, &token, &format!("/api/achievements/{safe_id}")).await
}

#[tauri::command]
pub async fn admin_shops(url: String, token: String) -> Result<Vec<ShopEntry>, String> {
    admin_get(&url, &token, "/api/shops").await
}

#[tauri::command]
pub async fn admin_items(url: String, token: String) -> Result<Vec<ItemEntry>, String> {
    admin_get(&url, &token, "/api/items").await
}

#[tauri::command]
pub async fn admin_broadcast(
    url: String,
    token: String,
    message: String,
) -> Result<BroadcastResult, String> {
    if message.trim().is_empty() {
        return Err("Broadcast message cannot be empty".to_string());
    }
    admin_post_with_body(&url, &token, "/api/broadcast", &BroadcastRequest { message }).await
}

// ─── Logs ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: String,
    pub epoch_ms: i64,
    pub level: String,
    pub logger: String,
    pub message: String,
    pub thread: String,
}

#[tauri::command]
pub async fn admin_logs(
    url: String,
    token: String,
    since: Option<i64>,
    level: Option<String>,
    logger: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<LogEntry>, String> {
    let mut query: Vec<(&str, String)> = Vec::new();
    if let Some(s) = since {
        query.push(("since", s.to_string()));
    }
    if let Some(ref l) = level {
        query.push(("level", l.clone()));
    }
    if let Some(ref l) = logger {
        query.push(("logger", l.clone()));
    }
    if let Some(n) = limit {
        query.push(("limit", n.to_string()));
    }

    let client = get_client();
    let auth = build_auth_header(&token)?;
    let full_url = format!("{}/api/logs", url.trim_end_matches('/'));

    let resp = client
        .get(&full_url)
        .header(AUTHORIZATION, auth)
        .query(&query)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {status}: {body}"));
    }

    resp.json::<Vec<LogEntry>>()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))
}
