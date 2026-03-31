import { useMemo, useEffect, useState } from "react";
import type { LoreMap, MapPin } from "@/types/lore";
import { useLoreStore } from "@/stores/loreStore";

// ─── Custom pin icon ────────────────────────────────────────────────

function makePinIcon(L: typeof import("leaflet"), color?: string) {
  const fill = color || "#a897d2";
  return L.divIcon({
    className: "",
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34],
    html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="${fill}" fill-opacity="0.9"/>
      <circle cx="12" cy="11" r="4" fill="#2a3149" fill-opacity="0.7"/>
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
}: {
  map: LoreMap;
  imageUrl: string;
  onSelectPin: (id: string | null) => void;
  addMode: boolean;
  onAddComplete: () => void;
}) {
  const articles = useLoreStore((s) => s.lore?.articles ?? {});
  const addPin = useLoreStore((s) => s.addPin);

  // Dynamically load Leaflet + react-leaflet + CSS to fully isolate from PostCSS
  const [leafletReady, setLeafletReady] = useState(false);
  const [modules, setModules] = useState<{
    L: typeof import("leaflet");
    RL: typeof import("react-leaflet");
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Inject CSS via style tag
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

  if (!leafletReady || !modules || !bounds) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        Loading map...
      </div>
    );
  }

  const { L, RL } = modules;

  return (
    <RL.MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      maxBounds={bounds}
      style={{ width: "100%", height: "100%", background: "var(--color-graph-bg)", borderRadius: "12px" }}
      zoomSnap={0.25}
      minZoom={-2}
      maxZoom={3}
      attributionControl={false}
    >
      <RL.ImageOverlay url={imageUrl} bounds={bounds} />
      <MapClickHandler mapId={map.id} addMode={addMode} onAddComplete={onAddComplete} addPin={addPin} RL={RL} />

      {map.pins.map((pin) => {
        const icon = pinIcons[pin.color || "default"] ?? pinIcons.default!;
        const articleTitle = pin.articleId ? articles[pin.articleId]?.title : null;

        return (
          <RL.Marker
            key={pin.id}
            position={pin.position}
            icon={icon}
            eventHandlers={{
              click: () => onSelectPin(pin.id),
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
  );
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
  RL.useMapEvents({
    click: (e) => {
      if (!addMode) return;
      const pin: MapPin = {
        id: `pin_${Date.now()}`,
        position: [e.latlng.lat, e.latlng.lng],
        label: "New pin",
      };
      addPin(mapId, pin);
      onAddComplete();
    },
  });

  return null;
}
