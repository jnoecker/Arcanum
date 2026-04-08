import { describe, it, expect } from "vitest";
import {
  absoluteYear,
  sortEvents,
  eventRange,
  buildEraBands,
  formatEventDate,
  resolveTimelineEvents,
  filterResolvedTimelineEvents,
  buildChronicleGroups,
  getTimelineNeighbors,
  timelineAbsoluteWindow,
} from "../loreCalendar";
import type { CalendarSystem, TimelineEvent } from "@/types/lore";

const CALENDARS: CalendarSystem[] = [
  {
    id: "ambon",
    name: "The Ambon Reckoning",
    eras: [
      { id: "monsters", name: "Age of Monsters", startYear: 0 },
      { id: "fractures", name: "Age of Fractures", startYear: 185 },
      { id: "embers", name: "Age of Embers", startYear: 260 },
    ],
  },
  {
    id: "royal",
    name: "Royal Ledger",
    eras: [
      { id: "coronation", name: "Crown's Dawn", startYear: 25 },
    ],
  },
];

describe("absoluteYear", () => {
  it("adds era startYear to event year", () => {
    const event: TimelineEvent = {
      id: "e1",
      calendarId: "ambon",
      eraId: "monsters",
      year: 42,
      title: "Founding",
      importance: "major",
    };
    expect(absoluteYear(event, CALENDARS)).toBe(42);
  });

  it("uses second era's startYear", () => {
    const event: TimelineEvent = {
      id: "e2",
      calendarId: "ambon",
      eraId: "fractures",
      year: 10,
      title: "The Sundering",
      importance: "legendary",
    };
    expect(absoluteYear(event, CALENDARS)).toBe(195);
  });

  it("falls back to event.year when calendar not found", () => {
    const event: TimelineEvent = {
      id: "e3",
      calendarId: "unknown",
      eraId: "x",
      year: 99,
      title: "Unknown",
      importance: "minor",
    };
    expect(absoluteYear(event, CALENDARS)).toBe(99);
  });
});

describe("sortEvents", () => {
  it("sorts events by absolute year across calendars", () => {
    const events: TimelineEvent[] = [
      { id: "late", calendarId: "ambon", eraId: "fractures", year: 50, title: "Late", importance: "minor" },
      { id: "court", calendarId: "royal", eraId: "coronation", year: 10, title: "Court", importance: "major" },
      { id: "early", calendarId: "ambon", eraId: "monsters", year: 10, title: "Early", importance: "minor" },
    ];
    const sorted = sortEvents(events, CALENDARS);
    expect(sorted.map((e) => e.id)).toEqual(["early", "court", "late"]);
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
    expect(bands).toHaveLength(4);
    expect(bands[0]!.startYear).toBe(0);
    expect(bands[0]!.endYear).toBe(185);
    expect(bands[2]!.startYear).toBe(260);
    expect(bands[2]!.endYear).toBe(350);
  });
});

describe("formatEventDate", () => {
  it("formats with era name", () => {
    const event: TimelineEvent = {
      id: "e1",
      calendarId: "ambon",
      eraId: "monsters",
      year: 42,
      title: "Founding",
      importance: "major",
    };
    expect(formatEventDate(event, CALENDARS)).toBe("Year 42 of the Age of Monsters");
  });

  it("falls back for missing calendar", () => {
    const event: TimelineEvent = {
      id: "e1",
      calendarId: "unknown",
      eraId: "x",
      year: 5,
      title: "X",
      importance: "minor",
    };
    expect(formatEventDate(event, CALENDARS)).toBe("Year 5");
  });
});

describe("resolveTimelineEvents", () => {
  it("resolves calendar and era metadata for sorted events", () => {
    const events: TimelineEvent[] = [
      { id: "later", calendarId: "ambon", eraId: "fractures", year: 1, title: "Later", importance: "major" },
      { id: "first", calendarId: "royal", eraId: "coronation", year: 0, title: "First", importance: "minor" },
    ];

    const resolved = resolveTimelineEvents(events, CALENDARS);

    expect(resolved.map((entry) => entry.event.id)).toEqual(["first", "later"]);
    expect(resolved[0]?.calendarName).toBe("Royal Ledger");
    expect(resolved[0]?.eraName).toBe("Crown's Dawn");
  });
});

describe("filterResolvedTimelineEvents", () => {
  it("filters by search, calendar, and importance together", () => {
    const events: TimelineEvent[] = [
      {
        id: "sundering",
        calendarId: "ambon",
        eraId: "fractures",
        year: 4,
        title: "The Sundering",
        description: "A legendary rupture in the sky.",
        importance: "legendary",
      },
      {
        id: "charter",
        calendarId: "royal",
        eraId: "coronation",
        year: 8,
        title: "Guild Charter",
        description: "Trade accords drafted in the lower court.",
        importance: "major",
      },
    ];

    const resolved = resolveTimelineEvents(events, CALENDARS);
    const filtered = filterResolvedTimelineEvents(resolved, {
      search: "rupture",
      calendarId: "ambon",
      importance: "legendary",
    });

    expect(filtered.map((entry) => entry.event.id)).toEqual(["sundering"]);
  });

  it("filters by an absolute-year window", () => {
    const events: TimelineEvent[] = [
      { id: "early", calendarId: "ambon", eraId: "monsters", year: 8, title: "Early", importance: "minor" },
      { id: "middle", calendarId: "royal", eraId: "coronation", year: 20, title: "Middle", importance: "major" },
      { id: "late", calendarId: "ambon", eraId: "fractures", year: 5, title: "Late", importance: "legendary" },
    ];

    const resolved = resolveTimelineEvents(events, CALENDARS);
    const filtered = filterResolvedTimelineEvents(resolved, {
      minAbsoluteYear: 30,
      maxAbsoluteYear: 60,
    });

    expect(filtered.map((entry) => entry.event.id)).toEqual(["middle"]);
  });
});

describe("buildChronicleGroups", () => {
  it("keeps empty eras so the UI can render full calendar structure", () => {
    const events: TimelineEvent[] = [
      { id: "one", calendarId: "ambon", eraId: "monsters", year: 1, title: "One", importance: "minor" },
    ];

    const groups = buildChronicleGroups(resolveTimelineEvents(events, CALENDARS), CALENDARS);
    const ambon = groups.find((group) => group.id === "ambon");

    expect(ambon?.eras).toHaveLength(3);
    expect(ambon?.eras[1]?.events).toHaveLength(0);
    expect(ambon?.eras[2]?.events).toHaveLength(0);
  });

  it("creates a synthetic era group for missing era references", () => {
    const events: TimelineEvent[] = [
      { id: "lost", calendarId: "ambon", eraId: "missing", year: 7, title: "Lost", importance: "major" },
    ];

    const groups = buildChronicleGroups(resolveTimelineEvents(events, CALENDARS), CALENDARS);
    const ambon = groups.find((group) => group.id === "ambon");
    const missingEra = ambon?.eras.find((era) => era.isMissingEra);

    expect(missingEra?.events.map((entry) => entry.event.id)).toEqual(["lost"]);
  });

  it("creates an unknown-calendar bucket for orphaned events", () => {
    const events: TimelineEvent[] = [
      { id: "orphan", calendarId: "missing", eraId: "void", year: 3, title: "Orphan", importance: "minor" },
    ];

    const groups = buildChronicleGroups(resolveTimelineEvents(events, CALENDARS), CALENDARS);
    const missingCalendar = groups.find((group) => group.isMissingCalendar);

    expect(missingCalendar?.visibleEventCount).toBe(1);
    expect(missingCalendar?.eras[0]?.events[0]?.event.id).toBe("orphan");
  });
});

describe("getTimelineNeighbors", () => {
  it("returns previous and next entries around the selected event", () => {
    const events: TimelineEvent[] = [
      { id: "a", calendarId: "ambon", eraId: "monsters", year: 1, title: "A", importance: "minor" },
      { id: "b", calendarId: "royal", eraId: "coronation", year: 2, title: "B", importance: "major" },
      { id: "c", calendarId: "ambon", eraId: "fractures", year: 0, title: "C", importance: "legendary" },
    ];

    const neighbors = getTimelineNeighbors(resolveTimelineEvents(events, CALENDARS), "b");

    expect(neighbors.previous?.event.id).toBe("a");
    expect(neighbors.current?.event.id).toBe("b");
    expect(neighbors.next?.event.id).toBe("c");
    expect(neighbors.selectedIndex).toBe(1);
  });
});

describe("timelineAbsoluteWindow", () => {
  it("returns the full span when no requested window is provided", () => {
    const events: TimelineEvent[] = [
      { id: "a", calendarId: "ambon", eraId: "monsters", year: 3, title: "A", importance: "minor" },
      { id: "b", calendarId: "ambon", eraId: "fractures", year: 10, title: "B", importance: "major" },
    ];

    const window = timelineAbsoluteWindow(resolveTimelineEvents(events, CALENDARS));

    expect(window).toEqual({ min: 3, max: 195 });
  });

  it("clamps requested bounds to the visible event span", () => {
    const events: TimelineEvent[] = [
      { id: "a", calendarId: "ambon", eraId: "monsters", year: 3, title: "A", importance: "minor" },
      { id: "b", calendarId: "ambon", eraId: "fractures", year: 10, title: "B", importance: "major" },
    ];

    const window = timelineAbsoluteWindow(resolveTimelineEvents(events, CALENDARS), { min: -99, max: 999 });

    expect(window).toEqual({ min: 3, max: 195 });
  });
});
