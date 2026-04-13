import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnSelectionChangeParams,
  type NodeMouseHandler,
  type Connection,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useToastStore } from "@/stores/toastStore";
import { zoneToGraph, GRAPH } from "@/lib/zoneToGraph";
import { compassLayout, getLayoutBounds, type LayoutMeasurement } from "@/lib/dagreLayout";
import { addRoom, addExit, deleteExit, generateRoomId } from "@/lib/zoneEdits";
import { saveZone } from "@/lib/saveZone";
import type { WorldFile } from "@/types/world";
import { RoomNode } from "./RoomNode";
import { CrossZoneNode } from "./CrossZoneNode";
import { ExitEdge, ExitDeleteContext } from "./ExitEdge";
import { RoomPanel, type EntitySelection } from "./RoomPanel";
import { EntityPanel } from "./EntityPanel";
import { DirectionPicker } from "./DirectionPicker";
import { BatchArtGenerator } from "./BatchArtGenerator";
import { BulkBgRemoval, type BulkBgTarget } from "@/components/ui/BulkBgRemoval";
import { ZoneAssetWorkbench } from "./ZoneAssetWorkbench";
import { Starfield } from "./Starfield";
import { SpringPanel } from "./SpringPanel";
import { ZoneMediaPanel } from "./ZoneMediaPanel";
import { ZoneMapPanel } from "./ZoneMapPanel";
import { DungeonEditor, DungeonEmptyState } from "@/components/editors/DungeonEditor";
import { setDungeon, removeDungeon } from "@/lib/zoneEdits";
import { normalizeAssetRef } from "@/lib/assetRefs";
import builderBg from "@/assets/builder-bg.jpg";
import subtoolbarBg from "@/assets/subtoolbar-bg.jpg";
import { TERRAIN_ICONS } from "@/assets/ui";

type ViewMode = "map" | "assets" | "media" | "dungeon" | "zonemap";

const nodeTypes = {
  room: RoomNode,
  crossZone: CrossZoneNode,
};

const edgeTypes = {
  exitEdge: ExitEdge,
};

interface PendingConnection {
  source: string;
  target: string;
  inferredDir: string;
}

interface ZoneEditorProps {
  zoneId: string;
}

function collectBgRemovalTargets(world: WorldFile, zoneId: string, assetsDir: string): BulkBgTarget[] {
  const targets: BulkBgTarget[] = [];

  // Always run the entity image through `normalizeAssetRef` before building
  // the absolute filesystem path. Without this, freshly generated images
  // whose refs weren't saved yet (still carrying a legacy path prefix or a
  // `/images/...` engine ref) produce broken resolvedPaths like
  // `...\images\/images/foo.png`, which silently fails `read_image_data_url`.
  const resolveImagePath = (imageRef: string): string | null => {
    const normalized = normalizeAssetRef(imageRef);
    if (!normalized) return null;
    // Engine-relative refs (/images/subdir/foo.png) are never on local disk
    // in the same place — skip them instead of producing a bad path.
    if (normalized.startsWith("/")) return null;
    return `${assetsDir}\\images\\${normalized}`;
  };

  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    if (!mob.image) continue;
    const resolvedPath = resolveImagePath(mob.image);
    if (!resolvedPath) continue;
    targets.push({
      id: `mob:${id}`,
      label: `${mob.name} (mob)`,
      imagePath: mob.image,
      resolvedPath,
      assetType: "mob",
      variantGroup: `mob:${zoneId}:${id}`,
      context: { zone: zoneId, entity_type: "mob", entity_id: id },
    });
  }

  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (!item.image) continue;
    const resolvedPath = resolveImagePath(item.image);
    if (!resolvedPath) continue;
    targets.push({
      id: `item:${id}`,
      label: `${item.displayName} (item)`,
      imagePath: item.image,
      resolvedPath,
      assetType: "item",
      variantGroup: `item:${zoneId}:${id}`,
      context: { zone: zoneId, entity_type: "item", entity_id: id },
    });
  }

  for (const [id, trainer] of Object.entries(world.trainers ?? {})) {
    if (!trainer.image) continue;
    const resolvedPath = resolveImagePath(trainer.image);
    if (!resolvedPath) continue;
    targets.push({
      id: `trainer:${id}`,
      label: `${trainer.name} (trainer)`,
      imagePath: trainer.image,
      resolvedPath,
      assetType: "entity_portrait",
      variantGroup: `trainer:${zoneId}:${id}`,
      context: { zone: zoneId, entity_type: "trainer", entity_id: id },
    });
  }

  for (const [id, node] of Object.entries(world.gatheringNodes ?? {})) {
    if (!node.image) continue;
    const resolvedPath = resolveImagePath(node.image);
    if (!resolvedPath) continue;
    targets.push({
      id: `gatheringNode:${id}`,
      label: `${node.displayName} (gathering node)`,
      imagePath: node.image,
      resolvedPath,
      assetType: "gathering_node",
      variantGroup: `gatheringNode:${zoneId}:${id}`,
      context: { zone: zoneId, entity_type: "gatheringNode", entity_id: id },
    });
  }

  return targets;
}

function ZoneEditorInner({ zoneId }: ZoneEditorProps) {
  const reactFlow = useReactFlow();
  const zoneState = useZoneStore((s) => s.zones.get(zoneId));
  const updateZone = useZoneStore((s) => s.updateZone);
  const undo = useZoneStore((s) => s.undo);
  const redo = useZoneStore((s) => s.redo);
  const canUndo = useZoneStore((s) => s.canUndo(zoneId));
  const canRedo = useZoneStore((s) => s.canRedo(zoneId));
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntitySelection | null>(null);
  const [roomPanelTab, setRoomPanelTab] = useState<"room" | "entities" | "media">("room");
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomId, setNewRoomId] = useState("");
  const addRoomInputRef = useRef<HTMLInputElement>(null);
  const [pendingConnection, setPendingConnection] =
    useState<PendingConnection | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showBatchArt, setShowBatchArt] = useState(false);
  const [showBulkBgRemoval, setShowBulkBgRemoval] = useState(false);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [hintDismissed, setHintDismissed] = useState(
    () => localStorage.getItem("arcanum:zone-hint-dismissed") === "1",
  );

  // Stable callbacks for toolbar actions
  const handleUndo = useCallback(() => {
    undo(zoneId);
    useToastStore.getState().show("Change undone");
  }, [undo, zoneId]);
  const handleRedo = useCallback(() => {
    redo(zoneId);
    useToastStore.getState().show("Change restored");
  }, [redo, zoneId]);
  const handleGraphicalToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!zoneState) return;
    updateZone(zoneId, { ...zoneState.data, graphical: e.target.checked || undefined });
  }, [zoneState, updateZone, zoneId]);
  const handlePvpToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!zoneState) return;
    updateZone(zoneId, { ...zoneState.data, pvpEnabled: e.target.checked || undefined });
  }, [zoneState, updateZone, zoneId]);
  const handleLifespanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!zoneState) return;
    const raw = e.target.value.trim();
    const n = raw === "" ? undefined : Math.max(0, Math.round(Number(raw)));
    if (n !== undefined && isNaN(n)) return;
    updateZone(zoneId, { ...zoneState.data, lifespan: n || undefined });
  }, [zoneState, updateZone, zoneId]);
  const handleTerrainChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!zoneState) return;
    const v = e.target.value;
    updateZone(zoneId, { ...zoneState.data, terrain: v || undefined });
  }, [zoneState, updateZone, zoneId]);

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
    if (nav.view) {
      // Loose string -> ViewMode cast. Unknown view modes fall back to the
      // current mode, which is harmless.
      const allowed: ViewMode[] = ["map", "assets", "media", "dungeon", "zonemap"];
      if ((allowed as string[]).includes(nav.view)) {
        setViewMode(nav.view as ViewMode);
      }
      return;
    }
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

  // Ref to selected room so the sync effect can read it without re-running.
  const selectedRoomIdRef = useRef(selectedRoomId);
  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  // Keep nodes/edges in sync with layout when WorldFile changes,
  // but preserve positions of existing nodes. For brand-new nodes, place
  // them next to the currently selected room (or in the viewport center)
  // so the user doesn't have to hunt for them.
  const prevWorldRef = useRef<WorldFile | null>(null);
  useEffect(() => {
    if (!zoneState || zoneState.data === prevWorldRef.current) return;
    prevWorldRef.current = zoneState.data;
    setNodes((currentNodes) => {
      const existingPositions = new Map(
        currentNodes.map((node) => [node.id, node.position]),
      );

      // Resolve a drop-in position for any newly added node.
      let fallbackPos: { x: number; y: number } | null = null;
      const hasNew = layoutNodes.some((n) => !existingPositions.has(n.id));
      if (hasNew) {
        const selId = selectedRoomIdRef.current;
        const selPos = selId ? existingPositions.get(selId) : undefined;
        if (selPos) {
          // Place slightly offset from the selected room so it's visibly near it.
          fallbackPos = { x: selPos.x + 340, y: selPos.y + 40 };
        } else {
          // No selection — drop it at the current viewport center.
          try {
            const paneEl = document.querySelector(
              ".react-flow__pane",
            ) as HTMLElement | null;
            const rect = paneEl?.getBoundingClientRect();
            if (rect) {
              fallbackPos = reactFlow.screenToFlowPosition({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              });
            }
          } catch {
            // screenToFlowPosition may throw before ReactFlow is mounted — ignore.
          }
        }
      }

      return layoutNodes.map((node) => {
        const existing = existingPositions.get(node.id);
        if (existing) return { ...node, position: existing };
        if (fallbackPos) return { ...node, position: fallbackPos };
        return node;
      });
    });
    setEdges(layoutEdges);
  }, [layoutEdges, layoutNodes, setEdges, setNodes, zoneState, reactFlow]);

  // ─── Re-layout ───────────────────────────────────────────────────
  // Discard manual positions and re-run the BFS/compass layout using the
  // currently measured room sizes (so variable-height rooms don't overlap),
  // then fit the viewport to the result.
  //
  // We compute the target bounds from the fresh layout + current measurements
  // and call `fitBounds` directly, instead of `fitView` on a setTimeout. The
  // old approach was racy: `fitView` reads node measurements from the DOM,
  // which weren't updated yet immediately after `setNodes`, so it would
  // compute bounds from stale positions and zoom out to a lost viewport.
  const handleRelayout = useCallback(() => {
    if (!zoneState) return;
    const measurements = new Map<string, LayoutMeasurement>();
    for (const node of reactFlow.getNodes()) {
      const width = node.measured?.width ?? node.width;
      const height = node.measured?.height ?? node.height;
      if (width && height) {
        measurements.set(node.id, { width, height });
      }
    }
    const { nodes: rawNodes } = zoneToGraph(zoneState.data);
    const fresh = compassLayout(rawNodes, zoneState.data, measurements);
    setNodes(fresh);
    const bounds = getLayoutBounds(fresh, measurements);
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      reactFlow.fitBounds(bounds, { padding: 0.2, duration: 400 });
    }
    useToastStore.getState().show("Zone re-laid out");
  }, [zoneState, setNodes, reactFlow]);

  // ─── Initial fit-to-view ─────────────────────────────────────────
  // The `fitView` prop on <ReactFlow> is unreliable here: on first mount the
  // nodes may not yet have DOM measurements (so bounds collapse), and when
  // the user switches view modes (map → assets → map) the ReactFlow child
  // remounts with stale measurements from the previous mount.
  //
  // Instead, we run a one-shot fit whenever the map view becomes active for
  // a given zone, using our deterministic `getLayoutBounds` helper. The ref
  // key is `${zoneId}:${mapMountCount}` so a view-mode round trip re-fits.
  const mapMountCountRef = useRef(0);
  useEffect(() => {
    if (viewMode === "map") {
      mapMountCountRef.current += 1;
    }
  }, [viewMode]);

  const fitDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (viewMode !== "map") return;
    if (nodes.length === 0) return;
    const key = `${zoneId}:${mapMountCountRef.current}`;
    if (fitDoneRef.current === key) return;

    // Defer to the next frame so RoomNode has a chance to mount and measure.
    // Two rAFs: one to let React commit, one to let ReactFlow observe DOM.
    let cancelled = false;
    const raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      const raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        const measured = reactFlow.getNodes();
        const measurements = new Map<string, LayoutMeasurement>();
        for (const node of measured) {
          const width = node.measured?.width ?? node.width;
          const height = node.measured?.height ?? node.height;
          if (width && height) {
            measurements.set(node.id, { width, height });
          }
        }
        const bounds = getLayoutBounds(measured, measurements);
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          reactFlow.fitBounds(bounds, { padding: 0.2, duration: 0 });
          fitDoneRef.current = key;
        }
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, [zoneId, nodes.length, reactFlow, viewMode]);

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
      const resolvedTarget = target.startsWith("xzone:")
        ? target.slice("xzone:".length)
        : target;

      // Extract direction from sourceHandle (e.g. "source-n" → "n")
      const inferredDir = sourceHandle?.replace("source-", "") ?? "n";

      // Show direction picker instead of immediately creating exit
      setPendingConnection({ source, target: resolvedTarget, inferredDir });
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

  const handleDeleteExitFromGraph = useCallback(
    (sourceRoom: string, direction: string) => {
      if (!zoneState) return;
      try {
        const next = deleteExit(zoneState.data, sourceRoom, direction, true);
        applyWorldChange(next);
      } catch {
        // Exit doesn't exist — ignore
      }
    },
    [zoneState, applyWorldChange],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      const roomNode = selected.find((n) => n.type === "room");
      if (roomNode) {
        setSelectedRoomId(roomNode.id);
        setSelectedEntity(null);
      }
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
    // Keep the active side panel stable during ordinary map clicks and drags.
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
  const viewModes: ViewMode[] = ["map", "assets", "media", "dungeon", "zonemap"];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Zone toolbar */}
      <div className="relative flex shrink-0 items-stretch gap-4 overflow-hidden border-b border-border-default bg-bg-secondary px-3 py-2">
        <img src={subtoolbarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10]" />

        {/* Left column: two stacked rows (view tabs on top, config on bottom) */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Row 1: view tabs + action buttons */}
          <div className="flex flex-wrap items-center gap-2">
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
                className={`segmented-button focus-ring h-6 px-2 text-2xs font-medium tracking-wide max-[1100px]:h-9 max-[1100px]:px-3 ${
                  i === 0 ? "rounded-l-full" : i === arr.length - 1 ? "rounded-r-full" : ""
                }`}
                data-active={viewMode === mode}
              >
                {mode === "zonemap" ? "Zone Map" : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-l border-[var(--chrome-stroke)] pl-3">
            <button
              onClick={() => setShowBatchArt(true)}
              className="h-6 rounded px-2 text-xs text-stellar-blue transition-colors hover:bg-stellar-blue/10 max-[1100px]:h-9"
              title="Generate art for all entities"
              aria-label="Generate art for all entities"
            >
              Batch Art
            </button>
            <button
              onClick={() => setShowBulkBgRemoval(true)}
              className="h-6 rounded px-2 text-xs text-text-secondary transition-colors hover:bg-[var(--chrome-highlight)] hover:text-text-primary max-[1100px]:h-9"
              title="Remove backgrounds from mob and item images"
              aria-label="Bulk remove backgrounds"
            >
              Remove BGs
            </button>
            <button
              onClick={handleRelayout}
              disabled={roomCount === 0}
              className="h-6 rounded px-2 text-xs text-text-secondary transition-colors hover:bg-[var(--chrome-highlight)] hover:text-text-primary disabled:opacity-30 max-[1100px]:h-9"
              title="Re-run BFS layout and fit view"
              aria-label="Re-layout rooms"
            >
              Re-layout
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
                  className="ornate-input h-6 w-40 rounded px-1.5 text-xs text-text-primary max-[1100px]:h-9 max-[1100px]:min-w-0 max-[1100px]:flex-1"
                  placeholder="room_id"
                  aria-label="New room ID"
                  autoFocus
                />
                <button
                  type="submit"
                  className="h-6 rounded bg-accent/20 px-2 text-xs text-accent hover:bg-accent/30 max-[1100px]:h-9"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRoom(false)}
                  className="h-6 rounded px-1.5 text-xs text-text-muted hover:text-text-primary max-[1100px]:h-9"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={handleStartAddRoom}
                className="h-6 rounded-full border border-warm/35 bg-warm/15 px-3 text-xs text-warm-pale hover:bg-warm/25 max-[1100px]:h-9"
                title="Add Room"
              >
                + Room
              </button>
            )}
          </div>
          </div>

          {/* Row 2: undo/redo, save, and zone config */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5 border-r border-[var(--chrome-stroke)] pr-3">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="h-6 w-6 rounded text-xs text-accent transition-colors enabled:hover:bg-accent/10 disabled:opacity-30 max-[1100px]:h-9 max-[1100px]:w-9"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                &#x21B6;
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="h-6 w-6 rounded text-xs text-accent transition-colors enabled:hover:bg-accent/10 disabled:opacity-30 max-[1100px]:h-9 max-[1100px]:w-9"
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
              className={`focus-ring h-7 rounded-full px-3 text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity] duration-500 max-[1100px]:h-9 ${
                saving
                  ? "border border-[rgb(var(--accent-rgb)/0.4)] bg-[linear-gradient(145deg,rgb(var(--accent-rgb)/0.22),rgb(var(--bg-rgb)/0.9))] text-warm-pale shadow-[0_4px_16px_rgb(var(--accent-rgb)/0.18)]"
                  : justSaved
                    ? "border border-status-success/30 text-status-success"
                    : zoneState.dirty
                      ? "border border-[rgb(var(--accent-rgb)/0.4)] bg-[linear-gradient(145deg,rgb(var(--accent-rgb)/0.22),rgb(var(--bg-rgb)/0.9))] text-warm-pale shadow-[0_4px_16px_rgb(var(--accent-rgb)/0.18)]"
                      : "text-text-muted opacity-40"
              }`}
              title="Save (Ctrl+S)"
            >
              {saving ? "Saving..." : justSaved ? "\u2713 Saved" : "Save"}
            </button>

            {/* Graphical zone toggle */}
            <label className="flex items-center gap-2 text-xs text-text-secondary max-[1100px]:min-h-9">
              <input
                type="checkbox"
                checked={!!zoneState.data.graphical}
                onChange={handleGraphicalToggle}
                className="accent-accent"
              />
              Graphical zone
            </label>

            {/* PvP zone toggle */}
            <label className="flex items-center gap-2 text-xs text-text-secondary max-[1100px]:min-h-9">
              <input
                type="checkbox"
                checked={!!zoneState.data.pvpEnabled}
                onChange={handlePvpToggle}
                className="accent-accent"
              />
              PvP zone
            </label>

            {/* Lifespan (reset timer) */}
            <label className="flex items-center gap-1.5 text-xs text-text-secondary max-[1100px]:min-h-9" title="Zone reset interval in MUD ticks (minutes). 0 or empty = never resets.">
              <span className="whitespace-nowrap">Lifespan</span>
              <input
                type="number"
                min={0}
                max={9999}
                step={1}
                value={zoneState.data.lifespan ?? ""}
                onChange={handleLifespanChange}
                placeholder="0"
                className="ornate-input w-16 px-1.5 py-0.5 text-xs text-text-primary"
              />
            </label>

            {/* Default terrain */}
            <label className="flex items-center gap-1.5 text-xs text-text-secondary max-[1100px]:min-h-9" title="Default terrain type for all rooms in this zone (rooms can override).">
              <span className="whitespace-nowrap">Terrain</span>
              {TERRAIN_ICONS[zoneState.data.terrain ?? "outside"] && (
                <img src={TERRAIN_ICONS[zoneState.data.terrain ?? "outside"]} alt="" className="h-5 w-5 rounded" />
              )}
              <select
                value={zoneState.data.terrain ?? ""}
                onChange={handleTerrainChange}
                className="ornate-input px-1.5 py-0.5 text-xs text-text-primary"
              >
                <option value="">Default (outside)</option>
                <option value="inside">Inside</option>
                <option value="outside">Outside</option>
                <option value="forest">Forest</option>
                <option value="mountain">Mountain</option>
                <option value="underground">Underground</option>
                <option value="underwater">Underwater</option>
                <option value="desert">Desert</option>
                <option value="swamp">Swamp</option>
                <option value="urban">Urban</option>
                <option value="sky">Sky</option>
              </select>
            </label>
          </div>

          {/* Compact zone badge — visible only when the right column is hidden */}
          <div className="relative z-10 hidden items-center gap-2 border-t border-[var(--chrome-stroke)] pt-1.5 max-[768px]:flex">
            <span className="min-w-0 truncate font-display text-sm font-semibold uppercase tracking-wide text-text-primary">
              {zoneState.data.zone}
            </span>
            <span className="shrink-0 text-2xs text-text-muted">
              {roomCount} room{roomCount !== 1 ? "s" : ""}
            </span>
            {zoneState.dirty && (
              <span className="shrink-0 rounded-full bg-warm/15 px-1.5 py-0.5 text-3xs text-warm-pale">modified</span>
            )}
          </div>
        </div>

        {/* Right column: zone name + room count, vertically centered, spans both rows */}
        <div className="relative z-10 flex w-[clamp(14rem,18vw,24rem)] shrink-0 items-center border-l border-[var(--chrome-stroke)] pl-4 max-[768px]:hidden">
          <div className="flex w-full min-w-0 flex-col items-end gap-1">
            <span className="w-full truncate text-right font-display text-xl font-semibold uppercase leading-none tracking-widest text-text-primary">
              {zoneState.data.zone}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                {roomCount} room{roomCount !== 1 ? "s" : ""}
              </span>
              {zoneState.dirty && (
                <span className="rounded-full bg-warm/15 px-2 py-0.5 text-3xs text-warm-pale">modified</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map + Panel, Asset Browser, Media Panel, Zone Map, or Dungeon Editor */}
      {viewMode === "zonemap" ? (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ZoneMapPanel zoneId={zoneId} world={zoneState.data} onWorldChange={applyWorldChange} />
        </div>
      ) : viewMode === "dungeon" ? (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {zoneState.data.dungeon ? (
            <DungeonEditor
              zoneId={zoneId}
              world={zoneState.data}
              onWorldChange={applyWorldChange}
              onDelete={() => {
                applyWorldChange(removeDungeon(zoneState.data));
                setViewMode("map");
              }}
              onJumpToEntity={(kind, id) => {
                setViewMode("map");
                setSelectedEntity({ kind, id });
                setSelectedRoomId(null);
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
      ) : viewMode === "media" ? (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ZoneMediaPanel zoneId={zoneId} world={zoneState.data} onWorldChange={applyWorldChange} />
        </div>
      ) : viewMode === "assets" ? (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4">
          <ZoneAssetWorkbench zoneId={zoneId} world={zoneState.data} onWorldChange={applyWorldChange} />
        </div>
      ) : (
        <div id="zone-view-panel" role="tabpanel" aria-labelledby={`zone-view-tab-${viewMode}`} className="flex min-h-0 min-w-0 flex-1 max-[1100px]:flex-col">
          <div className="relative min-h-0 min-w-0 flex-1">
            <Starfield />
            <ExitDeleteContext.Provider value={handleDeleteExitFromGraph}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onSelectionChange={onSelectionChange}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              style={{ background: "var(--color-surface-scrim)" }}
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
            </ExitDeleteContext.Provider>

            {/* Atmospheric background overlay */}
            <img
              src={builderBg}
              alt=""
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover opacity-[0.18] mix-blend-screen"
            />

            {/* First-zone onboarding hint */}
            {roomCount <= 1 && !hintDismissed && viewMode === "map" && (
              <div className="pointer-events-auto absolute inset-x-0 bottom-4 z-[2] flex justify-center">
                <div className="flex items-center gap-4 rounded-2xl border border-[var(--chrome-stroke)] bg-bg-secondary/95 px-5 py-3 shadow-section">
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
                    className="shrink-0 rounded-full border border-[var(--chrome-stroke)] px-3 py-1.5 text-xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
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

            {/* Bulk background removal */}
            {showBulkBgRemoval && zoneState && assetsDir && (
              <BulkBgRemoval
                targets={collectBgRemovalTargets(zoneState.data, zoneId, assetsDir)}
                onClose={() => setShowBulkBgRemoval(false)}
              />
            )}

            {/* Direction picker overlay */}
            {pendingConnection && (
              <DirectionPicker
                source={pendingConnection.source}
                target={pendingConnection.target}
                sourceTitle={zoneState.data.rooms[pendingConnection.source]?.title}
                targetTitle={zoneState.data.rooms[pendingConnection.target]?.title}
                initialDirection={pendingConnection.inferredDir}
                onConfirm={handleConfirmConnection}
                onCancel={() => setPendingConnection(null)}
              />
            )}
          </div>

          {selectedEntity ? (
            <SpringPanel contentKey={`entity:${selectedEntity.kind}:${selectedEntity.id}`} className="max-[1100px]:w-full">
              <EntityPanel
                selection={selectedEntity}
                world={zoneState.data}
                onWorldChange={applyWorldChange}
                onClose={() => setSelectedEntity(null)}
                zoneId={zoneId}
              />
            </SpringPanel>
          ) : selectedRoomId ? (
            <SpringPanel contentKey={`room:${selectedRoomId}`} className="max-[1100px]:w-full">
              <RoomPanel
                zoneId={zoneId}
                roomId={selectedRoomId}
                world={zoneState.data}
                onWorldChange={applyWorldChange}
                onClose={() => setSelectedRoomId(null)}
                onRoomDeleted={() => setSelectedRoomId(null)}
                onSelectEntity={setSelectedEntity}
                activeTab={roomPanelTab}
                onTabChange={setRoomPanelTab}
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
