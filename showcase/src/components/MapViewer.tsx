import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import type { ShowcaseMap, ShowcasePin } from "@/types/showcase";

interface MapViewerProps {
  map: ShowcaseMap;
}

export function MapViewer({ map }: MapViewerProps) {
  const { articleById } = useShowcase();
  const [hoveredPin, setHoveredPin] = useState<ShowcasePin | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fit map within container preserving aspect ratio
  const mapAspect = map.width / map.height;
  const containerAspect = dims.w && dims.h ? dims.w / dims.h : mapAspect;

  let displayW: number;
  let displayH: number;
  if (containerAspect > mapAspect) {
    // Container is wider than map — fit to height
    displayH = dims.h || 600;
    displayW = displayH * mapAspect;
  } else {
    // Container is taller than map — fit to width
    displayW = dims.w || 800;
    displayH = displayW / mapAspect;
  }

  const scale = displayW / map.width;

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-border-muted bg-bg-abyss overflow-hidden"
      style={{ height: "min(80vh, 800px)" }}
      tabIndex={0}
      role="group"
      aria-label={`Map: ${map.title}`}
    >
      <div
        className="relative mx-auto"
        style={{ width: displayW, height: displayH }}
      >
        {/* Map image */}
        <img
          src={map.imageUrl}
          alt={map.title}
          className="absolute inset-0 w-full h-full object-fill"
          draggable={false}
        />

        {/* Pins — position is [lat, lng] from Leaflet CRS.Simple:
            lat = Y from bottom, lng = X from left.
            Convert to pixel: px_x = lng * scale, px_y = (height - lat) * scale */}
        {map.pins.map((pin) => {
          const article = pin.articleId ? articleById.get(pin.articleId) : undefined;
          const pxX = pin.position[1] * scale;
          const pxY = (map.height - pin.position[0]) * scale;

          const inner = (
            <div
              key={pin.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: pxX, top: pxY }}
              onMouseEnter={() => setHoveredPin(pin)}
              onMouseLeave={() => setHoveredPin(null)}
              onFocus={() => setHoveredPin(pin)}
              onBlur={() => setHoveredPin(null)}
            >
              {/* Invisible hit area (44px) */}
              <div className="absolute inset-0 -m-3 w-12 h-12 cursor-pointer" />
              {/* Visible pin (24px) */}
              <div
                className="w-6 h-6 rounded-full border-2 border-bg-primary shadow-lg transition-transform
                           group-hover:scale-125 group-focus-within:scale-125"
                style={{ backgroundColor: pin.color ?? "var(--color-accent)" }}
              />

              {/* Tooltip */}
              {hoveredPin?.id === pin.id && (pin.label || article) && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap
                             bg-bg-primary/95 border border-border-muted rounded-md px-2.5 py-1.5
                             shadow-[var(--shadow-deep)] text-xs z-10 pointer-events-none"
                  role="tooltip"
                >
                  <div className="text-accent-emphasis font-display">
                    {article?.title ?? pin.label}
                  </div>
                  {article && pin.label && pin.label !== article.title && (
                    <div className="text-text-muted">{pin.label}</div>
                  )}
                </div>
              )}
            </div>
          );

          if (article) {
            return (
              <Link
                key={pin.id}
                to={`/articles/${encodeURIComponent(pin.articleId!)}`}
                aria-label={article.title}
              >
                {inner}
              </Link>
            );
          }
          return inner;
        })}
      </div>
    </div>
  );
}
