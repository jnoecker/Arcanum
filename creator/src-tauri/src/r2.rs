use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::assets::{self, AssetEntry};
use crate::settings;

type HmacSha256 = Hmac<Sha256>;

// ─── Types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncProgress {
    pub total: usize,
    pub uploaded: usize,
    pub skipped: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

// ─── AWS Signature V4 (minimal, for S3-compatible R2) ───────────────

fn sign_key(key: &[u8], date: &str, region: &str, service: &str) -> Vec<u8> {
    let k_date = hmac_sha256(&format!("AWS4{}", String::from_utf8_lossy(key)).into_bytes(), date.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, service.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// Build a signed PUT request for R2 (S3-compatible).
fn build_signed_put(
    account_id: &str,
    bucket: &str,
    access_key: &str,
    secret_key: &str,
    object_key: &str,
    body: &[u8],
    content_type: &str,
) -> Result<(String, Vec<(String, String)>), String> {
    let host = format!("{bucket}.{account_id}.r2.cloudflarestorage.com");
    let url = format!("https://{host}/{object_key}");
    let now = Utc::now();
    let date_stamp = now.format("%Y%m%d").to_string();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let region = "auto";
    let service = "s3";

    let payload_hash = sha256_hex(body);

    // Canonical request
    let canonical_headers = format!(
        "content-type:{content_type}\nhost:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
    );
    let signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date";
    let canonical_request = format!(
        "PUT\n/{object_key}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    );

    let credential_scope = format!("{date_stamp}/{region}/{service}/aws4_request");
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    );

    let signing_key = sign_key(secret_key.as_bytes(), &date_stamp, region, service);
    let signature = hex::encode(hmac_sha256(&signing_key, string_to_sign.as_bytes()));

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    );

    let headers = vec![
        ("Content-Type".to_string(), content_type.to_string()),
        ("Host".to_string(), host),
        ("x-amz-date".to_string(), amz_date),
        ("x-amz-content-sha256".to_string(), payload_hash),
        ("Authorization".to_string(), authorization),
    ];

    Ok((url, headers))
}

/// Build a signed HEAD request for R2.
fn build_signed_head(
    account_id: &str,
    bucket: &str,
    access_key: &str,
    secret_key: &str,
    object_key: &str,
) -> Result<(String, Vec<(String, String)>), String> {
    let host = format!("{bucket}.{account_id}.r2.cloudflarestorage.com");
    let url = format!("https://{host}/{object_key}");
    let now = Utc::now();
    let date_stamp = now.format("%Y%m%d").to_string();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let region = "auto";
    let service = "s3";

    let payload_hash = sha256_hex(b""); // empty body for HEAD

    let canonical_headers = format!(
        "host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
    );
    let signed_headers = "host;x-amz-content-sha256;x-amz-date";
    let canonical_request = format!(
        "HEAD\n/{object_key}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    );

    let credential_scope = format!("{date_stamp}/{region}/{service}/aws4_request");
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    );

    let signing_key = sign_key(secret_key.as_bytes(), &date_stamp, region, service);
    let signature = hex::encode(hmac_sha256(&signing_key, string_to_sign.as_bytes()));

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    );

    let headers = vec![
        ("Host".to_string(), host),
        ("x-amz-date".to_string(), amz_date),
        ("x-amz-content-sha256".to_string(), payload_hash),
        ("Authorization".to_string(), authorization),
    ];

    Ok((url, headers))
}

/// Build a signed DELETE request for R2.
fn build_signed_delete(
    account_id: &str,
    bucket: &str,
    access_key: &str,
    secret_key: &str,
    object_key: &str,
) -> Result<(String, Vec<(String, String)>), String> {
    let host = format!("{bucket}.{account_id}.r2.cloudflarestorage.com");
    let url = format!("https://{host}/{object_key}");
    let now = Utc::now();
    let date_stamp = now.format("%Y%m%d").to_string();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let region = "auto";
    let service = "s3";

    let payload_hash = sha256_hex(b""); // empty body for DELETE

    let canonical_headers = format!(
        "host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
    );
    let signed_headers = "host;x-amz-content-sha256;x-amz-date";
    let canonical_request = format!(
        "DELETE\n/{object_key}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    );

    let credential_scope = format!("{date_stamp}/{region}/{service}/aws4_request");
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    );

    let signing_key = sign_key(secret_key.as_bytes(), &date_stamp, region, service);
    let signature = hex::encode(hmac_sha256(&signing_key, string_to_sign.as_bytes()));

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    );

    let headers = vec![
        ("Host".to_string(), host),
        ("x-amz-date".to_string(), amz_date),
        ("x-amz-content-sha256".to_string(), payload_hash),
        ("Authorization".to_string(), authorization),
    ];

    Ok((url, headers))
}

// ─── R2 operations ──────────────────────────────────────────────────

fn detect_content_type(file_name: &str) -> &'static str {
    if file_name.ends_with(".jpg") || file_name.ends_with(".jpeg") {
        "image/jpeg"
    } else if file_name.ends_with(".webp") {
        "image/webp"
    } else if file_name.ends_with(".mp4") {
        "video/mp4"
    } else if file_name.ends_with(".webm") {
        "video/webm"
    } else if file_name.ends_with(".mp3") {
        "audio/mpeg"
    } else if file_name.ends_with(".ogg") {
        "audio/ogg"
    } else if file_name.ends_with(".flac") {
        "audio/flac"
    } else if file_name.ends_with(".wav") {
        "audio/wav"
    } else {
        "image/png"
    }
}

/// Check if an object already exists in R2.
async fn object_exists(
    client: &reqwest::Client,
    account_id: &str,
    bucket: &str,
    access_key: &str,
    secret_key: &str,
    object_key: &str,
) -> Result<bool, String> {
    let (url, headers) = build_signed_head(account_id, bucket, access_key, secret_key, object_key)?;

    let mut req = client.head(&url);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }

    let resp = req.send().await.map_err(|e| format!("HEAD request failed: {e}"))?;
    Ok(resp.status().is_success())
}

/// Upload a file to R2.
async fn upload_object(
    client: &reqwest::Client,
    account_id: &str,
    bucket: &str,
    access_key: &str,
    secret_key: &str,
    object_key: &str,
    body: Vec<u8>,
    content_type: &str,
) -> Result<(), String> {
    let (url, headers) = build_signed_put(
        account_id, bucket, access_key, secret_key, object_key, &body, content_type,
    )?;

    let mut req = client.put(&url).body(body);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }

    let resp = req.send().await.map_err(|e| format!("PUT request failed: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("R2 upload failed ({status}): {text}"));
    }
    Ok(())
}

// ─── Tauri commands ─────────────────────────────────────────────────

fn assets_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("assets"))
}

/// Find a media file across all asset subdirectories.
fn find_asset_file(base: &Path, file_name: &str) -> Option<PathBuf> {
    for subdir in &["images", "video", "audio"] {
        let path = base.join(subdir).join(file_name);
        if path.exists() {
            return Some(path);
        }
    }
    None
}

#[tauri::command]
pub async fn sync_assets(app: AppHandle) -> Result<SyncProgress, String> {
    let s = settings::get_settings(app.clone()).await?;
    if s.r2_account_id.is_empty() || s.r2_access_key_id.is_empty() || s.r2_secret_access_key.is_empty() || s.r2_bucket.is_empty() {
        return Err("R2 credentials not configured. Set them in Settings.".to_string());
    }

    let assets = assets::list_assets(app.clone()).await?;
    let unsynced: Vec<&AssetEntry> = assets.iter().filter(|a| a.sync_status != "synced").collect();
    let base_dir = assets_base_dir(&app)?;
    let client = reqwest::Client::new();

    let mut progress = SyncProgress {
        total: unsynced.len(),
        uploaded: 0,
        skipped: 0,
        failed: 0,
        errors: Vec::new(),
    };

    for asset in &unsynced {
        let object_key = &asset.file_name;

        // Check if already exists in R2 (dedup by content hash)
        match object_exists(&client, &s.r2_account_id, &s.r2_bucket, &s.r2_access_key_id, &s.r2_secret_access_key, object_key).await {
            Ok(true) => {
                // Already in R2, just mark as synced
                assets::update_sync_status(app.clone(), &asset.id, "synced").await?;
                progress.skipped += 1;
                continue;
            }
            Ok(false) => {}
            Err(e) => {
                progress.failed += 1;
                progress.errors.push(format!("{}: {e}", asset.file_name));
                continue;
            }
        }

        // Read local file
        let file_path = match find_asset_file(&base_dir, &asset.file_name) {
            Some(p) => p,
            None => {
                progress.failed += 1;
                progress.errors.push(format!("{}: File not found in asset dirs", asset.file_name));
                continue;
            }
        };
        let body = match tokio::fs::read(&file_path).await {
            Ok(b) => b,
            Err(e) => {
                progress.failed += 1;
                progress.errors.push(format!("{}: Failed to read file: {e}", asset.file_name));
                continue;
            }
        };

        let content_type = detect_content_type(&asset.file_name);

        // Upload
        match upload_object(
            &client,
            &s.r2_account_id,
            &s.r2_bucket,
            &s.r2_access_key_id,
            &s.r2_secret_access_key,
            object_key,
            body,
            content_type,
        ).await {
            Ok(()) => {
                assets::update_sync_status(app.clone(), &asset.id, "synced").await?;
                progress.uploaded += 1;
            }
            Err(e) => {
                progress.failed += 1;
                progress.errors.push(format!("{}: {e}", asset.file_name));
            }
        }
    }

    Ok(progress)
}

#[tauri::command]
pub async fn get_sync_status(app: AppHandle) -> Result<SyncProgress, String> {
    let assets = assets::list_assets(app).await?;
    let synced = assets.iter().filter(|a| a.sync_status == "synced").count();
    let unsynced = assets.len() - synced;
    Ok(SyncProgress {
        total: assets.len(),
        uploaded: synced,
        skipped: 0,
        failed: unsynced,
        errors: Vec::new(),
    })
}

/// Delete an object from R2.
async fn delete_object(
    client: &reqwest::Client,
    account_id: &str,
    bucket: &str,
    access_key: &str,
    secret_key: &str,
    object_key: &str,
) -> Result<(), String> {
    let (url, headers) = build_signed_delete(account_id, bucket, access_key, secret_key, object_key)?;

    let mut req = client.delete(&url);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }

    let resp = req.send().await.map_err(|e| format!("DELETE request failed: {e}"))?;
    // R2 returns 204 on success, 404 if already gone — both are fine
    if !resp.status().is_success() && resp.status().as_u16() != 404 {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("R2 delete failed ({status}): {text}"));
    }
    Ok(())
}

/// Delete an asset from R2 by its file_name. Best-effort: does not fail the
/// overall delete if R2 credentials are missing or the request errors.
#[tauri::command]
pub async fn delete_from_r2(app: AppHandle, file_name: String) -> Result<(), String> {
    let s = settings::get_settings(app).await?;
    if s.r2_account_id.is_empty() || s.r2_access_key_id.is_empty() || s.r2_secret_access_key.is_empty() || s.r2_bucket.is_empty() {
        // No R2 configured — nothing to delete remotely
        return Ok(());
    }

    let client = reqwest::Client::new();
    delete_object(
        &client,
        &s.r2_account_id,
        &s.r2_bucket,
        &s.r2_access_key_id,
        &s.r2_secret_access_key,
        &file_name,
    ).await
}

/// Deploy player sprites to R2 under their canonical path names.
/// Each sprite asset with variant_group "player_sprite:{key}" gets uploaded
/// as "player_sprites/{key}.png" so the game server can find them.
#[tauri::command]
pub async fn deploy_sprites_to_r2(app: AppHandle) -> Result<SyncProgress, String> {
    let s = settings::get_settings(app.clone()).await?;
    if s.r2_account_id.is_empty()
        || s.r2_access_key_id.is_empty()
        || s.r2_secret_access_key.is_empty()
        || s.r2_bucket.is_empty()
    {
        return Err("R2 credentials not configured. Set them in Settings.".to_string());
    }

    let all_assets = assets::list_assets(app.clone()).await?;
    let sprites: Vec<&AssetEntry> = all_assets
        .iter()
        .filter(|a| a.asset_type == "player_sprite" && a.variant_group.starts_with("player_sprite:"))
        .collect();

    let base_dir = assets_base_dir(&app)?;
    let client = reqwest::Client::new();

    let mut progress = SyncProgress {
        total: sprites.len(),
        uploaded: 0,
        skipped: 0,
        failed: 0,
        errors: Vec::new(),
    };

    for asset in &sprites {
        // Derive canonical R2 path: "player_sprite:human_male_warrior_l1" → "player_sprites/human_male_warrior_l1.png"
        let sprite_key = asset.variant_group.strip_prefix("player_sprite:").unwrap();
        let object_key = format!("player_sprites/{sprite_key}.png");

        // Read local file
        let file_path = match find_asset_file(&base_dir, &asset.file_name) {
            Some(p) => p,
            None => {
                progress.failed += 1;
                progress
                    .errors
                    .push(format!("{object_key}: Local file not found"));
                continue;
            }
        };
        let body = match tokio::fs::read(&file_path).await {
            Ok(b) => b,
            Err(e) => {
                progress.failed += 1;
                progress
                    .errors
                    .push(format!("{object_key}: Failed to read: {e}"));
                continue;
            }
        };

        // Upload under canonical path
        match upload_object(
            &client,
            &s.r2_account_id,
            &s.r2_bucket,
            &s.r2_access_key_id,
            &s.r2_secret_access_key,
            &object_key,
            body,
            "image/png",
        )
        .await
        {
            Ok(()) => {
                progress.uploaded += 1;
            }
            Err(e) => {
                progress.failed += 1;
                progress.errors.push(format!("{object_key}: {e}"));
            }
        }
    }

    Ok(progress)
}

/// Deploy global assets to R2 under their canonical path names.
/// Each entry in the global_assets map (key → hash filename) gets uploaded
/// as "global_assets/{key}.{ext}" so the game server can find them.
#[tauri::command]
pub async fn deploy_global_assets_to_r2(
    app: AppHandle,
    global_assets: std::collections::HashMap<String, String>,
) -> Result<SyncProgress, String> {
    let s = settings::get_settings(app.clone()).await?;
    if s.r2_account_id.is_empty()
        || s.r2_access_key_id.is_empty()
        || s.r2_secret_access_key.is_empty()
        || s.r2_bucket.is_empty()
    {
        return Err("R2 credentials not configured. Set them in Settings.".to_string());
    }

    // Filter out entries with empty filenames
    let entries: Vec<(&String, &String)> = global_assets
        .iter()
        .filter(|(_, v)| !v.is_empty())
        .collect();

    let base_dir = assets_base_dir(&app)?;
    let client = reqwest::Client::new();

    let mut progress = SyncProgress {
        total: entries.len(),
        uploaded: 0,
        skipped: 0,
        failed: 0,
        errors: Vec::new(),
    };

    for (key, file_name) in &entries {
        // Determine extension from the hash filename, default to .png
        let ext = file_name
            .rsplit('.')
            .next()
            .filter(|e| !e.is_empty() && e.len() <= 4)
            .unwrap_or("png");
        let object_key = format!("global_assets/{key}.{ext}");

        // Read local file
        let file_path = match find_asset_file(&base_dir, file_name) {
            Some(p) => p,
            None => {
                progress.failed += 1;
                progress
                    .errors
                    .push(format!("{object_key}: Local file not found"));
                continue;
            }
        };
        let body = match tokio::fs::read(&file_path).await {
            Ok(b) => b,
            Err(e) => {
                progress.failed += 1;
                progress
                    .errors
                    .push(format!("{object_key}: Failed to read: {e}"));
                continue;
            }
        };

        let content_type = detect_content_type(file_name);

        // Upload under canonical path
        match upload_object(
            &client,
            &s.r2_account_id,
            &s.r2_bucket,
            &s.r2_access_key_id,
            &s.r2_secret_access_key,
            &object_key,
            body,
            content_type,
        )
        .await
        {
            Ok(()) => {
                progress.uploaded += 1;
            }
            Err(e) => {
                progress.failed += 1;
                progress.errors.push(format!("{object_key}: {e}"));
            }
        }
    }

    Ok(progress)
}

/// Resolve an asset file_name to its public R2 URL via custom domain.
#[tauri::command]
pub async fn resolve_asset_url(app: AppHandle, file_name: String) -> Result<String, String> {
    let s = settings::get_settings(app).await?;
    if s.r2_custom_domain.is_empty() {
        return Err("R2 custom domain not configured".to_string());
    }
    let domain = s.r2_custom_domain.trim_end_matches('/');
    Ok(format!("{domain}/{file_name}"))
}
