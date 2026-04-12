// ─── Hub AI proxy client ─────────────────────────────────────────────
//
// When settings.use_hub_ai is on, the existing provider commands
// (runware_generate_image, openai_generate_image, llm_complete,
// llm_complete_with_vision) short-circuit and call into this module
// instead of their direct-provider code paths. We forward the request
// to the Arcanum Hub's /ai/* endpoints using the user's hub API key,
// then return results in the exact same shape the frontend expects
// — the frontend is intentionally unaware that hub mode even exists.
//
// The hub enforces:
//   - model allowlist (FLUX.2, GPT Image 1.5, DeepSeek V3.2, Claude 4.6)
//   - lifetime usage quotas
//   - dimension + step caps
//   - quality clamp for GPT Image ("low" always)
//
// Errors from the hub are mapped to human-readable strings so the
// toast the frontend shows explains what happened (quota exhausted,
// auth failed, provider down, etc.).

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::deepinfra::GeneratedImage;
use crate::generation::{self, ImageBehavior};
use crate::settings::Settings;

// ─── Request/response shapes ─────────────────────────────────────────

#[derive(Debug, Serialize)]
struct HubImageRequest<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<&'a str>,
    prompt: &'a str,
    #[serde(rename = "negativePrompt", skip_serializing_if = "Option::is_none")]
    negative_prompt: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    steps: Option<u32>,
    #[serde(rename = "cfgScale", skip_serializing_if = "Option::is_none")]
    cfg_scale: Option<f32>,
    #[serde(rename = "seedImage", skip_serializing_if = "Option::is_none")]
    seed_image: Option<String>,
    #[serde(rename = "guideImage", skip_serializing_if = "Option::is_none")]
    guide_image: Option<String>,
    #[serde(rename = "transparentBackground", skip_serializing_if = "Option::is_none")]
    transparent_background: Option<bool>,
    #[serde(rename = "outputFormat")]
    output_format: &'a str,
}

#[derive(Debug, Deserialize)]
struct HubImageResponse {
    #[serde(rename = "imageURL")]
    image_url: Option<String>,
    #[serde(rename = "imageBase64Data")]
    image_base64_data: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "imageDataURI")]
    image_data_uri: Option<String>,
    #[allow(dead_code)]
    seed: Option<i64>,
    width: Option<u32>,
    height: Option<u32>,
    model: Option<String>,
    #[allow(dead_code)]
    cost: Option<f64>,
}

#[derive(Debug, Serialize)]
struct HubRemoveBgRequest<'a> {
    #[serde(rename = "imageDataUrl")]
    image_data_url: &'a str,
}

#[derive(Debug, Deserialize)]
struct HubRemoveBgResponse {
    #[serde(rename = "imageBase64Data")]
    image_base64_data: Option<String>,
    #[serde(rename = "imageURL")]
    image_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct HubLlmRequest<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<&'a str>,
    prompt: &'a str,
    #[serde(rename = "maxTokens", skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Debug, Serialize)]
struct HubVisionRequest<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<&'a str>,
    prompt: &'a str,
    #[serde(rename = "imageDataUrl")]
    image_data_url: &'a str,
    #[serde(rename = "maxTokens", skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct HubLlmResponse {
    content: String,
}

#[derive(Debug, Deserialize)]
struct HubErrorBody {
    error: Option<String>,
    message: Option<String>,
    used: Option<u64>,
    quota: Option<u64>,
}

// ─── Public API used by the dispatcher commands ─────────────────────

pub fn is_enabled(s: &Settings) -> bool {
    s.use_hub_ai && !s.hub_api_url.is_empty() && !s.hub_api_key.is_empty()
}

fn base_url(s: &Settings) -> String {
    s.hub_api_url.trim_end_matches('/').to_string()
}

/// Hub-proxied image generation. Returns a `GeneratedImage` that
/// looks identical to the one the direct-provider path produces, so
/// call sites can substitute transparently.
pub async fn generate_image(
    app: &AppHandle,
    s: &Settings,
    prompt: &str,
    enhanced_prompt_hint: &str,
    asset_type: Option<&str>,
    model: Option<&str>,
    width: u32,
    height: u32,
    negative_prompt: Option<&str>,
    steps: Option<u32>,
    guidance: Option<f32>,
    seed_image: Option<&str>,
    guide_image: Option<&str>,
    transparent_background: Option<bool>,
) -> Result<GeneratedImage, String> {
    // The frontend already passes the pre-enhanced prompt when it
    // wants enhancement; we just forward. Hub does not re-enhance.
    let behavior = generation::infer_behavior(asset_type, width, height, transparent_background);

    let body = HubImageRequest {
        model,
        prompt: enhanced_prompt_hint,
        negative_prompt,
        width: Some(width),
        height: Some(height),
        steps,
        cfg_scale: guidance,
        seed_image: seed_image.map(|s| s.to_string()),
        guide_image: guide_image.map(|s| s.to_string()),
        transparent_background,
        output_format: match behavior.output_format {
            generation::OutputFormat::Png => "PNG",
            generation::OutputFormat::Jpeg => "JPG",
        },
    };

    let url = format!("{}/ai/image/generate", base_url(s));
    let client = crate::http::shared_client();
    let response = client
        .post(&url)
        .bearer_auth(&s.hub_api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Hub request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format_hub_error(response, status).await);
    }

    let parsed: HubImageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse hub response: {e}"))?;

    // Fetch bytes — the hub returns either a signed URL or base64 data.
    let raw_bytes = if let Some(b64) = parsed.image_base64_data.as_deref() {
        base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| format!("Failed to decode hub image base64: {e}"))?
    } else if let Some(u) = parsed.image_url.as_deref() {
        client
            .get(u)
            .send()
            .await
            .map_err(|e| format!("Failed to download hub image: {e}"))?
            .bytes()
            .await
            .map_err(|e| format!("Failed to read hub image bytes: {e}"))?
            .to_vec()
    } else {
        return Err("Hub response contained no image data".to_string());
    };

    // Resize to the caller's target dimensions and persist with the
    // same helper the direct providers use, so the asset manifest,
    // dedup logic, and file paths are all identical.
    let processed = generation::process_image_bytes(&raw_bytes, &behavior)?;
    let model_label = parsed
        .model
        .unwrap_or_else(|| model.map(String::from).unwrap_or_else(|| "hub".to_string()));
    let (final_w, final_h) = (
        parsed.width.unwrap_or(behavior.target_width),
        parsed.height.unwrap_or(behavior.target_height),
    );
    let _ = (final_w, final_h); // sent to hub only for telemetry; persist uses behavior dims

    generation::persist_generated_image(
        app,
        &processed,
        prompt.to_string(),
        model_label,
        behavior.target_width,
        behavior.target_height,
        behavior.output_format,
    )
    .await
}

/// Hub-proxied background removal (Bria RMBG v2.0 via Runware).
/// Returns the processed PNG bytes as base64.
pub async fn remove_background(s: &Settings, image_data_url: &str) -> Result<String, String> {
    let body = HubRemoveBgRequest { image_data_url };
    let url = format!("{}/ai/image/remove-background", base_url(s));
    let client = crate::http::shared_client();
    let response = client
        .post(&url)
        .bearer_auth(&s.hub_api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Hub request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format_hub_error(response, status).await);
    }
    let parsed: HubRemoveBgResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse hub bg-removal response: {e}"))?;

    if let Some(b64) = parsed.image_base64_data {
        return Ok(b64);
    }
    if let Some(u) = parsed.image_url {
        let bytes = client
            .get(&u)
            .send()
            .await
            .map_err(|e| format!("Failed to download hub bg-removed image: {e}"))?
            .bytes()
            .await
            .map_err(|e| format!("Failed to read hub bg-removed image bytes: {e}"))?;
        return Ok(base64::engine::general_purpose::STANDARD.encode(&bytes));
    }
    Err("Hub bg-removal response contained no image data".to_string())
}

/// Hub-proxied text LLM completion (DeepSeek V3.2).
pub async fn complete(
    s: &Settings,
    system_prompt: &str,
    user_prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let body = HubLlmRequest {
        system: if system_prompt.is_empty() { None } else { Some(system_prompt) },
        prompt: user_prompt,
        max_tokens: Some(max_tokens),
    };
    let url = format!("{}/ai/llm/complete", base_url(s));
    let client = crate::http::shared_client();
    let response = client
        .post(&url)
        .bearer_auth(&s.hub_api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Hub request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format_hub_error(response, status).await);
    }
    let parsed: HubLlmResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse hub response: {e}"))?;
    Ok(parsed.content)
}

/// Hub-proxied vision completion (Claude Sonnet 4.6).
pub async fn complete_with_vision(
    s: &Settings,
    system_prompt: &str,
    user_prompt: &str,
    image_data_url: &str,
) -> Result<String, String> {
    let body = HubVisionRequest {
        system: if system_prompt.is_empty() { None } else { Some(system_prompt) },
        prompt: user_prompt,
        image_data_url,
        max_tokens: Some(4096),
    };
    let url = format!("{}/ai/llm/vision", base_url(s));
    let client = crate::http::shared_client();
    let response = client
        .post(&url)
        .bearer_auth(&s.hub_api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Hub request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format_hub_error(response, status).await);
    }
    let parsed: HubLlmResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse hub response: {e}"))?;
    Ok(parsed.content)
}

// ─── Error formatting ────────────────────────────────────────────────

async fn format_hub_error(response: reqwest::Response, status: reqwest::StatusCode) -> String {
    let text = response.text().await.unwrap_or_default();
    // Try to parse the structured error body for a friendlier message.
    if let Ok(body) = serde_json::from_str::<HubErrorBody>(&text) {
        let err = body.error.as_deref().unwrap_or("");
        // Publish-only tier trying to hit /ai/* — distinct from a bad
        // key so the toast can tell the user exactly what to do.
        if err == "tier_forbidden" {
            return "Your hub API key is publish-only and cannot use hub AI features. \
                    Either ask the hub admin for a full-tier key, or disable \
                    \"Use Arcanum Hub for AI generation\" in Settings → Arcanum Hub \
                    and configure a direct provider key instead."
                .to_string();
        }
        if err.starts_with("hub_quota_exceeded:") {
            let kind = err.trim_start_matches("hub_quota_exceeded:");
            if let (Some(used), Some(quota)) = (body.used, body.quota) {
                return format!(
                    "Hub quota exhausted for {kind} ({used}/{quota}). Ask the hub admin to rotate your key for a fresh allowance."
                );
            }
        }
        if let Some(msg) = body.message.or(body.error) {
            return format!("Hub error ({status}): {msg}");
        }
    }
    match status.as_u16() {
        401 => "Hub rejected your API key. Check Settings → Arcanum Hub.".to_string(),
        403 => "Hub refused the request. Your key may not have permission for this endpoint.".to_string(),
        429 => "Hub quota exceeded. Ask the admin to rotate your key.".to_string(),
        _ => format!("Hub error ({status}): {}", text.chars().take(500).collect::<String>()),
    }
}

// Unused for now but kept here so callers that want to pre-translate
// a model ID (e.g. DeepInfra FLUX → Runware FLUX) have one place.
#[allow(dead_code)]
pub fn translate_model_for_hub(direct_model: &str) -> Option<&'static str> {
    match direct_model {
        // DeepInfra FLUX variants → Runware FLUX.2 commercial
        m if m.contains("FLUX-1-dev") || m.contains("FLUX-1-schnell") || m.contains("FLUX-1-pro") => {
            Some("runware:400@2")
        }
        "gpt-image-1" => Some("openai:4@1"),
        _ => None,
    }
}

// Silences "unused import" when image behavior is only used to decide
// output format.
#[allow(dead_code)]
fn _behavior_type_anchor(_b: ImageBehavior) {}
