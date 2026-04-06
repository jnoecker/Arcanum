import { useState, useEffect } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { OPPOSITE } from "@/lib/zoneEdits";

const DIR_LABELS: Record<string, string> = {
  n: "North", s: "South", e: "East", w: "West",
  ne: "NE", nw: "NW", se: "SE", sw: "SW",
  u: "Up", d: "Down",
};

const DIR_LABELS_SHORT: Record<string, string> = {
  n: "N", s: "S", e: "E", w: "W",
  ne: "NE", nw: "NW", se: "SE", sw: "SW",
  u: "Up", d: "Down",
};

interface DirectionPickerProps {
  source: string;
  target: string;
  sourceTitle?: string;
  targetTitle?: string;
  initialDirection: string;
  onConfirm: (direction: string) => void;
  onCancel: () => void;
}

export function DirectionPicker({
  source,
  target,
  sourceTitle,
  targetTitle,
  initialDirection,
  onConfirm,
  onCancel,
}: DirectionPickerProps) {
  const [selected, setSelected] = useState(initialDirection);
  const trapRef = useFocusTrap<HTMLDivElement>(onCancel);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm(selected);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected, onConfirm]);

  // Close if clicking outside the picker
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (trapRef.current && !trapRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    // Delay to avoid catching the same click that opened it
    const id = setTimeout(() => {
      window.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [onCancel]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose exit direction"
        className="rounded-lg border border-border-default bg-bg-secondary p-4 shadow-xl"
      >
        <p className="mb-2 font-display text-xs tracking-wide text-text-primary">
          New exit direction
        </p>

        {/* Direction summary */}
        <div className="mb-3 rounded bg-bg-tertiary px-3 py-2">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="max-w-[5rem] truncate font-medium text-text-primary" title={source}>
              {sourceTitle ?? source}
            </span>
            <span className="font-semibold text-accent">
              {DIR_LABELS[selected] ?? selected.toUpperCase()}
            </span>
            <span className="text-text-muted">/</span>
            <span className="font-semibold text-accent">
              {OPPOSITE[selected] ? (DIR_LABELS[OPPOSITE[selected]] ?? OPPOSITE[selected].toUpperCase()) : "—"}
            </span>
            <span className="max-w-[5rem] truncate font-medium text-text-primary" title={target}>
              {targetTitle ?? target}
            </span>
          </div>
        </div>

        {/* Compass grid */}
        <div className="mb-2 grid grid-cols-3 gap-1" style={{ width: 140 }}>
          {(["nw", "n", "ne", "w", null, "e", "sw", "s", "se"] as const).map(
            (dir, i) =>
              dir ? (
                <button
                  key={dir}
                  onClick={() => setSelected(dir)}
                  className={`h-11 w-11 rounded text-2xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    selected === dir
                      ? "bg-accent text-white"
                      : "bg-bg-tertiary text-text-secondary hover:bg-bg-elevated"
                  }`}
                >
                  {DIR_LABELS_SHORT[dir]}
                </button>
              ) : (
                <div key={`empty-${i}`} className="h-11 w-11" />
              ),
          )}
        </div>

        {/* Up / Down row */}
        <div className="mb-3 flex gap-1">
          <button
            onClick={() => setSelected("u")}
            className={`h-11 flex-1 rounded text-2xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 ${
              selected === "u"
                ? "bg-accent text-white"
                : "bg-bg-tertiary text-text-secondary hover:bg-bg-elevated"
            }`}
          >
            Up
          </button>
          <button
            onClick={() => setSelected("d")}
            className={`h-11 flex-1 rounded text-2xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 ${
              selected === "d"
                ? "bg-accent text-white"
                : "bg-bg-tertiary text-text-secondary hover:bg-bg-elevated"
            }`}
          >
            Down
          </button>
        </div>

        {/* Confirm / Cancel */}
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 rounded bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/30"
          >
            Create
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
