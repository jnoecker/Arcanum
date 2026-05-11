import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { chunkLore, type ChunkerInput } from "./chunker";
import type { IndexStats, RetrievalFilters, RetrievedChunk } from "./types";

function activeProjectPath(): string | null {
  return useProjectStore.getState().project?.mudDir ?? null;
}

export async function retrieveLoreContext(params: {
  query: string;
  k?: number;
  filters?: RetrievalFilters;
}): Promise<RetrievedChunk[]> {
  const projectPath = activeProjectPath();
  if (!projectPath) return [];
  const k = params.k ?? 8;
  const filters = params.filters ?? {};
  return invoke<RetrievedChunk[]>("rag_retrieve", {
    projectPath,
    query: params.query,
    k,
    filters,
  });
}

export async function rebuildIndex(
  input: ChunkerInput,
  onProgress?: (stage: string) => void,
): Promise<IndexStats> {
  const projectPath = activeProjectPath();
  if (!projectPath) throw new Error("No active project");
  onProgress?.("Chunking…");
  const chunks = chunkLore(input);
  onProgress?.(`Embedding ${chunks.length} chunks…`);
  const stats = await invoke<IndexStats>("rag_upsert_chunks", {
    projectPath,
    chunks,
  });
  onProgress?.("Done");
  return stats;
}

export async function getIndexStats(): Promise<IndexStats | null> {
  const projectPath = activeProjectPath();
  if (!projectPath) return null;
  try {
    return await invoke<IndexStats>("rag_index_stats", { projectPath });
  } catch {
    return null;
  }
}

export async function clearIndex(): Promise<void> {
  const projectPath = activeProjectPath();
  if (!projectPath) return;
  await invoke("rag_clear_index", { projectPath });
}

export type { ChunkerInput } from "./chunker";
export type {
  IndexStats,
  RagChunk,
  RetrievalFilters,
  RetrievedChunk,
} from "./types";
