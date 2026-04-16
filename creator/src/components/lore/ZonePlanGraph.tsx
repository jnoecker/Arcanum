import { memo, useMemo } from "react";
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

const NODE_WIDTH = 280;
const NODE_HEIGHT = 110;

interface ZoneNodeData {
  label: string;
  blurb: string;
  selected: boolean;
  hovered: boolean;
  [key: string]: unknown;
}

const ZonePlanNode = memo(function ZonePlanNode({ data }: NodeProps) {
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
        className="flex flex-col gap-1.5 rounded-xl border px-4 py-3 shadow-md"
        style={{
          borderColor: active
            ? `color-mix(in srgb, ${accent} 80%, transparent)`
            : `color-mix(in srgb, ${accent} 40%, transparent)`,
          background: active
            ? `linear-gradient(135deg, color-mix(in srgb, ${accent} 28%, transparent), color-mix(in srgb, ${accent} 14%, transparent))`
            : `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, transparent), color-mix(in srgb, ${accent} 8%, transparent))`,
          minWidth: NODE_WIDTH,
          maxWidth: NODE_WIDTH,
          minHeight: NODE_HEIGHT,
          backdropFilter: "blur(8px)",
          boxShadow: active
            ? "0 0 0 2px rgb(var(--aurum-rgb) / 0.35), 0 12px 30px rgb(var(--shadow-rgb) / 0.32)"
            : undefined,
        }}
      >
        <span className="truncate font-display text-base font-medium text-text-primary">
          {d.label}
        </span>
        {d.blurb && (
          <span className="line-clamp-2 text-xs leading-snug text-text-secondary">
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
});

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
  g.setGraph({ rankdir: "LR", nodesep: 70, ranksep: 130 });
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm text-text-primary">
          Zone adjacency
        </h3>
        <div className="flex items-center gap-2 text-2xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-px w-5"
              style={{ background: "var(--color-template-location)", opacity: 0.7 }}
            />
            Lines = zones that share a border
          </span>
          <span className="text-text-muted/60">·</span>
          <span>Click a node to edit it on the map above.</span>
        </div>
      </div>
      <div
        className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-strong)]"
        style={{ height: "min(70vh, 620px)" }}
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.3}
            maxZoom={2.5}
            onNodeClick={(_, n) => onSelect(n.id)}
            onNodeMouseEnter={(_, n) => onHover(n.id)}
            onNodeMouseLeave={() => onHover(null)}
            onPaneClick={() => onSelect(null)}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--graph-dot-color)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
