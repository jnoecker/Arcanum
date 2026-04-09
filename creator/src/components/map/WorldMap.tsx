import { useState, useCallback, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import {
  MAIN_VIEW_HOTSPOTS,
  MAIN_VIEW_IMAGE,
  ISLANDS,
} from "@/lib/islandRegistry";
import type { Island } from "@/lib/panelRegistry";

/**
 * Top-level map: renders mainview.jpg full-bleed with one clickable
 * hotspot per island. Hovering dims the others and surfaces an ornate
 * title/tagline card. Clicking drills into the island detail view.
 *
 * Hold Alt for calibration mode (crosshairs + click logging).
 */
export function WorldMap() {
  const openIsland = useProjectStore((s) => s.openIsland);
  const [hovered, setHovered] = useState<Island | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback((id: Island) => setHovered(id), []);
  const handleLeave = useCallback(() => setHovered(null), []);

  const hoveredDef = hovered ? ISLANDS[hovered] : null;

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
        console.log(`[mainview] click: x=${pos.x}, y=${pos.y}`);
      }
    },
    [getPercent],
  );

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
      <div
        ref={containerRef}
        className="relative h-full aspect-square max-w-full"
        role="navigation"
        aria-label="Arcanum world map"
        onMouseMove={handleMouseMove}
        onClick={handleCalibrationClick}
      >
        {/* Background image */}
        <img
          src={MAIN_VIEW_IMAGE}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.6)] transition-[filter] duration-300"
          style={{
            filter: hovered && !calibrating ? "brightness(0.55) saturate(0.85)" : "brightness(1)",
          }}
        />

        {/* Per-island hotspots */}
        {!calibrating &&
          MAIN_VIEW_HOTSPOTS.map((hs) => {
            const def = ISLANDS[hs.id];
            if (!def) return null;
            const isHovered = hovered === hs.id;
            return (
              <button
                key={hs.id}
                type="button"
                onMouseEnter={() => handleEnter(hs.id)}
                onMouseLeave={handleLeave}
                onFocus={() => handleEnter(hs.id)}
                onBlur={handleLeave}
                onClick={() => openIsland(hs.id)}
                aria-label={`${def.title} — ${def.tagline}`}
                className="focus-ring absolute rounded-2xl transition-all duration-300"
                style={{
                  left: `${hs.x}%`,
                  top: `${hs.y}%`,
                  width: `${hs.w}%`,
                  height: `${hs.h}%`,
                  filter: isHovered
                    ? "brightness(1.15)"
                    : "brightness(1)",
                  transform: isHovered ? "scale(1.04)" : "scale(1)",
                }}
              >
              </button>
            );
          })}

        {/* Floating title card */}
        {!calibrating && (
          <div
            className={`pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 select-none rounded-2xl border border-accent/40 bg-bg-abyss/85 px-6 py-3 text-center shadow-[0_10px_48px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-all duration-300 ${
              hoveredDef ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            <div className="text-3xs uppercase tracking-[0.28em] text-text-muted">
              {hoveredDef ? "Arcanum" : ""}
            </div>
            <div className="mt-1 font-display text-2xl text-accent">
              {hoveredDef?.title ?? ""}
            </div>
            <div className="mt-1 text-sm italic text-text-secondary">
              {hoveredDef?.tagline ?? ""}
            </div>
          </div>
        )}

        {/* Idle helper text */}
        {!calibrating && (
          <div
            className={`pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 select-none text-center font-display text-xs uppercase tracking-[0.24em] text-text-muted transition-opacity duration-300 ${
              hovered ? "opacity-0" : "opacity-70"
            }`}
          >
            Choose a realm to enter
          </div>
        )}

        {/* ── Calibration overlay (Alt mode) ─────────────────────── */}
        {calibrating && mousePos && (
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
              className="pointer-events-none absolute z-50 rounded bg-black/80 px-2 py-1 font-mono text-xs text-white"
              style={{ left: `${mousePos.x + 1}%`, top: `${mousePos.y + 1}%` }}
            >
              x: {mousePos.x}%, y: {mousePos.y}%
            </div>
          </>
        )}

        {clicks.length > 0 && (
          <div className="absolute bottom-2 right-2 z-50 max-h-48 overflow-y-auto rounded-lg bg-black/90 p-2 font-mono text-[10px] text-green-400">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-white/60">mainview clicks</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setClicks([]);
                }}
                className="text-red-400 hover:text-red-300"
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
      </div>
    </div>
  );
}
