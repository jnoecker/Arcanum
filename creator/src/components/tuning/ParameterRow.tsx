// ─── Parameter Row ──────────────────────────────────────────────────
// Single parameter row showing label with tooltip, current value, optional
// preset value with diff highlighting and percentage delta.

import { useRef, useEffect } from "react";
import tippy from "tippy.js";
import type { FieldMeta } from "@/lib/tuning/types";
import { pctDelta, deltaDirection, deltaColor, buildTooltipContent } from "@/lib/tuning/deltaUtils";

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

export function ParameterRow({
  meta,
  currentValue,
  presetValue,
  isChanged,
  hasPreset,
  presetAccentBorder,
  even,
}: ParameterRowProps) {
  const labelRef = useRef<HTMLSpanElement>(null);

  // Tooltip on field label (D-10, D-11, UI-04)
  useEffect(() => {
    if (!labelRef.current) return;
    const content = buildTooltipContent(meta);
    const instance = tippy(labelRef.current, {
      content,
      allowHTML: true,
      theme: "arcanum",
      placement: "top-start",
      delay: [250, 100],
      maxWidth: 280,
    });
    return () => instance.destroy();
  }, [meta.description, meta.interactionNote, meta.impact]);

  const gridCols = hasPreset
    ? "grid-cols-[1.2fr_80px_140px_1.5fr]"
    : "grid-cols-[1.2fr_100px_1.5fr]";

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

  return (
    <div
      className={`grid min-h-[40px] items-center gap-x-4 py-2 px-2 transition-colors duration-200 hover:bg-bg-hover ${gridCols} ${rowHighlight} ${stripe}`}
    >
      {/* Label with tooltip */}
      <span
        ref={labelRef}
        className="cursor-default font-sans text-[15px] font-semibold text-text-primary"
      >
        {meta.label}
      </span>

      {/* Current value */}
      <span className="text-right font-mono text-sm text-text-secondary">
        {formatValue(currentValue)}
      </span>

      {/* Preset value + delta (only when a preset is selected) */}
      {hasPreset && (
        <span className={`text-right font-mono text-sm ${presetColorClass}`}>
          {presetDisplay}
        </span>
      )}

      {/* Description */}
      <span className="truncate font-sans text-sm text-text-muted">
        {meta.description}
      </span>
    </div>
  );
}
