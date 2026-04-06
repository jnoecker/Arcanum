// ─── SceneInfoBadges ────────────────────────────────────────────────
// Subtle, ambient overlays for a scene during showcase playback.
// Mirrors creator/src/components/lore/SceneInfoBadges.tsx but resolves
// data from the showcase DataContext.

import { useMemo } from "react";
import { useShowcase } from "@/lib/DataContext";
import type { ShowcaseScene } from "@/types/showcase";

interface SceneInfoBadgesProps {
  scene: ShowcaseScene;
}

// ─── Helpers ───────────────────────────────────────────────────────

function useTimelineLabel(eventId: string | undefined) {
  const { data } = useShowcase();
  return useMemo(() => {
    if (!eventId || !data) return null;
    const ev = data.timelineEvents?.find((e) => e.id === eventId);
    if (!ev) return null;
    const cal = data.calendarSystems?.find((c) => c.id === ev.calendarId);
    const era = cal?.eras.find((e) => e.id === ev.eraId);
    return { year: ev.year, era: era?.name, title: ev.title };
  }, [data, eventId]);
}

function useMapPin(mapId: string | undefined, pinId: string | undefined) {
  const { data } = useShowcase();
  return useMemo(() => {
    if (!mapId || !data) return null;
    const m = data.maps.find((x) => x.id === mapId);
    if (!m) return null;
    const pin = pinId ? m.pins.find((p) => p.id === pinId) : undefined;
    return { map: m, pin };
  }, [data, mapId, pinId]);
}

// ─── Mini-map thumbnail ────────────────────────────────────────────

function MiniMap({
  imageUrl,
  mapWidth,
  mapHeight,
  pinX,
  pinY,
  pinColor,
}: {
  imageUrl: string;
  mapWidth: number;
  mapHeight: number;
  pinX?: number;
  pinY?: number;
  pinColor?: string;
}) {
  if (!imageUrl) return null;
  const xPct = pinX !== undefined && mapWidth > 0 ? (pinX / mapWidth) * 100 : null;
  const yPct = pinY !== undefined && mapHeight > 0
    ? ((mapHeight - pinY) / mapHeight) * 100
    : null;
  return (
    <div className="relative h-20 w-28 overflow-hidden rounded border border-white/20 shadow-lg">
      <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      {xPct !== null && yPct !== null && (
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/70 animate-pulse"
          style={{
            left: `${xPct}%`,
            top: `${yPct}%`,
            backgroundColor: pinColor ?? "#fbbf24",
          }}
        />
      )}
    </div>
  );
}

// ─── Article badge chip ────────────────────────────────────────────

function ArticleBadgeChip({ articleId }: { articleId: string }) {
  const { articleById } = useShowcase();
  const article = articleById.get(articleId);
  if (!article) return null;
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-2 py-0.5 backdrop-blur-sm"
      title={article.title}
    >
      {article.imageUrl ? (
        <img src={article.imageUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <span className="h-4 w-4 rounded-full bg-white/20" />
      )}
      <span className="max-w-[100px] truncate text-[10px] text-white/90">{article.title}</span>
    </div>
  );
}

// ─── Title card overlay ────────────────────────────────────────────

function TitleCardOverlay({ scene }: { scene: ShowcaseScene }) {
  const card = scene.titleCard;
  if (!card?.text) return null;
  const isYear = card.style === "year";
  const isLocation = card.style === "location";
  const isCharacter = card.style === "character";
  return (
    <div
      className={[
        "rounded backdrop-blur-sm px-4 py-1.5",
        "font-display tracking-[0.25em] uppercase",
        isYear ? "text-base text-amber-300 border border-amber-400/30 bg-black/50" : "",
        isLocation ? "text-sm text-white border-b border-white/30 bg-transparent" : "",
        isCharacter ? "text-sm text-violet-300 border border-violet-400/30 bg-black/50" : "",
        !isYear && !isLocation && !isCharacter ? "text-xs text-white/90 bg-black/40" : "",
      ].join(" ")}
      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}
    >
      {card.text}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

export function SceneInfoBadges({ scene }: SceneInfoBadgesProps) {
  const timeline = useTimelineLabel(scene.linkedTimelineEventId);
  const mapInfo = useMapPin(scene.linkedMapId, scene.linkedPinId);
  const articleIds = scene.linkedArticleIds ?? [];

  if (!timeline && !mapInfo && articleIds.length === 0 && !scene.titleCard?.text) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 35 }}
      aria-hidden="true"
    >
      {/* Top-left: year/era badge */}
      {timeline && (
        <div className="absolute left-3 top-3 flex flex-col items-start gap-0.5 rounded border border-amber-400/40 bg-black/55 px-2 py-1 backdrop-blur-sm">
          <span
            className="font-display text-base leading-none tracking-[0.18em] text-amber-300"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
          >
            {timeline.year}
            {timeline.era && <span className="ml-1 text-[10px] uppercase tracking-[0.2em]">{timeline.era}</span>}
          </span>
          <span className="max-w-[180px] truncate text-[10px] text-white/70">{timeline.title}</span>
        </div>
      )}

      {/* Top-right: mini-map */}
      {mapInfo && (
        <div className="absolute right-3 top-3">
          <MiniMap
            imageUrl={mapInfo.map.imageUrl}
            mapWidth={mapInfo.map.width}
            mapHeight={mapInfo.map.height}
            pinX={mapInfo.pin?.position[1]}
            pinY={mapInfo.pin?.position[0]}
            pinColor={mapInfo.pin?.color}
          />
          {mapInfo.pin?.label && (
            <div className="mt-1 max-w-[112px] truncate text-right text-[10px] text-white/80" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
              {mapInfo.pin.label}
            </div>
          )}
        </div>
      )}

      {/* Top-center: title card */}
      {scene.titleCard?.text && (
        <div className="absolute left-1/2 top-6 -translate-x-1/2">
          <TitleCardOverlay scene={scene} />
        </div>
      )}

      {/* Bottom: article chips */}
      {articleIds.length > 0 && (
        <div className="absolute inset-x-0 bottom-24 flex flex-wrap items-center justify-center gap-1.5 px-4">
          {articleIds.slice(0, 6).map((id) => (
            <ArticleBadgeChip key={id} articleId={id} />
          ))}
        </div>
      )}
    </div>
  );
}
