import { useState, useCallback, useRef, lazy, Suspense } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { ISLANDS } from "@/lib/islandRegistry";
import {
  PANEL_MAP,
  panelTab,
  type Island,
} from "@/lib/panelRegistry";

const NewZoneDialog = lazy(() =>
  import("../NewZoneDialog").then((m) => ({ default: m.NewZoneDialog })),
);

interface IslandViewProps {
  island: Island;
}

/**
 * Detail view for a single island. Renders the island's background
 * image full-bleed, overlays each panel as a clickable hotspot, and
 * provides a back button to the world map.
 *
 * Hold Alt to enter calibration mode — shows live mouse % coordinates.
 * Alt+Click logs a coordinate to the floating list for copy-paste.
 */
export function IslandView({ island }: IslandViewProps) {
  const def = ISLANDS[island];
  const openTab = useProjectStore((s) => s.openTab);
  const openWorldMap = useProjectStore((s) => s.openWorldMap);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [showNewZone, setShowNewZone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Calibration mode (hold Alt) ───────────────────────────────
  const [calibrating, setCalibrating] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [clicks, setClicks] = useState<{ x: number; y: number }[]>([]);

  const getPercent = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    return { x, y };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!e.altKey) {
        if (calibrating) setCalibrating(false);
        return;
      }
      setCalibrating(true);
      setMousePos(getPercent(e));
    },
    [calibrating, getPercent],
  );

  const handleCalibrationClick = useCallback(
    (e: React.MouseEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = getPercent(e);
      if (pos) {
        setClicks((prev) => [...prev, pos]);
      }
    },
    [getPercent, island],
  );

  // ── Normal handlers ───────────────────────────────────────────

  const handleOpenPanel = useCallback(
    (panelId: string) => {
      const p = PANEL_MAP[panelId];
      if (!p) return;
      openTab(panelTab(panelId));
    },
    [openTab],
  );

  const handlePrimary = useCallback(() => {
    if (island === "forge") {
      setShowNewZone(true);
    }
  }, [island]);

  if (!def) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-text-muted">
        Unknown realm.
      </div>
    );
  }

  const hoveredPanel = hoveredPanelId ? PANEL_MAP[hoveredPanelId] : null;

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
      {/* Square container — all menu images are 1024x1024.
          h-full gives a concrete height; aspect-square derives width. */}
      <div
        ref={containerRef}
        className="relative h-full aspect-square max-w-full"
        onMouseMove={handleMouseMove}
        onClick={handleCalibrationClick}
      >
        {/* Background */}
        <img
          src={def.image}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.6)]"
        />

        {/* Title block (top center) */}
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 select-none rounded-2xl border border-accent/40 bg-bg-abyss/90 px-6 py-3 text-center shadow-[0_10px_48px_rgba(0,0,0,0.6)]">
          <div className="text-3xs uppercase tracking-[0.28em] text-text-muted">
            Realm
          </div>
          <div className="mt-1 font-display text-2xl text-accent">{def.title}</div>
          <div className="mt-1 text-sm italic text-text-secondary">{def.tagline}</div>
        </div>

        {/* Back button (top-left) */}
        <button
          type="button"
          onClick={openWorldMap}
          className="focus-ring group/back pointer-events-auto absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-accent/40 bg-bg-abyss/90 px-4 py-2 font-display text-xs uppercase tracking-wide-ui text-accent shadow-[0_8px_28px_rgba(0,0,0,0.55)] transition hover:border-accent hover:bg-accent/15"
          aria-label="Back to world map"
        >
          <span aria-hidden="true" className="transition group-hover/back:-translate-x-0.5">
            ←
          </span>
          World Map
        </button>

        {/* Panel hotspots */}
        {!calibrating &&
          def.hotspots.map((hs) => {
            const panel = PANEL_MAP[hs.panelId];
            if (!panel) return null;
            return (
              <button
                key={hs.panelId}
                type="button"
                onMouseEnter={() => setHoveredPanelId(hs.panelId)}
                onMouseLeave={() => setHoveredPanelId(null)}
                onFocus={() => setHoveredPanelId(hs.panelId)}
                onBlur={() => setHoveredPanelId(null)}
                onClick={() => handleOpenPanel(hs.panelId)}
                aria-label={`${panel.label} — ${panel.description}`}
                className="focus-ring absolute flex items-end justify-center rounded-2xl pb-1 transition-all duration-200 hover:bg-accent/10"
                style={{
                  left: `${hs.x}%`,
                  top: `${hs.y}%`,
                  width: `${hs.w}%`,
                  height: `${hs.h}%`,
                }}
              >
                <span className="rounded-md bg-bg-abyss/70 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wide-ui text-accent drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                  {panel.label}
                </span>
              </button>
            );
          })}

        {/* Primary action (e.g. Forge's "+ New Zone") */}
        {!calibrating && def.primaryAction && (
          <button
            type="button"
            onClick={handlePrimary}
            className="focus-ring absolute flex items-end justify-center rounded-2xl pb-1 transition-all duration-200 hover:bg-accent/10"
            style={{
              left: `${def.primaryAction.hotspot.x}%`,
              top: `${def.primaryAction.hotspot.y}%`,
              width: `${def.primaryAction.hotspot.w}%`,
              height: `${def.primaryAction.hotspot.h}%`,
            }}
            aria-label={def.primaryAction.label}
          >
            <span className="rounded-md bg-bg-abyss/70 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wide-ui text-accent drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              {def.primaryAction.label}
            </span>
          </button>
        )}

        {/* ── Calibration overlay (Alt mode) ─────────────────────── */}
        {calibrating && (
          <>
            {/* Crosshair at mouse */}
            {mousePos && (
              <>
                <div
                  className="pointer-events-none absolute z-50 border-l border-dashed border-white/50"
                  style={{ left: `${mousePos.x}%`, top: 0, height: "100%" }}
                />
                <div
                  className="pointer-events-none absolute z-50 border-t border-dashed border-white/50"
                  style={{ top: `${mousePos.y}%`, left: 0, width: "100%" }}
                />
                <div
                  className="pointer-events-none absolute z-50 rounded bg-bg-abyss/80 px-2 py-1 font-mono text-xs text-text-primary"
                  style={{ left: `${mousePos.x + 1}%`, top: `${mousePos.y + 1}%` }}
                >
                  x: {mousePos.x}%, y: {mousePos.y}%
                </div>
              </>
            )}
          </>
        )}

        {/* ── Click log (always visible if clicks exist) ─────────── */}
        {clicks.length > 0 && (
          <div className="absolute bottom-2 right-2 z-50 max-h-48 overflow-y-auto rounded-lg bg-bg-abyss/90 p-2 font-mono text-[10px] text-status-success">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-text-secondary">{island} clicks</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setClicks([]);
                }}
                className="text-status-error hover:text-status-error"
              >
                clear
              </button>
            </div>
            {clicks.map((c, i) => (
              <div key={i}>
                {i + 1}. x={c.x} y={c.y}
              </div>
            ))}
          </div>
        )}

        {/* Hover tooltip (bottom center) */}
        {!calibrating && (
          <div
            className={`pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 max-w-xl rounded-2xl border border-accent/40 bg-bg-abyss/90 px-5 py-3 text-center shadow-[0_10px_36px_rgba(0,0,0,0.6)] transition-all duration-200 ${
              hoveredPanel ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <div className="font-display text-sm text-accent">
              {hoveredPanel?.label ?? ""}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-text-secondary">
              {hoveredPanel?.description ?? ""}
            </div>
          </div>
        )}
      </div>

      <Suspense>
        {showNewZone && <NewZoneDialog onClose={() => setShowNewZone(false)} />}
      </Suspense>
    </div>
  );
}
