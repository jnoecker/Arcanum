//! Migrates an existing asset library to the per-asset-type runtime image
//! profiles. Files are content-addressed (`<sha256>.<ext>`), so re-encoding
//! produces a new filename; the migration rewrites every YAML and JSON
//! reference in the project (zones, config, lore, story files) via
//! exact-token replacement — hash filenames are globally unique 64-hex
//! strings, so plain string substitution cannot false-match and preserves
//! formatting without re-serializing.
//!
//! Large libraries: re-encoding runs on a bounded blocking-thread pool, and
//! every `COMMIT_INTERVAL` images the manifest plus a journal of old→new
//! pairs (`.arcanum/asset-migration-journal.json`) are checkpointed. An
//! interrupted run (crash, kill) resumes on the next run: already-committed
//! pairs come from the journal, already-encoded files are reused by hash.
//! Cancellation (`cancel_asset_migration`) stops encoding but still
//! finalizes the completed subset — rewrite, manifest save, old-file
//! deletion — so a cancelled run leaves a fully consistent library.

use serde::{Deserialize, Serialize};
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

const CANCEL_SESSION: &str = "asset-migration";
const COMMIT_INTERVAL: usize = 50;

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
    /// Project files whose references were rewritten.
    pub references_updated: usize,
    pub cancelled: bool,
    /// Affected assets left unprocessed by a cancelled run.
    pub remaining: usize,
    pub errors: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationProgress {
    stage: String,
    current: usize,
    total: usize,
}

/// Old→new filename pairs already committed to the manifest but whose
/// reference rewrite / old-file deletion may not have happened yet.
#[derive(Debug, Default, Serialize, Deserialize)]
struct MigrationJournal {
    pairs: HashMap<String, String>,
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

fn journal_path(project_dir: &str) -> PathBuf {
    Path::new(project_dir)
        .join(".arcanum")
        .join("asset-migration-journal.json")
}

/// Load the checkpoint journal, dropping pairs whose old file is already
/// gone (deletion is the last per-pair step, so those are fully finalized).
/// Removes the file when nothing is left.
async fn load_journal(project_dir: &str, images_dir: &Path) -> HashMap<String, String> {
    let path = journal_path(project_dir);
    let Ok(data) = tokio::fs::read_to_string(&path).await else {
        return HashMap::new();
    };
    let mut pairs = serde_json::from_str::<MigrationJournal>(&data)
        .map(|j| j.pairs)
        .unwrap_or_default();
    pairs.retain(|old, _| images_dir.join(old).exists());
    if pairs.is_empty() {
        let _ = tokio::fs::remove_file(&path).await;
    }
    pairs
}

/// Checkpoint: journal first, manifest second. If we crash between the two
/// writes, the still-old manifest entries just get re-planned and produce
/// the same pairs again.
async fn commit_progress(
    app: &AppHandle,
    project_dir: &str,
    mapping: &HashMap<String, String>,
    manifest: &crate::assets::Manifest,
) -> Result<(), String> {
    crate::fs_utils::write_json_file(
        &journal_path(project_dir),
        &MigrationJournal {
            pairs: mapping.clone(),
        },
        "migration journal",
    )
    .await?;
    crate::assets::save_manifest(app, manifest).await
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

struct EncodedImage {
    new_name: String,
    hash: String,
    width: u32,
    height: u32,
    bytes: Vec<u8>,
}

/// CPU side of one plan: read, downscale, hash. Returns `None` when the
/// re-encode is byte-identical (nothing to migrate). The file write happens
/// on the async side so two plans hashing to the same output never race.
fn encode_plan(plan_path: &Path, asset_type: &str, ext: &str, old_name: &str, fallback_w: u32, fallback_h: u32) -> Result<Option<EncodedImage>, String> {
    let bytes = std::fs::read(plan_path).map_err(|e| format!("read failed: {e}"))?;
    let new_bytes = crate::image_profiles::cap_image_bytes(asset_type, ext, &bytes);
    let mut hasher = Sha256::new();
    hasher.update(&new_bytes);
    let hash = format!("{:x}", hasher.finalize());
    let new_name = format!("{hash}.{ext}");
    if new_name == old_name {
        return Ok(None);
    }
    let (width, height) = match imagesize::blob_size(&new_bytes) {
        Ok(size) => (size.width as u32, size.height as u32),
        Err(_) => crate::image_profiles::cap_stored_dims(asset_type, fallback_w, fallback_h),
    };
    Ok(Some(EncodedImage {
        new_name,
        hash,
        width,
        height,
        bytes: new_bytes,
    }))
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

/// Walk the project directory and rewrite references in every YAML and JSON
/// file (zone/config/lore YAML, story JSON). Returns the number of files
/// updated.
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
            // Never follow symlinks — a linked directory could escape the
            // project root (rewriting files the snapshot doesn't cover) or
            // form a cycle.
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if file_type.is_dir() {
                if !SKIP_DIRS.contains(&name.as_str()) {
                    stack.push(path);
                }
                continue;
            }
            let is_rewritable = matches!(
                path.extension().and_then(|e| e.to_str()),
                Some("yaml") | Some("yml") | Some("json")
            );
            if !is_rewritable {
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

/// Request cancellation of a running migration. The current in-flight
/// encodes drain, then the completed subset is finalized (references
/// rewritten, manifest saved, old files deleted) before the command returns.
#[tauri::command]
pub async fn cancel_asset_migration() -> Result<bool, String> {
    Ok(crate::cancellation::cancel(CANCEL_SESSION))
}

/// Downscale every stored image that exceeds its asset type's runtime
/// profile, updating the manifest and rewriting project YAML/JSON references
/// to the new content-addressed filenames. `dry_run` reports what would
/// change without touching anything.
#[tauri::command]
pub async fn migrate_assets_to_profiles(
    app: AppHandle,
    dry_run: bool,
) -> Result<MigrationReport, String> {
    let Some(project_dir) = crate::settings::active_project_dir().await else {
        return Err("Open a project first — migration rewrites project files.".to_string());
    };

    let images_dir = crate::assets::assets_dir(&app)?.join("images");

    // Fail fast instead of queueing behind another asset operation — a
    // batch import or long sync could hold the lock for minutes and the
    // spinner would give no hint why nothing is happening.
    let Ok(_lock) = crate::assets::MANIFEST_LOCK.try_lock() else {
        return Err(
            "The asset library is busy with another operation — try again when it finishes."
                .to_string(),
        );
    };
    let manifest = crate::assets::load_manifest(&app).await?;
    let journal = load_journal(&project_dir, &images_dir).await;

    // The scan stats every image and probes dimensions for entries that
    // predate size tracking — blocking I/O that can take a while on large
    // libraries, so it runs off the async runtime and streams progress.
    let scan_app = app.clone();
    let scan_images_dir = images_dir.clone();
    let (mut manifest, mut report, plans, planned) = tokio::task::spawn_blocking(move || {
        let mut report = MigrationReport::default();
        let mut plans: Vec<MigrationPlan> = Vec::new();
        let mut planned: HashMap<String, usize> = HashMap::new();
        let entry_count = manifest.assets.len();

        for (idx, entry) in manifest.assets.iter().enumerate() {
            if idx % 500 == 0 && entry_count > 1000 {
                emit_progress(&scan_app, "scanning", idx, entry_count);
            }
            let ext = extension_of(&entry.file_name);
            if !matches!(ext.as_str(), "png" | "jpg" | "jpeg") {
                continue;
            }
            if crate::image_profiles::runtime_image_profile(&entry.asset_type).is_none() {
                continue;
            }
            let path = scan_images_dir.join(&entry.file_name);
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
                let ratio = (capped_w as u64 * capped_h as u64) as f64
                    / (width as u64 * height as u64) as f64;
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
        (manifest, report, plans, planned)
    })
    .await
    .map_err(|e| format!("scan task join failed: {e}"))?;

    if dry_run {
        // Journal leftovers from an interrupted run still need their
        // references finalized — count them so the user gets a real run.
        for (old, new) in &journal {
            if planned.contains_key(old) {
                continue;
            }
            let Ok(old_meta) = std::fs::metadata(images_dir.join(old)) else {
                continue;
            };
            report.affected += 1;
            report.bytes_before += old_meta.len();
            report.bytes_after += std::fs::metadata(images_dir.join(new))
                .map(|m| m.len())
                .unwrap_or(old_meta.len());
        }
        report.estimated = true;
        return Ok(report);
    }
    if plans.is_empty() && journal.is_empty() {
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
    let mut mapping = journal;

    let cancel_flag = crate::cancellation::register(CANCEL_SESSION.to_string());
    let concurrency = std::thread::available_parallelism()
        .map(|n| n.get() / 2)
        .unwrap_or(2)
        .clamp(1, 4);
    let mut join_set: tokio::task::JoinSet<(usize, Result<Option<EncodedImage>, String>)> =
        tokio::task::JoinSet::new();
    let mut next = 0usize;
    let mut done = 0usize;
    if total > 0 {
        emit_progress(&app, "encoding", 0, total);
    }

    loop {
        while next < total
            && join_set.len() < concurrency
            && !crate::cancellation::is_cancelled(&cancel_flag)
        {
            let plan = &plans[next];
            let idx = next;
            let path = plan.path.clone();
            let asset_type = plan.asset_type.clone();
            let ext = plan.ext.clone();
            let old_name = plan.old_name.clone();
            let (w, h) = (plan.width, plan.height);
            join_set.spawn_blocking(move || {
                (idx, encode_plan(&path, &asset_type, &ext, &old_name, w, h))
            });
            next += 1;
        }
        let Some(joined) = join_set.join_next().await else {
            break;
        };
        done += 1;
        match joined {
            Err(e) => report.errors.push(format!("encode task failed: {e}")),
            Ok((idx, Err(e))) => {
                report.errors.push(format!("{}: {e}", plans[idx].old_name));
                report.bytes_after += plans[idx].file_size;
            }
            Ok((idx, Ok(None))) => report.bytes_after += plans[idx].file_size,
            Ok((idx, Ok(Some(img)))) => {
                let plan = &plans[idx];
                let dest = images_dir.join(&img.new_name);
                let written = if dest.exists() {
                    true
                } else {
                    match tokio::fs::write(&dest, &img.bytes).await {
                        Ok(()) => true,
                        Err(e) => {
                            report
                                .errors
                                .push(format!("{}: write failed: {e}", plan.old_name));
                            report.bytes_after += plan.file_size;
                            false
                        }
                    }
                };
                if written {
                    report.bytes_after += img.bytes.len() as u64;
                    for &i in &plan.indices {
                        let entry = &mut manifest.assets[i];
                        entry.hash = img.hash.clone();
                        entry.file_name = img.new_name.clone();
                        entry.width = img.width;
                        entry.height = img.height;
                        entry.sync_status = "local".to_string();
                    }
                    mapping.insert(plan.old_name.clone(), img.new_name.clone());
                }
            }
        }
        emit_progress(&app, "encoding", done, total);
        if done % COMMIT_INTERVAL == 0 {
            if let Err(e) = commit_progress(&app, &project_dir, &mapping, &manifest).await {
                report.errors.push(format!("checkpoint save failed: {e}"));
            }
        }
    }
    report.cancelled = crate::cancellation::is_cancelled(&cancel_flag) && next < total;
    crate::cancellation::unregister(CANCEL_SESSION);
    for plan in &plans[next..] {
        report.remaining += 1;
        report.bytes_after += plan.file_size;
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
    // Skip any name the final manifest still references: an optimized output
    // can hash to a file that already existed, and an entry whose asset type
    // has no profile can share a file with a migrated entry.
    let still_referenced: std::collections::HashSet<&str> =
        manifest.assets.iter().map(|a| a.file_name.as_str()).collect();
    for old_name in mapping.keys() {
        if still_referenced.contains(old_name.as_str()) {
            continue;
        }
        let _ = tokio::fs::remove_file(images_dir.join(old_name)).await;
    }
    let _ = tokio::fs::remove_file(journal_path(&project_dir)).await;

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

    #[test]
    fn journal_round_trips_through_json() {
        let journal = MigrationJournal {
            pairs: mapping(&[(OLD_A, NEW_A), (OLD_B, NEW_B)]),
        };
        let json = serde_json::to_string(&journal).unwrap();
        let back: MigrationJournal = serde_json::from_str(&json).unwrap();
        assert_eq!(back.pairs, journal.pairs);
    }

    #[test]
    fn rewrite_project_references_covers_yaml_and_json_and_skips_excluded_dirs() {
        let root = std::env::temp_dir().join(format!(
            "arcanum-migration-test-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("stories")).unwrap();
        std::fs::create_dir_all(root.join(".arcanum")).unwrap();

        std::fs::write(
            root.join("zone.yaml"),
            format!("rooms:\n  start:\n    image: {OLD_A}\n"),
        )
        .unwrap();
        std::fs::write(
            root.join("stories").join("intro.json"),
            format!("{{\n  \"imageOverride\": \"{OLD_A}\"\n}}\n"),
        )
        .unwrap();
        std::fs::write(
            root.join(".arcanum").join("manifest.json"),
            format!("{{\"fileName\": \"{OLD_A}\"}}"),
        )
        .unwrap();
        std::fs::write(root.join("notes.txt"), OLD_A).unwrap();

        let updated =
            rewrite_project_references(&root, &mapping(&[(OLD_A, NEW_A)])).unwrap();
        assert_eq!(updated, 2);

        let zone = std::fs::read_to_string(root.join("zone.yaml")).unwrap();
        assert!(zone.contains(NEW_A) && !zone.contains(OLD_A));
        let story = std::fs::read_to_string(root.join("stories").join("intro.json")).unwrap();
        assert!(story.contains(NEW_A) && !story.contains(OLD_A));
        let manifest =
            std::fs::read_to_string(root.join(".arcanum").join("manifest.json")).unwrap();
        assert!(manifest.contains(OLD_A));
        let notes = std::fs::read_to_string(root.join("notes.txt")).unwrap();
        assert!(notes.contains(OLD_A));

        let _ = std::fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn rewrite_project_references_does_not_follow_symlinks() {
        let base = std::env::temp_dir().join(format!(
            "arcanum-migration-symlink-test-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&base);
        let root = base.join("project");
        let outside = base.join("outside");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::create_dir_all(&outside).unwrap();

        std::fs::write(outside.join("external.yaml"), format!("image: {OLD_A}\n")).unwrap();
        std::os::unix::fs::symlink(&outside, root.join("linked")).unwrap();

        let updated =
            rewrite_project_references(&root, &mapping(&[(OLD_A, NEW_A)])).unwrap();
        assert_eq!(updated, 0);

        let external = std::fs::read_to_string(outside.join("external.yaml")).unwrap();
        assert!(external.contains(OLD_A));

        let _ = std::fs::remove_dir_all(&base);
    }
}
