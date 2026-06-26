import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Handle,
  Position,
  ConnectionMode,
  NodeResizer,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
  type OnNodeDrag,
  type Viewport,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useLoreStore, selectMaps } from "@/stores/loreStore";
import { useImageSrc } from "@/lib/useImageSrc";
import {
  computeZoneFootprint,
  roomNormalizedPos,
  zoneConnectionPoints,
  DIR_OFFSET,
  type ZoneFootprint,
} from "@/lib/zoneFootprint";
import {
  loadWorldOverlay,
  saveOverlaySelectedMap,
  saveOverlayPlacement,
  removeOverlayPlacement,
  clearOverlayPlacements,
  type OverlayPlacement,
} from "@/lib/uiPersistence";
import type { WorldFile } from "@/types/world";

// ─── Geometry helpers ───────────────────────────────────────────────

interface ConnAnchor {
  id: string;
  /** Normalized [0..1] position within the zone box. */
  nx: number;
  ny: number;
  position: Position;
  toZone: string;
  toRoom: string;
  roomId: string;
  dir: string;
}

interface ZoneMeta {
  zoneId: string;
  name: string;
  footprint: ZoneFootprint;
  anchors: ConnAnchor[];
}

function sideFor(dx: number, dy: number): Position {
  if (dx !== 0 && Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  if (dy !== 0) return dy > 0 ? Position.Bottom : Position.Top;
  return Position.Top;
}

function buildAnchors(world: WorldFile, fp: ZoneFootprint): ConnAnchor[] {
  return zoneConnectionPoints(world).map((cp) => {
    const off = DIR_OFFSET[cp.dir];
    const dx = off?.[0] ?? 0;
    const dy = off?.[1] ?? 0;
    const norm = fp.chaotic ? null : roomNormalizedPos(fp, cp.roomId);
    const baseNx = norm?.nx ?? 0.5;
    const baseNy = norm?.ny ?? 0.5;
    return {
      id: `cp:${cp.roomId}:${cp.dir}`,
      nx: dx > 0 ? 1 : dx < 0 ? 0 : baseNx,
      ny: dy > 0 ? 1 : dy < 0 ? 0 : baseNy,
      position: sideFor(dx, dy),
      toZone: cp.toZone,
      toRoom: cp.toRoom,
      roomId: cp.roomId,
      dir: cp.dir,
    };
  });
}

/** SVG path tracing the outer boundary of the occupied footprint cells. */
function buildOutline(fp: ZoneFootprint): string {
  const occ = new Set(fp.cells.map((c) => `${c.gx},${c.gy}`));
  const segs: string[] = [];
  for (const c of fp.cells) {
    const x = c.gx - fp.minGx;
    const y = c.gy - fp.minGy;
    if (!occ.has(`${c.gx},${c.gy - 1}`)) segs.push(`M${x} ${y}L${x + 1} ${y}`);
    if (!occ.has(`${c.gx},${c.gy + 1}`)) segs.push(`M${x} ${y + 1}L${x + 1} ${y + 1}`);
    if (!occ.has(`${c.gx - 1},${c.gy}`)) segs.push(`M${x} ${y}L${x} ${y + 1}`);
    if (!occ.has(`${c.gx + 1},${c.gy}`)) segs.push(`M${x + 1} ${y}L${x + 1} ${y + 1}`);
  }
  return segs.join("");
}

function defaultRect(
  fp: ZoneFootprint,
  mapW: number,
  mapH: number,
  cx: number,
  cy: number,
): OverlayPlacement {
  const aspect = Math.max(0.25, Math.min(4, fp.cols / fp.rows));
  let w = Math.min(mapW * 0.45, Math.max(mapW * 0.14, 140));
  let h = w / aspect;
  if (h > mapH * 0.45) {
    h = mapH * 0.45;
    w = h * aspect;
  }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

// ─── Zone node ──────────────────────────────────────────────────────

interface ZonePlacementData extends Record<string, unknown> {
  zoneId: string;
  name: string;
  footprint: ZoneFootprint;
  anchors: ConnAnchor[];
  onRemove: (zoneId: string) => void;
  onResizeEnd: (zoneId: string, rect: OverlayPlacement) => void;
}

type ZonePlacementNodeType = Node<ZonePlacementData, "zonePlacement">;

function ZonePlacementNode({ data, selected }: NodeProps<ZonePlacementNodeType>) {
  const { footprint: fp, anchors } = data;
  const showSilhouette = !fp.chaotic && fp.cells.length > 0;
  const outline = useMemo(() => (showSilhouette ? buildOutline(fp) : ""), [fp, showSilhouette]);

  return (
    <div
      className={`relative h-full w-full text-accent transition-colors ${
        selected ? "ring-1 ring-accent/60" : ""
      }`}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={56}
        minHeight={40}
        keepAspectRatio={false}
        lineClassName="!border-accent/70"
        handleClassName="!h-2 !w-2 !rounded-sm !border-accent !bg-bg-abyss"
        onResizeEnd={(_, p) =>
          data.onResizeEnd(data.zoneId, { x: p.x, y: p.y, w: p.width, h: p.height })
        }
      />

      {showSilhouette ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${fp.cols} ${fp.rows}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {fp.cells.map((c) => (
            <rect
              key={c.roomId}
              x={c.gx - fp.minGx}
              y={c.gy - fp.minGy}
              width={1}
              height={1}
              fill="currentColor"
              fillOpacity={0.16}
            />
          ))}
          <path
            d={outline}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeOpacity={0.85}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-accent/55 bg-accent/[0.08]" />
      )}

      {/* Cross-zone connection anchors — invisible, just edge endpoints. */}
      {anchors.map((a) => (
        <Handle
          key={a.id}
          id={a.id}
          type="source"
          position={a.position}
          isConnectable={false}
          style={{
            left: `${a.nx * 100}%`,
            top: `${a.ny * 100}%`,
            right: "auto",
            bottom: "auto",
            transform: "translate(-50%, -50%)",
            width: 1,
            height: 1,
            minWidth: 0,
            minHeight: 0,
            border: "none",
            background: "transparent",
            opacity: 0,
          }}
        />
      ))}

      <div className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 select-none whitespace-nowrap rounded bg-bg-abyss/80 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-wider text-accent backdrop-blur-[1px]">
        {data.name}
      </div>

      {selected && (
        <button
          type="button"
          className="nodrag nopan absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-status-error/60 bg-bg-abyss text-[11px] leading-none text-status-error transition-colors hover:bg-status-error/20"
          title="Remove from map"
          onClick={(e) => {
            e.stopPropagation();
            data.onRemove(data.zoneId);
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const nodeTypes = { zonePlacement: ZonePlacementNode };

// ─── Backdrop synced to the ReactFlow viewport ──────────────────────

function MapBackdrop({
  src,
  width,
  height,
  vp,
}: {
  src: string | null;
  width: number;
  height: number;
  vp: Viewport;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            transformOrigin: "0 0",
            transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
            maxWidth: "none",
          }}
        />
      )}
    </div>
  );
}

// ─── Main view ──────────────────────────────────────────────────────

function WorldOverlay() {
  const zones = useZoneStore((s) => s.zones);
  const maps = useLoreStore(selectMaps);
  const openTab = useProjectStore((s) => s.openTab);
  const projectPath = useProjectStore((s) => s.project?.mudDir ?? "");

  const saved = useMemo(() => loadWorldOverlay(projectPath), [projectPath]);

  const [selectedMapId, setSelectedMapId] = useState<string>(
    () => saved.selectedMapId ?? maps[0]?.id ?? "",
  );
  const [placementsByMap, setPlacementsByMap] = useState<
    Record<string, Record<string, OverlayPlacement>>
  >(() => saved.placements);

  // Keep a valid selected map as the lore map list changes.
  useEffect(() => {
    if (maps.length === 0) return;
    if (!maps.some((m) => m.id === selectedMapId)) {
      setSelectedMapId(maps[0]!.id);
    }
  }, [maps, selectedMapId]);

  const selectedMap = maps.find((m) => m.id === selectedMapId) ?? null;
  const mapW = Math.max(1, selectedMap?.width || 1024);
  const mapH = Math.max(1, selectedMap?.height || 1024);
  const mapSrc = useImageSrc(selectedMap?.imageAsset);

  const placements = useMemo(
    () => placementsByMap[selectedMapId] ?? {},
    [placementsByMap, selectedMapId],
  );

  // Stable persistence callbacks — read the live map id via ref.
  const mapIdRef = useRef(selectedMapId);
  mapIdRef.current = selectedMapId;

  const place = useCallback(
    (zoneId: string, rect: OverlayPlacement) => {
      const mid = mapIdRef.current;
      setPlacementsByMap((prev) => ({
        ...prev,
        [mid]: { ...(prev[mid] ?? {}), [zoneId]: rect },
      }));
      saveOverlayPlacement(projectPath, mid, zoneId, rect);
    },
    [projectPath],
  );

  const unplace = useCallback(
    (zoneId: string) => {
      const mid = mapIdRef.current;
      setPlacementsByMap((prev) => {
        const forMap = { ...(prev[mid] ?? {}) };
        delete forMap[zoneId];
        return { ...prev, [mid]: forMap };
      });
      removeOverlayPlacement(projectPath, mid, zoneId);
    },
    [projectPath],
  );

  const resetMap = useCallback(() => {
    const mid = mapIdRef.current;
    setPlacementsByMap((prev) => {
      const next = { ...prev };
      delete next[mid];
      return next;
    });
    clearOverlayPlacements(projectPath, mid);
  }, [projectPath]);

  const openZone = useCallback(
    (zoneId: string) => {
      openTab({ id: `zone:${zoneId}`, kind: "zone", label: zoneId });
    },
    [openTab],
  );

  // ── Per-zone geometry (footprint + connector anchors) ─────────────
  const zoneMeta = useMemo(() => {
    const out = new Map<string, ZoneMeta>();
    for (const [zoneId, state] of zones.entries()) {
      const world = state.data;
      const footprint = computeZoneFootprint(world);
      out.set(zoneId, {
        zoneId,
        name: world.zone || zoneId,
        footprint,
        anchors: buildAnchors(world, footprint),
      });
    }
    return out;
  }, [zones]);

  // ── Desired nodes / edges ─────────────────────────────────────────
  const desiredNodes = useMemo<Node[]>(() => {
    const list: Node[] = [];
    for (const meta of zoneMeta.values()) {
      const pl = placements[meta.zoneId];
      if (!pl) continue;
      list.push({
        id: `z:${meta.zoneId}`,
        type: "zonePlacement",
        position: { x: pl.x, y: pl.y },
        width: pl.w,
        height: pl.h,
        style: { width: pl.w, height: pl.h },
        zIndex: 3,
        data: {
          zoneId: meta.zoneId,
          name: meta.name,
          footprint: meta.footprint,
          anchors: meta.anchors,
          onRemove: unplace,
          onResizeEnd: place,
        } satisfies ZonePlacementData,
      });
    }
    return list;
  }, [zoneMeta, placements, unplace, place]);

  const desiredEdges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    const seen = new Set<string>();
    for (const meta of zoneMeta.values()) {
      if (!placements[meta.zoneId]) continue;
      for (const a of meta.anchors) {
        if (!placements[a.toZone]) continue;
        const left = `${meta.zoneId}:${a.roomId}`;
        const right = `${a.toZone}:${a.toRoom}`;
        const key = left < right ? `${left}|${right}` : `${right}|${left}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const back = zoneMeta
          .get(a.toZone)
          ?.anchors.find((t) => t.toZone === meta.zoneId && t.toRoom === a.roomId);
        list.push({
          id: `xz:${key}`,
          source: `z:${meta.zoneId}`,
          sourceHandle: a.id,
          target: `z:${a.toZone}`,
          targetHandle: back?.id,
          type: "default",
          zIndex: 1,
          selectable: false,
          style: { stroke: "var(--color-graph-cross)", strokeWidth: 2 },
        });
      }
    }
    return list;
  }, [zoneMeta, placements]);

  const [nodes, setNodes, onNodesChange] = useNodesState(desiredNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(desiredEdges);

  // Reconcile: add/remove nodes by id, but keep live position/size/selection
  // of survivors so dragging and resizing aren't interrupted mid-gesture.
  useEffect(() => {
    setNodes((cur) => {
      const byId = new Map(cur.map((n) => [n.id, n]));
      return desiredNodes.map((n) => {
        const ex = byId.get(n.id);
        if (!ex) return n;
        return {
          ...n,
          position: ex.position,
          width: ex.width ?? n.width,
          height: ex.height ?? n.height,
          style: ex.style ?? n.style,
          selected: ex.selected,
        };
      });
    });
  }, [desiredNodes, setNodes]);

  useEffect(() => {
    setEdges(desiredEdges);
  }, [desiredEdges, setEdges]);

  // ── Viewport / backdrop sync ──────────────────────────────────────
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, zoom: 0.5 });

  const fitMap = useCallback(() => {
    const el = wrapperRef.current;
    const rf = rfRef.current;
    if (!el || !rf) return;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const zoom = Math.max(0.05, Math.min(width / mapW, height / mapH) * 0.92);
    const next = {
      x: (width - mapW * zoom) / 2,
      y: (height - mapH * zoom) / 2,
      zoom,
    };
    rf.setViewport(next);
    setVp(next);
  }, [mapW, mapH]);

  // Refit whenever the selected map changes.
  useEffect(() => {
    fitMap();
  }, [selectedMapId, fitMap]);

  const handleSelectMap = useCallback(
    (id: string) => {
      setSelectedMapId(id);
      saveOverlaySelectedMap(projectPath, id);
    },
    [projectPath],
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_e, node) => {
      if (node.type !== "zonePlacement") return;
      const zoneId = (node.data as ZonePlacementData).zoneId;
      const w = node.width ?? node.measured?.width ?? placements[zoneId]?.w ?? 160;
      const h = node.height ?? node.measured?.height ?? placements[zoneId]?.h ?? 120;
      place(zoneId, { x: node.position.x, y: node.position.y, w, h });
    },
    [place, placements],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      if (node.type === "zonePlacement") openZone((node.data as ZonePlacementData).zoneId);
    },
    [openZone],
  );

  // ── Drag a zone from the tray onto the map ────────────────────────
  const placeAtFlowPoint = useCallback(
    (zoneId: string, clientX: number, clientY: number) => {
      const rf = rfRef.current;
      const meta = zoneMeta.get(zoneId);
      if (!rf || !meta) return;
      const pt = rf.screenToFlowPosition({ x: clientX, y: clientY });
      place(zoneId, defaultRect(meta.footprint, mapW, mapH, pt.x, pt.y));
    },
    [zoneMeta, place, mapW, mapH],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const zoneId = e.dataTransfer.getData("application/arcanum-zone");
      if (zoneId) placeAtFlowPoint(zoneId, e.clientX, e.clientY);
    },
    [placeAtFlowPoint],
  );

  const placeAtCenter = useCallback(
    (zoneId: string) => {
      const el = wrapperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      placeAtFlowPoint(zoneId, r.left + r.width / 2, r.top + r.height / 2);
    },
    [placeAtFlowPoint],
  );

  // ── Tray contents ─────────────────────────────────────────────────
  const trayZones = useMemo(
    () =>
      Array.from(zoneMeta.values())
        .filter((m) => !placements[m.zoneId])
        .sort((a, b) => a.name.localeCompare(b.name)),
    [zoneMeta, placements],
  );

  const placedCount = Object.keys(placements).length;

  if (maps.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-text-muted">
        <div className="max-w-sm text-center">
          <h2 className="font-display text-lg uppercase tracking-widest text-accent">
            No World Map
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            The map overlay needs a base map. Upload or generate one under{" "}
            <span className="text-accent">Lore → Maps</span>, then come back to drape your
            zones over it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <div
        ref={wrapperRef}
        className="relative min-h-0 min-w-0 flex-1"
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
      >
        <MapBackdrop src={mapSrc} width={mapW} height={mapH} vp={vp} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onInit={(inst) => {
            rfRef.current = inst;
            fitMap();
          }}
          onMove={(_, viewport) => setVp(viewport)}
          minZoom={0.05}
          maxZoom={4}
          // Connectors anchor an edge target onto a source-type handle on the
          // neighbouring zone; loose mode lets that resolve.
          connectionMode={ConnectionMode.Loose}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          proOptions={{ hideAttribution: true }}
          style={{ background: "transparent" }}
        >
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* Toolbar */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 text-2xs">
          <select
            value={selectedMapId}
            onChange={(e) => handleSelectMap(e.target.value)}
            className="ornate-input pointer-events-auto rounded-full px-3 py-1 font-display text-2xs uppercase tracking-wider text-accent"
            title="Base map"
          >
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title || m.id}
              </option>
            ))}
          </select>
          <OverlayStat label="placed" value={`${placedCount}/${zoneMeta.size}`} />
          <OverlayStat label="links" value={edges.length} />
          <button
            type="button"
            onClick={fitMap}
            className="pointer-events-auto rounded-full border border-border-muted bg-bg-abyss/80 px-2.5 py-1 uppercase tracking-wider text-text-muted backdrop-blur transition-colors hover:border-accent/40 hover:text-accent"
            title="Re-center the map in view"
          >
            Fit Map
          </button>
          {placedCount > 0 && (
            <button
              type="button"
              onClick={resetMap}
              className="pointer-events-auto rounded-full border border-border-muted bg-bg-abyss/80 px-2.5 py-1 uppercase tracking-wider text-text-muted backdrop-blur transition-colors hover:border-accent/40 hover:text-accent"
              title="Return every zone on this map to the tray"
            >
              Clear Placements
            </button>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-md rounded-lg border border-border-muted bg-bg-abyss/85 px-3 py-2 text-2xs italic text-text-muted backdrop-blur">
          Drag a zone from the tray onto the map, then drag to move and pull the handles to
          stretch it into place. Lines mark cross-zone connections — line up the endpoints
          where zones meet. Double-click a zone to open it.
        </div>
      </div>

      {/* Tray of unplaced zones */}
      <aside className="flex w-60 flex-none flex-col border-l border-border-muted bg-bg-abyss/40 backdrop-blur">
        <div className="border-b border-border-muted px-3 py-2">
          <div className="font-display text-2xs uppercase tracking-[0.24em] text-accent">
            Unplaced Zones
          </div>
          <div className="mt-0.5 text-3xs uppercase tracking-wider text-text-muted">
            {trayZones.length} {trayZones.length === 1 ? "zone" : "zones"} · drag onto map
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {trayZones.length === 0 ? (
            <p className="rounded border border-dashed border-border-muted px-3 py-6 text-center text-3xs italic text-text-muted">
              Every loaded zone is on the map.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {trayZones.map((m) => (
                <li key={m.zoneId}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/arcanum-zone", m.zoneId);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDoubleClick={() => placeAtCenter(m.zoneId)}
                    className="group flex cursor-grab items-center gap-2 rounded border border-border-muted bg-[var(--chrome-fill-soft)] px-2.5 py-2 transition-colors hover:border-accent/40 hover:bg-[var(--chrome-highlight)] active:cursor-grabbing"
                    title="Drag onto the map (or double-click to drop at center)"
                  >
                    <TrayThumb footprint={m.footprint} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-2xs uppercase tracking-wider text-accent">
                        {m.name}
                      </div>
                      <div className="mt-0.5 text-3xs text-text-muted">
                        {m.footprint.cells.length}{" "}
                        {m.footprint.cells.length === 1 ? "room" : "rooms"}
                        {m.anchors.length > 0 && (
                          <span className="ml-1.5 text-text-secondary">
                            · {m.anchors.length} link{m.anchors.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function TrayThumb({ footprint: fp }: { footprint: ZoneFootprint }) {
  if (fp.chaotic || fp.cells.length === 0) {
    return (
      <div className="h-7 w-7 flex-none rounded border border-dashed border-accent/45 bg-accent/[0.08]" />
    );
  }
  const outline = buildOutline(fp);
  return (
    <svg
      className="h-7 w-7 flex-none text-accent"
      viewBox={`-0.5 -0.5 ${fp.cols + 1} ${fp.rows + 1}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {fp.cells.map((c) => (
        <rect
          key={c.roomId}
          x={c.gx - fp.minGx}
          y={c.gy - fp.minGy}
          width={1}
          height={1}
          fill="currentColor"
          fillOpacity={0.18}
        />
      ))}
      <path
        d={outline}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.16}
        strokeOpacity={0.85}
      />
    </svg>
  );
}

function OverlayStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-full border border-border-muted bg-bg-abyss/80 px-2.5 py-1 text-text-secondary backdrop-blur">
      <span className="uppercase tracking-wider text-text-muted">{label}</span>
      <span className="ml-1.5 font-mono text-text-primary">{value}</span>
    </div>
  );
}

export function WorldOverlayView() {
  return (
    <ReactFlowProvider>
      <WorldOverlay />
    </ReactFlowProvider>
  );
}
