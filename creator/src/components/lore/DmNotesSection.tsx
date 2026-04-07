import { useState, useEffect } from "react";

interface DmNotesSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function DmNotesSection({ value, onChange }: DmNotesSectionProps) {
  const [expanded, setExpanded] = useState(!!value);

  // Sync expanded state when value changes externally (e.g. scene switch)
  useEffect(() => {
    if (value) setExpanded(true);
  }, [value]);

  return (
    <div className="rounded-lg border border-amber-900/30 bg-amber-950/20">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-amber-950/30 transition-colors"
      >
        {/* Eye icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-amber-200/60">
          <path
            d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
        </svg>

        {/* DM Only badge */}
        <span className="font-display text-3xs uppercase tracking-[0.18em] text-amber-200/80">
          DM Only
        </span>

        {/* Expand/Collapse indicator */}
        <span className="ml-auto flex items-center gap-1 text-2xs text-text-muted">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`transform transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {expanded ? "Collapse" : "Expand"}
        </span>
      </button>

      {/* Expandable content */}
      <div
        className="grid overflow-hidden transition-[grid-template-rows] duration-200"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transitionTimingFunction: "var(--ease-unfurl)",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <textarea
            rows={3}
            tabIndex={expanded ? 0 : -1}
            className={`w-full resize-none bg-transparent px-3 py-2 text-base text-text-secondary placeholder:text-text-muted/40 focus:outline-none transition-[opacity,transform] duration-200 ${
              expanded ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
            }`}
            placeholder="Private notes for the DM..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
