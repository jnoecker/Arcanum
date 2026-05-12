import { retrieveLoreContext } from ".";
import { formatContextForPrompt } from "./promptAssembly";
import type { RetrievedChunk } from "./types";

export interface RetrievalDiagnostic {
  usedRag: boolean;
  /** Distinct artefacts pulled from the index, top first. */
  sources: { id: string; kind: string; title: string; score: number }[];
}

export interface BuildLoreContextOptions {
  query: string;
  excludeSourceIds?: string[];
  k?: number;
  maxChars?: number;
  fallback?: () => string;
}

export interface BuildLoreContextResult {
  context: string;
  diagnostic: RetrievalDiagnostic;
}

/**
 * Retrieve lore context for an LLM prompt. Always returns something — either
 * RAG-backed context with sources, or the caller's fallback when retrieval
 * is unavailable or empty. Caller-provided `excludeSourceIds` drop chunks
 * from the result so the retrieved material complements rather than echoes
 * the article being acted on.
 */
export async function buildRagContext({
  query,
  excludeSourceIds = [],
  k = 10,
  maxChars = 8000,
  fallback,
}: BuildLoreContextOptions): Promise<BuildLoreContextResult> {
  try {
    const chunks = await retrieveLoreContext({ query, k });
    const exclude = new Set(excludeSourceIds);
    const filtered = chunks.filter((c) => !exclude.has(c.source_id));
    if (filtered.length > 0) {
      return {
        context: formatContextForPrompt(filtered, maxChars),
        diagnostic: { usedRag: true, sources: summariseSources(filtered) },
      };
    }
  } catch (e) {
    console.warn("[rag] retrieval failed; using fallback context", e);
  }
  return {
    context: fallback?.() ?? "",
    diagnostic: { usedRag: false, sources: [] },
  };
}

function summariseSources(
  chunks: RetrievedChunk[],
): RetrievalDiagnostic["sources"] {
  const seen = new Map<string, RetrievalDiagnostic["sources"][number]>();
  for (const c of chunks) {
    const key = `${c.kind}:${c.source_id}`;
    const prior = seen.get(key);
    if (!prior || c.score > prior.score) {
      seen.set(key, {
        id: c.source_id,
        kind: c.kind,
        title: c.title || c.source_id,
        score: c.score,
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}
