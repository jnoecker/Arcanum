// ─── Parameter Row ──────────────────────────────────────────────────
// Single parameter row showing label, current value, optional preset
// value with diff highlighting, and description.

import type { FieldMeta } from "@/lib/tuning/types";

interface ParameterRowProps {
  path: string;
  meta: FieldMeta;
  currentValue: unknown;
  presetValue?: unknown;
  isChanged: boolean;
  hasPreset: boolean;
  presetAccentBorder?: string;
  even: boolean;
}

/** Format a config value for display. */
function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "\u2014";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return String(v);
}

/** Determine the text color for a preset value based on diff direction. */
function diffColor(oldVal: unknown, newVal: unknown, isChanged: boolean): string {
  if (!isChanged) return "text-text-muted";
  if (typeof oldVal === "number" && typeof newVal === "number") {
    return newVal > oldVal ? "text-status-warning" : "text-status-info";
  }
  return "text-status-warning";
}

export function ParameterRow({
  meta,
  currentValue,
  presetValue,
  isChanged,
  hasPreset,
  presetAccentBorder,
  even,
}: ParameterRowProps) {
  const gridCols = hasPreset
    ? "grid-cols-[1.2fr_100px_100px_1.5fr]"
    : "grid-cols-[1.2fr_100px_1.5fr]";

  const rowHighlight =
    isChanged && presetAccentBorder ? `border-l-2 ${presetAccentBorder}` : "";

  const stripe = even ? "bg-bg-secondary/50" : "";

  return (
    <div
      className={`grid min-h-[40px] items-center gap-x-4 py-2 px-2 transition-colors duration-200 hover:bg-bg-hover ${gridCols} ${rowHighlight} ${stripe}`}
    >
      {/* Label */}
      <span className="font-sans text-[15px] font-semibold text-text-primary">
        {meta.label}
      </span>

      {/* Current value */}
      <span className="text-right font-mono text-sm text-text-secondary">
        {formatValue(currentValue)}
      </span>

      {/* Preset value (only when a preset is selected) */}
      {hasPreset && (
        <span
          className={`text-right font-mono text-sm ${diffColor(currentValue, presetValue, isChanged)}`}
        >
          {formatValue(presetValue)}
        </span>
      )}

      {/* Description */}
      <span className="truncate font-sans text-sm text-text-muted">
        {meta.description}
      </span>
    </div>
  );
}
