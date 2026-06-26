use serde::{Deserialize, Serialize};

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    system: Vec<SystemBlock>,
    messages: Vec<AnthropicMessage>,
}

// System prompt as a content block so we can attach `cache_control`. The
// enhancement/generation system prompts are deterministic per (world, asset
// type) and re-sent on every call; caching the prefix bills it at ~10% on
// repeats within the 5-minute TTL. Prompts below the model's minimum cacheable
// length (2048 tokens on Sonnet 4.6) silently skip caching with no penalty.
#[derive(Debug, Serialize)]
struct SystemBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_control: Option<CacheControl>,
}

#[derive(Debug, Serialize)]
struct CacheControl {
    #[serde(rename = "type")]
    cache_type: String,
}

impl SystemBlock {
    fn cached(text: &str) -> Vec<SystemBlock> {
        if text.is_empty() {
            return Vec::new();
        }
        vec![SystemBlock {
            block_type: "text".to_string(),
            text: text.to_string(),
            cache_control: Some(CacheControl {
                cache_type: "ephemeral".to_string(),
            }),
        }]
    }
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

// ─── Vision support ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ContentBlock {
    Text { text: String },
    Image { source: ImageSource },
}

#[derive(Debug, Serialize)]
struct ImageSource {
    #[serde(rename = "type")]
    source_type: String,
    media_type: String,
    data: String,
}

#[derive(Debug, Serialize)]
struct VisionMessage {
    role: String,
    content: Vec<ContentBlock>,
}

#[derive(Debug, Serialize)]
struct VisionRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<VisionMessage>,
}

// ─── Shared response types ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
}

pub async fn complete(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let body = AnthropicRequest {
        model: model.to_string(),
        max_tokens,
        system: SystemBlock::cached(system_prompt),
        messages: vec![AnthropicMessage {
            role: "user".to_string(),
            content: user_prompt.to_string(),
        }],
    };

    let client = crate::http::llm_client();
    let response = client
        .post(API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", API_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let resp: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {e}"))?;

    resp.content
        .first()
        .map(|c| c.text.clone())
        .ok_or_else(|| "No content in Anthropic response".to_string())
}

pub async fn complete_with_vision(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    image_base64: &str,
    media_type: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let body = VisionRequest {
        model: model.to_string(),
        max_tokens,
        system: system_prompt.to_string(),
        messages: vec![VisionMessage {
            role: "user".to_string(),
            content: vec![
                ContentBlock::Image {
                    source: ImageSource {
                        source_type: "base64".to_string(),
                        media_type: media_type.to_string(),
                        data: image_base64.to_string(),
                    },
                },
                ContentBlock::Text {
                    text: user_prompt.to_string(),
                },
            ],
        }],
    };

    let client = crate::http::llm_client();
    let response = client
        .post(API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", API_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let resp: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {e}"))?;

    resp.content
        .first()
        .map(|c| c.text.clone())
        .ok_or_else(|| "No content in Anthropic response".to_string())
}
