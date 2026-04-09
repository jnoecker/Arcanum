// ─── Delta Utilities ───────────────────────────────────────────────
// Pure functions for computing and displaying value deltas.
// Used by MetricCard and ParameterRow components.

import type { FieldMeta } from "./types";

export type DeltaDirection = "up" | "down" | "same";

/** Determine the direction of change between two numeric values. */
export function deltaDirection(oldVal: number, newVal: number): DeltaDirection {
  if (oldVal === newVal) return "same";
  return newVal > oldVal ? "up" : "down";
}

/** Tailwind color class for a given delta direction (D-08). */
export function deltaColor(direction: DeltaDirection): string {
  switch (direction) {
    case "up": return "text-status-success";
    case "down": return "text-status-error";
    case "same": return "text-text-muted";
  }
}

/**
 * Format a percentage delta string with directional arrow.
 * Guards against zero-denominator edge case.
 *
 * Returns: "\u25B2 X.X%", "\u25BC X.X%", "\u2014", "+new", or "-new"
 */
export function pctDelta(oldVal: number, newVal: number): string {
  if (oldVal === newVal) return "\u2014"; // em-dash
  if (oldVal === 0) return newVal > 0 ? "+new" : "-new";
  const pct = ((newVal - oldVal) / Math.abs(oldVal)) * 100;
  const arrow = pct >= 0 ? "\u25B2" : "\u25BC"; // up or down arrow
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
}

// ─── Tooltip Content Builder ───────────────────────────────────────

/** Impact badge colors matching Arcanum design system (D-11, UI-SPEC). */
const IMPACT_COLORS: Record<string, string> = {
  high: "#d9756b",   // status-error
  medium: "#ff9d3d", // status-warning
  low: "#ad9d88",    // text-muted
};

const IMPACT_LABELS: Record<string, string> = {
  high: "HIGH IMPACT",
  medium: "MEDIUM IMPACT",
  low: "LOW IMPACT",
};

/**
 * Build an HTML string for a Tippy tooltip from a FieldMeta entry.
 * Includes description, optional interactionNote, and colored impact badge.
 * Used with Tippy's allowHTML: true option.
 */
export function buildTooltipContent(meta: FieldMeta): string {
  const parts: string[] = [];
  parts.push(`<div style="font-size:13px;line-height:1.5;max-width:260px">`);
  parts.push(`<div style="margin-bottom:6px">${meta.description}</div>`);
  if (meta.interactionNote) {
    parts.push(`<div style="margin-bottom:6px;opacity:0.8">Interacts with: ${meta.interactionNote}</div>`);
  }
  const color = IMPACT_COLORS[meta.impact] ?? "#ad9d88";
  const label = IMPACT_LABELS[meta.impact] ?? "LOW IMPACT";
  parts.push(`<span style="color:${color};font-size:11px;font-weight:600;letter-spacing:0.5px">${label}</span>`);
  parts.push(`</div>`);
  return parts.join("");
}
