import type { Node, Edge } from "@xyflow/react";
import type { ShowcaseArticle, ArticleTemplate } from "@/types/showcase";
import dagre from "@dagrejs/dagre";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;

const RELATION_COLORS: Record<string, string> = {
  ally: "#a3c48e",
  rival: "#dbb8b8",
  member_of: "#8caec9",
  located_in: "#8caec9",
  related: "#a897d2",
  mentioned: "#56617d",
};

export const TEMPLATE_NODE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "#a897d2",
  character: "#a897d2",
  location: "#8caec9",
  organization: "#bea873",
  item: "#a3c48e",
  species: "#c4956a",
  event: "#bea873",
  language: "#95a0bf",
  profession: "#d4c8a0",
  ability: "#b88faa",
  freeform: "#95a0bf",
};

export const TEMPLATE_SHORT: Record<ArticleTemplate, string> = {
  world_setting: "W",
  character: "C",
  location: "L",
  organization: "O",
  item: "I",
  species: "S",
  event: "E",
  language: "La",
  profession: "P",
  ability: "Ab",
  freeform: "F",
};

export interface GraphFilters {
  templates?: Set<ArticleTemplate>;
  relationTypes?: Set<string>;
}

export function buildShowcaseGraph(
  articles: ShowcaseArticle[],
  articleById: Map<string, ShowcaseArticle>,
  filters?: GraphFilters,
): { nodes: Node[]; edges: Edge[] } {
  const templateFilter = filters?.templates?.size ? filters.templates : null;
  const typeFilter = filters?.relationTypes?.size ? filters.relationTypes : null;

  // Articles that pass template filter
  const included = new Set<string>();
  for (const a of articles) {
    if (!templateFilter || templateFilter.has(a.template)) {
      included.add(a.id);
    }
  }

  // Build edges from pre-computed relations
  const edges: Edge[] = [];
  const edgeSeen = new Set<string>();

  for (const a of articles) {
    if (!included.has(a.id)) continue;
    for (const rel of a.relations) {
      if (!included.has(rel.targetId)) continue;
      if (!articleById.has(rel.targetId)) continue;
      if (typeFilter && !typeFilter.has(rel.type)) continue;
      const edgeKey = `${a.id}->${rel.targetId}:${rel.type}`;
      if (edgeSeen.has(edgeKey)) continue;
      edgeSeen.add(edgeKey);

      const isMention = rel.type === "mentioned";
      edges.push({
        id: edgeKey,
        source: a.id,
        target: rel.targetId,
        label: rel.label ?? rel.type,
        type: "smoothstep",
        style: {
          stroke: RELATION_COLORS[rel.type] ?? "#56617d",
          ...(isMention ? { strokeDasharray: "4 2" } : {}),
        },
        labelStyle: {
          fill: isMention ? "#56617d" : "#95a0bf",
          fontSize: 9,
        },
      });
    }
  }

  // Only include connected nodes
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }

  const rawNodes: Node[] = [];
  for (const id of connected) {
    const a = articleById.get(id);
    if (!a) continue;
    rawNodes.push({
      id,
      type: "showcaseNode",
      data: { label: a.title, template: a.template, articleId: a.id },
      position: { x: 0, y: 0 },
    });
  }

  // Dagre layout
  if (rawNodes.length > 0) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

    for (const node of rawNodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    for (const node of rawNodes) {
      const pos = g.node(node.id);
      node.position = {
        x: (pos.x ?? 0) - NODE_WIDTH / 2,
        y: (pos.y ?? 0) - NODE_HEIGHT / 2,
      };
    }
  }

  return { nodes: rawNodes, edges };
}
