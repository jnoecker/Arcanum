import { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import type { TimelineEvent, CalendarSystem } from "@/types/showcase";

const IMPORTANCE_STYLES: Record<TimelineEvent["importance"], string> = {
  legendary: "border-accent bg-accent/15 shadow-[var(--glow-aurum)]",
  major: "border-accent-muted/50 bg-accent/8",
  minor: "border-border-muted bg-bg-tertiary/40",
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

  // Group events by calendar, then sort by era start year + event year
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
      <div className="text-center py-20">
        <h1 className="font-display text-accent text-xl mb-2">Unwritten Chronicles</h1>
        <p className="text-text-muted text-sm mb-6">The chronicles of this world remain unwritten.</p>
        <Link to="/articles" className="text-text-link text-sm hover:text-accent transition-colors">
          Explore the Codex instead
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="font-display text-accent text-2xl tracking-[0.18em]">Timeline</h1>

      {grouped.map(({ calendar, eraMap, events: sortedEvents }) => (
        <section key={calendar?.id ?? "unknown"}>
          {calendar && (
            <h2 className="font-display text-accent-emphasis text-lg tracking-[0.12em] mb-6">
              {calendar.name}
            </h2>
          )}

          <div className="relative pl-10">
            {/* Vertical line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border-muted" />

            <div className="space-y-4">
              {sortedEvents.map((evt) => {
                const era = eraMap.get(evt.eraId);
                const linked = evt.articleId ? articleById.get(evt.articleId) : undefined;

                return (
                  <div key={evt.id} className="relative flex items-start gap-4">
                    {/* Dot — centered on the vertical line */}
                    <div
                      className={`absolute left-[-22px] top-3 -translate-x-1/2 rounded-full ${IMPORTANCE_DOT[evt.importance]}`}
                    />

                    <div
                      className={`flex-1 border rounded-lg px-4 py-3 transition-colors ${IMPORTANCE_STYLES[evt.importance]}`}
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-text-muted text-xs font-mono">
                          {era ? `${era.name} ` : ""}Y{evt.year}
                        </span>
                        <span className="text-xs text-text-muted capitalize">
                          {evt.importance}
                        </span>
                      </div>
                      <h3 className="font-display text-accent-emphasis text-sm">
                        {linked ? (
                          <Link
                            to={`/articles/${encodeURIComponent(evt.articleId!)}`}
                            className="hover:text-accent transition-colors"
                          >
                            {evt.title}
                          </Link>
                        ) : (
                          evt.title
                        )}
                      </h3>
                      {evt.description && (
                        <p className="text-text-secondary text-sm mt-1">{evt.description}</p>
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
  );
}
