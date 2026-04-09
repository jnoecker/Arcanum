import type { Article, ArticleRelation, ArticleTemplate } from "@/types/lore";
import type { Node, Edge } from "@xyflow/react";
import dagre from "@dagrejs/dagre";

/**
 * Extract @mention relations from Tiptap JSON content.
 * Scans for nodes of type "mention" with attrs.id and produces
 * ArticleRelation entries with type "mentioned".
 */
export function extractMentions(content: string): ArticleRelation[] {
  if (!content) return [];

  // If content is plain text (not JSON), no mentions to extract
  if (!content.startsWith("{")) return [];

  try {
    const doc = JSON.parse(content);
    const mentions: ArticleRelation[] = [];
    const seen = new Set<string>();

    function walk(node: unknown) {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;

      if (n.type === "mention" && n.attrs) {
        const attrs = n.attrs as Record<string, unknown>;
        const id = typeof attrs.id === "string" ? attrs.id : null;
        if (id && !seen.has(id)) {
          seen.add(id);
          mentions.push({ targetId: id, type: "mentioned" });
        }
      }

      if (Array.isArray(n.content)) {
        for (const child of n.content) walk(child);
      }
    }

    walk(doc);
    return mentions;
  } catch {
    return [];
  }
}

/**
 * Convert Tiptap JSON content to plain text (for LLM prompts).
 * Strips formatting, renders mentions as their labels.
 */
export function tiptapToPlainText(content: string): string {
  if (!content) return "";
  if (!content.startsWith("{")) return content;

  try {
    const doc = JSON.parse(content);
    const parts: string[] = [];

    function walk(node: unknown) {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;

      if (n.type === "text" && typeof n.text === "string") {
        parts.push(n.text);
        return;
      }

      if (n.type === "mention" && n.attrs) {
        const label = (n.attrs as Record<string, unknown>).label;
        parts.push(typeof label === "string" ? label : "");
        return;
      }

      if (n.type === "paragraph" || n.type === "heading") {
        if (parts.length > 0 && !parts[parts.length - 1]!.endsWith("\n")) {
          parts.push("\n");
        }
      }

      if (n.type === "bulletList" || n.type === "orderedList") {
        if (parts.length > 0 && !parts[parts.length - 1]!.endsWith("\n")) {
          parts.push("\n");
        }
      }

      if (n.type === "listItem") {
        parts.push("- ");
      }

      if (Array.isArray(n.content)) {
        for (const child of n.content) walk(child);
      }

      if (n.type === "paragraph" || n.type === "heading" || n.type === "listItem") {
        parts.push("\n");
      }
    }

    walk(doc);
    return parts.join("").trim();
  } catch {
    return content;
  }
}

/**
 * Wrap plain text in a minimal Tiptap document JSON structure.
 */
export function plainTextToTiptap(text: string): string {
  if (!text) return "";
  // If already JSON, return as-is
  if (text.startsWith("{")) return text;

  const paragraphs = text.split(/\n\n+/);
  const content = paragraphs.map((p) => ({
    type: "paragraph",
    content: p.trim() ? [{ type: "text", text: p.trim() }] : undefined,
  }));

  return JSON.stringify({ type: "doc", content });
}

// ─── Relationship graph builder ─────────────────────────────────────

export interface RelationGraphFilters {
  templates?: ArticleTemplate[];
  relationTypes?: string[];
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;

/**
 * Build React Flow nodes and edges from article relations + mentions.
 */
export function buildRelationGraph(
  articles: Record<string, Article>,
  filters?: RelationGraphFilters,
): { nodes: Node[]; edges: Edge[] } {
  const templateFilter = filters?.templates ? new Set(filters.templates) : null;
  const typeFilter = filters?.relationTypes ? new Set(filters.relationTypes) : null;

  // Collect all articles that pass the template filter
  const included = new Set<string>();
  for (const [id, a] of Object.entries(articles)) {
    if (!templateFilter || templateFilter.has(a.template)) {
      included.add(id);
    }
  }

  // Build edges from explicit relations + mention extraction
  const edges: Edge[] = [];
  const edgeSeen = new Set<string>();

  for (const [id, a] of Object.entries(articles)) {
    if (!included.has(id)) continue;

    // Explicit relations
    for (const rel of a.relations ?? []) {
      if (!included.has(rel.targetId)) continue;
      if (typeFilter && !typeFilter.has(rel.type)) continue;
      const edgeKey = `${id}->${rel.targetId}:${rel.type}`;
      if (edgeSeen.has(edgeKey)) continue;
      edgeSeen.add(edgeKey);
      edges.push({
        id: edgeKey,
        source: id,
        target: rel.targetId,
        label: rel.type,
        type: "smoothstep",
        style: { stroke: RELATION_COLORS[rel.type] ?? "#2e7680", strokeWidth: 1.5 },
        labelStyle: { fill: "#ad9d88", fontSize: 10 },
      });
    }

    // Mention-based relations
    const mentions = extractMentions(a.content);
    for (const m of mentions) {
      if (!included.has(m.targetId)) continue;
      if (typeFilter && !typeFilter.has("mentioned")) continue;
      const edgeKey = `${id}->${m.targetId}:mentioned`;
      if (edgeSeen.has(edgeKey)) continue;
      edgeSeen.add(edgeKey);
      edges.push({
        id: edgeKey,
        source: id,
        target: m.targetId,
        label: "mentions",
        type: "smoothstep",
        style: { stroke: "#2e7680", strokeDasharray: "4 2", strokeWidth: 1.5 },
        labelStyle: { fill: "#ad9d88", fontSize: 10 },
      });
    }
  }

  // Only include nodes that have at least one connection
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }

  // Build nodes
  const rawNodes: Node[] = [];
  for (const id of connected) {
    const a = articles[id];
    if (!a) continue;
    rawNodes.push({
      id,
      type: "relationNode",
      data: { label: a.title, template: a.template },
      position: { x: 0, y: 0 },
    });
  }

  // Apply dagre layout
  const layoutNodes = applyDagreLayout(rawNodes, edges);
  return { nodes: layoutNodes, edges };
}

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: (pos.x ?? 0) - NODE_WIDTH / 2,
        y: (pos.y ?? 0) - NODE_HEIGHT / 2,
      },
    };
  });
}

const RELATION_COLORS: Record<string, string> = {
  ally: "#a3c48e",
  rival: "#d9756b",
  member_of: "#2f93a1",
  located_in: "#2f93a1",
  related: "#ff7d00",
  mentioned: "#2e7680",
};
