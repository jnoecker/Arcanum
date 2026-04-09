// ─── Parameter Row ──────────────────────────────────────────────────
// Single parameter row showing label with tooltip, current value (editable),
// optional preset value with diff highlighting and percentage delta.

import { useState } from "react";
import type { FieldMeta } from "@/lib/tuning/types";
import { pctDelta, deltaDirection, deltaColor, buildTooltipText } from "@/lib/tuning/deltaUtils";

interface ParameterRowProps {
  path: string;
  meta: FieldMeta;
  currentValue: unknown;
  presetValue?: unknown;
  isChanged: boolean;
  hasPreset: boolean;
  presetAccentBorder?: string;
  even: boolean;
  onValueChange?: (path: string, value: unknown) => void;
}

/** Format a config value for display. */
function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "\u2014";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return String(v);
}

export function ParameterRow({
  path,
  meta,
  currentValue,
  presetValue,
  isChanged,
  hasPreset,
  presetAccentBorder,
  even,
  onValueChange,
}: ParameterRowProps) {
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const tooltipText = buildTooltipText(meta);

  const gridCols = hasPreset
    ? "md:grid-cols-[minmax(0,1.35fr)_minmax(120px,auto)] xl:grid-cols-[minmax(0,1.15fr)_100px_140px_minmax(0,1.5fr)]"
    : "md:grid-cols-[minmax(0,1.35fr)_minmax(120px,auto)] xl:grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1.5fr)]";

  const rowHighlight =
    isChanged && presetAccentBorder ? `border-l-2 ${presetAccentBorder}` : "";

  const stripe = even ? "bg-bg-secondary/50" : "";

  // Determine preset cell content and color (D-08, D-09)
  let presetDisplay = "";
  let presetColorClass = "text-text-muted";
  if (hasPreset) {
    const formatted = formatValue(presetValue);
    if (!isChanged) {
      presetDisplay = formatted;
      presetColorClass = "text-text-muted";
    } else if (typeof currentValue === "number" && typeof presetValue === "number") {
      const dir = deltaDirection(currentValue, presetValue);
      presetColorClass = deltaColor(dir);
      const delta = pctDelta(currentValue, presetValue);
      presetDisplay = dir === "same" ? `${formatted} \u2014` : `${formatted} ${delta}`;
    } else {
      // Non-numeric but changed
      presetDisplay = formatted;
      presetColorClass = "text-status-success";
    }
  }

  // ─── Inline editing helpers ──────────────────────────────────────
  const isBoolean = typeof currentValue === "boolean";
  const isNumeric = typeof currentValue === "number";

  function commitNumericEdit(raw: string) {
    setEditingValue(null);
    if (!onValueChange) return;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === String(currentValue)) return;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return;
    // Enforce min/max from metadata
    let clamped = parsed;
    if (meta.min !== undefined && clamped < meta.min) clamped = meta.min;
    if (meta.max !== undefined && clamped > meta.max) clamped = meta.max;
    onValueChange(path, clamped);
  }

  function handleToggleBoolean() {
    if (!onValueChange) return;
    onValueChange(path, !currentValue);
  }

  // ─── Render value cell ───────────────────────────────────────────
  let valueCell: React.ReactNode;

  if (isBoolean) {
    valueCell = (
      <label className="flex cursor-pointer items-center justify-end gap-1.5">
        <span className="font-mono text-sm text-text-secondary">
          {currentValue ? "true" : "false"}
        </span>
        <input
          type="checkbox"
          checked={currentValue as boolean}
          onChange={handleToggleBoolean}
          aria-label={`Toggle ${meta.label}`}
          className="h-4 w-4 cursor-pointer accent-accent"
        />
      </label>
    );
  } else if (isNumeric && onValueChange) {
    const displayStr = editingValue !== null ? editingValue : String(currentValue);
    valueCell = (
      <input
        type="text"
        inputMode="decimal"
        value={displayStr}
        onChange={(e) => setEditingValue(e.target.value)}
        onBlur={(e) => commitNumericEdit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitNumericEdit((e.target as HTMLInputElement).value);
          if (e.key === "Escape") setEditingValue(null);
        }}
        onFocus={() => setEditingValue(String(currentValue))}
        aria-label={`Edit ${meta.label}`}
        className="min-h-11 w-full rounded bg-transparent px-1.5 py-0.5 text-right font-mono text-sm text-text-secondary outline-none ring-1 ring-transparent transition-colors hover:ring-white/20 focus:ring-accent/50"
      />
    );
  } else {
    valueCell = (
      <span className="text-right font-mono text-sm text-text-secondary">
        {formatValue(currentValue)}
      </span>
    );
  }

  return (
    <div
      className={`grid min-h-[40px] grid-cols-1 gap-x-4 gap-y-2 px-2 py-3 transition-colors duration-200 hover:bg-bg-hover ${gridCols} ${rowHighlight} ${stripe}`}
    >
      {/* Label with tooltip */}
      <span
        tabIndex={0}
        title={tooltipText}
        aria-label={`${meta.label}. ${tooltipText}`}
        className="focus-ring rounded-sm font-sans text-[15px] font-semibold text-text-primary"
      >
        {meta.label}
      </span>

      {/* Current value (editable) */}
      {valueCell}

      {/* Preset value + delta (only when a preset is selected) */}
      {hasPreset && (
        <span className={`text-right font-mono text-sm ${presetColorClass}`}>
          {presetDisplay}
        </span>
      )}

      {/* Description */}
      <span className="font-sans text-sm leading-5 text-text-muted md:col-span-2 xl:col-auto">
        {meta.description}
      </span>
    </div>
  );
}
