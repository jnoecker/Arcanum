use std::sync::OnceLock;

/// Shared reqwest client for connection pooling across all API modules.
/// Total timeout is sized for image generation (FLUX.2 at 1024px through
/// the hub can take ~30–90s in practice), while connect_timeout stays
/// short so DNS or TLS failures still fail fast instead of stalling the
/// whole timeout budget.
static SHARED_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn shared_client() -> &'static reqwest::Client {
    SHARED_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("Failed to build HTTP client")
    })
}

/// Dedicated client for text LLM completions. These are non-streaming, so the
/// total timeout has to cover the full generation time — a large zone can ask
/// for up to 16k output tokens, which is several minutes of wall-clock. The
/// 120s budget on `shared_client` (sized for image generation) cuts those off
/// mid-flight and surfaces as "error sending request for url". connect_timeout
/// stays short so dead connections still fail fast.
static LLM_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn llm_client() -> &'static reqwest::Client {
    LLM_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .timeout(std::time::Duration::from_secs(600))
            .build()
            .expect("Failed to build LLM HTTP client")
    })
}

/// Build a Bearer authorization header value.
pub fn bearer_header(api_key: &str) -> String {
    format!("Bearer {api_key}")
}

/// Check an HTTP response for success. On failure, reads the response body
/// and returns a formatted error. On success, passes the response through
/// so the caller can continue extracting data.
pub async fn check_response(resp: reqwest::Response) -> Result<reqwest::Response, String> {
    if resp.status().is_success() {
        Ok(resp)
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("HTTP error ({status}): {text}"))
    }
}
