import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ZonePlan, ZonePlanRegion } from "@/types/lore";
import { regionToLeafletBounds } from "@/lib/zoneRegionGeometry";

interface PlanningMap {
  width: number;
  height: number;
}

interface Props {
  map: PlanningMap;
  imageUrl: string;
  plans: ZonePlan[];
  selectedPlanId: string | null;
  hoveredPlanId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onUpdateRegion: (planId: string, region: ZonePlanRegion) => void;
  addMode: boolean;
  onAddRegion: (region: ZonePlanRegion) => void;
  onAddComplete: () => void;
  height?: string;
}

function makeHandleIcon(L: typeof import("leaflet"), corner: "nw" | "ne" | "sw" | "se") {
  const cursor = corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize";
  return L.divIcon({
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<div style="width:16px;height:16px;border-radius:3px;background:rgb(var(--aurum-rgb));border:2px solid rgb(var(--text-rgb) / 0.9);box-shadow:0 0 0 1px rgb(var(--bg-rgb) / 0.7);cursor:${cursor};"></div>`,
  });
}

function makeMoveIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="width:24px;height:24px;border-radius:50%;background:rgb(var(--aurum-rgb) / 0.9);border:2px solid rgb(var(--text-rgb) / 0.9);box-shadow:0 0 0 1px rgb(var(--bg-rgb) / 0.7);cursor:move;display:flex;align-items:center;justify-content:center;color:rgb(var(--bg-rgb));font-size:14px;line-height:1;font-weight:700;">✥</div>`,
  });
}

function clampRegion(r: ZonePlanRegion, mapW: number, mapH: number): ZonePlanRegion {
  const w = Math.max(8, Math.min(mapW, r.w));
  const h = Math.max(8, Math.min(mapH, r.h));
  const x = Math.max(0, Math.min(mapW - w, r.x));
  const y = Math.max(0, Math.min(mapH - h, r.y));
  return { x, y, w, h };
}

export function WorldPlannerMap({
  map,
  imageUrl,
  plans,
  selectedPlanId,
  hoveredPlanId,
  onSelect,
  onHover,
  onUpdateRegion,
  addMode,
  onAddRegion,
  onAddComplete,
  height = "70vh",
}: Props) {
  const [modules, setModules] = useState<{
    L: typeof import("leaflet");
    RL: typeof import("react-leaflet");
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!document.getElementById("leaflet-css")) {
        const cssModule = await import("leaflet/dist/leaflet.css?inline");
        const style = document.createElement("style");
        style.id = "leaflet-css";
        style.textContent = cssModule.default;
        document.head.appendChild(style);
      }
      const [L, RL] = await Promise.all([
        import("leaflet"),
        import("react-leaflet"),
      ]);
      if (!cancelled) setModules({ L: L.default ?? L, RL });
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const ACCENT = useMemo(() => {
    if (typeof window === "undefined") return { normal: "", selected: "", hover: "" };
    const s = getComputedStyle(document.documentElement);
    return {
      normal: s.getPropertyValue("--color-accent").trim(),
      selected: s.getPropertyValue("--color-warm-pale").trim(),
      hover: s.getPropertyValue("--color-warm").trim(),
    };
  }, []);

  if (!modules) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-text-primary/8 bg-bg-abyss/15 text-xs text-text-muted"
        style={{ height }}
      >
        Loading map...
      </div>
    );
  }

  const { L, RL } = modules;
  const bounds: import("leaflet").LatLngBoundsExpression = [
    [0, 0],
    [map.height, map.width],
  ];
  const moveIcon = makeMoveIcon(L);
  const cornerIcons = {
    nw: makeHandleIcon(L, "nw"),
    ne: makeHandleIcon(L, "ne"),
    sw: makeHandleIcon(L, "sw"),
    se: makeHandleIcon(L, "se"),
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-text-primary/10 bg-bg-abyss/30"
      style={{ height }}
    >
      {addMode && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-accent/90 px-3 py-1 text-2xs font-medium text-bg-primary shadow-panel">
          Click on the map to drop a new region
        </div>
      )}
      <RL.MapContainer
        crs={L.CRS.Simple}
        bounds={bounds}
        maxBounds={L.latLngBounds(
          L.latLng(-map.height * 0.1, -map.width * 0.1),
          L.latLng(map.height * 1.1, map.width * 1.1),
        )}
        style={{ width: "100%", height: "100%", background: "var(--color-graph-bg)" }}
        zoomSnap={0.25}
        minZoom={-3}
        maxZoom={4}
        attributionControl={false}
      >
        <RL.ImageOverlay url={imageUrl} bounds={bounds} />
        <MapInvalidator RL={RL} />
        <BoundsFitter RL={RL} mapW={map.width} mapH={map.height} />
        <ClickToAdd
          RL={RL}
          enabled={addMode}
          mapW={map.width}
          mapH={map.height}
          onAdd={(region) => {
            onAddRegion(region);
            onAddComplete();
          }}
        />

        {plans.map((plan) => {
          if (!plan.region) return null;
          if (plan.id === selectedPlanId) return null; // owned by EditableRegion below
          const b = regionToLeafletBounds(plan.region);
          const isHover = plan.id === hoveredPlanId;
          const color = isHover ? ACCENT.hover : ACCENT.normal;

          return (
            <RL.Rectangle
              key={plan.id}
              bounds={[[b.south, b.west], [b.north, b.east]]}
              pathOptions={{
                color,
                weight: 1.5,
                opacity: 0.75,
                fillColor: color,
                fillOpacity: 0.1,
              }}
              eventHandlers={{
                click: () => onSelect(plan.id),
                mouseover: () => onHover(plan.id),
                mouseout: () => onHover(null),
              }}
            >
              <RL.Tooltip permanent direction="center" opacity={0.9}>
                <div className="px-1 py-0.5 text-[10px] font-medium">{plan.name}</div>
              </RL.Tooltip>
            </RL.Rectangle>
          );
        })}

        {selectedPlan?.region && (
          <EditableRegion
            key={selectedPlan.id}
            RL={RL}
            plan={selectedPlan}
            mapW={map.width}
            mapH={map.height}
            color={ACCENT.selected}
            moveIcon={moveIcon}
            cornerIcons={cornerIcons}
            onUpdate={(next) => onUpdateRegion(selectedPlan.id, next)}
          />
        )}
      </RL.MapContainer>
    </div>
  );
}

function MapInvalidator({ RL }: { RL: typeof import("react-leaflet") }) {
  const map = RL.useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function BoundsFitter({
  RL,
  mapW,
  mapH,
}: {
  RL: typeof import("react-leaflet");
  mapW: number;
  mapH: number;
}) {
  const map = RL.useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(
      [
        [0, 0],
        [mapH, mapW],
      ],
      { animate: false, padding: [12, 12] },
    );
  }, [map, mapW, mapH]);
  return null;
}

function ClickToAdd({
  RL,
  enabled,
  mapW,
  mapH,
  onAdd,
}: {
  RL: typeof import("react-leaflet");
  enabled: boolean;
  mapW: number;
  mapH: number;
  onAdd: (region: ZonePlanRegion) => void;
}) {
  const map = RL.useMap();
  RL.useMapEvents({
    click: (e) => {
      if (!enabled) return;
      const latlng = map.containerPointToLatLng(e.containerPoint);
      const w = Math.max(40, mapW * 0.15);
      const h = Math.max(40, mapH * 0.15);
      const region = clampRegion(
        {
          x: latlng.lng - w / 2,
          y: latlng.lat - h / 2,
          w,
          h,
        },
        mapW,
        mapH,
      );
      onAdd(region);
    },
  });
  return null;
}

type CornerIcons = {
  nw: import("leaflet").DivIcon;
  ne: import("leaflet").DivIcon;
  sw: import("leaflet").DivIcon;
  se: import("leaflet").DivIcon;
};

function EditableRegion({
  RL,
  plan,
  mapW,
  mapH,
  color,
  moveIcon,
  cornerIcons,
  onUpdate,
}: {
  RL: typeof import("react-leaflet");
  plan: ZonePlan;
  mapW: number;
  mapH: number;
  color: string;
  moveIcon: import("leaflet").DivIcon;
  cornerIcons: CornerIcons;
  onUpdate: (next: ZonePlanRegion) => void;
}) {
  const region = plan.region!;
  const south = region.y;
  const west = region.x;
  const north = region.y + region.h;
  const east = region.x + region.w;
  const cy = (south + north) / 2;
  const cx = (west + east) / 2;

  const rectRef = useRef<import("leaflet").Rectangle | null>(null);
  const markerRefs = useRef<{
    center: import("leaflet").Marker | null;
    nw: import("leaflet").Marker | null;
    ne: import("leaflet").Marker | null;
    sw: import("leaflet").Marker | null;
    se: import("leaflet").Marker | null;
  }>({ center: null, nw: null, ne: null, sw: null, se: null });

  // Snapshot of region at drag start (so the drag math doesn't slide as React re-renders).
  const dragStartRegion = useRef<ZonePlanRegion>(region);

  const applyImperative = useCallback(
    (next: ZonePlanRegion, skip: keyof typeof markerRefs.current | null) => {
      const clamped = clampRegion(next, mapW, mapH);
      const b = regionToLeafletBounds(clamped);
      rectRef.current?.setBounds([
        [b.south, b.west],
        [b.north, b.east],
      ]);
      const center: [number, number] = [(b.south + b.north) / 2, (b.west + b.east) / 2];
      if (skip !== "center") markerRefs.current.center?.setLatLng(center);
      if (skip !== "nw") markerRefs.current.nw?.setLatLng([b.north, b.west]);
      if (skip !== "ne") markerRefs.current.ne?.setLatLng([b.north, b.east]);
      if (skip !== "sw") markerRefs.current.sw?.setLatLng([b.south, b.west]);
      if (skip !== "se") markerRefs.current.se?.setLatLng([b.south, b.east]);
      return clamped;
    },
    [mapW, mapH],
  );

  function centerHandlers() {
    return {
      dragstart: () => {
        dragStartRegion.current = region;
      },
      drag: (e: import("leaflet").LeafletEvent) => {
        const m = (e as unknown as { target: import("leaflet").Marker }).target;
        const ll = m.getLatLng();
        const start = dragStartRegion.current;
        applyImperative(
          {
            x: ll.lng - start.w / 2,
            y: ll.lat - start.h / 2,
            w: start.w,
            h: start.h,
          },
          "center",
        );
      },
      dragend: (e: import("leaflet").LeafletEvent) => {
        const m = (e as unknown as { target: import("leaflet").Marker }).target;
        const ll = m.getLatLng();
        const start = dragStartRegion.current;
        const next = applyImperative(
          {
            x: ll.lng - start.w / 2,
            y: ll.lat - start.h / 2,
            w: start.w,
            h: start.h,
          },
          null,
        );
        onUpdate(next);
      },
    };
  }

  function cornerHandlers(corner: "nw" | "ne" | "sw" | "se") {
    function compute(ll: import("leaflet").LatLng): ZonePlanRegion {
      const start = dragStartRegion.current;
      // Pin the diagonally-opposite corner as a stable anchor so resize
      // only moves the corner under the cursor.
      const anchorLng =
        corner === "nw" || corner === "sw" ? start.x + start.w : start.x;
      const anchorLat =
        corner === "nw" || corner === "ne" ? start.y : start.y + start.h;
      // Clamp the dragged corner to map bounds so the region stays valid
      // without the rectangle sliding back in and dragging the anchor along.
      const lng = Math.max(0, Math.min(mapW, ll.lng));
      const lat = Math.max(0, Math.min(mapH, ll.lat));
      return {
        x: Math.min(anchorLng, lng),
        y: Math.min(anchorLat, lat),
        w: Math.max(8, Math.abs(anchorLng - lng)),
        h: Math.max(8, Math.abs(anchorLat - lat)),
      };
    }
    return {
      dragstart: () => {
        dragStartRegion.current = region;
      },
      drag: (e: import("leaflet").LeafletEvent) => {
        const m = (e as unknown as { target: import("leaflet").Marker }).target;
        applyImperative(compute(m.getLatLng()), corner);
      },
      dragend: (e: import("leaflet").LeafletEvent) => {
        const m = (e as unknown as { target: import("leaflet").Marker }).target;
        const next = applyImperative(compute(m.getLatLng()), null);
        onUpdate(next);
      },
    };
  }

  return (
    <>
      <RL.Rectangle
        ref={(r) => {
          rectRef.current = r as unknown as import("leaflet").Rectangle | null;
        }}
        bounds={[
          [south, west],
          [north, east],
        ]}
        pathOptions={{
          color,
          weight: 2.5,
          opacity: 0.95,
          fillColor: color,
          fillOpacity: 0.18,
        }}
      >
        <RL.Tooltip permanent direction="center" opacity={0.9}>
          <div className="px-1 py-0.5 text-[10px] font-medium">{plan.name}</div>
        </RL.Tooltip>
      </RL.Rectangle>
      <RL.Marker
        ref={(m) => {
          markerRefs.current.center = m as unknown as import("leaflet").Marker | null;
        }}
        position={[cy, cx]}
        icon={moveIcon}
        draggable
        eventHandlers={centerHandlers()}
      />
      <RL.Marker
        ref={(m) => {
          markerRefs.current.nw = m as unknown as import("leaflet").Marker | null;
        }}
        position={[north, west]}
        icon={cornerIcons.nw}
        draggable
        eventHandlers={cornerHandlers("nw")}
      />
      <RL.Marker
        ref={(m) => {
          markerRefs.current.ne = m as unknown as import("leaflet").Marker | null;
        }}
        position={[north, east]}
        icon={cornerIcons.ne}
        draggable
        eventHandlers={cornerHandlers("ne")}
      />
      <RL.Marker
        ref={(m) => {
          markerRefs.current.sw = m as unknown as import("leaflet").Marker | null;
        }}
        position={[south, west]}
        icon={cornerIcons.sw}
        draggable
        eventHandlers={cornerHandlers("sw")}
      />
      <RL.Marker
        ref={(m) => {
          markerRefs.current.se = m as unknown as import("leaflet").Marker | null;
        }}
        position={[south, east]}
        icon={cornerIcons.se}
        draggable
        eventHandlers={cornerHandlers("se")}
      />
    </>
  );
}
