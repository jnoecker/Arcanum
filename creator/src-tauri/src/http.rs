use std::sync::OnceLock;

/// Shared reqwest client for connection pooling across all API modules.
/// Uses a 30-second timeout to accommodate image generation and R2 uploads.
static SHARED_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn shared_client() -> &'static reqwest::Client {
    SHARED_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client")
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
