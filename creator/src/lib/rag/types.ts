export interface RagChunk {
  id: string;
  kind: "article" | "event" | "pin" | "region" | "relationship" | "entity";
  source_id: string;
  section?: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
}

export interface RetrievedChunk extends RagChunk {
  score: number;
}

export interface RetrievalFilters {
  include_kinds?: RagChunk["kind"][];
  must_include_source_ids?: string[];
  /** OR-match against metadata.tags */
  tags?: string[];
}

export interface IndexStats {
  total_chunks: number;
  by_kind: Record<string, number>;
  embedding_model: string;
  embedding_dim: number;
  last_embedded_at: number | null;
}
