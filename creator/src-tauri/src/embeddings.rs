// ─── Embedding dispatcher ────────────────────────────────────────────
//
// Mirrors the hub_ai short-circuit pattern used by the existing AI
// provider modules: when settings.use_hub_ai is on, requests go to the
// Arcanum Hub's /ai/embed endpoint. Otherwise we call Voyage AI's API
// directly using the user's voyage_api_key.
//
// Model: voyage-3-lite (512 dimensions). Voyage caps each request at
// 128 inputs, so larger batches are chunked transparently.

use serde::{Deserialize, Serialize};

use crate::settings::Settings;

pub const EMBEDDING_MODEL: &str = "voyage-3-lite";
pub const EMBEDDING_DIM: u32 = 512;
const VOYAGE_BATCH_LIMIT: usize = 128;
const VOYAGE_URL: &str = "https://api.voyageai.com/v1/embeddings";

#[derive(Debug, Serialize)]
struct EmbedRequest<'a> {
    model: &'a str,
    input: &'a [String],
}

#[derive(Debug, Deserialize)]
struct VoyageResponse {
    data: Vec<VoyageItem>,
}

#[derive(Debug, Deserialize)]
struct VoyageItem {
    embedding: Vec<f32>,
}

#[derive(Debug, Deserialize)]
struct HubEmbedResponse {
    embeddings: Vec<Vec<f32>>,
    #[allow(dead_code)]
    model: Option<String>,
}

/// Embed a batch of input strings. Returns one vector per input, in
/// the same order. Chunks the request to respect provider batch caps.
pub async fn embed(s: &Settings, inputs: &[String]) -> Result<Vec<Vec<f32>>, String> {
    if inputs.is_empty() {
        return Ok(Vec::new());
    }

    let mut out: Vec<Vec<f32>> = Vec::with_capacity(inputs.len());
    for chunk in inputs.chunks(VOYAGE_BATCH_LIMIT) {
        let mut batch = embed_batch(s, chunk).await?;
        out.append(&mut batch);
    }
    Ok(out)
}

async fn embed_batch(s: &Settings, inputs: &[String]) -> Result<Vec<Vec<f32>>, String> {
    if crate::hub_ai::is_enabled(s) {
        return embed_via_hub(s, inputs).await;
    }
    embed_via_voyage(s, inputs).await
}

async fn embed_via_hub(s: &Settings, inputs: &[String]) -> Result<Vec<Vec<f32>>, String> {
    let url = format!("{}/ai/embed", s.hub_api_url.trim_end_matches('/'));
    let body = EmbedRequest {
        model: EMBEDDING_MODEL,
        input: inputs,
    };
    let client = crate::http::shared_client();
    let response = client
        .post(&url)
        .bearer_auth(&s.hub_api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Hub embed request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!(
            "Hub embed error ({status}): {}",
            text.chars().take(500).collect::<String>()
        ));
    }
    let parsed: HubEmbedResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse hub embed response: {e}"))?;
    Ok(parsed.embeddings)
}

async fn embed_via_voyage(s: &Settings, inputs: &[String]) -> Result<Vec<Vec<f32>>, String> {
    if s.voyage_api_key.is_empty() {
        return Err(
            "Voyage AI API key not configured. Set it in Settings, or enable Arcanum Hub AI."
                .to_string(),
        );
    }
    let body = EmbedRequest {
        model: EMBEDDING_MODEL,
        input: inputs,
    };
    let client = crate::http::shared_client();
    let response = client
        .post(VOYAGE_URL)
        .bearer_auth(&s.voyage_api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Voyage embed request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!(
            "Voyage embed error ({status}): {}",
            text.chars().take(500).collect::<String>()
        ));
    }
    let parsed: VoyageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Voyage embed response: {e}"))?;
    Ok(parsed.data.into_iter().map(|d| d.embedding).collect())
}
