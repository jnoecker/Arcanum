// ─── ElevenLabs Text-to-Speech ──────────────────────────────────
// Dialogue voice-over synthesis. Arcanum owns the ElevenLabs API key,
// the templateKey → voiceId mapping, and licensing; the AmbonMUD engine
// only ever sees a fully-resolved clip URL (see docs/VOICE_OVER_CONTRACT.md
// in the AmbonMUD repo).
//
// Synthesized clips are content-addressed by SHA256(text + voiceId + modelId)
// so identical lines don't re-synthesize. Cached MP3s live under
// `app_data_dir/assets/voices/<hash>.mp3`.
//
// `text_sha8` — first 8 hex chars of SHA-256 over the *raw* node text — is the
// cross-repo agreed hash baked into the R2 path. The engine recomputes the
// identical value from the same `node.text`, so an edited line lands at a new
// path and never serves stale audio.

use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::settings;

const API_BASE: &str = "https://api.elevenlabs.io/v1";

/// ElevenLabs MP3 default for the standard TTS endpoint. Web Audio's
/// `decodeAudioData` decodes MP3 natively, so the web client needs no
/// transcoding.
const OUTPUT_FORMAT: &str = "mp3_44100_128";

const DEFAULT_MODEL: &str = "eleven_multilingual_v2";

// ─── Types ───────────────────────────────────────────────────────

/// A voice available on the account, surfaced to the voice picker.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevenLabsVoice {
    pub voice_id: String,
    pub name: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub preview_url: String,
}

/// A synthesized (or cached) dialogue clip returned to the frontend.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceClip {
    /// Absolute filesystem path to the cached MP3.
    pub file_path: String,
    /// Content hash of (text + voice + model) — the cache filename stem.
    pub cache_hash: String,
    /// First 8 hex chars of SHA-256(raw text). Baked into the R2 path; the
    /// AmbonMUD engine recomputes the same value.
    pub text_sha8: String,
    /// `data:audio/mpeg;base64,...` for immediate in-app preview playback.
    pub data_url: String,
    pub size_bytes: u64,
    /// Whether the clip came from cache (true) or was freshly synthesized.
    pub cached: bool,
}

// ─── Hashing ─────────────────────────────────────────────────────

fn cache_hash(text: &str, voice_id: &str, model_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hasher.update(b"|");
    hasher.update(voice_id.as_bytes());
    hasher.update(b"|");
    hasher.update(model_id.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// First 8 hex chars of SHA-256 over the exact raw node text. This is the
/// contract hash — see module docs. Must match the engine's computation
/// byte-for-byte, so it hashes `text` verbatim with no trimming.
pub fn text_sha8(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let full = format!("{:x}", hasher.finalize());
    full[..8].to_string()
}

async fn voices_cache_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?
        .join("assets")
        .join("voices");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create voices dir: {e}"))?;
    Ok(dir)
}

// ─── Commands ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ListVoicesResponse {
    voices: Vec<ElevenLabsVoice>,
}

/// List the voices available on the configured ElevenLabs account.
#[tauri::command]
pub async fn elevenlabs_list_voices(app: AppHandle) -> Result<Vec<ElevenLabsVoice>, String> {
    let settings = settings::get_settings(app).await?;
    if settings.elevenlabs_api_key.is_empty() {
        return Err("ElevenLabs API key not configured. Set it in Settings.".to_string());
    }

    let client = crate::http::shared_client();
    let response = client
        .get(format!("{API_BASE}/voices"))
        .header("xi-api-key", &settings.elevenlabs_api_key)
        .send()
        .await
        .map_err(|e| format!("ElevenLabs voices request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;
    let parsed: ListVoicesResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse ElevenLabs voices response: {e}"))?;
    Ok(parsed.voices)
}

#[derive(Debug, Serialize)]
struct TtsRequest {
    text: String,
    model_id: String,
}

/// Synthesize a dialogue line into an MP3 clip via ElevenLabs.
///
/// Returns a cached clip when the same (text, voice, model) was generated
/// before. Otherwise calls the API and caches the result under
/// `app_data_dir/assets/voices/<cache_hash>.mp3`.
#[tauri::command]
pub async fn elevenlabs_synthesize(
    app: AppHandle,
    text: String,
    voice_id: String,
    model_id: Option<String>,
) -> Result<VoiceClip, String> {
    if text.trim().is_empty() {
        return Err("Voice-over text is empty.".to_string());
    }
    if voice_id.trim().is_empty() {
        return Err("No voice selected for this line.".to_string());
    }

    let model_id = model_id
        .map(|m| m.trim().to_string())
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let cache_hash = cache_hash(&text, &voice_id, &model_id);
    let text_sha8 = text_sha8(&text);
    let dir = voices_cache_dir(&app).await?;
    let file_path = dir.join(format!("{cache_hash}.mp3"));

    // ─── Cache lookup ────────────────────────────────────────
    if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
        if metadata.is_file() && metadata.len() > 0 {
            let bytes = tokio::fs::read(&file_path)
                .await
                .map_err(|e| format!("Failed to read cached voice clip: {e}"))?;
            return Ok(VoiceClip {
                file_path: file_path.to_string_lossy().to_string(),
                cache_hash,
                text_sha8,
                data_url: to_data_url(&bytes),
                size_bytes: metadata.len(),
                cached: true,
            });
        }
    }

    // ─── Request ─────────────────────────────────────────────
    let settings = settings::get_settings(app.clone()).await?;
    if settings.elevenlabs_api_key.is_empty() {
        return Err("ElevenLabs API key not configured. Set it in Settings.".to_string());
    }

    let body = TtsRequest {
        text: text.clone(),
        model_id: model_id.clone(),
    };

    let client = crate::http::shared_client();
    let response = client
        .post(format!(
            "{API_BASE}/text-to-speech/{voice_id}?output_format={OUTPUT_FORMAT}"
        ))
        .header("xi-api-key", &settings.elevenlabs_api_key)
        .header("Accept", "audio/mpeg")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("ElevenLabs TTS request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read TTS response bytes: {e}"))?;

    if bytes.is_empty() {
        return Err("ElevenLabs returned an empty audio body.".to_string());
    }

    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write voice clip: {e}"))?;

    Ok(VoiceClip {
        file_path: file_path.to_string_lossy().to_string(),
        cache_hash,
        text_sha8,
        data_url: to_data_url(&bytes),
        size_bytes: bytes.len() as u64,
        cached: false,
    })
}

fn to_data_url(bytes: &[u8]) -> String {
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:audio/mpeg;base64,{b64}")
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_hash_is_deterministic() {
        let a = cache_hash("Greetings, traveler.", "voiceA", "eleven_multilingual_v2");
        let b = cache_hash("Greetings, traveler.", "voiceA", "eleven_multilingual_v2");
        assert_eq!(a, b);
    }

    #[test]
    fn cache_hash_varies_with_text_voice_and_model() {
        let base = cache_hash("hello", "voiceA", "model1");
        assert_ne!(base, cache_hash("world", "voiceA", "model1"));
        assert_ne!(base, cache_hash("hello", "voiceB", "model1"));
        assert_ne!(base, cache_hash("hello", "voiceA", "model2"));
    }

    #[test]
    fn text_sha8_is_eight_hex_chars() {
        let h = text_sha8("Greetings, traveler.");
        assert_eq!(h.len(), 8);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn text_sha8_matches_known_vector() {
        // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb924...
        assert_eq!(text_sha8(""), "e3b0c442");
    }

    #[test]
    fn text_sha8_is_sensitive_to_whitespace() {
        // The engine hashes raw node text — leading/trailing whitespace counts.
        assert_ne!(text_sha8("hello"), text_sha8(" hello "));
    }
}
