use std::io::Cursor;

use base64::Engine;
use image::{
    codecs::jpeg::JpegEncoder,
    codecs::png::{CompressionType as PngCompressionType, FilterType as PngFilterType, PngEncoder},
    imageops::FilterType,
    DynamicImage,
    ExtendedColorType,
    GenericImageView,
    ImageBuffer,
    ImageEncoder,
    ImageFormat,
    Rgba,
};
use sha2::{Digest, Sha256};
use tauri::AppHandle;

use crate::{deepinfra::GeneratedImage, llm, settings};

const JPEG_QUALITY: u8 = 88;
const LAVENDER_BG: [u8; 3] = [216, 208, 232];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputFormat {
    Png,
    Jpeg,
}

#[derive(Debug, Clone)]
pub struct ImageBehavior {
    pub target_width: u32,
    pub target_height: u32,
    pub output_format: OutputFormat,
    pub transparent_background: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct RuntimeImageProfile {
    pub max_width: u32,
    pub max_height: u32,
    pub jpeg_quality: u8,
}

/// Maximum resolution the runtime ever serves per asset type. Single source
/// of truth shared by the ingest paths (generation targets, imports) and the
/// R2 upload optimizer, so what lands on disk matches what actually ships.
pub fn runtime_image_profile(asset_type: &str) -> Option<RuntimeImageProfile> {
    let profile = match asset_type {
        "player_sprite" | "ability_icon" | "status_effect_icon" | "ability_sprite" | "item" | "lore_item" | "status_art" => {
            RuntimeImageProfile { max_width: 256, max_height: 256, jpeg_quality: 82 }
        }
        "mob" | "pet" | "entity_portrait" | "race_portrait" | "class_portrait" | "lore_character" | "lore_species" => {
            RuntimeImageProfile { max_width: 512, max_height: 768, jpeg_quality: 84 }
        }
        "room" | "background" | "zone_map" | "splash_hero" | "panel_header" | "loading_vignette" | "empty_state" | "ornament" | "lore_location" => {
            RuntimeImageProfile { max_width: 1280, max_height: 1280, jpeg_quality: 82 }
        }
        "lore_map" => {
            RuntimeImageProfile { max_width: 2048, max_height: 2048, jpeg_quality: 85 }
        }
        "showcase_banner" => {
            RuntimeImageProfile { max_width: 1920, max_height: 820, jpeg_quality: 85 }
        }
        "showcase_favicon" => {
            RuntimeImageProfile { max_width: 512, max_height: 512, jpeg_quality: 88 }
        }
        _ => return None,
    };
    Some(profile)
}

/// Fit dimensions within the asset type's runtime profile, preserving aspect
/// ratio. Types with no profile pass through unchanged.
pub fn cap_stored_dims(asset_type: &str, width: u32, height: u32) -> (u32, u32) {
    let Some(profile) = runtime_image_profile(asset_type) else {
        return (width, height);
    };
    if width <= profile.max_width && height <= profile.max_height {
        return (width, height);
    }
    let scale = (profile.max_width as f64 / width as f64)
        .min(profile.max_height as f64 / height as f64);
    (
        ((width as f64 * scale).round() as u32).max(1),
        ((height as f64 * scale).round() as u32).max(1),
    )
}

/// Downscale and re-encode image bytes to the asset type's runtime profile.
/// Returns the original bytes when no profile applies, the extension isn't a
/// re-encodable format (WebP passes through), decoding fails, or the
/// re-encode isn't smaller at unchanged dimensions.
pub fn cap_image_bytes(asset_type: &str, ext: &str, bytes: &[u8]) -> Vec<u8> {
    let Some(profile) = runtime_image_profile(asset_type) else {
        return bytes.to_vec();
    };
    if !matches!(ext, "png" | "jpg" | "jpeg") {
        return bytes.to_vec();
    }

    let decoded = match image::load_from_memory(bytes) {
        Ok(img) => img,
        Err(_) => return bytes.to_vec(),
    };
    let original_width = decoded.width();
    let original_height = decoded.height();

    let resized = if original_width > profile.max_width || original_height > profile.max_height {
        decoded.resize(profile.max_width, profile.max_height, FilterType::Lanczos3)
    } else {
        decoded
    };

    let mut out = Vec::new();
    let encode_result = if ext == "png" {
        let rgba = resized.to_rgba8();
        let encoder = PngEncoder::new_with_quality(
            &mut out,
            PngCompressionType::Best,
            PngFilterType::Adaptive,
        );
        encoder.write_image(
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            ExtendedColorType::Rgba8,
        )
    } else {
        let rgb = resized.to_rgb8();
        let encoder = JpegEncoder::new_with_quality(&mut out, profile.jpeg_quality);
        encoder.write_image(
            rgb.as_raw(),
            rgb.width(),
            rgb.height(),
            ExtendedColorType::Rgb8,
        )
    };

    if encode_result.is_err() || out.is_empty() {
        return bytes.to_vec();
    }

    if out.len() < bytes.len() || resized.width() != original_width || resized.height() != original_height {
        out
    } else {
        bytes.to_vec()
    }
}

/// Cap generation dimensions to 1024px on the long edge while preserving aspect ratio.
/// FLUX models produce better results at ~1024px; we resize to final dimensions after.
pub fn cap_generation_dims(width: u32, height: u32) -> (u32, u32) {
    let max_edge: u32 = 1024;
    if width <= max_edge && height <= max_edge {
        return (width, height);
    }
    let aspect = width as f64 / height as f64;
    if width >= height {
        let w = max_edge;
        let h = ((max_edge as f64) / aspect).round() as u32;
        // Round to multiple of 8 for diffusion models
        (w, (h + 4) / 8 * 8)
    } else {
        let h = max_edge;
        let w = ((max_edge as f64) * aspect).round() as u32;
        ((w + 4) / 8 * 8, h)
    }
}

pub fn infer_behavior(
    asset_type: Option<&str>,
    width: u32,
    height: u32,
    transparent_background: Option<bool>,
) -> ImageBehavior {
    let landscape = width > height;
    let portrait = height > width;
    let asset_type = asset_type.unwrap_or_default();

    let output_format = match asset_type {
        "background"
        | "status_art"
        | "empty_state"
        | "zone_map"
        | "splash_hero"
        | "panel_header"
        | "room"
        | "lore_location"
        | "lore_event"
        | "race_portrait"
        | "class_portrait"
        | "lore_character" => OutputFormat::Jpeg,
        "player_sprite"
        | "ability_icon"
        | "status_effect_icon"
        | "ability_sprite"
        | "item"
        | "lore_item" => OutputFormat::Png,
        _ if landscape || portrait => OutputFormat::Jpeg,
        _ => OutputFormat::Png,
    };

    let transparent_background = transparent_background.unwrap_or(false);

    // Store at the resolution the runtime actually serves — R2/hub uploads
    // downscale to the profile anyway, so anything larger is wasted disk,
    // IPC payload, and decode time.
    let (target_width, target_height) = cap_stored_dims(asset_type, width.max(1), height.max(1));

    ImageBehavior {
        target_width,
        target_height,
        output_format,
        transparent_background,
    }
}

pub async fn maybe_enhance_prompt(
    app: &AppHandle,
    prompt: &str,
    asset_type: Option<&str>,
    auto_enhance: Option<bool>,
) -> Result<String, String> {
    let cfg = settings::get_settings(app.clone()).await?;
    let enabled = auto_enhance.unwrap_or(cfg.auto_enhance_prompts);
    if !enabled {
        return Ok(prompt.to_string());
    }

    let system_prompt = r#"You refine prompts for fantasy game asset generation.

Preserve the original subject, composition, style system, hard constraints, and safety boundaries.
Improve specificity around material, lighting, silhouette, atmosphere, and visual readability.
Do not add readable text. Do not add extra subjects unless the prompt already implies them.
If the prompt already contains a named style or rendering suffix, preserve it.
Output only the revised prompt text."#;

    let user_prompt = match asset_type {
        Some(asset_type) if !asset_type.is_empty() => format!(
            "Asset type: {asset_type}\n\nRefine this image prompt without changing its intent:\n{prompt}"
        ),
        _ => format!("Refine this image prompt without changing its intent:\n{prompt}"),
    };

    match llm::complete_from_settings(&cfg, system_prompt, &user_prompt, 700).await {
        Ok(enhanced) if !enhanced.trim().is_empty() => Ok(enhanced),
        Ok(_) => Ok(prompt.to_string()),
        Err(_) => Ok(prompt.to_string()),
    }
}

pub fn process_image_bytes(bytes: &[u8], behavior: &ImageBehavior) -> Result<Vec<u8>, String> {
    let decoded = image::load_from_memory(bytes)
        .map_err(|e| format!("Failed to decode generated image: {e}"))?;

    let resized = resize_exact(&decoded, behavior.target_width, behavior.target_height);

    match behavior.output_format {
        OutputFormat::Png => encode_png(&resized),
        OutputFormat::Jpeg => encode_jpeg(&resized),
    }
}

pub async fn persist_generated_image(
    app: &AppHandle,
    bytes: &[u8],
    prompt: String,
    model: String,
    width: u32,
    height: u32,
    output_format: OutputFormat,
) -> Result<GeneratedImage, String> {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let hash = format!("{:x}", hasher.finalize());

    let dir = crate::fs_utils::app_data_dir(app)?
        .join("assets")
        .join("images");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create assets dir: {e}"))?;

    let (ext, mime) = match output_format {
        OutputFormat::Png => ("png", "image/png"),
        OutputFormat::Jpeg => ("jpg", "image/jpeg"),
    };

    let filename = format!("{hash}.{ext}");
    let file_path = dir.join(&filename);
    tokio::fs::write(&file_path, bytes)
        .await
        .map_err(|e| format!("Failed to write image: {e}"))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(GeneratedImage {
        id: uuid::Uuid::new_v4().to_string(),
        hash,
        file_path: file_path.to_string_lossy().to_string(),
        data_url: format!("data:{mime};base64,{b64}"),
        width,
        height,
        prompt,
        model,
    })
}

fn resize_exact(image: &DynamicImage, width: u32, height: u32) -> DynamicImage {
    let (current_width, current_height) = image.dimensions();
    if current_width == width && current_height == height {
        return image.clone();
    }

    DynamicImage::ImageRgba8(image.resize_exact(width, height, FilterType::Lanczos3).to_rgba8())
}

fn encode_png(image: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut cursor = Cursor::new(Vec::new());
    image.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {e}"))?;
    Ok(cursor.into_inner())
}

fn encode_jpeg(image: &DynamicImage) -> Result<Vec<u8>, String> {
    let rgba = image.to_rgba8();
    let flattened = flatten_alpha(&rgba);
    let mut cursor = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut cursor, JPEG_QUALITY);
    encoder
        .encode_image(&DynamicImage::ImageRgb8(flattened))
        .map_err(|e| format!("Failed to encode JPEG: {e}"))?;
    Ok(cursor.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cap_stored_dims_fits_profile_preserving_aspect() {
        assert_eq!(cap_stored_dims("item", 1024, 1024), (256, 256));
        assert_eq!(cap_stored_dims("mob", 1024, 1536), (512, 768));
        assert_eq!(cap_stored_dims("room", 1536, 1024), (1280, 853));
    }

    #[test]
    fn cap_stored_dims_passes_through_unprofiled_and_fitting() {
        assert_eq!(cap_stored_dims("story_scene", 4096, 4096), (4096, 4096));
        assert_eq!(cap_stored_dims("item", 128, 128), (128, 128));
    }

    #[test]
    fn infer_behavior_caps_generation_targets() {
        let b = infer_behavior(Some("ability_icon"), 1024, 1024, None);
        assert_eq!((b.target_width, b.target_height), (256, 256));
        assert_eq!(b.output_format, OutputFormat::Png);
    }

    #[test]
    fn cap_image_bytes_downscales_oversized_png() {
        let img = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            512,
            512,
            Rgba([120, 40, 200, 255]),
        ));
        let mut cursor = Cursor::new(Vec::new());
        img.write_to(&mut cursor, ImageFormat::Png).unwrap();
        let bytes = cursor.into_inner();

        let capped = cap_image_bytes("item", "png", &bytes);
        let decoded = image::load_from_memory(&capped).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (256, 256));
    }

    #[test]
    fn cap_image_bytes_passes_through_unprofiled_types_and_webp() {
        let bytes = vec![1, 2, 3];
        assert_eq!(cap_image_bytes("story_scene", "png", &bytes), bytes);
        assert_eq!(cap_image_bytes("item", "webp", &bytes), bytes);
    }
}

fn flatten_alpha(image: &ImageBuffer<Rgba<u8>, Vec<u8>>) -> image::RgbImage {
    let (width, height) = image.dimensions();
    let mut out = image::RgbImage::new(width, height);

    for (x, y, pixel) in image.enumerate_pixels() {
        let alpha = pixel[3] as f32 / 255.0;
        let blend = |fg: u8, bg: u8| -> u8 {
            ((fg as f32 * alpha) + (bg as f32 * (1.0 - alpha))).round() as u8
        };

        out.put_pixel(
            x,
            y,
            image::Rgb([
                blend(pixel[0], LAVENDER_BG[0]),
                blend(pixel[1], LAVENDER_BG[1]),
                blend(pixel[2], LAVENDER_BG[2]),
            ]),
        );
    }

    out
}
