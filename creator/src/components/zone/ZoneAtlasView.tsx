import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { RoomNode } from "./RoomNode";
import { ExitEdge } from "./ExitEdge";
import { Starfield } from "./Starfield";
import { zoneToGraph } from "@/lib/zoneToGraph";
import { compassLayout, getLayoutBounds } from "@/lib/dagreLayout";

const CLUSTER_GAP = 180;
const HEADER_OFFSET = 72;

function ZoneHeaderNode({
  data,
}: {
  data: { zone: string; roomCount: number };
}) {
  return (
    <div className="pointer-events-none select-none rounded-xl border border-accent/35 bg-bg-abyss/85 px-4 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.55)] backdrop-blur">
      <div className="font-display text-base uppercase tracking-[0.28em] text-accent">
        {data.zone}
      </div>
      <div className="mt-0.5 text-2xs uppercase tracking-wider text-text-muted">
        {data.roomCount} {data.roomCount === 1 ? "room" : "rooms"}
      </div>
    </div>
  );
}

const nodeTypes = {
  room: RoomNode,
  zoneHeader: ZoneHeaderNode,
};

const edgeTypes = {
  exitEdge: ExitEdge,
};

interface AtlasRoomExtra {
  __zoneId: string;
  __roomId: string;
}

function ZoneAtlas() {
  const zones = useZoneStore((s) => s.zones);
  const navigateTo = useProjectStore((s) => s.navigateTo);

  const { nodes, edges, isEmpty } = useMemo(() => {
    const clusters = Array.from(zones.entries()).map(([zoneId, state]) => {
      const world = state.data;
      const { nodes: rawNodes, edges: rawEdges } = zoneToGraph(world);
      // Drop cross-zone ghost nodes for v1 — disconnected clusters only.
      const realNodes = rawNodes.filter((n) => !n.id.startsWith("xzone:"));
      const realEdges = rawEdges.filter(
        (e) =>
          !String(e.source).startsWith("xzone:") &&
          !String(e.target).startsWith("xzone:"),
      );
      const laid = compassLayout(realNodes, world);
      const bounds = getLayoutBounds(laid) ?? { x: 0, y: 0, width: 320, height: 240 };
      return {
        zoneId,
        zoneName: world.zone || zoneId,
        nodes: laid,
        edges: realEdges,
        bounds,
      };
    });

    if (clusters.length === 0) {
      return { nodes: [], edges: [], isEmpty: true };
    }

    // Uniform grid pack — cells sized to the largest cluster so the layout is
    // predictable regardless of which zone happens to be biggest.
    const cols = Math.max(1, Math.ceil(Math.sqrt(clusters.length)));
    const cellW = Math.max(...clusters.map((c) => c.bounds.width)) + CLUSTER_GAP;
    const cellH =
      Math.max(...clusters.map((c) => c.bounds.height)) + CLUSTER_GAP + HEADER_OFFSET;

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];

    clusters.forEach((cluster, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const originX = col * cellW;
      const originY = row * cellH;
      // Translate the cluster so its bounding-box top-left lands at (originX, originY + HEADER_OFFSET).
      const dx = originX - cluster.bounds.x;
      const dy = originY - cluster.bounds.y + HEADER_OFFSET;

      allNodes.push({
        id: `header:${cluster.zoneId}`,
        type: "zoneHeader",
        position: { x: originX, y: originY },
        data: { zone: cluster.zoneName, roomCount: cluster.nodes.length },
        draggable: false,
        selectable: false,
        focusable: false,
      });

      for (const node of cluster.nodes) {
        // Strip anything that triggers a Tauri IPC image read. RoomNode loads
        // the room background and each entity sprite via `useImageSrc`, which
        // invokes `read_image_data_url` per call. Multiply by every room in
        // every loaded zone and you get hundreds of concurrent base64 reads
        // when the atlas first opens — enough to freeze the app.
        // Overview entity counts + role badges are still displayed from data.
        const baseData = node.data as Record<string, unknown>;
        allNodes.push({
          ...node,
          id: `${cluster.zoneId}::${node.id}`,
          position: {
            x: (node.position?.x ?? 0) + dx,
            y: (node.position?.y ?? 0) + dy,
          },
          data: {
            ...baseData,
            image: undefined,
            entities: [],
            __zoneId: cluster.zoneId,
            __roomId: node.id,
          } satisfies Record<string, unknown> & AtlasRoomExtra,
          draggable: false,
        });
      }

      for (const edge of cluster.edges) {
        allEdges.push({
          ...edge,
          id: `${cluster.zoneId}::${edge.id}`,
          source: `${cluster.zoneId}::${edge.source}`,
          target: `${cluster.zoneId}::${edge.target}`,
          selectable: false,
        });
      }
    });

    return { nodes: allNodes, edges: allEdges, isEmpty: false };
  }, [zones]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const d = node.data as Partial<AtlasRoomExtra> | undefined;
      if (d?.__zoneId && d.__roomId) {
        navigateTo({ zoneId: d.__zoneId, roomId: d.__roomId });
      }
    },
    [navigateTo],
  );

  if (isEmpty) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-text-muted">
        <div className="max-w-sm text-center">
          <h2 className="font-display text-lg uppercase tracking-widest text-accent">
            No Zones Loaded
          </h2>
          <p className="mt-2 text-xs text-text-secondary">
            Create or import a zone to see it on the atlas. Each loaded zone appears as its
            own cluster.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <Starfield />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        minZoom={0.04}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: "var(--color-surface-scrim)" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--color-graph-grid)"
        />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-bg-abyss/80" />
      </ReactFlow>
    </div>
  );
}

export function ZoneAtlasView() {
  return (
    <ReactFlowProvider>
      <ZoneAtlas />
    </ReactFlowProvider>
  );
}
