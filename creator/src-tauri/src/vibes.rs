use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
struct ZoneVibe {
    zone_id: String,
    vibe_text: String,
}

fn vibes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("vibes"))
}

#[tauri::command]
pub async fn save_zone_vibe(
    app: AppHandle,
    zone_id: String,
    vibe_text: String,
) -> Result<(), String> {
    let dir = vibes_dir(&app)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create vibes dir: {e}"))?;

    let vibe = ZoneVibe {
        zone_id: zone_id.clone(),
        vibe_text,
    };
    let json = serde_json::to_string_pretty(&vibe)
        .map_err(|e| format!("Failed to serialize vibe: {e}"))?;

    let path = dir.join(format!("{zone_id}.json"));
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| format!("Failed to write vibe: {e}"))
}

#[tauri::command]
pub async fn load_zone_vibe(
    app: AppHandle,
    zone_id: String,
) -> Result<String, String> {
    let path = vibes_dir(&app)?.join(format!("{zone_id}.json"));
    if !path.exists() {
        return Ok(String::new());
    }
    let data = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read vibe: {e}"))?;
    let vibe: ZoneVibe =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse vibe: {e}"))?;
    Ok(vibe.vibe_text)
}
