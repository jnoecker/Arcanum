import { useMemo } from "react";
import { useShowcase } from "@/lib/DataContext";
import type { ShowcaseScene } from "@/types/showcase";

interface SceneInfoBadgesProps {
  scene: ShowcaseScene;
}

function useTimelineLabel(eventId: string | undefined) {
  const { data } = useShowcase();
  return useMemo(() => {
    if (!eventId || !data) {
      return null;
    }
    const event = data.timelineEvents?.find((entry) => entry.id === eventId);
    if (!event) {
      return null;
    }
    const calendar = data.calendarSystems?.find((entry) => entry.id === event.calendarId);
    const era = calendar?.eras.find((entry) => entry.id === event.eraId);
    return { year: event.year, era: era?.name, title: event.title };
  }, [data, eventId]);
}

function useMapPin(mapId: string | undefined, pinId: string | undefined) {
  const { data } = useShowcase();
  return useMemo(() => {
    if (!mapId || !data) {
      return null;
    }
    const map = data.maps.find((entry) => entry.id === mapId);
    if (!map) {
      return null;
    }
    const pin = pinId ? map.pins.find((entry) => entry.id === pinId) : undefined;
    return { map, pin };
  }, [data, mapId, pinId]);
}

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
  if (!imageUrl) {
    return null;
  }

  const xPercent = pinX !== undefined && mapWidth > 0 ? (pinX / mapWidth) * 100 : null;
  const yPercent = pinY !== undefined && mapHeight > 0 ? ((mapHeight - pinY) / mapHeight) * 100 : null;

  return (
    <div className="relative h-24 w-32 overflow-hidden rounded-[1rem] border border-[var(--color-aurum)]/25 bg-bg-abyss/55 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <img src={imageUrl} alt="" className="h-full w-full object-cover opacity-95" draggable={false} />
      {xPercent !== null && yPercent !== null ? (
        <span
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-text-primary/75"
          style={{
            left: `${xPercent}%`,
            top: `${yPercent}%`,
            backgroundColor: pinColor ?? "var(--color-aurum)",
          }}
        />
      ) : null}
    </div>
  );
}

function ArticleBadgeChip({ articleId }: { articleId: string }) {
  const { articleById } = useShowcase();
  const article = articleById.get(articleId);
  if (!article) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-border-muted/40 bg-bg-abyss/60 px-2.5 py-1 backdrop-blur-sm"
      title={article.title}
    >
      {article.imageUrl ? (
        <img src={article.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span className="h-5 w-5 rounded-full bg-text-primary/20" />
      )}
      <span className="max-w-[120px] truncate text-[0.68rem] uppercase tracking-[0.14em] text-text-primary/85">
        {article.title}
      </span>
    </div>
  );
}

function TitleCardOverlay({ scene }: { scene: ShowcaseScene }) {
  const card = scene.titleCard;
  if (!card?.text) {
    return null;
  }

  const cardClassName =
    card.style === "year"
      ? "border-[var(--color-aurum)]/35 bg-bg-abyss/60 text-[var(--color-aurum-pale)]"
      : card.style === "location"
        ? "border-border-muted/40 bg-bg-abyss/45 text-text-primary"
        : card.style === "character"
          ? "border-accent/35 bg-bg-abyss/55 text-accent-emphasis"
          : "border-border-muted/35 bg-bg-abyss/50 text-text-primary/90";

  return (
    <div
      className={`rounded-full border px-5 py-2 font-display text-[0.8rem] uppercase tracking-[0.32em] backdrop-blur-sm ${cardClassName}`}
      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.75)" }}
    >
      {card.text}
    </div>
  );
}

export function SceneInfoBadges({ scene }: SceneInfoBadgesProps) {
  const timeline = useTimelineLabel(scene.linkedTimelineEventId);
  const mapInfo = useMapPin(scene.linkedMapId, scene.linkedPinId);
  const articleIds = scene.linkedArticleIds ?? [];

  if (!timeline && !mapInfo && articleIds.length === 0 && !scene.titleCard?.text) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 35 }} aria-hidden="true">
      {timeline ? (
        <div className="absolute left-4 top-4 rounded-[1rem] border border-[var(--color-aurum)]/28 bg-bg-abyss/60 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            <span
              className="font-display text-2xl leading-none text-[var(--color-aurum-pale)]"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.65)" }}
            >
              {timeline.year}
            </span>
            {timeline.era ? (
              <span className="pb-0.5 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--color-aurum)]/85">
                {timeline.era}
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-[14rem] truncate text-[0.68rem] uppercase tracking-[0.14em] text-text-secondary">
            {timeline.title}
          </p>
        </div>
      ) : null}

      {mapInfo ? (
        <div className="absolute right-4 top-4">
          <MiniMap
            imageUrl={mapInfo.map.imageUrl}
            mapWidth={mapInfo.map.width}
            mapHeight={mapInfo.map.height}
            pinX={mapInfo.pin?.position[1]}
            pinY={mapInfo.pin?.position[0]}
            pinColor={mapInfo.pin?.color}
          />
          <p
            className="mt-2 max-w-[8rem] truncate text-right text-[0.68rem] uppercase tracking-[0.14em] text-text-secondary"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.75)" }}
          >
            {mapInfo.pin?.label ?? mapInfo.map.title}
          </p>
        </div>
      ) : null}

      {scene.titleCard?.text ? (
        <div className="absolute left-1/2 top-7 -translate-x-1/2">
          <TitleCardOverlay scene={scene} />
        </div>
      ) : null}

      {articleIds.length > 0 ? (
        <div className="absolute inset-x-0 bottom-24 flex flex-wrap items-center justify-center gap-2 px-4">
          {articleIds.slice(0, 6).map((articleId) => (
            <ArticleBadgeChip key={articleId} articleId={articleId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
