import { useCallback, useMemo, useRef, useState } from "react";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useToastStore } from "@/stores/toastStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { updateRoom } from "@/lib/zoneEdits";
import { saveAllZones } from "@/lib/saveZone";
import { panelTab } from "@/lib/panelRegistry";
import { useProjectStore } from "@/stores/projectStore";
import { ActionButton, NumberInput, Spinner, cx } from "@/components/ui/FormWidgets";

interface RouteRef {
  /** Composite destination key, `${zoneId}/${roomId}`. */
  toKey: string;
  price: number;
}

interface Dock {
  /** Stable composite key, `${zoneId}/${roomId}`. */
  key: string;
  zoneId: string;
  roomId: string;
  title: string;
  routes: RouteRef[];
  /** Present only when the dock is pinned to the map. */
  x?: number;
  y?: number;
}

function clampPct(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

/** Resolve a route's `to` (`room` local to the dock's zone, or `zone:room`)
 *  into a `${zoneId}/${roomId}` composite key, matching the dock map keys. */
function resolveRouteKey(to: string, dockZoneId: string): string {
  const trimmed = to.trim();
  if (!trimmed) return "";
  if (trimmed.includes(":")) {
    const [zone, room] = trimmed.split(":", 2);
    return `${zone}/${room}`;
  }
  return `${dockZoneId}/${trimmed}`;
}

export function BoatMapEditor() {
  const zones = useZoneStore((s) => s.zones);
  const updateZone = useZoneStore((s) => s.updateZone);
  const config = useConfigStore((s) => s.config);
  const showToast = useToastStore((s) => s.show);
  const openPanel = useProjectStore((s) => s.openTab);

  // Boats share the flight map by default; fall back to it when no dedicated
  // boat_map is assigned, mirroring the server's default.
  const boatMapAsset = config?.globalAssets?.["boat_map"];
  const flightMapAsset = config?.globalAssets?.["flight_map"];
  const mapAsset = boatMapAsset ?? flightMapAsset;
  const mapSrc = useImageSrc(mapAsset);
  const dockSrc = useImageSrc(config?.globalAssets?.["boat_dock"]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [placingKey, setPlacingKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapAspect, setMapAspect] = useState<number | null>(null);

  // Every boat-dock room across all loaded zones.
  const docks = useMemo<Dock[]>(() => {
    const out: Dock[] = [];
    for (const [zoneId, state] of zones) {
      for (const [roomId, room] of Object.entries(state.data.rooms ?? {})) {
        if (!room.boatDock) continue;
        const pinned = room.boatMapX != null && room.boatMapY != null;
        out.push({
          key: `${zoneId}/${roomId}`,
          zoneId,
          roomId,
          title: room.title?.trim() || roomId,
          routes: (room.boatRoutes ?? [])
            .map((r) => ({ toKey: resolveRouteKey(r.to, zoneId), price: r.price }))
            .filter((r) => r.toKey),
          x: pinned ? room.boatMapX : undefined,
          y: pinned ? room.boatMapY : undefined,
        });
      }
    }
    out.sort((a, b) =>
      a.zoneId !== b.zoneId ? a.zoneId.localeCompare(b.zoneId) : a.title.localeCompare(b.title),
    );
    return out;
  }, [zones]);

  const pinned = useMemo(() => docks.filter((r) => r.x != null), [docks]);
  const unmapped = useMemo(() => docks.filter((r) => r.x == null), [docks]);
  const dockByKey = useMemo(() => new Map(docks.map((d) => [d.key, d])), [docks]);

  // Route arcs: only drawn when both endpoints are pinned.
  const arcs = useMemo(() => {
    const out: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const dock of pinned) {
      const live = dragging === dock.key && dragPos ? dragPos : { x: dock.x!, y: dock.y! };
      for (const route of dock.routes) {
        const dest = dockByKey.get(route.toKey);
        if (!dest || dest.x == null || dest.y == null) continue;
        const destLive =
          dragging === dest.key && dragPos ? dragPos : { x: dest.x, y: dest.y };
        out.push({
          id: `${dock.key}->${route.toKey}`,
          x1: live.x,
          y1: live.y,
          x2: destLive.x,
          y2: destLive.y,
        });
      }
    }
    return out;
  }, [pinned, dockByKey, dragging, dragPos]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const [, state] of zones) if (state.dirty) n += 1;
    return n;
  }, [zones]);

  const selected = useMemo(
    () => docks.find((r) => r.key === selectedKey) ?? null,
    [docks, selectedKey],
  );

  const writeCoords = useCallback(
    (dock: Dock, x: number | undefined, y: number | undefined) => {
      const state = useZoneStore.getState().zones.get(dock.zoneId);
      if (!state) return;
      updateZone(
        dock.zoneId,
        updateRoom(state.data, dock.roomId, { boatMapX: x, boatMapY: y }),
      );
    },
    [updateZone],
  );

  const placeAt = useCallback(
    (dock: Dock, xPct: number, yPct: number) => {
      writeCoords(dock, clampPct(xPct), clampPct(yPct));
    },
    [writeCoords],
  );

  const unpin = useCallback((dock: Dock) => writeCoords(dock, undefined, undefined), [writeCoords]);

  const pctFromEvent = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clampPct(((clientX - rect.left) / rect.width) * 100),
      y: clampPct(((clientY - rect.top) / rect.height) * 100),
    };
  }, []);

  const handleMarkerPointerDown = useCallback((e: React.PointerEvent, dock: Dock) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedKey(dock.key);
    setDragging(dock.key);
    setDragPos(null);
  }, []);

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const pct = pctFromEvent(e.clientX, e.clientY);
      if (pct) setDragPos(pct);
    },
    [dragging, pctFromEvent],
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (dragging && dragPos) {
      const dock = docks.find((r) => r.key === dragging);
      if (dock) placeAt(dock, dragPos.x, dragPos.y);
    }
    setDragging(null);
    setDragPos(null);
  }, [dragging, dragPos, docks, placeAt]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!placingKey) return;
      const dock = docks.find((r) => r.key === placingKey);
      if (!dock) {
        setPlacingKey(null);
        return;
      }
      const pct = pctFromEvent(e.clientX, e.clientY);
      if (pct) {
        placeAt(dock, pct.x, pct.y);
        setSelectedKey(dock.key);
      }
      setPlacingKey(null);
    },
    [placingKey, docks, pctFromEvent, placeAt],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await saveAllZones();
      showToast({
        variant: "astral",
        kicker: "Boat map saved",
        message: saved.length
          ? `Saved ${saved.length} zone${saved.length === 1 ? "" : "s"}.`
          : "Nothing to save.",
      });
    } catch (err) {
      showToast({
        variant: "ember",
        kicker: "Save failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  const beginPlacing = useCallback((dock: Dock) => {
    setSelectedKey(dock.key);
    setPlacingKey(dock.key);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 overflow-y-auto px-6 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl uppercase tracking-wide-ui text-aurum">Boat Map</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              Place each boat dock on the painted map of Ambon. Players see an anchor hotspot at
              every pin, and authored routes draw as lines between docks. Docks left unmapped still
              work — they appear in the kiosk&rsquo;s text list instead of on the map. Edit a
              dock&rsquo;s routes and fares in its Room panel.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {dirtyCount > 0 && (
              <span className="text-2xs text-text-muted">
                {dirtyCount} unsaved zone{dirtyCount === 1 ? "" : "s"}
              </span>
            )}
            <ActionButton variant="primary" onClick={handleSave} disabled={saving || dirtyCount === 0}>
              {saving ? <Spinner className="h-4 w-4" /> : "Save"}
            </ActionButton>
          </div>
        </header>

        {docks.length === 0 ? (
          <EmptyDocks />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* ── Map canvas ─────────────────────────────────────── */}
            <section className="xl:col-span-8">
              {!mapAsset && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-2xs text-status-warn">
                  <span>
                    No <span className="font-mono">boat_map</span> or{" "}
                    <span className="font-mono">flight_map</span> art assigned yet. Pins still save,
                    but assign a map in Global Assets to position them visually.
                  </span>
                  <button
                    type="button"
                    onClick={() => openPanel(panelTab("sharedAssets"))}
                    className="shrink-0 rounded border border-status-warn/50 px-2 py-0.5 font-display uppercase tracking-wide-ui transition hover:bg-status-warn/20"
                  >
                    Global Assets
                  </button>
                </div>
              )}
              {!boatMapAsset && flightMapAsset && (
                <p className="mb-3 text-2xs text-text-muted/80">
                  Showing the shared Flight Map. Assign a <span className="font-mono">boat_map</span>{" "}
                  asset to give boats their own map.
                </p>
              )}
              <div
                ref={containerRef}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onClick={handleCanvasClick}
                style={{ aspectRatio: String(mapAspect ?? 3 / 2) }}
                className={cx(
                  "relative w-full select-none overflow-hidden rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] shadow-section",
                  placingKey ? "cursor-crosshair" : "",
                )}
              >
                {mapSrc ? (
                  <img
                    src={mapSrc}
                    alt="Map of Ambon"
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        setMapAspect(img.naturalWidth / img.naturalHeight);
                      }
                    }}
                    className="pointer-events-none absolute inset-0 h-full w-full object-fill"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-40"
                    style={{
                      backgroundImage:
                        "linear-gradient(var(--chrome-stroke) 1px, transparent 1px), linear-gradient(90deg, var(--chrome-stroke) 1px, transparent 1px)",
                      backgroundSize: "5% 7.5%",
                    }}
                  />
                )}

                {arcs.length > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {arcs.map((arc) => (
                      <line
                        key={arc.id}
                        x1={arc.x1}
                        y1={arc.y1}
                        x2={arc.x2}
                        y2={arc.y2}
                        stroke="var(--color-accent)"
                        strokeWidth={0.3}
                        strokeOpacity={0.55}
                        strokeDasharray="1.2 0.8"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                )}

                {placingKey && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-accent/80 px-3 py-1 text-center text-2xs font-semibold text-bg-primary">
                    Click the map to place this dock
                  </div>
                )}

                {pinned.map((dock) => {
                  const live =
                    dragging === dock.key && dragPos ? dragPos : { x: dock.x!, y: dock.y! };
                  return (
                    <DockMarker
                      key={dock.key}
                      dock={dock}
                      x={live.x}
                      y={live.y}
                      iconSrc={dockSrc}
                      selected={dock.key === selectedKey}
                      dragging={dragging === dock.key}
                      onPointerDown={(e) => handleMarkerPointerDown(e, dock)}
                      onSelect={() => setSelectedKey(dock.key)}
                      onNudge={(dx, dy) => placeAt(dock, (dock.x ?? 50) + dx, (dock.y ?? 50) + dy)}
                    />
                  );
                })}
              </div>
            </section>

            {/* ── Side panel ─────────────────────────────────────── */}
            <aside className="flex flex-col gap-4 xl:col-span-4">
              {selected && (
                <SelectedDockCard
                  dock={selected}
                  dockByKey={dockByKey}
                  onCommitX={(v) =>
                    writeCoords(selected, v == null ? undefined : clampPct(v), selected.y ?? 50)
                  }
                  onCommitY={(v) =>
                    writeCoords(selected, selected.x ?? 50, v == null ? undefined : clampPct(v))
                  }
                  onPlace={() => beginPlacing(selected)}
                  onUnpin={() => unpin(selected)}
                />
              )}

              <DockList
                title="Unmapped"
                emptyHint="Every boat dock is on the map."
                docks={unmapped}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
                action={(r) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      beginPlacing(r);
                    }}
                    className="shrink-0 rounded border border-accent/40 bg-accent/10 px-2 py-0.5 font-display text-2xs uppercase tracking-wide-ui text-accent transition hover:bg-accent/20"
                  >
                    Place
                  </button>
                )}
              />

              <DockList
                title="On the map"
                emptyHint="No docks placed yet."
                docks={pinned}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
                action={(r) => (
                  <span className="shrink-0 font-mono text-2xs text-text-muted">
                    {r.x}, {r.y}
                  </span>
                )}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Marker ──────────────────────────────────────────────────────────

interface DockMarkerProps {
  dock: Dock;
  x: number;
  y: number;
  iconSrc: string | null;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onNudge: (dx: number, dy: number) => void;
}

function DockMarker({
  dock,
  x,
  y,
  iconSrc,
  selected,
  dragging,
  onPointerDown,
  onSelect,
  onNudge,
}: DockMarkerProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${dock.title} boat dock pin`}
      title={`${dock.title} — ${dock.zoneId}`}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 5 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        else if (e.key === "ArrowRight") dx = step;
        else if (e.key === "ArrowUp") dy = -step;
        else if (e.key === "ArrowDown") dy = step;
        else return;
        e.preventDefault();
        onSelect();
        onNudge(dx, dy);
      }}
      className={cx(
        "focus-ring absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-shadow",
        dragging ? "z-30 cursor-grabbing" : "cursor-grab",
      )}
      style={{ left: `${x}%`, top: `${y}%`, width: 36, height: 36 }}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          draggable={false}
          className={cx(
            "h-9 w-9 object-contain drop-shadow-[var(--glow-aurum-drop)] transition-transform",
            selected ? "scale-110" : "",
          )}
        />
      ) : (
        <span
          className={cx(
            "h-4 w-4 rotate-45 rounded-[3px] border shadow-glow transition-transform",
            selected
              ? "scale-125 border-accent bg-accent ring-2 ring-accent/40"
              : "border-accent/70 bg-accent/70",
          )}
        />
      )}
    </div>
  );
}

// ─── Selected dock detail ────────────────────────────────────────────

interface SelectedDockCardProps {
  dock: Dock;
  dockByKey: Map<string, Dock>;
  onCommitX: (v: number | undefined) => void;
  onCommitY: (v: number | undefined) => void;
  onPlace: () => void;
  onUnpin: () => void;
}

function SelectedDockCard({
  dock,
  dockByKey,
  onCommitX,
  onCommitY,
  onPlace,
  onUnpin,
}: SelectedDockCardProps) {
  const isPinned = dock.x != null;
  return (
    <section className="panel-surface flex flex-col gap-3 rounded-2xl p-4 shadow-section">
      <div className="min-w-0">
        <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
          Selected dock
        </span>
        <h3 className="truncate font-display text-base font-semibold text-text-primary">
          {dock.title}
        </h3>
        <span className="font-mono text-2xs text-text-muted">
          {dock.zoneId} · {dock.roomId}
        </span>
      </div>

      {isPinned ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
                X (% across)
              </span>
              <NumberInput value={dock.x} onCommit={onCommitX} min={0} max={100} step={0.5} dense />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
                Y (% down)
              </span>
              <NumberInput value={dock.y} onCommit={onCommitY} min={0} max={100} step={0.5} dense />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xs text-text-muted">Drag the anchor or nudge with arrow keys.</p>
            <button
              type="button"
              onClick={onUnpin}
              className="shrink-0 rounded border border-status-error/40 px-2 py-1 font-display text-2xs uppercase tracking-wide-ui text-status-error transition hover:bg-status-error/10"
            >
              Remove from map
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xs text-text-muted">This dock is unmapped.</p>
          <ActionButton variant="secondary" size="sm" onClick={onPlace}>
            Place on map
          </ActionButton>
        </div>
      )}

      <DockRoutes dock={dock} dockByKey={dockByKey} />
    </section>
  );
}

function DockRoutes({ dock, dockByKey }: { dock: Dock; dockByKey: Map<string, Dock> }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--chrome-stroke)] pt-3">
      <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
        Routes ({dock.routes.length})
      </span>
      {dock.routes.length === 0 ? (
        <p className="text-2xs italic text-text-muted/70">
          No routes. Add them in this room&rsquo;s Room panel.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {dock.routes.map((route, i) => {
            const dest = dockByKey.get(route.toKey);
            const unmapped = !dest || dest.x == null;
            return (
              <li
                key={`${route.toKey}-${i}`}
                className="flex items-center justify-between gap-2 text-2xs"
              >
                <span className="min-w-0 truncate text-text-secondary">
                  {dest ? dest.title : route.toKey}
                  {unmapped && <span className="ml-1 text-text-muted/60">(unmapped)</span>}
                </span>
                <span className="shrink-0 font-mono text-accent">{route.price}g</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Dock list ───────────────────────────────────────────────────────

interface DockListProps {
  title: string;
  emptyHint: string;
  docks: Dock[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  action: (dock: Dock) => React.ReactNode;
}

function DockList({ title, emptyHint, docks, selectedKey, onSelect, action }: DockListProps) {
  return (
    <section className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide-ui text-text-secondary">
          {title}
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">{docks.length}</span>
      </div>
      {docks.length === 0 ? (
        <p className="px-1 py-2 text-2xs italic text-text-muted/70">{emptyHint}</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {docks.map((r) => (
            <li key={r.key}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(r.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(r.key);
                  }
                }}
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition",
                  r.key === selectedKey
                    ? "selected-pill"
                    : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-display text-xs font-semibold text-text-primary">
                    {r.title}
                  </span>
                  <span className="truncate font-mono text-[0.6rem] text-text-muted/70">
                    {r.zoneId} · {r.routes.length} route{r.routes.length === 1 ? "" : "s"}
                  </span>
                </div>
                {action(r)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyDocks() {
  return (
    <div className="panel-surface flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-12 text-center shadow-section">
      <p className="font-display text-sm text-text-primary">No boat docks yet</p>
      <p className="max-w-md text-2xs text-text-muted/80">
        Turn on the <span className="text-accent">Boat Dock</span> role for a room in the Room panel,
        then come back here to place it on the map of Ambon.
      </p>
    </div>
  );
}
