import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import type { CalendarSystem, CalendarEra, TimelineEvent } from "@/types/lore";
import { formatEventDate } from "@/lib/loreCalendar";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";
import { TimelineView } from "./TimelineView";

// ─── Calendar system editor ────────────────────────────────────────

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
    onChange(calendars.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const deleteCalendar = (id: string) => {
    onChange(calendars.filter((c) => c.id !== id));
  };

  const addEra = (calId: string) => {
    const cal = calendars.find((c) => c.id === calId);
    if (!cal) return;
    const era: CalendarEra = {
      id: `era_${Date.now()}`,
      name: "New Era",
      startYear: cal.eras.length > 0 ? (cal.eras[cal.eras.length - 1]!.startYear + 100) : 0,
    };
    patchCalendar(calId, { eras: [...cal.eras, era] });
  };

  const patchEra = (calId: string, eraId: string, patch: Partial<CalendarEra>) => {
    const cal = calendars.find((c) => c.id === calId);
    if (!cal) return;
    patchCalendar(calId, {
      eras: cal.eras.map((e) => (e.id === eraId ? { ...e, ...patch } : e)),
    });
  };

  const deleteEra = (calId: string, eraId: string) => {
    const cal = calendars.find((c) => c.id === calId);
    if (!cal) return;
    patchCalendar(calId, { eras: cal.eras.filter((e) => e.id !== eraId) });
  };

  return (
    <Section title="Calendar Systems" defaultExpanded>
      {calendars.map((cal) => (
        <div key={cal.id} className="mb-4 rounded-lg border border-border-muted bg-bg-primary p-3">
          <div className="flex items-center justify-between gap-2">
            <input
              aria-label="Calendar name"
              className="min-w-0 flex-1 bg-transparent font-display text-sm text-text-primary outline-none"
              value={cal.name}
              onChange={(e) => patchCalendar(cal.id, { name: e.target.value })}
            />
            <div className="flex gap-1">
              <IconButton onClick={() => addEra(cal.id)} title="Add era">+</IconButton>
              <IconButton onClick={() => deleteCalendar(cal.id)} title="Delete calendar" danger>x</IconButton>
            </div>
          </div>

          {cal.eras.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {cal.eras.map((era) => (
                <div key={era.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`Color for ${era.name}`}
                    value={era.color || "#a897d2"}
                    onChange={(e) => patchEra(cal.id, era.id, { color: e.target.value })}
                    className="h-6 w-6 cursor-pointer rounded border-none bg-transparent"
                    title="Era color"
                  />
                  <input
                    aria-label="Era name"
                    className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
                    value={era.name}
                    onChange={(e) => patchEra(cal.id, era.id, { name: e.target.value })}
                    placeholder="Era name"
                  />
                  <span className="text-2xs text-text-muted">starts:</span>
                  <input
                    type="number"
                    aria-label={`Start year for ${era.name}`}
                    className="w-16 rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
                    value={era.startYear}
                    onChange={(e) => patchEra(cal.id, era.id, { startYear: Number(e.target.value) || 0 })}
                  />
                  <IconButton onClick={() => deleteEra(cal.id, era.id)} title="Delete era" danger>x</IconButton>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-1.5">
        <input
          className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCalendar()}
          placeholder="New calendar system name"
        />
        <button
          onClick={addCalendar}
          disabled={!newName.trim()}
          className="rounded border border-border-default px-3 py-1 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </Section>
  );
}

// ─── Event editor ──────────────────────────────────────────────────

function EventEditor({
  event,
  calendars,
  onUpdate,
  onDelete,
}: {
  event: TimelineEvent;
  calendars: CalendarSystem[];
  onUpdate: (patch: Partial<TimelineEvent>) => void;
  onDelete: () => void;
}) {
  const articles = useLoreStore((s) => s.lore?.articles ?? {});
  const cal = calendars.find((c) => c.id === event.calendarId);

  const calOptions = calendars.map((c) => ({ value: c.id, label: c.name }));
  const eraOptions = (cal?.eras ?? []).map((e) => ({ value: e.id, label: e.name }));
  const articleOptions = [
    { value: "", label: "— none —" },
    ...Object.values(articles).map((a) => ({ value: a.id, label: a.title })),
  ];
  const importanceOptions = [
    { value: "minor", label: "Minor" },
    { value: "major", label: "Major" },
    { value: "legendary", label: "Legendary" },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Title">
        <TextInput value={event.title} onCommit={(v) => onUpdate({ title: v })} />
      </FieldRow>
      <FieldRow label="Calendar">
        <SelectInput
          value={event.calendarId}
          options={calOptions}
          onCommit={(v) => onUpdate({ calendarId: v })}
        />
      </FieldRow>
      <FieldRow label="Era">
        <SelectInput
          value={event.eraId}
          options={eraOptions}
          onCommit={(v) => onUpdate({ eraId: v })}
        />
      </FieldRow>
      <FieldRow label="Year">
        <NumberInput value={event.year} onCommit={(v) => onUpdate({ year: v ?? 0 })} />
      </FieldRow>
      <FieldRow label="Importance">
        <SelectInput
          value={event.importance}
          options={importanceOptions}
          onCommit={(v) => onUpdate({ importance: v as TimelineEvent["importance"] })}
        />
      </FieldRow>
      <FieldRow label="Article">
        <SelectInput
          value={event.articleId ?? ""}
          options={articleOptions}
          onCommit={(v) => onUpdate({ articleId: v || undefined })}
        />
      </FieldRow>
      <FieldRow label="Description">
        <TextInput
          value={event.description ?? ""}
          onCommit={(v) => onUpdate({ description: v || undefined })}
          placeholder="Brief description"
        />
      </FieldRow>
      <div className="mt-1">
        <button
          onClick={onDelete}
          className="rounded border border-status-danger/40 bg-status-danger/10 px-3 py-1 text-2xs text-status-danger hover:bg-status-danger/15"
        >
          Delete Event
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function TimelinePanel() {
  const calendars = useLoreStore((s) => s.lore?.calendarSystems ?? []);
  const events = useLoreStore((s) => s.lore?.timelineEvents ?? []);
  const setCalendars = useLoreStore((s) => s.setCalendarSystems);
  const addEvent = useLoreStore((s) => s.addTimelineEvent);
  const updateEvent = useLoreStore((s) => s.updateTimelineEvent);
  const deleteEvent = useLoreStore((s) => s.deleteTimelineEvent);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const handleAddEvent = useCallback(() => {
    const cal = calendars[0];
    if (!cal) return;
    const era = cal.eras[0];
    const event: TimelineEvent = {
      id: `evt_${Date.now()}`,
      calendarId: cal.id,
      eraId: era?.id ?? "",
      year: 0,
      title: "New Event",
      importance: "minor",
    };
    addEvent(event);
    setSelectedEventId(event.id);
  }, [calendars, addEvent]);

  return (
    <div className="flex flex-col gap-6">
      {/* Calendar system editor */}
      <CalendarEditor calendars={calendars} onChange={setCalendars} />

      {/* Timeline visualization */}
      {calendars.length > 0 && (
        <Section title="Timeline" defaultExpanded>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-text-muted">{events.length} events</span>
            <button
              onClick={handleAddEvent}
              className="rounded-full border border-[rgba(184,216,232,0.28)] bg-gradient-active-strong px-3 py-1 text-2xs text-text-primary transition hover:shadow-glow-sm"
            >
              Add Event
            </button>
          </div>

          {events.length > 0 ? (
            <TimelineView
              events={events}
              calendars={calendars}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border-muted text-xs text-text-muted">
              Add a calendar system and events to populate the timeline.
            </div>
          )}
        </Section>
      )}

      {/* Event detail editor */}
      {selectedEvent && (
        <Section title={`Event: ${selectedEvent.title}`} defaultExpanded>
          <p className="mb-2 text-2xs text-text-muted">
            {formatEventDate(selectedEvent, calendars)}
          </p>
          <EventEditor
            event={selectedEvent}
            calendars={calendars}
            onUpdate={(patch) => updateEvent(selectedEvent.id, patch)}
            onDelete={() => {
              deleteEvent(selectedEvent.id);
              setSelectedEventId(null);
            }}
          />
        </Section>
      )}

      {/* Event list */}
      {events.length > 0 && (
        <Section title="All Events" defaultExpanded={false}>
          <div className="flex flex-col gap-1">
            {events.map((evt) => (
              <button
                key={evt.id}
                onClick={() => setSelectedEventId(evt.id)}
                className={`flex items-center justify-between rounded px-2 py-1 text-left text-xs transition ${
                  evt.id === selectedEventId
                    ? "bg-accent/15 text-text-primary"
                    : "text-text-secondary hover:bg-bg-tertiary"
                }`}
              >
                <span className="min-w-0 truncate">{evt.title}</span>
                <span className="shrink-0 text-2xs text-text-muted">
                  {formatEventDate(evt, calendars)}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
