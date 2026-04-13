import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { RoomNode } from "./RoomNode";
import { ExitEdge } from "./ExitEdge";
import { Starfield } from "./Starfield";
import { zoneToGraph } from "@/lib/zoneToGraph";
import { compassLayout, getLayoutBounds } from "@/lib/dagreLayout";
import {
  loadAtlasClusterPositions,
  saveAtlasClusterPosition,
  clearAtlasClusterPositions,
  type AtlasPosition,
} from "@/lib/uiPersistence";

// Padding around the compass layout's bounding box, so rooms don't hug the
// group chrome border.
const GROUP_PAD = 32;
// Reserved space at the top of each group for the zone header badge.
const HEADER_OFFSET = 64;
// Fallback grid layout — used only when there are no cross-zone links at all.
const FALLBACK_GAP = 160;

interface ZoneGroupData extends Record<string, unknown> {
  zone: string;
  roomCount: number;
  zoneId: string;
}

function ZoneGroupNode({ data }: { data: ZoneGroupData }) {
  return (
    <div className="group relative h-full w-full cursor-grab rounded-2xl border border-dashed border-accent/25 bg-accent/[0.035] backdrop-blur-[2px] transition-colors hover:border-accent/55 hover:bg-accent/[0.08] active:cursor-grabbing">
      <div className="pointer-events-none absolute left-4 top-4 flex select-none items-start gap-3 rounded-xl border border-accent/40 bg-bg-abyss/90 px-4 py-2 shadow-[var(--shadow-drop)]">
        <div>
          <div className="font-display text-base uppercase tracking-[0.28em] text-accent">
            {data.zone}
          </div>
          <div className="mt-0.5 text-2xs uppercase tracking-wider text-text-muted">
            {data.roomCount} {data.roomCount === 1 ? "room" : "rooms"}
          </div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  room: RoomNode,
  zoneGroup: ZoneGroupNode,
};

const edgeTypes = {
  exitEdge: ExitEdge,
};

interface AtlasRoomExtra {
  __zoneId: string;
  __roomId: string;
}

/** Split "xzone:zone:room" into { zone, room }, respecting only the first colon after the prefix. */
function parseXzoneTarget(xzoneId: string): { zone: string; room: string } | null {
  if (!xzoneId.startsWith("xzone:")) return null;
  const rest = xzoneId.slice("xzone:".length);
  const colon = rest.indexOf(":");
  if (colon < 0) return null;
  return { zone: rest.slice(0, colon), room: rest.slice(colon + 1) };
}

// ─── Atlas build ────────────────────────────────────────────────────

interface ClusterSpec {
  zoneId: string;
  zoneName: string;
  layoutNodes: Node[];
  layoutEdges: Edge[];
  /** Bounding box from compassLayout, in the cluster's own coordinate space. */
  bounds: { x: number; y: number; width: number; height: number };
  /** Group-node size (inner bounds + padding + header). */
  groupWidth: number;
  groupHeight: number;
}

interface XzoneLink {
  a: string;
  b: string;
}

interface AtlasStats {
  zones: number;
  rooms: number;
  crossLinks: number;
  orphans: number;
}

interface AtlasBuild {
  nodes: Node[];
  edges: Edge[];
  stats: AtlasStats;
  isEmpty: boolean;
}

/** Layout the cluster meta-graph using dagre, returning top-left positions. */
function layoutClusters(
  specs: ClusterSpec[],
  links: XzoneLink[],
): Map<string, { x: number; y: number }> {
  if (specs.length === 0) return new Map();

  const positions = new Map<string, { x: number; y: number }>();

  // Dedup undirected links — dagre is directed but we only want one edge per pair.
  const linkSet = new Set<string>();
  const dedupedLinks: XzoneLink[] = [];
  for (const link of links) {
    const key = link.a < link.b ? `${link.a}|${link.b}` : `${link.b}|${link.a}`;
    if (linkSet.has(key)) continue;
    linkSet.add(key);
    dedupedLinks.push(link);
  }

  if (dedupedLinks.length === 0) {
    // No cross-zone connectivity — fall back to a uniform grid so disconnected
    // worlds still get a reasonable starting layout.
    const cols = Math.max(1, Math.ceil(Math.sqrt(specs.length)));
    const cellW = Math.max(...specs.map((c) => c.groupWidth)) + FALLBACK_GAP;
    const cellH = Math.max(...specs.map((c) => c.groupHeight)) + FALLBACK_GAP;
    specs.forEach((c, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      positions.set(c.zoneId, { x: col * cellW, y: row * cellH });
    });
    return positions;
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 160,
    ranksep: 220,
    marginx: 60,
    marginy: 60,
  });

  for (const spec of specs) {
    g.setNode(spec.zoneId, { width: spec.groupWidth, height: spec.groupHeight });
  }
  for (const link of dedupedLinks) {
    // Sort so the "source" is deterministic — dagre will cycle-break if needed.
    const [a, b] = link.a < link.b ? [link.a, link.b] : [link.b, link.a];
    g.setEdge(a, b);
  }

  dagre.layout(g);

  for (const spec of specs) {
    const n = g.node(spec.zoneId);
    if (!n) continue;
    // dagre returns the center; convert to top-left.
    positions.set(spec.zoneId, {
      x: n.x - spec.groupWidth / 2,
      y: n.y - spec.groupHeight / 2,
    });
  }

  // Handle any clusters dagre didn't place (disconnected + skipped for some reason)
  // by appending them to the right of the laid-out bounding box.
  const placed = Array.from(positions.values());
  const maxRight = placed.length
    ? Math.max(...placed.map((p) => p.x)) + specs[0]!.groupWidth + FALLBACK_GAP
    : 0;
  let orphanY = 0;
  for (const spec of specs) {
    if (positions.has(spec.zoneId)) continue;
    positions.set(spec.zoneId, { x: maxRight, y: orphanY });
    orphanY += spec.groupHeight + FALLBACK_GAP;
  }

  return positions;
}

function buildAtlas(
  zones: ReturnType<typeof useZoneStore.getState>["zones"],
  savedPositions: Record<string, AtlasPosition>,
): AtlasBuild {
  const specs: ClusterSpec[] = Array.from(zones.entries()).map(([zoneId, state]) => {
    const world = state.data;
    const { nodes: rawNodes, edges: rawEdges } = zoneToGraph(world);
    // Drop the synthetic cross-zone ghost nodes — we'll resolve their edges
    // to real nodes in sibling clusters after all clusters are built.
    const realNodes = rawNodes.filter((n) => !n.id.startsWith("xzone:"));
    const laid = compassLayout(realNodes, world);
    const bounds = getLayoutBounds(laid) ?? { x: 0, y: 0, width: 320, height: 240 };
    return {
      zoneId,
      zoneName: world.zone || zoneId,
      layoutNodes: laid,
      layoutEdges: rawEdges,
      bounds,
      groupWidth: bounds.width + GROUP_PAD * 2,
      groupHeight: bounds.height + GROUP_PAD * 2 + HEADER_OFFSET,
    };
  });

  if (specs.length === 0) {
    return {
      nodes: [],
      edges: [],
      stats: { zones: 0, rooms: 0, crossLinks: 0, orphans: 0 },
      isEmpty: true,
    };
  }

  // ── First pass: collect all cross-zone link pairs for meta-graph layout ──
  const allLinks: XzoneLink[] = [];
  for (const spec of specs) {
    for (const edge of spec.layoutEdges) {
      const tgtStr = String(edge.target);
      if (!tgtStr.startsWith("xzone:")) continue;
      const parsed = parseXzoneTarget(tgtStr);
      if (!parsed) continue;
      allLinks.push({ a: spec.zoneId, b: parsed.zone });
    }
  }

  // Only run the (relatively expensive) dagre meta-graph layout on clusters
  // that don't already have a saved position. Saved positions always win so
  // that user drags persist across reloads.
  const unsaved = specs.filter((s) => !savedPositions[s.zoneId]);
  const dagrePositions =
    unsaved.length > 0 ? layoutClusters(unsaved, allLinks) : new Map();
  const clusterPositions = new Map<string, { x: number; y: number }>();
  for (const spec of specs) {
    const saved = savedPositions[spec.zoneId];
    if (saved) {
      clusterPositions.set(spec.zoneId, { x: saved.x, y: saved.y });
    } else {
      clusterPositions.set(
        spec.zoneId,
        dagrePositions.get(spec.zoneId) ?? { x: 0, y: 0 },
      );
    }
  }

  // ── Build ReactFlow nodes ──────────────────────────────────────────
  const allNodes: Node[] = [];
  const roomIndex = new Map<string, Set<string>>();
  const nodeIdSet = new Set<string>();

  // Parent nodes first — ReactFlow requires parent nodes to be emitted before
  // their children so the parentId lookup during render succeeds.
  for (const spec of specs) {
    const pos = clusterPositions.get(spec.zoneId) ?? { x: 0, y: 0 };
    allNodes.push({
      id: `group:${spec.zoneId}`,
      type: "zoneGroup",
      position: pos,
      data: {
        zone: spec.zoneName,
        roomCount: spec.layoutNodes.length,
        zoneId: spec.zoneId,
      } satisfies ZoneGroupData,
      style: {
        width: spec.groupWidth,
        height: spec.groupHeight,
      },
      draggable: true,
      selectable: false,
      focusable: false,
    });
  }

  // Children — positions are RELATIVE to their parent group.
  for (const spec of specs) {
    const clusterRooms = new Set<string>();
    for (const node of spec.layoutNodes) {
      // Strip anything that triggers a Tauri IPC image read. RoomNode loads
      // the room background and each entity sprite via `useImageSrc`, which
      // invokes `read_image_data_url` per call. Multiply by every room in
      // every loaded zone and you get hundreds of concurrent base64 reads
      // when the atlas first opens — enough to freeze the app. Overview
      // entity counts + role badges still come through from data.
      const baseData = node.data as Record<string, unknown>;
      const prefixedId = `${spec.zoneId}::${node.id}`;
      allNodes.push({
        ...node,
        id: prefixedId,
        parentId: `group:${spec.zoneId}`,
        extent: "parent",
        position: {
          x: (node.position?.x ?? 0) - spec.bounds.x + GROUP_PAD,
          y: (node.position?.y ?? 0) - spec.bounds.y + GROUP_PAD + HEADER_OFFSET,
        },
        data: {
          ...baseData,
          image: undefined,
          entities: [],
          __zoneId: spec.zoneId,
          __roomId: node.id,
        } satisfies Record<string, unknown> & AtlasRoomExtra,
        draggable: false,
      });
      nodeIdSet.add(prefixedId);
      clusterRooms.add(node.id);
    }
    roomIndex.set(spec.zoneId, clusterRooms);
  }

  // ── Build ReactFlow edges ──────────────────────────────────────────
  const allEdges: Edge[] = [];
  interface PendingXzone {
    sourceZone: string;
    sourceRoom: string;
    targetZone: string;
    targetRoom: string;
    baseEdge: Edge;
  }
  const pendingXzone: PendingXzone[] = [];

  for (const spec of specs) {
    for (const edge of spec.layoutEdges) {
      const srcStr = String(edge.source);
      const tgtStr = String(edge.target);
      if (tgtStr.startsWith("xzone:")) {
        const parsed = parseXzoneTarget(tgtStr);
        if (!parsed) continue;
        pendingXzone.push({
          sourceZone: spec.zoneId,
          sourceRoom: srcStr,
          targetZone: parsed.zone,
          targetRoom: parsed.room,
          baseEdge: edge,
        });
        continue;
      }
      if (srcStr.startsWith("xzone:")) continue; // defensive
      allEdges.push({
        ...edge,
        id: `${spec.zoneId}::${edge.id}`,
        source: `${spec.zoneId}::${srcStr}`,
        target: `${spec.zoneId}::${tgtStr}`,
        selectable: false,
      });
    }
  }

  // ── Resolve cross-zone edges ─────────────────────────────────────
  // Dedup reciprocal exits (A↔B shows up from both sides) by sorted pair key
  // and mark merged edges bidirectional so they read as an undirected corridor.
  const xzoneMap = new Map<string, { first: PendingXzone; second?: PendingXzone }>();
  let orphans = 0;

  for (const p of pendingXzone) {
    const targetRooms = roomIndex.get(p.targetZone);
    if (!targetRooms || !targetRooms.has(p.targetRoom)) {
      orphans += 1;
      continue;
    }
    const a = `${p.sourceZone}:${p.sourceRoom}`;
    const b = `${p.targetZone}:${p.targetRoom}`;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const existing = xzoneMap.get(key);
    if (!existing) {
      xzoneMap.set(key, { first: p });
    } else if (!existing.second) {
      existing.second = p;
    }
  }

  let resolved = 0;
  for (const [key, entry] of xzoneMap.entries()) {
    const p = entry.first;
    const sourceId = `${p.sourceZone}::${p.sourceRoom}`;
    const targetId = `${p.targetZone}::${p.targetRoom}`;
    if (!nodeIdSet.has(sourceId) || !nodeIdSet.has(targetId)) {
      orphans += 1;
      continue;
    }
    resolved += 1;
    const bidirectional = !!entry.second;
    const baseEdge = p.baseEdge;
    const baseStyle = (baseEdge.style ?? {}) as Record<string, unknown>;
    allEdges.push({
      ...baseEdge,
      id: `xzone::${key}`,
      source: sourceId,
      target: targetId,
      selectable: false,
      markerEnd: bidirectional ? undefined : baseEdge.markerEnd,
      style: {
        ...baseStyle,
        strokeWidth: 2.5,
        strokeDasharray: undefined,
      },
      label: baseEdge.label,
      zIndex: 5,
    });
  }

  const totalRooms = specs.reduce((sum, c) => sum + c.layoutNodes.length, 0);

  return {
    nodes: allNodes,
    edges: allEdges,
    stats: {
      zones: specs.length,
      rooms: totalRooms,
      crossLinks: resolved,
      orphans,
    },
    isEmpty: false,
  };
}

// ─── Component ──────────────────────────────────────────────────────

function ZoneAtlas() {
  const zones = useZoneStore((s) => s.zones);
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const projectPath = useProjectStore((s) => s.project?.mudDir ?? "");

  // Saved cluster positions per project. `resetNonce` bumps when the user
  // resets the layout, forcing `initial` to re-run with a fresh (empty) map.
  const [resetNonce, setResetNonce] = useState(0);
  const savedPositions = useMemo(
    () => (projectPath ? loadAtlasClusterPositions(projectPath) : {}),
    // resetNonce is in the dep list intentionally — bumping it re-reads storage
    // after we clear it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectPath, resetNonce],
  );

  const initial = useMemo(
    () => buildAtlas(zones, savedPositions),
    [zones, savedPositions],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // When the zone set (or saved positions) changes, snap back to the freshly
  // computed atlas. Saved positions are already baked into `initial.nodes`,
  // so this also restores on first open.
  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const d = node.data as Partial<AtlasRoomExtra> | undefined;
      if (d?.__zoneId && d.__roomId) {
        navigateTo({ zoneId: d.__zoneId, roomId: d.__roomId });
      }
    },
    [navigateTo],
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== "zoneGroup") return;
      const groupData = node.data as ZoneGroupData | undefined;
      if (!groupData?.zoneId || !projectPath) return;
      saveAtlasClusterPosition(projectPath, groupData.zoneId, {
        x: node.position.x,
        y: node.position.y,
      });
    },
    [projectPath],
  );

  const handleResetLayout = useCallback(() => {
    if (!projectPath) return;
    clearAtlasClusterPositions(projectPath);
    setResetNonce((n) => n + 1);
  }, [projectPath]);

  const hasSavedLayout = Object.keys(savedPositions).length > 0;

  if (initial.isEmpty) {
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        minZoom={0.04}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable
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
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 text-2xs">
        <AtlasStat label="zones" value={initial.stats.zones} />
        <AtlasStat label="rooms" value={initial.stats.rooms} />
        <AtlasStat label="cross-zone links" value={initial.stats.crossLinks} />
        {initial.stats.orphans > 0 && (
          <AtlasStat label="orphan links" value={initial.stats.orphans} tone="warn" />
        )}
        {hasSavedLayout && (
          <button
            type="button"
            onClick={handleResetLayout}
            className="pointer-events-auto rounded-full border border-border-muted bg-bg-abyss/80 px-2.5 py-1 uppercase tracking-wider text-text-muted backdrop-blur transition-colors hover:border-accent/40 hover:text-accent"
            title="Discard saved cluster positions for this project and re-run the auto layout"
          >
            Reset Layout
          </button>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-20 right-4 z-10 max-w-xs rounded-lg border border-border-muted bg-bg-abyss/85 px-3 py-2 text-2xs italic text-text-muted backdrop-blur">
        Drag a cluster to reposition it — positions are saved per project. Click any room
        to jump into its zone.
      </div>
    </div>
  );
}

function AtlasStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "border-warm/50 text-warm"
      : "border-border-muted text-text-secondary";
  return (
    <div
      className={`rounded-full border bg-bg-abyss/80 px-2.5 py-1 backdrop-blur ${toneClass}`}
    >
      <span className="uppercase tracking-wider text-text-muted">{label}</span>
      <span className="ml-1.5 font-mono text-text-primary">{value}</span>
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
