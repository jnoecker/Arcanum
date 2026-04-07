import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShowcaseEmptyState, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";
import { useShowcase } from "@/lib/DataContext";
import type { CalendarSystem, TimelineEvent } from "@/types/showcase";

const IMPORTANCE_STYLES: Record<TimelineEvent["importance"], string> = {
  legendary: "border-[var(--color-aurum)]/35 bg-[radial-gradient(circle_at_top_left,rgba(214,177,90,0.12),transparent_45%),rgba(255,255,255,0.025)]",
  major: "border-accent/30 bg-bg-secondary/55",
  minor: "border-border-muted/35 bg-bg-secondary/35",
};

const IMPORTANCE_DOT: Record<TimelineEvent["importance"], string> = {
  legendary: "h-4 w-4 bg-[var(--color-aurum)] shadow-[0_0_18px_rgba(214,177,90,0.35)]",
  major: "h-3 w-3 bg-accent",
  minor: "h-2.5 w-2.5 bg-border-default",
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

  const legendaryCount = events.filter((event) => event.importance === "legendary").length;
  const majorCount = events.filter((event) => event.importance === "major").length;
  const minorCount = events.filter((event) => event.importance === "minor").length;

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
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.85fr)]">
        <div className="rounded-[1.75rem] border border-[var(--color-aurum)]/22 bg-[radial-gradient(circle_at_top_left,rgba(214,177,90,0.14),transparent_44%),linear-gradient(155deg,rgba(17,18,27,0.98),rgba(9,10,17,0.94))] px-6 py-7 shadow-[var(--shadow-deep)] sm:px-8">
          <p className="text-[0.68rem] uppercase tracking-[0.38em] text-[var(--color-aurum)]/80">Chronicle hall</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-aurum-pale)] sm:text-4xl">
            The world remembered through legendary thresholds, dynastic turns, and quieter years.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
            The route now reads like a chronicle instead of a plain stack of cards: counts, calendars, and importance
            markers sit in view before the reader descends into the record.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-[1.5rem] border border-[var(--color-aurum)]/18 bg-bg-secondary/70 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Calendars</p>
            <p className="mt-3 font-display text-3xl text-[var(--color-aurum-pale)]">
              {new Intl.NumberFormat().format(grouped.length)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Independent reckoning systems represented in the record.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Entries</p>
            <p className="mt-3 font-display text-3xl text-accent-emphasis">
              {new Intl.NumberFormat().format(events.length)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Dated moments currently visible in the public annals.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Legend</p>
            <div className="mt-3 space-y-2 text-sm text-text-secondary">
              <p>{new Intl.NumberFormat().format(legendaryCount)} legendary</p>
              <p>{new Intl.NumberFormat().format(majorCount)} major</p>
              <p>{new Intl.NumberFormat().format(minorCount)} minor</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-[linear-gradient(180deg,rgba(16,17,27,0.94),rgba(9,10,17,0.98))] px-5 py-5 shadow-[var(--shadow-deep)]">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-text-muted">Importance key</p>
            <h2 className="mt-2 font-display text-xl text-accent-emphasis">Reading the annals</h2>
            <div className="mt-5 space-y-3">
              {[
                ["Legendary", "Founding turns, cataclysms, and events that alter the world."],
                ["Major", "Political, cultural, or martial shifts that change a region or era."],
                ["Minor", "Recorded notes that deepen continuity without steering the whole age."],
              ].map(([label, description], index) => (
                <div key={label} className="rounded-[1.2rem] border border-border-muted/30 bg-bg-secondary/45 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full ${index === 0 ? IMPORTANCE_DOT.legendary : index === 1 ? IMPORTANCE_DOT.major : IMPORTANCE_DOT.minor}`} />
                    <p className="font-display text-lg text-accent-emphasis">{label}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          {grouped.map(({ calendar, eraMap, events: sortedEvents }) => (
            <section
              key={calendar?.id ?? "unknown-calendar"}
              className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.92),rgba(10,10,18,0.98))] px-5 py-5 shadow-[var(--shadow-deep)] sm:px-6"
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

              <div className="relative mt-6 pl-10 sm:pl-16">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--color-aurum)]/45 via-border-muted/35 to-transparent sm:left-6" />
                <div className="space-y-5">
                  {sortedEvents.map((event) => {
                    const era = eraMap.get(event.eraId);
                    const linkedArticle = event.articleId ? articleById.get(event.articleId) : undefined;

                    return (
                      <article
                        key={event.id}
                        className={`relative grid gap-4 rounded-[1.4rem] border px-5 py-5 sm:grid-cols-[9rem_minmax(0,1fr)] ${IMPORTANCE_STYLES[event.importance]}`}
                      >
                        <span
                          className={`absolute left-4 top-7 -translate-x-1/2 rounded-full sm:left-6 ${IMPORTANCE_DOT[event.importance]}`}
                        />
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
                                className="transition-colors duration-300 hover:text-accent focus-visible:ring-2 focus-visible:ring-[var(--color-aurum)]/35 focus-visible:rounded"
                              >
                                {event.title}
                              </Link>
                            ) : (
                              event.title
                            )}
                          </h3>
                          {event.description ? (
                            <p className="mt-3 break-words text-sm leading-7 text-text-secondary">{event.description}</p>
                          ) : (
                            <p className="mt-3 text-sm leading-7 text-text-muted">
                              No description has been preserved for this event.
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
