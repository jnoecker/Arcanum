use tauri::AppHandle;

use crate::{anthropic, openrouter, settings};

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
            return result[..start].trim().to_string();
        }
    }
    result.to_string()
}

/// Unified LLM completion command that dispatches to the configured provider.
#[tauri::command]
pub async fn llm_complete(
    app: AppHandle,
    system_prompt: String,
    user_prompt: String,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    let max_tokens = max_tokens.unwrap_or(1024);
    let s = settings::get_settings(app.clone()).await?;

    let raw = match s.prompt_llm_provider.as_str() {
        "anthropic" => {
            if s.anthropic_api_key.is_empty() {
                return Err("Anthropic API key not configured. Set it in Settings.".to_string());
            }
            anthropic::complete(
                &s.anthropic_api_key,
                "claude-sonnet-4-20250514",
                &system_prompt,
                &user_prompt,
                max_tokens,
            )
            .await?
        }
        "openrouter" => {
            if s.openrouter_api_key.is_empty() {
                return Err("OpenRouter API key not configured. Set it in Settings.".to_string());
            }
            openrouter::complete(
                &s.openrouter_api_key,
                &s.enhance_model,
                &system_prompt,
                &user_prompt,
                max_tokens,
            )
            .await?
        }
        _ => {
            // Default: deepinfra
            if s.deepinfra_api_key.is_empty() {
                return Err(
                    "DeepInfra API key not configured. Set it in Settings.".to_string(),
                );
            }
            let chat_url = "https://api.deepinfra.com/v1/openai/chat/completions";

            let body = serde_json::json!({
                "model": s.enhance_model,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": user_prompt }
                ],
                "max_tokens": max_tokens,
                "temperature": 0.7
            });

            let client = reqwest::Client::new();
            let response = client
                .post(chat_url)
                .header("Authorization", format!("Bearer {}", s.deepinfra_api_key))
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("DeepInfra API request failed: {e}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                return Err(format!("DeepInfra API error ({status}): {text}"));
            }

            let resp: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {e}"))?;

            resp["choices"][0]["message"]["content"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "No response content from DeepInfra".to_string())?
        }
    };

    Ok(strip_think_tags(raw.trim()))
}
