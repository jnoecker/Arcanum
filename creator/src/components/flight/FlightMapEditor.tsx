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

interface Roost {
  /** Stable composite key, `${zoneId}/${roomId}`. */
  key: string;
  zoneId: string;
  roomId: string;
  title: string;
  /** Present only when the roost is pinned to the map. */
  x?: number;
  y?: number;
}

function clampPct(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

export function FlightMapEditor() {
  const zones = useZoneStore((s) => s.zones);
  const updateZone = useZoneStore((s) => s.updateZone);
  const config = useConfigStore((s) => s.config);
  const showToast = useToastStore((s) => s.show);
  const openPanel = useProjectStore((s) => s.openTab);

  const mapSrc = useImageSrc(config?.globalAssets?.["flight_map"]);
  const roostSrc = useImageSrc(config?.globalAssets?.["flight_roost"]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [placingKey, setPlacingKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  // Match the canvas box to the map's natural aspect ratio so left/top
  // percentages map 1:1 to the image the player sees — no crop, no letterbox.
  const [mapAspect, setMapAspect] = useState<number | null>(null);

  // Every flight-master room across all loaded zones.
  const roosts = useMemo<Roost[]>(() => {
    const out: Roost[] = [];
    for (const [zoneId, state] of zones) {
      for (const [roomId, room] of Object.entries(state.data.rooms ?? {})) {
        if (!room.flightMaster) continue;
        const pinned = room.flightMapX != null && room.flightMapY != null;
        out.push({
          key: `${zoneId}/${roomId}`,
          zoneId,
          roomId,
          title: room.title?.trim() || roomId,
          x: pinned ? room.flightMapX : undefined,
          y: pinned ? room.flightMapY : undefined,
        });
      }
    }
    out.sort((a, b) =>
      a.zoneId !== b.zoneId
        ? a.zoneId.localeCompare(b.zoneId)
        : a.title.localeCompare(b.title),
    );
    return out;
  }, [zones]);

  const pinned = useMemo(() => roosts.filter((r) => r.x != null), [roosts]);
  const unmapped = useMemo(() => roosts.filter((r) => r.x == null), [roosts]);
  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const [, state] of zones) if (state.dirty) n += 1;
    return n;
  }, [zones]);

  const selected = useMemo(
    () => roosts.find((r) => r.key === selectedKey) ?? null,
    [roosts, selectedKey],
  );

  const writeCoords = useCallback(
    (roost: Roost, x: number | undefined, y: number | undefined) => {
      const state = useZoneStore.getState().zones.get(roost.zoneId);
      if (!state) return;
      updateZone(
        roost.zoneId,
        updateRoom(state.data, roost.roomId, { flightMapX: x, flightMapY: y }),
      );
    },
    [updateZone],
  );

  const placeAt = useCallback(
    (roost: Roost, xPct: number, yPct: number) => {
      writeCoords(roost, clampPct(xPct), clampPct(yPct));
    },
    [writeCoords],
  );

  const unpin = useCallback(
    (roost: Roost) => {
      writeCoords(roost, undefined, undefined);
    },
    [writeCoords],
  );

  // ─── Canvas pointer interactions ──────────────────────────────────

  const pctFromEvent = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clampPct(((clientX - rect.left) / rect.width) * 100),
      y: clampPct(((clientY - rect.top) / rect.height) * 100),
    };
  }, []);

  const handleMarkerPointerDown = useCallback(
    (e: React.PointerEvent, roost: Roost) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setSelectedKey(roost.key);
      setDragging(roost.key);
      setDragPos(null);
    },
    [],
  );

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
      const roost = roosts.find((r) => r.key === dragging);
      if (roost) placeAt(roost, dragPos.x, dragPos.y);
    }
    setDragging(null);
    setDragPos(null);
  }, [dragging, dragPos, roosts, placeAt]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!placingKey) return;
      const roost = roosts.find((r) => r.key === placingKey);
      if (!roost) {
        setPlacingKey(null);
        return;
      }
      const pct = pctFromEvent(e.clientX, e.clientY);
      if (pct) {
        placeAt(roost, pct.x, pct.y);
        setSelectedKey(roost.key);
      }
      setPlacingKey(null);
    },
    [placingKey, roosts, pctFromEvent, placeAt],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await saveAllZones();
      showToast({
        variant: "astral",
        kicker: "Flight map saved",
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

  const beginPlacing = useCallback((roost: Roost) => {
    setSelectedKey(roost.key);
    setPlacingKey(roost.key);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 overflow-y-auto px-6 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl uppercase tracking-wide-ui text-aurum">
              Flight Map
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              Place each flight master on the painted map of Ambon. Players see a
              griffin hotspot at every pin. Roosts left unmapped still work — they
              appear in the kiosk&rsquo;s text list instead of on the map.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {dirtyCount > 0 && (
              <span className="text-2xs text-text-muted">
                {dirtyCount} unsaved zone{dirtyCount === 1 ? "" : "s"}
              </span>
            )}
            <ActionButton
              variant="primary"
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
            >
              {saving ? <Spinner className="h-4 w-4" /> : "Save"}
            </ActionButton>
          </div>
        </header>

        {roosts.length === 0 ? (
          <EmptyRoosts />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* ── Map canvas ─────────────────────────────────────── */}
            <section className="xl:col-span-8">
              {!config?.globalAssets?.["flight_map"] && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-2xs text-status-warn">
                  <span>
                    No <span className="font-mono">flight_map</span> art assigned yet.
                    Pins still save, but assign the map in Global Assets to position them visually.
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

                {placingKey && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-accent/80 px-3 py-1 text-center text-2xs font-semibold text-bg-primary">
                    Click the map to place this roost
                  </div>
                )}

                {pinned.map((roost) => {
                  const live =
                    dragging === roost.key && dragPos ? dragPos : { x: roost.x!, y: roost.y! };
                  return (
                    <RoostMarker
                      key={roost.key}
                      roost={roost}
                      x={live.x}
                      y={live.y}
                      iconSrc={roostSrc}
                      selected={roost.key === selectedKey}
                      dragging={dragging === roost.key}
                      onPointerDown={(e) => handleMarkerPointerDown(e, roost)}
                      onSelect={() => setSelectedKey(roost.key)}
                      onNudge={(dx, dy) =>
                        placeAt(roost, (roost.x ?? 50) + dx, (roost.y ?? 50) + dy)
                      }
                    />
                  );
                })}
              </div>
            </section>

            {/* ── Side panel ─────────────────────────────────────── */}
            <aside className="flex flex-col gap-4 xl:col-span-4">
              {selected && (
                <SelectedRoostCard
                  roost={selected}
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

              <RoostList
                title="Unmapped"
                emptyHint="Every flight master is on the map."
                roosts={unmapped}
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

              <RoostList
                title="On the map"
                emptyHint="No roosts placed yet."
                roosts={pinned}
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

interface RoostMarkerProps {
  roost: Roost;
  x: number;
  y: number;
  iconSrc: string | null;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onNudge: (dx: number, dy: number) => void;
}

function RoostMarker({
  roost,
  x,
  y,
  iconSrc,
  selected,
  dragging,
  onPointerDown,
  onSelect,
  onNudge,
}: RoostMarkerProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${roost.title} flight pin`}
      title={`${roost.title} — ${roost.zoneId}`}
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
        "focus-ring absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-shadow",
        dragging ? "z-30 cursor-grabbing" : "z-20 cursor-grab",
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

// ─── Selected roost detail ───────────────────────────────────────────

interface SelectedRoostCardProps {
  roost: Roost;
  onCommitX: (v: number | undefined) => void;
  onCommitY: (v: number | undefined) => void;
  onPlace: () => void;
  onUnpin: () => void;
}

function SelectedRoostCard({
  roost,
  onCommitX,
  onCommitY,
  onPlace,
  onUnpin,
}: SelectedRoostCardProps) {
  const isPinned = roost.x != null;
  return (
    <section className="panel-surface flex flex-col gap-3 rounded-2xl p-4 shadow-section">
      <div className="min-w-0">
        <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
          Selected roost
        </span>
        <h3 className="truncate font-display text-base font-semibold text-text-primary">
          {roost.title}
        </h3>
        <span className="font-mono text-2xs text-text-muted">
          {roost.zoneId} · {roost.roomId}
        </span>
      </div>

      {isPinned ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
                X (% across)
              </span>
              <NumberInput value={roost.x} onCommit={onCommitX} min={0} max={100} step={0.5} dense />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
                Y (% down)
              </span>
              <NumberInput value={roost.y} onCommit={onCommitY} min={0} max={100} step={0.5} dense />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xs text-text-muted">Drag the griffin or nudge with arrow keys.</p>
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
          <p className="text-2xs text-text-muted">This roost is unmapped.</p>
          <ActionButton variant="secondary" size="sm" onClick={onPlace}>
            Place on map
          </ActionButton>
        </div>
      )}
    </section>
  );
}

// ─── Roost list ──────────────────────────────────────────────────────

interface RoostListProps {
  title: string;
  emptyHint: string;
  roosts: Roost[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  action: (roost: Roost) => React.ReactNode;
}

function RoostList({ title, emptyHint, roosts, selectedKey, onSelect, action }: RoostListProps) {
  return (
    <section className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide-ui text-text-secondary">
          {title}
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">{roosts.length}</span>
      </div>
      {roosts.length === 0 ? (
        <p className="px-1 py-2 text-2xs italic text-text-muted/70">{emptyHint}</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {roosts.map((r) => (
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
                    {r.zoneId}
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

function EmptyRoosts() {
  return (
    <div className="panel-surface flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-12 text-center shadow-section">
      <p className="font-display text-sm text-text-primary">No flight masters yet</p>
      <p className="max-w-md text-2xs text-text-muted/80">
        Turn on the <span className="text-accent">Flight Master</span> role for a room in
        the Room panel, then come back here to place it on the map of Ambon.
      </p>
    </div>
  );
}
