use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{deepinfra::GeneratedImage, generation, settings};

const API_URL: &str = "https://api.openai.com/v1/images/generations";

#[derive(Debug, Serialize)]
struct OpenAIImageRequest {
    model: String,
    prompt: String,
    n: u32,
    size: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    quality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    background: Option<String>,
    output_format: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIImageResponse {
    data: Vec<OpenAIImageData>,
}

#[derive(Debug, Deserialize)]
struct OpenAIImageData {
    b64_json: Option<String>,
    url: Option<String>,
}

#[tauri::command]
pub async fn openai_generate_image(
    app: AppHandle,
    prompt: String,
    model: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    quality: Option<String>,
    asset_type: Option<String>,
    auto_enhance: Option<bool>,
    transparent_background: Option<bool>,
) -> Result<GeneratedImage, String> {
    let settings = settings::get_settings(app.clone()).await?;

    // Hub mode: route through the hub's Runware proxy, which serves
    // GPT Image v2 under `openai:gpt-image@2`. The `quality` arg is ignored
    // because the hub forces "low" server-side.
    if crate::hub_ai::is_enabled(&settings) {
        let _ = quality;
        let enhanced = generation::maybe_enhance_prompt(
            &app,
            &prompt,
            asset_type.as_deref(),
            auto_enhance,
        )
        .await?;
        // Map the OpenAI model name to the Runware AIR identifier.
        let hub_model = match model.as_deref() {
            Some("gpt-image-1") | Some("gpt-image-2") | Some("openai:4@1") | Some("openai:gpt-image@2") | None => Some("openai:gpt-image@2"),
            Some(other) if other.starts_with("openai:") => Some("openai:gpt-image@2"),
            Some(_) => None,
        };
        return crate::hub_ai::generate_image(
            &app,
            &settings,
            &prompt,
            &enhanced,
            asset_type.as_deref(),
            hub_model,
            width.unwrap_or(1024),
            height.unwrap_or(1024),
            None,
            None,
            None,
            None,
            None,
            transparent_background,
        )
        .await;
    }

    if settings.openai_api_key.is_empty() {
        return Err("OpenAI API key not configured. Set it in Settings.".to_string());
    }

    // Map internal model IDs to OpenAI model names
    let model_id = match model.as_deref() {
        Some("openai:gpt-image@2") | None => "gpt-image-2".to_string(),
        Some("openai:4@1") => "gpt-image-2".to_string(),
        Some(other) => other.to_string(),
    };
    let w = width.unwrap_or(1024);
    let h = height.unwrap_or(1024);
    let final_prompt = generation::maybe_enhance_prompt(
        &app,
        &prompt,
        asset_type.as_deref(),
        auto_enhance,
    )
    .await?;
    let behavior = generation::infer_behavior(
        asset_type.as_deref(),
        w,
        h,
        transparent_background,
    );

    // OpenAI only supports specific sizes — snap to the closest valid option
    let size = snap_to_openai_size(w, h);

    let resolved_quality = quality
        .or_else(|| resolve_quality_from_settings(&settings, asset_type.as_deref()))
        .unwrap_or_else(|| "low".to_string());

    let body = OpenAIImageRequest {
        model: model_id.clone(),
        prompt: final_prompt.clone(),
        n: 1,
        size,
        // Resolution order: explicit per-call `quality` arg → per-asset-type
        // override in project settings → project default → "low" fallback.
        // Hub proxy forces "low" regardless and short-circuits above.
        quality: Some(resolved_quality),
        background: if behavior.transparent_background {
            Some("transparent".to_string())
        } else {
            None
        },
        output_format: "png".to_string(),
    };

    let client = crate::http::shared_client();
    let response = client
        .post(API_URL)
        .header("Authorization", crate::http::bearer_header(&settings.openai_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let resp: OpenAIImageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {e}"))?;

    let entry = resp.data.first().ok_or("No images in OpenAI response")?;

    let raw_bytes = if let Some(b64) = &entry.b64_json {
        base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| format!("Failed to decode base64: {e}"))?
    } else if let Some(url) = &entry.url {
        client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to download image: {e}"))?
            .bytes()
            .await
            .map_err(|e| format!("Failed to read image bytes: {e}"))?
            .to_vec()
    } else {
        return Err("OpenAI response contained no image data".to_string());
    };
    let processed = generation::process_image_bytes(&raw_bytes, &behavior)?;

    generation::persist_generated_image(
        &app,
        &processed,
        final_prompt,
        model_id,
        behavior.target_width,
        behavior.target_height,
        behavior.output_format,
    )
    .await
}

/// Resolve the OpenAI image quality from project settings, honoring an
/// optional per-AssetType override before falling back to the project default.
/// Returns None when neither is set, so the caller can apply its own fallback.
fn resolve_quality_from_settings(
    s: &settings::Settings,
    asset_type: Option<&str>,
) -> Option<String> {
    if let Some(at) = asset_type {
        if let Some(q) = s.openai_image_quality_overrides.get(at) {
            let trimmed = q.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    let trimmed = s.openai_image_quality.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// Snap arbitrary dimensions to the nearest supported OpenAI image size.
/// Supported: 1024x1024, 1024x1536, 1536x1024, and auto.
fn snap_to_openai_size(w: u32, h: u32) -> String {
    let aspect = w as f64 / h as f64;
    if aspect > 1.2 {
        "1536x1024".to_string()   // landscape
    } else if aspect < 0.8 {
        "1024x1536".to_string()   // portrait
    } else {
        "1024x1024".to_string()   // square
    }
}
