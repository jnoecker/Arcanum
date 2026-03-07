import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type OnSelectionChangeParams,
  type NodeMouseHandler,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useZoneStore } from "@/stores/zoneStore";
import { zoneToGraph } from "@/lib/zoneToGraph";
import { applyDagreLayout } from "@/lib/dagreLayout";
import { RoomNode } from "./RoomNode";
import { CrossZoneNode } from "./CrossZoneNode";
import { RoomPanel } from "./RoomPanel";

const nodeTypes = {
  room: RoomNode,
  crossZone: CrossZoneNode,
};

interface ZoneEditorProps {
  zoneId: string;
}

function ZoneEditorInner({ zoneId }: ZoneEditorProps) {
  const zoneState = useZoneStore((s) => s.zones.get(zoneId));
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!zoneState) return { initialNodes: [], initialEdges: [] };
    const { nodes: rawNodes, edges } = zoneToGraph(zoneState.data);
    const nodes = applyDagreLayout(rawNodes, edges);
    return { initialNodes: nodes, initialEdges: edges };
  }, [zoneState]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      const roomNode = selected.find((n) => n.type === "room");
      setSelectedRoomId(roomNode ? roomNode.id : null);
    },
    [],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === "room") {
      setSelectedRoomId(node.id);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedRoomId(null);
  }, []);

  if (!zoneState) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Zone not found: {zoneId}
      </div>
    );
  }

  const roomCount = Object.keys(zoneState.data.rooms).length;

  return (
    <div className="flex flex-1 flex-col">
      {/* Zone toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border-default bg-bg-secondary px-3 py-1.5">
        <span className="text-xs font-medium text-text-primary">
          {zoneState.data.zone}
        </span>
        <span className="text-xs text-text-muted">
          {roomCount} room{roomCount !== 1 ? "s" : ""}
        </span>
        {zoneState.dirty && (
          <span className="text-xs text-accent">modified</span>
        )}
      </div>

      {/* Map + Panel */}
      <div className="flex min-h-0 flex-1">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onSelectionChange={onSelectionChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            style={{ background: "#0d1117" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#21262d"
            />
            <Controls
              showInteractive={false}
              style={{ background: "#161b22", border: "1px solid #30363d" }}
            />
            <MiniMap
              nodeColor={(node) =>
                node.type === "crossZone" ? "#a371f7" : "#30363d"
              }
              maskColor="rgba(13, 17, 23, 0.8)"
              style={{ background: "#161b22", border: "1px solid #30363d" }}
            />
          </ReactFlow>
        </div>

        {selectedRoomId && (
          <RoomPanel
            zoneId={zoneId}
            roomId={selectedRoomId}
            world={zoneState.data}
          />
        )}
      </div>
    </div>
  );
}

export function ZoneEditor({ zoneId }: ZoneEditorProps) {
  return (
    <ReactFlowProvider>
      <ZoneEditorInner zoneId={zoneId} />
    </ReactFlowProvider>
  );
}
