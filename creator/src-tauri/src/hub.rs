// ─── Hub publish pipeline ────────────────────────────────────────────
//
// Uploads a world's lore (showcase JSON + referenced images) to the
// Arcanum Hub — a central multi-tenant site hosted by the admin. The
// self-hosted R2 flow in r2.rs is untouched; this is an additive,
// opt-in second destination.
//
// Flow:
//   1. Re-encode every image referenced by the showcase as lossy WebP,
//      using the same runtime profiles as the self-hosted path (size
//      caps per asset type) but guaranteeing WebP output for smaller
//      files on the hub.
//   2. SHA-256 each WebP blob. The blob's filename on the hub is
//      `<hash>.webp`, content-addressed.
//   3. Rewrite the ShowcaseData so every image URL points at
//      `https://<slug>.<hub-root>/images/<hash>.webp` and
//      `meta.imageBaseUrl` matches.
//   4. Ask the hub which hashes it already has for this world (dedup
//      across publishes — only new blobs get uploaded).
//   5. Upload missing WebP blobs via PUT, then POST the rewritten
//      manifest JSON. A progress callback fires after each step so the
//      UI can render a bar.
//
// The `cinematicUrl` field on each ShowcaseStory is stripped before
// upload — the user asked that stories appear on the hub as concepts
// only, not finished MP4s.

use image::imageops::FilterType as ResizeFilter;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

use crate::assets::{self, AssetEntry};
use crate::settings;

// ─── Public API shape ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HubPublishRequest {
    /// ShowcaseData serialized to JSON, exactly as the frontend would
    /// pass to `deploy_showcase_to_r2`.
    pub showcase_json: String,
    /// World slug. Must be 3-32 chars, `[a-z0-9][a-z0-9-]*[a-z0-9]`.
    pub slug: String,
    /// Whether to list this world on the hub's public landing page.
    pub listed: bool,
    /// Optional display name (defaults to showcase worldName).
    pub display_name: Option<String>,
    /// Optional tagline (defaults to showcase tagline).
    pub tagline: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HubPublishResult {
    pub slug: String,
    pub url: String,
    pub images_total: usize,
    pub images_uploaded: usize,
    pub images_reused: usize,
    pub images_failed: usize,
    pub bytes_uploaded: u64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct HubPublishProgress {
    phase: String,
    current: usize,
    total: usize,
    label: String,
}

// ─── Tauri command ───────────────────────────────────────────────────

#[tauri::command]
pub async fn publish_to_hub(
    app: AppHandle,
    request: HubPublishRequest,
) -> Result<HubPublishResult, String> {
    let s = settings::get_settings(app.clone()).await?;
    let hub_api_url = s.hub_api_url.trim_end_matches('/').to_string();
    if hub_api_url.is_empty() {
        return Err("Hub API URL not configured. Set it in Settings → Hub.".to_string());
    }
    if s.hub_api_key.is_empty() {
        return Err("Hub API key not configured. Set it in Settings → Hub.".to_string());
    }
    if !is_valid_slug(&request.slug) {
        return Err(format!(
            "Invalid world slug '{}'. Must be 3-32 chars, a-z0-9-.",
            request.slug
        ));
    }

    // Parse the showcase payload so we can rewrite image URLs.
    let mut showcase: serde_json::Value = serde_json::from_str(&request.showcase_json)
        .map_err(|e| format!("Failed to parse showcase JSON: {e}"))?;

    // ─── 1. Strip finished video artifacts per user decision ────────
    strip_cinematic_urls(&mut showcase);

    // Build a lookup from existing R2 URLs → local asset. We walk the
    // self-hosted custom domain prefix (if any) off the front of every
    // image URL to find the matching asset file on disk.
    let self_hosted_prefix = s.r2_custom_domain.trim_end_matches('/').to_string();
    let mut found_refs: HashSet<String> = HashSet::new();
    collect_image_filenames(&showcase, &self_hosted_prefix, &mut found_refs);

    emit_progress(
        &app,
        "collecting",
        0,
        found_refs.len(),
        "Collecting images",
    );

    // Look up assets by their file_name. Images that can't be resolved
    // are skipped (they end up with broken URLs on the hub, but we
    // report them in `errors`).
    let all_assets = assets::list_assets(app.clone()).await?;
    let asset_by_filename: HashMap<String, &AssetEntry> = all_assets
        .iter()
        .map(|a| (a.file_name.clone(), a))
        .collect();

    let base_dir = assets_base_dir(&app)?;

    // ─── 2. Re-encode referenced images as lossy WebP ────────────────
    #[derive(Debug, Clone)]
    struct HubImage {
        original_filename: String,
        hub_filename: String, // "<hash>.webp"
        bytes: Vec<u8>,
    }

    let mut hub_images: Vec<HubImage> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    let total_images = found_refs.len();
    for (i, original) in found_refs.iter().enumerate() {
        emit_progress(
            &app,
            "encoding",
            i,
            total_images,
            &format!("Encoding {}", original),
        );

        let asset = asset_by_filename.get(original);
        let asset_type = asset.map(|a| a.asset_type.as_str()).unwrap_or("unknown");

        let source_path = match asset {
            Some(_) => match find_asset_file(&base_dir, original) {
                Some(p) => p,
                None => {
                    errors.push(format!("{}: local file missing", original));
                    continue;
                }
            },
            None => {
                errors.push(format!("{}: asset not in manifest", original));
                continue;
            }
        };

        let bytes = match tokio::fs::read(&source_path).await {
            Ok(b) => b,
            Err(e) => {
                errors.push(format!("{}: read failed: {e}", original));
                continue;
            }
        };

        let webp = match encode_hub_webp(asset_type, &bytes) {
            Ok(w) => w,
            Err(e) => {
                errors.push(format!("{}: encode failed: {e}", original));
                continue;
            }
        };

        let hash = sha256_hex(&webp);
        hub_images.push(HubImage {
            original_filename: original.clone(),
            hub_filename: format!("{hash}.webp"),
            bytes: webp,
        });
    }
    emit_progress(&app, "encoding", total_images, total_images, "Encoded");

    // ─── 3. Rewrite ShowcaseData URLs ────────────────────────────────
    // Build a map from original filename → hub filename, then walk the
    // JSON tree and rewrite every string that references a filename we
    // re-encoded. The new imageBaseUrl points at the hub subdomain.
    let rename_map: HashMap<String, String> = hub_images
        .iter()
        .map(|img| (img.original_filename.clone(), img.hub_filename.clone()))
        .collect();

    // Derive the hub root domain from the API URL. A URL like
    // `https://api.hub.arcanum.app` → root domain `hub.arcanum.app`.
    let hub_root_domain = derive_hub_root(&hub_api_url);
    let image_base_url = format!("https://{}.{}", request.slug, hub_root_domain);

    rewrite_image_refs(
        &mut showcase,
        &self_hosted_prefix,
        &rename_map,
        &image_base_url,
    );

    // Re-stringify for upload.
    let rewritten_json = serde_json::to_string(&showcase)
        .map_err(|e| format!("Failed to serialize rewritten showcase: {e}"))?;

    // ─── 4. Ask hub which images already exist ──────────────────────
    let client = crate::http::shared_client();
    let hashes_for_request: Vec<String> = hub_images.iter().map(|i| i.hub_filename.clone()).collect();

    let existing_set = match check_existing(
        &client,
        &hub_api_url,
        &s.hub_api_key,
        &request.slug,
        &hashes_for_request,
    )
    .await
    {
        Ok(set) => set,
        Err(e) => {
            // Non-fatal: fall back to "nothing exists" and try to upload
            // everything. The server will accept duplicates idempotently.
            errors.push(format!("check-existing failed: {e}"));
            HashSet::new()
        }
    };

    // ─── 5. Upload missing images, then manifest ─────────────────────
    let mut images_uploaded = 0usize;
    let mut images_reused = 0usize;
    let mut bytes_uploaded: u64 = 0;

    let total_to_upload = hub_images.len();
    for (i, img) in hub_images.iter().enumerate() {
        emit_progress(
            &app,
            "uploading",
            i,
            total_to_upload,
            &format!("Uploading {}", img.hub_filename),
        );
        if existing_set.contains(&img.hub_filename) {
            images_reused += 1;
            continue;
        }
        match upload_image(
            &client,
            &hub_api_url,
            &s.hub_api_key,
            &request.slug,
            &img.hub_filename,
            img.bytes.clone(),
        )
        .await
        {
            Ok(()) => {
                images_uploaded += 1;
                bytes_uploaded += img.bytes.len() as u64;
            }
            Err(e) => {
                errors.push(format!("{}: upload failed: {e}", img.hub_filename));
            }
        }
    }
    emit_progress(
        &app,
        "uploading",
        total_to_upload,
        total_to_upload,
        "Uploaded",
    );

    // Upload the manifest last so the hub never serves JSON that
    // references images it doesn't yet have.
    emit_progress(&app, "manifest", 0, 1, "Publishing manifest");
    let manifest_url = upload_manifest(
        &client,
        &hub_api_url,
        &s.hub_api_key,
        &request.slug,
        request.listed,
        request.display_name.clone(),
        request.tagline.clone(),
        &rewritten_json,
    )
    .await?;
    emit_progress(&app, "manifest", 1, 1, "Manifest published");

    let images_failed = total_images.saturating_sub(images_uploaded + images_reused);

    Ok(HubPublishResult {
        slug: request.slug,
        url: manifest_url,
        images_total: total_images,
        images_uploaded,
        images_reused,
        images_failed,
        bytes_uploaded,
        errors,
    })
}

// ─── Image encoding ──────────────────────────────────────────────────

/// Runtime profiles for the self-hosted path. Reused here unchanged so
/// the hub has the same dimension caps. Quality is bumped to 78 for
/// WebP (roughly matches JPEG 85 at ~half the file size).
#[derive(Debug, Clone, Copy)]
struct HubImageProfile {
    max_width: u32,
    max_height: u32,
    quality: f32,
}

fn hub_profile(asset_type: &str) -> HubImageProfile {
    match asset_type {
        "player_sprite" | "ability_icon" | "status_effect_icon" | "ability_sprite"
        | "item" | "lore_item" | "status_art" => HubImageProfile {
            max_width: 256,
            max_height: 256,
            quality: 80.0,
        },
        "mob" | "pet" | "entity_portrait" | "race_portrait" | "class_portrait"
        | "lore_character" | "lore_species" => HubImageProfile {
            max_width: 512,
            max_height: 768,
            quality: 80.0,
        },
        "room" | "background" | "zone_map" | "splash_hero" | "panel_header"
        | "loading_vignette" | "empty_state" | "ornament" | "lore_location" => {
            HubImageProfile {
                max_width: 1280,
                max_height: 1280,
                quality: 78.0,
            }
        }
        "lore_map" => HubImageProfile {
            max_width: 2048,
            max_height: 2048,
            quality: 80.0,
        },
        _ => HubImageProfile {
            max_width: 1024,
            max_height: 1024,
            quality: 78.0,
        },
    }
}

fn encode_hub_webp(asset_type: &str, bytes: &[u8]) -> Result<Vec<u8>, String> {
    let profile = hub_profile(asset_type);
    let img = image::load_from_memory(bytes).map_err(|e| format!("decode failed: {e}"))?;

    let resized = if img.width() > profile.max_width || img.height() > profile.max_height {
        img.resize(profile.max_width, profile.max_height, ResizeFilter::Lanczos3)
    } else {
        img
    };

    // libwebp wants RGB8 or RGBA8. Preserve alpha only if the source has it.
    let has_alpha = resized.color().has_alpha();
    let encoded = if has_alpha {
        let rgba = resized.to_rgba8();
        let (w, h) = rgba.dimensions();
        let encoder = webp::Encoder::from_rgba(rgba.as_raw(), w, h);
        encoder.encode(profile.quality).to_vec()
    } else {
        let rgb = resized.to_rgb8();
        let (w, h) = rgb.dimensions();
        let encoder = webp::Encoder::from_rgb(rgb.as_raw(), w, h);
        encoder.encode(profile.quality).to_vec()
    };

    if encoded.is_empty() {
        return Err("webp encoder returned empty buffer".to_string());
    }
    Ok(encoded)
}

// ─── JSON rewriting ──────────────────────────────────────────────────

/// Walk the showcase JSON and collect every string that looks like an
/// image URL referencing our self-hosted R2 custom domain, returning
/// the raw filenames.
fn collect_image_filenames(value: &serde_json::Value, prefix: &str, out: &mut HashSet<String>) {
    match value {
        serde_json::Value::String(s) => {
            if let Some(name) = filename_from_url(s, prefix) {
                out.insert(name);
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                collect_image_filenames(v, prefix, out);
            }
        }
        serde_json::Value::Object(obj) => {
            for (_k, v) in obj {
                collect_image_filenames(v, prefix, out);
            }
        }
        _ => {}
    }
}

/// Returns the filename portion of `url` if it starts with `prefix/`
/// and the filename has an image-like extension.
fn filename_from_url(url: &str, prefix: &str) -> Option<String> {
    if prefix.is_empty() || !url.starts_with(prefix) {
        return None;
    }
    let rest = url[prefix.len()..].trim_start_matches('/');
    // Only consider the last path segment as a candidate — we're matching
    // flat content-addressed filenames.
    let name = rest.rsplit('/').next()?;
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".webp")
    {
        Some(name.to_string())
    } else {
        None
    }
}

fn rewrite_image_refs(
    value: &mut serde_json::Value,
    prefix: &str,
    rename_map: &HashMap<String, String>,
    new_base_url: &str,
) {
    match value {
        serde_json::Value::String(s) => {
            // Rewrite imageBaseUrl if it matches the old prefix exactly.
            if prefix_matches(s, prefix) {
                if let Some(name) = filename_from_url(s, prefix) {
                    if let Some(hub_name) = rename_map.get(&name) {
                        *s = format!("{}/images/{}", new_base_url, hub_name);
                        return;
                    }
                }
            }
            // Bare `meta.imageBaseUrl` value
            if !prefix.is_empty() && s == prefix {
                *s = new_base_url.to_string();
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr.iter_mut() {
                rewrite_image_refs(v, prefix, rename_map, new_base_url);
            }
        }
        serde_json::Value::Object(obj) => {
            for (_k, v) in obj.iter_mut() {
                rewrite_image_refs(v, prefix, rename_map, new_base_url);
            }
        }
        _ => {}
    }
}

fn prefix_matches(s: &str, prefix: &str) -> bool {
    !prefix.is_empty() && s.starts_with(prefix)
}

fn strip_cinematic_urls(value: &mut serde_json::Value) {
    if let Some(stories) = value.get_mut("stories").and_then(|v| v.as_array_mut()) {
        for story in stories.iter_mut() {
            if let Some(obj) = story.as_object_mut() {
                obj.remove("cinematicUrl");
            }
        }
    }
}

// ─── HTTP helpers (hub API) ─────────────────────────────────────────

async fn check_existing(
    client: &reqwest::Client,
    hub_api_url: &str,
    api_key: &str,
    slug: &str,
    hashes: &[String],
) -> Result<HashSet<String>, String> {
    if hashes.is_empty() {
        return Ok(HashSet::new());
    }
    let url = format!("{hub_api_url}/publish/check-existing");
    let body = serde_json::json!({ "slug": slug, "hashes": hashes });
    let resp = client
        .post(&url)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("{status}: {text}"));
    }
    #[derive(Deserialize)]
    struct Resp {
        existing: Vec<String>,
    }
    let parsed: Resp = resp.json().await.map_err(|e| format!("parse error: {e}"))?;
    Ok(parsed.existing.into_iter().collect())
}

async fn upload_image(
    client: &reqwest::Client,
    hub_api_url: &str,
    api_key: &str,
    slug: &str,
    hub_filename: &str,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let url = format!(
        "{hub_api_url}/publish/image/{hub_filename}?slug={slug}",
        hub_api_url = hub_api_url,
        hub_filename = hub_filename,
        slug = slug,
    );
    let resp = client
        .put(&url)
        .bearer_auth(api_key)
        .header("Content-Type", "image/webp")
        .body(bytes)
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("{status}: {text}"));
    }
    Ok(())
}

async fn upload_manifest(
    client: &reqwest::Client,
    hub_api_url: &str,
    api_key: &str,
    slug: &str,
    listed: bool,
    display_name: Option<String>,
    tagline: Option<String>,
    rewritten_showcase_json: &str,
) -> Result<String, String> {
    let url = format!("{hub_api_url}/publish/manifest");
    let showcase_value: serde_json::Value = serde_json::from_str(rewritten_showcase_json)
        .map_err(|e| format!("internal error re-parsing manifest: {e}"))?;
    let body = serde_json::json!({
        "slug": slug,
        "listed": listed,
        "displayName": display_name,
        "tagline": tagline,
        "showcase": showcase_value,
    });
    let resp = client
        .post(&url)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("{status}: {text}"));
    }
    #[derive(Deserialize)]
    struct Resp {
        url: String,
    }
    let parsed: Resp = resp.json().await.map_err(|e| format!("parse error: {e}"))?;
    Ok(parsed.url)
}

// ─── Misc helpers ────────────────────────────────────────────────────

fn emit_progress(app: &AppHandle, phase: &str, current: usize, total: usize, label: &str) {
    let _ = app.emit(
        "hub-publish-progress",
        HubPublishProgress {
            phase: phase.to_string(),
            current,
            total,
            label: label.to_string(),
        },
    );
}

fn is_valid_slug(slug: &str) -> bool {
    let len = slug.len();
    if !(3..=32).contains(&len) {
        return false;
    }
    let bytes = slug.as_bytes();
    if !is_slug_alnum(bytes[0]) || !is_slug_alnum(bytes[len - 1]) {
        return false;
    }
    bytes
        .iter()
        .all(|&b| is_slug_alnum(b) || b == b'-')
}

fn is_slug_alnum(b: u8) -> bool {
    b.is_ascii_lowercase() || b.is_ascii_digit()
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn assets_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("assets"))
}

fn find_asset_file(base: &Path, file_name: &str) -> Option<PathBuf> {
    for subdir in &["images", "video", "audio"] {
        let path = base.join(subdir).join(file_name);
        if path.exists() {
            return Some(path);
        }
    }
    None
}

/// `https://api.hub.arcanum.app` → `hub.arcanum.app`
/// `https://api.something.example.com` → `something.example.com`
/// `http://127.0.0.1:8787/api` → `127.0.0.1:8787` (dev fallback — the
/// resulting image base URL still works because the Worker dev
/// fallback serves `/dev/world/<slug>/images/...`, and the frontend
/// handles that; see hub.rs follow-ups if you actually run dev).
fn derive_hub_root(hub_api_url: &str) -> String {
    // Strip scheme.
    let no_scheme = hub_api_url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    // Strip path.
    let host_only = no_scheme.split('/').next().unwrap_or(no_scheme);
    // If the host begins with "api." strip it.
    if let Some(rest) = host_only.strip_prefix("api.") {
        return rest.to_string();
    }
    host_only.to_string()
}
