// ─── Parameter Section ──────────────────────────────────────────────
// Collapsible section with header, field count badge, and parameter rows.

import { useMemo } from "react";
import type { FieldMeta, DiffEntry } from "@/lib/tuning/types";
import type { TuningSection } from "@/lib/tuning/types";
import { ParameterRow } from "./ParameterRow";

interface ParameterSectionProps {
  section: TuningSection;
  fields: [string, FieldMeta][];
  currentConfig: Record<string, unknown>;
  diffMap: Map<string, DiffEntry>;
  hasPreset: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  presetAccentBorder?: string;
}

/** Walk a dot-path to read a nested value from an object. */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

export function ParameterSection({
  section,
  fields,
  currentConfig,
  diffMap,
  hasPreset,
  isCollapsed,
  onToggleCollapsed,
  presetAccentBorder,
}: ParameterSectionProps) {
  const changedCount = useMemo(
    () => fields.filter(([path]) => diffMap.has(path)).length,
    [fields, diffMap],
  );

  return (
    <div className="mb-8">
      {/* Section header */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex w-full cursor-pointer items-center gap-3 border-t border-border-muted py-3"
      >
        {/* Chevron */}
        <span
          className={`inline-block text-text-muted transition-transform duration-200 ${
            isCollapsed ? "rotate-0" : "rotate-90"
          }`}
        >
          &#9654;
        </span>

        {/* Section name */}
        <span className="font-display text-sm uppercase tracking-[0.5px] text-text-secondary">
          {section}
        </span>

        {/* Field count badge */}
        <span className="rounded-full bg-accent/[0.14] px-2 py-0.5 font-sans text-sm text-accent">
          {fields.length}
        </span>

        {/* Changes count badge -- shown when collapsed with preset active */}
        {hasPreset && changedCount > 0 && (
          <span className="rounded-full bg-status-success/[0.14] px-2 py-0.5 font-sans text-[13px] text-status-success">
            {changedCount} changed
          </span>
        )}
      </button>

      {/* Parameter rows */}
      {!isCollapsed && (
        <div>
          {fields.map(([path, meta], idx) => {
            const diff = diffMap.get(path);
            const currentValue = getNestedValue(currentConfig, path);
            return (
              <ParameterRow
                key={path}
                path={path}
                meta={meta}
                currentValue={currentValue}
                presetValue={diff?.newValue}
                isChanged={diff !== undefined}
                hasPreset={hasPreset}
                presetAccentBorder={presetAccentBorder}
                even={idx % 2 === 0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
