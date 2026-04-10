use serde::{Deserialize, Serialize};

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<AnthropicMessage>,
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
        system: system_prompt.to_string(),
        messages: vec![AnthropicMessage {
            role: "user".to_string(),
            content: user_prompt.to_string(),
        }],
    };

    let client = crate::http::shared_client();
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

    let client = crate::http::shared_client();
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
