import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarSystem, TimelineEvent } from "@/types/lore";
import { absoluteYear, buildEraBands, sortEvents } from "@/lib/loreCalendar";

const ZOOM_PRESETS = [0.75, 1, 1.5, 2] as const;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;

const TOP_PADDING = 10;
const LANE_STEP = 22;
const TRACK_TO_LANE0 = 94;          // gap from track axis to lane-0 (above) baseline
const TRACK_BOTTOM_AREA = 40;       // tick numerals + breathing room before below lane 0
const MIN_TRACK_Y = 170;            // preserves the airy single-lane look at low density
const LANE_STEP_BELOW = 18;         // tighter pitch for minor-event labels under the track
const BELOW_LABEL_HEIGHT = 22;      // ~10px year + 9px title + leading
const BELOW_BOTTOM_PADDING = 8;
const LABEL_PX_PER_CHAR = 6.4;
const LABEL_PX_PER_CHAR_MINOR = 5.4; // smaller glyphs pack tighter horizontally
const LABEL_MIN_GAP = 14;

const SCRUBBER_HEIGHT = 60;
const SCRUBBER_HANDLE = 14;
const SCRUBBER_PAD = 12;

const LEGENDARY_GOLD = "var(--color-aurum)";

const ERA_COLORS = [
  "var(--color-status-warning)",
  "var(--color-stellar-blue)",
  LEGENDARY_GOLD,
  "var(--color-status-success)",
  "var(--color-era-violet)",
  "var(--color-era-teal)",
];

function eventColor(importance: TimelineEvent["importance"]) {
  if (importance === "legendary") return LEGENDARY_GOLD;
  if (importance === "major") return "var(--color-accent)";
  return "var(--color-stellar-blue)";
}

function eventRadius(importance: TimelineEvent["importance"]) {
  if (importance === "legendary") return 7;
  if (importance === "major") return 6;
  return 4;
}

const YEAR_FORMATTER = new Intl.NumberFormat();

function formatYear(value: number) {
  return YEAR_FORMATTER.format(Math.round(value));
}

function niceTickStep(span: number, target: number): number {
  if (span <= 0) return 1;
  const raw = span / Math.max(1, target);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 5, 10];
  for (const c of candidates) {
    const step = c * magnitude;
    if (step >= raw) return step;
  }
  return 10 * magnitude;
}

interface LabeledEvent {
  event: TimelineEvent;
  absYear: number;
  x: number;
  /** Lane index on its side; 0 sits closest to the track. */
  laneIndex: number;
  /** Which side of the track the label sits on. Minor events go below;
   *  major and legendary go above. */
  side: "above" | "below";
}

interface RibbonProps {
  events: TimelineEvent[];
  calendars: CalendarSystem[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  fullWindow: { min: number; max: number } | null;
  activeWindow: { min: number; max: number } | null;
  onWindowChange: (window: { min: number; max: number } | null) => void;
}

export function TimelineView({
  events,
  calendars,
  selectedEventId,
  onSelectEvent,
  fullWindow,
  activeWindow,
  onWindowChange,
}: RibbonProps) {
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(960);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setContainerWidth(Math.max(640, node.clientWidth));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const window_ = activeWindow ?? fullWindow ?? { min: 0, max: 100 };
  const span = Math.max(1, window_.max - window_.min);
  const ribbonWidth = Math.max(containerWidth, containerWidth * zoom);
  const innerWidth = ribbonWidth - SCRUBBER_PAD * 2;
  const pxPerYear = innerWidth / span;

  const yearToX = useCallback(
    (year: number) => SCRUBBER_PAD + (year - window_.min) * pxPerYear,
    [window_.min, pxPerYear],
  );

  const eraBands = useMemo(() => buildEraBands(calendars, window_.max), [calendars, window_.max]);
  const sortedEvents = useMemo(() => sortEvents(events, calendars), [events, calendars]);

  const tickStep = useMemo(() => niceTickStep(span, Math.max(4, Math.round(ribbonWidth / 140))), [span, ribbonWidth]);
  const ticks = useMemo(() => {
    const start = Math.ceil(window_.min / tickStep) * tickStep;
    const out: number[] = [];
    for (let y = start; y <= window_.max; y += tickStep) out.push(y);
    return out;
  }, [tickStep, window_.max, window_.min]);

  // Greedy lane packing on both sides of the track. Major / legendary
  // events stack above; minor events stack below. Both stacks are
  // unbounded — the ribbon grows vertically to accommodate dense periods.
  const { labeledEvents, lanesUsedAbove, lanesUsedBelow } = useMemo(() => {
    const lanesAbove: number[] = [];
    const lanesBelow: number[] = [];
    const entries: LabeledEvent[] = sortedEvents.map((event) => {
      const absY = absoluteYear(event, calendars);
      const x = SCRUBBER_PAD + (absY - window_.min) * pxPerYear;
      const isMinor = event.importance === "minor";
      const lanes = isMinor ? lanesBelow : lanesAbove;
      const pxPerChar = isMinor ? LABEL_PX_PER_CHAR_MINOR : LABEL_PX_PER_CHAR;
      const labelText = `Y${formatYear(event.year)} ${event.title}`;
      const approxWidth = Math.min(220, Math.max(80, labelText.length * pxPerChar));
      const labelStart = x - 6;
      const labelEnd = labelStart + approxWidth + LABEL_MIN_GAP;

      for (let i = 0; ; i++) {
        const end = lanes[i];
        if (end === undefined || end <= labelStart) {
          lanes[i] = labelEnd;
          return {
            event,
            absYear: absY,
            x,
            laneIndex: i,
            side: isMinor ? ("below" as const) : ("above" as const),
          };
        }
      }
    });
    return {
      labeledEvents: entries,
      lanesUsedAbove: lanesAbove.length,
      lanesUsedBelow: lanesBelow.length,
    };
  }, [calendars, pxPerYear, sortedEvents, window_.min]);

  const trackY = Math.max(
    MIN_TRACK_Y,
    TOP_PADDING +
      Math.max(0, lanesUsedAbove - 1) * LANE_STEP +
      TRACK_TO_LANE0,
  );
  const lane0BaselineY = trackY - TRACK_TO_LANE0;
  const lane0BelowBaselineY = trackY + TRACK_BOTTOM_AREA;
  const ribbonHeight =
    lanesUsedBelow > 0
      ? lane0BelowBaselineY +
        (lanesUsedBelow - 1) * LANE_STEP_BELOW +
        BELOW_LABEL_HEIGHT +
        BELOW_BOTTOM_PADDING
      : trackY + TRACK_BOTTOM_AREA;

  const handlePresetZoom = useCallback((value: number) => {
    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value)));
  }, []);

  const handleNudgeZoom = useCallback((direction: 1 | -1) => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +(z + direction * 0.25).toFixed(2))));
  }, []);

  const handleFocusSelected = useCallback(() => {
    if (!selectedEventId || !fullWindow) return;
    const ev = events.find((e) => e.id === selectedEventId);
    if (!ev) return;
    const center = absoluteYear(ev, calendars);
    const fullSpan = fullWindow.max - fullWindow.min || 100;
    const targetSpan = Math.max(40, fullSpan * 0.25);
    const min = Math.max(fullWindow.min, Math.round(center - targetSpan / 2));
    const max = Math.min(fullWindow.max, Math.round(center + targetSpan / 2));
    onWindowChange({ min, max });
  }, [calendars, events, fullWindow, onWindowChange, selectedEventId]);

  const handleResetWindow = useCallback(() => {
    onWindowChange(null);
  }, [onWindowChange]);

  return (
    <div
      ref={containerRef}
      className="rounded-[0.8rem] border border-[var(--chrome-stroke-strong)] bg-[radial-gradient(circle_at_50%_0%,rgb(var(--accent-rgb)/0.06),transparent_42%),var(--chrome-fill-soft)] p-4 shadow-[0_1px_0_rgb(var(--highlight-rgb)/0.04)_inset,0_8px_24px_-12px_rgb(0_0_0/0.35)] backdrop-blur-sm"
    >
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.24em] text-text-muted">
          <span>Zoom</span>
          <div className="flex items-center gap-1 rounded-[0.7rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-1.5 py-1">
            <button
              type="button"
              onClick={() => handleNudgeZoom(-1)}
              aria-label="Zoom out"
              className="focus-ring inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-2 py-1.5 text-text-muted transition hover:text-text-primary"
            >
              −
            </button>
            {ZOOM_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handlePresetZoom(value)}
                aria-pressed={Math.abs(zoom - value) < 0.01}
                className={`focus-ring inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2.5 py-1.5 text-2xs transition ${
                  Math.abs(zoom - value) < 0.01
                    ? "bg-[var(--bg-active-strong)] text-text-primary shadow-[var(--shadow-glow)]"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {value}x
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleNudgeZoom(1)}
              aria-label="Zoom in"
              className="focus-ring inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-2 py-1.5 text-text-muted transition hover:text-text-primary"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-[0.24em] text-text-muted">View</span>
          <div className="rounded-[0.55rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1 text-2xs text-text-primary">
            Years
          </div>
          <button
            type="button"
            onClick={handleFocusSelected}
            disabled={!selectedEventId}
            aria-label="Focus selected event"
            title="Focus selected event"
            className="focus-ring inline-flex min-h-9 min-w-9 items-center justify-center rounded-[0.55rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-1.5 text-text-muted transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <circle cx="8" cy="8" r="3" />
              <line x1="8" y1="1.5" x2="8" y2="3.5" />
              <line x1="8" y1="12.5" x2="8" y2="14.5" />
              <line x1="1.5" y1="8" x2="3.5" y2="8" />
              <line x1="12.5" y1="8" x2="14.5" y2="8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleResetWindow}
            aria-label="Reset to full range"
            title="Reset to full range"
            className="focus-ring inline-flex min-h-9 min-w-9 items-center justify-center rounded-[0.55rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-1.5 text-text-muted transition hover:text-text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[0.7rem] border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)]">
        <div className="relative" style={{ width: ribbonWidth, minWidth: "100%" }}>
          {eraBands.length > 0 && (
            <div className="relative h-14 border-b border-border-muted/25 bg-bg-abyss/25">
            {eraBands.map((band, index) => {
              const x = yearToX(band.startYear);
              const width = Math.max(8, yearToX(band.endYear) - x);
              const color = band.era.color || ERA_COLORS[index % ERA_COLORS.length]!;
              return (
                <div
                  key={`${band.calendarName}:${band.era.id}`}
                  className="absolute top-0 flex h-14 flex-col justify-center overflow-hidden border-r px-3"
                  style={{
                    left: x,
                    width,
                    background: `linear-gradient(180deg, color-mix(in srgb, ${color} 22%, transparent), color-mix(in srgb, ${color} 8%, transparent))`,
                    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                  }}
                  title={`${band.era.name} · ${formatYear(band.startYear)} – ${formatYear(band.endYear)}`}
                >
                  <p
                    className="truncate font-display text-2xs uppercase tracking-[0.22em]"
                    style={{ color: `color-mix(in srgb, ${color} 88%, white)` }}
                  >
                    {band.era.name}
                  </p>
                  <p className="truncate text-[0.65rem] text-text-secondary">
                    {formatYear(band.startYear)} – {formatYear(band.endYear)}
                  </p>
                </div>
              );
            })}
            </div>
          )}

          <svg
            width={ribbonWidth}
            height={ribbonHeight}
            className="block select-none"
            role="img"
            aria-label={`Timeline overview with ${events.length} events`}
          >
          <line
            x1={0}
            y1={trackY}
            x2={ribbonWidth}
            y2={trackY}
            stroke="var(--color-warm)"
            strokeOpacity={0.55}
            strokeWidth={1.6}
          />

          {ticks.map((year) => {
            const x = yearToX(year);
            return (
              <g key={year}>
                <line
                  x1={x}
                  y1={trackY - 5}
                  x2={x}
                  y2={trackY + 5}
                  stroke="var(--color-warm)"
                  strokeOpacity={0.6}
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={trackY + 22}
                  textAnchor="middle"
                  fill="var(--color-text-secondary)"
                  fontSize={11}
                  style={{ fontFamily: "var(--font-mono), Consolas, monospace", fontVariantNumeric: "tabular-nums" }}
                >
                  {formatYear(year)}
                </text>
              </g>
            );
          })}

          {labeledEvents.map((entry) => {
            const { event, x, laneIndex, side } = entry;
            const isAbove = side === "above";
            const isSelected = event.id === selectedEventId;
            const fill = eventColor(event.importance);
            const radius = eventRadius(event.importance);
            const labelY = isAbove
              ? lane0BaselineY - laneIndex * LANE_STEP
              : lane0BelowBaselineY + laneIndex * LANE_STEP_BELOW;
            const yearLabel = `Y${formatYear(event.year)}`;
            const titleMax = isAbove ? 36 : 30;
            const titleEllipsisAt = isAbove ? 34 : 28;
            const titleText =
              event.title.length > titleMax
                ? `${event.title.slice(0, titleEllipsisAt)}…`
                : event.title;
            const yearFontSize = isAbove ? 12 : 10;
            const titleFontSize = isAbove ? 11 : 9;
            const titleOffset = isAbove ? 14 : 11;
            const yearFill = isAbove ? "var(--color-warm)" : "var(--color-text-muted)";
            const titleFill = isSelected
              ? "var(--color-text-primary)"
              : "var(--color-text-secondary)";

            return (
              <g
                key={event.id}
                className="cursor-pointer"
                onClick={() => onSelectEvent(event.id)}
                role="button"
                aria-label={`${event.title} (year ${event.year})`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectEvent(event.id);
                  }
                }}
              >
                <g>
                  <text
                    x={x}
                    y={labelY}
                    textAnchor="start"
                    fill={yearFill}
                    fontSize={yearFontSize}
                    style={{ fontFamily: "var(--font-display), Palatino, serif" }}
                  >
                    {yearLabel}
                  </text>
                  <text
                    x={x}
                    y={labelY + titleOffset}
                    textAnchor="start"
                    fill={titleFill}
                    fontSize={titleFontSize}
                    style={{ fontFamily: "var(--font-body), Palatino, serif" }}
                  >
                    {titleText}
                  </text>
                </g>

                <line
                  x1={x}
                  y1={trackY}
                  x2={x}
                  y2={isAbove ? labelY + 4 : labelY - 12}
                  stroke={fill}
                  strokeWidth={isSelected ? 1.6 : 1}
                  opacity={isSelected ? 0.9 : 0.4}
                />

                {isSelected && (
                  <circle cx={x} cy={trackY} r={radius + 6} fill={fill} opacity={0.18} />
                )}
                <circle
                  cx={x}
                  cy={trackY}
                  r={radius}
                  fill={fill}
                  stroke={isSelected ? "var(--color-text-primary)" : "var(--color-bg-primary)"}
                  strokeWidth={isSelected ? 2 : 1.2}
                />
              </g>
            );
          })}
          </svg>
        </div>
      </div>

      <div className="mt-4">
        <Scrubber
          fullWindow={fullWindow}
          activeWindow={activeWindow}
          onWindowChange={onWindowChange}
          events={events}
          calendars={calendars}
        />
      </div>
    </div>
  );
}

interface ScrubberProps {
  fullWindow: { min: number; max: number } | null;
  activeWindow: { min: number; max: number } | null;
  onWindowChange: (window: { min: number; max: number } | null) => void;
  events: TimelineEvent[];
  calendars: CalendarSystem[];
}

function Scrubber({
  fullWindow,
  activeWindow,
  onWindowChange,
  events,
  calendars,
}: ScrubberProps) {
  const [width, setWidth] = useState(900);
  const ref = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ kind: "left" | "right" | "range"; startX: number; startMin: number; startMax: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingWindowRef = useRef<{ min: number; max: number } | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(Math.max(320, node.clientWidth));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  if (!fullWindow) return null;

  const fullSpan = Math.max(1, fullWindow.max - fullWindow.min);
  const innerWidth = width - SCRUBBER_PAD * 2;
  const window_ = activeWindow ?? fullWindow;

  const yearToX = (year: number) =>
    SCRUBBER_PAD + ((year - fullWindow.min) / fullSpan) * innerWidth;

  const leftX = yearToX(window_.min);
  const rightX = yearToX(window_.max);

  const scheduleWindowChange = (next: { min: number; max: number }) => {
    pendingWindowRef.current = next;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingWindowRef.current;
      pendingWindowRef.current = null;
      if (pending) onWindowChange(pending);
    });
  };

  const flushPending = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const pending = pendingWindowRef.current;
    pendingWindowRef.current = null;
    if (pending) onWindowChange(pending);
  };

  const startDrag = (kind: "left" | "right" | "range", e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind,
      startX: e.clientX,
      startMin: window_.min,
      startMax: window_.max,
    };
  };

  const moveDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaPx = e.clientX - drag.startX;
    const deltaYears = (deltaPx / innerWidth) * fullSpan;
    let nextMin = drag.startMin;
    let nextMax = drag.startMax;
    if (drag.kind === "left") {
      nextMin = Math.max(fullWindow.min, Math.min(drag.startMax - 1, drag.startMin + deltaYears));
    } else if (drag.kind === "right") {
      nextMax = Math.max(drag.startMin + 1, Math.min(fullWindow.max, drag.startMax + deltaYears));
    } else {
      const span = drag.startMax - drag.startMin;
      const lowerBound = fullWindow.min;
      const upperBound = fullWindow.max - span;
      nextMin = Math.max(lowerBound, Math.min(upperBound, drag.startMin + deltaYears));
      nextMax = nextMin + span;
    }
    scheduleWindowChange({ min: Math.round(nextMin), max: Math.round(nextMax) });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    flushPending();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // intentionally empty
    }
  };

  const nudgeLeft = (delta: number) => {
    const nextMin = Math.max(fullWindow.min, Math.min(window_.max - 1, window_.min + delta));
    if (nextMin === window_.min) return;
    onWindowChange({ min: Math.round(nextMin), max: window_.max });
  };

  const nudgeRight = (delta: number) => {
    const nextMax = Math.max(window_.min + 1, Math.min(fullWindow.max, window_.max + delta));
    if (nextMax === window_.max) return;
    onWindowChange({ min: window_.min, max: Math.round(nextMax) });
  };

  return (
    <div ref={ref} className="select-none">
      <svg width={width} height={SCRUBBER_HEIGHT} className="block">
        <rect
          x={SCRUBBER_PAD}
          y={14}
          width={innerWidth}
          height={SCRUBBER_HEIGHT - 28}
          rx={7}
          fill="rgb(var(--highlight-rgb) / 0.06)"
          stroke="var(--color-border-muted)"
          strokeOpacity={0.4}
        />

        {events.map((event) => {
          const x = yearToX(absoluteYear(event, calendars));
          return (
            <line
              key={event.id}
              x1={x}
              y1={20}
              x2={x}
              y2={SCRUBBER_HEIGHT - 20}
              stroke="var(--color-text-muted)"
              strokeWidth={1}
              opacity={event.importance === "minor" ? 0.35 : 0.6}
            />
          );
        })}

        <rect
          x={leftX}
          y={14}
          width={Math.max(2, rightX - leftX)}
          height={SCRUBBER_HEIGHT - 28}
          rx={8}
          fill="rgb(var(--highlight-rgb) / 0.08)"
          stroke="var(--color-warm)"
          strokeOpacity={0.7}
          strokeWidth={1}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => startDrag("range", e)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />

        <ScrubberHandle
          x={leftX}
          onPointerDown={(e) => startDrag("left", e)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          ariaLabel="Adjust window start year"
          valueMin={fullWindow.min}
          valueMax={window_.max - 1}
          valueNow={window_.min}
          onNudge={nudgeLeft}
          onHomeEnd={(which) => {
            if (which === "home") onWindowChange({ min: fullWindow.min, max: window_.max });
            else onWindowChange({ min: window_.max - 1, max: window_.max });
          }}
        />
        <ScrubberHandle
          x={rightX}
          onPointerDown={(e) => startDrag("right", e)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          ariaLabel="Adjust window end year"
          valueMin={window_.min + 1}
          valueMax={fullWindow.max}
          valueNow={window_.max}
          onNudge={nudgeRight}
          onHomeEnd={(which) => {
            if (which === "home") onWindowChange({ min: window_.min, max: window_.min + 1 });
            else onWindowChange({ min: window_.min, max: fullWindow.max });
          }}
        />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.22em] text-text-muted tabular-nums">
        <span>{formatYear(fullWindow.min)}</span>
        <span>
          {formatYear(window_.min)} – {formatYear(window_.max)}
        </span>
        <span>{formatYear(fullWindow.max)}</span>
      </div>
    </div>
  );
}

interface ScrubberHandleProps {
  x: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  ariaLabel: string;
  valueMin: number;
  valueMax: number;
  valueNow: number;
  onNudge: (delta: number) => void;
  onHomeEnd: (which: "home" | "end") => void;
}

function ScrubberHandle({
  x,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  ariaLabel,
  valueMin,
  valueMax,
  valueNow,
  onNudge,
  onHomeEnd,
}: ScrubberHandleProps) {
  const [focused, setFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onNudge(-step);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onNudge(step);
    } else if (e.key === "Home") {
      e.preventDefault();
      onHomeEnd("home");
    } else if (e.key === "End") {
      e.preventDefault();
      onHomeEnd("end");
    }
  };

  return (
    <g
      style={{ cursor: "ew-resize", outline: "none" }}
      tabIndex={0}
      role="slider"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-valuemin={Math.round(valueMin)}
      aria-valuemax={Math.round(valueMax)}
      aria-valuenow={Math.round(valueNow)}
      aria-valuetext={formatYear(valueNow)}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {focused && (
        <rect
          x={x - SCRUBBER_HANDLE / 2 - 3}
          y={5}
          width={SCRUBBER_HANDLE + 6}
          height={SCRUBBER_HEIGHT - 10}
          rx={8}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      <rect
        x={x - SCRUBBER_HANDLE / 2}
        y={8}
        width={SCRUBBER_HANDLE}
        height={SCRUBBER_HEIGHT - 16}
        rx={6}
        fill="var(--color-warm)"
        opacity={0.85}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <line
        x1={x}
        y1={16}
        x2={x}
        y2={SCRUBBER_HEIGHT - 16}
        stroke="var(--color-bg-primary)"
        strokeWidth={1}
        pointerEvents="none"
      />
    </g>
  );
}
