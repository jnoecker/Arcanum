use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::settings;

const INFERENCE_URL: &str = "https://api.deepinfra.com/v1/inference";
const CHAT_URL: &str = "https://api.deepinfra.com/v1/openai/chat/completions";

// ─── Image Generation ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ImageRequest {
    prompt: String,
    width: u32,
    height: u32,
    num_inference_steps: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    guidance_scale: Option<f32>,
}

#[derive(Debug, Deserialize)]
struct ImageResponse {
    images: Vec<ImageEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ImageEntry {
    UrlObject { url: String },
    Base64String(String),
}

impl ImageEntry {
    fn to_base64(&self) -> Result<String, String> {
        match self {
            ImageEntry::UrlObject { url } => {
                // Strip data URI prefix if present
                if let Some(data) = url.strip_prefix("data:image/png;base64,")
                    .or_else(|| url.strip_prefix("data:image/jpeg;base64,"))
                    .or_else(|| url.strip_prefix("data:image/webp;base64,"))
                {
                    Ok(data.to_string())
                } else {
                    Err("Unsupported image URL format".to_string())
                }
            }
            ImageEntry::Base64String(s) => {
                // Strip data URI prefix if present, otherwise return as-is
                if let Some(data) = s.strip_prefix("data:image/png;base64,")
                    .or_else(|| s.strip_prefix("data:image/jpeg;base64,"))
                    .or_else(|| s.strip_prefix("data:image/webp;base64,"))
                {
                    Ok(data.to_string())
                } else {
                    Ok(s.clone())
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedImage {
    pub id: String,
    pub hash: String,
    pub file_path: String,
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub prompt: String,
    pub model: String,
}

fn assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("assets").join("images"))
}

#[tauri::command]
pub async fn generate_image(
    app: AppHandle,
    prompt: String,
    model: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    steps: Option<u32>,
    guidance: Option<f32>,
) -> Result<GeneratedImage, String> {
    let settings = settings::get_settings(app.clone()).await?;
    if settings.deepinfra_api_key.is_empty() {
        return Err("DeepInfra API key not configured. Set it in Settings.".to_string());
    }

    let model = model.unwrap_or(settings.image_model);
    let w = width.unwrap_or(1024);
    let h = height.unwrap_or(1024);

    let is_schnell = model.contains("schnell");
    let default_steps = if is_schnell { 4 } else { 28 };
    let default_guidance = if is_schnell { None } else { Some(3.5) };

    let body = ImageRequest {
        prompt: prompt.clone(),
        width: w,
        height: h,
        num_inference_steps: steps.unwrap_or(default_steps),
        guidance_scale: guidance.or(default_guidance),
    };

    let url = format!("{INFERENCE_URL}/{model}");
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", settings.deepinfra_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error ({status}): {text}"));
    }

    let resp: ImageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {e}"))?;

    let entry = resp.images.first().ok_or("No images in response")?;
    let b64 = entry.to_base64()?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&b64)
        .map_err(|e| format!("Failed to decode base64 image: {e}"))?;

    // Content-addressed filename
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    // Save to assets dir
    let dir = assets_dir(&app)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create assets dir: {e}"))?;

    let ext = detect_extension(&bytes);
    let mime = detect_mime(ext);
    let filename = format!("{hash}.{ext}");
    let file_path = dir.join(&filename);
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Failed to save image: {e}"))?;

    let id = uuid::Uuid::new_v4().to_string();
    let data_url = format!("data:{mime};base64,{b64}");

    Ok(GeneratedImage {
        id,
        hash,
        file_path: file_path.to_string_lossy().to_string(),
        data_url,
        width: w,
        height: h,
        prompt,
        model,
    })
}

// ─── Image-to-Image Generation ──────────────────────────────────────

#[derive(Debug, Serialize)]
struct Img2ImgRequest {
    prompt: String,
    image: String, // base64 data URL
    width: u32,
    height: u32,
    num_inference_steps: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    guidance_scale: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    strength: Option<f32>,
}

#[tauri::command]
pub async fn img2img_generate(
    app: AppHandle,
    prompt: String,
    image_base64: String,
    model: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    strength: Option<f32>,
) -> Result<GeneratedImage, String> {
    let settings = settings::get_settings(app.clone()).await?;
    if settings.deepinfra_api_key.is_empty() {
        return Err("DeepInfra API key not configured. Set it in Settings.".to_string());
    }

    let model = model.unwrap_or(settings.image_model);
    let w = width.unwrap_or(1024);
    let h = height.unwrap_or(1024);

    let is_schnell = model.contains("schnell");
    let default_steps = if is_schnell { 4 } else { 28 };
    let default_guidance = if is_schnell { None } else { Some(3.5) };

    // Ensure the image has a data URL prefix
    let image_data = if image_base64.starts_with("data:") {
        image_base64
    } else {
        format!("data:image/png;base64,{image_base64}")
    };

    let body = Img2ImgRequest {
        prompt: prompt.clone(),
        image: image_data,
        width: w,
        height: h,
        num_inference_steps: default_steps,
        guidance_scale: default_guidance,
        strength: Some(strength.unwrap_or(0.7)),
    };

    let url = format!("{INFERENCE_URL}/{model}");
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", settings.deepinfra_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("img2img API request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("img2img API error ({status}): {text}"));
    }

    let resp: ImageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse img2img response: {e}"))?;

    let entry = resp.images.first().ok_or("No images in img2img response")?;
    let b64 = entry.to_base64()?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&b64)
        .map_err(|e| format!("Failed to decode base64 image: {e}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    let dir = assets_dir(&app)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create assets dir: {e}"))?;

    let ext = detect_extension(&bytes);
    let mime = detect_mime(ext);
    let filename = format!("{hash}.{ext}");
    let file_path = dir.join(&filename);
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Failed to save image: {e}"))?;

    let id = uuid::Uuid::new_v4().to_string();
    let data_url = format!("data:{mime};base64,{b64}");

    Ok(GeneratedImage {
        id,
        hash,
        file_path: file_path.to_string_lossy().to_string(),
        data_url,
        width: w,
        height: h,
        prompt,
        model,
    })
}

fn detect_extension(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if bytes.starts_with(b"RIFF") && bytes.len() > 12 && &bytes[8..12] == b"WEBP" {
        "webp"
    } else {
        "png" // default
    }
}

fn detect_mime(ext: &str) -> &'static str {
    match ext {
        "jpg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

/// Read a saved image from disk and return it as a data URL.
#[tauri::command]
pub async fn read_image_data_url(path: String) -> Result<String, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read image: {e}"))?;

    let ext = detect_extension(&bytes);
    let mime = detect_mime(ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

// ─── Prompt Enhancement ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[tauri::command]
pub async fn enhance_prompt(
    app: AppHandle,
    prompt: String,
    system_prompt: String,
) -> Result<String, String> {
    let settings = settings::get_settings(app).await?;
    if settings.deepinfra_api_key.is_empty() {
        return Err("DeepInfra API key not configured. Set it in Settings.".to_string());
    }

    let body = ChatRequest {
        model: settings.enhance_model,
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: prompt,
            },
        ],
        max_tokens: 512,
        temperature: 0.7,
    };

    let client = reqwest::Client::new();
    let response = client
        .post(CHAT_URL)
        .header("Authorization", format!("Bearer {}", settings.deepinfra_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error ({status}): {text}"));
    }

    let resp: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {e}"))?;

    resp.choices
        .first()
        .map(|c| strip_think_tags(c.message.content.trim()))
        .ok_or_else(|| "No response from model".to_string())
}

/// Strip `<think>...</think>` reasoning blocks that some models emit.
fn strip_think_tags(text: &str) -> String {
    let result = text;
    while let Some(start) = result.find("<think>") {
        if let Some(end) = result.find("</think>") {
            let before = &result[..start];
            let after = &result[end + "</think>".len()..];
            let combined = format!("{before}{after}");
            return strip_think_tags(combined.trim());
        } else {
            // Unclosed <think> — strip from <think> to end
            return result[..start].trim().to_string();
        }
    }
    result.to_string()
}
