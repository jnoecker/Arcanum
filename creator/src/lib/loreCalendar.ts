import type { CalendarSystem, CalendarEra, TimelineEvent } from "@/types/lore";

/**
 * Convert an era-relative year to an absolute year on the timeline.
 * The absolute year is era.startYear + event.year.
 */
export function absoluteYear(event: TimelineEvent, calendars: CalendarSystem[]): number {
  const cal = calendars.find((c) => c.id === event.calendarId);
  if (!cal) return event.year;
  const era = cal.eras.find((e) => e.id === event.eraId);
  if (!era) return event.year;
  return era.startYear + event.year;
}

/**
 * Sort timeline events by absolute year.
 */
export function sortEvents(events: TimelineEvent[], calendars: CalendarSystem[]): TimelineEvent[] {
  return [...events].sort((a, b) => absoluteYear(a, calendars) - absoluteYear(b, calendars));
}

/**
 * Get the absolute year range spanned by all events.
 */
export function eventRange(
  events: TimelineEvent[],
  calendars: CalendarSystem[],
): { min: number; max: number } {
  if (events.length === 0) return { min: 0, max: 100 };
  let min = Infinity;
  let max = -Infinity;
  for (const e of events) {
    const y = absoluteYear(e, calendars);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  // Add padding
  const span = max - min || 100;
  return { min: min - span * 0.05, max: max + span * 0.05 };
}

/**
 * Build era bands for rendering: each band spans from era.startYear
 * to the next era's startYear (or the end of the timeline).
 */
export interface EraBand {
  era: CalendarEra;
  calendarName: string;
  startYear: number;
  endYear: number;
}

export function buildEraBands(calendars: CalendarSystem[], timelineMax: number): EraBand[] {
  const bands: EraBand[] = [];
  for (const cal of calendars) {
    const sorted = [...cal.eras].sort((a, b) => a.startYear - b.startYear);
    for (let i = 0; i < sorted.length; i++) {
      const era = sorted[i]!;
      const nextStart = sorted[i + 1]?.startYear ?? timelineMax + 50;
      bands.push({
        era,
        calendarName: cal.name,
        startYear: era.startYear,
        endYear: nextStart,
      });
    }
  }
  return bands;
}

/**
 * Format a date label for an event, e.g. "Year 42 of the Age of Monsters"
 */
export function formatEventDate(event: TimelineEvent, calendars: CalendarSystem[]): string {
  const cal = calendars.find((c) => c.id === event.calendarId);
  if (!cal) return `Year ${event.year}`;
  const era = cal.eras.find((e) => e.id === event.eraId);
  if (!era) return `Year ${event.year}`;
  return `Year ${event.year} of the ${era.name}`;
}
