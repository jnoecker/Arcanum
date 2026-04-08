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
 * Sort timeline events by absolute year, then by title and id for stability.
 */
export function sortEvents(events: TimelineEvent[], calendars: CalendarSystem[]): TimelineEvent[] {
  return resolveTimelineEvents(events, calendars).map((entry) => entry.event);
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

export interface TimelineFilters {
  search?: string;
  calendarId?: string;
  importance?: TimelineEvent["importance"];
  minAbsoluteYear?: number;
  maxAbsoluteYear?: number;
}

export interface ResolvedTimelineEvent {
  event: TimelineEvent;
  absoluteYear: number;
  calendar: CalendarSystem | null;
  era: CalendarEra | null;
  calendarName: string;
  eraName: string;
  searchText: string;
}

export interface ChronicleEraGroup {
  id: string;
  calendarId: string;
  calendarName: string;
  era: CalendarEra | null;
  eraName: string;
  startYear: number | null;
  events: ResolvedTimelineEvent[];
  isMissingEra: boolean;
}

export interface ChronicleCalendarGroup {
  id: string;
  calendar: CalendarSystem | null;
  calendarName: string;
  eras: ChronicleEraGroup[];
  visibleEventCount: number;
  isMissingCalendar: boolean;
}

export interface TimelineNeighbors {
  previous: ResolvedTimelineEvent | null;
  current: ResolvedTimelineEvent | null;
  next: ResolvedTimelineEvent | null;
  selectedIndex: number;
  total: number;
}

function compareResolvedEvents(a: ResolvedTimelineEvent, b: ResolvedTimelineEvent): number {
  if (a.absoluteYear !== b.absoluteYear) return a.absoluteYear - b.absoluteYear;

  const calendarCompare = a.calendarName.localeCompare(b.calendarName);
  if (calendarCompare !== 0) return calendarCompare;

  const eraStartA = a.era?.startYear ?? a.absoluteYear;
  const eraStartB = b.era?.startYear ?? b.absoluteYear;
  if (eraStartA !== eraStartB) return eraStartA - eraStartB;

  const titleCompare = a.event.title.localeCompare(b.event.title);
  if (titleCompare !== 0) return titleCompare;

  return a.event.id.localeCompare(b.event.id);
}

export function resolveTimelineEvents(
  events: TimelineEvent[],
  calendars: CalendarSystem[],
): ResolvedTimelineEvent[] {
  return events
    .map((event) => {
      const calendar = calendars.find((c) => c.id === event.calendarId) ?? null;
      const era = calendar?.eras.find((e) => e.id === event.eraId) ?? null;
      return {
        event,
        absoluteYear: absoluteYear(event, calendars),
        calendar,
        era,
        calendarName: calendar?.name ?? "Unknown calendar",
        eraName: era?.name ?? "Unassigned era",
        searchText: [
          event.title,
          event.description ?? "",
          calendar?.name ?? "",
          era?.name ?? "",
          event.importance,
        ]
          .join(" ")
          .toLowerCase(),
      };
    })
    .sort(compareResolvedEvents);
}

export function filterResolvedTimelineEvents(
  events: ResolvedTimelineEvent[],
  filters: TimelineFilters,
): ResolvedTimelineEvent[] {
  const query = filters.search?.trim().toLowerCase();
  return events.filter((entry) => {
    if (filters.calendarId && entry.event.calendarId !== filters.calendarId) return false;
    if (filters.importance && entry.event.importance !== filters.importance) return false;
    if (filters.minAbsoluteYear !== undefined && entry.absoluteYear < filters.minAbsoluteYear) return false;
    if (filters.maxAbsoluteYear !== undefined && entry.absoluteYear > filters.maxAbsoluteYear) return false;
    if (query && !entry.searchText.includes(query)) return false;
    return true;
  });
}

export interface TimelineAbsoluteWindow {
  min: number;
  max: number;
}

export function timelineAbsoluteWindow(
  events: ResolvedTimelineEvent[],
  requested?: Partial<TimelineAbsoluteWindow> | null,
): TimelineAbsoluteWindow | null {
  if (events.length === 0) return null;

  let min = events[0]!.absoluteYear;
  let max = events[events.length - 1]!.absoluteYear;

  if (requested?.min !== undefined) min = Math.max(min, requested.min);
  if (requested?.max !== undefined) max = Math.min(max, requested.max);
  if (min > max) {
    const midpoint = Math.round((min + max) / 2);
    min = midpoint;
    max = midpoint;
  }

  return { min, max };
}

export function buildChronicleGroups(
  events: ResolvedTimelineEvent[],
  calendars: CalendarSystem[],
): ChronicleCalendarGroup[] {
  const groups: ChronicleCalendarGroup[] = [];

  for (const calendar of calendars) {
    const calendarEvents = events.filter((entry) => entry.event.calendarId === calendar.id);
    const eraGroups: ChronicleEraGroup[] = [...calendar.eras]
      .sort((a, b) => a.startYear - b.startYear)
      .map((era) => ({
        id: `${calendar.id}:${era.id}`,
        calendarId: calendar.id,
        calendarName: calendar.name,
        era,
        eraName: era.name,
        startYear: era.startYear,
        events: calendarEvents.filter((entry) => entry.event.eraId === era.id),
        isMissingEra: false,
      }));

    const missingEraEvents = calendarEvents.filter(
      (entry) => !calendar.eras.some((era) => era.id === entry.event.eraId),
    );
    if (missingEraEvents.length > 0) {
      groups.push({
        id: calendar.id,
        calendar,
        calendarName: calendar.name,
        eras: [
          ...eraGroups,
          {
            id: `${calendar.id}:missing-era`,
            calendarId: calendar.id,
            calendarName: calendar.name,
            era: null,
            eraName: "Unassigned era",
            startYear: missingEraEvents[0]?.absoluteYear ?? null,
            events: missingEraEvents,
            isMissingEra: true,
          },
        ],
        visibleEventCount: calendarEvents.length,
        isMissingCalendar: false,
      });
      continue;
    }

    groups.push({
      id: calendar.id,
      calendar,
      calendarName: calendar.name,
      eras: eraGroups,
      visibleEventCount: calendarEvents.length,
      isMissingCalendar: false,
    });
  }

  const missingCalendarEvents = events.filter(
    (entry) => !calendars.some((calendar) => calendar.id === entry.event.calendarId),
  );
  if (missingCalendarEvents.length > 0) {
    groups.push({
      id: "missing-calendar",
      calendar: null,
      calendarName: "Unknown calendar",
      eras: [
        {
          id: "missing-calendar:missing-era",
          calendarId: "missing-calendar",
          calendarName: "Unknown calendar",
          era: null,
          eraName: "Unassigned era",
          startYear: missingCalendarEvents[0]?.absoluteYear ?? null,
          events: missingCalendarEvents,
          isMissingEra: true,
        },
      ],
      visibleEventCount: missingCalendarEvents.length,
      isMissingCalendar: true,
    });
  }

  return groups;
}

export function getTimelineNeighbors(
  events: ResolvedTimelineEvent[],
  selectedEventId: string | null,
): TimelineNeighbors {
  const selectedIndex = selectedEventId
    ? events.findIndex((entry) => entry.event.id === selectedEventId)
    : -1;

  return {
    previous: selectedIndex > 0 ? events[selectedIndex - 1]! : null,
    current: selectedIndex >= 0 ? events[selectedIndex]! : null,
    next: selectedIndex >= 0 && selectedIndex < events.length - 1 ? events[selectedIndex + 1]! : null,
    selectedIndex,
    total: events.length,
  };
}
