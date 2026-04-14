use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const SNAPSHOTS_DIR: &str = ".arcanum/snapshots";

// Directories always excluded from snapshots / backups.
const ALWAYS_EXCLUDED_DIRS: &[&str] = &[
    ".arcanum/snapshots",
    ".arcanum/autosave",
    ".git",
    "node_modules",
    "target",
    "build",
    "dist",
    ".gradle",
];

// Additional directories excluded when `include_assets` is false. These hold
// large binary content that's either regenerable or heavy enough to skip for
// quick periodic snapshots.
const ASSET_DIRS: &[&str] = &["assets"];

const MEDIA_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "mp3", "ogg", "wav", "mp4", "webm", "mov", "mkv",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotInfo {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub label: Option<String>,
    pub created_at: String,
    pub size_bytes: u64,
    pub include_assets: bool,
}

fn snapshots_dir(project_dir: &str) -> PathBuf {
    Path::new(project_dir).join(SNAPSHOTS_DIR)
}

/// Return true when `rel_path` (relative to the project root, using forward
/// slashes) sits inside one of the excluded directories.
fn is_path_excluded(rel_path: &str, include_assets: bool) -> bool {
    let norm = rel_path.replace('\\', "/");
    for excluded in ALWAYS_EXCLUDED_DIRS {
        if norm == *excluded
            || norm.starts_with(&format!("{excluded}/"))
            || norm.ends_with(&format!("/{excluded}"))
            || norm.contains(&format!("/{excluded}/"))
        {
            return true;
        }
    }
    if !include_assets {
        for d in ASSET_DIRS {
            if norm == *d
                || norm.starts_with(&format!("{d}/"))
                || norm.contains(&format!("/{d}/"))
            {
                return true;
            }
        }
    }
    false
}

fn is_media_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MEDIA_EXTENSIONS.iter().any(|m| m.eq_ignore_ascii_case(e)))
        .unwrap_or(false)
}

/// Build a zip archive of the project directory at `target_zip`. Returns the
/// number of files archived.
fn build_zip(project_dir: &Path, target_zip: &Path, include_assets: bool) -> Result<u32, String> {
    if let Some(parent) = target_zip.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create archive dir: {e}"))?;
    }

    let file = File::create(target_zip).map_err(|e| format!("Failed to create zip: {e}"))?;
    let writer = BufWriter::new(file);
    let mut zip = ZipWriter::new(writer);
    let options: SimpleFileOptions = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .compression_level(Some(4));

    let mut count: u32 = 0;
    let mut buffer = Vec::with_capacity(1 << 16);

    for entry in WalkDir::new(project_dir)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let rel = match e.path().strip_prefix(project_dir) {
                Ok(p) => p.to_string_lossy().to_string(),
                Err(_) => return true,
            };
            !is_path_excluded(&rel, include_assets)
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(err) => {
                eprintln!("[snapshot] skipping entry: {err}");
                continue;
            }
        };

        let path = entry.path();
        let rel = match path.strip_prefix(project_dir) {
            Ok(p) => p.to_path_buf(),
            Err(_) => continue,
        };

        if rel.as_os_str().is_empty() {
            continue;
        }

        if !include_assets && entry.file_type().is_file() && is_media_file(path) {
            continue;
        }

        let rel_str = rel.to_string_lossy().replace('\\', "/");

        if entry.file_type().is_dir() {
            zip.add_directory(format!("{rel_str}/"), options)
                .map_err(|e| format!("zip add_directory failed: {e}"))?;
            continue;
        }

        if !entry.file_type().is_file() {
            continue;
        }

        zip.start_file(&rel_str, options)
            .map_err(|e| format!("zip start_file failed for {rel_str}: {e}"))?;
        let mut f = BufReader::new(
            File::open(path).map_err(|e| format!("Failed to open {rel_str}: {e}"))?,
        );
        buffer.clear();
        f.read_to_end(&mut buffer)
            .map_err(|e| format!("Failed to read {rel_str}: {e}"))?;
        zip.write_all(&buffer)
            .map_err(|e| format!("zip write failed for {rel_str}: {e}"))?;
        count += 1;
    }

    zip.finish().map_err(|e| format!("zip finish failed: {e}"))?;
    Ok(count)
}

fn format_timestamp() -> String {
    chrono::Local::now().format("%Y-%m-%d_%H%M%S").to_string()
}

fn sanitize_label(label: &str) -> String {
    label
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .take(40)
        .collect()
}

fn parse_snapshot_name(stem: &str) -> (String, String, Option<String>) {
    // Format: <timestamp>_<kind>[_<label>]
    //   2026-04-14_153012_auto
    //   2026-04-14_153012_manual_before_the_refactor
    let parts: Vec<&str> = stem.splitn(4, '_').collect();
    if parts.len() < 3 {
        return (String::new(), "unknown".to_string(), None);
    }
    let ts = format!("{}_{}", parts[0], parts[1]);
    let kind = parts[2].to_string();
    let label = if parts.len() == 4 {
        Some(parts[3].to_string())
    } else {
        None
    };
    (ts, kind, label)
}

#[tauri::command]
pub async fn snapshot_create(
    project_dir: String,
    kind: String,
    label: Option<String>,
    include_assets: bool,
) -> Result<SnapshotInfo, String> {
    let project_path = PathBuf::from(&project_dir);
    if !project_path.is_dir() {
        return Err(format!("Project directory does not exist: {project_dir}"));
    }

    let dir = snapshots_dir(&project_dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create snapshots dir: {e}"))?;

    let ts = format_timestamp();
    let kind_clean = sanitize_label(&kind);
    let label_part = label
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("_{}", sanitize_label(s)));
    let name = format!(
        "{ts}_{kind_clean}{}.zip",
        label_part.clone().unwrap_or_default()
    );
    let target = dir.join(&name);

    tokio::task::spawn_blocking({
        let project = project_path.clone();
        let target = target.clone();
        move || build_zip(&project, &target, include_assets)
    })
    .await
    .map_err(|e| format!("snapshot task join failed: {e}"))??;

    let meta = std::fs::metadata(&target).map_err(|e| format!("stat snapshot failed: {e}"))?;

    Ok(SnapshotInfo {
        path: target.to_string_lossy().to_string(),
        name,
        kind: kind_clean,
        label: label.filter(|s| !s.trim().is_empty()),
        created_at: ts,
        size_bytes: meta.len(),
        include_assets,
    })
}

#[tauri::command]
pub async fn snapshot_list(project_dir: String) -> Result<Vec<SnapshotInfo>, String> {
    let dir = snapshots_dir(&project_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    let mut entries =
        tokio::fs::read_dir(&dir).await.map_err(|e| format!("readdir snapshots: {e}"))?;
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("readdir entry: {e}"))?
    {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("zip") {
            continue;
        }
        let meta = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let (created_at, kind, label) = parse_snapshot_name(&stem);
        out.push(SnapshotInfo {
            path: path.to_string_lossy().to_string(),
            name: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string(),
            kind,
            label,
            created_at,
            size_bytes: meta.len(),
            include_assets: false, // unknown from filename; UI can be silent about this
        });
    }

    // Sort newest-first by filename (timestamp prefix gives natural ordering).
    out.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(out)
}

#[tauri::command]
pub async fn snapshot_delete(project_dir: String, snapshot_path: String) -> Result<(), String> {
    let snap = PathBuf::from(&snapshot_path);
    let dir = snapshots_dir(&project_dir);
    let canon_snap = snap
        .canonicalize()
        .map_err(|e| format!("canonicalize snapshot: {e}"))?;
    let canon_dir = dir
        .canonicalize()
        .map_err(|e| format!("canonicalize dir: {e}"))?;
    if !canon_snap.starts_with(&canon_dir) {
        return Err("snapshot path escapes project snapshots directory".into());
    }
    tokio::fs::remove_file(&snap)
        .await
        .map_err(|e| format!("delete snapshot: {e}"))
}

fn extract_zip(zip_path: &Path, target_dir: &Path) -> Result<u32, String> {
    let file = File::open(zip_path).map_err(|e| format!("open zip: {e}"))?;
    let mut archive = ZipArchive::new(BufReader::new(file))
        .map_err(|e| format!("parse zip: {e}"))?;
    let mut count = 0u32;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("zip index {i}: {e}"))?;
        // Guard against path traversal in the zip.
        let Some(enclosed) = entry.enclosed_name() else {
            return Err(format!("unsafe path in zip: {}", entry.name()));
        };
        let out_path = target_dir.join(&enclosed);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("mkdir {}: {e}", out_path.display()))?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("mkdir parent {}: {e}", parent.display()))?;
        }
        let mut out = File::create(&out_path)
            .map_err(|e| format!("create {}: {e}", out_path.display()))?;
        std::io::copy(&mut entry, &mut out)
            .map_err(|e| format!("extract {}: {e}", out_path.display()))?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub async fn snapshot_restore(
    project_dir: String,
    snapshot_path: String,
) -> Result<u32, String> {
    let project_path = PathBuf::from(&project_dir);
    if !project_path.is_dir() {
        return Err(format!("Project directory does not exist: {project_dir}"));
    }
    let snap = PathBuf::from(&snapshot_path);
    if !snap.exists() {
        return Err(format!("Snapshot not found: {snapshot_path}"));
    }

    // Safety net: snapshot the current state before we clobber it, so users
    // can walk back even if the restore picked the wrong archive.
    let _safety = snapshot_create(
        project_dir.clone(),
        "pre-restore".to_string(),
        None,
        false,
    )
    .await?;

    tokio::task::spawn_blocking({
        let project = project_path.clone();
        let snap = snap.clone();
        move || extract_zip(&snap, &project)
    })
    .await
    .map_err(|e| format!("restore task join failed: {e}"))?
}

#[tauri::command]
pub async fn snapshot_prune(project_dir: String, keep_count: u32) -> Result<u32, String> {
    let snapshots = snapshot_list(project_dir.clone()).await?;
    // Only prune auto snapshots — manual and pre-restore are always kept.
    let auto: Vec<&SnapshotInfo> = snapshots
        .iter()
        .filter(|s| s.kind == "auto")
        .collect();
    let keep = keep_count as usize;
    if auto.len() <= keep {
        return Ok(0);
    }
    let to_remove: Vec<String> = auto
        .iter()
        .skip(keep)
        .map(|s| s.path.clone())
        .collect();
    let mut removed = 0u32;
    for path in to_remove {
        if tokio::fs::remove_file(&path).await.is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

#[tauri::command]
pub async fn backup_export(
    project_dir: String,
    target_path: String,
    include_assets: bool,
) -> Result<u64, String> {
    let project_path = PathBuf::from(&project_dir);
    if !project_path.is_dir() {
        return Err(format!("Project directory does not exist: {project_dir}"));
    }
    let target = PathBuf::from(&target_path);
    tokio::task::spawn_blocking({
        let project = project_path.clone();
        let target = target.clone();
        move || build_zip(&project, &target, include_assets)
    })
    .await
    .map_err(|e| format!("backup task join failed: {e}"))??;

    let meta = std::fs::metadata(&target).map_err(|e| format!("stat backup: {e}"))?;
    Ok(meta.len())
}

#[tauri::command]
pub async fn backup_import(zip_path: String, target_dir: String) -> Result<u32, String> {
    let zip = PathBuf::from(&zip_path);
    let target = PathBuf::from(&target_dir);
    if !zip.exists() {
        return Err(format!("Backup archive not found: {zip_path}"));
    }
    std::fs::create_dir_all(&target)
        .map_err(|e| format!("Failed to create target dir: {e}"))?;

    tokio::task::spawn_blocking({
        let zip = zip.clone();
        let target = target.clone();
        move || extract_zip(&zip, &target)
    })
    .await
    .map_err(|e| format!("import task join failed: {e}"))?
}
