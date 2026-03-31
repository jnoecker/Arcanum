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
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scale factor: fit map width to container, preserve aspect ratio
  const scale = containerWidth > 0 ? containerWidth / map.width : 1;
  const displayHeight = map.height * scale;

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-border-muted bg-bg-abyss overflow-hidden"
      tabIndex={0}
      role="img"
      aria-label={`Map: ${map.title}`}
    >
      <div
        className="relative w-full"
        style={{ height: displayHeight }}
      >
        {/* Map image */}
        <img
          src={map.imageUrl}
          alt={map.title}
          className="absolute inset-0 w-full h-full object-fill"
          draggable={false}
        />

        {/* Pins — positions scaled proportionally */}
        {map.pins.map((pin) => {
          const article = pin.articleId ? articleById.get(pin.articleId) : undefined;
          const x = pin.position[0] * scale;
          const y = pin.position[1] * scale;

          const inner = (
            <div
              key={pin.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: x, top: y }}
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
                style={{ backgroundColor: pin.color ?? "#a897d2" }}
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
