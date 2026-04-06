import { useState, useEffect, useCallback, useRef } from "react";
import type { TransitionType } from "@/types/story";

// ─── Types ────────────────────────────────────────────────────────

interface TransitionDropdownProps {
  value: TransitionType;
  onChange: (type: TransitionType) => void;
}

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: "crossfade", label: "Crossfade" },
  { value: "fade_black", label: "Fade to Black" },
];

// ─── TransitionDropdown ───────────────────────────────────────────

export function TransitionDropdown({ value, onChange }: TransitionDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = useCallback(
    (type: TransitionType) => {
      onChange(type);
      setOpen(false);
    },
    [onChange],
  );

  const currentLabel = TRANSITION_OPTIONS.find((o) => o.value === value)?.label ?? "Crossfade";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        role="listbox"
        aria-label="Scene transition type"
        aria-expanded={open}
        className="flex items-center gap-2 border border-border-muted rounded-md px-3 py-1.5 font-body text-xs text-text-primary cursor-pointer hover:border-border-default transition-colors duration-[180ms]"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{currentLabel}</span>
        {/* Down-chevron icon */}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-text-muted">
          <path
            d="M1.5 3L4 5.5L6.5 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-[160px] bg-bg-elevated border border-border-muted rounded-md shadow-[0_8px_32px_rgba(4,6,18,0.7)] z-50">
          {TRANSITION_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={selected}
                className={`px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-hover transition-colors duration-[180ms] ${
                  selected ? "text-accent" : "text-text-primary"
                }`}
                onClick={() => handleSelect(option.value)}
              >
                <span className="font-body text-xs">{option.label}</span>
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
