use image::{
    codecs::jpeg::JpegEncoder,
    codecs::png::{CompressionType as PngCompressionType, FilterType as PngFilterType, PngEncoder},
    imageops::FilterType,
    DynamicImage,
    ExtendedColorType,
    ImageEncoder,
};

const KIB: u64 = 1024;

#[derive(Debug, Clone, Copy)]
pub struct RuntimeImageProfile {
    pub max_width: u32,
    pub max_height: u32,
    pub jpeg_quality: u8,
    pub webp_quality: f32,
    /// Soft byte target — a stored PNG/JPEG over this re-encodes as WebP.
    pub preferred_bytes: u64,
    /// Hard ceiling — the encoder steps quality, then dimensions, down
    /// until the result fits.
    pub max_bytes: u64,
}

/// Maximum resolution and byte budget the runtime ever serves per asset
/// type. Single source of truth shared by the ingest paths (generation
/// targets, imports), Optimize Library, and the R2 upload optimizer, so what
/// lands on disk matches what actually ships. Budgets follow the AmbonMUD
/// art contract: full scenes and panel paintings ≤750 KiB preferred with a
/// 1.25 MiB hard ceiling; controls, indicators, and widgets ≤150 KiB.
pub fn runtime_image_profile(asset_type: &str) -> Option<RuntimeImageProfile> {
    let profile = match asset_type {
        "player_sprite" | "ability_icon" | "status_effect_icon" | "ability_sprite" | "item" | "lore_item" | "status_art" => {
            RuntimeImageProfile { max_width: 256, max_height: 256, jpeg_quality: 82, webp_quality: 82.0, preferred_bytes: 100 * KIB, max_bytes: 150 * KIB }
        }
        "mob" | "pet" | "entity_portrait" | "race_portrait" | "class_portrait" | "lore_character" | "lore_species" => {
            RuntimeImageProfile { max_width: 512, max_height: 768, jpeg_quality: 84, webp_quality: 82.0, preferred_bytes: 250 * KIB, max_bytes: 400 * KIB }
        }
        "room" | "background" | "zone_map" | "splash_hero" | "panel_header" | "loading_vignette" | "empty_state" | "ornament" | "lore_location" => {
            RuntimeImageProfile { max_width: 1280, max_height: 1280, jpeg_quality: 82, webp_quality: 80.0, preferred_bytes: 750 * KIB, max_bytes: 1280 * KIB }
        }
        "lore_map" => {
            RuntimeImageProfile { max_width: 2048, max_height: 2048, jpeg_quality: 85, webp_quality: 82.0, preferred_bytes: 1536 * KIB, max_bytes: 2560 * KIB }
        }
        "showcase_banner" => {
            RuntimeImageProfile { max_width: 1920, max_height: 820, jpeg_quality: 85, webp_quality: 82.0, preferred_bytes: 750 * KIB, max_bytes: 1280 * KIB }
        }
        "showcase_favicon" => {
            RuntimeImageProfile { max_width: 512, max_height: 512, jpeg_quality: 88, webp_quality: 90.0, preferred_bytes: 100 * KIB, max_bytes: 150 * KIB }
        }
        _ => return None,
    };
    Some(profile)
}

/// Player sprites deploy to the stable path `player_sprites/<key>.png` — a
/// PNG contract with the game client — so they downscale but never convert.
pub fn webp_convertible(asset_type: &str) -> bool {
    asset_type != "player_sprite"
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

pub struct OptimizedImage {
    pub bytes: Vec<u8>,
    pub ext: String,
}

/// Whether a stored image needs Optimize Library attention: dimensions over
/// the runtime profile, or bytes over the budget (PNG/JPEG over the soft
/// target converts to WebP; an existing WebP only re-encodes past the hard
/// ceiling, so a floor-quality result doesn't churn on every run).
pub fn needs_optimization(asset_type: &str, ext: &str, byte_len: u64, width: u32, height: u32) -> bool {
    let Some(profile) = runtime_image_profile(asset_type) else {
        return false;
    };
    if !matches!(ext, "png" | "jpg" | "jpeg" | "webp") {
        return false;
    }
    if cap_stored_dims(asset_type, width, height) != (width, height) {
        return true;
    }
    if !webp_convertible(asset_type) {
        return false;
    }
    if ext == "webp" {
        byte_len > profile.max_bytes
    } else {
        byte_len > profile.preferred_bytes
    }
}

fn encode_webp(img: &DynamicImage, quality: f32) -> Vec<u8> {
    if img.color().has_alpha() {
        let rgba = img.to_rgba8();
        webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height())
            .encode(quality)
            .to_vec()
    } else {
        let rgb = img.to_rgb8();
        webp::Encoder::from_rgb(rgb.as_raw(), rgb.width(), rgb.height())
            .encode(quality)
            .to_vec()
    }
}

const WEBP_QUALITY_FLOOR: f32 = 55.0;
const WEBP_QUALITY_STEP: f32 = 7.0;
const MAX_SHRINK_ROUNDS: u32 = 4;

/// Downscale to the runtime profile and re-encode within the byte budget,
/// converting PNG/JPEG to lossy WebP when over the soft target. Steps WebP
/// quality down to a floor to reach the soft target, then shrinks dimensions
/// as a last resort to get under the hard ceiling. Returns the original
/// bytes (and extension) when no profile applies, the type's format is
/// pinned, decoding fails, or the image already fits.
pub fn optimize_image_bytes(asset_type: &str, ext: &str, bytes: &[u8]) -> OptimizedImage {
    let passthrough = || OptimizedImage {
        bytes: bytes.to_vec(),
        ext: ext.to_string(),
    };
    let Some(profile) = runtime_image_profile(asset_type) else {
        return passthrough();
    };
    if !webp_convertible(asset_type) {
        return OptimizedImage {
            bytes: cap_image_bytes(asset_type, ext, bytes),
            ext: ext.to_string(),
        };
    }
    if !matches!(ext, "png" | "jpg" | "jpeg" | "webp") {
        return passthrough();
    }

    let decoded = match image::load_from_memory(bytes) {
        Ok(img) => img,
        Err(_) => return passthrough(),
    };
    if !needs_optimization(asset_type, ext, bytes.len() as u64, decoded.width(), decoded.height()) {
        return passthrough();
    }

    let oversized_dims =
        decoded.width() > profile.max_width || decoded.height() > profile.max_height;
    let mut current = if oversized_dims {
        decoded.resize(profile.max_width, profile.max_height, FilterType::Lanczos3)
    } else {
        decoded
    };

    let mut quality = profile.webp_quality;
    let mut out = encode_webp(&current, quality);
    while out.len() as u64 > profile.preferred_bytes && quality - WEBP_QUALITY_STEP >= WEBP_QUALITY_FLOOR {
        quality -= WEBP_QUALITY_STEP;
        out = encode_webp(&current, quality);
    }
    let mut shrink_rounds = 0;
    while out.len() as u64 > profile.max_bytes
        && shrink_rounds < MAX_SHRINK_ROUNDS
        && current.width() > 64
        && current.height() > 64
    {
        current = current.resize(
            (current.width() as f64 * 0.85) as u32,
            (current.height() as f64 * 0.85) as u32,
            FilterType::Lanczos3,
        );
        out = encode_webp(&current, quality);
        shrink_rounds += 1;
    }

    if out.is_empty() || (!oversized_dims && out.len() >= bytes.len()) {
        return passthrough();
    }
    OptimizedImage {
        bytes: out,
        ext: "webp".to_string(),
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

    /// Deterministic high-entropy image — flat synthetic fills compress far
    /// too well to exercise the byte-budget paths.
    fn noise_png(width: u32, height: u32) -> Vec<u8> {
        let mut state = 0x2545F4914F6CDD1Du64;
        let img = image::RgbImage::from_fn(width, height, |_, _| {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let b = state.to_le_bytes();
            image::Rgb([b[0], b[1], b[2]])
        });
        let mut cursor = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(img)
            .write_to(&mut cursor, ImageFormat::Png)
            .unwrap();
        cursor.into_inner()
    }

    #[test]
    fn needs_optimization_flags_dims_and_budgets() {
        // Oversized dimensions always flag, format aside.
        assert!(needs_optimization("background", "png", 10_000, 1536, 1024));
        assert!(needs_optimization("player_sprite", "png", 10_000, 512, 512));
        // Fitting dims: PNG over the soft target flags, under it doesn't.
        assert!(needs_optimization("background", "png", 751 * KIB, 1280, 853));
        assert!(!needs_optimization("background", "png", 700 * KIB, 1280, 853));
        // WebP only flags past the hard ceiling.
        assert!(!needs_optimization("background", "webp", 900 * KIB, 1280, 853));
        assert!(needs_optimization("background", "webp", 1300 * KIB, 1280, 853));
        // Pinned-format and unprofiled types never flag on bytes alone.
        assert!(!needs_optimization("player_sprite", "png", 500 * KIB, 256, 256));
        assert!(!needs_optimization("story_scene", "png", 90_000 * KIB, 8000, 8000));
    }

    #[test]
    fn optimize_converts_oversized_scene_to_webp_within_ceiling() {
        let bytes = noise_png(1400, 900);
        let profile = runtime_image_profile("background").unwrap();
        assert!(bytes.len() as u64 > profile.preferred_bytes);

        let result = optimize_image_bytes("background", "png", &bytes);
        assert_eq!(result.ext, "webp");
        assert!(result.bytes.len() as u64 <= profile.max_bytes);
        let decoded = image::load_from_memory(&result.bytes).unwrap();
        assert!(decoded.width() <= profile.max_width && decoded.height() <= profile.max_height);
    }

    #[test]
    fn optimize_passes_through_images_within_budget() {
        let img = DynamicImage::ImageRgb8(image::RgbImage::from_pixel(640, 480, image::Rgb([40, 90, 120])));
        let mut cursor = Cursor::new(Vec::new());
        img.write_to(&mut cursor, ImageFormat::Png).unwrap();
        let bytes = cursor.into_inner();

        let result = optimize_image_bytes("background", "png", &bytes);
        assert_eq!(result.ext, "png");
        assert_eq!(result.bytes, bytes);
    }

    #[test]
    fn optimize_keeps_player_sprites_png() {
        let img = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(512, 512, Rgba([10, 20, 30, 255])));
        let mut cursor = Cursor::new(Vec::new());
        img.write_to(&mut cursor, ImageFormat::Png).unwrap();

        let result = optimize_image_bytes("player_sprite", "png", &cursor.into_inner());
        assert_eq!(result.ext, "png");
        let decoded = image::load_from_memory(&result.bytes).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (256, 256));
    }

    #[test]
    fn optimize_preserves_alpha_in_webp() {
        let bytes = {
            let base = noise_png(1400, 900);
            let decoded = image::load_from_memory(&base).unwrap();
            let mut rgba = decoded.to_rgba8();
            for p in rgba.pixels_mut() {
                p.0[3] = 128;
            }
            let mut cursor = Cursor::new(Vec::new());
            DynamicImage::ImageRgba8(rgba)
                .write_to(&mut cursor, ImageFormat::Png)
                .unwrap();
            cursor.into_inner()
        };

        let result = optimize_image_bytes("background", "png", &bytes);
        assert_eq!(result.ext, "webp");
        let decoded = image::load_from_memory(&result.bytes).unwrap();
        assert!(decoded.color().has_alpha());
        assert_eq!(decoded.to_rgba8().pixels().next().unwrap().0[3], 128);
    }
}
