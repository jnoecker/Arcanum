import { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import type { TimelineEvent, CalendarSystem } from "@/types/showcase";

const IMPORTANCE_STYLES: Record<TimelineEvent["importance"], string> = {
  legendary: "border-accent/60 bg-accent/10 shadow-[0_0_24px_rgba(168,151,210,0.18)]",
  major: "border-accent-muted/30 bg-accent/5",
  minor: "border-border-muted/40 bg-bg-tertiary/30",
};

const IMPORTANCE_DOT: Record<TimelineEvent["importance"], string> = {
  legendary: "bg-accent w-4 h-4 shadow-[var(--glow-violet)]",
  major: "bg-accent-muted w-3 h-3",
  minor: "bg-border-default w-2.5 h-2.5",
};

export function TimelinePage() {
  const { data, articleById } = useShowcase();

  useEffect(() => {
    document.title = `Timeline — ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  const calendars = data?.calendarSystems ?? [];
  const events = data?.timelineEvents ?? [];

  const grouped = useMemo(() => {
    const calMap = new Map<string, CalendarSystem>();
    for (const c of calendars) calMap.set(c.id, c);

    const byCalendar = new Map<string, TimelineEvent[]>();
    for (const e of events) {
      const list = byCalendar.get(e.calendarId) ?? [];
      list.push(e);
      byCalendar.set(e.calendarId, list);
    }

    return [...byCalendar.entries()].map(([calId, evts]) => {
      const cal = calMap.get(calId);
      const eraMap = new Map<string, { name: string; startYear: number; color?: string }>();
      for (const era of cal?.eras ?? []) eraMap.set(era.id, era);

      const sorted = [...evts].sort((a, b) => {
        const eraA = eraMap.get(a.eraId);
        const eraB = eraMap.get(b.eraId);
        const yA = (eraA?.startYear ?? 0) + a.year;
        const yB = (eraB?.startYear ?? 0) + b.year;
        return yA - yB;
      });

      return { calendar: cal, eraMap, events: sorted };
    });
  }, [calendars, events]);

  if (events.length === 0) {
    return (
      <div className="text-center py-24">
        <h1 className="font-display text-accent text-2xl mb-3">Unwritten Chronicles</h1>
        <p className="text-text-muted mb-6">The chronicles of this world remain unwritten.</p>
        <Link to="/articles" className="text-text-link text-sm hover:text-accent transition-colors duration-300">
          Explore the Codex instead
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-accent text-2xl tracking-[0.18em] mb-12">Timeline</h1>

      <div className="space-y-14">
        {grouped.map(({ calendar, eraMap, events: sortedEvents }) => (
          <section key={calendar?.id ?? "unknown"}>
            {calendar && (
              <h2 className="font-display text-accent-emphasis text-lg tracking-[0.1em] mb-8">
                {calendar.name}
              </h2>
            )}

            <div className="relative pl-10">
              <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-accent/30 via-border-muted/40 to-transparent" />

              <div className="space-y-5 stagger-children">
                {sortedEvents.map((evt) => {
                  const era = eraMap.get(evt.eraId);
                  const linked = evt.articleId ? articleById.get(evt.articleId) : undefined;

                  return (
                    <div key={evt.id} className="relative flex items-start gap-4">
                      <div
                        className={`absolute left-[-22px] top-3 -translate-x-1/2 rounded-full transition-all duration-300 ${IMPORTANCE_DOT[evt.importance]}`}
                      />

                      <div
                        className={`flex-1 border rounded-xl px-5 py-4 transition-all duration-300 ${IMPORTANCE_STYLES[evt.importance]}`}
                      >
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <span className="text-text-muted text-xs font-mono tracking-wide">
                            {era ? `${era.name} ` : ""}Y{evt.year}
                          </span>
                          <span className="text-[10px] text-text-muted capitalize tracking-wide">
                            {evt.importance}
                          </span>
                        </div>
                        <h3 className="font-display text-accent-emphasis text-[15px]">
                          {linked ? (
                            <Link
                              to={`/articles/${encodeURIComponent(evt.articleId!)}`}
                              className="hover:text-accent transition-colors duration-300"
                            >
                              {evt.title}
                            </Link>
                          ) : (
                            evt.title
                          )}
                        </h3>
                        {evt.description && (
                          <p className="text-text-secondary text-sm mt-1.5 leading-relaxed">{evt.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
