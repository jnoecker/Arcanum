use serde::{Deserialize, Serialize};

const API_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

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

pub async fn complete(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let body = ChatRequest {
        model: model.to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_prompt.to_string(),
            },
        ],
        max_tokens,
        temperature: 0.7,
    };

    let client = crate::http::shared_client();
    let response = client
        .post(API_URL)
        .header("Authorization", crate::http::bearer_header(api_key))
        .header("HTTP-Referer", "https://arcanum.dev")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenRouter API request failed: {e}"))?;

    let response = crate::http::check_response(response).await?;

    let resp: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenRouter response: {e}"))?;

    resp.choices
        .first()
        .map(|c| c.message.content.clone())
        .ok_or_else(|| "No response from OpenRouter".to_string())
}
