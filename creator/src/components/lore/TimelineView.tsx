import { useMemo, useRef, useState, useCallback } from "react";
import type { CalendarSystem, TimelineEvent } from "@/types/lore";
import { absoluteYear, eventRange, buildEraBands } from "@/lib/loreCalendar";

const TRACK_HEIGHT = 220;
const EVENT_AREA_TOP = 60;
const MARKER_Y = 140;

const IMPORTANCE_RADIUS = { minor: 4, major: 7, legendary: 11 };
const IMPORTANCE_STROKE = { minor: 1, major: 1.5, legendary: 2 };

// Era band background tints — derived from design token palette
const ERA_COLORS = [
  "rgba(168, 151, 210, 0.12)",
  "rgba(140, 174, 201, 0.12)",
  "rgba(190, 168, 115, 0.12)",
  "rgba(163, 196, 142, 0.12)",
  "rgba(196, 149, 106, 0.12)",
  "rgba(184, 143, 170, 0.12)",
];

export function TimelineView({
  events,
  calendars,
  selectedEventId,
  onSelectEvent,
}: {
  events: TimelineEvent[];
  calendars: CalendarSystem[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const range = useMemo(() => eventRange(events, calendars), [events, calendars]);
  const span = range.max - range.min || 100;
  const baseWidth = 1200;
  const svgWidth = Math.max(baseWidth * zoom, 600);
  const pxPerYear = svgWidth / span;

  const yearToX = useCallback(
    (year: number) => (year - range.min) * pxPerYear,
    [range.min, pxPerYear],
  );

  const eraBands = useMemo(
    () => buildEraBands(calendars, range.max),
    [calendars, range.max],
  );

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => absoluteYear(a, calendars) - absoluteYear(b, calendars)),
    [events, calendars],
  );

  // Compute tick marks
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.pow(10, Math.floor(Math.log10(span / 8))));
    const result: number[] = [];
    const start = Math.ceil(range.min / step) * step;
    for (let y = start; y <= range.max; y += step) {
      result.push(y);
    }
    return result;
  }, [range, span]);

  return (
    <div className="flex flex-col gap-2">
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <span className="text-2xs text-text-muted">Zoom:</span>
        {[0.5, 1, 2, 4].map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            aria-label={`Zoom ${z}x`}
            aria-pressed={zoom === z}
            className={`rounded px-2.5 py-1 text-2xs transition ${
              zoom === z
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            {z}x
          </button>
        ))}
      </div>

      {/* Scrollable SVG */}
      <div
        ref={containerRef}
        className="overflow-x-auto rounded-lg border border-border-muted bg-graph-bg"
      >
        <svg
          width={svgWidth}
          height={TRACK_HEIGHT}
          className="select-none"
          role="img"
          aria-label={`Timeline with ${events.length} events across ${calendars.length} calendar systems`}
        >
          {/* Era bands */}
          {eraBands.map((band, i) => {
            const x = yearToX(band.startYear);
            const w = yearToX(band.endYear) - x;
            const fill = band.era.color || ERA_COLORS[i % ERA_COLORS.length];
            return (
              <g key={`${band.era.id}-${i}`}>
                <rect
                  x={x}
                  y={0}
                  width={Math.max(w, 1)}
                  height={TRACK_HEIGHT}
                  fill={fill}
                />
                {w > 60 && (
                  <text
                    x={x + 8}
                    y={24}
                    fill="var(--color-text-muted)"
                    fontSize={11}
                    style={{ fontFamily: "var(--font-display), Palatino, serif" }}
                    fontWeight={600}
                  >
                    {band.era.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={0}
            y1={MARKER_Y}
            x2={svgWidth}
            y2={MARKER_Y}
            stroke="var(--color-border-muted)"
            strokeWidth={1}
          />

          {/* Year ticks */}
          {ticks.map((year) => {
            const x = yearToX(year);
            return (
              <g key={year}>
                <line
                  x1={x}
                  y1={MARKER_Y - 4}
                  x2={x}
                  y2={MARKER_Y + 4}
                  stroke="var(--color-border-default)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={MARKER_Y + 16}
                  textAnchor="middle"
                  fill="var(--color-border-default)"
                  fontSize={9}
                  style={{ fontFamily: "var(--font-mono), Consolas, monospace" }}
                >
                  {year}
                </text>
              </g>
            );
          })}

          {/* Event markers */}
          {sortedEvents.map((event) => {
            const x = yearToX(absoluteYear(event, calendars));
            const r = IMPORTANCE_RADIUS[event.importance];
            const sw = IMPORTANCE_STROKE[event.importance];
            const isSelected = event.id === selectedEventId;
            const fill = isSelected ? "var(--color-accent)" : event.importance === "legendary" ? "var(--color-status-warning)" : "var(--color-stellar-blue)";
            const strokeColor = isSelected ? "var(--color-text-primary)" : "transparent";

            return (
              <g
                key={event.id}
                className="cursor-pointer"
                onClick={() => onSelectEvent(event.id === selectedEventId ? null : event.id)}
              >
                {/* Vertical stem */}
                <line
                  x1={x}
                  y1={EVENT_AREA_TOP + 20}
                  x2={x}
                  y2={MARKER_Y}
                  stroke={fill}
                  strokeWidth={0.5}
                  opacity={0.5}
                />
                {/* Marker dot */}
                <circle
                  cx={x}
                  cy={EVENT_AREA_TOP + 20}
                  r={r}
                  fill={fill}
                  stroke={strokeColor}
                  strokeWidth={sw}
                  opacity={0.9}
                />
                {/* Title label */}
                <text
                  x={x}
                  y={EVENT_AREA_TOP + 8}
                  textAnchor="middle"
                  fill={isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)"}
                  fontSize={10}
                  style={{ fontFamily: "var(--font-sans), Georgia, serif" }}
                  fontWeight={isSelected ? 600 : 400}
                >
                  {event.title.length > 20
                    ? `${event.title.slice(0, 18)}...`
                    : event.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
