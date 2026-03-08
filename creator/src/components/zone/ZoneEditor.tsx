import { useMemo, useState, useCallback, useRef, useEffect } from "react";
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
  type Connection,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { zoneToGraph } from "@/lib/zoneToGraph";
import { compassLayout } from "@/lib/dagreLayout";
import { addRoom, addExit, generateRoomId } from "@/lib/zoneEdits";
import { saveZone } from "@/lib/saveZone";
import type { WorldFile } from "@/types/world";
import { RoomNode } from "./RoomNode";
import { CrossZoneNode } from "./CrossZoneNode";
import { RoomPanel, type EntitySelection } from "./RoomPanel";
import { EntityPanel } from "./EntityPanel";
import { DirectionPicker } from "./DirectionPicker";
import { BatchArtGenerator } from "./BatchArtGenerator";
import builderBg from "@/assets/builder-bg.jpg";
import subtoolbarBg from "@/assets/subtoolbar-bg.jpg";

const nodeTypes = {
  room: RoomNode,
  crossZone: CrossZoneNode,
};

interface PendingConnection {
  source: string;
  target: string;
  inferredDir: string;
}

interface ZoneEditorProps {
  zoneId: string;
}

function ZoneEditorInner({ zoneId }: ZoneEditorProps) {
  const zoneState = useZoneStore((s) => s.zones.get(zoneId));
  const updateZone = useZoneStore((s) => s.updateZone);
  const undo = useZoneStore((s) => s.undo);
  const redo = useZoneStore((s) => s.redo);
  const canUndo = useZoneStore((s) => s.canUndo(zoneId));
  const canRedo = useZoneStore((s) => s.canRedo(zoneId));
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntitySelection | null>(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomId, setNewRoomId] = useState("");
  const addRoomInputRef = useRef<HTMLInputElement>(null);
  const [pendingConnection, setPendingConnection] =
    useState<PendingConnection | null>(null);
  const [saving, setSaving] = useState(false);
  const [showBatchArt, setShowBatchArt] = useState(false);

  // Auto-close entity panel if the selected entity was removed (e.g. by undo)
  useEffect(() => {
    if (!selectedEntity || !zoneState) return;
    const { kind, id } = selectedEntity;
    const collection =
      kind === "mob" ? "mobs" :
      kind === "item" ? "items" :
      kind === "shop" ? "shops" :
      kind === "quest" ? "quests" :
      kind === "gatheringNode" ? "gatheringNodes" :
      kind === "recipe" ? "recipes" : null;
    if (collection && !zoneState.data[collection]?.[id]) {
      setSelectedEntity(null);
    }
  }, [zoneState, selectedEntity]);

  // Consume pending navigation from sidebar
  const consumeNavigation = useProjectStore((s) => s.consumeNavigation);
  useEffect(() => {
    const nav = consumeNavigation();
    if (!nav || nav.zoneId !== zoneId) return;
    if (nav.entityKind && nav.entityId) {
      setSelectedEntity({ kind: nav.entityKind as EntitySelection["kind"], id: nav.entityId });
      setSelectedRoomId(null);
    } else if (nav.roomId) {
      setSelectedRoomId(nav.roomId);
      setSelectedEntity(null);
    }
  }, [zoneId, consumeNavigation]);

  // Rebuild graph when WorldFile changes
  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (!zoneState) return { layoutNodes: [], layoutEdges: [] };
    const { nodes: rawNodes, edges } = zoneToGraph(zoneState.data);
    const nodes = compassLayout(rawNodes, zoneState.data);
    return { layoutNodes: nodes, layoutEdges: edges };
  }, [zoneState]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // Keep nodes/edges in sync with layout when WorldFile changes,
  // but preserve positions of existing nodes.
  const prevWorldRef = useRef<WorldFile | null>(null);
  if (zoneState && zoneState.data !== prevWorldRef.current) {
    prevWorldRef.current = zoneState.data;
    // Merge: keep existing node positions, add new nodes from layout
    const existingPositions = new Map(
      nodes.map((n) => [n.id, n.position]),
    );
    const merged = layoutNodes.map((n) => ({
      ...n,
      position: existingPositions.get(n.id) ?? n.position,
    }));
    setNodes(merged);
    setEdges(layoutEdges);
  }

  const applyWorldChange = useCallback(
    (next: WorldFile) => {
      updateZone(zoneId, next);
    },
    [zoneId, updateZone],
  );

  // ─── Connection (exit creation) ──────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!zoneState) return;
      const { source, target, sourceHandle } = connection;
      if (!source || !target) return;

      // Only allow room-to-room connections
      if (target.startsWith("xzone:")) return;

      // Extract direction from sourceHandle (e.g. "source-n" → "n")
      const inferredDir = sourceHandle?.replace("source-", "") ?? "n";

      // Show direction picker instead of immediately creating exit
      setPendingConnection({ source, target, inferredDir });
    },
    [zoneState],
  );

  const handleConfirmConnection = useCallback(
    (direction: string) => {
      if (!zoneState || !pendingConnection) return;
      try {
        const next = addExit(
          zoneState.data,
          pendingConnection.source,
          direction,
          pendingConnection.target,
        );
        applyWorldChange(next);
      } catch {
        // Exit already exists or invalid — ignore
      }
      setPendingConnection(null);
    },
    [zoneState, pendingConnection, applyWorldChange],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      const roomNode = selected.find((n) => n.type === "room");
      setSelectedRoomId(roomNode ? roomNode.id : null);
      if (roomNode) setSelectedEntity(null);
    },
    [],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === "room") {
      setSelectedRoomId(node.id);
      setSelectedEntity(null);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedRoomId(null);
    setSelectedEntity(null);
  }, []);

  // ─── Add room ────────────────────────────────────────────────────
  const handleStartAddRoom = useCallback(() => {
    if (!zoneState) return;
    setNewRoomId(generateRoomId(zoneState.data));
    setShowAddRoom(true);
    setTimeout(() => addRoomInputRef.current?.select(), 0);
  }, [zoneState]);

  const handleConfirmAddRoom = useCallback(() => {
    if (!zoneState || !newRoomId.trim()) return;
    try {
      const next = addRoom(zoneState.data, newRoomId.trim(), {
        title: "New Room",
        description: "",
      });
      applyWorldChange(next);
      setShowAddRoom(false);
      setSelectedRoomId(newRoomId.trim());
    } catch {
      // Room ID already exists
    }
  }, [zoneState, newRoomId, applyWorldChange]);

  // ─── Save ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!zoneState?.dirty || saving) return;
    setSaving(true);
    try {
      await saveZone(zoneId);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [zoneId, zoneState?.dirty, saving]);

  if (!zoneState) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Zone not found: {zoneId}
      </div>
    );
  }

  const roomCount = Object.keys(zoneState.data.rooms).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Zone toolbar */}
      <div className="relative flex shrink-0 items-center gap-3 overflow-hidden border-b border-border-default bg-bg-secondary px-3 py-1.5">
        <img src={subtoolbarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10]" />

        {/* Centered zone name */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2">
          <span className="font-display text-sm font-semibold tracking-widest text-text-primary uppercase">
            {zoneState.data.zone}
          </span>
          <span className="text-xs text-text-muted">
            {roomCount} room{roomCount !== 1 ? "s" : ""}
          </span>
          {zoneState.dirty && (
            <span className="text-xs text-accent">modified</span>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => undo(zoneId)}
            disabled={!canUndo}
            className="h-6 w-6 rounded text-xs text-text-muted transition-colors enabled:hover:bg-bg-elevated enabled:hover:text-text-primary disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            &#x21B6;
          </button>
          <button
            onClick={() => redo(zoneId)}
            disabled={!canRedo}
            className="h-6 w-6 rounded text-xs text-text-muted transition-colors enabled:hover:bg-bg-elevated enabled:hover:text-text-primary disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            &#x21B7;
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!zoneState.dirty || saving}
          className="h-6 rounded px-2 text-xs transition-colors enabled:bg-accent/20 enabled:text-accent enabled:hover:bg-accent/30 disabled:text-text-muted disabled:opacity-30"
          title="Save (Ctrl+S)"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowBatchArt(true)}
            className="h-6 rounded px-2 text-xs text-accent transition-colors hover:bg-accent/10"
            title="Generate art for all entities"
          >
            Batch Art
          </button>
          {showAddRoom ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmAddRoom();
              }}
              className="flex items-center gap-1"
            >
              <input
                ref={addRoomInputRef}
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                className="h-6 w-40 rounded border border-border-default bg-bg-primary px-1.5 text-xs text-text-primary outline-none focus:border-accent"
                placeholder="room_id"
                autoFocus
              />
              <button
                type="submit"
                className="h-6 rounded bg-accent/20 px-2 text-xs text-accent hover:bg-accent/30"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddRoom(false)}
                className="h-6 rounded px-1.5 text-xs text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={handleStartAddRoom}
              className="h-6 rounded bg-accent/20 px-2 text-xs text-accent hover:bg-accent/30"
              title="Add Room"
            >
              + Room
            </button>
          )}
        </div>
      </div>

      {/* Map + Panel */}
      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onSelectionChange={onSelectionChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            style={{ background: "#080c1c" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#1e2748"
            />
            <Controls
              showInteractive={false}
            />
            <MiniMap
              nodeColor={(node) =>
                node.type === "crossZone" ? "#c8972e" : "#2a3460"
              }
              maskColor="rgba(8, 12, 28, 0.8)"
            />
          </ReactFlow>

          {/* Atmospheric background overlay */}
          <img
            src={builderBg}
            alt=""
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover opacity-[0.18] mix-blend-screen"
          />

          {/* Batch art generator */}
          {showBatchArt && zoneState && (
            <BatchArtGenerator
              zoneId={zoneId}
              world={zoneState.data}
              onWorldChange={applyWorldChange}
              onClose={() => setShowBatchArt(false)}
            />
          )}

          {/* Direction picker overlay */}
          {pendingConnection && (
            <DirectionPicker
              source={pendingConnection.source}
              target={pendingConnection.target}
              initialDirection={pendingConnection.inferredDir}
              onConfirm={handleConfirmConnection}
              onCancel={() => setPendingConnection(null)}
            />
          )}
        </div>

        {selectedEntity ? (
          <EntityPanel
            selection={selectedEntity}
            world={zoneState.data}
            onWorldChange={applyWorldChange}
            onClose={() => setSelectedEntity(null)}
            zoneId={zoneId}
          />
        ) : selectedRoomId ? (
          <RoomPanel
            zoneId={zoneId}
            roomId={selectedRoomId}
            world={zoneState.data}
            onWorldChange={applyWorldChange}
            onRoomDeleted={() => setSelectedRoomId(null)}
            onSelectEntity={setSelectedEntity}
          />
        ) : null}
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
