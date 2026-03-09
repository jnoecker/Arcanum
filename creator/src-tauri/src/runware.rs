use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::deepinfra::GeneratedImage;
use crate::settings;

const API_URL: &str = "https://api.runware.ai/v1";

// ─── Image Generation ────────────────────────────────────────────────

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
    output_format: String,
    number_results: u32,
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

fn assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("assets").join("images"))
}

/// Round to nearest multiple of 16, clamped to Runware's 128–2048 range.
fn round_to_16(v: u32) -> u32 {
    let rounded = (v + 8) / 16 * 16;
    rounded.clamp(128, 2048)
}

#[tauri::command]
pub async fn runware_generate_image(
    app: AppHandle,
    prompt: String,
    negative_prompt: Option<String>,
    model: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    steps: Option<u32>,
    guidance: Option<f32>,
) -> Result<GeneratedImage, String> {
    let s = settings::get_settings(app.clone()).await?;
    if s.runware_api_key.is_empty() {
        return Err("Runware API key not configured. Set it in Settings.".to_string());
    }

    // Runware requires dimensions as multiples of 16, clamped 128–2048
    let w = round_to_16(width.unwrap_or(1024));
    let h = round_to_16(height.unwrap_or(1024));
    let mdl = model.unwrap_or_else(|| "runware:400@2".to_string());

    let task = RunwareImageTask {
        task_type: "imageInference".to_string(),
        task_uuid: uuid::Uuid::new_v4().to_string(),
        positive_prompt: prompt.clone(),
        negative_prompt,
        width: w,
        height: h,
        model: mdl.clone(),
        steps,
        cfg_scale: guidance,
        output_format: "PNG".to_string(),
        number_results: 1,
    };

    let client = reqwest::Client::new();
    let response = client
        .post(API_URL)
        .header("Authorization", format!("Bearer {}", s.runware_api_key))
        .json(&vec![task])
        .send()
        .await
        .map_err(|e| format!("Runware API request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Runware API error ({status}): {text}"));
    }

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
        .map_err(|e| format!("Failed to read image bytes: {e}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    let dir = assets_dir(&app)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create assets dir: {e}"))?;

    let filename = format!("{hash}.png");
    let file_path = dir.join(&filename);
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Failed to save image: {e}"))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:image/png;base64,{b64}");

    Ok(GeneratedImage {
        id: uuid::Uuid::new_v4().to_string(),
        hash,
        file_path: file_path.to_string_lossy().to_string(),
        data_url,
        width: w,
        height: h,
        prompt,
        model: mdl,
    })
}

// ─── Audio Generation ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunwareAudioTask {
    task_type: String,
    #[serde(rename = "taskUUID")]
    task_uuid: String,
    positive_prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    seconds_total: Option<u32>,
    output_format: String,
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
        positive_prompt: prompt,
        seconds_total: duration_seconds,
        output_format: "MP3".to_string(),
    };

    let client = reqwest::Client::new();
    let response = client
        .post(API_URL)
        .header("Authorization", format!("Bearer {}", s.runware_api_key))
        .json(&vec![task])
        .send()
        .await
        .map_err(|e| format!("Runware API request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Runware API error ({status}): {text}"));
    }

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

    let client = reqwest::Client::new();
    let response = client
        .post(API_URL)
        .header("Authorization", format!("Bearer {}", s.runware_api_key))
        .json(&vec![task])
        .send()
        .await
        .map_err(|e| format!("Runware API request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Runware API error ({status}): {text}"));
    }

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
