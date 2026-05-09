import { useState, useCallback, useEffect, useMemo, memo, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useLoreStore, selectArticles, selectCalendars, selectEvents } from "@/stores/loreStore";
import type { CalendarSystem, CalendarEra, TimelineEvent } from "@/types/lore";
import {
  buildChronicleGroups,
  filterResolvedTimelineEvents,
  getTimelineNeighbors,
  resolveTimelineEvents,
  timelineAbsoluteWindow,
  type ResolvedTimelineEvent,
} from "@/lib/loreCalendar";
import {
  ActionButton,
  DialogShell,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { getTimelineEventPrompt, getTimelineEventContext, getTimelineEventFraming } from "@/lib/loreArtPrompts";
import type { AssetContext } from "@/types/assets";
import { TimelineView } from "./TimelineView";
import { TimelineInferencePanel } from "./TimelineInferencePanel";

type ViewMode = "timeline" | "list";

const ERA_PALETTE = [
  "var(--color-status-warning)",
  "var(--color-stellar-blue)",
  "var(--color-aurum)",
  "var(--color-status-success)",
  "var(--color-era-violet)",
  "var(--color-era-teal)",
];

function XGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

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
      dot: "bg-[var(--color-aurum)] shadow-[0_0_18px_rgb(var(--aurum-rgb)/0.34)]",
      pill: "border-[rgb(var(--aurum-rgb)/0.45)] bg-[rgb(var(--aurum-rgb)/0.15)] text-[var(--color-aurum-pale)]",
    };
  }
  if (importance === "major") {
    return {
      dot: "bg-accent shadow-[0_0_18px_rgb(var(--accent-rgb)/0.24)]",
      pill: "border-[var(--border-accent-subtle)] bg-[var(--bg-accent-subtle)] text-text-primary",
    };
  }
  return {
    dot: "bg-[var(--color-stellar-blue)]",
    pill: "border-border-muted/50 bg-bg-secondary/50 text-text-secondary",
  };
}

interface BoolFilters {
  unlinked: boolean;
  hasDescription: boolean;
  hasImage: boolean;
}

function applyBoolFilters(entries: ResolvedTimelineEvent[], filters: BoolFilters): ResolvedTimelineEvent[] {
  if (!filters.unlinked && !filters.hasDescription && !filters.hasImage) return entries;
  return entries.filter((entry) => {
    if (filters.unlinked && entry.event.articleId) return false;
    if (filters.hasDescription && !(entry.event.description && entry.event.description.trim().length > 0)) return false;
    if (filters.hasImage && !(entry.event.image && entry.event.image.trim().length > 0)) return false;
    return true;
  });
}

function applyEraFilter(entries: ResolvedTimelineEvent[], eraId: string | null): ResolvedTimelineEvent[] {
  if (!eraId) return entries;
  return entries.filter((entry) => entry.event.eraId === eraId);
}

// ─── Calendar editor (used inside the manage dialog) ──────────────────────

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
      {calendars.length === 0 && (
        <div className="rounded-[1.4rem] border border-dashed border-border-muted/50 bg-bg-secondary/20 px-4 py-6 text-sm text-text-muted">
          No calendar systems exist yet. Add one below to begin placing dated events.
        </div>
      )}

      {calendars.map((calendar) => (
        <div
          key={calendar.id}
          className="rounded-[1.5rem] border border-border-muted/45 bg-[var(--bg-deep-section)] p-4 shadow-[var(--shadow-section)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Calendar name"
              className="ornate-input min-h-11 min-w-0 flex-1 rounded-2xl bg-[var(--chrome-fill)] px-4 py-3 text-sm text-text-primary"
              value={calendar.name}
              onChange={(e) => patchCalendar(calendar.id, { name: e.target.value })}
            />
            <IconButton onClick={() => addEra(calendar.id)} title="Add era">
              <span className="flex h-full w-full items-center justify-center"><PlusGlyph /></span>
            </IconButton>
            <IconButton onClick={() => deleteCalendar(calendar.id)} title="Delete calendar" danger>
              <span className="flex h-full w-full items-center justify-center"><XGlyph /></span>
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
                  value={era.color || "#ff7d00"}
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
                  <span className="flex h-full w-full items-center justify-center"><XGlyph /></span>
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

// ─── Manage Calendars Dialog ──────────────────────────────────────────────

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function ManageCalendarsDialog({
  open,
  calendars,
  onChange,
  onClose,
}: {
  open: boolean;
  calendars: CalendarSystem[];
  onChange: (calendars: CalendarSystem[]) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = (document.activeElement as HTMLElement) ?? null;
    const node = dialogRef.current;
    const firstFocusable = node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (firstFocusable) firstFocusable.focus();
    else node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <DialogShell
      dialogRef={dialogRef}
      titleId="manage-calendars-title"
      title="Manage Calendars & Eras"
      subtitle="Define the calendar systems and eras that anchor your timeline events."
      onClose={onClose}
      widthClassName="max-w-3xl"
      footer={
        <div className="flex justify-end">
          <ActionButton variant="primary" onClick={onClose}>
            Done
          </ActionButton>
        </div>
      }
    >
      <CalendarEditor calendars={calendars} onChange={onChange} />
    </DialogShell>
  );
}

// ─── Filter Rail ─────────────────────────────────────────────────────────

interface FilterRailProps {
  search: string;
  onSearch: (value: string) => void;
  calendars: CalendarSystem[];
  calendarFilter: string;
  onCalendarFilter: (value: string) => void;
  eraFilter: string | null;
  onEraFilter: (value: string | null) => void;
  importanceFilter: string;
  onImportanceFilter: (value: string) => void;
  windowStart: string;
  windowEnd: string;
  onWindowStart: (value: string) => void;
  onWindowEnd: (value: string) => void;
  onFullRange: () => void;
  onSelectedEra: () => void;
  onThisEra: () => void;
  hasSelected: boolean;
  boolFilters: BoolFilters;
  onBoolFilters: (next: BoolFilters) => void;
  visibleByCalendar: Map<string, number>;
  onManageCalendars: () => void;
  fullWindowMin?: number;
  fullWindowMax?: number;
}

function FilterRail({
  search,
  onSearch,
  calendars,
  calendarFilter,
  onCalendarFilter,
  eraFilter,
  onEraFilter,
  importanceFilter,
  onImportanceFilter,
  windowStart,
  windowEnd,
  onWindowStart,
  onWindowEnd,
  onFullRange,
  onSelectedEra,
  onThisEra,
  hasSelected,
  boolFilters,
  onBoolFilters,
  visibleByCalendar,
  onManageCalendars,
  fullWindowMin,
  fullWindowMax,
}: FilterRailProps) {
  const erasForCalendar = useMemo(() => {
    if (calendarFilter !== "all") {
      const cal = calendars.find((c) => c.id === calendarFilter);
      return cal ? cal.eras : [];
    }
    return calendars.flatMap((cal) =>
      cal.eras.map((era) => ({ ...era, calendarName: cal.name, calendarId: cal.id })),
    );
  }, [calendarFilter, calendars]);

  const toggleImportance = (value: TimelineEvent["importance"]) => {
    onImportanceFilter(importanceFilter === value ? "all" : value);
  };

  const toggleBool = (key: keyof BoolFilters) => {
    onBoolFilters({ ...boolFilters, [key]: !boolFilters[key] });
  };

  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-[0.9rem] border border-border-muted/45 bg-[linear-gradient(180deg,rgb(var(--bg-rgb)/0.94),rgb(var(--abyss-rgb)/0.98))] p-4 shadow-[var(--shadow-panel)]">
      <div>
        <p className="text-[0.62rem] uppercase tracking-[0.32em] text-[var(--color-warm)]/80">
          Filter & Navigate
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Search</span>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search events, notes, eras…"
          className="ornate-input min-h-9 rounded-[0.55rem] px-3 py-2 text-sm text-text-primary"
          aria-label="Search timeline events"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Calendar</span>
        <SelectInput
          value={calendarFilter}
          dense
          options={[
            { value: "all", label: "All calendars" },
            ...calendars.map((c) => ({ value: c.id, label: c.name })),
          ]}
          onCommit={(value) => {
            onCalendarFilter(value);
            onEraFilter(null);
          }}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Era</span>
        <SelectInput
          value={eraFilter ?? ""}
          dense
          placeholder="All eras"
          options={erasForCalendar.map((era) => ({ value: era.id, label: era.name }))}
          onCommit={(value) => onEraFilter(value || null)}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Importance</span>
        <SelectInput
          value={importanceFilter}
          dense
          options={IMPORTANCE_FILTER_OPTIONS.map((option) => ({
            value: String(option.value),
            label: option.label,
          }))}
          onCommit={(value) => onImportanceFilter(value)}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Date Range</span>
        <div className="flex items-center gap-2">
          <input
            value={windowStart}
            onChange={(e) => onWindowStart(e.target.value)}
            inputMode="numeric"
            placeholder={fullWindowMin !== undefined ? String(fullWindowMin) : "0"}
            aria-label="Range start year"
            className="ornate-input min-h-9 w-full rounded-[0.55rem] px-3 py-2 text-sm text-text-primary"
          />
          <span className="text-text-muted">–</span>
          <input
            value={windowEnd}
            onChange={(e) => onWindowEnd(e.target.value)}
            inputMode="numeric"
            placeholder={fullWindowMax !== undefined ? String(fullWindowMax) : ""}
            aria-label="Range end year"
            className="ornate-input min-h-9 w-full rounded-[0.55rem] px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <RangeButton onClick={onFullRange}>Full Range</RangeButton>
          <RangeButton onClick={onSelectedEra} disabled={!eraFilter}>Selected Era</RangeButton>
          <RangeButton onClick={onThisEra} disabled={!hasSelected}>This Era</RangeButton>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Quick Filters</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip selected={importanceFilter === "legendary"} onClick={() => toggleImportance("legendary")}>
            Legendary
          </Chip>
          <Chip selected={importanceFilter === "major"} onClick={() => toggleImportance("major")}>
            Major
          </Chip>
          <Chip selected={importanceFilter === "minor"} onClick={() => toggleImportance("minor")}>
            Minor
          </Chip>
          <Chip selected={boolFilters.unlinked} onClick={() => toggleBool("unlinked")}>
            Unlinked
          </Chip>
          <Chip selected={boolFilters.hasDescription} onClick={() => toggleBool("hasDescription")}>
            Has Description
          </Chip>
          <Chip selected={boolFilters.hasImage} onClick={() => toggleBool("hasImage")}>
            Has Image
          </Chip>
        </div>
      </div>

      {calendars.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Calendars</span>
          <div className="flex flex-col gap-1">
            {calendars.map((calendar, index) => {
              const color = ERA_PALETTE[index % ERA_PALETTE.length];
              const count = visibleByCalendar.get(calendar.id) ?? 0;
              const active = calendarFilter === calendar.id;
              return (
                <button
                  key={calendar.id}
                  type="button"
                  onClick={() => {
                    onCalendarFilter(active ? "all" : calendar.id);
                    onEraFilter(null);
                  }}
                  className={`focus-ring flex items-center justify-between gap-2 rounded-[0.45rem] border px-2.5 py-1.5 text-left transition ${
                    active
                      ? "border-[var(--border-accent-ring)] bg-[var(--bg-active)] text-text-primary"
                      : "border-transparent text-text-secondary hover:border-border-muted/40 hover:bg-bg-secondary/30"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate text-sm">{calendar.name}</span>
                  </span>
                  <span className="shrink-0 text-2xs tabular-nums text-text-muted">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {erasForCalendar.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Eras</span>
          <div className="flex flex-col gap-1">
            {erasForCalendar.map((era) => {
              const active = eraFilter === era.id;
              return (
                <button
                  key={era.id}
                  type="button"
                  onClick={() => onEraFilter(active ? null : era.id)}
                  className={`focus-ring flex items-center justify-between gap-2 rounded-[0.45rem] border px-2.5 py-1.5 text-left transition ${
                    active
                      ? "border-[var(--border-accent-ring)] bg-[var(--bg-active)] text-text-primary"
                      : "border-transparent text-text-secondary hover:border-border-muted/40 hover:bg-bg-secondary/30"
                  }`}
                >
                  <span className="truncate text-sm">{era.name}</span>
                  <span className="shrink-0 text-2xs tabular-nums text-text-muted">
                    {formatYear(era.startYear)}+
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={onManageCalendars}
          className="focus-ring flex w-full items-center justify-between gap-2 rounded-[0.55rem] border border-border-muted/40 bg-bg-secondary/30 px-3 py-2.5 text-sm text-text-secondary transition hover:border-[var(--chrome-stroke-emphasis)] hover:bg-bg-secondary/55 hover:text-text-primary"
        >
          <span>Manage Calendars & Eras</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6L3.4 3.4" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`focus-ring inline-flex min-h-9 items-center rounded-[0.45rem] border px-3 py-1.5 text-2xs transition ${
        selected
          ? "border-[var(--border-accent-ring)] bg-[var(--bg-accent-subtle)] text-[var(--color-warm-pale)]"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted hover:border-[var(--chrome-stroke-emphasis)] hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function RangeButton({
  onClick,
  disabled,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring inline-flex min-h-9 items-center rounded-[0.45rem] border px-3 py-1.5 text-2xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-[var(--border-accent-ring)] bg-[var(--bg-active)] text-text-primary"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted hover:border-[var(--chrome-stroke-emphasis)] hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Event Inspector ──────────────────────────────────────────────────────

function CommitTextArea({
  value,
  onCommit,
  placeholder,
  maxLength,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused && draft !== value) {
      setDraft(value);
    }
  }, [focused, value, draft]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <div className="relative">
      <textarea
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        className="ornate-input min-h-20 w-full resize-none px-3 py-2 pr-16 text-xs leading-relaxed text-text-primary"
      />
      {maxLength !== undefined && (
        <span className="pointer-events-none absolute bottom-2 right-3 text-[0.6rem] text-text-muted">
          {draft.length} / {maxLength}
        </span>
      )}
    </div>
  );
}

function EventInspector({
  resolvedEvent,
  calendars,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
  className = "",
}: {
  resolvedEvent: ResolvedTimelineEvent | null;
  calendars: CalendarSystem[];
  onUpdate: (patch: Partial<TimelineEvent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
  className?: string;
}) {
  const articles = useLoreStore(selectArticles);
  const selectArticle = useLoreStore((s) => s.selectArticle);

  if (!resolvedEvent) {
    return (
      <aside className={`min-h-0 overflow-y-auto rounded-[0.9rem] border border-border-muted/45 bg-[linear-gradient(180deg,rgb(var(--bg-rgb)/0.94),rgb(var(--abyss-rgb)/0.98))] p-5 shadow-[var(--shadow-panel)] ${className}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-[var(--color-warm)]/80">
            Event Inspector
          </p>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-muted/40 bg-bg-secondary/40 text-text-muted">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 2" />
            </svg>
          </div>
          <p className="font-display text-base text-[var(--color-warm-pale)]">No event selected</p>
          <p className="max-w-xs text-2xs leading-relaxed text-text-muted">
            Click an event in the timeline or chronicle list to edit its details here.
          </p>
        </div>
      </aside>
    );
  }

  const { event, absoluteYear, calendar, era } = resolvedEvent;
  const calendarOptions = [
    ...(calendar
      ? []
      : event.calendarId
        ? [{ value: event.calendarId, label: `Missing calendar (${event.calendarId})` }]
        : [{ value: "", label: "No calendar" }]),
    ...calendars.map((entry) => ({ value: entry.id, label: entry.name })),
  ];
  const eraOptions = [
    ...(calendar?.eras.some((e) => e.id === event.eraId) || !event.eraId
      ? []
      : [{ value: event.eraId, label: `Missing era (${event.eraId})` }]),
    { value: "", label: "No era" },
    ...(calendar?.eras ?? []).map((e) => ({ value: e.id, label: e.name })),
  ];
  const articleOptions = [
    { value: "", label: "— None —" },
    ...Object.values(articles)
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((article) => ({ value: article.id, label: article.title })),
  ];
  const selectedArticle = event.articleId ? articles[event.articleId] : undefined;

  return (
    <aside className={`flex min-h-0 flex-col gap-4 overflow-y-auto rounded-[0.9rem] border border-border-muted/45 bg-[linear-gradient(180deg,rgb(var(--bg-rgb)/0.94),rgb(var(--abyss-rgb)/0.98))] p-5 shadow-[var(--shadow-panel)] ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-[var(--color-warm)]/80">
            Event Inspector
          </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          title="Close inspector"
          className="focus-ring inline-flex min-h-9 min-w-9 items-center justify-center rounded-[0.45rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:text-text-primary"
        >
          <XGlyph />
        </button>
      </div>

      <div>
        <p className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Event Details</p>
      </div>

      <FieldRow label="Title">
        <TextInput value={event.title} onCommit={(value) => onUpdate({ title: value })} dense />
      </FieldRow>

      <FieldRow label="Calendar">
        <SelectInput
          value={event.calendarId}
          options={calendarOptions}
          dense
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
          dense
          onCommit={(value) => onUpdate({ eraId: value })}
        />
      </FieldRow>

      <FieldRow label="Year">
        <NumberInput value={event.year} onCommit={(value) => onUpdate({ year: value ?? 0 })} dense />
      </FieldRow>

      <FieldRow label="Absolute Year" hint={era ? `${era.name} starts at ${formatYear(era.startYear)}` : undefined}>
        <div className="rounded-[0.55rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-xs tabular-nums text-text-primary">
          {formatYear(absoluteYear)}
        </div>
      </FieldRow>

      <FieldRow label="Importance">
        <SelectInput
          value={event.importance}
          options={IMPORTANCE_OPTIONS}
          dense
          onCommit={(value) => onUpdate({ importance: value as TimelineEvent["importance"] })}
        />
      </FieldRow>

      <FieldRow label="Linked Article">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <SelectInput
              value={event.articleId ?? ""}
              options={articleOptions}
              dense
              onCommit={(value) => onUpdate({ articleId: value || undefined })}
            />
          </div>
          {selectedArticle && (
            <>
              <button
                type="button"
                onClick={() => selectArticle(selectedArticle.id)}
                title="Jump to article"
                aria-label="Jump to article"
                className="focus-ring rounded-[0.45rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-1 text-2xs text-accent transition hover:bg-[var(--bg-accent-subtle)]"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M6 2H3v3M10 14h3v-3M3 13l10-10" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ articleId: undefined })}
                title="Unlink article"
                aria-label="Unlink article"
                className="focus-ring inline-flex min-h-9 min-w-9 items-center justify-center rounded-[0.45rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:text-status-error"
              >
                <XGlyph />
              </button>
            </>
          )}
        </div>
      </FieldRow>

      <FieldRow label="Description">
        <CommitTextArea
          value={event.description ?? ""}
          onCommit={(value) => onUpdate({ description: value || undefined })}
          placeholder="Short chronicle note"
          maxLength={500}
        />
      </FieldRow>

      <div className="border-t border-border-muted/30 pt-4">
        <p className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">Event Image</p>
        <div className="mt-3">
          <FieldRow label="Filename">
            <TextInput
              value={event.image ?? ""}
              onCommit={(value) => onUpdate({ image: value || undefined })}
              placeholder="None"
              dense
            />
          </FieldRow>
        </div>
        <div className="mt-3">
          <EntityArtGenerator
            getPrompt={(style) => getTimelineEventPrompt(event, style)}
            entityContext={getTimelineEventContext(event)}
            framingHint={getTimelineEventFraming()}
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
        <p className="mt-2 text-[0.6rem] text-text-muted">Recommended: 16:9, 1920×1080</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ActionButton variant="secondary" onClick={onDuplicate}>
          Duplicate
        </ActionButton>
        <ActionButton variant="danger" onClick={onDelete}>
          Delete
        </ActionButton>
      </div>
    </aside>
  );
}

// ─── Event row ────────────────────────────────────────────────────────────

const ChronicleEventRow = memo(function ChronicleEventRow({
  entry,
  selected,
  onSelect,
}: {
  entry: ResolvedTimelineEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const style = importanceClasses(entry.event.importance);

  return (
    <button
      type="button"
      id={`chronicle-row-${entry.event.id}`}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={onSelect}
      className={`focus-ring group relative grid w-full grid-cols-[0.8rem_5rem_minmax(0,1fr)] items-center gap-3 rounded-[0.45rem] border px-3 py-2 text-left transition md:grid-cols-[0.8rem_5rem_minmax(0,1fr)_7rem_10rem] ${
        selected
          ? "border-[var(--border-accent-ring)] bg-[linear-gradient(90deg,rgb(var(--accent-rgb)/0.12),rgb(var(--bg-rgb)/0.30))] shadow-[var(--shadow-glow)]"
          : "border-border-muted/18 bg-bg-abyss/18 hover:border-border-muted/45 hover:bg-bg-secondary/22"
      }`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
      <span className="shrink-0 font-display text-sm tabular-nums text-[var(--color-warm-pale)]">
        Y{formatYear(entry.event.year)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
        {entry.event.title}
      </span>
      <span className={`hidden shrink-0 justify-self-start rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] md:inline-block ${style.pill}`}>
        {entry.event.importance}
      </span>
      <span className="hidden min-w-0 truncate text-xs text-text-muted md:block">
        {entry.calendar?.name ?? "Uncalendared"}
      </span>
    </button>
  );
});

// ─── Event List ──────────────────────────────────────────────────────────

function flattenDisplayedEvents(
  groups: ReturnType<typeof buildChronicleGroups>,
  sortMode: "year" | "importance",
): ResolvedTimelineEvent[] {
  const flat: ResolvedTimelineEvent[] = [];
  for (const calendarGroup of groups) {
    for (const eraGroup of calendarGroup.eras) {
      if (eraGroup.events.length === 0) continue;
      const ordered = sortMode === "importance"
        ? [...eraGroup.events].sort((a, b) => importanceWeight(b.event.importance) - importanceWeight(a.event.importance))
        : eraGroup.events;
      for (const entry of ordered) flat.push(entry);
    }
  }
  return flat;
}

function EventList({
  groups,
  totalVisible,
  selectedEventId,
  onSelect,
  onMoveSelection,
  floatingInspector,
  onCloseInspector,
}: {
  groups: ReturnType<typeof buildChronicleGroups>;
  totalVisible: number;
  selectedEventId: string | null;
  onSelect: (id: string) => void;
  onMoveSelection: (direction: "prev" | "next") => void;
  floatingInspector?: ReactNode;
  onCloseInspector?: () => void;
}) {
  const [sortMode, setSortMode] = useState<"year" | "importance">("year");
  const [isXl, setIsXl] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1280px)").matches : true,
  );
  const slideOverRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1280px)");
    const onChange = (e: MediaQueryListEvent) => setIsXl(e.matches);
    setIsXl(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const slideOverOpen = !isXl && !!floatingInspector && !!selectedEventId;

  useEffect(() => {
    if (!slideOverOpen) return;
    previousFocus.current = (document.activeElement as HTMLElement) ?? null;
    const node = slideOverRef.current;
    const firstFocusable = node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (firstFocusable) firstFocusable.focus();
    else node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseInspector?.();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus?.();
    };
  }, [slideOverOpen, onCloseInspector]);

  useEffect(() => {
    if (!selectedEventId) return;
    document.getElementById(`chronicle-row-${selectedEventId}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedEventId]);

  const handleListKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onMoveSelection("next");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMoveSelection("prev");
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      const flat = flattenDisplayedEvents(groups, sortMode);
      const first = flat[0];
      if (first) onSelect(first.event.id);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const flat = flattenDisplayedEvents(groups, sortMode);
      const last = flat[flat.length - 1];
      if (last) onSelect(last.event.id);
      return;
    }
    if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      const flat = flattenDisplayedEvents(groups, sortMode);
      if (flat.length === 0) return;
      const currentIdx = selectedEventId
        ? flat.findIndex((entry) => entry.event.id === selectedEventId)
        : -1;
      const step = e.key === "PageDown" ? 10 : -10;
      const baseIdx = currentIdx === -1 ? (e.key === "PageDown" ? -1 : flat.length) : currentIdx;
      const nextIdx = Math.max(0, Math.min(flat.length - 1, baseIdx + step));
      const target = flat[nextIdx];
      if (target) onSelect(target.event.id);
      return;
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.9rem] border border-border-muted/40 bg-[linear-gradient(180deg,rgb(var(--bg-rgb)/0.88),rgb(var(--abyss-rgb)/0.94))] shadow-[var(--shadow-panel)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-muted/30 px-4 py-3">
        <p className="font-display text-sm uppercase tracking-[0.28em] text-text-muted">
          {totalVisible} {totalVisible === 1 ? "Event" : "Events"}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-2xs text-text-muted">
            Sort by
            <span className="w-32">
              <SelectInput
                value={sortMode}
                dense
                options={[
                  { value: "year", label: "Year" },
                  { value: "importance", label: "Importance" },
                ]}
                onCommit={(value) => setSortMode(value as "year" | "importance")}
              />
            </span>
          </label>
        </div>
      </div>

      <div className={`grid min-h-0 flex-1 overflow-hidden ${floatingInspector && isXl ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
        <div
          role="listbox"
          aria-label="Timeline events"
          aria-activedescendant={selectedEventId ? `chronicle-row-${selectedEventId}` : undefined}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          className="focus-ring min-h-0 overflow-y-auto p-2"
        >
          {groups.map((calendarGroup) =>
              calendarGroup.eras.map((eraGroup) => {
            if (eraGroup.events.length === 0) return null;
            const orderedEvents = sortMode === "importance"
              ? [...eraGroup.events].sort((a, b) => importanceWeight(b.event.importance) - importanceWeight(a.event.importance))
              : eraGroup.events;
            return (
              <section key={`${calendarGroup.id}:${eraGroup.id}`} className="border-b border-border-muted/25 last:border-b-0">
                <div className="flex items-baseline gap-4 bg-[linear-gradient(90deg,rgb(var(--accent-rgb)/0.10),transparent_72%)] px-4 py-2">
                  <h3 className="font-display text-2xs uppercase tracking-[0.28em] text-[var(--color-warm)]/85">
                    {eraGroup.eraName}
                  </h3>
                  {eraGroup.startYear !== null && (
                    <p className="text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">
                      {formatYear(eraGroup.startYear)} – {formatYear(eraEndYear(calendarGroup, eraGroup))}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 p-2">
                  {orderedEvents.map((entry) => (
                    <ChronicleEventRow
                      key={entry.event.id}
                      entry={entry}
                      selected={entry.event.id === selectedEventId}
                      onSelect={() => onSelect(entry.event.id)}
                    />
                  ))}
                </div>
              </section>
            );
              }),
            )}
        </div>
        {floatingInspector && isXl && (
          <div className="min-h-0 border-l border-border-muted/30 p-2">
            {floatingInspector}
          </div>
        )}
      </div>
      {floatingInspector && !isXl && (
        <>
          <div
            className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 ${
              slideOverOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden="true"
            onClick={() => onCloseInspector?.()}
          />
          <div
            ref={slideOverRef}
            role="dialog"
            aria-modal="true"
            aria-label="Event inspector"
            tabIndex={-1}
            className={`fixed inset-y-0 right-0 z-40 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col p-2 shadow-[var(--shadow-panel)] transition-transform duration-200 ${
              slideOverOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
            {floatingInspector}
          </div>
        </>
      )}
    </div>
  );
}

function importanceWeight(importance: TimelineEvent["importance"]) {
  if (importance === "legendary") return 3;
  if (importance === "major") return 2;
  return 1;
}

function eraEndYear(
  calendarGroup: ReturnType<typeof buildChronicleGroups>[number],
  eraGroup: ReturnType<typeof buildChronicleGroups>[number]["eras"][number],
): number {
  if (eraGroup.startYear === null) return 0;
  const sortedEras = [...calendarGroup.eras]
    .filter((e) => e.startYear !== null)
    .sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0));
  const idx = sortedEras.findIndex((e) => e.id === eraGroup.id);
  const next = idx >= 0 ? sortedEras[idx + 1] : undefined;
  if (next?.startYear !== undefined && next.startYear !== null) return next.startYear;
  const lastEvent = eraGroup.events[eraGroup.events.length - 1];
  return lastEvent ? Math.max(eraGroup.startYear, lastEvent.absoluteYear) : eraGroup.startYear;
}

// ─── Main Panel ──────────────────────────────────────────────────────────

export function TimelinePanel() {
  const calendars = useLoreStore(selectCalendars);
  const events = useLoreStore(selectEvents);
  const setCalendars = useLoreStore((s) => s.setCalendarSystems);
  const addEvent = useLoreStore((s) => s.addTimelineEvent);
  const updateEvent = useLoreStore((s) => s.updateTimelineEvent);
  const deleteEvent = useLoreStore((s) => s.deleteTimelineEvent);
  const duplicateEvent = useLoreStore((s) => s.duplicateTimelineEvent);

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [calendarFilter, setCalendarFilter] = useState("all");
  const [eraFilter, setEraFilter] = useState<string | null>(null);
  const [importanceFilter, setImportanceFilter] = useState("all");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [boolFilters, setBoolFilters] = useState<BoolFilters>({
    unlinked: false,
    hasDescription: false,
    hasImage: false,
  });
  const [showCalendarManager, setShowCalendarManager] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const resolvedEvents = useMemo(() => resolveTimelineEvents(events, calendars), [events, calendars]);

  const baseFilteredEvents = useMemo(() => {
    const filtered = filterResolvedTimelineEvents(resolvedEvents, {
      search,
      calendarId: calendarFilter === "all" ? undefined : calendarFilter,
      importance: importanceFilter === "all" ? undefined : (importanceFilter as TimelineEvent["importance"]),
    });
    return applyBoolFilters(applyEraFilter(filtered, eraFilter), boolFilters);
  }, [calendarFilter, importanceFilter, eraFilter, resolvedEvents, search, boolFilters]);

  const fullWindow = useMemo(() => timelineAbsoluteWindow(baseFilteredEvents), [baseFilteredEvents]);

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
    () => buildChronicleGroups(filteredEvents, calendars).filter((g) => g.visibleEventCount > 0),
    [filteredEvents, calendars],
  );

  const visibleByCalendar = useMemo(() => {
    const map = new Map<string, number>();
    for (const cal of calendars) map.set(cal.id, 0);
    for (const entry of resolvedEvents) {
      if (entry.event.calendarId) {
        map.set(entry.event.calendarId, (map.get(entry.event.calendarId) ?? 0) + 1);
      }
    }
    return map;
  }, [calendars, resolvedEvents]);

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
    const calendar =
      calendarFilter !== "all"
        ? calendars.find((c) => c.id === calendarFilter)
        : eraFilter
          ? calendars.find((c) => c.eras.some((e) => e.id === eraFilter)) ?? calendars[0]
          : calendars[0];
    if (!calendar) return;
    const era = eraFilter && calendar.eras.some((e) => e.id === eraFilter)
      ? calendar.eras.find((e) => e.id === eraFilter)
      : calendar.eras[0];
    const event: TimelineEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      calendarId: calendar.id,
      eraId: era?.id ?? "",
      year: 0,
      title: "New Event",
      importance: "minor",
    };
    addEvent(event);
    setSelectedEventId(event.id);
  }, [calendars, addEvent, calendarFilter, eraFilter]);

  const handleMoveSelection = useCallback(
    (direction: "prev" | "next") => {
      const target = direction === "prev" ? neighbors.previous : neighbors.next;
      if (target) setSelectedEventId(target.event.id);
    },
    [neighbors.next, neighbors.previous],
  );

  const selectedResolved = neighbors.current;

  const handleFullRange = useCallback(() => {
    setWindowStart("");
    setWindowEnd("");
  }, []);

  const handleSelectedEra = useCallback(() => {
    if (!eraFilter) return;
    const cal = calendars.find((c) => c.eras.some((e) => e.id === eraFilter));
    const era = cal?.eras.find((e) => e.id === eraFilter);
    if (!era || !cal) return;
    const sorted = [...cal.eras].sort((a, b) => a.startYear - b.startYear);
    const idx = sorted.findIndex((e) => e.id === era.id);
    const next = idx >= 0 ? sorted[idx + 1] : undefined;
    setWindowStart(String(era.startYear));
    setWindowEnd(String(next ? next.startYear - 1 : era.startYear + 200));
  }, [calendars, eraFilter]);

  const handleThisEra = useCallback(() => {
    if (!selectedResolved) return;
    const era = selectedResolved.era;
    if (!era) {
      setWindowStart(String(selectedResolved.absoluteYear));
      setWindowEnd(String(selectedResolved.absoluteYear));
      return;
    }
    const sortedEras = [...(selectedResolved.calendar?.eras ?? [])].sort((a, b) => a.startYear - b.startYear);
    const idx = sortedEras.findIndex((e) => e.id === era.id);
    const nextStart = idx >= 0 ? sortedEras[idx + 1]?.startYear : undefined;
    const end = nextStart !== undefined ? nextStart - 1 : Math.max(selectedResolved.absoluteYear, era.startYear + 50);
    setWindowStart(String(era.startYear));
    setWindowEnd(String(end));
  }, [selectedResolved]);

  const handleWindowChange = useCallback(
    (next: { min: number; max: number } | null) => {
      if (!next || !fullWindow) {
        setWindowStart("");
        setWindowEnd("");
        return;
      }
      setWindowStart(String(next.min));
      setWindowEnd(String(next.max));
    },
    [fullWindow],
  );

  const handleDuplicate = useCallback(() => {
    if (!selectedResolved) return;
    const newId = duplicateEvent(selectedResolved.event.id);
    if (newId) setSelectedEventId(newId);
  }, [duplicateEvent, selectedResolved]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedResolved) return;
    deleteEvent(selectedResolved.event.id);
    setSelectedEventId(null);
  }, [deleteEvent, selectedResolved]);

  const headerTitle = useMemo(() => {
    if (calendarFilter !== "all") {
      const cal = calendars.find((c) => c.id === calendarFilter);
      if (cal) return cal.name;
    }
    if (eraFilter) {
      const era = calendars.flatMap((c) => c.eras).find((e) => e.id === eraFilter);
      if (era) return era.name;
    }
    return "Chronicle";
  }, [calendars, calendarFilter, eraFilter]);

  const ribbon = (
    <TimelineView
      events={filteredEvents.map((entry) => entry.event)}
      calendars={calendars}
      selectedEventId={selectedEventId}
      onSelectEvent={setSelectedEventId}
      fullWindow={fullWindow}
      activeWindow={activeWindow}
      onWindowChange={handleWindowChange}
    />
  );

  const inspector = (
    <EventInspector
      resolvedEvent={selectedResolved}
      calendars={calendars}
      onUpdate={(patch) => selectedResolved && updateEvent(selectedResolved.event.id, patch)}
      onDelete={handleDeleteSelected}
      onDuplicate={handleDuplicate}
      onClose={() => setSelectedEventId(null)}
      className="h-full"
    />
  );

  const list = (
    <EventList
      groups={chronicleGroups}
      totalVisible={filteredEvents.length}
      selectedEventId={selectedEventId}
      onSelect={setSelectedEventId}
      onMoveSelection={handleMoveSelection}
      floatingInspector={inspector}
      onCloseInspector={() => setSelectedEventId(null)}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[0.9rem] border border-border-muted/45 bg-[linear-gradient(180deg,rgb(var(--bg-rgb)/0.72),rgb(var(--abyss-rgb)/0.92))] shadow-[var(--shadow-panel)]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-muted/45 bg-[radial-gradient(circle_at_top_left,rgb(var(--accent-rgb)/0.10),transparent_38%),linear-gradient(160deg,rgb(var(--bg-rgb)/0.96),rgb(var(--abyss-rgb)/0.94))] px-5 py-3">
        <div className="min-w-0">
          <p className="text-[0.6rem] uppercase tracking-[0.32em] text-[var(--color-warm)]/80">
            {headerTitle === "Chronicle" ? "Timeline Editor" : "Chronicle · Timeline Editor"}
          </p>
          <h1 className="mt-1 truncate font-display text-2xl text-text-primary">
            {headerTitle}
          </h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-[0.7rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-0.5">
            {(["timeline", "list"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={`focus-ring flex items-center gap-1.5 rounded-[0.55rem] px-3 py-1.5 text-2xs transition ${
                  viewMode === mode
                    ? "bg-[var(--bg-active-strong)] text-text-primary shadow-[var(--shadow-glow)]"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <ViewModeIcon mode={mode} />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <ActionButton
            onClick={() => setShowSuggestions((v) => !v)}
            variant={showSuggestions ? "secondary" : "ghost"}
            size="sm"
          >
            {showSuggestions ? "Hide Suggestions" : "AI Suggestions"}
          </ActionButton>

          <ActionButton onClick={handleAddEvent} variant="primary" disabled={calendars.length === 0}>
            + Add Event
          </ActionButton>
        </div>
      </header>

      {showSuggestions && (
        <div className="border-b border-border-muted/35 bg-[var(--bg-deep-section)] p-4">
          <TimelineInferencePanel />
        </div>
      )}

      {/* Body */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <FilterRail
          search={search}
          onSearch={setSearch}
          calendars={calendars}
          calendarFilter={calendarFilter}
          onCalendarFilter={setCalendarFilter}
          eraFilter={eraFilter}
          onEraFilter={setEraFilter}
          importanceFilter={importanceFilter}
          onImportanceFilter={setImportanceFilter}
          windowStart={windowStart}
          windowEnd={windowEnd}
          onWindowStart={setWindowStart}
          onWindowEnd={setWindowEnd}
          onFullRange={handleFullRange}
          onSelectedEra={handleSelectedEra}
          onThisEra={handleThisEra}
          hasSelected={!!selectedResolved}
          boolFilters={boolFilters}
          onBoolFilters={setBoolFilters}
          visibleByCalendar={visibleByCalendar}
          onManageCalendars={() => setShowCalendarManager(true)}
          fullWindowMin={fullWindow?.min}
          fullWindowMax={fullWindow?.max}
        />

        <main className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
          {calendars.length === 0 ? (
            <EmptyState
              title="No calendar systems yet"
              body="Add a calendar to begin recording dated events on the timeline."
              action={{
                label: "Manage Calendars",
                onClick: () => setShowCalendarManager(true),
              }}
            />
          ) : events.length === 0 ? (
            <EmptyState
              title="The chronicle is still blank"
              body="Add your first event to start building this world's history."
              action={{ label: "+ Add Event", onClick: handleAddEvent }}
            />
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              title="No events match these filters"
              body="Adjust the filters in the sidebar, or clear them to see all events."
            />
          ) : (
            <>
              {viewMode === "timeline" && (
                <>
                  <div className="shrink-0">{ribbon}</div>
                  {list}
                </>
              )}
              {viewMode === "list" && list}
            </>
          )}
        </main>

      </div>

      <ManageCalendarsDialog
        open={showCalendarManager}
        calendars={calendars}
        onChange={setCalendars}
        onClose={() => setShowCalendarManager(false)}
      />
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-border-muted/45 bg-bg-secondary/15 px-6 text-center">
      <p className="font-display text-2xl text-[var(--color-warm-pale)]">{title}</p>
      <p className="max-w-md text-sm text-text-muted">{body}</p>
      {action && (
        <ActionButton onClick={action.onClick} variant="primary">
          {action.label}
        </ActionButton>
      )}
    </div>
  );
}

function ViewModeIcon({ mode }: { mode: ViewMode }) {
  if (mode === "timeline") {
    return (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M2 8h12" />
        <circle cx="4" cy="8" r="1.4" fill="currentColor" />
        <circle cx="8" cy="8" r="1.4" fill="currentColor" />
        <circle cx="12" cy="8" r="1.4" fill="currentColor" />
      </svg>
    );
  }
  if (mode === "list") {
    return (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M3 4h10M3 8h10M3 12h10" />
      </svg>
    );
  }
  return null;
}
