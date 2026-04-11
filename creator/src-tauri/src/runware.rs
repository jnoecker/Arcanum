use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::{deepinfra::GeneratedImage, generation, settings};

const API_URL: &str = "https://api.runware.ai/v1";

// ─── Image Generation ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunwareIpAdapter {
    model: String,
    guide_image: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenAIImageSettings {
    quality: String,
    background: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageProviderSettings {
    openai: OpenAIImageSettings,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunwareImageTask {
    task_type: String,
    #[serde(rename = "taskUUID")]
    task_uuid: String,
    positive_prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    negative_prompt: Option<String>,
    width: u32,
    height: u32,
    model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    steps: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cfg_scale: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    seed_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    strength: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ip_adapters: Option<Vec<RunwareIpAdapter>>,
    output_format: String,
    number_results: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    provider_settings: Option<ImageProviderSettings>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunwareResponse {
    data: Vec<RunwareImageResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunwareImageResult {
    #[serde(alias = "imageURL", alias = "imageUrl")]
    image_url: Option<String>,
}

/// Round to nearest multiple of 16, clamped to Runware's 128–2048 range.
fn round_to_16(v: u32) -> u32 {
    let rounded = (v + 8) / 16 * 16;
    rounded.clamp(128, 2048)
}

/// Snap to the nearest valid GPT Image 1.5 size that matches the target aspect ratio.
/// Valid sizes: 1024×1024, 1536×1024, 1024×1536.
/// Prefers 1024×1024 when the target is roughly square (within 4:3).
fn snap_gpt_image_dims(w: u32, h: u32) -> (u32, u32) {
    let ratio = w as f64 / h as f64;
    if ratio > 1.34 {
        (1536, 1024)
    } else if ratio < 0.75 {
        (1024, 1536)
    } else {
        (1024, 1024)
    }
}

/// Whether to request native transparent background from GPT Image 1.5.
/// Disabled: transparent mode degrades GPT's output quality significantly
/// (doll-like figures, wrong proportions, dark renders). The client-side
/// bg-removal pipeline handles transparency after generation instead.
fn wants_transparent_bg(_asset_type: Option<&str>) -> bool {
    false
}

fn is_gpt_image_model(model: &str) -> bool {
    model.starts_with("openai:")
}

#[tauri::command]
pub async fn runware_generate_image(
    app: AppHandle,
    prompt: String,
    negative_prompt: Option<String>,
    seed_image: Option<String>,
    seed_strength: Option<f32>,
    guide_image: Option<String>,
    model: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    steps: Option<u32>,
    guidance: Option<f32>,
    asset_type: Option<String>,
    auto_enhance: Option<bool>,
) -> Result<GeneratedImage, String> {
    let s = settings::get_settings(app.clone()).await?;

    // Hub mode: proxy the request through the Arcanum Hub. The hub
    // enforces model allowlist, dimension caps, and quota; we just
    // pass the user's intent through and let the hub decide what's
    // permitted.
    if crate::hub_ai::is_enabled(&s) {
        let enhanced = generation::maybe_enhance_prompt(
            &app,
            &prompt,
            asset_type.as_deref(),
            auto_enhance,
        )
        .await?;
        return crate::hub_ai::generate_image(
            &app,
            &s,
            &prompt,
            &enhanced,
            asset_type.as_deref(),
            model.as_deref(),
            width.unwrap_or(1024),
            height.unwrap_or(1024),
            negative_prompt.as_deref(),
            steps,
            guidance,
            seed_image.as_deref(),
            guide_image.as_deref(),
            Some(wants_transparent_bg(asset_type.as_deref())),
        )
        .await;
    }

    if s.runware_api_key.is_empty() {
        return Err("Runware API key not configured. Set it in Settings.".to_string());
    }

    // Keep original target dims for final resize, cap for generation
    let target_w = width.unwrap_or(1024);
    let target_h = height.unwrap_or(1024);
    let mdl = model.unwrap_or_else(|| "runware:400@2".to_string());

    // GPT Image 1.5 only supports fixed dimensions; FLUX models use multiples of 16
    let (w, h) = if is_gpt_image_model(&mdl) {
        snap_gpt_image_dims(target_w, target_h)
    } else {
        let (capped_w, capped_h) = generation::cap_generation_dims(target_w, target_h);
        (round_to_16(capped_w), round_to_16(capped_h))
    };
    let final_prompt = generation::maybe_enhance_prompt(
        &app,
        &prompt,
        asset_type.as_deref(),
        auto_enhance,
    )
    .await?;
    let normalized_seed_image = seed_image.map(|value| {
        if value.starts_with("data:") {
            value
        } else {
            format!("data:image/png;base64,{value}")
        }
    });

    // Build FLUX Redux IP-Adapter for guide image (used for FLUX2 img2img)
    let ip_adapters = guide_image.map(|img| {
        let normalized = if img.starts_with("data:") {
            img
        } else {
            format!("data:image/png;base64,{img}")
        };
        vec![RunwareIpAdapter {
            model: "runware:105@1".to_string(),
            guide_image: normalized,
        }]
    });

    // Build provider settings for GPT Image models
    let provider_settings = if is_gpt_image_model(&mdl) {
        let transparent = wants_transparent_bg(asset_type.as_deref());
        Some(ImageProviderSettings {
            openai: OpenAIImageSettings {
                quality: "low".to_string(),
                background: if transparent { "transparent" } else { "opaque" }.to_string(),
            },
        })
    } else {
        None
    };

    let task = RunwareImageTask {
        task_type: "imageInference".to_string(),
        task_uuid: uuid::Uuid::new_v4().to_string(),
        positive_prompt: final_prompt.clone(),
        negative_prompt: if is_gpt_image_model(&mdl) { None } else { negative_prompt },
        width: w,
        height: h,
        model: mdl.clone(),
        steps: if is_gpt_image_model(&mdl) { None } else { steps },
        cfg_scale: if is_gpt_image_model(&mdl) { None } else { guidance },
        seed_image: normalized_seed_image,
        strength: seed_strength,
        ip_adapters,
        output_format: "PNG".to_string(),
        number_results: 1,
        provider_settings,
    };

    let client = crate::http::shared_client();
    let response = client
        .post(API_URL)
        .header("Authorization", crate::http::bearer_header(&s.runware_api_key))
        .json(&vec![task])
        .send()
        .await
        .map_err(|e| format!("Runware API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Runware response: {e}"))?;

    let resp: RunwareResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse Runware response: {e}\nBody: {text}"))?;

    let image_url = resp
        .data
        .first()
        .and_then(|r| r.image_url.as_ref())
        .ok_or_else(|| format!("No image in Runware response. Body: {text}"))?;

    // Download the image from the URL
    let img_response = client
        .get(image_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download Runware image: {e}"))?;

    let bytes = img_response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {e}"))?
        .to_vec();
    // GPT Image models with transparent background produce native transparency — tell the
    // processing pipeline to preserve alpha instead of flattening against lavender.
    let native_transparent = is_gpt_image_model(&mdl) && wants_transparent_bg(asset_type.as_deref());
    let behavior = generation::infer_behavior(
        asset_type.as_deref(),
        target_w,
        target_h,
        if native_transparent { Some(true) } else { None },
    );
    let processed = generation::process_image_bytes(&bytes, &behavior)?;

    generation::persist_generated_image(
        &app,
        &processed,
        final_prompt,
        mdl,
        behavior.target_width,
        behavior.target_height,
        behavior.output_format,
    )
    .await
}

// ─── Background Removal (Bria RMBG v2.0) ─────────────────────────────
//
// Server-side background removal via Runware's Bria model. An
// alternative to the local @imgly/background-removal WASM pipeline for
// users whose machines can't run onnxruntime reliably, or who prefer
// the quality of the Bria model. In hub mode this short-circuits to
// the hub proxy; otherwise it calls Runware directly with the user's
// runware_api_key.
//
// The command takes a data URL (what the frontend has on hand after
// image generation) and returns the PNG bytes as base64, matching the
// shape the existing `removeBackground()` helper expects so all the
// current call sites keep working unchanged.

const BG_REMOVAL_MODEL: &str = "bria:2@1";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BriaProviderSettings {
    preserve_alpha: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoveBgProviderSettings {
    bria: BriaProviderSettings,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoveBgInputs {
    image: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunwareRemoveBgTask {
    task_type: String,
    #[serde(rename = "taskUUID")]
    task_uuid: String,
    model: String,
    output_type: String,
    output_format: String,
    inputs: RemoveBgInputs,
    provider_settings: RemoveBgProviderSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunwareRemoveBgResponse {
    data: Option<Vec<RunwareRemoveBgResult>>,
    errors: Option<Vec<RunwareRemoveBgError>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunwareRemoveBgResult {
    #[serde(alias = "imageURL", alias = "imageUrl")]
    image_url: Option<String>,
    image_base64_data: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RunwareRemoveBgError {
    message: Option<String>,
}

/// Server-side background removal via Runware Bria RMBG v2.0.
/// Takes a data URL and returns the processed PNG as base64.
#[tauri::command]
pub async fn runware_remove_background(
    app: AppHandle,
    image_data_url: String,
) -> Result<String, String> {
    let s = settings::get_settings(app).await?;

    // Hub mode: proxy the request so the user's Runware key doesn't
    // need to be configured locally. The hub enforces quota and bills
    // this against the lifetime image counter.
    if crate::hub_ai::is_enabled(&s) {
        return crate::hub_ai::remove_background(&s, &image_data_url).await;
    }

    if s.runware_api_key.is_empty() {
        return Err("Runware API key not configured. Set it in Settings.".to_string());
    }

    let task = RunwareRemoveBgTask {
        task_type: "removeBackground".to_string(),
        task_uuid: uuid::Uuid::new_v4().to_string(),
        model: BG_REMOVAL_MODEL.to_string(),
        output_type: "base64Data".to_string(),
        output_format: "PNG".to_string(),
        inputs: RemoveBgInputs { image: image_data_url },
        provider_settings: RemoveBgProviderSettings {
            bria: BriaProviderSettings { preserve_alpha: false },
        },
    };

    let client = crate::http::shared_client();
    let response = client
        .post(API_URL)
        .header("Authorization", crate::http::bearer_header(&s.runware_api_key))
        .json(&vec![task])
        .send()
        .await
        .map_err(|e| format!("Runware bg-removal request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Runware bg-removal response: {e}"))?;

    let parsed: RunwareRemoveBgResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse Runware bg-removal response: {e}\nBody: {text}"))?;

    if let Some(errs) = parsed.errors {
        let msg = errs
            .into_iter()
            .find_map(|e| e.message)
            .unwrap_or_else(|| "unknown Runware error".to_string());
        return Err(format!("Runware bg-removal: {msg}"));
    }

    let first = parsed
        .data
        .and_then(|mut d| d.drain(..).next())
        .ok_or_else(|| format!("No result in Runware bg-removal response. Body: {text}"))?;

    // Prefer inline base64; fall back to downloading from URL if the
    // API returned one instead (shouldn't happen with outputType =
    // base64Data but defensive).
    if let Some(b64) = first.image_base64_data {
        return Ok(b64);
    }
    if let Some(url) = first.image_url {
        let bytes = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to download bg-removed image: {e}"))?
            .bytes()
            .await
            .map_err(|e| format!("Failed to read bg-removed image bytes: {e}"))?;
        return Ok(base64::engine::general_purpose::STANDARD.encode(&bytes));
    }
    Err("Runware bg-removal returned no image data".to_string())
}

// ─── Audio Generation ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ElevenLabsMusicSettings {
    force_instrumental: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ElevenLabsProvider {
    music: ElevenLabsMusicSettings,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AudioProviderSettings {
    elevenlabs: ElevenLabsProvider,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunwareAudioTask {
    task_type: String,
    #[serde(rename = "taskUUID")]
    task_uuid: String,
    model: String,
    positive_prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration: Option<u32>,
    output_format: String,
    provider_settings: AudioProviderSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunwareAudioResponse {
    data: Vec<RunwareAudioResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunwareAudioResult {
    #[serde(alias = "audioURL", alias = "audioUrl")]
    audio_url: Option<String>,
}

#[tauri::command]
pub async fn runware_generate_audio(
    app: AppHandle,
    prompt: String,
    duration_seconds: Option<u32>,
) -> Result<String, String> {
    let s = settings::get_settings(app.clone()).await?;
    if s.runware_api_key.is_empty() {
        return Err("Runware API key not configured. Set it in Settings.".to_string());
    }

    let task = RunwareAudioTask {
        task_type: "audioInference".to_string(),
        task_uuid: uuid::Uuid::new_v4().to_string(),
        model: "elevenlabs:1@1".to_string(),
        positive_prompt: prompt,
        duration: duration_seconds,
        output_format: "MP3".to_string(),
        provider_settings: AudioProviderSettings {
            elevenlabs: ElevenLabsProvider {
                music: ElevenLabsMusicSettings {
                    force_instrumental: true,
                },
            },
        },
    };

    let client = crate::http::shared_client();
    let response = client
        .post(API_URL)
        .header("Authorization", crate::http::bearer_header(&s.runware_api_key))
        .json(&vec![task])
        .send()
        .await
        .map_err(|e| format!("Runware API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let resp: RunwareAudioResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Runware audio response: {e}"))?;

    let audio_url = resp
        .data
        .first()
        .and_then(|r| r.audio_url.as_ref())
        .ok_or("No audio in Runware response")?;

    // Download audio file
    let audio_response = client
        .get(audio_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download audio: {e}"))?;

    let bytes = audio_response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read audio bytes: {e}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?
        .join("assets")
        .join("audio");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create audio dir: {e}"))?;

    let filename = format!("{hash}.mp3");
    let file_path = dir.join(&filename);
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Failed to save audio: {e}"))?;

    Ok(file_path.to_string_lossy().to_string())
}

// ─── Video Generation ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunwareVideoTask {
    task_type: String,
    #[serde(rename = "taskUUID")]
    task_uuid: String,
    input_image: String,
    positive_prompt: String,
    model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    seconds_total: Option<u32>,
    output_format: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunwareVideoResponse {
    data: Vec<RunwareVideoResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunwareVideoResult {
    #[serde(alias = "videoURL", alias = "videoUrl")]
    video_url: Option<String>,
}

#[tauri::command]
pub async fn runware_generate_video(
    app: AppHandle,
    image_path: String,
    prompt: String,
    model: Option<String>,
    duration_seconds: Option<u32>,
) -> Result<String, String> {
    let s = settings::get_settings(app.clone()).await?;
    if s.runware_api_key.is_empty() {
        return Err("Runware API key not configured. Set it in Settings.".to_string());
    }

    // Read source image and encode as base64 data URL
    let image_bytes = tokio::fs::read(&image_path)
        .await
        .map_err(|e| format!("Failed to read source image: {e}"))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&image_bytes);
    let input_image = format!("data:image/png;base64,{b64}");

    let task = RunwareVideoTask {
        task_type: "imageToVideo".to_string(),
        task_uuid: uuid::Uuid::new_v4().to_string(),
        input_image,
        positive_prompt: prompt,
        model: model.unwrap_or(s.video_model),
        seconds_total: duration_seconds,
        output_format: "MP4".to_string(),
    };

    let client = crate::http::shared_client();
    let response = client
        .post(API_URL)
        .header("Authorization", crate::http::bearer_header(&s.runware_api_key))
        .json(&vec![task])
        .send()
        .await
        .map_err(|e| format!("Runware API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let resp: RunwareVideoResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Runware video response: {e}"))?;

    let video_url = resp
        .data
        .first()
        .and_then(|r| r.video_url.as_ref())
        .ok_or("No video in Runware response")?;

    // Download video file
    let video_response = client
        .get(video_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download video: {e}"))?;

    let bytes = video_response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read video bytes: {e}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?
        .join("assets")
        .join("video");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create video dir: {e}"))?;

    let filename = format!("{hash}.mp4");
    let file_path = dir.join(&filename);
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Failed to save video: {e}"))?;

    Ok(file_path.to_string_lossy().to_string())
}
