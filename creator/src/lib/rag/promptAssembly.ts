import type { RetrievedChunk } from "./types";

interface GroupedArtefact {
  source_id: string;
  kind: RetrievedChunk["kind"];
  title: string;
  sections: { section?: string; body: string; id: string }[];
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function groupBySource(chunks: RetrievedChunk[]): GroupedArtefact[] {
  const order: string[] = [];
  const groups = new Map<string, GroupedArtefact>();
  for (const c of chunks) {
    const key = `${c.kind}:${c.source_id}`;
    let g = groups.get(key);
    if (!g) {
      g = { source_id: c.source_id, kind: c.kind, title: c.title, sections: [] };
      groups.set(key, g);
      order.push(key);
    }
    g.sections.push({ section: c.section, body: c.body, id: c.id });
  }
  return order.map((k) => groups.get(k)!);
}

function renderArtefact(g: GroupedArtefact): string {
  const titleAttr = escapeAttr(g.title);
  const idAttr = escapeAttr(g.sections[0]?.id ?? `${g.kind}:${g.source_id}`);
  const sectionLabels = g.sections
    .map((s) => s.section)
    .filter((s): s is string => !!s);
  const sectionAttr = sectionLabels.length > 0 ? ` section="${escapeAttr(sectionLabels.join(", "))}"` : "";
  const body = g.sections
    .map((s) => (s.section && g.sections.length > 1 ? `## ${s.section}\n${s.body}` : s.body))
    .join("\n\n")
    .trim();
  return `<artefact id="${idAttr}" kind="${g.kind}" title="${titleAttr}"${sectionAttr}>\n${body}\n</artefact>`;
}

/**
 * Render retrieved chunks as a structured `<lore-context>` block suitable for
 * inclusion in an LLM system prompt. Chunks from the same source are collapsed
 * into a single `<artefact>` with concatenated sections. Total output is capped
 * at `maxChars` (default 12000) — overflow artefacts are dropped from the tail.
 */
export function formatContextForPrompt(
  chunks: RetrievedChunk[],
  maxChars: number = 12000,
): string {
  if (chunks.length === 0) return "<lore-context></lore-context>";
  const grouped = groupBySource(chunks);
  const parts: string[] = [];
  let total = "<lore-context>\n</lore-context>".length;
  for (const g of grouped) {
    const rendered = renderArtefact(g);
    if (total + rendered.length + 1 > maxChars) break;
    parts.push(rendered);
    total += rendered.length + 1;
  }
  return `<lore-context>\n${parts.join("\n")}\n</lore-context>`;
}
