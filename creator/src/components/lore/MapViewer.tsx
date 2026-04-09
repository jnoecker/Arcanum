import { useMemo, useEffect, useState, useCallback } from "react";
import type { LoreMap, MapPin, ZonePlan } from "@/types/lore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { regionToLeafletBounds } from "@/lib/zoneRegionGeometry";

// ─── Custom pin icon ────────────────────────────────────────────────

function makePinIcon(L: typeof import("leaflet"), color?: string) {
  const fill = color || "var(--color-template-world)";
  return L.divIcon({
    className: "",
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34],
    html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="${fill}" fill-opacity="0.9"/>
      <circle cx="12" cy="11" r="4" fill="var(--color-bg-primary)" fill-opacity="0.7"/>
    </svg>`,
  });
}

// ─── Main component ────────────────────────────────────────────────

export function MapViewer({
  map,
  imageUrl,
  onSelectPin,
  addMode,
  onAddComplete,
  zonePlans = [],
  selectedZonePlanId = null,
  onSelectZonePlan,
}: {
  map: LoreMap;
  imageUrl: string;
  onSelectPin: (id: string | null) => void;
  addMode: boolean;
  onAddComplete: () => void;
  zonePlans?: ZonePlan[];
  selectedZonePlanId?: string | null;
  onSelectZonePlan?: (id: string) => void;
}) {
  const articles = useLoreStore(selectArticles);
  const addPin = useLoreStore((s) => s.addPin);
  const updatePin = useLoreStore((s) => s.updatePin);

  const [leafletReady, setLeafletReady] = useState(false);
  const [modules, setModules] = useState<{
    L: typeof import("leaflet");
    RL: typeof import("react-leaflet");
  } | null>(null);
  const [ctrlHeld, setCtrlHeld] = useState(false);

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
      if (!cancelled) {
        setModules({ L: L.default ?? L, RL });
        setLeafletReady(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Track Ctrl key for drag-to-move mode
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Control") setCtrlHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === "Control") setCtrlHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const bounds = modules
    ? ([[0, 0], [map.height, map.width]] as import("leaflet").LatLngBoundsExpression)
    : null;

  const pinIcons = useMemo(() => {
    if (!modules) return {};
    const cache: Record<string, import("leaflet").DivIcon> = {};
    for (const pin of map.pins) {
      const key = pin.color || "default";
      if (!cache[key]) cache[key] = makePinIcon(modules.L, pin.color);
    }
    if (!cache.default) cache.default = makePinIcon(modules.L);
    return cache;
  }, [map.pins, modules]);

  const handlePinDragEnd = useCallback(
    (pinId: string, e: import("leaflet").DragEndEvent) => {
      const latlng = e.target.getLatLng();
      updatePin(map.id, pinId, { position: [latlng.lat, latlng.lng] });
    },
    [map.id, updatePin],
  );

  if (!leafletReady || !modules || !bounds) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        Loading map...
      </div>
    );
  }

  const { L, RL } = modules;

  return (
    <>
      {ctrlHeld && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[1000] rounded-full bg-accent/90 px-3 py-1 text-2xs text-bg-primary font-medium shadow-panel pointer-events-none">
          Drag pins to move them
        </div>
      )}
      <RL.MapContainer
        crs={L.CRS.Simple}
        bounds={bounds}
        maxBounds={L.latLngBounds(
          L.latLng(-map.height * 0.1, -map.width * 0.1),
          L.latLng(map.height * 1.1, map.width * 1.1),
        )}
        style={{ width: "100%", height: "100%", background: "var(--color-graph-bg)", borderRadius: "12px" }}
        zoomSnap={0.25}
        minZoom={-2}
        maxZoom={3}
        attributionControl={false}
      >
        <RL.ImageOverlay url={imageUrl} bounds={bounds} />
        <MapClickHandler mapId={map.id} addMode={addMode} onAddComplete={onAddComplete} addPin={addPin} RL={RL} />
        <MapInvalidator RL={RL} />

        {zonePlans.map((plan) => {
          if (!plan.region) return null;
          const bounds = regionToLeafletBounds(plan.region);
          const isSelected = plan.id === selectedZonePlanId;

          return (
            <RL.Rectangle
              key={plan.id}
              bounds={[
                [bounds.south, bounds.west],
                [bounds.north, bounds.east],
              ]}
              pathOptions={{
                color: isSelected ? "#f2d087" : "#d8b56a",
                weight: isSelected ? 2.5 : 1.5,
                opacity: isSelected ? 0.95 : 0.7,
                fillColor: isSelected ? "#e8bd62" : "#b78a3f",
                fillOpacity: isSelected ? 0.18 : 0.1,
              }}
              eventHandlers={{
                click: () => onSelectZonePlan?.(plan.id),
              }}
            >
              <RL.Tooltip permanent direction="center" opacity={0.9}>
                <div className="px-1 py-0.5 text-[10px] font-medium">
                  {plan.name}
                </div>
              </RL.Tooltip>
            </RL.Rectangle>
          );
        })}

        {map.pins.map((pin) => {
          const icon = pinIcons[pin.color || "default"] ?? pinIcons.default!;
          const articleTitle = pin.articleId ? articles[pin.articleId]?.title : null;

          return (
            <RL.Marker
              key={pin.id}
              position={pin.position}
              icon={icon}
              draggable={ctrlHeld}
              eventHandlers={{
                click: () => onSelectPin(pin.id),
                dragend: (e) => handlePinDragEnd(pin.id, e),
              }}
            >
              <RL.Popup>
                <div className="text-xs">
                  <div className="font-semibold text-bg-primary">{pin.label || "(unnamed)"}</div>
                  {articleTitle && (
                    <div className="mt-0.5 text-bg-secondary">{articleTitle}</div>
                  )}
                </div>
              </RL.Popup>
            </RL.Marker>
          );
        })}
      </RL.MapContainer>
    </>
  );
}

// ─── Invalidate map size after mount to fix coordinate mapping ────

function MapInvalidator({ RL }: { RL: typeof import("react-leaflet") }) {
  const map = RL.useMap();
  useEffect(() => {
    // Delay to ensure container is fully laid out
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// ─── Click handler (needs to be inside MapContainer context) ────────

function MapClickHandler({
  mapId,
  addMode,
  onAddComplete,
  addPin,
  RL,
}: {
  mapId: string;
  addMode: boolean;
  onAddComplete: () => void;
  addPin: (mapId: string, pin: MapPin) => void;
  RL: typeof import("react-leaflet");
}) {
  const map = RL.useMap();

  RL.useMapEvents({
    click: (e) => {
      if (!addMode) return;
      // Use containerPoint → latLng conversion for accurate placement at any zoom
      const latlng = map.containerPointToLatLng(e.containerPoint);
      const pin: MapPin = {
        id: `pin_${Date.now()}`,
        position: [latlng.lat, latlng.lng],
        label: "New pin",
      };
      addPin(mapId, pin);
      onAddComplete();
    },
  });

  return null;
}
