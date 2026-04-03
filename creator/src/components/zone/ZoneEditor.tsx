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
import { zoneToGraph, GRAPH } from "@/lib/zoneToGraph";
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
import { ZoneAssetWorkbench } from "./ZoneAssetWorkbench";
import { Starfield } from "./Starfield";
import { SpringPanel } from "./SpringPanel";
import { ZoneMediaPanel } from "./ZoneMediaPanel";
import { DungeonEditor, DungeonEmptyState } from "@/components/editors/DungeonEditor";
import { setDungeon, removeDungeon } from "@/lib/zoneEdits";
import builderBg from "@/assets/builder-bg.jpg";
import subtoolbarBg from "@/assets/subtoolbar-bg.jpg";

type ViewMode = "map" | "assets" | "media" | "dungeon";

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
  const [justSaved, setJustSaved] = useState(false);
  const [showBatchArt, setShowBatchArt] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [hintDismissed, setHintDismissed] = useState(
    () => localStorage.getItem("arcanum:zone-hint-dismissed") === "1",
  );

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
  const pendingNavigation = useProjectStore((s) => s.pendingNavigation);
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
  }, [zoneId, consumeNavigation, pendingNavigation]);

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
  useEffect(() => {
    if (!zoneState || zoneState.data === prevWorldRef.current) return;
    prevWorldRef.current = zoneState.data;
    setNodes((currentNodes) => {
      const existingPositions = new Map(
        currentNodes.map((node) => [node.id, node.position]),
      );
      return layoutNodes.map((node) => ({
        ...node,
        position: existingPositions.get(node.id) ?? node.position,
      }));
    });
    setEdges(layoutEdges);
  }, [layoutEdges, layoutNodes, setEdges, setNodes, zoneState]);

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
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [zoneId, zoneState?.dirty, saving]);
  const viewTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (!zoneState) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Zone not found: {zoneId}
      </div>
    );
  }

  const roomCount = Object.keys(zoneState.data.rooms).length;
  const viewModes: ViewMode[] = ["map", "assets", "media", "dungeon"];

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
            <span className="rounded-full bg-[rgba(200,164,106,0.15)] px-2 py-0.5 text-[10px] text-warm-pale">modified</span>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-r border-white/8 pr-3">
          <button
            onClick={() => undo(zoneId)}
            disabled={!canUndo}
            className="h-6 w-6 rounded text-xs text-accent transition-colors enabled:hover:bg-accent/10 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            &#x21B6;
          </button>
          <button
            onClick={() => redo(zoneId)}
            disabled={!canRedo}
            className="h-6 w-6 rounded text-xs text-accent transition-colors enabled:hover:bg-accent/10 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            &#x21B7;
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!zoneState.dirty || saving}
          className={`focus-ring h-7 rounded-full px-3 text-xs font-medium transition-all duration-500 ${
            saving
              ? "border border-[rgba(200,164,106,0.4)] bg-[linear-gradient(145deg,rgba(200,164,106,0.22),rgba(43,52,76,0.9))] text-warm-pale shadow-[0_4px_16px_rgba(200,164,106,0.18)]"
              : justSaved
                ? "border border-status-success/30 text-status-success"
                : zoneState.dirty
                  ? "border border-[rgba(200,164,106,0.4)] bg-[linear-gradient(145deg,rgba(200,164,106,0.22),rgba(43,52,76,0.9))] text-warm-pale shadow-[0_4px_16px_rgba(200,164,106,0.18)]"
                  : "text-text-muted opacity-40"
          }`}
          title="Save (Ctrl+S)"
        >
          {saving ? "Saving..." : justSaved ? "\u2713 Saved" : "Save"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="segmented-control" role="tablist" aria-label="Zone views">
            {viewModes.map((mode, i, arr) => (
              <button
                key={mode}
                ref={(node) => {
                  viewTabRefs.current[i] = node;
                }}
                id={`zone-view-tab-${mode}`}
                role="tab"
                aria-selected={viewMode === mode}
                aria-controls="zone-view-panel"
                tabIndex={viewMode === mode ? 0 : -1}
                onClick={() => setViewMode(mode)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    const nextIndex = (i + 1) % viewModes.length;
                    setViewMode(viewModes[nextIndex]!);
                    viewTabRefs.current[nextIndex]?.focus();
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    const nextIndex = (i - 1 + viewModes.length) % viewModes.length;
                    setViewMode(viewModes[nextIndex]!);
                    viewTabRefs.current[nextIndex]?.focus();
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    setViewMode(viewModes[0]!);
                    viewTabRefs.current[0]?.focus();
                  } else if (event.key === "End") {
                    event.preventDefault();
                    setViewMode(viewModes[viewModes.length - 1]!);
                    viewTabRefs.current[viewModes.length - 1]?.focus();
                  }
                }}
                className={`segmented-button focus-ring h-6 px-2 text-2xs font-medium tracking-wide ${
                  i === 0 ? "rounded-l-full" : i === arr.length - 1 ? "rounded-r-full" : ""
                }`}
                data-active={viewMode === mode}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-l border-white/8 pl-3">
            <button
              onClick={() => setShowBatchArt(true)}
              className="h-6 rounded px-2 text-xs text-stellar-blue transition-colors hover:bg-stellar-blue/10"
              title="Generate art for all entities"
              aria-label="Generate art for all entities"
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
                  className="ornate-input h-6 w-40 rounded px-1.5 text-xs text-text-primary"
                  placeholder="room_id"
                  aria-label="New room ID"
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
                className="h-6 rounded-full border border-[rgba(200,164,106,0.35)] bg-[rgba(200,164,106,0.15)] px-3 text-xs text-warm-pale hover:bg-[rgba(200,164,106,0.25)]"
                title="Add Room"
              >
                + Room
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Map + Panel, Asset Browser, Media Panel, or Dungeon Editor */}
      {viewMode === "dungeon" ? (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-2xl">
            {zoneState.data.dungeon ? (
              <DungeonEditor
                world={zoneState.data}
                onWorldChange={applyWorldChange}
                onDelete={() => {
                  applyWorldChange(removeDungeon(zoneState.data));
                  setViewMode("map");
                }}
              />
            ) : (
              <DungeonEmptyState
                onAdd={() => {
                  applyWorldChange(setDungeon(zoneState.data, {
                    name: zoneState.data.zone + " Dungeon",
                    roomCountMin: 20,
                    roomCountMax: 25,
                  }));
                }}
              />
            )}
          </div>
        </div>
      ) : viewMode === "media" ? (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="min-h-0 flex-1">
          <ZoneMediaPanel zoneId={zoneId} world={zoneState.data} onWorldChange={applyWorldChange} />
        </div>
      ) : viewMode === "assets" ? (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ZoneAssetWorkbench zoneId={zoneId} world={zoneState.data} onWorldChange={applyWorldChange} />
        </div>
      ) : (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="flex min-h-0 flex-1">
          <div className="relative min-h-0 flex-1">
            <Starfield />
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
              style={{ background: "rgba(8,12,28,0.85)" }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color={GRAPH().grid}
              />
              <Controls
                showInteractive={false}
              />
              <MiniMap
                nodeColor={(node) =>
                  node.type === "crossZone" ? GRAPH().cross : GRAPH().node
                }
                maskColor="var(--graph-minimap-mask)"
              />
            </ReactFlow>

            {/* Atmospheric background overlay */}
            <img
              src={builderBg}
              alt=""
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover opacity-[0.18] mix-blend-screen"
            />

            {/* First-zone onboarding hint */}
            {roomCount <= 1 && !hintDismissed && viewMode === "map" && (
              <div className="pointer-events-auto absolute inset-x-0 bottom-4 z-[2] flex justify-center">
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-panel bg-[radial-gradient(circle_at_center,rgba(200,164,106,0.08),transparent_60%)] px-5 py-3 shadow-bar backdrop-blur-xl">
                  <div>
                    <p className="text-sm text-text-primary">
                      Click the <span className="font-mono text-accent">+</span> handles on a room's edges to create exits to new rooms.
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Select a room to edit its details in the right panel. Use <kbd className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-2xs">+ Room</kbd> above to add disconnected rooms.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setHintDismissed(true);
                      localStorage.setItem("arcanum:zone-hint-dismissed", "1");
                    }}
                    className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-muted transition hover:bg-white/8 hover:text-text-primary"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}

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
            <SpringPanel contentKey={`entity:${selectedEntity.kind}:${selectedEntity.id}`}>
              <EntityPanel
                selection={selectedEntity}
                world={zoneState.data}
                onWorldChange={applyWorldChange}
                onClose={() => setSelectedEntity(null)}
                zoneId={zoneId}
              />
            </SpringPanel>
          ) : selectedRoomId ? (
            <SpringPanel contentKey={`room:${selectedRoomId}`}>
              <RoomPanel
                zoneId={zoneId}
                roomId={selectedRoomId}
                world={zoneState.data}
                onWorldChange={applyWorldChange}
                onRoomDeleted={() => setSelectedRoomId(null)}
                onSelectEntity={setSelectedEntity}
              />
            </SpringPanel>
          ) : null}
        </div>
      )}
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
