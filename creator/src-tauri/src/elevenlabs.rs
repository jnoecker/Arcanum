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
use crate::voices::VoiceSettings;

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

fn cache_hash(text: &str, voice_id: &str, model_id: &str, settings: &VoiceSettings) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hasher.update(b"|");
    hasher.update(voice_id.as_bytes());
    hasher.update(b"|");
    hasher.update(model_id.as_bytes());
    hasher.update(b"|");
    // Delivery settings change the audio, so they must change the cache key.
    hasher.update(settings_fingerprint(settings).as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Deterministic string form of the (clamped) settings for cache keying.
fn settings_fingerprint(s: &VoiceSettings) -> String {
    fn f(o: Option<f32>) -> String {
        o.map(|x| format!("{x:.3}")).unwrap_or_else(|| "_".to_string())
    }
    format!(
        "st{}|si{}|sy{}|sp{}|b{}",
        f(s.stability),
        f(s.similarity_boost),
        f(s.style),
        f(s.speed),
        s.use_speaker_boost
            .map(|b| if b { "1" } else { "0" })
            .unwrap_or("_"),
    )
}

/// Clamp settings to ElevenLabs' accepted ranges. None stays None (omitted from
/// the request → the voice's own default applies).
fn normalize_settings(s: VoiceSettings) -> VoiceSettings {
    VoiceSettings {
        stability: s.stability.map(|v| v.clamp(0.0, 1.0)),
        similarity_boost: s.similarity_boost.map(|v| v.clamp(0.0, 1.0)),
        style: s.style.map(|v| v.clamp(0.0, 1.0)),
        use_speaker_boost: s.use_speaker_boost,
        speed: s.speed.map(|v| v.clamp(0.7, 1.2)),
    }
}

fn settings_is_empty(s: &VoiceSettings) -> bool {
    s.stability.is_none()
        && s.similarity_boost.is_none()
        && s.style.is_none()
        && s.use_speaker_boost.is_none()
        && s.speed.is_none()
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

/// ElevenLabs `/v1/voices` response shape. The API returns snake_case keys
/// (`voice_id`, `preview_url`), so this parse type uses plain field names —
/// distinct from the camelCase IPC `ElevenLabsVoice` we hand the frontend.
/// Unknown fields are ignored.
#[derive(Debug, Deserialize)]
struct ApiVoice {
    voice_id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    preview_url: String,
}

#[derive(Debug, Deserialize)]
struct ListVoicesResponse {
    voices: Vec<ApiVoice>,
}

impl From<ApiVoice> for ElevenLabsVoice {
    fn from(v: ApiVoice) -> Self {
        Self {
            voice_id: v.voice_id,
            name: v.name,
            category: v.category,
            preview_url: v.preview_url,
        }
    }
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
    Ok(parsed.voices.into_iter().map(ElevenLabsVoice::from).collect())
}

/// `/v1/voices/{id}/settings` response (snake_case). Mapped to the camelCase
/// `VoiceSettings` the frontend stores.
#[derive(Debug, Default, Deserialize)]
struct ApiVoiceSettingsResponse {
    #[serde(default)]
    stability: Option<f32>,
    #[serde(default)]
    similarity_boost: Option<f32>,
    #[serde(default)]
    style: Option<f32>,
    #[serde(default)]
    use_speaker_boost: Option<bool>,
    #[serde(default)]
    speed: Option<f32>,
}

impl From<ApiVoiceSettingsResponse> for VoiceSettings {
    fn from(r: ApiVoiceSettingsResponse) -> Self {
        Self {
            stability: r.stability,
            similarity_boost: r.similarity_boost,
            style: r.style,
            use_speaker_boost: r.use_speaker_boost,
            speed: r.speed,
        }
    }
}

/// Fetch a voice's own saved settings, used to seed the editor sliders so they
/// start at the voice's defaults rather than a generic baseline.
#[tauri::command]
pub async fn elevenlabs_voice_settings(
    app: AppHandle,
    voice_id: String,
) -> Result<VoiceSettings, String> {
    if voice_id.trim().is_empty() {
        return Err("No voice id.".to_string());
    }
    let settings = settings::get_settings(app).await?;
    if settings.elevenlabs_api_key.is_empty() {
        return Err("ElevenLabs API key not configured. Set it in Settings.".to_string());
    }
    let client = crate::http::shared_client();
    let response = client
        .get(format!("{API_BASE}/voices/{voice_id}/settings"))
        .header("xi-api-key", &settings.elevenlabs_api_key)
        .send()
        .await
        .map_err(|e| format!("ElevenLabs voice settings request failed: {e}"))?;
    let response = crate::http::check_response(response).await?;
    let parsed: ApiVoiceSettingsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse voice settings response: {e}"))?;
    Ok(VoiceSettings::from(parsed))
}

#[derive(Debug, Serialize)]
struct TtsRequest {
    text: String,
    model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    voice_settings: Option<ApiVoiceSettings>,
}

/// ElevenLabs request-body shape for voice settings (snake_case, as the API
/// expects). Built from the camelCase `VoiceSettings` storage type.
#[derive(Debug, Serialize)]
struct ApiVoiceSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    stability: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    similarity_boost: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    style: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    use_speaker_boost: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    speed: Option<f32>,
}

impl From<&VoiceSettings> for ApiVoiceSettings {
    fn from(s: &VoiceSettings) -> Self {
        Self {
            stability: s.stability,
            similarity_boost: s.similarity_boost,
            style: s.style,
            use_speaker_boost: s.use_speaker_boost,
            speed: s.speed,
        }
    }
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
    voice_settings: Option<VoiceSettings>,
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

    let settings = normalize_settings(voice_settings.unwrap_or_default());

    let cache_hash = cache_hash(&text, &voice_id, &model_id, &settings);
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
    let app_settings = settings::get_settings(app.clone()).await?;
    if app_settings.elevenlabs_api_key.is_empty() {
        return Err("ElevenLabs API key not configured. Set it in Settings.".to_string());
    }

    let body = TtsRequest {
        text: text.clone(),
        model_id: model_id.clone(),
        voice_settings: if settings_is_empty(&settings) {
            None
        } else {
            Some(ApiVoiceSettings::from(&settings))
        },
    };

    // Retry transient failures with backoff. ElevenLabs returns 429
    // `too_many_concurrent_requests` when parallel calls exceed the plan's
    // concurrency cap, and occasional 5xx under load — both clear on retry,
    // so a bulk "Generate all" doesn't lose most of its lines to the cap.
    let client = crate::http::shared_client();
    let url = format!("{API_BASE}/text-to-speech/{voice_id}?output_format={OUTPUT_FORMAT}");
    const MAX_ATTEMPTS: u32 = 5;
    let mut last_err = String::new();
    let mut bytes = None;

    for attempt in 1..=MAX_ATTEMPTS {
        match client
            .post(&url)
            .header("xi-api-key", &app_settings.elevenlabs_api_key)
            .header("Accept", "audio/mpeg")
            .json(&body)
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                let b = resp
                    .bytes()
                    .await
                    .map_err(|e| format!("Failed to read TTS response bytes: {e}"))?;
                bytes = Some(b);
                break;
            }
            Ok(resp) => {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                let retryable = status.is_server_error() || status.as_u16() == 429;
                last_err = format!("ElevenLabs TTS failed ({status}): {text}");
                if !retryable || attempt == MAX_ATTEMPTS {
                    return Err(last_err);
                }
            }
            Err(e) => {
                last_err = format!("ElevenLabs TTS request failed: {e}");
                if attempt == MAX_ATTEMPTS {
                    return Err(last_err);
                }
            }
        }
        // Backoff: 600ms, 1.2s, 2.4s, 4.8s — long enough for in-flight
        // concurrent requests to clear the cap.
        tokio::time::sleep(std::time::Duration::from_millis(600u64 << (attempt - 1))).await;
    }

    let bytes = bytes.ok_or(last_err)?;
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

// ─── Cache status + readback (panel rehydration) ─────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceStatusQuery {
    /// Opaque key echoed back so the frontend can map results to lines.
    pub key: String,
    pub text: String,
    pub voice_id: String,
    #[serde(default)]
    pub model_id: Option<String>,
    #[serde(default)]
    pub voice_settings: Option<VoiceSettings>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceStatusResult {
    pub key: String,
    pub cache_hash: String,
    pub text_sha8: String,
    pub present: bool,
}

/// For each line, compute its clip cache key and report whether the MP3 is
/// already cached on disk. Lets the panel restore "already generated" status
/// after a reopen or app restart without re-calling ElevenLabs.
#[tauri::command]
pub async fn voice_clip_status(
    app: AppHandle,
    queries: Vec<VoiceStatusQuery>,
) -> Result<Vec<VoiceStatusResult>, String> {
    let dir = voices_cache_dir(&app).await?;
    let mut out = Vec::with_capacity(queries.len());
    for q in queries {
        let text_sha8 = text_sha8(&q.text);
        if q.text.trim().is_empty() || q.voice_id.trim().is_empty() {
            out.push(VoiceStatusResult {
                key: q.key,
                cache_hash: String::new(),
                text_sha8,
                present: false,
            });
            continue;
        }
        let model_id = q
            .model_id
            .map(|m| m.trim().to_string())
            .filter(|m| !m.is_empty())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());
        let settings = normalize_settings(q.voice_settings.unwrap_or_default());
        let cache_hash = cache_hash(&q.text, &q.voice_id, &model_id, &settings);
        let path = dir.join(format!("{cache_hash}.mp3"));
        let present = matches!(tokio::fs::metadata(&path).await, Ok(m) if m.is_file() && m.len() > 0);
        out.push(VoiceStatusResult {
            key: q.key,
            cache_hash,
            text_sha8,
            present,
        });
    }
    Ok(out)
}

/// Read a cached clip back as a data URL for preview playback. Used when a
/// line's status was rehydrated from disk (no in-memory data URL yet).
#[tauri::command]
pub async fn read_voice_clip(app: AppHandle, cache_hash: String) -> Result<String, String> {
    if cache_hash.is_empty() || !cache_hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid clip id.".to_string());
    }
    let dir = voices_cache_dir(&app).await?;
    let path = dir.join(format!("{cache_hash}.mp3"));
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Cached clip not found: {e}"))?;
    Ok(to_data_url(&bytes))
}

// ─── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn no_settings() -> VoiceSettings {
        VoiceSettings::default()
    }

    #[test]
    fn cache_hash_is_deterministic() {
        let a = cache_hash("Greetings, traveler.", "voiceA", "eleven_multilingual_v2", &no_settings());
        let b = cache_hash("Greetings, traveler.", "voiceA", "eleven_multilingual_v2", &no_settings());
        assert_eq!(a, b);
    }

    #[test]
    fn cache_hash_varies_with_text_voice_and_model() {
        let base = cache_hash("hello", "voiceA", "model1", &no_settings());
        assert_ne!(base, cache_hash("world", "voiceA", "model1", &no_settings()));
        assert_ne!(base, cache_hash("hello", "voiceB", "model1", &no_settings()));
        assert_ne!(base, cache_hash("hello", "voiceA", "model2", &no_settings()));
    }

    #[test]
    fn cache_hash_varies_with_voice_settings() {
        let base = cache_hash("hello", "voiceA", "model1", &no_settings());
        let tweaked = VoiceSettings {
            stability: Some(0.2),
            ..VoiceSettings::default()
        };
        assert_ne!(base, cache_hash("hello", "voiceA", "model1", &tweaked));
        // Same settings → same hash.
        assert_eq!(
            cache_hash("hello", "voiceA", "model1", &tweaked),
            cache_hash("hello", "voiceA", "model1", &tweaked),
        );
    }

    #[test]
    fn normalize_settings_clamps_to_ranges() {
        let n = normalize_settings(VoiceSettings {
            stability: Some(1.5),
            similarity_boost: Some(-0.2),
            style: Some(2.0),
            use_speaker_boost: Some(false),
            speed: Some(3.0),
        });
        assert_eq!(n.stability, Some(1.0));
        assert_eq!(n.similarity_boost, Some(0.0));
        assert_eq!(n.style, Some(1.0));
        assert_eq!(n.speed, Some(1.2));
        assert_eq!(n.use_speaker_boost, Some(false));
    }

    #[test]
    fn parses_snake_case_voices_response() {
        // ElevenLabs returns snake_case keys + many extra fields we ignore.
        let body = r#"{
            "voices": [
                {
                    "voice_id": "21m00Tcm4TlvDq8ikWAM",
                    "name": "Rachel",
                    "category": "premade",
                    "preview_url": "https://example.com/rachel.mp3",
                    "labels": {"accent": "american"},
                    "settings": null
                },
                { "voice_id": "abc123", "name": "Goblin" }
            ]
        }"#;
        let parsed: ListVoicesResponse = serde_json::from_str(body).unwrap();
        let voices: Vec<ElevenLabsVoice> =
            parsed.voices.into_iter().map(ElevenLabsVoice::from).collect();
        assert_eq!(voices.len(), 2);
        assert_eq!(voices[0].voice_id, "21m00Tcm4TlvDq8ikWAM");
        assert_eq!(voices[0].name, "Rachel");
        assert_eq!(voices[0].preview_url, "https://example.com/rachel.mp3");
        // Missing category/preview_url default to empty, don't fail the parse.
        assert_eq!(voices[1].voice_id, "abc123");
        assert_eq!(voices[1].category, "");
        assert_eq!(voices[1].preview_url, "");
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
    fn text_sha8_matches_contract_reference_vectors() {
        // Cross-repo reference vectors shared with AmbonMUD's GmcpEmitter.sha8.
        // `printf 'Hello!' | sha256sum` → 334d016f…
        assert_eq!(text_sha8("Hello!"), "334d016f");
        assert_eq!(text_sha8("Hello there!"), "89b8b8e4");
        // YAML `|` literal block (clip chomping) → exactly one trailing newline.
        // The terminal '\n' is hash-significant; `|-` (strip) would differ.
        assert_eq!(text_sha8("Hello there!\nStay a while.\n"), "df658e4d");
    }

    #[test]
    fn text_sha8_is_sensitive_to_whitespace() {
        // The engine hashes raw node text — leading/trailing whitespace counts.
        assert_ne!(text_sha8("hello"), text_sha8(" hello "));
    }
}
