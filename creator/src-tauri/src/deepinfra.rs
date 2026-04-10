use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{generation, llm, settings};

const INFERENCE_URL: &str = "https://api.deepinfra.com/v1/inference";

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

#[tauri::command]
pub async fn generate_image(
    app: AppHandle,
    prompt: String,
    model: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    steps: Option<u32>,
    guidance: Option<f32>,
    asset_type: Option<String>,
    auto_enhance: Option<bool>,
) -> Result<GeneratedImage, String> {
    let settings = settings::get_settings(app.clone()).await?;
    if settings.deepinfra_api_key.is_empty() {
        return Err("DeepInfra API key not configured. Set it in Settings.".to_string());
    }

    let model = model.unwrap_or(settings.image_model);
    let w = width.unwrap_or(1024);
    let h = height.unwrap_or(1024);
    let (gen_width, gen_height) = generation::cap_generation_dims(w, h);
    let final_prompt = generation::maybe_enhance_prompt(
        &app,
        &prompt,
        asset_type.as_deref(),
        auto_enhance,
    )
    .await?;

    let is_schnell = model.contains("schnell");
    let default_steps = if is_schnell { 4 } else { 28 };
    let default_guidance = if is_schnell { None } else { Some(3.5) };

    let body = ImageRequest {
        prompt: final_prompt.clone(),
        width: gen_width,
        height: gen_height,
        num_inference_steps: steps.unwrap_or(default_steps),
        guidance_scale: guidance.or(default_guidance),
    };

    let url = format!("{INFERENCE_URL}/{model}");
    let client = crate::http::shared_client();
    let response = client
        .post(&url)
        .header("Authorization", crate::http::bearer_header(&settings.deepinfra_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let resp: ImageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {e}"))?;

    let entry = resp.images.first().ok_or("No images in response")?;
    let b64 = entry.to_base64()?;
    let raw_bytes = base64::engine::general_purpose::STANDARD
        .decode(&b64)
        .map_err(|e| format!("Failed to decode base64 image: {e}"))?;
    let behavior = generation::infer_behavior(asset_type.as_deref(), w, h, None);
    let processed = generation::process_image_bytes(&raw_bytes, &behavior)?;

    generation::persist_generated_image(
        &app,
        &processed,
        final_prompt,
        model,
        behavior.target_width,
        behavior.target_height,
        behavior.output_format,
    )
    .await
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
    asset_type: Option<String>,
    auto_enhance: Option<bool>,
) -> Result<GeneratedImage, String> {
    let settings = settings::get_settings(app.clone()).await?;
    if settings.deepinfra_api_key.is_empty() {
        return Err("DeepInfra API key not configured. Set it in Settings.".to_string());
    }

    let model = model.unwrap_or(settings.image_model);
    let w = width.unwrap_or(1024);
    let h = height.unwrap_or(1024);
    let (gen_width, gen_height) = generation::cap_generation_dims(w, h);
    let final_prompt = generation::maybe_enhance_prompt(
        &app,
        &prompt,
        asset_type.as_deref(),
        auto_enhance,
    )
    .await?;

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
        prompt: final_prompt.clone(),
        image: image_data,
        width: gen_width,
        height: gen_height,
        num_inference_steps: default_steps,
        guidance_scale: default_guidance,
        strength: Some(strength.unwrap_or(0.7)),
    };

    let url = format!("{INFERENCE_URL}/{model}");
    let client = crate::http::shared_client();
    let response = client
        .post(&url)
        .header("Authorization", crate::http::bearer_header(&settings.deepinfra_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("img2img API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let resp: ImageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse img2img response: {e}"))?;

    let entry = resp.images.first().ok_or("No images in img2img response")?;
    let b64 = entry.to_base64()?;
    let raw_bytes = base64::engine::general_purpose::STANDARD
        .decode(&b64)
        .map_err(|e| format!("Failed to decode base64 image: {e}"))?;
    let behavior = generation::infer_behavior(asset_type.as_deref(), w, h, None);
    let processed = generation::process_image_bytes(&raw_bytes, &behavior)?;

    generation::persist_generated_image(
        &app,
        &processed,
        final_prompt,
        model,
        behavior.target_width,
        behavior.target_height,
        behavior.output_format,
    )
    .await
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

#[tauri::command]
pub async fn enhance_prompt(
    app: AppHandle,
    prompt: String,
    system_prompt: String,
) -> Result<String, String> {
    let settings = settings::get_settings(app).await?;
    llm::complete_from_settings(&settings, &system_prompt, &prompt, 512).await
}
