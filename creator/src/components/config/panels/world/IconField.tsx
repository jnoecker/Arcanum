import type { ReactNode } from "react";

interface IconFieldProps {
  label: string;
  hint?: string;
  /** Render label/input side-by-side (default) or stacked. */
  layout?: "row" | "column";
  children: ReactNode;
}

/**
 * Field row used by the World panel. Mirrors `FieldRow` but with an
 * ember-tinted, uppercase-tracked label.
 */
export function IconField({
  label,
  hint,
  layout = "row",
  children,
}: IconFieldProps) {
  if (layout === "column") {
    return (
      <div className="py-0.5">
        <div className="mb-1 text-2xs uppercase tracking-wider text-text-muted">
          {label}
        </div>
        {children}
        {hint && (
          <p className="mt-0.5 text-2xs leading-snug text-text-muted/60">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div className="py-0.5">
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 shrink-0 truncate text-text-muted">{label}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </label>
      {hint && (
        <p className="ml-[7.5rem] mt-0.5 text-2xs leading-snug text-text-muted/60">{hint}</p>
      )}
    </div>
  );
}
