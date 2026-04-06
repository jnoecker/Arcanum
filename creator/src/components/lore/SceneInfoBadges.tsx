// ─── SceneInfoBadges ────────────────────────────────────────────────
// Subtle, ambient overlays for a scene during preview/playback:
//   - Top-left:   year/era badge (resolved from linkedTimelineEventId)
//   - Top-right:  mini-map thumbnail with pulsing pin
//   - Top-center: title card text overlay
//   - Bottom:     featured-article chips
//
// All four are individually optional. The `mode` prop controls visual
// intensity: "ambient" (low opacity, always-on for editing) vs "playback"
// (full opacity, toggleable in presentation mode).

import { useMemo } from "react";
import { useLoreStore, selectMaps, selectEvents, selectCalendars } from "@/stores/loreStore";
import { useImageSrc } from "@/lib/useImageSrc";
import type { Scene } from "@/types/story";

interface SceneInfoBadgesProps {
  scene: Scene;
  mode?: "ambient" | "playback";
}

// ─── Helpers ───────────────────────────────────────────────────────

function useTimelineLabel(eventId: string | undefined) {
  const events = useLoreStore(selectEvents);
  const calendars = useLoreStore(selectCalendars);
  return useMemo(() => {
    if (!eventId) return null;
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return null;
    const cal = calendars.find((c) => c.id === ev.calendarId);
    const era = cal?.eras.find((e) => e.id === ev.eraId);
    return {
      year: ev.year,
      era: era?.name,
      title: ev.title,
      color: era?.color,
    };
  }, [events, calendars, eventId]);
}

function useMapPin(mapId: string | undefined, pinId: string | undefined) {
  const maps = useLoreStore(selectMaps);
  return useMemo(() => {
    if (!mapId) return null;
    const m = maps.find((x) => x.id === mapId);
    if (!m) return null;
    const pin = pinId ? m.pins.find((p) => p.id === pinId) : undefined;
    return { map: m, pin };
  }, [maps, mapId, pinId]);
}

// ─── Mini-map thumbnail ────────────────────────────────────────────

function MiniMap({
  mapAsset,
  mapWidth,
  mapHeight,
  pinX,
  pinY,
  pinColor,
}: {
  mapAsset: string;
  mapWidth: number;
  mapHeight: number;
  pinX?: number;
  pinY?: number;
  pinColor?: string;
}) {
  const src = useImageSrc(mapAsset);
  if (!src) return null;
  // Convert leaflet CRS.Simple coords (lat=Y from bottom, lng=X) to %.
  // pinX is lng, pinY is lat — convert to top-down percent.
  const xPct = pinX !== undefined && mapWidth > 0 ? (pinX / mapWidth) * 100 : null;
  const yPct = pinY !== undefined && mapHeight > 0
    ? ((mapHeight - pinY) / mapHeight) * 100
    : null;

  return (
    <div className="relative h-20 w-28 overflow-hidden rounded border border-white/20 shadow-lg">
      <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
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

// ─── Article chip (badge variant — image only) ────────────────────

function ArticleBadgeChip({ articleId }: { articleId: string }) {
  const article = useLoreStore((s) => s.lore?.articles[articleId]);
  const src = useImageSrc(article?.image);
  if (!article) return null;
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-2 py-0.5 backdrop-blur-sm"
      title={article.title}
    >
      {src ? (
        <img src={src} alt="" className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <span className="h-4 w-4 rounded-full bg-white/20" />
      )}
      <span className="max-w-[100px] truncate text-2xs text-white/90">{article.title}</span>
    </div>
  );
}

// ─── Title card text styling ───────────────────────────────────────

function TitleCardOverlay({ scene }: { scene: Scene }) {
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
        isYear ? "text-base text-warm border border-warm/30 bg-black/50" : "",
        isLocation ? "text-sm text-white border-b border-white/30 bg-transparent" : "",
        isCharacter ? "text-sm text-accent border border-accent/30 bg-black/50" : "",
        !isYear && !isLocation && !isCharacter ? "text-xs text-white/90 bg-black/40" : "",
      ].join(" ")}
      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}
    >
      {card.text}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

export function SceneInfoBadges({ scene, mode = "ambient" }: SceneInfoBadgesProps) {
  const timeline = useTimelineLabel(scene.linkedTimelineEventId);
  const mapInfo = useMapPin(scene.linkedMapId, scene.linkedPinId);
  const articleIds = scene.linkedArticleIds ?? [];

  const opacity = mode === "ambient" ? "opacity-65" : "opacity-100";

  // Nothing to render → don't add overlay layers
  if (!timeline && !mapInfo && articleIds.length === 0 && !scene.titleCard?.text) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${opacity}`}
      style={{ zIndex: 35 }}
      aria-hidden="true"
    >
      {/* Top-left: year/era badge */}
      {timeline && (
        <div className="absolute left-3 top-3 flex flex-col items-start gap-0.5 rounded border border-warm/40 bg-black/55 px-2 py-1 backdrop-blur-sm">
          <span
            className="font-display text-base leading-none tracking-[0.18em] text-warm"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
          >
            {timeline.year}
            {timeline.era && <span className="ml-1 text-2xs uppercase tracking-[0.2em]">{timeline.era}</span>}
          </span>
          <span className="max-w-[180px] truncate text-2xs text-white/70">{timeline.title}</span>
        </div>
      )}

      {/* Top-right: mini-map */}
      {mapInfo && (
        <div className="absolute right-3 top-3">
          <MiniMap
            mapAsset={mapInfo.map.imageAsset}
            mapWidth={mapInfo.map.width}
            mapHeight={mapInfo.map.height}
            pinX={mapInfo.pin?.position[1]}
            pinY={mapInfo.pin?.position[0]}
            pinColor={mapInfo.pin?.color}
          />
          {mapInfo.pin?.label && (
            <div className="mt-1 max-w-[112px] truncate text-right text-2xs text-white/80" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
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

      {/* Bottom: article chips (above the narration overlay if both exist) */}
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
