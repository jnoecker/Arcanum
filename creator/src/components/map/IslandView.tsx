import { useState, useCallback, useRef, lazy, Suspense, useMemo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { ISLANDS, type IslandAction } from "@/lib/islandRegistry";
import {
  PANEL_MAP,
  panelTab,
  type Island,
} from "@/lib/panelRegistry";
import { DialogShell } from "@/components/ui/FormWidgets";
import { useFocusTrap } from "@/lib/useFocusTrap";

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
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [showNewZone, setShowNewZone] = useState(false);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const openZoneTab = useCallback(
    (zoneId: string) => {
      openTab({ id: `zone:${zoneId}`, kind: "zone", label: zoneId });
    },
    [openTab],
  );

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

  const handleAction = useCallback(
    (action: IslandAction) => {
      if (action.kind === "newZone") {
        setShowNewZone(true);
        return;
      }
      if (action.kind === "openSettings") {
        setSettingsOpen(true);
        return;
      }
      if (action.kind === "openZoneView") {
        const zones = useZoneStore.getState().zones;
        if (zones.size === 0) {
          setShowNewZone(true);
          return;
        }
        if (zones.size === 1) {
          const zoneId = zones.keys().next().value;
          if (zoneId) openZoneTab(zoneId);
          return;
        }
        setShowZonePicker(true);
      }
    },
    [openZoneTab, setSettingsOpen],
  );

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

        {/* Island-level actions (e.g. Forge's "+ New Zone" / "Open Zone") */}
        {!calibrating &&
          def.actions?.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAction(action)}
              className="focus-ring absolute flex items-end justify-center rounded-2xl pb-1 transition-all duration-200 hover:bg-accent/10"
              style={{
                left: `${action.hotspot.x}%`,
                top: `${action.hotspot.y}%`,
                width: `${action.hotspot.w}%`,
                height: `${action.hotspot.h}%`,
              }}
              aria-label={action.label}
            >
              <span className="rounded-md bg-bg-abyss/70 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wide-ui text-accent drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                {action.label}
              </span>
            </button>
          ))}

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
      {showZonePicker && (
        <ZonePickerDialog
          onClose={() => setShowZonePicker(false)}
          onSelect={(zoneId) => {
            setShowZonePicker(false);
            openZoneTab(zoneId);
          }}
          onOpenAtlas={() => {
            setShowZonePicker(false);
            openTab({ id: "zoneAtlas", kind: "zoneAtlas", label: "World Atlas" });
          }}
          onCreateNew={() => {
            setShowZonePicker(false);
            setShowNewZone(true);
          }}
        />
      )}
    </div>
  );
}

// ─── Zone picker dialog ───────────────────────────────────────────

function ZonePickerDialog({
  onClose,
  onSelect,
  onOpenAtlas,
  onCreateNew,
}: {
  onClose: () => void;
  onSelect: (zoneId: string) => void;
  onOpenAtlas: () => void;
  onCreateNew: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const zones = useZoneStore((s) => s.zones);
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.from(zones.entries()).map(([id, state]) => ({
      id,
      name: state.data.zone || id,
      rooms: Object.keys(state.data.rooms ?? {}).length,
    }));
    const filtered = !q
      ? list
      : list.filter(
          (z) =>
            z.id.toLowerCase().includes(q) || z.name.toLowerCase().includes(q),
        );
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [zones, query]);

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="zone-picker-title"
      title="Open Zone"
      subtitle="Pick a zone to open the map view."
      widthClassName="max-w-md"
      onClose={onClose}
    >
      <button
        type="button"
        onClick={onOpenAtlas}
        className="mb-3 flex w-full items-center gap-3 rounded border border-accent/40 bg-gradient-active-strong px-3 py-2 text-left transition-colors hover:bg-accent/15"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 text-accent"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm uppercase tracking-widest text-accent">
            World Atlas
          </div>
          <div className="mt-0.5 text-2xs text-text-muted">
            All zones at once — click any room to jump in.
          </div>
        </div>
        <span className="text-text-muted">→</span>
      </button>
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search zones..."
        className="ornate-input mb-3 w-full px-3 py-2 text-sm text-text-primary"
      />
      <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
        {entries.length === 0 && (
          <p className="rounded border border-dashed border-border-muted px-3 py-6 text-center text-2xs italic text-text-muted">
            No zones match.
          </p>
        )}
        {entries.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => onSelect(z.id)}
            className="flex items-center gap-3 rounded border border-border-muted bg-[var(--chrome-fill-soft)] px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-[var(--chrome-highlight)]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm uppercase tracking-widest text-accent">
                {z.name}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-2xs text-text-muted">
                <span className="font-mono">{z.id}</span>
                <span>·</span>
                <span>
                  {z.rooms} {z.rooms === 1 ? "room" : "rooms"}
                </span>
              </div>
            </div>
            <span className="text-text-muted transition-colors group-hover:text-accent">→</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onCreateNew}
          className="mt-1 flex items-center gap-2 rounded border border-dashed border-border-muted px-3 py-2 text-left text-xs text-accent transition-colors hover:border-accent/40 hover:bg-[var(--chrome-highlight)]"
        >
          <span className="font-mono">+</span>
          <span>Create new zone…</span>
        </button>
      </div>
    </DialogShell>
  );
}
