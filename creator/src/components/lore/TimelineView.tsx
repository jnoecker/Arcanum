import { useMemo, useState, useCallback } from "react";
import type { CalendarSystem, TimelineEvent } from "@/types/lore";
import { absoluteYear, buildEraBands, eventRange, sortEvents } from "@/lib/loreCalendar";

const TRACK_HEIGHT = 148;
const TRACK_Y = 94;
const MARKER_Y = 62;

const ERA_COLORS = [
  "var(--color-era-1)",
  "var(--color-era-2)",
  "var(--color-era-3)",
  "var(--color-era-4)",
  "var(--color-era-5)",
  "var(--color-era-6)",
];

export function TimelineView({
  events,
  calendars,
  selectedEventId,
  onSelectEvent,
  range,
}: {
  events: TimelineEvent[];
  calendars: CalendarSystem[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  range?: { min: number; max: number } | null;
}) {
  const [zoom, setZoom] = useState(1);

  const computedRange = useMemo(() => range ?? eventRange(events, calendars), [range, events, calendars]);
  const span = computedRange.max - computedRange.min || 100;
  const svgWidth = Math.max(720, 1200 * zoom);
  const pxPerYear = svgWidth / span;

  const yearToX = useCallback(
    (year: number) => (year - computedRange.min) * pxPerYear,
    [computedRange.min, pxPerYear],
  );

  const eraBands = useMemo(() => buildEraBands(calendars, computedRange.max), [calendars, computedRange.max]);
  const sortedEvents = useMemo(() => sortEvents(events, calendars), [events, calendars]);

  const ticks = useMemo(() => {
    const rawStep = span / 6;
    const step = Math.max(1, Math.pow(10, Math.floor(Math.log10(rawStep || 1))));
    const start = Math.ceil(computedRange.min / step) * step;
    const result: number[] = [];
    for (let y = start; y <= computedRange.max; y += step) {
      result.push(y);
    }
    return result;
  }, [computedRange.max, computedRange.min, span]);

  return (
    <div className="rounded-[1.6rem] border border-border-muted/50 bg-[var(--bg-deep-section)] p-4 shadow-[var(--shadow-section)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-[var(--color-warm)]/80">
          Chronicle Overview
        </p>
        <div className="flex items-center gap-1 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-1">
          {[0.75, 1, 1.5, 2].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setZoom(value)}
              aria-label={`Zoom overview to ${value}x`}
              aria-pressed={zoom === value}
              className={`focus-ring rounded-full px-3 py-1 text-2xs transition ${
                zoom === value
                  ? "bg-[var(--bg-active-strong)] text-text-primary shadow-[var(--shadow-glow)]"
                  : "text-text-muted hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
              }`}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-[1.25rem] border border-border-muted/35 bg-bg-abyss/70">
        <svg
          width={svgWidth}
          height={TRACK_HEIGHT}
          className="select-none"
          role="img"
          aria-label={`Overview timeline with ${events.length} visible events`}
        >
          {eraBands.map((band, index) => {
            const x = yearToX(band.startYear);
            const width = Math.max(1, yearToX(band.endYear) - x);
            return (
              <g key={`${band.calendarName}:${band.era.id}`}>
                <rect
                  x={x}
                  y={16}
                  width={width}
                  height={52}
                  fill={band.era.color || ERA_COLORS[index % ERA_COLORS.length]}
                  rx={12}
                />
                {width > 96 && (
                  <text
                    x={x + 10}
                    y={34}
                    fill="var(--color-text-secondary)"
                    fontSize={10}
                    style={{ fontFamily: "var(--font-display), Palatino, serif" }}
                  >
                    {band.era.name}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={0}
            y1={MARKER_Y}
            x2={svgWidth}
            y2={MARKER_Y}
            stroke="var(--color-border-muted)"
            strokeWidth={1}
          />

          {ticks.map((year) => {
            const x = yearToX(year);
            return (
              <g key={year}>
                <line
                  x1={x}
                  y1={TRACK_Y}
                  x2={x}
                  y2={MARKER_Y - 6}
                  stroke="var(--color-border-muted)"
                  strokeWidth={1}
                  opacity={0.6}
                />
                <text
                  x={x}
                  y={TRACK_Y + 18}
                  textAnchor="middle"
                  fill="var(--color-text-muted)"
                  fontSize={9}
                  style={{ fontFamily: "var(--font-mono), Consolas, monospace" }}
                >
                  {Math.round(year)}
                </text>
              </g>
            );
          })}

          {sortedEvents.map((event) => {
            const x = yearToX(absoluteYear(event, calendars));
            const isSelected = event.id === selectedEventId;
            const fill =
              event.importance === "legendary"
                ? "var(--color-warm)"
                : event.importance === "major"
                  ? "var(--color-accent)"
                  : "var(--color-stellar-blue)";
            const radius = event.importance === "legendary" ? 8 : event.importance === "major" ? 6 : 4;
            return (
              <g
                key={event.id}
                className="cursor-pointer"
                onClick={() => onSelectEvent(event.id)}
              >
                {isSelected && (
                  <circle
                    cx={x}
                    cy={MARKER_Y}
                    r={radius + 5}
                    fill={fill}
                    opacity={0.18}
                  />
                )}
                <line
                  x1={x}
                  y1={MARKER_Y}
                  x2={x}
                  y2={34}
                  stroke={fill}
                  strokeWidth={isSelected ? 1.8 : 1}
                  opacity={isSelected ? 0.9 : 0.35}
                />
                <circle
                  cx={x}
                  cy={MARKER_Y}
                  r={radius}
                  fill={fill}
                  stroke={isSelected ? "var(--color-text-primary)" : "transparent"}
                  strokeWidth={1.4}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
