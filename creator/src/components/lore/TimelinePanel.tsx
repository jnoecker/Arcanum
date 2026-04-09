import { useState, useCallback, useEffect, useMemo } from "react";
import { useLoreStore, selectArticles, selectCalendars, selectEvents } from "@/stores/loreStore";
import type { CalendarSystem, CalendarEra, TimelineEvent } from "@/types/lore";
import {
  buildChronicleGroups,
  filterResolvedTimelineEvents,
  formatEventDate,
  getTimelineNeighbors,
  resolveTimelineEvents,
  timelineAbsoluteWindow,
  type ResolvedTimelineEvent,
} from "@/lib/loreCalendar";
import {
  ActionButton,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { getTimelineEventPrompt, getTimelineEventContext } from "@/lib/loreArtPrompts";
import type { AssetContext } from "@/types/assets";
import { TimelineView } from "./TimelineView";
import { TimelineInferencePanel } from "./TimelineInferencePanel";

const IMPORTANCE_OPTIONS: Array<{ value: TimelineEvent["importance"]; label: string }> = [
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "legendary", label: "Legendary" },
];

const IMPORTANCE_FILTER_OPTIONS = [
  { value: "all", label: "All importance" },
  ...IMPORTANCE_OPTIONS,
];

function formatYear(value: number) {
  return new Intl.NumberFormat().format(value);
}

function parseYearInput(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function importanceClasses(importance: TimelineEvent["importance"]) {
  if (importance === "legendary") {
    return {
      dot: "bg-[var(--color-warm)] shadow-[0_0_18px_rgba(200,164,106,0.32)]",
      pill: "border-[rgba(200,164,106,0.28)] bg-[rgba(200,164,106,0.12)] text-[var(--color-warm-pale)]",
    };
  }
  if (importance === "major") {
    return {
      dot: "bg-accent shadow-[0_0_18px_rgba(168,151,210,0.24)]",
      pill: "border-[var(--border-accent-subtle)] bg-[var(--bg-accent-subtle)] text-text-primary",
    };
  }
  return {
    dot: "bg-[var(--color-stellar-blue)]",
    pill: "border-border-muted/50 bg-bg-secondary/50 text-text-secondary",
  };
}

function FilterPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1 text-2xs text-text-muted">
      {label}
    </span>
  );
}

function UtilityToggle({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`focus-ring flex min-h-11 items-center justify-between gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition ${
        open
          ? "border-[var(--border-accent-ring)] bg-[var(--bg-active)] text-text-primary shadow-[var(--shadow-glow)]"
          : "border-border-muted/40 bg-bg-secondary/35 text-text-secondary hover:border-[var(--chrome-stroke-emphasis)] hover:bg-bg-secondary/55"
      }`}
    >
      <p className="min-w-0 font-display text-base text-text-primary">{title}</p>
      <span className="shrink-0 text-xs text-text-muted">{open ? "Hide" : "Show"}</span>
    </button>
  );
}

function CalendarEditor({
  calendars,
  onChange,
}: {
  calendars: CalendarSystem[];
  onChange: (calendars: CalendarSystem[]) => void;
}) {
  const [newName, setNewName] = useState("");

  const addCalendar = () => {
    const name = newName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (calendars.some((c) => c.id === id)) return;
    onChange([...calendars, { id, name, eras: [] }]);
    setNewName("");
  };

  const patchCalendar = (id: string, patch: Partial<CalendarSystem>) => {
    onChange(calendars.map((calendar) => (calendar.id === id ? { ...calendar, ...patch } : calendar)));
  };

  const deleteCalendar = (id: string) => {
    onChange(calendars.filter((calendar) => calendar.id !== id));
  };

  const addEra = (calendarId: string) => {
    const calendar = calendars.find((entry) => entry.id === calendarId);
    if (!calendar) return;
    const era: CalendarEra = {
      id: `era_${Date.now()}`,
      name: "New Era",
      startYear: calendar.eras.length > 0 ? calendar.eras[calendar.eras.length - 1]!.startYear + 100 : 0,
    };
    patchCalendar(calendarId, { eras: [...calendar.eras, era] });
  };

  const patchEra = (calendarId: string, eraId: string, patch: Partial<CalendarEra>) => {
    const calendar = calendars.find((entry) => entry.id === calendarId);
    if (!calendar) return;
    patchCalendar(calendarId, {
      eras: calendar.eras.map((era) => (era.id === eraId ? { ...era, ...patch } : era)),
    });
  };

  const deleteEra = (calendarId: string, eraId: string) => {
    const calendar = calendars.find((entry) => entry.id === calendarId);
    if (!calendar) return;
    patchCalendar(calendarId, { eras: calendar.eras.filter((era) => era.id !== eraId) });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.65rem] uppercase tracking-[0.28em] text-[var(--color-warm)]/80">
        Calendar Setup
      </p>

      {calendars.length === 0 && (
        <div className="rounded-[1.4rem] border border-dashed border-border-muted/50 bg-bg-secondary/20 px-4 py-6 text-sm text-text-muted">
          No calendar systems exist yet. Add one below to begin placing dated events.
        </div>
      )}

      {calendars.map((calendar) => (
        <div
          key={calendar.id}
          className="rounded-[1.5rem] border border-border-muted/45 bg-[linear-gradient(180deg,rgba(25,31,48,0.94),rgba(16,20,31,0.94))] p-4 shadow-[var(--shadow-section)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Calendar name"
              className="ornate-input min-h-11 min-w-0 flex-1 rounded-2xl bg-[var(--chrome-fill)] px-4 py-3 text-sm text-text-primary"
              value={calendar.name}
              onChange={(e) => patchCalendar(calendar.id, { name: e.target.value })}
            />
            <IconButton onClick={() => addEra(calendar.id)} title="Add era">
              +
            </IconButton>
            <IconButton onClick={() => deleteCalendar(calendar.id)} title="Delete calendar" danger>
              x
            </IconButton>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {calendar.eras.map((era) => (
              <div
                key={era.id}
                className="grid gap-2 rounded-[1.1rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
              >
                <input
                  type="color"
                  aria-label={`Color for ${era.name}`}
                  value={era.color || "#a897d2"}
                  onChange={(e) => patchEra(calendar.id, era.id, { color: e.target.value })}
                  className="h-11 w-11 cursor-pointer rounded-full border border-[var(--chrome-stroke)] bg-transparent p-1"
                  title="Era color"
                />
                <input
                  aria-label="Era name"
                  className="ornate-input min-h-11 min-w-0 rounded-2xl px-4 py-3 text-sm text-text-primary"
                  value={era.name}
                  onChange={(e) => patchEra(calendar.id, era.id, { name: e.target.value })}
                  placeholder="Era name"
                />
                <label className="flex items-center gap-2 text-2xs uppercase tracking-[0.22em] text-text-muted">
                  <span>Starts</span>
                  <input
                    type="number"
                    aria-label={`Start year for ${era.name}`}
                    className="ornate-input min-h-11 w-28 rounded-2xl px-3 py-3 text-sm text-text-primary"
                    value={era.startYear}
                    onChange={(e) => patchEra(calendar.id, era.id, { startYear: Number(e.target.value) || 0 })}
                  />
                </label>
                <IconButton onClick={() => deleteEra(calendar.id, era.id)} title="Delete era" danger>
                  x
                </IconButton>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <input
          className="ornate-input min-h-11 min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm text-text-primary"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCalendar()}
          placeholder="New calendar system name"
        />
        <ActionButton onClick={addCalendar} disabled={!newName.trim()} variant="secondary">
          Add Calendar
        </ActionButton>
      </div>
    </div>
  );
}

function EventInspector({
  resolvedEvent,
  calendars,
  previous,
  next,
  onNavigate,
  onUpdate,
  onDelete,
}: {
  resolvedEvent: ResolvedTimelineEvent | null;
  calendars: CalendarSystem[];
  previous: ResolvedTimelineEvent | null;
  next: ResolvedTimelineEvent | null;
  onNavigate: (id: string) => void;
  onUpdate: (patch: Partial<TimelineEvent>) => void;
  onDelete: () => void;
}) {
  const articles = useLoreStore(selectArticles);
  const selectArticle = useLoreStore((s) => s.selectArticle);

  if (!resolvedEvent) {
    return (
      <aside className="rounded-[2rem] border border-border-muted/40 bg-[linear-gradient(180deg,rgba(16,20,31,0.96),rgba(10,12,21,0.98))] p-5 shadow-[var(--shadow-panel)]">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-[var(--color-warm)]/80">
          Event Inspector
        </p>
        <h2 className="mt-3 font-display text-2xl text-[var(--color-warm-pale)]">
          No event selected
        </h2>
      </aside>
    );
  }

  const { event, absoluteYear, calendarName, eraName } = resolvedEvent;
  const calendar = calendars.find((entry) => entry.id === event.calendarId);
  const calendarOptions = [
    ...(calendar
      ? []
      : event.calendarId
        ? [{ value: event.calendarId, label: `Missing calendar (${event.calendarId})` }]
        : [{ value: "", label: "No calendar" }]),
    ...calendars.map((entry) => ({ value: entry.id, label: entry.name })),
  ];
  const eraOptions = [
    ...(calendar?.eras.some((era) => era.id === event.eraId) || !event.eraId
      ? []
      : [{ value: event.eraId, label: `Missing era (${event.eraId})` }]),
    { value: "", label: "No era" },
    ...(calendar?.eras ?? []).map((era) => ({ value: era.id, label: era.name })),
  ];
  const articleOptions = [
    { value: "", label: "-- none --" },
    ...Object.values(articles)
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((article) => ({ value: article.id, label: article.title })),
  ];
  const selectedArticle = event.articleId ? articles[event.articleId] : undefined;
  const style = importanceClasses(event.importance);

  return (
    <aside className="rounded-[2rem] border border-border-muted/40 bg-[linear-gradient(180deg,rgba(16,20,31,0.96),rgba(10,12,21,0.98))] p-5 shadow-[var(--shadow-panel)] xl:sticky xl:top-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-[var(--color-warm)]/80">
            Event Inspector
          </p>
          <h2 className="mt-3 font-display text-2xl leading-tight text-[var(--color-warm-pale)]">
            {event.title}
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            {formatEventDate(event, calendars)}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-2xs uppercase tracking-[0.2em] ${style.pill}`}>
          {event.importance}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-[1.2rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Calendar</p>
          <p className="mt-1 font-display text-lg text-text-primary">{calendarName}</p>
        </div>
        <div className="rounded-[1.2rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Absolute Year</p>
          <p className="mt-1 font-display text-lg text-text-primary">{formatYear(absoluteYear)}</p>
          <p className="text-2xs text-text-muted">{eraName}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <ActionButton
          onClick={() => previous && onNavigate(previous.event.id)}
          disabled={!previous}
          variant="ghost"
          size="sm"
          className="flex-1"
        >
          Previous
        </ActionButton>
        <ActionButton
          onClick={() => next && onNavigate(next.event.id)}
          disabled={!next}
          variant="ghost"
          size="sm"
          className="flex-1"
        >
          Next
        </ActionButton>
      </div>

      <div className="mt-5 flex flex-col gap-1.5">
        <FieldRow label="Title">
          <TextInput value={event.title} onCommit={(value) => onUpdate({ title: value })} />
        </FieldRow>
        <FieldRow label="Calendar">
          <SelectInput
            value={event.calendarId}
            options={calendarOptions}
            onCommit={(value) => {
              const nextCalendar = calendars.find((entry) => entry.id === value);
              const nextEraId = nextCalendar?.eras.some((era) => era.id === event.eraId)
                ? event.eraId
                : (nextCalendar?.eras[0]?.id ?? "");
              onUpdate({ calendarId: value, eraId: nextEraId });
            }}
          />
        </FieldRow>
        <FieldRow label="Era">
          <SelectInput
            value={event.eraId}
            options={eraOptions}
            onCommit={(value) => onUpdate({ eraId: value })}
          />
        </FieldRow>
        <FieldRow label="Year">
          <NumberInput value={event.year} onCommit={(value) => onUpdate({ year: value ?? 0 })} />
        </FieldRow>
        <FieldRow label="Importance">
          <SelectInput
            value={event.importance}
            options={IMPORTANCE_OPTIONS}
            onCommit={(value) => onUpdate({ importance: value as TimelineEvent["importance"] })}
          />
        </FieldRow>
        <FieldRow label="Article">
          <SelectInput
            value={event.articleId ?? ""}
            options={articleOptions}
            onCommit={(value) => onUpdate({ articleId: value || undefined })}
          />
        </FieldRow>
        <FieldRow label="Description">
          <TextInput
            value={event.description ?? ""}
            onCommit={(value) => onUpdate({ description: value || undefined })}
            placeholder="Short chronicle note"
            dense
          />
        </FieldRow>
      </div>

      <div className="mt-5 rounded-[1.2rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-4 py-4">
        <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Linked Article</p>
        {selectedArticle ? (
          <>
            <p className="mt-2 font-display text-lg text-text-primary">{selectedArticle.title}</p>
            <button
              type="button"
              onClick={() => selectArticle(selectedArticle.id)}
              className="focus-ring mt-3 rounded-full border border-[var(--border-accent-subtle)] px-3 py-1 text-2xs text-accent transition hover:bg-[var(--bg-accent-subtle)]"
            >
              Jump to article
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-text-muted">None</p>
        )}
      </div>

      <div className="mt-5 rounded-[1.2rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-4 py-4">
        <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Event Image</p>
        <p className="mt-1 text-2xs text-text-muted/80">
          Renders as a transparent backdrop on the timeline. Independent of any linked article.
        </p>
        <div className="mt-3">
          <FieldRow label="Filename">
            <TextInput
              value={event.image ?? ""}
              onCommit={(value) => onUpdate({ image: value || undefined })}
              placeholder="None"
            />
          </FieldRow>
        </div>
        <div className="mt-3">
          <EntityArtGenerator
            getPrompt={(style) => getTimelineEventPrompt(event, style)}
            entityContext={getTimelineEventContext(event)}
            currentImage={event.image}
            onAccept={(filePath) => onUpdate({ image: filePath })}
            assetType="lore_event"
            context={{
              zone: "lore",
              entity_type: "lore_event",
              entity_id: event.id,
            } satisfies AssetContext}
            surface="lore"
          />
        </div>
      </div>

      <div className="mt-5">
        <ActionButton onClick={onDelete} variant="danger" size="sm">
          Delete Event
        </ActionButton>
      </div>
    </aside>
  );
}

function ChronicleEventRow({
  entry,
  selected,
  onSelect,
  onMoveSelection,
}: {
  entry: ResolvedTimelineEvent;
  selected: boolean;
  onSelect: () => void;
  onMoveSelection: (direction: "prev" | "next") => void;
}) {
  const style = importanceClasses(entry.event.importance);

  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onMoveSelection("next");
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onMoveSelection("prev");
        }
      }}
      className={`focus-ring group relative grid w-full gap-4 rounded-[1.35rem] border px-4 py-4 text-left transition md:grid-cols-[9.5rem_minmax(0,1fr)] ${
        selected
          ? "border-[var(--border-accent-ring)] bg-[linear-gradient(145deg,rgba(168,151,210,0.16),rgba(28,33,49,0.92))] shadow-[var(--shadow-glow)]"
          : "border-transparent bg-transparent hover:border-border-muted/40 hover:bg-bg-secondary/25"
      }`}
      aria-pressed={selected}
    >
      <span
        className={`absolute left-[-0.68rem] top-8 h-3.5 w-3.5 rounded-full border border-bg-primary ${style.dot}`}
        aria-hidden="true"
      />

      <div className="pl-4 md:pl-0">
        <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">{entry.eraName}</p>
        <p className="mt-2 font-display text-3xl leading-none text-[var(--color-warm-pale)]">
          Y{formatYear(entry.event.year)}
        </p>
        <p className="mt-2 text-2xs uppercase tracking-[0.2em] text-text-muted">
          Absolute {formatYear(entry.absoluteYear)}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="break-words font-display text-2xl leading-tight text-text-primary">
            {entry.event.title}
          </h4>
          <span className={`rounded-full border px-2.5 py-1 text-2xs uppercase tracking-[0.18em] ${style.pill}`}>
            {entry.event.importance}
          </span>
        </div>

        {entry.event.description && (
          <p className="mt-3 break-words text-sm leading-7 text-text-secondary">
            {entry.event.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-text-muted">
          <span>{entry.calendarName}</span>
          {entry.event.articleId && (
            <>
              <span className="text-text-muted/60">/</span>
              <span>Linked article</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

export function TimelinePanel() {
  const calendars = useLoreStore(selectCalendars);
  const events = useLoreStore(selectEvents);
  const setCalendars = useLoreStore((s) => s.setCalendarSystems);
  const addEvent = useLoreStore((s) => s.addTimelineEvent);
  const updateEvent = useLoreStore((s) => s.updateTimelineEvent);
  const deleteEvent = useLoreStore((s) => s.deleteTimelineEvent);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [calendarFilter, setCalendarFilter] = useState("all");
  const [importanceFilter, setImportanceFilter] = useState("all");
  const [windowStart, setWindowStart] = useState<string>("");
  const [windowEnd, setWindowEnd] = useState<string>("");
  const [showCalendarSetup, setShowCalendarSetup] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const resolvedEvents = useMemo(() => resolveTimelineEvents(events, calendars), [events, calendars]);
  const baseFilteredEvents = useMemo(
    () =>
      filterResolvedTimelineEvents(resolvedEvents, {
        search,
        calendarId: calendarFilter === "all" ? undefined : calendarFilter,
        importance:
          importanceFilter === "all"
            ? undefined
            : (importanceFilter as TimelineEvent["importance"]),
      }),
    [calendarFilter, importanceFilter, resolvedEvents, search],
  );
  const activeWindow = useMemo(
    () =>
      timelineAbsoluteWindow(baseFilteredEvents, {
        min: parseYearInput(windowStart),
        max: parseYearInput(windowEnd),
      }),
    [baseFilteredEvents, windowEnd, windowStart],
  );
  const filteredEvents = useMemo(
    () =>
      filterResolvedTimelineEvents(baseFilteredEvents, {
        minAbsoluteYear: activeWindow?.min,
        maxAbsoluteYear: activeWindow?.max,
      }),
    [activeWindow?.max, activeWindow?.min, baseFilteredEvents],
  );
  const chronicleGroups = useMemo(
    () => buildChronicleGroups(filteredEvents, calendars).filter((group) => group.visibleEventCount > 0),
    [filteredEvents, calendars],
  );
  const neighbors = useMemo(
    () => getTimelineNeighbors(filteredEvents, selectedEventId),
    [filteredEvents, selectedEventId],
  );

  useEffect(() => {
    if (!selectedEventId) return;
    if (!filteredEvents.some((entry) => entry.event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [filteredEvents, selectedEventId]);

  const handleAddEvent = useCallback(() => {
    const calendar = calendars[0];
    if (!calendar) return;
    const era = calendar.eras[0];
    const event: TimelineEvent = {
      id: `evt_${Date.now()}`,
      calendarId: calendar.id,
      eraId: era?.id ?? "",
      year: 0,
      title: "New Event",
      importance: "minor",
    };
    addEvent(event);
    setSelectedEventId(event.id);
  }, [calendars, addEvent]);

  const handleMoveSelection = useCallback(
    (direction: "prev" | "next") => {
      const target = direction === "prev" ? neighbors.previous : neighbors.next;
      if (target) {
        setSelectedEventId(target.event.id);
      }
    },
    [neighbors.next, neighbors.previous],
  );
  const selectedResolved = neighbors.current;

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setCalendarFilter("all");
    setImportanceFilter("all");
    setWindowStart("");
    setWindowEnd("");
  }, []);

  const fullWindow = useMemo(() => timelineAbsoluteWindow(baseFilteredEvents), [baseFilteredEvents]);

  const handleResetWindow = useCallback(() => {
    setWindowStart("");
    setWindowEnd("");
  }, []);

  const handleFocusSelectedEra = useCallback(() => {
    if (!selectedResolved) return;
    const era = selectedResolved.era;
    if (!era) {
      setWindowStart(String(selectedResolved.absoluteYear));
      setWindowEnd(String(selectedResolved.absoluteYear));
      return;
    }
    const sortedEras = [...(selectedResolved.calendar?.eras ?? [])].sort((a, b) => a.startYear - b.startYear);
    const currentIndex = sortedEras.findIndex((entry) => entry.id === era.id);
    const nextStart = currentIndex >= 0 ? sortedEras[currentIndex + 1]?.startYear : undefined;
    const end = nextStart !== undefined ? nextStart - 1 : Math.max(selectedResolved.absoluteYear, era.startYear + 50);
    setWindowStart(String(era.startYear));
    setWindowEnd(String(end));
  }, [selectedResolved]);

  const hasActiveFilters =
    search.trim().length > 0 || calendarFilter !== "all" || importanceFilter !== "all" || windowStart.trim().length > 0 || windowEnd.trim().length > 0;
  const visibleCalendarCount = new Set(filteredEvents.map((entry) => entry.event.calendarId)).size;
  const calendarLabel =
    calendarFilter === "all"
      ? `${visibleCalendarCount || calendars.length || 0} calendar${(visibleCalendarCount || calendars.length || 0) === 1 ? "" : "s"}`
      : (calendars.find((entry) => entry.id === calendarFilter)?.name ?? "Unknown calendar");

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border-muted/40 bg-[radial-gradient(circle_at_top_left,rgba(200,164,106,0.12),transparent_36%),linear-gradient(155deg,rgba(18,22,35,0.98),rgba(10,12,22,0.96))] p-6 shadow-[var(--shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.32em] text-[var(--color-warm)]/80">
              Chronicle Workspace
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-warm-pale)] sm:text-4xl">
              Timeline
            </h1>
          </div>
          <ActionButton onClick={handleAddEvent} variant="primary" disabled={calendars.length === 0}>
            Add Event
          </ActionButton>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)_minmax(10rem,0.55fr)_minmax(10rem,0.55fr)_auto]">
          <label className="flex flex-col gap-2">
            <span className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles, notes, eras, or importance"
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              aria-label="Search timeline events"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Calendar</span>
            <select
              value={calendarFilter}
              onChange={(e) => setCalendarFilter(e.target.value)}
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              aria-label="Filter by calendar"
            >
              <option value="all">All calendars</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Importance</span>
            <select
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(e.target.value)}
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              aria-label="Filter by importance"
            >
              {IMPORTANCE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">From</span>
            <input
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              inputMode="numeric"
              placeholder={fullWindow ? String(fullWindow.min) : ""}
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              aria-label="Timeline range start year"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">To</span>
            <input
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              inputMode="numeric"
              placeholder={fullWindow ? String(fullWindow.max) : ""}
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              aria-label="Timeline range end year"
            />
          </label>

          <div className="flex items-end">
            <ActionButton
              onClick={handleClearFilters}
              variant="ghost"
              disabled={!hasActiveFilters}
              className="w-full xl:w-auto"
            >
              Clear Filters
            </ActionButton>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <FilterPill label={`${filteredEvents.length} visible of ${events.length}`} />
          <FilterPill label={calendarLabel} />
          <FilterPill
            label={
              importanceFilter === "all"
                ? "all importance"
                : `${importanceFilter} only`
            }
          />
          {activeWindow && fullWindow && (activeWindow.min !== fullWindow.min || activeWindow.max !== fullWindow.max) && (
            <FilterPill label={`${formatYear(activeWindow.min)}-${formatYear(activeWindow.max)}`} />
          )}
          {search.trim() && <FilterPill label={`search: ${search.trim()}`} />}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton onClick={handleResetWindow} variant="ghost" size="sm" disabled={windowStart.trim() === "" && windowEnd.trim() === ""}>
            Full Range
          </ActionButton>
          <ActionButton onClick={handleFocusSelectedEra} variant="ghost" size="sm" disabled={!selectedResolved}>
            Selected Era
          </ActionButton>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <UtilityToggle
            title="AI Suggestions"
            open={showSuggestions}
            onToggle={() => setShowSuggestions((value) => !value)}
          />
          <UtilityToggle
            title="Calendar Setup"
            open={showCalendarSetup}
            onToggle={() => setShowCalendarSetup((value) => !value)}
          />
        </div>
      </section>

      <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1.65fr)_24rem]">
        <section className="min-h-[44rem] rounded-[2rem] border border-border-muted/40 bg-[linear-gradient(180deg,rgba(16,20,31,0.96),rgba(10,12,21,0.98))] p-5 shadow-[var(--shadow-panel)]">
          {(showSuggestions || showCalendarSetup) && (
            <div className="mb-5 flex flex-col gap-4">
              {showSuggestions && (
                <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(25,31,48,0.92),rgba(15,18,29,0.94))] p-5">
                  <TimelineInferencePanel />
                </div>
              )}
              {showCalendarSetup && (
                <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(25,31,48,0.92),rgba(15,18,29,0.94))] p-5">
                  <CalendarEditor calendars={calendars} onChange={setCalendars} />
                </div>
              )}
            </div>
          )}

          {calendars.length === 0 ? (
            <div className="flex min-h-[30rem] flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-dashed border-border-muted/45 bg-bg-secondary/10 px-6 text-center">
              <p className="font-display text-2xl text-[var(--color-warm-pale)]">No calendar systems yet</p>
              <ActionButton onClick={() => setShowCalendarSetup(true)} variant="secondary">
                Open Calendar Setup
              </ActionButton>
            </div>
          ) : events.length === 0 ? (
            <div className="flex min-h-[30rem] flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-dashed border-border-muted/45 bg-bg-secondary/10 px-6 text-center">
              <p className="font-display text-2xl text-[var(--color-warm-pale)]">The chronicle is still blank</p>
              <div className="flex flex-wrap justify-center gap-2">
                <ActionButton onClick={handleAddEvent} variant="primary">
                  Add Event
                </ActionButton>
                <ActionButton onClick={() => setShowSuggestions(true)} variant="ghost">
                  Open Suggestions
                </ActionButton>
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex min-h-[30rem] flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-dashed border-border-muted/45 bg-bg-secondary/10 px-6 text-center">
              <p className="font-display text-2xl text-[var(--color-warm-pale)]">No events match these filters</p>
              <ActionButton onClick={handleClearFilters} variant="secondary">
                Clear Filters
              </ActionButton>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <TimelineView
                events={filteredEvents.map((entry) => entry.event)}
                calendars={calendars}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
                range={activeWindow}
              />

              <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,22,34,0.94),rgba(12,15,24,0.98))] p-5">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-muted/25 pb-4">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.28em] text-[var(--color-warm)]/80">
                      Chronicle
                    </p>
                    <h2 className="mt-2 font-display text-2xl text-text-primary">
                      Ordered by time, grouped by era
                    </h2>
                  </div>
                </div>

                <div className="mt-6 space-y-8">
                  {chronicleGroups.map((calendarGroup) => (
                    <section key={calendarGroup.id}>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-text-muted">
                            Calendar
                          </p>
                          <h3 className="mt-1 font-display text-3xl text-[var(--color-warm-pale)]">
                            {calendarGroup.calendarName}
                          </h3>
                        </div>
                        <p className="text-2xs uppercase tracking-[0.22em] text-text-muted">
                          {calendarGroup.visibleEventCount} event{calendarGroup.visibleEventCount === 1 ? "" : "s"}
                        </p>
                      </div>

                      <div className="mt-5 space-y-6">
                        {calendarGroup.eras.map((eraGroup) => (
                          <div key={eraGroup.id} className="rounded-[1.4rem] border border-border-muted/25 bg-bg-secondary/15 px-4 py-4">
                            <div className="flex flex-wrap items-end justify-between gap-2">
                              <div>
                                <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">
                                  Era
                                </p>
                                <h4 className="mt-1 font-display text-xl text-text-primary">
                                  {eraGroup.eraName}
                                </h4>
                              </div>
                              {eraGroup.startYear !== null && (
                                <p className="text-2xs uppercase tracking-[0.22em] text-text-muted">
                                  Begins at {formatYear(eraGroup.startYear)}
                                </p>
                              )}
                            </div>

                            {eraGroup.events.length === 0 ? (
                              <p className="mt-4 rounded-[1rem] border border-dashed border-border-muted/35 px-4 py-3 text-sm text-text-muted">
                                No visible events are recorded in this era yet.
                              </p>
                            ) : (
                              <div className="relative mt-5 pl-5">
                                <div className="absolute bottom-3 left-[0.4rem] top-3 w-px bg-gradient-to-b from-[var(--color-warm)]/45 via-border-muted/40 to-transparent" />
                                <div className="space-y-3">
                                  {eraGroup.events.map((entry) => (
                                    <ChronicleEventRow
                                      key={entry.event.id}
                                      entry={entry}
                                      selected={entry.event.id === selectedEventId}
                                      onSelect={() => setSelectedEventId(entry.event.id)}
                                      onMoveSelection={handleMoveSelection}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <EventInspector
          resolvedEvent={selectedResolved}
          calendars={calendars}
          previous={neighbors.previous}
          next={neighbors.next}
          onNavigate={setSelectedEventId}
          onUpdate={(patch) => selectedResolved && updateEvent(selectedResolved.event.id, patch)}
          onDelete={() => {
            if (!selectedResolved) return;
            deleteEvent(selectedResolved.event.id);
            setSelectedEventId(null);
          }}
        />
      </div>
    </div>
  );
}
