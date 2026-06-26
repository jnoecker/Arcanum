import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnNodeDrag,
  type Connection,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { RoomNode } from "./RoomNode";
import { ExitEdge } from "./ExitEdge";
import { DirectionPicker } from "./DirectionPicker";
import { Starfield } from "./Starfield";
import { zoneToGraph } from "@/lib/zoneToGraph";
import { addExit, OPPOSITE, exitTarget } from "@/lib/zoneEdits";
import { compassLayout, getLayoutBounds } from "@/lib/dagreLayout";
import type { WorldFile } from "@/types/world";
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
// Collapsed zone-card footprint. The meta-graph layout is run with these
// boxes; expanded zones overlap their neighbors in place, which is fine since
// expansion is transient and the user repositions as needed.
const CARD_W = 248;
const CARD_H = 132;

// Shared anchor handle id for aggregated zone↔zone corridor edges.
const AGG_HANDLE = "agg";

const aggHandleStyle: React.CSSProperties = {
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  background: "transparent",
  border: "none",
  opacity: 0,
};

// ─── Node components ────────────────────────────────────────────────

interface ZoneCardData extends Record<string, unknown> {
  zoneId: string;
  zone: string;
  roomCount: number;
  linkCount: number;
}

function ZoneCardNode({ data }: { data: ZoneCardData }) {
  return (
    <div
      className="group relative flex h-full w-full cursor-pointer flex-col justify-between rounded-2xl border border-accent/30 bg-accent/[0.05] px-5 py-4 backdrop-blur-[2px] transition-colors hover:border-accent/70 hover:bg-accent/[0.1]"
      title="Click to expand this zone into rooms"
    >
      <Handle
        type="source"
        id={AGG_HANDLE}
        position={Position.Top}
        isConnectable={false}
        style={{ ...aggHandleStyle, left: "50%" }}
      />
      <div>
        <div className="font-display text-lg uppercase tracking-[0.26em] text-accent">
          {data.zone}
        </div>
        <div className="mt-1 text-2xs uppercase tracking-wider text-text-muted">
          {data.roomCount} {data.roomCount === 1 ? "room" : "rooms"}
          {data.linkCount > 0 && (
            <span className="ml-2 text-text-secondary">
              · {data.linkCount} {data.linkCount === 1 ? "link" : "links"}
            </span>
          )}
        </div>
      </div>
      <div className="text-3xs uppercase tracking-[0.2em] text-text-muted opacity-0 transition-opacity group-hover:opacity-100">
        ▸ Click to open rooms
      </div>
    </div>
  );
}

interface ZoneGroupData extends Record<string, unknown> {
  zone: string;
  roomCount: number;
  zoneId: string;
}

function ZoneGroupNode({ data }: { data: ZoneGroupData }) {
  return (
    <div className="group relative h-full w-full cursor-grab rounded-2xl border border-dashed border-accent/40 bg-accent/[0.04] backdrop-blur-[2px] transition-colors hover:border-accent/60 active:cursor-grabbing">
      <Handle
        type="source"
        id={AGG_HANDLE}
        position={Position.Top}
        isConnectable={false}
        style={{ ...aggHandleStyle, left: "50%" }}
      />
      <div className="pointer-events-none absolute left-4 top-4 flex select-none items-center gap-3 rounded-xl border border-accent/40 bg-bg-abyss/90 px-4 py-2 shadow-[var(--shadow-drop)]">
        <div>
          <div className="font-display text-base uppercase tracking-[0.28em] text-accent">
            {data.zone}
          </div>
          <div className="mt-0.5 text-2xs uppercase tracking-wider text-text-muted">
            {data.roomCount} {data.roomCount === 1 ? "room" : "rooms"}
          </div>
        </div>
        <span className="rounded-full border border-border-muted px-2 py-0.5 text-3xs uppercase tracking-[0.2em] text-text-muted">
          ▾ collapse
        </span>
      </div>
    </div>
  );
}

const nodeTypes = {
  room: RoomNode,
  zoneGroup: ZoneGroupNode,
  zoneCard: ZoneCardNode,
};

const edgeTypes = {
  exitEdge: ExitEdge,
};

interface AtlasRoomExtra {
  __zoneId: string;
  __roomId: string;
}

/** An in-progress cross-zone link awaiting a direction choice. */
interface PendingXLink {
  sourceZone: string;
  sourceRoom: string;
  sourceTitle?: string;
  targetZone: string;
  targetRoom: string;
  targetTitle?: string;
  inferredDir: string;
}

// ─── Cheap zone summary (no graph build) ─────────────────────────────
//
// Building the full room graph + compass layout for every zone is what made
// the atlas crawl. For the default collapsed view we only need a room count
// and the cross-zone exits, both of which come from a flat scan of the zone's
// exit table — no ReactFlow nodes, no image IPC, no layout. The expensive
// graph build is deferred to whichever 2–3 zones the user actually expands.

interface CrossLink {
  fromZone: string;
  fromRoom: string;
  toZone: string;
  toRoom: string;
}

interface ZoneSummary {
  zoneId: string;
  zoneName: string;
  roomIds: Set<string>;
  crossLinks: CrossLink[];
}

function summarizeZone(zoneId: string, world: WorldFile): ZoneSummary {
  const roomIds = new Set(Object.keys(world.rooms ?? {}));
  const crossLinks: CrossLink[] = [];
  for (const [roomId, room] of Object.entries(world.rooms ?? {})) {
    if (!room.exits) continue;
    for (const val of Object.values(room.exits)) {
      const raw = exitTarget(val);
      const colon = raw.indexOf(":");
      if (colon < 0) continue;
      crossLinks.push({
        fromZone: zoneId,
        fromRoom: roomId,
        toZone: raw.slice(0, colon),
        toRoom: raw.slice(colon + 1),
      });
    }
  }
  return { zoneId, zoneName: world.zone || zoneId, roomIds, crossLinks };
}

/** A deduped, undirected cross-zone corridor between two specific rooms. */
interface Corridor {
  aZone: string;
  aRoom: string;
  bZone: string;
  bRoom: string;
  resolved: boolean;
}

// ─── Meta-graph layout ──────────────────────────────────────────────

interface ZoneBox {
  zoneId: string;
  width: number;
  height: number;
}

interface ZonePair {
  a: string;
  b: string;
}

/** Layout the zone meta-graph using dagre, returning top-left positions. */
function layoutZoneBoxes(
  boxes: ZoneBox[],
  pairs: ZonePair[],
): Map<string, { x: number; y: number }> {
  if (boxes.length === 0) return new Map();

  const positions = new Map<string, { x: number; y: number }>();

  const linkSet = new Set<string>();
  const dedupedPairs: ZonePair[] = [];
  for (const pair of pairs) {
    if (pair.a === pair.b) continue;
    const key = pair.a < pair.b ? `${pair.a}|${pair.b}` : `${pair.b}|${pair.a}`;
    if (linkSet.has(key)) continue;
    linkSet.add(key);
    dedupedPairs.push(pair);
  }

  if (dedupedPairs.length === 0) {
    // No cross-zone connectivity — fall back to a uniform grid so disconnected
    // worlds still get a reasonable starting layout.
    const cols = Math.max(1, Math.ceil(Math.sqrt(boxes.length)));
    const cellW = Math.max(...boxes.map((c) => c.width)) + FALLBACK_GAP;
    const cellH = Math.max(...boxes.map((c) => c.height)) + FALLBACK_GAP;
    boxes.forEach((c, i) => {
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

  for (const box of boxes) {
    g.setNode(box.zoneId, { width: box.width, height: box.height });
  }
  for (const pair of dedupedPairs) {
    const [a, b] = pair.a < pair.b ? [pair.a, pair.b] : [pair.b, pair.a];
    g.setEdge(a, b);
  }

  dagre.layout(g);

  const boxById = new Map(boxes.map((b) => [b.zoneId, b]));
  for (const box of boxes) {
    const n = g.node(box.zoneId);
    if (!n) continue;
    positions.set(box.zoneId, {
      x: n.x - box.width / 2,
      y: n.y - box.height / 2,
    });
  }

  // Append any clusters dagre didn't place to the right of the laid-out box.
  const placed = Array.from(positions.values());
  const maxRight = placed.length
    ? Math.max(...placed.map((p) => p.x)) + (boxes[0]?.width ?? CARD_W) + FALLBACK_GAP
    : 0;
  let orphanY = 0;
  for (const box of boxes) {
    if (positions.has(box.zoneId)) continue;
    positions.set(box.zoneId, { x: maxRight, y: orphanY });
    orphanY += (boxById.get(box.zoneId)?.height ?? CARD_H) + FALLBACK_GAP;
  }

  return positions;
}

// ─── Atlas build ────────────────────────────────────────────────────

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

/** Per-expanded-zone laid-out graph + bounds. */
interface ExpandedGraph {
  layoutNodes: Node[];
  layoutEdges: Edge[];
  bounds: { x: number; y: number; width: number; height: number };
  groupWidth: number;
  groupHeight: number;
}

function buildExpandedGraph(world: WorldFile): ExpandedGraph {
  const { nodes: rawNodes, edges: rawEdges } = zoneToGraph(world);
  const realNodes = rawNodes.filter((n) => !n.id.startsWith("xzone:"));
  const laid = compassLayout(realNodes, world);
  const bounds = getLayoutBounds(laid) ?? { x: 0, y: 0, width: 320, height: 240 };
  return {
    layoutNodes: laid,
    layoutEdges: rawEdges,
    bounds,
    groupWidth: bounds.width + GROUP_PAD * 2,
    groupHeight: bounds.height + GROUP_PAD * 2 + HEADER_OFFSET,
  };
}

function buildAtlas(
  zones: ReturnType<typeof useZoneStore.getState>["zones"],
  savedPositions: Record<string, AtlasPosition>,
  expandedZones: Set<string>,
): AtlasBuild {
  const summaries: ZoneSummary[] = Array.from(zones.entries()).map(
    ([zoneId, state]) => summarizeZone(zoneId, state.data),
  );

  if (summaries.length === 0) {
    return {
      nodes: [],
      edges: [],
      stats: { zones: 0, rooms: 0, crossLinks: 0, orphans: 0 },
      isEmpty: true,
    };
  }

  const summaryById = new Map(summaries.map((s) => [s.zoneId, s]));

  // ── Dedup cross-zone exits into undirected corridors ──────────────
  const corridorMap = new Map<string, Corridor>();
  for (const summary of summaries) {
    for (const link of summary.crossLinks) {
      const a = `${link.fromZone}:${link.fromRoom}`;
      const b = `${link.toZone}:${link.toRoom}`;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (corridorMap.has(key)) continue;
      const target = summaryById.get(link.toZone);
      const resolved = !!target && target.roomIds.has(link.toRoom);
      corridorMap.set(key, {
        aZone: link.fromZone,
        aRoom: link.fromRoom,
        bZone: link.toZone,
        bRoom: link.toRoom,
        resolved,
      });
    }
  }
  const corridors = Array.from(corridorMap.values());
  const validCorridors = corridors.filter((c) => c.resolved);
  const orphans = corridors.length - validCorridors.length;

  // ── Build the laid-out graph for each expanded zone ────────────────
  const expanded = new Map<string, ExpandedGraph>();
  for (const summary of summaries) {
    if (!expandedZones.has(summary.zoneId)) continue;
    const state = zones.get(summary.zoneId);
    if (!state) continue;
    expanded.set(summary.zoneId, buildExpandedGraph(state.data));
  }

  // ── Meta-graph layout for zones without a saved position ───────────
  const pairs: ZonePair[] = validCorridors.map((c) => ({ a: c.aZone, b: c.bZone }));
  const boxes: ZoneBox[] = summaries
    .filter((s) => !savedPositions[s.zoneId])
    .map((s) => {
      const exp = expanded.get(s.zoneId);
      return {
        zoneId: s.zoneId,
        width: exp ? exp.groupWidth : CARD_W,
        height: exp ? exp.groupHeight : CARD_H,
      };
    });
  const dagrePositions = boxes.length > 0 ? layoutZoneBoxes(boxes, pairs) : new Map();

  const positions = new Map<string, { x: number; y: number }>();
  for (const summary of summaries) {
    const saved = savedPositions[summary.zoneId];
    if (saved) {
      positions.set(summary.zoneId, { x: saved.x, y: saved.y });
    } else {
      positions.set(
        summary.zoneId,
        dagrePositions.get(summary.zoneId) ?? { x: 0, y: 0 },
      );
    }
  }

  // ── Nodes: one card OR group per zone, plus children for expanded ──
  const allNodes: Node[] = [];
  const nodeIdSet = new Set<string>();
  let totalRooms = 0;

  for (const summary of summaries) {
    const pos = positions.get(summary.zoneId) ?? { x: 0, y: 0 };
    const roomCount = summary.roomIds.size;
    totalRooms += roomCount;
    const exp = expanded.get(summary.zoneId);
    const linkCount = validCorridors.filter(
      (c) => c.aZone === summary.zoneId || c.bZone === summary.zoneId,
    ).length;

    if (exp) {
      allNodes.push({
        id: `group:${summary.zoneId}`,
        type: "zoneGroup",
        position: pos,
        data: {
          zone: summary.zoneName,
          roomCount,
          zoneId: summary.zoneId,
        } satisfies ZoneGroupData,
        style: { width: exp.groupWidth, height: exp.groupHeight },
        draggable: true,
        selectable: false,
        focusable: false,
      });
    } else {
      allNodes.push({
        id: `group:${summary.zoneId}`,
        type: "zoneCard",
        position: pos,
        data: {
          zone: summary.zoneName,
          roomCount,
          linkCount,
          zoneId: summary.zoneId,
        } satisfies ZoneCardData,
        style: { width: CARD_W, height: CARD_H },
        draggable: true,
        selectable: false,
        focusable: false,
      });
    }
  }

  // Children — emitted after all parents (ReactFlow requires parent-first).
  for (const summary of summaries) {
    const exp = expanded.get(summary.zoneId);
    if (!exp) continue;
    for (const node of exp.layoutNodes) {
      const baseData = node.data as Record<string, unknown>;
      const prefixedId = `${summary.zoneId}::${node.id}`;
      allNodes.push({
        ...node,
        id: prefixedId,
        parentId: `group:${summary.zoneId}`,
        extent: "parent",
        position: {
          x: (node.position?.x ?? 0) - exp.bounds.x + GROUP_PAD,
          y: (node.position?.y ?? 0) - exp.bounds.y + GROUP_PAD + HEADER_OFFSET,
        },
        data: {
          ...baseData,
          __zoneId: summary.zoneId,
          __roomId: node.id,
        } satisfies Record<string, unknown> & AtlasRoomExtra,
        draggable: false,
      });
      nodeIdSet.add(prefixedId);
    }
  }

  // ── Edges ──────────────────────────────────────────────────────────
  const allEdges: Edge[] = [];

  // Intra-zone edges for expanded zones only.
  for (const summary of summaries) {
    const exp = expanded.get(summary.zoneId);
    if (!exp) continue;
    for (const edge of exp.layoutEdges) {
      const srcStr = String(edge.source);
      const tgtStr = String(edge.target);
      if (tgtStr.startsWith("xzone:") || srcStr.startsWith("xzone:")) continue;
      allEdges.push({
        ...edge,
        id: `${summary.zoneId}::${edge.id}`,
        source: `${summary.zoneId}::${srcStr}`,
        target: `${summary.zoneId}::${tgtStr}`,
        selectable: false,
      });
    }
  }

  // Cross-zone corridors. Both zones expanded → room-level edges. Otherwise →
  // a single aggregated zone↔zone edge per pair, labelled with the count.
  const aggCounts = new Map<string, { a: string; b: string; count: number }>();
  for (const c of validCorridors) {
    const bothExpanded = expanded.has(c.aZone) && expanded.has(c.bZone);
    if (bothExpanded) {
      const sourceId = `${c.aZone}::${c.aRoom}`;
      const targetId = `${c.bZone}::${c.bRoom}`;
      if (!nodeIdSet.has(sourceId) || !nodeIdSet.has(targetId)) continue;
      allEdges.push({
        id: `xroom::${c.aZone}:${c.aRoom}|${c.bZone}:${c.bRoom}`,
        type: "exitEdge",
        source: sourceId,
        target: targetId,
        selectable: false,
        style: { stroke: "var(--color-graph-cross)", strokeWidth: 2.5 },
        zIndex: 5,
      });
    } else {
      const key = c.aZone < c.bZone ? `${c.aZone}|${c.bZone}` : `${c.bZone}|${c.aZone}`;
      const existing = aggCounts.get(key);
      if (existing) existing.count += 1;
      else aggCounts.set(key, { a: c.aZone, b: c.bZone, count: 1 });
    }
  }

  for (const [key, { a, b, count }] of aggCounts.entries()) {
    allEdges.push({
      id: `agg::${key}`,
      source: `group:${a}`,
      target: `group:${b}`,
      sourceHandle: AGG_HANDLE,
      targetHandle: AGG_HANDLE,
      selectable: false,
      label: count > 1 ? `${count}` : undefined,
      style: {
        stroke: "var(--color-graph-cross)",
        strokeWidth: 2,
        strokeDasharray: "6 4",
      },
      zIndex: 4,
    });
  }

  return {
    nodes: allNodes,
    edges: allEdges,
    stats: {
      zones: summaries.length,
      rooms: totalRooms,
      crossLinks: validCorridors.length,
      orphans,
    },
    isEmpty: false,
  };
}

// ─── Component ──────────────────────────────────────────────────────

function ZoneAtlas() {
  const zones = useZoneStore((s) => s.zones);
  const updateZone = useZoneStore((s) => s.updateZone);
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const projectPath = useProjectStore((s) => s.project?.mudDir ?? "");

  // An in-progress room→room drag awaiting a direction. Cross-zone only.
  const [pendingLink, setPendingLink] = useState<PendingXLink | null>(null);

  // Which zones are expanded into room nodes. Default: all collapsed (cheap).
  const [expandedZones, setExpandedZones] = useState<Set<string>>(() => new Set());

  // Saved cluster positions per project. `resetNonce` bumps when the user
  // resets the layout, forcing the memo to re-read storage.
  const [resetNonce, setResetNonce] = useState(0);
  const savedPositions = useMemo(
    () => (projectPath ? loadAtlasClusterPositions(projectPath) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectPath, resetNonce],
  );

  // Drop expanded zones that no longer exist (zone deleted / project switched).
  useEffect(() => {
    setExpandedZones((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (zones.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [zones]);

  const initial = useMemo(
    () => buildAtlas(zones, savedPositions, expandedZones),
    [zones, savedPositions, expandedZones],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Reconcile ReactFlow state with the freshly computed atlas.
  //
  // `savedPositions` only changes identity on a project switch or an explicit
  // "Reset Layout". We use that to decide between two behaviors:
  //   • savedPositions changed → apply the fresh layout wholesale.
  //   • otherwise (zone edit OR expand/collapse) → refresh nodes and edges but
  //     KEEP the on-screen position of any node that survives, so creating a
  //     link or expanding a zone doesn't shove every cluster around. Zone
  //     cards and groups share the `group:<id>` node id, so a card's position
  //     carries straight into its expanded group and back.
  const prevSavedRef = useRef(savedPositions);
  useEffect(() => {
    const savedChanged = prevSavedRef.current !== savedPositions;
    prevSavedRef.current = savedPositions;
    if (savedChanged) {
      setNodes(initial.nodes);
      setEdges(initial.edges);
      return;
    }
    setNodes((current) => {
      const positions = new Map(current.map((n) => [n.id, n.position]));
      return initial.nodes.map((n) => {
        const existing = positions.get(n.id);
        return existing ? { ...n, position: existing } : n;
      });
    });
    setEdges(initial.edges);
  }, [initial, savedPositions, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "zoneCard") {
        const zoneId = (node.data as ZoneCardData).zoneId;
        setExpandedZones((prev) => {
          const next = new Set(prev);
          next.add(zoneId);
          return next;
        });
        return;
      }
      if (node.type === "zoneGroup") {
        const zoneId = (node.data as ZoneGroupData).zoneId;
        setExpandedZones((prev) => {
          const next = new Set(prev);
          next.delete(zoneId);
          return next;
        });
        return;
      }
      const d = node.data as Partial<AtlasRoomExtra> | undefined;
      if (d?.__zoneId && d.__roomId) {
        navigateTo({ zoneId: d.__zoneId, roomId: d.__roomId });
      }
    },
    [navigateTo],
  );

  // ─── Cross-zone linking ──────────────────────────────────────────
  // Dragging from one room's exit handle to a room in another expanded zone
  // opens the direction picker; confirming writes a two-way cross-zone exit.
  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle } = connection;
      if (!source || !target || source === target) return;

      const byId = new Map(nodes.map((n) => [n.id, n]));
      const srcData = byId.get(source)?.data as
        | (Partial<AtlasRoomExtra> & { title?: string })
        | undefined;
      const tgtData = byId.get(target)?.data as
        | (Partial<AtlasRoomExtra> & { title?: string })
        | undefined;
      if (!srcData?.__zoneId || !srcData.__roomId) return;
      if (!tgtData?.__zoneId || !tgtData.__roomId) return;

      if (srcData.__zoneId === tgtData.__zoneId) {
        useToastStore
          .getState()
          .show("Atlas links connect different zones — use the zone editor for exits within a zone");
        return;
      }

      setPendingLink({
        sourceZone: srcData.__zoneId,
        sourceRoom: srcData.__roomId,
        sourceTitle: srcData.title,
        targetZone: tgtData.__zoneId,
        targetRoom: tgtData.__roomId,
        targetTitle: tgtData.title,
        inferredDir: sourceHandle ?? "n",
      });
    },
    [nodes],
  );

  const handleConfirmLink = useCallback(
    (direction: string) => {
      if (!pendingLink) return;
      const { sourceZone, sourceRoom, targetZone, targetRoom } = pendingLink;
      const reverse = OPPOSITE[direction] ?? direction;

      const sourceData = useZoneStore.getState().zones.get(sourceZone)?.data;
      const targetData = useZoneStore.getState().zones.get(targetZone)?.data;
      if (!sourceData || !targetData) {
        useToastStore.getState().show("One of the zones is no longer loaded");
        setPendingLink(null);
        return;
      }

      if (sourceData.rooms[sourceRoom]?.exits?.[direction]) {
        useToastStore
          .getState()
          .show(`${sourceRoom} already has a ${direction.toUpperCase()} exit — pick another direction`);
        return;
      }
      if (targetData.rooms[targetRoom]?.exits?.[reverse]) {
        useToastStore
          .getState()
          .show(`${targetRoom} already has a ${reverse.toUpperCase()} exit — pick another direction`);
        return;
      }

      try {
        const nextSource = addExit(
          sourceData,
          sourceRoom,
          direction,
          `${targetZone}:${targetRoom}`,
          false,
        );
        const nextTarget = addExit(
          targetData,
          targetRoom,
          reverse,
          `${sourceZone}:${sourceRoom}`,
          false,
        );
        updateZone(sourceZone, nextSource);
        updateZone(targetZone, nextTarget);
        useToastStore
          .getState()
          .show(`Linked ${sourceZone} ↔ ${targetZone} — save both zones to persist`);
      } catch (err) {
        useToastStore
          .getState()
          .show(err instanceof Error ? err.message : "Couldn't create the link");
      }
      setPendingLink(null);
    },
    [pendingLink, updateZone],
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== "zoneGroup" && node.type !== "zoneCard") return;
      const zoneId = (node.data as { zoneId?: string }).zoneId;
      if (!zoneId || !projectPath) return;
      saveAtlasClusterPosition(projectPath, zoneId, {
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

  const handleCollapseAll = useCallback(() => {
    setExpandedZones(new Set());
  }, []);

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
        onConnect={onConnect}
        minZoom={0.04}
        maxZoom={2}
        // RoomNode ships a single source-type handle per direction; loose
        // mode lets edge targets anchor to them.
        connectionMode={ConnectionMode.Loose}
        // Cull off-screen room nodes so expanded zones stay cheap to render.
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable
        // Rooms stay non-draggable (set per-node), but their handles are live
        // so users can drag a room→room cross-zone link.
        nodesConnectable
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
        {expandedZones.size > 0 && (
          <button
            type="button"
            onClick={handleCollapseAll}
            className="pointer-events-auto rounded-full border border-border-muted bg-bg-abyss/80 px-2.5 py-1 uppercase tracking-wider text-text-muted backdrop-blur transition-colors hover:border-accent/40 hover:text-accent"
            title="Collapse every expanded zone back to a card"
          >
            Collapse All ({expandedZones.size})
          </button>
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
        Drag zone cards into rough positions (saved per project). Click a card to open its
        rooms; click an open zone's header to collapse it. With two zones open, drag from a
        room's edge handle to a room in the other to link them.
      </div>

      {/* Cross-zone direction picker */}
      {pendingLink && (
        <DirectionPicker
          source={`${pendingLink.sourceZone}:${pendingLink.sourceRoom}`}
          target={`${pendingLink.targetZone}:${pendingLink.targetRoom}`}
          sourceTitle={pendingLink.sourceTitle ?? pendingLink.sourceRoom}
          targetTitle={pendingLink.targetTitle ?? pendingLink.targetRoom}
          initialDirection={pendingLink.inferredDir}
          onConfirm={handleConfirmLink}
          onCancel={() => setPendingLink(null)}
        />
      )}
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
