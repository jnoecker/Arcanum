// ─── Dialogue voice map ──────────────────────────────────────────
// Per-project mapping of mob templateKey → ElevenLabs voiceId, plus a
// project-wide default voice and synthesis model. This map is Arcanum-only:
// it never leaves the creator. The AmbonMUD engine never sees voiceIds — it
// only resolves the published clip URL (see docs/VOICE_OVER_CONTRACT.md in
// the AmbonMUD repo).
//
// Stored as `<project_dir>/.arcanum/voices.json`, kept out of the
// server-read zone YAML so synthesis config never reaches the MUD.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const VOICE_MAP_FILE: &str = ".arcanum/voices.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VoiceMap {
    /// Voice used for any mob without an explicit assignment.
    #[serde(default)]
    pub default_voice_id: String,
    /// ElevenLabs model id used for all synthesis (e.g. `eleven_multilingual_v2`).
    #[serde(default)]
    pub model_id: String,
    /// templateKey → ElevenLabs voiceId.
    #[serde(default)]
    pub assignments: HashMap<String, String>,
}

fn voice_map_path(project_dir: &str) -> PathBuf {
    Path::new(project_dir).join(VOICE_MAP_FILE)
}

/// Load the project's voice map. Returns an empty map when none has been
/// saved yet (rather than erroring) so the panel can start from blank.
#[tauri::command]
pub async fn load_voice_map(project_dir: String) -> Result<VoiceMap, String> {
    let path = voice_map_path(&project_dir);
    if !path.exists() {
        return Ok(VoiceMap::default());
    }
    let data = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read voice map: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse voice map: {e}"))
}

#[tauri::command]
pub async fn save_voice_map(project_dir: String, map: VoiceMap) -> Result<(), String> {
    let path = voice_map_path(&project_dir);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create .arcanum dir: {e}"))?;
    }
    crate::fs_utils::write_json_file(&path, &map, "voice map").await
}
