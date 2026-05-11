// ─── Lore RAG index ──────────────────────────────────────────────────
//
// Local-first embedding store backed by SQLite at
// <project>/.arcanum/rag.sqlite. Retrieval is a brute-force cosine
// over a BLOB column — a lore corpus is at most a few thousand chunks,
// so this is sub-millisecond in practice and avoids the ANN
// dependency footprint.
//
// Embedding model and dimension are recorded in `index_meta`. If a
// caller's configured model/dim diverges from what's stored, every
// operation refuses and asks the user to clear+rebuild — silently
// mixing dim-512 and dim-1024 vectors would yield nonsense ranks.

use std::collections::HashMap;
use std::path::PathBuf;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::AppHandle;

use crate::embeddings::{self, EMBEDDING_DIM, EMBEDDING_MODEL};
use crate::settings;

const SCHEMA_VERSION: &str = "1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagChunk {
    pub id: String,
    pub kind: String,
    pub source_id: String,
    pub section: Option<String>,
    pub title: String,
    pub body: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievedChunk {
    pub id: String,
    pub kind: String,
    pub source_id: String,
    pub section: Option<String>,
    pub title: String,
    pub body: String,
    pub metadata: serde_json::Value,
    pub score: f32,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct RetrievalFilters {
    pub include_kinds: Option<Vec<String>>,
    pub must_include_source_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexStats {
    pub total_chunks: u32,
    pub by_kind: HashMap<String, u32>,
    pub embedding_model: String,
    pub embedding_dim: u32,
    pub last_embedded_at: Option<i64>,
}

// ─── Path resolution ─────────────────────────────────────────────────

fn db_path(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".arcanum").join("rag.sqlite")
}

fn ensure_parent(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create rag dir: {e}"))?;
    }
    Ok(())
}

// ─── Connection helpers ──────────────────────────────────────────────

fn open_conn(project_path: &str) -> Result<Connection, String> {
    let path = db_path(project_path);
    ensure_parent(&path)?;
    let conn = Connection::open(&path).map_err(|e| format!("Failed to open rag.sqlite: {e}"))?;
    init_schema(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            source_id TEXT NOT NULL,
            section TEXT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            metadata TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            embedding BLOB NOT NULL,
            embedded_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
        CREATE INDEX IF NOT EXISTS idx_chunks_kind ON chunks(kind);
        CREATE TABLE IF NOT EXISTS index_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| format!("Failed to init rag schema: {e}"))
}

fn get_meta(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM index_meta WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| format!("Failed to read index_meta: {e}"))
}

fn set_meta(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO index_meta (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| format!("Failed to write index_meta: {e}"))?;
    Ok(())
}

/// Verify that the stored embedding model/dim match what this build
/// would produce. On a fresh DB, write the meta. On a mismatch, return
/// an error directing the user to clear+rebuild — mixing vectors from
/// different models produces meaningless rankings.
fn verify_or_seed_meta(conn: &Connection) -> Result<(), String> {
    let model = get_meta(conn, "embedding_model")?;
    let dim = get_meta(conn, "embedding_dim")?;
    let schema = get_meta(conn, "schema_version")?;
    match (model.as_deref(), dim.as_deref()) {
        (Some(m), Some(d)) => {
            if m != EMBEDDING_MODEL {
                return Err(format!(
                    "RAG index was built with embedding model '{m}', \
                     but the current build uses '{EMBEDDING_MODEL}'. \
                     Clear the index from Settings → Lore RAG and rebuild."
                ));
            }
            let stored_dim: u32 = d
                .parse()
                .map_err(|_| format!("RAG index has invalid embedding_dim '{d}'"))?;
            if stored_dim != EMBEDDING_DIM {
                return Err(format!(
                    "RAG index dimension {stored_dim} does not match \
                     current embedding dim {EMBEDDING_DIM}. Clear and rebuild."
                ));
            }
            if schema.as_deref() != Some(SCHEMA_VERSION) {
                set_meta(conn, "schema_version", SCHEMA_VERSION)?;
            }
        }
        _ => {
            set_meta(conn, "schema_version", SCHEMA_VERSION)?;
            set_meta(conn, "embedding_model", EMBEDDING_MODEL)?;
            set_meta(conn, "embedding_dim", &EMBEDDING_DIM.to_string())?;
        }
    }
    Ok(())
}

// ─── Encoding helpers ────────────────────────────────────────────────

fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(embedding.len() * 4);
    for f in embedding {
        out.extend_from_slice(&f.to_le_bytes());
    }
    out
}

fn bytes_to_embedding(bytes: &[u8]) -> Vec<f32> {
    let mut out = Vec::with_capacity(bytes.len() / 4);
    let mut chunk = [0u8; 4];
    for c in bytes.chunks_exact(4) {
        chunk.copy_from_slice(c);
        out.push(f32::from_le_bytes(chunk));
    }
    out
}

fn content_hash(body: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(body.as_bytes());
    hex::encode(hasher.finalize())
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    let mut na = 0.0f32;
    let mut nb = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    let denom = na.sqrt() * nb.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}

// ─── Stats ───────────────────────────────────────────────────────────

fn compute_stats(conn: &Connection) -> Result<IndexStats, String> {
    let total: u32 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count chunks: {e}"))?;

    let mut by_kind: HashMap<String, u32> = HashMap::new();
    let mut stmt = conn
        .prepare("SELECT kind, COUNT(*) FROM chunks GROUP BY kind")
        .map_err(|e| format!("Failed to prepare kind stats: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
        })
        .map_err(|e| format!("Failed to read kind stats: {e}"))?;
    for r in rows {
        let (k, c) = r.map_err(|e| format!("Failed to decode kind stats: {e}"))?;
        by_kind.insert(k, c);
    }

    let last_embedded_at: Option<i64> = conn
        .query_row("SELECT MAX(embedded_at) FROM chunks", [], |row| row.get(0))
        .optional()
        .map_err(|e| format!("Failed to read last embedded_at: {e}"))?
        .flatten();

    let model = get_meta(conn, "embedding_model")?.unwrap_or_else(|| EMBEDDING_MODEL.to_string());
    let dim: u32 = get_meta(conn, "embedding_dim")?
        .and_then(|d| d.parse().ok())
        .unwrap_or(EMBEDDING_DIM);

    Ok(IndexStats {
        total_chunks: total,
        by_kind,
        embedding_model: model,
        embedding_dim: dim,
        last_embedded_at,
    })
}

// ─── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn rag_upsert_chunks(
    app: AppHandle,
    project_path: String,
    chunks: Vec<RagChunk>,
) -> Result<IndexStats, String> {
    let settings = settings::get_settings(app).await?;

    // Phase 1: figure out which chunks need (re)embedding by reading
    // existing hashes from SQLite. spawn_blocking keeps the async
    // runtime free.
    let project_for_scan = project_path.clone();
    let chunks_for_scan = chunks.clone();
    let needs_embed: Vec<(usize, String)> = tokio::task::spawn_blocking(move || {
        let conn = open_conn(&project_for_scan)?;
        verify_or_seed_meta(&conn)?;
        let mut stmt = conn
            .prepare("SELECT content_hash FROM chunks WHERE id = ?1")
            .map_err(|e| format!("Failed to prepare lookup: {e}"))?;
        let mut to_embed = Vec::new();
        for (idx, chunk) in chunks_for_scan.iter().enumerate() {
            let hash = content_hash(&chunk.body);
            let existing: Option<String> = stmt
                .query_row(params![chunk.id], |row| row.get::<_, String>(0))
                .optional()
                .map_err(|e| format!("Failed to read existing hash: {e}"))?;
            if existing.as_deref() != Some(hash.as_str()) {
                to_embed.push((idx, hash));
            }
        }
        Ok::<_, String>(to_embed)
    })
    .await
    .map_err(|e| format!("rag scan task failed: {e}"))??;

    // Phase 2: embed the changed bodies (batched inside embeddings::embed).
    let embed_inputs: Vec<String> = needs_embed
        .iter()
        .map(|(idx, _)| chunks[*idx].body.clone())
        .collect();
    let vectors = embeddings::embed(&settings, &embed_inputs).await?;
    if vectors.len() != embed_inputs.len() {
        return Err(format!(
            "Embedding provider returned {} vectors for {} inputs",
            vectors.len(),
            embed_inputs.len()
        ));
    }
    for v in &vectors {
        if v.len() as u32 != EMBEDDING_DIM {
            return Err(format!(
                "Embedding dimension mismatch: expected {EMBEDDING_DIM}, got {}",
                v.len()
            ));
        }
    }

    // Phase 3: write back atomically inside a transaction.
    let project_for_write = project_path;
    let stats = tokio::task::spawn_blocking(move || {
        let mut conn = open_conn(&project_for_write)?;
        verify_or_seed_meta(&conn)?;
        let now_ms: i64 = chrono::Utc::now().timestamp_millis();
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to open transaction: {e}"))?;
        for (vec_idx, (chunk_idx, hash)) in needs_embed.iter().enumerate() {
            let chunk = &chunks[*chunk_idx];
            let embedding = &vectors[vec_idx];
            let metadata_text = serde_json::to_string(&chunk.metadata)
                .map_err(|e| format!("Failed to serialize metadata: {e}"))?;
            let blob = embedding_to_bytes(embedding);
            tx.execute(
                "INSERT INTO chunks (id, kind, source_id, section, title, body, metadata, content_hash, embedding, embedded_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) \
                 ON CONFLICT(id) DO UPDATE SET \
                   kind = excluded.kind, \
                   source_id = excluded.source_id, \
                   section = excluded.section, \
                   title = excluded.title, \
                   body = excluded.body, \
                   metadata = excluded.metadata, \
                   content_hash = excluded.content_hash, \
                   embedding = excluded.embedding, \
                   embedded_at = excluded.embedded_at",
                params![
                    chunk.id,
                    chunk.kind,
                    chunk.source_id,
                    chunk.section,
                    chunk.title,
                    chunk.body,
                    metadata_text,
                    hash,
                    blob,
                    now_ms,
                ],
            )
            .map_err(|e| format!("Failed to upsert chunk {}: {e}", chunk.id))?;
        }
        tx.commit()
            .map_err(|e| format!("Failed to commit transaction: {e}"))?;
        compute_stats(&conn)
    })
    .await
    .map_err(|e| format!("rag write task failed: {e}"))??;

    Ok(stats)
}

#[tauri::command]
pub async fn rag_retrieve(
    app: AppHandle,
    project_path: String,
    query: String,
    k: usize,
    filters: RetrievalFilters,
) -> Result<Vec<RetrievedChunk>, String> {
    let settings = settings::get_settings(app).await?;
    let query_vec = {
        let vs = embeddings::embed(&settings, &[query]).await?;
        vs.into_iter()
            .next()
            .ok_or_else(|| "Embedding provider returned no vector for query".to_string())?
    };
    if query_vec.len() as u32 != EMBEDDING_DIM {
        return Err(format!(
            "Query embedding dim {} does not match expected {EMBEDDING_DIM}",
            query_vec.len()
        ));
    }

    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&project_path)?;
        verify_or_seed_meta(&conn)?;
        let mut stmt = conn
            .prepare(
                "SELECT id, kind, source_id, section, title, body, metadata, embedding FROM chunks",
            )
            .map_err(|e| format!("Failed to prepare retrieval query: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Vec<u8>>(7)?,
                ))
            })
            .map_err(|e| format!("Failed to scan chunks: {e}"))?;

        let include_kinds = filters.include_kinds.as_ref();
        let source_filter = filters.must_include_source_ids.as_ref();
        let tag_filter = filters.tags.as_ref();

        let mut scored: Vec<RetrievedChunk> = Vec::new();
        for row in rows {
            let (id, kind, source_id, section, title, body, metadata_text, blob) =
                row.map_err(|e| format!("Failed to decode chunk row: {e}"))?;
            if let Some(kinds) = include_kinds {
                if !kinds.is_empty() && !kinds.contains(&kind) {
                    continue;
                }
            }
            if let Some(sources) = source_filter {
                if !sources.is_empty() && !sources.contains(&source_id) {
                    continue;
                }
            }
            let metadata: serde_json::Value =
                serde_json::from_str(&metadata_text).unwrap_or(serde_json::Value::Null);
            if let Some(tags) = tag_filter {
                if !tags.is_empty() {
                    let matched = metadata
                        .get("tags")
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter().any(|t| {
                                t.as_str()
                                    .map(|s| tags.iter().any(|f| f == s))
                                    .unwrap_or(false)
                            })
                        })
                        .unwrap_or(false);
                    if !matched {
                        continue;
                    }
                }
            }
            let embedding = bytes_to_embedding(&blob);
            let score = cosine_similarity(&query_vec, &embedding);
            scored.push(RetrievedChunk {
                id,
                kind,
                source_id,
                section,
                title,
                body,
                metadata,
                score,
            });
        }

        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(k);
        Ok::<_, String>(scored)
    })
    .await
    .map_err(|e| format!("rag retrieve task failed: {e}"))?
}

#[tauri::command]
pub async fn rag_index_stats(project_path: String) -> Result<IndexStats, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&project_path)?;
        verify_or_seed_meta(&conn)?;
        compute_stats(&conn)
    })
    .await
    .map_err(|e| format!("rag stats task failed: {e}"))?
}

#[tauri::command]
pub async fn rag_clear_index(project_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&project_path)?;
        conn.execute("DELETE FROM chunks", [])
            .map_err(|e| format!("Failed to clear chunks: {e}"))?;
        conn.execute("DELETE FROM index_meta", [])
            .map_err(|e| format!("Failed to clear index_meta: {e}"))?;
        // Reseed meta so future writes don't trip the version check.
        set_meta(&conn, "schema_version", SCHEMA_VERSION)?;
        set_meta(&conn, "embedding_model", EMBEDDING_MODEL)?;
        set_meta(&conn, "embedding_dim", &EMBEDDING_DIM.to_string())?;
        Ok::<_, String>(())
    })
    .await
    .map_err(|e| format!("rag clear task failed: {e}"))?
}
