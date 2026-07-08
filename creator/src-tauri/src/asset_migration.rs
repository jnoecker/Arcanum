//! Migrates an existing asset library to the per-asset-type runtime image
//! profiles. Files are content-addressed (`<sha256>.<ext>`), so re-encoding
//! produces a new filename; the migration rewrites every YAML reference in
//! the project via exact-token replacement — hash filenames are globally
//! unique 64-hex strings, so plain string substitution cannot false-match
//! and preserves formatting without re-serializing YAML.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

/// Directories never scanned for references. `.arcanum` holds the manifest
/// (updated separately) and snapshots; the rest are VCS/build output.
const SKIP_DIRS: &[&str] = &[
    ".arcanum",
    ".git",
    ".gradle",
    "build",
    "dist",
    "node_modules",
    "target",
];

#[derive(Debug, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationReport {
    /// Image assets that have a runtime profile and were checked.
    pub total_assets: usize,
    /// Assets exceeding their profile (migrated, or would be in a dry run).
    pub affected: usize,
    pub bytes_before: u64,
    /// Dry run: estimated from the area ratio. Real run: actual.
    pub bytes_after: u64,
    pub estimated: bool,
    /// YAML files whose references were rewritten.
    pub references_updated: usize,
    pub errors: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationProgress {
    stage: String,
    current: usize,
    total: usize,
}

fn emit_progress(app: &AppHandle, stage: &str, current: usize, total: usize) {
    let _ = app.emit(
        "asset-migration-progress",
        MigrationProgress {
            stage: stage.to_string(),
            current,
            total,
        },
    );
}

fn extension_of(file_name: &str) -> String {
    file_name
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase()
}

struct MigrationPlan {
    /// Manifest indices sharing this file (historical duplicates).
    indices: Vec<usize>,
    old_name: String,
    asset_type: String,
    ext: String,
    path: PathBuf,
    file_size: u64,
    width: u32,
    height: u32,
}

/// Replace every mapped filename token in `content`. Returns `None` when
/// nothing matched. Keys are full content-addressed filenames
/// (`<64-hex>.<ext>`), so substitution is exact and order-independent.
fn rewrite_content(content: &str, mapping: &HashMap<String, String>) -> Option<String> {
    let mut result = content.to_string();
    let mut changed = false;
    for (old, new) in mapping {
        if result.contains(old.as_str()) {
            result = result.replace(old.as_str(), new);
            changed = true;
        }
    }
    changed.then_some(result)
}

/// Walk the project directory and rewrite references in every YAML file.
/// Returns the number of files updated.
fn rewrite_project_references(
    root: &Path,
    mapping: &HashMap<String, String>,
) -> Result<usize, String> {
    if mapping.is_empty() {
        return Ok(0);
    }
    let mut updated = 0;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = std::fs::read_dir(&dir)
            .map_err(|e| format!("Failed to read {}: {e}", dir.display()))?;
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                if !SKIP_DIRS.contains(&name.as_str()) {
                    stack.push(path);
                }
                continue;
            }
            let is_yaml = matches!(
                path.extension().and_then(|e| e.to_str()),
                Some("yaml") | Some("yml")
            );
            if !is_yaml {
                continue;
            }
            let Ok(content) = std::fs::read_to_string(&path) else {
                continue;
            };
            if let Some(new_content) = rewrite_content(&content, mapping) {
                std::fs::write(&path, new_content)
                    .map_err(|e| format!("Failed to rewrite {}: {e}", path.display()))?;
                updated += 1;
            }
        }
    }
    Ok(updated)
}

/// Downscale every stored image that exceeds its asset type's runtime
/// profile, updating the manifest and rewriting project YAML references to
/// the new content-addressed filenames. `dry_run` reports what would change
/// without touching anything.
#[tauri::command]
pub async fn migrate_assets_to_profiles(
    app: AppHandle,
    dry_run: bool,
) -> Result<MigrationReport, String> {
    let Some(project_dir) = crate::settings::active_project_dir().await else {
        return Err("Open a project first — migration rewrites project files.".to_string());
    };

    let images_dir = crate::assets::assets_dir(&app)?.join("images");

    let _lock = crate::assets::MANIFEST_LOCK.lock().await;
    let mut manifest = crate::assets::load_manifest(&app).await?;

    let mut report = MigrationReport::default();
    let mut plans: Vec<MigrationPlan> = Vec::new();
    let mut planned: HashMap<String, usize> = HashMap::new();

    for (idx, entry) in manifest.assets.iter().enumerate() {
        let ext = extension_of(&entry.file_name);
        if !matches!(ext.as_str(), "png" | "jpg" | "jpeg") {
            continue;
        }
        if crate::image_profiles::runtime_image_profile(&entry.asset_type).is_none() {
            continue;
        }
        let path = images_dir.join(&entry.file_name);
        let Ok(meta) = std::fs::metadata(&path) else {
            continue;
        };
        report.total_assets += 1;

        if let Some(&plan_idx) = planned.get(&entry.file_name) {
            plans[plan_idx].indices.push(idx);
            continue;
        }

        let (width, height) = if entry.width > 0 && entry.height > 0 {
            (entry.width, entry.height)
        } else {
            match imagesize::size(&path) {
                Ok(size) => (size.width as u32, size.height as u32),
                Err(_) => continue,
            }
        };
        let (capped_w, capped_h) =
            crate::image_profiles::cap_stored_dims(&entry.asset_type, width, height);
        if (capped_w, capped_h) == (width, height) {
            continue;
        }

        report.affected += 1;
        report.bytes_before += meta.len();
        if dry_run {
            let ratio =
                (capped_w as u64 * capped_h as u64) as f64 / (width as u64 * height as u64) as f64;
            report.bytes_after += (meta.len() as f64 * ratio) as u64;
        }

        planned.insert(entry.file_name.clone(), plans.len());
        plans.push(MigrationPlan {
            indices: vec![idx],
            old_name: entry.file_name.clone(),
            asset_type: entry.asset_type.clone(),
            ext,
            path,
            file_size: meta.len(),
            width,
            height,
        });
    }

    if dry_run {
        report.estimated = true;
        return Ok(report);
    }
    if plans.is_empty() {
        return Ok(report);
    }

    // Safety snapshot of the project (manifest + YAMLs) before any rewrite.
    // The image bytes themselves are not snapshotted — originals are gone
    // after migration, which is the point; R2/hub only ever served the
    // optimized versions anyway.
    crate::snapshots::snapshot_create(
        project_dir.clone(),
        "migration".to_string(),
        Some("library-optimize".to_string()),
        false,
    )
    .await?;

    let total = plans.len();
    let mut mapping: HashMap<String, String> = HashMap::new();

    for (i, plan) in plans.iter().enumerate() {
        emit_progress(&app, "encoding", i, total);

        let bytes = match tokio::fs::read(&plan.path).await {
            Ok(b) => b,
            Err(e) => {
                report.errors.push(format!("{}: read failed: {e}", plan.old_name));
                report.bytes_after += plan.file_size;
                continue;
            }
        };
        let asset_type = plan.asset_type.clone();
        let ext = plan.ext.clone();
        let new_bytes =
            tokio::task::spawn_blocking(move || {
                crate::image_profiles::cap_image_bytes(&asset_type, &ext, &bytes)
            })
            .await
            .map_err(|e| format!("encode task join failed: {e}"))?;

        let mut hasher = Sha256::new();
        hasher.update(&new_bytes);
        let hash = format!("{:x}", hasher.finalize());
        let new_name = format!("{hash}.{}", plan.ext);
        if new_name == plan.old_name {
            report.bytes_after += plan.file_size;
            continue;
        }

        let (new_w, new_h) = match imagesize::blob_size(&new_bytes) {
            Ok(size) => (size.width as u32, size.height as u32),
            Err(_) => (
                crate::image_profiles::cap_stored_dims(&plan.asset_type, plan.width, plan.height).0,
                crate::image_profiles::cap_stored_dims(&plan.asset_type, plan.width, plan.height).1,
            ),
        };

        let dest = images_dir.join(&new_name);
        if !dest.exists() {
            if let Err(e) = tokio::fs::write(&dest, &new_bytes).await {
                report.errors.push(format!("{}: write failed: {e}", plan.old_name));
                report.bytes_after += plan.file_size;
                continue;
            }
        }

        report.bytes_after += new_bytes.len() as u64;
        for &idx in &plan.indices {
            let entry = &mut manifest.assets[idx];
            entry.hash = hash.clone();
            entry.file_name = new_name.clone();
            entry.width = new_w;
            entry.height = new_h;
            entry.sync_status = "local".to_string();
        }
        mapping.insert(plan.old_name.clone(), new_name);
    }

    emit_progress(&app, "rewriting", 0, 1);
    let root = PathBuf::from(&project_dir);
    let mapping_for_walk = mapping.clone();
    report.references_updated =
        tokio::task::spawn_blocking(move || rewrite_project_references(&root, &mapping_for_walk))
            .await
            .map_err(|e| format!("rewrite task join failed: {e}"))??;

    crate::assets::save_manifest(&app, &manifest).await?;

    // Old files go last, once the manifest and every reference point at the
    // new names — a failure above leaves a working (just unmigrated) library.
    for old_name in mapping.keys() {
        let _ = tokio::fs::remove_file(images_dir.join(old_name)).await;
    }

    emit_progress(&app, "done", total, total);
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mapping(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(a, b)| (a.to_string(), b.to_string()))
            .collect()
    }

    const OLD_A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png";
    const NEW_A: &str = "1111111111111111111111111111111111111111111111111111111111111111.png";
    const OLD_B: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg";
    const NEW_B: &str = "2222222222222222222222222222222222222222222222222222222222222222.jpg";

    #[test]
    fn rewrite_content_replaces_all_mapped_tokens() {
        let content = format!("rooms:\n  start:\n    image: {OLD_A}\nmobs:\n  rat:\n    image: {OLD_B}\n  bat:\n    image: {OLD_A}\n");
        let out = rewrite_content(&content, &mapping(&[(OLD_A, NEW_A), (OLD_B, NEW_B)])).unwrap();
        assert!(!out.contains(OLD_A));
        assert!(!out.contains(OLD_B));
        assert_eq!(out.matches(NEW_A).count(), 2);
        assert_eq!(out.matches(NEW_B).count(), 1);
    }

    #[test]
    fn rewrite_content_returns_none_when_nothing_matches() {
        let content = "zone: test\nrooms: {}\n";
        assert!(rewrite_content(content, &mapping(&[(OLD_A, NEW_A)])).is_none());
    }

    #[test]
    fn rewrite_content_preserves_surrounding_formatting() {
        let content = format!("# comment stays\nimage: {OLD_A}   # trailing note\n");
        let out = rewrite_content(&content, &mapping(&[(OLD_A, NEW_A)])).unwrap();
        assert_eq!(
            out,
            format!("# comment stays\nimage: {NEW_A}   # trailing note\n")
        );
    }

    #[test]
    fn extension_of_lowercases() {
        assert_eq!(extension_of("ABC.PNG"), "png");
        assert_eq!(extension_of("x.jpg"), "jpg");
    }
}
