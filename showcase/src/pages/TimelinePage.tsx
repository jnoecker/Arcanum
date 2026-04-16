import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShowcaseEmptyState, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";
import { useShowcase } from "@/lib/DataContext";
import type { CalendarSystem, TimelineEvent } from "@/types/showcase";

const IMPORTANCE_STYLES: Record<TimelineEvent["importance"], string> = {
  legendary: "border-[var(--color-aurum)]/35",
  major: "border-accent/30",
  minor: "border-border-muted/35",
};

export function TimelinePage() {
  const { data, articleById } = useShowcase();

  useEffect(() => {
    document.title = `Timeline - ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  const calendars = data?.calendarSystems ?? [];
  const events = data?.timelineEvents ?? [];

  const grouped = useMemo(() => {
    const calendarById = new Map<string, CalendarSystem>();
    for (const calendar of calendars) {
      calendarById.set(calendar.id, calendar);
    }

    const eventsByCalendar = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const bucket = eventsByCalendar.get(event.calendarId) ?? [];
      bucket.push(event);
      eventsByCalendar.set(event.calendarId, bucket);
    }

    return [...eventsByCalendar.entries()].map(([calendarId, calendarEvents]) => {
      const calendar = calendarById.get(calendarId);
      const eraMap = new Map<string, { name: string; startYear: number; color?: string }>();
      for (const era of calendar?.eras ?? []) {
        eraMap.set(era.id, era);
      }

      const sortedEvents = [...calendarEvents].sort((left, right) => {
        const leftEra = eraMap.get(left.eraId);
        const rightEra = eraMap.get(right.eraId);
        const leftYear = (leftEra?.startYear ?? 0) + left.year;
        const rightYear = (rightEra?.startYear ?? 0) + right.year;
        return leftYear - rightYear;
      });

      return { calendar, eraMap, events: sortedEvents };
    });
  }, [calendars, events]);

  if (!data) {
    return null;
  }

  if (events.length === 0) {
    return (
      <ShowcaseEmptyState
        title="Unwritten chronicles"
        description="The public record contains no dated events yet. Explore the codex while the annals remain unfinished."
        actions={
          <Link to="/articles" className={showcaseButtonClassNames.secondary}>
            Explore the codex
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-8">
        {grouped.map(({ calendar, eraMap, events: sortedEvents }) => (
          <section
            key={calendar?.id ?? "unknown-calendar"}
            className="rounded-[1.6rem] border border-border-muted/35 bg-gradient-panel-deep px-5 py-5 shadow-[var(--shadow-deep)] sm:px-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-muted/25 pb-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Calendar</p>
                <h2 className="mt-2 font-display text-3xl text-[var(--color-aurum-pale)]">
                  {calendar?.name ?? "Unknown reckoning"}
                </h2>
              </div>
              <p className="text-sm text-text-muted">
                {new Intl.NumberFormat().format(sortedEvents.length)} recorded moment
                {sortedEvents.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="mt-6 space-y-5">
              {sortedEvents.map((event) => {
                const era = eraMap.get(event.eraId);
                const linkedArticle = event.articleId ? articleById.get(event.articleId) : undefined;

                return (
                  <article
                    key={event.id}
                    className={`relative grid gap-4 overflow-hidden rounded-[1.4rem] border bg-bg-secondary/40 px-5 py-5 sm:grid-cols-[9rem_minmax(0,1fr)] ${IMPORTANCE_STYLES[event.importance]}`}
                  >
                    {event.imageUrl && (
                      <>
                        <img
                          src={event.imageUrl}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-event-scrim" />
                      </>
                    )}
                    <div className="relative">
                      <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">
                        {era?.name ?? "Era"}
                      </p>
                      <p className="mt-2 font-display text-3xl text-accent-emphasis">
                        Y{new Intl.NumberFormat().format(event.year)}
                      </p>
                      <p className="mt-2 text-[0.72rem] uppercase tracking-[0.2em] text-text-muted capitalize">
                        {event.importance}
                      </p>
                    </div>
                    <div className="relative min-w-0">
                      <h3 className="break-words font-display text-2xl text-[var(--color-aurum-pale)]">
                        {linkedArticle ? (
                          <Link
                            to={`/articles/${encodeURIComponent(event.articleId!)}`}
                            className="rounded transition-colors duration-300 hover:text-accent focus-visible:ring-2 focus-visible:ring-[var(--color-aurum)]/35"
                          >
                            {event.title}
                          </Link>
                        ) : (
                          event.title
                        )}
                      </h3>
                      {event.description && (
                        <p className="mt-3 break-words text-sm leading-7 text-text-secondary">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
