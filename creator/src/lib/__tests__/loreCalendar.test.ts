import { describe, it, expect } from "vitest";
import { absoluteYear, sortEvents, eventRange, buildEraBands, formatEventDate } from "../loreCalendar";
import type { CalendarSystem, TimelineEvent } from "@/types/lore";

const CALENDARS: CalendarSystem[] = [
  {
    id: "ambon",
    name: "The Ambon Reckoning",
    eras: [
      { id: "monsters", name: "Age of Monsters", startYear: 0 },
      { id: "fractures", name: "Age of Fractures", startYear: 185 },
    ],
  },
];

describe("absoluteYear", () => {
  it("adds era startYear to event year", () => {
    const event: TimelineEvent = {
      id: "e1", calendarId: "ambon", eraId: "monsters", year: 42,
      title: "Founding", importance: "major",
    };
    expect(absoluteYear(event, CALENDARS)).toBe(42);
  });

  it("uses second era's startYear", () => {
    const event: TimelineEvent = {
      id: "e2", calendarId: "ambon", eraId: "fractures", year: 10,
      title: "The Sundering", importance: "legendary",
    };
    expect(absoluteYear(event, CALENDARS)).toBe(195);
  });

  it("falls back to event.year when calendar not found", () => {
    const event: TimelineEvent = {
      id: "e3", calendarId: "unknown", eraId: "x", year: 99,
      title: "Unknown", importance: "minor",
    };
    expect(absoluteYear(event, CALENDARS)).toBe(99);
  });
});

describe("sortEvents", () => {
  it("sorts events by absolute year", () => {
    const events: TimelineEvent[] = [
      { id: "late", calendarId: "ambon", eraId: "fractures", year: 50, title: "Late", importance: "minor" },
      { id: "early", calendarId: "ambon", eraId: "monsters", year: 10, title: "Early", importance: "minor" },
    ];
    const sorted = sortEvents(events, CALENDARS);
    expect(sorted.map((e) => e.id)).toEqual(["early", "late"]);
  });
});

describe("eventRange", () => {
  it("returns min/max with padding", () => {
    const events: TimelineEvent[] = [
      { id: "a", calendarId: "ambon", eraId: "monsters", year: 0, title: "A", importance: "minor" },
      { id: "b", calendarId: "ambon", eraId: "fractures", year: 100, title: "B", importance: "minor" },
    ];
    const range = eventRange(events, CALENDARS);
    expect(range.min).toBeLessThan(0);
    expect(range.max).toBeGreaterThan(285);
  });

  it("returns defaults for empty events", () => {
    const range = eventRange([], CALENDARS);
    expect(range.min).toBe(0);
    expect(range.max).toBe(100);
  });
});

describe("buildEraBands", () => {
  it("builds bands from eras with correct start/end", () => {
    const bands = buildEraBands(CALENDARS, 300);
    expect(bands).toHaveLength(2);
    expect(bands[0]!.startYear).toBe(0);
    expect(bands[0]!.endYear).toBe(185);
    expect(bands[1]!.startYear).toBe(185);
    expect(bands[1]!.endYear).toBe(350); // timelineMax + 50
  });
});

describe("formatEventDate", () => {
  it("formats with era name", () => {
    const event: TimelineEvent = {
      id: "e1", calendarId: "ambon", eraId: "monsters", year: 42,
      title: "Founding", importance: "major",
    };
    expect(formatEventDate(event, CALENDARS)).toBe("Year 42 of the Age of Monsters");
  });

  it("falls back for missing calendar", () => {
    const event: TimelineEvent = {
      id: "e1", calendarId: "unknown", eraId: "x", year: 5,
      title: "X", importance: "minor",
    };
    expect(formatEventDate(event, CALENDARS)).toBe("Year 5");
  });
});
