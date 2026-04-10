// ─── OpenAI Text-to-Speech ──────────────────────────────────────
// Narration synthesis for the story → video export pipeline.
// Uses the existing `openai_api_key` from Settings.
//
// Output files are content-addressed by SHA256(text + voice + model + speed)
// so identical narration doesn't re-synthesize on every export. Cached
// MP3s live under `app_data_dir/assets/narration/<hash>.mp3`.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::settings;

const API_URL: &str = "https://api.openai.com/v1/audio/speech";

/// Supported OpenAI TTS voices. Passed through to the API as-is.
/// Keep in sync with the frontend voice picker.
const SUPPORTED_VOICES: &[&str] = &[
    "alloy", "echo", "fable", "onyx", "nova", "shimmer",
];

/// Supported OpenAI TTS models. `tts-1` is fast/cheap, `tts-1-hd` is
/// higher quality at 2x the cost.
const SUPPORTED_MODELS: &[&str] = &["tts-1", "tts-1-hd"];

#[derive(Debug, Serialize)]
struct OpenAiTtsRequest {
    model: String,
    input: String,
    voice: String,
    response_format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    speed: Option<f32>,
}

/// Result returned to the frontend.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NarrationAudio {
    /// Absolute filesystem path to the cached MP3.
    pub file_path: String,
    /// Content hash (also the filename stem).
    pub hash: String,
    /// Bytes of the generated audio.
    pub size_bytes: u64,
    /// Whether the file came from cache (true) or was freshly synthesized (false).
    pub cached: bool,
}

// ─── Input validation ────────────────────────────────────────────

fn validate_voice(voice: &str) -> Result<String, String> {
    if SUPPORTED_VOICES.contains(&voice) {
        Ok(voice.to_string())
    } else {
        Err(format!(
            "Unsupported TTS voice '{voice}'. Supported: {}",
            SUPPORTED_VOICES.join(", ")
        ))
    }
}

fn validate_model(model: Option<&str>) -> Result<String, String> {
    let m = model.unwrap_or("tts-1");
    if SUPPORTED_MODELS.contains(&m) {
        Ok(m.to_string())
    } else {
        Err(format!(
            "Unsupported TTS model '{m}'. Supported: {}",
            SUPPORTED_MODELS.join(", ")
        ))
    }
}

/// Clamp speed to the API's supported range [0.25, 4.0]. None means "default".
fn validate_speed(speed: Option<f32>) -> Option<f32> {
    speed.map(|s| s.clamp(0.25, 4.0))
}

// ─── Cache key ───────────────────────────────────────────────────

fn cache_hash(text: &str, voice: &str, model: &str, speed: Option<f32>) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hasher.update(b"|");
    hasher.update(voice.as_bytes());
    hasher.update(b"|");
    hasher.update(model.as_bytes());
    hasher.update(b"|");
    // Serialize speed with 2-decimal precision so 1.0 and 1.00 map to the
    // same key.
    match speed {
        Some(s) => hasher.update(format!("{s:.2}").as_bytes()),
        None => hasher.update(b"default"),
    }
    format!("{:x}", hasher.finalize())
}

async fn narration_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?
        .join("assets")
        .join("narration");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create narration dir: {e}"))?;
    Ok(dir)
}

// ─── Public command ──────────────────────────────────────────────

/// Synthesize narration audio via OpenAI's TTS API.
///
/// Returns a cached file path when the same (text, voice, model, speed)
/// combination has been generated before. Otherwise calls the API,
/// saves the MP3 under `app_data_dir/assets/narration/<hash>.mp3`,
/// and returns the new path.
///
/// Empty or whitespace-only input is rejected (the API would 400 anyway).
#[tauri::command]
pub async fn openai_tts_generate(
    app: AppHandle,
    text: String,
    voice: String,
    model: Option<String>,
    speed: Option<f32>,
) -> Result<NarrationAudio, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("TTS input text is empty.".to_string());
    }

    let voice = validate_voice(&voice)?;
    let model = validate_model(model.as_deref())?;
    let speed = validate_speed(speed);

    // ─── Cache lookup ────────────────────────────────────────
    let hash = cache_hash(trimmed, &voice, &model, speed);
    let dir = narration_dir(&app).await?;
    let file_path = dir.join(format!("{hash}.mp3"));

    if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
        if metadata.is_file() && metadata.len() > 0 {
            return Ok(NarrationAudio {
                file_path: file_path.to_string_lossy().to_string(),
                hash,
                size_bytes: metadata.len(),
                cached: true,
            });
        }
    }

    // ─── API key check ───────────────────────────────────────
    let settings = settings::get_settings(app.clone()).await?;
    if settings.openai_api_key.is_empty() {
        return Err("OpenAI API key not configured. Set it in Settings.".to_string());
    }

    // ─── Request ─────────────────────────────────────────────
    let body = OpenAiTtsRequest {
        model: model.clone(),
        input: trimmed.to_string(),
        voice: voice.clone(),
        response_format: "mp3".to_string(),
        speed,
    };

    let client = crate::http::shared_client();
    let response = client
        .post(API_URL)
        .header("Authorization", crate::http::bearer_header(&settings.openai_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI TTS request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read TTS response bytes: {e}"))?;

    if bytes.is_empty() {
        return Err("OpenAI TTS returned an empty audio body.".to_string());
    }

    // ─── Write to cache ──────────────────────────────────────
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write narration audio: {e}"))?;

    Ok(NarrationAudio {
        file_path: file_path.to_string_lossy().to_string(),
        hash,
        size_bytes: bytes.len() as u64,
        cached: false,
    })
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_hash_is_deterministic() {
        let a = cache_hash("hello", "onyx", "tts-1", Some(1.0));
        let b = cache_hash("hello", "onyx", "tts-1", Some(1.0));
        assert_eq!(a, b);
    }

    #[test]
    fn cache_hash_varies_with_text() {
        let a = cache_hash("hello", "onyx", "tts-1", Some(1.0));
        let b = cache_hash("world", "onyx", "tts-1", Some(1.0));
        assert_ne!(a, b);
    }

    #[test]
    fn cache_hash_varies_with_voice() {
        let a = cache_hash("hello", "onyx", "tts-1", Some(1.0));
        let b = cache_hash("hello", "nova", "tts-1", Some(1.0));
        assert_ne!(a, b);
    }

    #[test]
    fn cache_hash_varies_with_model() {
        let a = cache_hash("hello", "onyx", "tts-1", Some(1.0));
        let b = cache_hash("hello", "onyx", "tts-1-hd", Some(1.0));
        assert_ne!(a, b);
    }

    #[test]
    fn cache_hash_varies_with_speed() {
        let slow = cache_hash("hello", "onyx", "tts-1", Some(0.85));
        let fast = cache_hash("hello", "onyx", "tts-1", Some(1.15));
        assert_ne!(slow, fast);
    }

    #[test]
    fn cache_hash_default_speed_is_stable() {
        let a = cache_hash("hello", "onyx", "tts-1", None);
        let b = cache_hash("hello", "onyx", "tts-1", None);
        assert_eq!(a, b);
    }

    #[test]
    fn validate_voice_accepts_supported_voices() {
        for voice in SUPPORTED_VOICES {
            assert!(validate_voice(voice).is_ok(), "{voice} should be valid");
        }
    }

    #[test]
    fn validate_voice_rejects_unknown() {
        assert!(validate_voice("deepvoice").is_err());
        assert!(validate_voice("").is_err());
    }

    #[test]
    fn validate_model_defaults_to_tts1() {
        assert_eq!(validate_model(None).unwrap(), "tts-1");
    }

    #[test]
    fn validate_model_rejects_unknown() {
        assert!(validate_model(Some("gpt-4")).is_err());
    }

    #[test]
    fn validate_speed_clamps_extremes() {
        assert_eq!(validate_speed(Some(0.1)), Some(0.25));
        assert_eq!(validate_speed(Some(10.0)), Some(4.0));
        assert_eq!(validate_speed(Some(1.5)), Some(1.5));
    }

    #[test]
    fn validate_speed_passes_through_none() {
        assert_eq!(validate_speed(None), None);
    }
}
