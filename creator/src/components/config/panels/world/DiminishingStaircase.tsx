import { useMemo } from "react";
import type { DiminishingXpThreshold } from "@/types/config";

interface DiminishingStaircaseProps {
  thresholds: DiminishingXpThreshold[];
  maxLevel: number;
  height?: number;
}

/** Compact inline staircase showing how the multiplier steps down across the
 *  level-difference range. Pure SVG — no Recharts dependency, no axes. */
export function DiminishingStaircase({
  thresholds,
  maxLevel,
  height = 72,
}: DiminishingStaircaseProps) {
  const cap = Math.max(5, Math.min(maxLevel || 50, 200));

  // Sort thresholds ascending by `levelsBelow` so the staircase reads left→right.
  const sorted = useMemo(
    () =>
      [...thresholds]
        .filter((t) => Number.isFinite(t.levelsBelow) && Number.isFinite(t.multiplier))
        .sort((a, b) => a.levelsBelow - b.levelsBelow),
    [thresholds],
  );

  // Build step segments across [0..cap] on X, [0..1] on Y.
  // Each segment: from previous threshold's levelsBelow to this one's, at the previous multiplier.
  // Start at multiplier 1.0 (no penalty) before the first threshold.
  const segments = useMemo(() => {
    const segs: { x0: number; x1: number; m: number }[] = [];
    let x = 0;
    let mult = 1;
    for (const t of sorted) {
      const x1 = Math.max(x, Math.min(cap, t.levelsBelow));
      if (x1 > x) segs.push({ x0: x, x1, m: mult });
      mult = Math.max(0, Math.min(1, t.multiplier));
      x = x1;
    }
    if (x < cap) segs.push({ x0: x, x1: cap, m: mult });
    return segs;
  }, [sorted, cap]);

  const PAD_X = 2;
  const PAD_Y = 4;
  const W = 100; // viewBox width in arbitrary units, stretched via preserveAspectRatio
  const H = 100;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  const xToPx = (x: number) => PAD_X + (x / cap) * innerW;
  const yToPx = (m: number) => PAD_Y + (1 - m) * innerH;

  // Build a single filled staircase path from origin so the area reads as one shape.
  const pathD = useMemo(() => {
    if (segments.length === 0) {
      // Flat baseline at multiplier 1.0
      const y = yToPx(1);
      return `M ${PAD_X} ${y} L ${W - PAD_X} ${y}`;
    }
    let d = `M ${xToPx(segments[0]!.x0)} ${H - PAD_Y} `;
    d += `L ${xToPx(segments[0]!.x0)} ${yToPx(segments[0]!.m)} `;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]!;
      d += `L ${xToPx(s.x1)} ${yToPx(s.m)} `;
      const next = segments[i + 1];
      if (next) d += `L ${xToPx(s.x1)} ${yToPx(next.m)} `;
    }
    d += `L ${xToPx(segments[segments.length - 1]!.x1)} ${H - PAD_Y} Z`;
    return d;
  }, [segments]);

  const strokeD = useMemo(() => {
    if (segments.length === 0) {
      const y = yToPx(1);
      return `M ${PAD_X} ${y} L ${W - PAD_X} ${y}`;
    }
    let d = `M ${xToPx(segments[0]!.x0)} ${yToPx(segments[0]!.m)} `;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]!;
      d += `L ${xToPx(s.x1)} ${yToPx(s.m)} `;
      const next = segments[i + 1];
      if (next) d += `L ${xToPx(s.x1)} ${yToPx(next.m)} `;
    }
    return d;
  }, [segments]);

  const hasData = sorted.length > 0;

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-[var(--chrome-stroke-soft)] bg-[color:rgb(var(--accent-rgb)/0.04)]"
      style={{ height }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        {/* Faint baseline at y = 0 multiplier */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={H - PAD_Y}
          y2={H - PAD_Y}
          stroke="var(--chrome-stroke)"
          strokeWidth={0.4}
        />
        {/* Faint ceiling at y = 1.0 multiplier */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={PAD_Y}
          y2={PAD_Y}
          stroke="var(--chrome-stroke)"
          strokeWidth={0.3}
          strokeDasharray="1 2"
        />
        {hasData && (
          <>
            <path
              d={pathD}
              fill="var(--color-accent)"
              fillOpacity={0.18}
            />
            <path
              d={strokeD}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity={0.85}
              strokeWidth={0.9}
              strokeLinejoin="miter"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        {!hasData && (
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={yToPx(1)}
            y2={yToPx(1)}
            stroke="var(--chrome-stroke)"
            strokeWidth={0.6}
            strokeDasharray="2 2"
          />
        )}
      </svg>
    </div>
  );
}
