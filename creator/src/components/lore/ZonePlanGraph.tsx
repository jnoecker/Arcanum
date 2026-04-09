import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import type { ZonePlan } from "@/types/lore";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;

interface ZoneNodeData {
  label: string;
  blurb: string;
  selected: boolean;
  hovered: boolean;
  [key: string]: unknown;
}

function ZonePlanNode({ data }: NodeProps) {
  const d = data as ZoneNodeData;
  const accent = "var(--color-template-location)";
  const active = d.selected || d.hovered;
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: accent, border: "none", width: 8, height: 8 }}
      />
      <div
        className="flex flex-col gap-1 rounded-xl border px-3 py-2 shadow-md"
        style={{
          borderColor: active
            ? `color-mix(in srgb, ${accent} 70%, transparent)`
            : `color-mix(in srgb, ${accent} 31%, transparent)`,
          background: active
            ? `linear-gradient(135deg, color-mix(in srgb, ${accent} 24%, transparent), color-mix(in srgb, ${accent} 10%, transparent))`
            : `linear-gradient(135deg, color-mix(in srgb, ${accent} 14%, transparent), color-mix(in srgb, ${accent} 6%, transparent))`,
          minWidth: NODE_WIDTH,
          maxWidth: NODE_WIDTH,
          backdropFilter: "blur(8px)",
          boxShadow: active
            ? "0 0 0 1px rgba(255, 215, 140, 0.2), 0 12px 30px rgba(0, 0, 0, 0.28)"
            : undefined,
        }}
      >
        <span className="truncate text-sm font-medium text-text-primary">
          {d.label}
        </span>
        {d.blurb && (
          <span className="line-clamp-2 text-2xs leading-snug text-text-muted">
            {d.blurb}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: accent, border: "none", width: 8, height: 8 }}
      />
    </>
  );
}

const nodeTypes: NodeTypes = {
  zonePlanNode: ZonePlanNode,
};

function buildGraph(
  plans: ZonePlan[],
  selectedId: string | null,
  hoveredId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  if (plans.length === 0) return { nodes: [], edges: [] };

  const rawNodes: Node[] = plans.map((p) => ({
    id: p.id,
    type: "zonePlanNode",
    data: {
      label: p.name,
      blurb: p.blurb,
      selected: p.id === selectedId,
      hovered: p.id === hoveredId,
    },
    position: { x: 0, y: 0 },
  }));

  // Edges deduped — borders are conceptually undirected, so we only emit
  // one edge per unordered pair.
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const p of plans) {
    for (const b of p.borders ?? []) {
      const key = [p.id, b].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        id: `e_${key}`,
        source: p.id,
        target: b,
        style: { stroke: "var(--color-template-location)", strokeWidth: 1.5, opacity: 0.65 },
      });
    }
  }

  // Dagre layout
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 90 });
  for (const node of rawNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  const nodes = rawNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes, edges };
}

export function ZonePlanGraph({
  plans,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  plans: ZonePlan[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const { nodes, edges } = useMemo(
    () => buildGraph(plans, selectedId, hoveredId),
    [plans, selectedId, hoveredId],
  );

  if (plans.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border-muted text-sm text-text-muted">
        No zones yet. Generate some from a map above.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-strong)]"
      style={{ height: "min(60vh, 500px)" }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, n) => onSelect(n.id)}
          onNodeMouseEnter={(_, n) => onHover(n.id)}
          onNodeMouseLeave={() => onHover(null)}
          onPaneClick={() => onSelect(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgba(255,255,255,0.05)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
