use image::{
    codecs::jpeg::JpegEncoder,
    codecs::png::{CompressionType as PngCompressionType, FilterType as PngFilterType, PngEncoder},
    imageops::FilterType,
    ExtendedColorType,
    ImageEncoder,
};

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
#[cfg_attr(not(feature = "ai"), allow(dead_code))]
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

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageFormat, Rgba};
    use std::io::Cursor;

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
