import { useMemo } from "react";
import { MapContainer, ImageOverlay, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "./leaflet-setup.css";
import type { LoreMap, MapPin } from "@/types/lore";
import { useLoreStore } from "@/stores/loreStore";

// ─── Custom pin icon ────────────────────────────────────────────────

function makePinIcon(color?: string): L.DivIcon {
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

const DEFAULT_ICON = makePinIcon();

// ─── Click handler for adding pins ──────────────────────────────────

function MapClickHandler({
  mapId,
  addMode,
  onAddComplete,
}: {
  mapId: string;
  addMode: boolean;
  onAddComplete: () => void;
}) {
  const addPin = useLoreStore((s) => s.addPin);

  useMapEvents({
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
  const bounds: L.LatLngBoundsExpression = [[0, 0], [map.height, map.width]];

  const pinIcons = useMemo(() => {
    const cache: Record<string, L.DivIcon> = {};
    for (const pin of map.pins) {
      const key = pin.color || "default";
      if (!cache[key]) cache[key] = pin.color ? makePinIcon(pin.color) : DEFAULT_ICON;
    }
    return cache;
  }, [map.pins]);

  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      maxBounds={bounds}
      style={{ width: "100%", height: "100%", background: "var(--color-graph-bg)", borderRadius: "12px" }}
      zoomSnap={0.25}
      minZoom={-2}
      maxZoom={3}
      attributionControl={false}
    >
      <ImageOverlay url={imageUrl} bounds={bounds} />
      <MapClickHandler mapId={map.id} addMode={addMode} onAddComplete={onAddComplete} />

      {map.pins.map((pin) => {
        const icon = pinIcons[pin.color || "default"] ?? DEFAULT_ICON;
        const articleTitle = pin.articleId ? articles[pin.articleId]?.title : null;

        return (
          <Marker
            key={pin.id}
            position={pin.position}
            icon={icon}
            eventHandlers={{
              click: () => onSelectPin(pin.id),
            }}
          >
            <Popup>
              <div className="text-xs">
                <div className="font-semibold text-bg-primary">{pin.label || "(unnamed)"}</div>
                {articleTitle && (
                  <div className="mt-0.5 text-bg-secondary">{articleTitle}</div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
